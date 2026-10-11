FROM python:3.10-slim

WORKDIR /code

# Install system dependencies required by OpenCV / Ultralytics / image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY ./requirements.txt /code/requirements.txt

# Install CPU-only PyTorch first (saves over 3.5 GB of disk space by skipping CUDA!)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r /code/requirements.txt

# Create data directory for user store and SQLite fallback
RUN mkdir -p /code/data

COPY ./app /code/app
COPY ./yolov8n.pt /code/yolov8n.pt

# App Runner default port is 8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
