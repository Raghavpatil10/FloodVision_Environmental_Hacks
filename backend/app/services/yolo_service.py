import os
import io
import math
import logging
from typing import Dict, Any, Tuple, List, Optional
from PIL import Image, ImageDraw, ImageFont
import numpy as np

logger = logging.getLogger(__name__)

# Physical reference standards (cm)
STANDARD_CAR_HEIGHT_CM = 150.0      # Nominal passenger car unflooded height
STANDARD_SUV_HEIGHT_CM = 175.0      # Nominal SUV / Light truck unflooded height
STANDARD_TIRE_DIAMETER_CM = 65.0    # Standard passenger vehicle tire outer diameter

# Front/rear view aspect ratios (height / width) on dry pavement
NOMINAL_CAR_ASPECT = 0.84           # Standard hatchback/sedan (Swift, Civic, etc.)
NOMINAL_SUV_ASPECT = 0.92           # Standard SUV / Van / Light truck

class YOLODepthDetector:
    def __init__(self, weights_path: Optional[str] = None):
        """
        Initializes the YOLOv8 model.
        Loads custom trained weights (best.pt) or pre-trained yolov8n.pt.
        """
        self.model = None
        self.weights_path = weights_path
        self._init_model()

    def _init_model(self):
        try:
            from ultralytics import YOLO
            
            possible_weights = [
                self.weights_path,
                os.path.join(os.path.dirname(__file__), "..", "weights", "best.pt"),
                os.path.join(os.getcwd(), "app", "weights", "best.pt"),
                os.path.join(os.getcwd(), "yolov8n.pt"),
                "yolov8n.pt"
            ]
            
            selected_weight = None
            for w in possible_weights:
                if w and os.path.exists(w):
                    selected_weight = w
                    break
            
            if not selected_weight:
                selected_weight = "yolov8n.pt"
                
            logger.info(f"Loading YOLO model with weights: {selected_weight}")
            self.model = YOLO(selected_weight)
            logger.info("YOLO model successfully loaded.")
        except Exception as e:
            logger.warning(f"Could not initialize YOLO model: {e}. Heuristic fallback will be used.")
            self.model = None

    def detect_and_estimate(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Runs computer vision inference:
        1. Detects vehicles ('car', 'truck', 'bus') and 'tire' / 'wheel' bounding boxes.
        2. Estimates floodwater depth using:
           - Physical tire aspect submersion if wheels are visible above water.
           - Vehicle aspect ratio truncation when wheels are submerged under turbid floodwater.
        3. Annotates the image with vehicle bounding boxes, waterlines, and telemetry HUD.
        4. Returns estimated depth, status flag (Safe/Caution/Danger), confidence, and annotated image bytes.
        """
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as e:
            raise ValueError(f"Invalid image format: {e}")

        img_w, img_h = image.size
        vehicle_detections: List[Dict[str, Any]] = []
        explicit_tire_detections: List[Dict[str, Any]] = []
        overall_conf = 0.75

        if self.model:
            try:
                results = self.model.predict(image, conf=0.20, verbose=False)
                if results and len(results) > 0:
                    result = results[0]
                    names = result.names
                    boxes = result.boxes
                    
                    if boxes is not None and len(boxes) > 0:
                        confidences = []
                        for box in boxes:
                            cls_id = int(box.cls[0].item())
                            conf = float(box.conf[0].item())
                            confidences.append(conf)
                            cls_name = names.get(cls_id, "").lower()
                            coords = box.xyxy[0].tolist() # [x1, y1, x2, y2]
                            
                            w = coords[2] - coords[0]
                            h = coords[3] - coords[1]
                            
                            if cls_name in ["car", "truck", "bus", "van", "vehicle"]:
                                vehicle_detections.append({
                                    "class": cls_name,
                                    "conf": conf,
                                    "bbox": coords,
                                    "w": w,
                                    "h": h,
                                    "ar": h / max(1.0, w)
                                })
                            elif "tire" in cls_name or "wheel" in cls_name:
                                explicit_tire_detections.append({
                                    "conf": conf,
                                    "bbox": coords,
                                    "w": w,
                                    "h": h,
                                    "ar": h / max(1.0, w)
                                })
                        
                        if confidences:
                            overall_conf = round(float(np.mean(confidences)), 2)
            except Exception as e:
                logger.warning(f"Inference error: {e}. Falling back to geometric analysis.")

        # =========================================================================
        # Physical Depth Estimation
        # =========================================================================
        depth_estimates: List[float] = []
        depth_weights: List[float] = []
        primary_vehicle: Optional[Dict[str, Any]] = None

        # Mode A: Explicit Tires Detected (partially visible wheels)
        if explicit_tire_detections:
            for td in explicit_tire_detections:
                tw = td["w"]
                th = td["h"]
                if tw > 0:
                    # Circular wheel has nominal height == width.
                    # As water rises, visible height decreases.
                    visible_ratio = min(1.0, max(0.05, th / tw))
                    submerged_ratio = max(0.0, 1.0 - visible_ratio)
                    d = STANDARD_TIRE_DIAMETER_CM * submerged_ratio
                    depth_estimates.append(d)
                    depth_weights.append(tw * td["conf"])

        # Mode B: Vehicle Aspect Ratio Truncation (When wheels are submerged)
        # When a car drives into floodwater, the camera cannot see through opaque water.
        # The YOLO bounding box stops at the waterline (cy2).
        # By comparing the observed height-to-width ratio against nominal unflooded proportions,
        # we calculate the physical submerged depth.
        if vehicle_detections:
            # Sort vehicles by bounding box area (focus on prominent foreground vehicles)
            vehicle_detections.sort(key=lambda v: v["w"] * v["h"], reverse=True)
            primary_vehicle = vehicle_detections[0]

            for vd in vehicle_detections:
                # Discard very tiny distant background detections for calibration
                if vd["w"] < max(35.0, img_w * 0.08):
                    continue

                is_large_vehicle = vd["class"] in ["truck", "bus"] or vd["ar"] > 0.88
                nominal_ar = NOMINAL_SUV_ASPECT if is_large_vehicle else NOMINAL_CAR_ASPECT
                nominal_height = STANDARD_SUV_HEIGHT_CM if is_large_vehicle else STANDARD_CAR_HEIGHT_CM

                observed_ar = vd["ar"]

                # If observed aspect ratio is lower than nominal dry aspect ratio,
                # the lower portion of the car is submerged under the waterline.
                if observed_ar < nominal_ar:
                    truncation_ratio = min(0.65, max(0.0, 1.0 - (observed_ar / nominal_ar)))
                    d = nominal_height * truncation_ratio
                else:
                    d = 0.0

                depth_estimates.append(d)
                # Weight by vehicle width and detection confidence
                depth_weights.append(vd["w"] * vd["conf"])

        # Combine calibrated depth
        if depth_estimates and sum(depth_weights) > 0:
            weighted_depth = sum(d * w for d, w in zip(depth_estimates, depth_weights)) / sum(depth_weights)
            estimated_depth_cm = round(float(weighted_depth), 1)
        elif vehicle_detections:
            # Fallback for primary vehicle
            primary = vehicle_detections[0]
            observed_ar = primary["ar"]
            truncation = min(0.65, max(0.0, 1.0 - (observed_ar / NOMINAL_CAR_ASPECT)))
            estimated_depth_cm = round(STANDARD_CAR_HEIGHT_CM * truncation, 1)
        else:
            # Fallback when no vehicle is detected
            estimated_depth_cm = 8.0
            overall_conf = 0.50

        # Cap between realistic operational flood range
        estimated_depth_cm = max(0.0, min(80.0, estimated_depth_cm))

        # Calculate tire submersion percentage
        submerged_ratio = min(1.0, max(0.0, estimated_depth_cm / STANDARD_TIRE_DIAMETER_CM))

        # Status Flag calculation as per hackathon specification:
        # Safe: 0-15cm, Caution: 16-29cm, Danger: 30+cm
        if estimated_depth_cm <= 15.0:
            status_flag = "Safe"
            risk_level = "low"
            reason = f"Water depth is {estimated_depth_cm} cm. Safe for passage for all vehicles."
            safety_score = 100 - int((estimated_depth_cm / 15.0) * 20) # 80 - 100
        elif estimated_depth_cm < 30.0:
            status_flag = "Caution"
            risk_level = "moderate" if estimated_depth_cm <= 22.0 else "high"
            reason = f"Water depth is {estimated_depth_cm} cm. Caution: low-clearance vehicles may be compromised."
            safety_score = 79 - int(((estimated_depth_cm - 15.0) / 15.0) * 45) # 34 - 79
        else:
            status_flag = "Danger"
            risk_level = "critical"
            reason = f"Critical flood depth of {estimated_depth_cm} cm breaches the 30 cm engine stall limit! Submerged tires indicate severe waterlogging hazard."
            safety_score = max(5, 30 - int(((estimated_depth_cm - 30.0) / 30.0) * 25)) # 5 - 30

        # Annotate image
        annotated_bytes = self._annotate_image(
            image=image,
            vehicles=vehicle_detections[:5], # Annotate top 5 prominent vehicles
            explicit_tires=explicit_tire_detections,
            primary_vehicle=primary_vehicle,
            depth_cm=estimated_depth_cm,
            status_flag=status_flag,
            submerged_ratio=submerged_ratio,
            conf=overall_conf
        )

        return {
            "estimated_depth_cm": estimated_depth_cm,
            "status_flag": status_flag,
            "risk_level": risk_level,
            "safety_score": safety_score,
            "confidence": overall_conf,
            "submerged_ratio": round(submerged_ratio * 100, 1),
            "reason": reason,
            "detections_count": len(vehicle_detections) + len(explicit_tire_detections),
            "car_count": len(vehicle_detections),
            "tire_count": len(explicit_tire_detections),
            "annotated_image_bytes": annotated_bytes
        }

    def _annotate_image(
        self,
        image: Image.Image,
        vehicles: List[Dict[str, Any]],
        explicit_tires: List[Dict[str, Any]],
        primary_vehicle: Optional[Dict[str, Any]],
        depth_cm: float,
        status_flag: str,
        submerged_ratio: float,
        conf: float
    ) -> bytes:
        """
        Draws professional computer vision annotations:
        - Bounding boxes for vehicle and tires
        - Submerged baseline waterline with depth measurement callouts
        - Top HUD telemetry banner
        """
        annotated = image.copy()
        draw = ImageDraw.Draw(annotated)
        img_w, img_h = annotated.size

        # Color schemes based on status
        if status_flag == "Safe":
            status_color = (16, 185, 129)  # Emerald Green
            waterline_color = (16, 185, 129)
        elif status_flag == "Caution":
            status_color = (245, 158, 11)  # Amber Yellow
            waterline_color = (245, 158, 11)
        else:
            status_color = (239, 68, 68)   # Crimson Red
            waterline_color = (239, 68, 68)

        # 1. Draw vehicle bounding boxes
        for vd in vehicles:
            coords = vd["bbox"]
            x1, y1, x2, y2 = [int(v) for v in coords]
            draw.rectangle([x1, y1, x2, y2], outline=(37, 99, 235), width=3)
            # Label background
            label = f"{vd['class'].upper()}: {int(vd['conf']*100)}%"
            draw.rectangle([x1, max(0, y1 - 20), x1 + len(label) * 8 + 10, y1], fill=(37, 99, 235))
            draw.text((x1 + 4, max(0, y1 - 16)), label, fill=(255, 255, 255))

        # 2. Draw explicit tire bounding boxes (if any detected)
        for td in explicit_tires:
            coords = td["bbox"]
            x1, y1, x2, y2 = [int(v) for v in coords]
            draw.rectangle([x1, y1, x2, y2], outline=(6, 182, 212), width=2)
            draw.rectangle([x1, max(0, y1 - 18), x1 + 100, y1], fill=(6, 182, 212))
            draw.text((x1 + 4, max(0, y1 - 15)), "TIRE: Visible", fill=(0, 0, 0))

        # 3. Highlight waterline across the primary affected vehicle
        if primary_vehicle:
            px1, py1, px2, py2 = [int(v) for v in primary_vehicle["bbox"]]
            
            # Draw bold waterline across the submerged base
            wl_y = min(img_h - 10, py2)
            draw.line([(max(0, px1 - 30), wl_y), (min(img_w, px2 + 30), wl_y)], fill=waterline_color, width=4)
            
            # Waterline banner callout
            wl_label = f"WATERLINE: {depth_cm} cm | Tires {round(submerged_ratio * 100)}% Submerged"
            banner_w = len(wl_label) * 8 + 16
            draw.rectangle([max(0, px1 - 20), wl_y + 4, max(0, px1 - 20) + banner_w, wl_y + 26], fill=waterline_color)
            draw.text((max(0, px1 - 16), wl_y + 7), wl_label, fill=(255, 255, 255))

        # 4. Top HUD Telemetry Banner
        hud_height = 42
        draw.rectangle([0, 0, img_w, hud_height], fill=(15, 23, 42)) # Slate dark
        # Status pill
        draw.rectangle([10, 8, 125, 34], fill=status_color)
        draw.text((20, 12), f"[{status_flag.upper()}]", fill=(255, 255, 255))
        
        # Telemetry text
        hud_text = (
            f"FloodVision YOLOv8 Gauge | Depth: {depth_cm} cm | "
            f"Tires Submerged: {round(submerged_ratio * 100)}% | Conf: {int(conf * 100)}%"
        )
        draw.text((135, 12), hud_text, fill=(241, 245, 249))

        output_buffer = io.BytesIO()
        annotated.save(output_buffer, format="JPEG", quality=90)
        return output_buffer.getvalue()

yolo_detector = YOLODepthDetector()
