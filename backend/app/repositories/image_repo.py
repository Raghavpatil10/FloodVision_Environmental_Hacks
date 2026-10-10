import sqlite3
import os
import uuid
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import logging
from ..config import settings
from .region_repo import haversine_distance_km

logger = logging.getLogger(__name__)

class ImageRepository:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.USERS_DB_PATH
        self._ensure_storage()
        self._init_schema()

    def _ensure_storage(self):
        if self.db_path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self):
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS flood_images (
                    id TEXT PRIMARY KEY,
                    uploader_id TEXT NOT NULL,
                    region_id TEXT,
                    title TEXT NOT NULL,
                    description TEXT,
                    s3_object_key TEXT NOT NULL,
                    content_type TEXT NOT NULL DEFAULT 'image/jpeg',
                    file_size INTEGER NOT NULL DEFAULT 0,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    location_validation_status TEXT NOT NULL DEFAULT 'verified',
                    detection_status TEXT NOT NULL DEFAULT 'completed',
                    yolo_results TEXT,
                    estimated_depth_cm REAL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(uploader_id) REFERENCES users(id),
                    FOREIGN KEY(region_id) REFERENCES admin_regions(id)
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_images_uploader ON flood_images(uploader_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_images_region ON flood_images(region_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_images_created ON flood_images(created_at);")
            conn.commit()

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        parsed_yolo = None
        if d.get("yolo_results"):
            try:
                parsed_yolo = json.loads(d["yolo_results"])
            except Exception:
                parsed_yolo = d["yolo_results"]
        return {
            "id": d["id"],
            "uploader_id": d["uploader_id"],
            "region_id": d.get("region_id"),
            "title": d["title"],
            "description": d.get("description"),
            "s3_object_key": d["s3_object_key"],
            "content_type": d["content_type"],
            "file_size": d.get("file_size", 0),
            "latitude": float(d["latitude"]),
            "longitude": float(d["longitude"]),
            "location_validation_status": d.get("location_validation_status", "verified"),
            "detection_status": d.get("detection_status", "completed"),
            "yolo_results": parsed_yolo,
            "estimated_depth_cm": float(d["estimated_depth_cm"]) if d.get("estimated_depth_cm") is not None else None,
            "created_at": d["created_at"],
            "updated_at": d.get("updated_at") or d["created_at"],
            "uploader_name": d.get("uploader_name"),
            "uploader_email": d.get("uploader_email")
        }

    def save_image(
        self,
        uploader_id: str,
        region_id: Optional[str],
        title: str,
        description: Optional[str],
        s3_object_key: str,
        content_type: str,
        file_size: int,
        latitude: float,
        longitude: float,
        location_validation_status: str = "verified",
        detection_status: str = "completed",
        yolo_results: Optional[Any] = None,
        estimated_depth_cm: Optional[float] = None
    ) -> Dict[str, Any]:
        image_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        yolo_str = json.dumps(yolo_results) if isinstance(yolo_results, (dict, list)) else (str(yolo_results) if yolo_results is not None else None)

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO flood_images (
                    id, uploader_id, region_id, title, description, s3_object_key,
                    content_type, file_size, latitude, longitude, location_validation_status,
                    detection_status, yolo_results, estimated_depth_cm, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    image_id, uploader_id, region_id, title.strip(), description.strip() if description else None,
                    s3_object_key, content_type, file_size, latitude, longitude,
                    location_validation_status, detection_status, yolo_str, estimated_depth_cm, now, now
                )
            )
            conn.commit()

        return self.get_image_by_id(image_id)

    def get_image_by_id(self, image_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT img.*, u.name as uploader_name, u.email as uploader_email
                FROM flood_images img
                LEFT JOIN users u ON img.uploader_id = u.id
                WHERE img.id = ?
                """,
                (image_id,)
            )
            row = cur.fetchone()
            if row:
                return self._row_to_dict(row)
        return None

    def list_images_in_region(
        self,
        center_lat: float,
        center_lon: float,
        radius_km: float,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Retrieves images strictly located within the specified circular geographic region.
        Applies mathematical Haversine distance verification server-side.
        """
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT img.*, u.name as uploader_name, u.email as uploader_email
                FROM flood_images img
                LEFT JOIN users u ON img.uploader_id = u.id
                ORDER BY img.created_at DESC
                """
            )
            rows = cur.fetchall()

        matched = []
        clean_search = search.lower().strip() if search else None

        for r in rows:
            img = self._row_to_dict(r)
            # 1. Geographic distance filter (Haversine check)
            dist = haversine_distance_km(img["latitude"], img["longitude"], center_lat, center_lon)
            if dist > radius_km:
                continue

            # 2. Text search filter
            if clean_search:
                title_match = clean_search in img["title"].lower()
                desc_match = bool(img["description"] and clean_search in img["description"].lower())
                uploader_match = bool(img["uploader_name"] and clean_search in img["uploader_name"].lower())
                if not (title_match or desc_match or uploader_match):
                    continue

            # 3. Status filter
            if status_filter and img["detection_status"] != status_filter:
                continue

            img["distance_to_center_km"] = round(dist, 2)
            matched.append(img)
            if len(matched) >= limit:
                break

        return matched

    def list_all_images(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT img.*, u.name as uploader_name, u.email as uploader_email
                FROM flood_images img
                LEFT JOIN users u ON img.uploader_id = u.id
                ORDER BY img.created_at DESC
                LIMIT ?
                """,
                (limit,)
            )
            return [self._row_to_dict(r) for r in cur.fetchall()]

    def update_image(
        self,
        image_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        img = self.get_image_by_id(image_id)
        if not img:
            return None
        now = datetime.now(timezone.utc).isoformat()
        new_title = title.strip() if title is not None else img["title"]
        new_desc = description.strip() if description is not None else img["description"]

        with self._get_connection() as conn:
            conn.execute(
                "UPDATE flood_images SET title = ?, description = ?, updated_at = ? WHERE id = ?",
                (new_title, new_desc, now, image_id)
            )
            conn.commit()

        return self.get_image_by_id(image_id)

    def delete_image(self, image_id: str) -> bool:
        with self._get_connection() as conn:
            cur = conn.execute("DELETE FROM flood_images WHERE id = ?", (image_id,))
            conn.commit()
            return cur.rowcount > 0

image_repo = ImageRepository()
