# 🌊 FloodVision: CV-Powered Waterlogging Depth Gauge

**Built for Environmental Hacks 2026 | Track 02: Heat and Water**
**Team:** TeamAPEX (Nagpur/Delhi)

## 🚨 The Problem
During monsoons, underpasses and road dips flood rapidly. Muddy water is completely opaque, causing drivers to misjudge depth. Driving into just 30cm of water can hydro-lock and destroy an engine. Current "flooded street" civic complaints are text-based and fail to capture the actual depth, making it impossible for traffic police to prioritize life-saving road closures.

## 💡 The Solution
FloodVision is an image-led computer vision tool. Traffic wardens or citizens snap a photo of a flooded road using our React mobile web app. 

Our FastAPI backend utilizes an AI shortcut: instead of training a heavy custom model, we use a pre-trained YOLOv8 model to detect common reference objects (car tires). By calculating the ratio of the visible tire bounding box against standard physical dimensions, we instantly estimate the water depth in centimeters. 

If the water crosses the 30cm "engine-kill" threshold, the system automatically dispatches an emergency SMS to local authorities for immediate road closure.

## 🛠️ Architecture & Tech Stack
This project uses a modern React/FastAPI stack heavily integrated with AWS services.

*   **Frontend (React + Vite):** Deployed on **AWS Amplify**. Provides a fast, mobile-responsive UI for camera access and geolocation capture.
*   **Backend (FastAPI):** Containerized using Docker and deployed on **AWS App Runner** for scalable, serverless ML inference.
*   **Storage (Amazon S3):** Stores the raw crowdsourced photos and processed bounding-box images.
*   **Database (Amazon DynamoDB):** Logs the location (lat/lng), timestamp, and calculated depth for the municipal triage dashboard.
*   **Alerts (Amazon SNS):** Fires real-time SMS alerts to traffic wardens if the depth calculation exceeds 30cm.

## 📂 Repository Structure

├── frontend/                 # React App (AWS Amplify)
│   ├── src/                  # React components & hooks
│   └── package.json          
├── backend/                  # FastAPI App (AWS App Runner)
│   ├── app/
│   │   ├── main.py           # API endpoints & AWS boto3 integration
│   │   └── yolo_logic.py     # YOLOv8 inference & depth math
│   ├── Dockerfile            # Multi-stage Docker build
│   └── requirements.txt      
└── README.md                 

## 🚀 Setup & Deployment

**Prerequisites:** 
* An active AWS Account (Verified via AWS Builder Center for Student Free Tier).
* Docker installed locally for backend testing.
* Node.js for frontend testing.

**1. Deploy Backend (AWS App Runner)**
1. Ensure your AWS credentials are configured locally.
2. Build the Docker image from the `/backend` directory.
3. Push the image to Amazon ECR (Elastic Container Registry).
4. Create an AWS App Runner service pointing to your ECR image. Note the public URL.

**2. Deploy Frontend (AWS Amplify)**
1. Navigate to the AWS Amplify console.
2. Connect this GitHub repository and select the `/frontend` root.
3. Add an environment variable in Amplify `VITE_API_URL` pointing to your App Runner URL.
4. Deploy the app.

**3. Test the Pipeline**
Upload a test image of a flooded car via the React app. Check your phone for the SNS SMS alert and verify the depth record in your DynamoDB table.

## 📊 Hackathon Judging Rubric Addressed
*   **Idea and Impact:** Directly addresses a massive, recurring monsoon hazard with a highly scalable, low-cost solution.
*   **Built on AWS:** Extensively utilizes the AWS cloud (Amplify, App Runner, ECR, S3, DynamoDB, SNS).
*   **Execution:** Bypassed the need for custom model training by creatively using bounding-box math on pre-trained models via a lightning-fast FastAPI endpoint.
