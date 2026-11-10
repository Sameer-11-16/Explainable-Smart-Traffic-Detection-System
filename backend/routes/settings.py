"""
Settings routes – CRUD for application settings.
"""

from flask import Blueprint, request

from models.database import get_settings, get_setting, update_setting
from utils.helpers import success_response, error_response

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

# Keys that may be stored
VALID_KEYS = {"confidence_threshold", "frame_skip", "max_video_duration"}


@settings_bp.route("", methods=["GET"], strict_slashes=False)
@settings_bp.route("/", methods=["GET"], strict_slashes=False)
def get_all_settings():
    """Return all settings."""
    try:
        settings = get_settings()
        # Flatten to a simpler format for the frontend
        flat = {}
        for key, info in settings.items():
            flat[key] = info["value"]
        return success_response(flat)
    except Exception as exc:
        return error_response(f"Failed to fetch settings: {exc}", 500)


@settings_bp.route("", methods=["PUT", "POST"], strict_slashes=False)
@settings_bp.route("/", methods=["PUT", "POST"], strict_slashes=False)
def update_settings():
    """Update one or more settings. Expects JSON body with key-value pairs."""
    data = request.get_json(silent=True)
    if data is None:
        return error_response("Request body must be JSON.", 400)

    updated = {}
    errors = []

    for key, value in data.items():
        if key not in VALID_KEYS:
            errors.append(f"Unknown setting key: '{key}'")
            continue

        # Basic validation
        try:
            if key == "confidence_threshold":
                val = float(value)
                if not (0.0 < val <= 1.0):
                    errors.append("confidence_threshold must be between 0 and 1.")
                    continue
            elif key == "frame_skip":
                val = int(value)
                if val < 1:
                    errors.append("frame_skip must be >= 1.")
                    continue
            elif key == "max_video_duration":
                val = int(value)
                if val < 1:
                    errors.append("max_video_duration must be >= 1.")
                    continue
        except (ValueError, TypeError):
            errors.append(f"Invalid value for {key}: {value}")
            continue

        update_setting(key, str(value))
        updated[key] = str(value)

    if errors and not updated:
        return error_response("; ".join(errors), 400)

    response_data = {"updated": updated}
    if errors:
        response_data["warnings"] = errors

    return success_response(response_data, message="Settings updated successfully.")
