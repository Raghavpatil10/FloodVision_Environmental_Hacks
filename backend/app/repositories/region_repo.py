import sqlite3
import os
import uuid
import math
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import logging
from ..config import settings

logger = logging.getLogger(__name__)

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes the great-circle distance between two GPS coordinates on Earth
    using the Haversine formula. Returns distance in kilometers.
    """
    R = 6371.0088  # Mean Earth radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class RegionRepository:
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
                CREATE TABLE IF NOT EXISTS admin_regions (
                    id TEXT PRIMARY KEY,
                    admin_user_id TEXT NOT NULL,
                    region_name TEXT NOT NULL,
                    center_latitude REAL NOT NULL,
                    center_longitude REAL NOT NULL,
                    radius_km REAL NOT NULL DEFAULT 5.0,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(admin_user_id) REFERENCES users(id)
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_regions_admin ON admin_regions(admin_user_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_regions_active ON admin_regions(is_active);")
            conn.commit()

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        return {
            "id": d["id"],
            "admin_user_id": d["admin_user_id"],
            "region_name": d["region_name"],
            "center_latitude": float(d["center_latitude"]),
            "center_longitude": float(d["center_longitude"]),
            "radius_km": float(d["radius_km"]),
            "is_active": bool(d.get("is_active", 1)),
            "created_at": d["created_at"],
            "updated_at": d.get("updated_at") or d["created_at"],
            "admin_name": d.get("admin_name"),
            "admin_email": d.get("admin_email")
        }

    def assign_region(
        self,
        admin_user_id: str,
        region_name: str,
        center_latitude: float,
        center_longitude: float,
        radius_km: float = 5.0,
        is_active: bool = True
    ) -> Dict[str, Any]:
        """
        Creates or activates a regional assignment for an administrator.
        Deactivates any previous active regions for this admin to enforce a single active region.
        """
        if not (-90.0 <= center_latitude <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90. Got: {center_latitude}")
        if not (-180.0 <= center_longitude <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180. Got: {center_longitude}")
        if radius_km <= 0.0:
            raise ValueError(f"Radius in kilometers must be strictly positive. Got: {radius_km}")

        region_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        active_int = 1 if is_active else 0

        with self._get_connection() as conn:
            # Deactivate previous active regions for this admin if creating an active one
            if is_active:
                conn.execute(
                    "UPDATE admin_regions SET is_active = 0, updated_at = ? WHERE admin_user_id = ?",
                    (now, admin_user_id)
                )

            conn.execute(
                """
                INSERT INTO admin_regions (id, admin_user_id, region_name, center_latitude, center_longitude, radius_km, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (region_id, admin_user_id, region_name.strip(), center_latitude, center_longitude, radius_km, active_int, now, now)
            )
            conn.commit()

        return self.get_region_by_id(region_id)

    def get_region_by_id(self, region_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT r.*, u.name as admin_name, u.email as admin_email
                FROM admin_regions r
                LEFT JOIN users u ON r.admin_user_id = u.id
                WHERE r.id = ?
                """,
                (region_id,)
            )
            row = cur.fetchone()
            if row:
                return self._row_to_dict(row)
        return None

    def get_active_region_by_admin_id(self, admin_user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT r.*, u.name as admin_name, u.email as admin_email
                FROM admin_regions r
                LEFT JOIN users u ON r.admin_user_id = u.id
                WHERE r.admin_user_id = ? AND r.is_active = 1
                ORDER BY r.updated_at DESC
                LIMIT 1
                """,
                (admin_user_id,)
            )
            row = cur.fetchone()
            if row:
                return self._row_to_dict(row)
        return None

    def list_all_regions(self, active_only: bool = False) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            query = """
                SELECT r.*, u.name as admin_name, u.email as admin_email
                FROM admin_regions r
                LEFT JOIN users u ON r.admin_user_id = u.id
            """
            if active_only:
                query += " WHERE r.is_active = 1"
            query += " ORDER BY r.created_at DESC"

            cur = conn.execute(query)
            return [self._row_to_dict(row) for row in cur.fetchall()]

    def update_region(
        self,
        region_id: str,
        region_name: Optional[str] = None,
        center_latitude: Optional[float] = None,
        center_longitude: Optional[float] = None,
        radius_km: Optional[float] = None,
        is_active: Optional[bool] = None
    ) -> Optional[Dict[str, Any]]:
        current = self.get_region_by_id(region_id)
        if not current:
            return None

        now = datetime.now(timezone.utc).isoformat()
        new_name = region_name.strip() if region_name is not None else current["region_name"]
        new_lat = center_latitude if center_latitude is not None else current["center_latitude"]
        new_lon = center_longitude if center_longitude is not None else current["center_longitude"]
        new_radius = radius_km if radius_km is not None else current["radius_km"]
        new_active = (1 if is_active else 0) if is_active is not None else (1 if current["is_active"] else 0)

        if not (-90.0 <= new_lat <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90. Got: {new_lat}")
        if not (-180.0 <= new_lon <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180. Got: {new_lon}")
        if new_radius <= 0.0:
            raise ValueError(f"Radius in kilometers must be strictly positive. Got: {new_radius}")

        with self._get_connection() as conn:
            conn.execute(
                """
                UPDATE admin_regions
                SET region_name = ?, center_latitude = ?, center_longitude = ?, radius_km = ?, is_active = ?, updated_at = ?
                WHERE id = ?
                """,
                (new_name, new_lat, new_lon, new_radius, new_active, now, region_id)
            )
            conn.commit()

        return self.get_region_by_id(region_id)

    def is_point_in_region(self, lat: float, lon: float, region: Dict[str, Any]) -> bool:
        """
        Validates whether a coordinate (lat, lon) is within the region's circular perimeter.
        """
        dist = haversine_distance_km(lat, lon, region["center_latitude"], region["center_longitude"])
        return dist <= float(region["radius_km"])

region_repo = RegionRepository()
