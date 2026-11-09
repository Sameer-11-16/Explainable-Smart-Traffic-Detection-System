"""
Configuration module for the Explainable Smart Traffic Detection System.
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    """Application configuration."""

    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "traffic-detection-secret-key-2024")
    DEBUG = os.environ.get("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")

    # File uploads
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    PROCESSED_FOLDER = os.path.join(BASE_DIR, "processed")
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500 MB

    # Database
    DATABASE = os.path.join(BASE_DIR, "traffic_detection.db")

    # CORS
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS", "*"
    ).split(",")

    # Allowed video extensions
    ALLOWED_EXTENSIONS = {"mp4", "avi", "mov"}

    # Default detection settings
    DEFAULT_SETTINGS = {
        "confidence_threshold": "0.5",
        "frame_skip": "3",
        "max_video_duration": "300",
    }
