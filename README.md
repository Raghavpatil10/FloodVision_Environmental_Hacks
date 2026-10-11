#  FloodVision: CV-Powered Waterlogging Depth Gauge & Hazard Alert Platform

[![Environmental Hacks 2026](https://img.shields.io/badge/Environmental_Hacks_2026-Track_02:_Heat_&_Water-0284c7?style=for-the-badge)](https://github.com/Raghavpatil10/FloodVision_Environmental_Hacks)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%20%7C%203.13-blue.svg?style=for-the-badge&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.2-61DAFB.svg?style=for-the-badge&logo=react)](https://react.dev)
[![AWS](https://img.shields.io/badge/AWS-S3_%7C_DynamoDB_%7C_SNS_%7C_App_Runner-FF9900.svg?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com)
[![Tests Passing](https://img.shields.io/badge/Tests-52%20Passed-success?style=for-the-badge)](https://pytest.org)

**Built for Environmental Hacks 2026 | Track 02: Heat and Water**  
**Team:** TeamAPEX  
**Repository:** [https://github.com/Raghavpatil10/FloodVision_Environmental_Hacks](https://github.com/Raghavpatil10/FloodVision_Environmental_Hacks)  
**Live Demo:** [Add your Amplify URL here]  
**API Docs:** [Add your App Runner Swagger URL here]/docs  
**Video Walkthrough (3 min):** [Add YouTube/Loom link here]  

---

## 🚨 The Problem

During monsoonal cloudbursts, railway underpasses, arterial highway dips, and low-lying intersections flood within minutes. Because turbid floodwater is completely opaque, commuters and first responders face an optical illusion that masks true water depth:

* **30 cm Engine-Kill Threshold:** Entering just **30 cm (12 in)** of water causes severe hydrostatic lock in internal combustion engines, shorts out high-voltage electric vehicle (EV) battery packs, and floats light passenger sedans off their tires.
* **Delayed Municipal Response:** Civic authorities rely on delayed, text-only citizen complaints that lack quantifiable depth metrics, preventing emergency services and traffic wardens from prioritizing timely road closures before vehicles submerge.
* **Blind Commuter Routing:** Standard navigation apps continue routing motorists through submerged intersections until roads are manually barricaded.

---

## 💡 The Solution

**FloodVision** is an end-to-end edge-to-cloud computer vision and municipal incident response platform. When citizens, bus operators, or traffic wardens snap a photo through the responsive React web application:

1. **Extracts Spatial Telemetry:** Captures the street photo with high-precision GPS coordinates, reverse-geocoded landmarks, and UTC timestamps.
2. **Executes Computer Vision Inference:** Employs a fine-tuned **YOLOv8** neural network to detect reference physical markers—specifically vehicle bodies (`car`, `suv`, `truck`, `bus`) and visible tire/wheel baselines.
3. **Calibrates Physical Flood Depth ($D$):** Derives millimeter-calibrated water depth via bounding-box aspect ratio distortions against known physical dimensions.
4. **Calculates Safety Scores ($0–100$):** Categorizes waterlogging into three operational hazard levels:
   * 🟢 **Safe** ($0–15\text{ cm}$): Passable for all vehicles.
   * 🟡 **Caution** ($15–29\text{ cm}$): High risk of water ingress for low-clearance vehicles.
   * 🔴 **Danger / Engine-Kill** ($\ge 30\text{ cm}$): Severe flooding. Submersion hazard. Immediate road closure triggered.
5. **Triggers Automated Emergency Escalation:** If depth reaches or exceeds **30 cm**:
   * Automatically dispatches emergency SMS alerts to traffic wardens via **Amazon SNS**.
   * Persists geospatial telemetry to **Amazon DynamoDB** for real-time GIS mapping.
   * Uploads raw and HUD-annotated visual proof to **Amazon S3**.
6. **AI Safe Bypass Routing:** Reroutes commuters dynamically around active waterlogging hazard zones using Open Source Routing Machine (OSRM) and OpenStreetMap geocoding.

---

## 📐 Mathematical Formulation & Depth Physics

FloodVision uses physical vehicle baseline dimensions to estimate water depth from monocular 2D images:

### 1. Partial Tire Submersion Mode (Visible Wheels)
Standard passenger car wheels have a nominal diameter $D_{\text{tire}} \approx 65\text{ cm}$. Under dry conditions, an unoccluded tire presents a circular aspect ratio ($h \approx w$). As water rises, the bottom of the tire is occluded:

$$D = D_{\text{tire}} \times \left(1 - \frac{h_{\text{visible}}}{w_{\text{visible}}}\right)$$

### 2. Vehicle Aspect Ratio Truncation Mode (Fully Submerged Wheels)
When floodwater exceeds wheel height ($> 30\text{ cm}$), tires become invisible under turbid water. The YOLO bounding box stops at the waterline. FloodVision calculates depth by measuring the distortion between the observed bounding-box aspect ratio ($AR_{\text{observed}} = h/w$) and the nominal dry aspect ratio ($AR_{\text{nominal}}$):

$$D = H_{\text{nominal}} \times \left(1 - \frac{AR_{\text{observed}}}{AR_{\text{nominal}}}\right)$$

* Nominal Car Height ($H_{\text{nominal}}$): $150\text{ cm}$ ($AR_{\text{nominal}} = 0.84$)
* Nominal SUV/Truck Height ($H_{\text{nominal}}$): $175\text{ cm}$ ($AR_{\text{nominal}} = 0.92$)

### 3. Safety Scoring Matrix
| Depth Range ($D$) | Status Flag | Risk Level | Safety Score | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **$0 \le D \le 5\text{ cm}$** | **Safe** | Low | $90 - 100$ | Road fully passable |
| **$5 < D \le 15\text{ cm}$** | **Safe** | Moderate | $60 - 89$ | Passable with caution |
| **$15 < D < 30\text{ cm}$** | **Caution** | High | $25 - 59$ | Low clearance caution; avoid if possible |
| **$D \ge 30\text{ cm}$** | **Danger** | Critical | $0 - 24$ | **🚨 30 cm Engine-Kill Breach: Emergency SMS Dispatched** |

---

## 🛠️ System Architecture

```text
  ┌─────────────────────────────────────────────────────────────┐
  │                 Citizen / Traffic Warden Device             │
  │     (Mobile Browser / Camera / GPS / Geolocation Fallback)  │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                     HTTPS Multipart Form / REST
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                 React 18 + Vite Web Application             │
  │                 (Hosted on AWS Amplify CI/CD)               │
  │  ├── 📷 Water Depth Gauge (/analyze)                        │
  │  ├── 🗺️ Interactive Live GIS Hazard Map (/map)              │
  │  ├── 🧭 Dynamic Flood Bypass Route Planner (/routes)        │
  │  ├── 👤 Citizen Portal & Clearance Request (/user/dashboard)│
  │  └── 🛡️ Municipal Command & Triage Portal (/admin/dashboard)│
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                     HTTP / JSON / Session Cookies
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │               FastAPI High-Performance Microservice         │
  │              (AWS App Runner / Container on ECR)            │
  │  ├── YOLOv8 Tensor Inference Engine (best.pt weights)       │
  │  ├── Geometric Calibration & Visual HUD Annotator           │
  │  ├── OSRM Dynamic Bypass Routing Engine                     │
  │  ├── RBAC & Atomic Emergency Review System                  │
  │  └── SQLite / PostgreSQL Migrations & Audit Ledger          │
  └───┬──────────────────────────┬──────────────────────────┬───┘
      │                          │                          │
      ▼                          ▼                          ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  Amazon S3   │          │Amazon DynamoDB│         │  Amazon SNS  │
│ Raw & HUD    │          │  Geospatial  │          │  Automated   │
│ Annotated    │          │  Telemetry & │          │ Emergency SMS│
│ Proof Images │          │ Incident GIS │          │   Dispatch   │
└──────────────┘          └──────────────┘          └──────────────┘
```

---

## 📂 Repository Structure

```
FloodVision_Environmental_Hacks/
├── README.md                            # Comprehensive platform documentation
├── template.yaml                        # AWS SAM Infrastructure-as-Code (S3, DynamoDB, SNS, ECR)
├── docker-compose.localstack.yml        # Offline LocalStack AWS cloud emulation suite
├── scripts/
│   ├── init-localstack.sh               # LocalStack AWS provisioning script (Bash)
│   └── init-localstack.ps1              # LocalStack AWS provisioning script (PowerShell)
├── frontend/                            # React 18 + Vite frontend application
│   ├── package.json                     # Frontend dependencies & build scripts
│   ├── vite.config.js                   # Vite configuration
│   ├── amplify.yml                      # AWS Amplify CI/CD deployment specification
│   ├── index.html                       # HTML5 entrypoint with Google Fonts
│   ├── .env.example                     # Frontend environment variables template
│   └── src/
│       ├── main.jsx                     # React root bootstrap
│       ├── App.jsx                      # Navigation, routes, and mobile navigation bar
│       ├── index.css                    # Design system (Neomorphic/Dark glass aesthetics)
│       ├── context/
│       │   └── AuthContext.jsx          # User session, cookie auth, and RBAC context
│       ├── components/
│       │   └── ProtectedRoute.jsx       # Route authorization guard (user vs admin)
│       ├── utils/
│       │   └── geoUtils.js              # Geolocation (GPS, IP fallback, Nominatim search)
│       └── pages/
│           ├── Home.jsx                 # Landing hero, problem overview & feature tiles
│           ├── Analyze.jsx              # Street photo upload, CV inference & HUD preview
│           ├── MapDashboard.jsx         # Live Leaflet GIS map with incident telemetry
│           ├── RoutePlanner.jsx         # OSRM safe bypass routing avoiding flood zones
│           ├── Login.jsx                # Secure login with demo quick-fill credentials
│           ├── Register.jsx             # Citizen registration with password rules
│           ├── UserDashboard.jsx        # Citizen account, history & clearance requests
│           ├── AdminDashboard.jsx       # Municipal triage, incident feed & audit logs
│           └── AccessDenied.jsx         # 403 authorization guard fallback page
└── backend/                             # FastAPI inference & application backend
    ├── requirements.txt                 # Backend Python dependencies
    ├── Dockerfile                       # Production container definition (Python 3.10)
    ├── pytest.ini                       # Pytest test discovery configuration
    ├── .env.example                     # Backend environment configuration template
    ├── yolov8n.pt                       # Base YOLOv8 model weights
    ├── app/
    │   ├── main.py                      # FastAPI app entrypoint, CORS & routers
    │   ├── config.py                    # Pydantic BaseSettings environment config
    │   ├── api/                         # Modular API route controllers
    │   │   ├── analysis.py              # POST /api/analyze (YOLOv8 CV inference)
    │   │   ├── incidents.py             # GET/PATCH /api/incidents (Telemetry feed)
    │   │   ├── routes.py                # POST /api/routes/plan & geocode endpoints
    │   │   ├── auth.py                  # POST /api/auth (Login, register, session)
    │   │   ├── admin.py                 # GET /api/admin (Municipal metrics & audit)
    │   │   ├── admin_requests.py        # POST/GET /api/admin-requests (RBAC approvals)
    │   │   └── deps.py                  # FastAPI dependency injection guards
    │   ├── services/                    # Business logic & external integrations
    │   │   ├── yolo_service.py          # YOLOv8 inference, depth math & HUD drawing
    │   │   ├── analysis_service.py      # Analysis orchestration & S3 upload pipeline
    │   │   ├── notification_service.py  # Amazon SNS SMS emergency dispatch logic
    │   │   ├── routing_service.py       # OSRM path calculation & hazard avoidance
    │   │   ├── risk_service.py          # Safety scoring & depth hazard classification
    │   │   ├── s3_service.py            # S3 upload with LocalStack & Base64 fallback
    │   │   └── auth_service.py          # Password hashing, JWT/timed sessions & rate limiting
    │   ├── repositories/                # Persistence & database layer
    │   │   ├── incident_repo.py         # DynamoDB repository with in-memory fallback
    │   │   ├── user_repo.py             # SQLite user storage with auto-migrations
    │   │   ├── admin_request_repo.py    # Admin clearance requests repository
    │   │   └── audit_log_repo.py        # Immutable security audit log ledger
    │   ├── schemas/                     # Pydantic validation schemas
    │   │   ├── incident.py              # Incident input/output models
    │   │   ├── routing.py               # Coordinates, RouteRequest & RouteResponse
    │   │   ├── auth.py                  # User credentials & profile schemas
    │   │   └── admin_request.py         # Clearance application & review schemas
    │   ├── scripts/
    │   │   └── bootstrap_admin.py       # Zero-trust CLI administrator bootstrap tool
    │   └── weights/
    │       └── best.pt                  # Fine-tuned YOLOv8 flood vehicle model weights
    └── tests/                           # Comprehensive automated test suites (52 tests)
        ├── test_api.py                  # Health check & basic routing tests
        ├── test_auth.py                 # Session security, password rules & RBAC tests
        ├── test_admin_approval.py       # Atomic admin review & race condition tests
        ├── test_incident_repo.py        # Incident persistence & query tests
        ├── test_notification_service.py # SNS alert trigger threshold tests
        ├── test_risk_service.py         # Mathematical safety score calculation tests
        ├── test_routing.py              # OSRM distance & detour routing tests
        └── test_yolo_service.py         # Depth calculation formulas & inference tests
```

---

## 🌟 Key Features

### 1. 📷 Computer Vision Water Depth Gauge
* Upload or capture any street photo directly from mobile or desktop.
* Segments vehicles and visible tires against calibrated reference standards.
* Draws a dynamic visual telemetry HUD on the image, displaying water depth, safety status, and tire submersion percentage.
* Works seamlessly in offline sandbox mode (gracefully encodes images to inline Base64 data URIs if S3 is disconnected).

### 2. 🚨 Automated 30 cm Emergency Road Closure Alert (Amazon SNS)
* Dispatches a geo-tagged emergency SMS to traffic authorities immediately when calculated depth breaches **30 cm**:
  ```text
  🚨 FLOOD ALERT: Severe waterlogging detected. Depth: 35.5cm at Lat 19.0760, Lon 72.8777. Immediate road closure recommended.
  ```
* Supports AWS SNS Topic broadcast, direct mobile number dispatch, and local sandbox mock logging for live demonstration without incurring telecommunications charges.

### 3. 🗺️ Live GIS Hazard Map
* Powered by Leaflet & OpenStreetMap.
* Color-coded incident markers (🟢 Safe, 🟡 Caution, 🔴 Critical Danger) displaying live depths and HUD-annotated evidence.
* Filters by time horizon (1h, 6h, 24h, 7 days) and severity level.
* Instant button to calculate an emergency bypass detour around any selected hazard marker.

### 4. 🧭 Dynamic Flood Bypass Route Planner
* Evaluates direct route polylines against recent waterlogging incidents using spatial point-to-segment geometry.
* Detects when a recommended route intersects waterlogging within a 120-meter tolerance buffer.
* Automatically recalculates a safe detour with clearance waypoints around the flooded corridor.
* 3-Tier Geolocation resolution: HTML5 browser GPS $\rightarrow$ Backend IP Geolocation $\rightarrow$ OpenStreetMap Nominatim search.

### 5. 🔐 Zero-Trust Security & Municipal Admin Approval System
* **Role-Based Access Control (RBAC):** Strict separation between public citizens (`user`) and municipal officers (`admin`).
* **Session Management:** Secure `HttpOnly`, `SameSite=Lax` cookies with URL-safe timed signatures (`itsdangerous`).
* **Brute-Force Rate Limiting:** In-memory sliding-window limiter blocks repeated password guessing attacks.
* **Atomic Administrative Review:** Requests undergo atomic database transitions with concurrency protection, preventing double-reviews and self-approvals.
* **Audit Ledger:** Every administrative action is permanently recorded in an immutable audit log.

---

## 🔑 Pre-Configured Demo Accounts

For immediate evaluation and hackathon testing, the platform automatically seeds two active accounts upon startup:

| Account Type | Email | Password | Role & Permissions |
| :--- | :--- | :--- | :--- |
| **Municipal Admin** | `admin@floodvision.org` | `FloodVisionAdmin2026!` | Access command triage (`/admin/dashboard`), review emergency requests, view audit logs |
| **Citizen Reporter** | `citizen@floodvision.org` | `Citizen123!` | Upload flooded photos (`/analyze`), plan safe routes (`/routes`), request clearance |

*(A quick-fill button is also available on the `/login` page to populate these credentials with one click).*

---

## 🚀 Local Development Setup

### Prerequisites
* **Python:** 3.10, 3.11, 3.12, or 3.13
* **Node.js:** v18+ and `npm`
* **Git**

---

### Step 1: Clone Repository
```bash
git clone https://github.com/Raghavpatil10/FloodVision_Environmental_Hacks.git
cd FloodVision_Environmental_Hacks
```

---

### Step 2: Configure Environment Variables

#### Backend `.env`
Create `backend/.env` based on `backend/.env.example`:
```ini
AWS_ACCESS_KEY_ID=mock_key
AWS_SECRET_ACCESS_KEY=mock_secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=floodvision-images
DYNAMODB_TABLE_NAME=floodvision_incidents
SNS_TOPIC_ARN=
FRONTEND_ORIGIN=http://localhost:5173
ROUTING_PROVIDER=osrm
ROUTING_BASE_URL=http://router.project-osrm.org
MAX_IMAGE_SIZE_MB=5
CRITICAL_DEPTH_CM=30.0
TRAFFIC_WARDEN_PHONE_NUMBER=+15550192834

# Authentication & Session Security
SECRET_KEY=floodvision-auth-jwt-secret-key-change-in-prod-2026
SESSION_COOKIE_NAME=floodvision_session
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
USERS_DB_PATH=data/users.db

# Initial Admin Bootstrap Configuration
ADMIN_INITIAL_EMAIL=admin@floodvision.org
```

> **Note on AWS Credentials:** If real AWS credentials are not configured, FloodVision automatically activates its built-in graceful local fallbacks (in-memory incident store, inline Base64 image URIs, and console SMS broadcast logging).

#### Frontend `.env`
Create `frontend/.env` based on `frontend/.env.example`:
```ini
VITE_API_BASE_URL=http://localhost:8000
```
*(If running backend on an alternate port such as 8001, update this to `http://localhost:8001`).*

---

### Step 3: Start the Backend Service
```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS / Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI with live reload
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API is now accessible at `http://127.0.0.1:8000` (Interactive docs at `http://127.0.0.1:8000/docs`).

---

### Step 4: Start the Frontend Application
In a separate terminal:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
The frontend is now accessible at `http://localhost:5173` (or `http://localhost:5174`).

---

## 🧪 Running Automated Tests

FloodVision includes a comprehensive Pytest test suite covering depth mathematics, incident storage, OSRM routing, authentication, session tokens, and atomic review transactions:

```bash
cd backend
python -m pytest tests/ -v
```

**Test Coverage Summary (52 tests passed):**
* `test_admin_approval.py`: Verification of atomic approvals, duplicate rejection, and audit logging.
* `test_api.py`: FastAPI health check and root endpoints.
* `test_auth.py`: Password validation, session cookie invalidation, rate limiting, and IDOR prevention.
* `test_incident_repo.py`: DynamoDB CRUD operations with local fallback.
* `test_notification_service.py`: Amazon SNS SMS trigger condition ($\text{depth} > 30\text{ cm}$).
* `test_risk_service.py`: Safety scores across low, moderate, high, and critical depths.
* `test_routing.py`: Distance calculations and dynamic hazard detour routing.
* `test_yolo_service.py`: Aspect ratio submersion math, image annotation, and API analysis.

---

## 🐳 Offline LocalStack Emulation (Optional)

To test against emulated AWS services (S3, DynamoDB, SNS) offline without an active AWS account:

```bash
# 1. Start LocalStack container
docker-compose -f docker-compose.localstack.yml up -d

# 2. Provision S3, DynamoDB, and SNS in LocalStack
# Windows PowerShell:
.\scripts\init-localstack.ps1
# Linux / macOS:
# ./scripts/init-localstack.sh

# 3. Configure backend/.env with:
# AWS_ENDPOINT_URL=http://localhost:4566
```

---

## ☁️ Production AWS Deployment

### 1. Backend Microservice (AWS App Runner / Amazon ECR)
The backend container is defined in [backend/Dockerfile](file:///d:/aws_builder/FloodVision_Environmental_Hacks/backend/Dockerfile) (exposing port `8080`).

```bash
# 1. Authenticate Docker with Amazon ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# 2. Build and tag the Docker image
cd backend
docker build -t floodvision-backend .
docker tag floodvision-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/floodvision-backend:latest

# 3. Push container image to ECR
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/floodvision-backend:latest

# 4. Create or update AWS App Runner service linked to this ECR repository.
```

### 2. Serverless Infrastructure (AWS SAM)
The repository includes a production-ready AWS SAM CloudFormation template ([template.yaml](file:///d:/aws_builder/FloodVision_Environmental_Hacks/template.yaml)) that provisions:
* **Amazon S3:** `FloodVisionImagesBucket` with public access controls and CORS.
* **Amazon DynamoDB:** `FloodVisionIncidentsTable` with `StatusReportedAtIndex` GSI.
* **Amazon SNS:** `FloodVisionAlertsTopic` for automated emergency alerts.
* **AWS Lambda / Container:** IAM execution policies granting least-privilege access.

Deploy via AWS SAM CLI:
```bash
sam build
sam deploy --guided
```

### 3. Frontend Web App (AWS Amplify)
The frontend contains an [amplify.yml](file:///d:/aws_builder/FloodVision_Environmental_Hacks/frontend/amplify.yml) build specification:
1. Connect your repository to AWS Amplify Console.
2. Select the `frontend` subdirectory as the root.
3. Configure the environment variable:
   * `VITE_API_BASE_URL`: `https://<YOUR_APP_RUNNER_DOMAIN>`
4. Deploy the application.

---

## 📡 API Endpoints Reference

### 1. Computer Vision & Hazard Inference
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/analyze` | Uploads street photo, calculates depth via YOLOv8, triggers SMS if $>30\text{ cm}$, saves incident | Public / User |
| `GET` | `/health` | Health check probe returning `{"status": "ok"}` | Public |

### 2. Geospatial Incidents & Telemetry
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/incidents` | Lists active flood incidents within time window (query: `max_age_hours`, `risk_level`) | Public |
| `GET` | `/api/incidents/{incident_id}` | Retrieves specific incident details and annotated proof URL | Public |
| `PATCH` | `/api/incidents/{incident_id}/status` | Updates incident status (`active`, `resolved`, `monitoring`) | Admin |

### 3. Safe Routing & Detour Engine
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/routes/plan` | Calculates route from origin to destination; detects flood zones and provides safe detour | Public |
| `GET` | `/api/routes/geocode` | Autocompletes landmarks and street addresses via OpenStreetMap Nominatim | Public |
| `GET` | `/api/routes/locate-ip` | Resolves user geographic coordinates via IP lookup fallback | Public |

### 4. Authentication & Session Security
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Registers a citizen account with role `user` | Public |
| `POST` | `/api/auth/login` | Authenticates email & password, sets `HttpOnly` session cookie with brute-force rate limiting | Public |
| `POST` | `/api/auth/logout` | Clears active session cookie | Authenticated |
| `GET` | `/api/auth/me` | Returns current user profile and role | Authenticated |
| `POST` | `/api/auth/verify-email` | Verifies user email address | Authenticated |
| `POST` | `/api/auth/send-verification`| Generates email verification token | Authenticated |

### 5. Admin Access Applications
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin-requests` | Submits emergency administrative clearance application | Verified User |
| `GET` | `/api/admin-requests/me` | Retrieves authenticated user's own application history | Authenticated |
| `GET` | `/api/admin-requests` | Lists all pending or historical applications | Admin Only |
| `POST` | `/api/admin-requests/{id}/review` | Atomically approves or rejects application in a single database transaction | Admin Only |

### 6. Municipal Command & Audit Triage
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/overview` | Returns system telemetry, incident statistics, and hazard metrics | Admin Only |
| `GET` | `/api/admin/users` | Lists registered accounts | Admin Only |
| `GET` | `/api/admin/audit-logs` | Inspects immutable security audit log ledger | Admin Only |

---

## 🛡️ Initial Admin Bootstrap CLI

To maintain zero-trust integrity on a fresh production deployment without public privilege escalation endpoints:

1. Register an account through the FloodVision portal and verify the email address.
2. Configure `ADMIN_INITIAL_EMAIL` in the environment (e.g. `admin@floodvision.org`).
3. Execute the server-side CLI bootstrap utility:
   ```bash
   cd backend
   python -m app.scripts.bootstrap_admin
   ```
   **Security guarantees enforced by bootstrap:**
   * Promotes **only** the explicitly configured `ADMIN_INITIAL_EMAIL`.
   * Refuses execution if any administrator already exists in the database.
   * Requires verified email status before promotion.
   * Executes atomic role upgrade and audit log recording inside a single transaction.

---

## 🤝 Contributing

1. Fork the repository: `https://github.com/Raghavpatil10/FloodVision_Environmental_Hacks`
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Ensure automated tests pass: `pytest tests/`
4. Commit your changes: `git commit -m "feat: Add amazing feature"`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request.

---

## 📄 License & Acknowledgements

* **License:** Built for open innovation under the MIT License.
* **Hackathon:** Built with pride for **Environmental Hacks 2026** (Track 02: Heat and Water).
* **Dataset & Weights:** YOLOv8 model fine-tuned on annotated flooded-vehicle telemetry datasets.
* **Mapping:** OpenStreetMap & Leaflet. Routing powered by OSRM.

## 📚 References

### Computer Vision & Depth Estimation
1. Jocher, G., Chaurasia, A., & Qiu, J. (2023). *Ultralytics YOLOv8*. https://github.com/ultralytics/ultralytics
2. Redmon, J., Divvala, S., Girshick, R., & Farhadi, A. (2016). *You Only Look Once: Unified, Real-Time Object Detection*. IEEE CVPR. https://arxiv.org/abs/1506.02640
3. Ultralytics Docs. *YOLOv8 Models & Training*. https://docs.ultralytics.com

### Flood Safety Standards
4. U.S. National Weather Service. *Turn Around, Don't Drown!* https://www.weather.gov/safety/flood-turn-around-dont-drown
   *(Basis for the 30 cm / 12 in vehicle-hazard threshold.)*

### Backend & Frameworks
5. FastAPI Documentation. https://fastapi.tiangolo.com
6. Pydantic Documentation. https://docs.pydantic.dev
7. itsdangerous (signed, timed sessions). https://itsdangerous.palletsprojects.com
8. Pytest Documentation. https://docs.pytest.org

### Frontend
9. React Documentation. https://react.dev
10. Vite Documentation. https://vitejs.dev
11. Leaflet, an open-source JavaScript library for interactive maps. https://leafletjs.com

### Mapping & Routing
12. OpenStreetMap Contributors. https://www.openstreetmap.org
13. Open Source Routing Machine (OSRM). https://project-osrm.org
14. Nominatim Geocoding API. https://nominatim.org

### Cloud & Infrastructure
15. Amazon S3 Documentation. https://docs.aws.amazon.com/s3
16. Amazon DynamoDB Documentation. https://docs.aws.amazon.com/dynamodb
17. Amazon SNS Documentation. https://docs.aws.amazon.com/sns
18. AWS App Runner Documentation. https://docs.aws.amazon.com/apprunner
19. AWS Amplify Hosting Documentation. https://docs.aws.amazon.com/amplify
20. AWS SAM Documentation. https://docs.aws.amazon.com/serverless-application-model
21. LocalStack Documentation. https://docs.localstack.cloud


