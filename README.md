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

---

## 🔐 User Authentication & Secure Admin Approval System

FloodVision implements a unified, role-based access control (RBAC) architecture with secure session management, email verification, and an atomic administrator approval workflow.

### User Roles & Permissions
- **`user` (Citizen Reporter):** Default role assigned to all public registrations. Can capture/upload flooded street photographs, perform YOLOv8 depth inferences, view the live hazard GIS map, calculate bypass routes, and request emergency admin clearance.
- **`admin` (Municipal Officer):** Can access the protected command triage dashboard (`/admin/dashboard`), review and approve/reject emergency access applications, monitor incident telemetry, and inspect audit logs.

### Database Architecture & Integrity Constraints
User accounts and authorization records are stored persistently in SQLite/PostgreSQL with automatic schema migrations:
- **`users`:** Stores normalized email, Argon2/bcrypt password hash, role (`user` or `admin`), `is_active`, `email_verified`, `verified_at`, and timestamps.
- **`admin_requests`:** Stores application reason, review status (`pending`, `approved`, `rejected`), reviewer ID, review note, and timestamps.
  - **Partial Unique Index:** `CREATE UNIQUE INDEX idx_admin_requests_user_pending ON admin_requests(user_id) WHERE status = 'pending';` prevents duplicate pending applications at the database level.
- **`audit_logs`:** Immutable security audit ledger recording actor, action, target user, structured metadata, and UTC timestamp.

### One-Time Initial Administrator Setup (Bootstrap)
To maintain zero-trust security on a fresh deployment:
1. The site owner registers an account through the FloodVision portal and verifies their email address.
2. The server administrator configures `ADMIN_INITIAL_EMAIL` in the server environment (e.g. `admin@floodvision.org`).
3. Execute the server-side CLI bootstrap command:
   ```bash
   cd backend
   python -m app.scripts.bootstrap_admin
   ```
   **Security guarantees enforced by bootstrap:**
   - Promotes **only** the explicitly configured `ADMIN_INITIAL_EMAIL` account.
   - Refuses bootstrap if any administrator already exists in the database.
   - Enforces email verification on the account before promotion.
   - Performs role upgrade and audit log recording inside an atomic transaction.
   - No public HTTP endpoints exist for initial admin promotion.

### API Endpoints Reference

#### Authentication (`/api/auth`)
- `POST /api/auth/register` — Registers citizen account (strictly assigns `user` role).
- `POST /api/auth/login` — Authenticates email & password, sets `HttpOnly`, `SameSite=Lax`, `Secure` session cookie with brute-force rate limiting.
- `POST /api/auth/logout` — Invalidates active session cookie.
- `GET /api/auth/me` — Returns current authenticated user profile and verification status.
- `POST /api/auth/verify-email` — Verifies email address for current user or token.
- `POST /api/auth/send-verification` — Generates email verification token.

#### Admin Requests (`/api/admin-requests`)
- `POST /api/admin-requests` — Submits access application (requires verified user, rejects duplicate pending).
- `GET /api/admin-requests/me` — Retrieves authenticated user's own application history.
- `GET /api/admin-requests` — *(Admin Only)* Lists all pending or historical applications.
- `POST /api/admin-requests/{request_id}/review` — *(Admin Only)* Atomically approves or rejects application in a single database transaction:
  - Blocks self-approval (HTTP 403).
  - Prevents race conditions / double-reviews (HTTP 409).
  - Atomically updates request status, user role, and writes to audit logs.

#### Administrative Triage (`/api/admin`)
- `GET /api/admin/overview` — *(Admin Only)* Returns telemetry, user counts, and hazard metrics.
- `GET /api/admin/users` — *(Admin Only)* Lists registered users.
- `GET /api/admin/audit-logs` — *(Admin Only)* Lists recent security audit logs.

### Running Automated Tests
Execute the comprehensive test suites verifying authentication, RBAC, atomic reviews, and FloodVision services:
```bash
cd backend
python -m pytest tests/
```


