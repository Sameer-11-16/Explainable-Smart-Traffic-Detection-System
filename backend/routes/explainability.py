"""
Explainability routes – SHAP explanations for traffic predictions.
"""

from flask import Blueprint, request

from models.database import get_session, get_traffic_records
from services.explainer import explain_prediction, get_feature_importance
from utils.helpers import success_response, error_response

explainability_bp = Blueprint("explainability", __name__, url_prefix="/api/explain")


@explainability_bp.route("", methods=["POST"], strict_slashes=False)
@explainability_bp.route("/", methods=["POST"], strict_slashes=False)
@explainability_bp.route("/metrics", methods=["POST"], strict_slashes=False)
@explainability_bp.route("/metrics/", methods=["POST"], strict_slashes=False)
def explain():
    """
    Accept traffic metrics in JSON body and return a SHAP-based explanation.

    Expected JSON keys (all optional, defaults to 0):
        vehicle_count, car_count (or cars), motorcycle_count (or motorcycles),
        bus_count (or buses), truck_count (or trucks), avg_speed,
        road_occupancy, density
    """
    data = request.get_json(silent=True)
    if data is None:
        return error_response("Request body must be JSON.", 400)

    try:
        result = explain_prediction(data)
        return success_response(result)
    except Exception as exc:
        return error_response(f"Explanation failed: {exc}", 500)


@explainability_bp.route("/<int:session_id>", methods=["GET"])
def explain_session(session_id):
    """
    Generate a SHAP explanation for a specific session's traffic data.
    Uses the latest traffic record from that session.
    """
    session = get_session(session_id)
    if session is None:
        return error_response("Session not found.", 404)

    if session["status"] != "completed":
        return error_response(
            f"Session not completed. Status: {session['status']}", 400
        )

    records = get_traffic_records(session_id)
    if not records:
        return error_response("No traffic records found for this session.", 404)

    # Use the latest (or only) record
    latest = records[-1]
    metrics = {
        "vehicle_count": latest.get("vehicle_count", 0),
        "car_count": latest.get("cars", 0),
        "motorcycle_count": latest.get("motorcycles", 0),
        "bus_count": latest.get("buses", 0),
        "truck_count": latest.get("trucks", 0),
        "avg_speed": latest.get("avg_speed", 0),
        "road_occupancy": latest.get("density", 0) * 100,  # approximate occupancy from density
        "density": latest.get("density", 0),
    }

    try:
        result = explain_prediction(metrics)
        result["session_id"] = session_id
        result["session_filename"] = session["original_filename"]
        return success_response(result)
    except Exception as exc:
        return error_response(f"Explanation failed: {exc}", 500)


@explainability_bp.route("/feature-importance", methods=["GET"])
def feature_importance():
    """Return global feature importance from the trained model."""
    try:
        importance = get_feature_importance()
        return success_response(importance)
    except Exception as exc:
        return error_response(f"Failed to get feature importance: {exc}", 500)
