# Multi-stage Dockerfile for Explainable Smart Traffic Detection System
# Stage 1: Build React Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

# Stage 2: Python Backend & Final Image
FROM python:3.11-slim
WORKDIR /app

# Install system libraries for OpenCV and video codecs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy Backend Code
COPY backend/ backend/

# Copy Built Frontend
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Pre-download YOLO weights
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

EXPOSE 5000

ENV FLASK_ENV=production
ENV PORT=5000

CMD ["gunicorn", "backend.app:create_app()", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "120"]

