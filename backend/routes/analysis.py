"""
Analysis routes – detailed traffic analysis per session and overall summary.
"""

from flask import Blueprint

from models.database import get_session, get_traffic_records, get_db
from utils.helpers import success_response, error_response

analysis_bp = Blueprint("analysis", __name__, url_prefix="/api/analysis")


@analysis_bp.route("/<int:session_id>", methods=["GET"])
def get_session_analysis(session_id):
    """Return detailed traffic analysis for a specific session."""
    session = get_session(session_id)
    if session is None:
        return error_response("Session not found.", 404)

    if session["status"] != "completed":
        return error_response(
            f"Session is not completed yet. Current status: {session['status']}",
            400,
        )

    records = get_traffic_records(session_id)

    # Compute aggregated metrics from records
    if records:
        densities = [r["density"] for r in records]
        speeds = [r["avg_speed"] for r in records]
        vehicle_counts = [r["vehicle_count"] for r in records]

        analysis = {
            "session_id": session_id,
            "filename": session["original_filename"],
            "upload_time": session["upload_time"],
            "processing_time": session["processing_time"],
            "total_vehicles": session["total_vehicles"],
            "vehicle_breakdown": {
                "cars": session["cars"],
                "motorcycles": session["motorcycles"],
                "buses": session["buses"],
                "trucks": session["trucks"],
            },
            "metrics": {
                "avg_density": round(sum(densities) / len(densities), 4),
                "max_density": round(max(densities), 4),
                "min_density": round(min(densities), 4),
                "avg_speed": round(sum(speeds) / len(speeds), 2),
                "max_speed": round(max(speeds), 2),
                "min_speed": round(min(speeds), 2),
                "max_vehicle_count": max(vehicle_counts),
                "avg_vehicle_count": round(sum(vehicle_counts) / len(vehicle_counts), 1),
            },
            "congestion_level": records[-1]["congestion_level"],
            "traffic_records": records,
        }
    else:
        analysis = {
            "session_id": session_id,
            "filename": session["original_filename"],
            "upload_time": session["upload_time"],
            "processing_time": session["processing_time"],
            "total_vehicles": session["total_vehicles"],
            "vehicle_breakdown": {
                "cars": session["cars"],
                "motorcycles": session["motorcycles"],
                "buses": session["buses"],
                "trucks": session["trucks"],
            },
            "metrics": {
                "avg_density": 0,
                "max_density": 0,
                "min_density": 0,
                "avg_speed": 0,
                "max_speed": 0,
                "min_speed": 0,
                "max_vehicle_count": 0,
                "avg_vehicle_count": 0,
            },
            "congestion_level": "Low",
            "traffic_records": [],
        }

    return success_response(analysis)


@analysis_bp.route("/summary", methods=["GET"])
def get_summary():
    """Return an overall traffic analysis summary across all completed sessions."""
    try:
        conn = get_db()

        # Session-level aggregates
        session_row = conn.execute("""
            SELECT
                COUNT(*) AS total_sessions,
                COALESCE(SUM(total_vehicles), 0) AS total_vehicles,
                COALESCE(SUM(cars), 0)           AS total_cars,
                COALESCE(SUM(motorcycles), 0)    AS total_motorcycles,
                COALESCE(SUM(buses), 0)          AS total_buses,
                COALESCE(SUM(trucks), 0)         AS total_trucks,
                COALESCE(AVG(processing_time), 0) AS avg_processing_time
            FROM detection_sessions
            WHERE status = 'completed'
        """).fetchone()

        # Traffic-record-level aggregates
        record_row = conn.execute("""
            SELECT
                COALESCE(AVG(density), 0)   AS avg_density,
                COALESCE(MAX(density), 0)   AS max_density,
                COALESCE(AVG(avg_speed), 0) AS avg_speed,
                COALESCE(MAX(avg_speed), 0) AS max_speed,
                COALESCE(AVG(vehicle_count), 0) AS avg_vehicle_count
            FROM traffic_records
        """).fetchone()

        # Congestion distribution
        congestion_rows = conn.execute("""
            SELECT congestion_level, COUNT(*) AS cnt
            FROM traffic_records
            GROUP BY congestion_level
        """).fetchall()
        conn.close()

        congestion_distribution = {r["congestion_level"]: r["cnt"] for r in congestion_rows}

        summary = {
            "total_sessions": session_row["total_sessions"],
            "total_vehicles_detected": session_row["total_vehicles"],
            "vehicle_breakdown": {
                "cars": session_row["total_cars"],
                "motorcycles": session_row["total_motorcycles"],
                "buses": session_row["total_buses"],
                "trucks": session_row["total_trucks"],
            },
            "avg_processing_time": round(session_row["avg_processing_time"], 2),
            "traffic_metrics": {
                "avg_density": round(record_row["avg_density"], 4),
                "max_density": round(record_row["max_density"], 4),
                "avg_speed": round(record_row["avg_speed"], 2),
                "max_speed": round(record_row["max_speed"], 2),
                "avg_vehicle_count": round(record_row["avg_vehicle_count"], 1),
            },
            "congestion_distribution": congestion_distribution,
        }
        return success_response(summary)

    except Exception as exc:
        return error_response(f"Failed to compute summary: {exc}", 500)
