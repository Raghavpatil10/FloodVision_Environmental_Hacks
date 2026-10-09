from typing import Dict, Any, Tuple
from .yolo_service import yolo_detector
from .s3_service import s3_service
import logging

logger = logging.getLogger(__name__)

class AnalysisService:
    def analyze_image(self, file_content: bytes) -> Dict[str, Any]:
        """
        Runs YOLOv8 computer vision detection and depth estimation:
        1. Analyzes vehicle and tire bounding boxes with YOLOv8.
        2. Estimates floodwater depth using physical tire submersion geometry.
        3. Uploads the raw and annotated visual proof to Amazon S3.
        4. Returns structured results including status flag and telemetry.
        """
        # Run YOLO detection & depth calculation
        cv_result = yolo_detector.detect_and_estimate(file_content)
        
        # Upload original image to Amazon S3
        raw_image_url = s3_service.upload_image(file_content, filename_prefix="raw")
        
        # Upload annotated bounding-box visual image to Amazon S3
        annotated_image_url = s3_service.upload_image(
            cv_result["annotated_image_bytes"], 
            filename_prefix="annotated"
        )
        
        return {
            "estimated_depth_cm": cv_result["estimated_depth_cm"],
            "status_flag": cv_result["status_flag"],
            "risk_level": cv_result["risk_level"],
            "safety_score": cv_result["safety_score"],
            "confidence": cv_result["confidence"],
            "submerged_ratio": cv_result["submerged_ratio"],
            "reason": cv_result["reason"],
            "raw_image_url": raw_image_url,
            "annotated_image_url": annotated_image_url,
            "detections_count": cv_result["detections_count"]
        }

analysis_service = AnalysisService()
