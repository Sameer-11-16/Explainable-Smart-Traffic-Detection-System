"""
Dashboard routes – aggregate stats, history, recent sessions.
"""

from flask import Blueprint

from models.database import get_db, get_all_sessions
from utils.helpers import success_response, error_response

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dashboard_bp.route("/stats", methods=["GET"])
def get_stats():
    """Return current aggregate statistics across all sessions."""
    try:
        conn = get_db()

        # Total sessions
        total_sessions = conn.execute(
            "SELECT COUNT(*) AS cnt FROM detection_sessions"
        ).fetchone()["cnt"]

        # Completed sessions
        completed = conn.execute(
            "SELECT COUNT(*) AS cnt FROM detection_sessions WHERE status = 'completed'"
        ).fetchone()["cnt"]

        # Aggregate vehicle counts from completed sessions
        row = conn.execute("""
            SELECT
                COALESCE(SUM(total_vehicles), 0) AS total_vehicles,
                COALESCE(SUM(cars), 0) AS total_cars,
                COALESCE(SUM(motorcycles), 0) AS total_motorcycles,
                COALESCE(SUM(buses), 0) AS total_buses,
                COALESCE(SUM(trucks), 0) AS total_trucks,
                COALESCE(AVG(processing_time), 0) AS avg_processing_time
            FROM detection_sessions
            WHERE status = 'completed'
        """).fetchone()

        # Latest traffic record for density / congestion
        latest_record = conn.execute("""
            SELECT density, congestion_level, avg_speed, vehicle_count
            FROM traffic_records
            ORDER BY id DESC
            LIMIT 1
        """).fetchone()

        conn.close()

        density = 0.0
        congestion = "Low"
        avg_speed = 0.0
        latest_vehicle_count = 0
        if latest_record:
            density = latest_record["density"]
            congestion = latest_record["congestion_level"]
            avg_speed = latest_record["avg_speed"]
            latest_vehicle_count = latest_record["vehicle_count"]

        data = {
            "total_sessions": total_sessions,
            "completed_sessions": completed,
            "total_vehicles": row["total_vehicles"],
            "total_cars": row["total_cars"],
            "total_motorcycles": row["total_motorcycles"],
            "total_buses": row["total_buses"],
            "total_trucks": row["total_trucks"],
            "avg_processing_time": round(row["avg_processing_time"], 2),
            "current_density": density,
            "current_congestion": congestion,
            "current_avg_speed": avg_speed,
            "latest_vehicle_count": latest_vehicle_count,
        }
        return success_response(data)

    except Exception as exc:
        return error_response(f"Failed to fetch dashboard stats: {exc}", 500)


@dashboard_bp.route("/history", methods=["GET"])
def get_history():
    """Return historical traffic data for the last 20 completed sessions."""
    try:
        conn = get_db()
        rows = conn.execute("""
            SELECT
                ds.id,
                ds.original_filename,
                ds.upload_time,
                ds.total_vehicles,
                ds.cars,
                ds.motorcycles,
                ds.buses,
                ds.trucks,
                ds.processing_time,
                tr.density,
                tr.congestion_level,
                tr.avg_speed
            FROM detection_sessions ds
            LEFT JOIN traffic_records tr ON tr.session_id = ds.id
            WHERE ds.status = 'completed'
            ORDER BY ds.upload_time DESC
            LIMIT 20
        """).fetchall()
        conn.close()

        history = []
        for r in rows:
            history.append({
                "session_id": r["id"],
                "filename": r["original_filename"],
                "upload_time": r["upload_time"],
                "total_vehicles": r["total_vehicles"],
                "cars": r["cars"],
                "motorcycles": r["motorcycles"],
                "buses": r["buses"],
                "trucks": r["trucks"],
                "processing_time": r["processing_time"],
                "density": r["density"] or 0,
                "congestion_level": r["congestion_level"] or "Low",
                "avg_speed": r["avg_speed"] or 0,
            })

        return success_response(history)

    except Exception as exc:
        return error_response(f"Failed to fetch history: {exc}", 500)


@dashboard_bp.route("/recent", methods=["GET"])
def get_recent():
    """Return the 10 most recent detection sessions (any status)."""
    try:
        sessions = get_all_sessions(limit=10)
        return success_response(sessions)
    except Exception as exc:
        return error_response(f"Failed to fetch recent sessions: {exc}", 500)
