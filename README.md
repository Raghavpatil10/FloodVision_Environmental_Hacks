# 🌊 FloodVision: CV-Powered Waterlogging Depth Gauge

**Built for Environmental Hacks 2026 | Track 02: Heat and Water**  
**Team:** TeamAPEX 
**Live Demo:** [Add your Amplify URL here]  
**API Docs:** [Add your App Runner Swagger URL here]/docs  
**Video Walkthrough (3 min):** [Add YouTube/Loom link here]

---

## 🚨 The Problem
During monsoons, underpasses and arterial dips flood within minutes. Because turbid water is completely opaque, commuters face an optical illusion that hides true water depth. Entering just **30 cm** of water can hydro-lock an internal combustion engine, submerge EV battery packs, or sweep away light passenger vehicles. 

Municipal response relies on delayed, text-only citizen complaints that lack quantifiable depth metrics, preventing traffic authorities from prioritizing emergency road closures before catastrophic damage occurs.

---

## 💡 The Solution
FloodVision is an end-to-end edge-to-cloud computer vision platform. When citizens or traffic wardens snap a photo through our progressive React web application, the system:

1. **Extracts Metadata:** Captures the image along with high-accuracy GPS coordinates and timestamps.
2. **Performs Computer Vision Inference:** Runs a custom YOLOv8 model (fine-tuned on annotated flooded-vehicle datasets) to segment reference markers—specifically vehicle wheels and chassis baselines.
3. **Calculates Physical Depth ($D$):** Derives millimeter-calibrated water depth via bounding-box aspect ratio distortions against known dimensional baselines:
   $$D = H_{\text{ref}} \times \left(1 - \frac{h_{\text{visible}}}{h_{\text{nominal}}}\right)$$
4. **Triggers Emergency Escalation:** If estimated water depth breaches the critical **30 cm** engine-kill threshold:
   * Dispatches automated, geo-tagged SMS alerts to local traffic police via **Amazon SNS**.
   * Persists the record to **Amazon DynamoDB** for real-time GIS mapping on the municipal triage dashboard.
   * Stores the annotated visual proof in **Amazon S3**.

---

## 🛠️ System Architecture & Tech Stack

```text
[ Citizen / Warden Device ]
          │  (Photo + Geolocation)
          ▼
[ React + Vite Frontend (AWS Amplify) ]
          │  (Multipart Form POST)
          ▼
[ FastAPI Inference API (AWS App Runner via Amazon ECR) ]
   ├── Runs YOLOv8 Tensor Inference (best.pt weights)
   ├── Computes Depth Calibration Geometry
   │
   ├──▶ Uploads Raw & Annotated Images ────▶ [ Amazon S3 ]
   ├──▶ Writes Geospatial Telemetry ───────▶ [ Amazon DynamoDB ]
   └──▶ Triggers Alert (if Depth > 30cm) ──▶ [ Amazon SNS ] ──▶ [ Traffic Wardens / Drivers ]
```

---

## Tech Stack
```
├── model_training/                  # Colab training pipeline & dataset config
│   ├── FloodVision_YOLOv8.ipynb     # Jupyter notebook for Colab T4 GPU training
│   ├── dataset.yaml                 # Roboflow dataset configuration
│   └── metrics/                     # Precision-Recall & F1-score plots
├── frontend/                        # React web application
│   ├── src/
│   │   ├── components/              # Camera, Geolocation, and Result views
│   │   ├── App.jsx                  # Main application container
│   │   └── main.jsx                 # Entrypoint
│   ├── package.json
│   └── amplify.yml                  # AWS Amplify CI/CD build specification
├── backend/                         # FastAPI inference microservice
│   ├── app/
│   │   ├── weights/
│   │   │   └── best.pt              # Fine-tuned YOLOv8 model weights
│   │   ├── main.py                  # API routes, CORS, and AWS SDK logic
│   │   ├── yolo_logic.py            # Bounding-box ratio & depth calculations
│   │   └── schemas.py               # Pydantic validation models
│   ├── requirements.txt             # Python dependencies
│   └── Dockerfile                   # Production container definition
└── README.md
```

## Deployment & Setup Instructions

### Local Development Setup
1. Create a `.env` file in the `backend` directory based on `backend/.env.example`.
2. Add your AWS credentials (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`) to the `.env` file to fix botocore credential errors.
3. Start the backend:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python -m uvicorn app.main:app --reload
   ```
4. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Backend (AWS App Runner)
1. Ensure the `backend` folder is pushed to ECR or linked to App Runner.
2. The Dockerfile exposes port 8080.
3. Configure the environment variables in App Runner using `backend/.env.example`.
4. Ensure the App Runner IAM role has access to the S3 Bucket, DynamoDB table, and SNS Topic.

### Frontend (AWS Amplify)
1. Link your repository to AWS Amplify.
2. Set the base directory to `frontend`.
3. Configure the `VITE_API_BASE_URL` environment variable in Amplify to point to your App Runner endpoint.
4. Build settings should use `npm run build`.

