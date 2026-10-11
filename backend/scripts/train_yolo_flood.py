"""
FloodVision YOLOv8 Model Training & Fine-Tuning Pipeline
--------------------------------------------------------
This script provides the automated workflow to fine-tune YOLOv8 on floodwater 
and vehicle submersion imagery to produce higher confidence and accurate 
wheel/waterline localization.

Usage:
    python backend/scripts/train_yolo_flood.py --epochs 50 --batch 16 --model yolov8m.pt
"""

import os
import sys
import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("FloodVision-Train")

DATASET_CONFIG_TEMPLATE = """# FloodVision Waterlogging & Vehicle Submersion Dataset Configuration
path: ./dataset/flood_vehicles  # dataset root dir
train: images/train  # train images (relative to 'path')
val: images/val      # val images (relative to 'path')

# Classes
names:
  0: vehicle_dry        # unflooded passenger car / suv
  1: vehicle_submerged  # vehicle standing in floodwater / waterlogged
  2: tire_visible       # partially or fully visible wheel
  3: waterline          # water-surface boundary line on vehicle body
"""

def generate_yaml_if_missing(yaml_path: str):
    if not os.path.exists(yaml_path):
        os.makedirs(os.path.dirname(yaml_path), exist_ok=True)
        with open(yaml_path, "w") as f:
            f.write(DATASET_CONFIG_TEMPLATE)
        logger.info(f"Generated sample dataset yaml template at: {yaml_path}")

def run_training(
    data_yaml: str = "dataset/flood_dataset.yaml",
    base_model: str = "yolov8m.pt",
    epochs: int = 50,
    batch_size: int = 16,
    img_size: int = 640,
    weights_out_dir: str = "backend/app/weights"
):
    try:
        from ultralytics import YOLO
    except ImportError:
        logger.error("ultralytics package not found. Run: pip install ultralytics torch")
        sys.exit(1)

    logger.info("==================================================")
    logger.info("   FloodVision YOLOv8 Fine-Tuning Pipeline        ")
    logger.info("==================================================")
    logger.info(f"Base Weights:    {base_model}")
    logger.info(f"Dataset Config:  {data_yaml}")
    logger.info(f"Epochs:          {epochs}")
    logger.info(f"Batch Size:      {batch_size}")
    logger.info(f"Resolution:      {img_size}x{img_size}")

    generate_yaml_if_missing(data_yaml)

    # Initialize model with pre-trained COCO weights (transfer learning)
    logger.info(f"Loading pretrained weights: {base_model}...")
    model = YOLO(base_model)

    # Hyperparameters tuned for water reflections and varying monsoon lighting
    logger.info("Starting fine-tuning...")
    try:
        results = model.train(
            data=data_yaml,
            epochs=epochs,
            batch=batch_size,
            imgsz=img_size,
            optimizer="AdamW",
            lr0=0.001,
            lrf=0.01,
            warmup_epochs=3,
            box=7.5,
            cls=0.5,
            hsv_h=0.015,      # Hue augmentation
            hsv_s=0.7,        # Saturation augmentation
            hsv_v=0.4,        # Value / brightness for rainy overcast skies
            degrees=5.0,      # Small rotation
            fliplr=0.5,       # Horizontal flip
            mosaic=0.8,       # Mosaic augmentation for multi-vehicle scenes
            project="runs/floodvision",
            name="yolo_flood_model",
            exist_ok=True
        )

        logger.info("Training completed successfully!")
        
        # Deploy best weights into FloodVision application weights directory
        best_pt = "runs/floodvision/yolo_flood_model/weights/best.pt"
        if os.path.exists(best_pt):
            os.makedirs(weights_out_dir, exist_ok=True)
            target_pt = os.path.join(weights_out_dir, "best.pt")
            import shutil
            shutil.copy(best_pt, target_pt)
            logger.info(f"Successfully copied fine-tuned model to: {target_pt}")
            logger.info("FloodVision will now automatically load and use this trained model on startup!")
        else:
            logger.warning(f"Could not find {best_pt}. Check training runs output.")

    except Exception as e:
        logger.error(f"Training failed: {e}")
        logger.info("\nQuick start note: Ensure images are placed in dataset/flood_vehicles/images/train and annotations in labels/train.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train YOLOv8 for FloodVision")
    parser.add_argument("--data", default="dataset/flood_dataset.yaml", help="Path to data YAML")
    parser.add_argument("--model", default="yolov8m.pt", help="Pretrained model (yolov8n.pt, yolov8s.pt, yolov8m.pt)")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    args = parser.parse_args()

    run_training(
        data_yaml=args.data,
        base_model=args.model,
        epochs=args.epochs,
        batch_size=args.batch,
        img_size=args.imgsz
    )
