"""
Utility helper functions for the traffic detection system.
"""

import os
import uuid
from datetime import datetime, timezone


def generate_unique_filename(original_filename):
    """Generate a unique filename preserving the original extension."""
    ext = os.path.splitext(original_filename)[1].lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    return unique_name


def allowed_file(filename, allowed_extensions):
    """Check if a filename has an allowed extension."""
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in allowed_extensions


def format_timestamp(dt=None):
    """Return an ISO-formatted UTC timestamp string."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    return dt.isoformat()


def success_response(data=None, message=None, status_code=200):
    """Build a standardised JSON success response tuple."""
    body = {"success": True}
    if data is not None:
        body["data"] = data
    if message is not None:
        body["message"] = message
    return body, status_code


def error_response(error, status_code=400):
    """Build a standardised JSON error response tuple."""
    return {"success": False, "error": str(error)}, status_code


def ensure_directory(path):
    """Create a directory (and parents) if it does not exist."""
    os.makedirs(path, exist_ok=True)


def clamp(value, min_val, max_val):
    """Clamp a numeric value between min_val and max_val."""
    return max(min_val, min(value, max_val))


def safe_divide(numerator, denominator, default=0.0):
    """Divide safely, returning default when denominator is zero."""
    if denominator == 0:
        return default
    return numerator / denominator
