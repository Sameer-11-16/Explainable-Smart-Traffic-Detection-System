"""
Reports routes – listing, detail view, and CSV export of detection sessions.
"""

import csv
import io
from flask import Blueprint, make_response

from models.database import get_session, get_all_sessions, get_traffic_records, get_db
from utils.helpers import success_response, error_response

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


@reports_bp.route("", methods=["GET"], strict_slashes=False)
@reports_bp.route("/", methods=["GET"], strict_slashes=False)
def list_reports():
    """List all completed sessions as available reports."""
    try:
        conn = get_db()
        rows = conn.execute("""
            SELECT id, original_filename, upload_time, status,
                   total_vehicles, cars, motorcycles, buses, trucks,
                   processing_time
            FROM detection_sessions
            WHERE status = 'completed'
            ORDER BY upload_time DESC
        """).fetchall()
        conn.close()
        return success_response([dict(r) for r in rows])
    except Exception as exc:
        return error_response(f"Failed to list reports: {exc}", 500)


@reports_bp.route("/<int:session_id>", methods=["GET"])
def get_report(session_id):
    """Return a detailed report for a specific session."""
    session = get_session(session_id)
    if session is None:
        return error_response("Session not found.", 404)

    records = get_traffic_records(session_id)

    video_url = ""
    if session.get("video_path"):
        video_url = f"/processed/{session['video_path']}"

    report = {
        "session": session,
        "traffic_records": records,
        "video_url": video_url,
        "summary": {
            "total_vehicles": session["total_vehicles"],
            "cars": session["cars"],
            "motorcycles": session["motorcycles"],
            "buses": session["buses"],
            "trucks": session["trucks"],
            "processing_time": session["processing_time"],
        },
    }
    return success_response(report)


@reports_bp.route("/export/<int:session_id>", methods=["GET"])
def export_session_csv(session_id):
    """Export a single session's data as a CSV file."""
    session = get_session(session_id)
    if session is None:
        return error_response("Session not found.", 404)

    records = get_traffic_records(session_id)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Session ID", "Filename", "Upload Time", "Status",
        "Total Vehicles", "Cars", "Motorcycles", "Buses", "Trucks",
        "Processing Time (s)",
    ])
    writer.writerow([
        session["id"], session["original_filename"], session["upload_time"],
        session["status"], session["total_vehicles"],
        session["cars"], session["motorcycles"], session["buses"], session["trucks"],
        session["processing_time"],
    ])

    writer.writerow([])  # blank row
    writer.writerow([
        "Record ID", "Timestamp", "Vehicle Count", "Density",
        "Congestion Level", "Avg Speed", "Cars", "Motorcycles", "Buses", "Trucks",
    ])
    for rec in records:
        writer.writerow([
            rec["id"], rec["timestamp"], rec["vehicle_count"], rec["density"],
            rec["congestion_level"], rec["avg_speed"],
            rec["cars"], rec["motorcycles"], rec["buses"], rec["trucks"],
        ])

    csv_content = output.getvalue()
    output.close()

    response = make_response(csv_content)
    safe_name = session["original_filename"].replace(" ", "_")
    response.headers["Content-Disposition"] = f"attachment; filename=report_{session_id}_{safe_name}.csv"
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    return response


@reports_bp.route("/export/all", methods=["GET"])
def export_all_csv():
    """Export all completed sessions as a CSV file."""
    try:
        conn = get_db()
        sessions = conn.execute("""
            SELECT * FROM detection_sessions
            WHERE status = 'completed'
            ORDER BY upload_time DESC
        """).fetchall()
        conn.close()

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "Session ID", "Filename", "Upload Time", "Status",
            "Total Vehicles", "Cars", "Motorcycles", "Buses", "Trucks",
            "Processing Time (s)", "Video Path",
        ])

        for s in sessions:
            s = dict(s)
            writer.writerow([
                s["id"], s["original_filename"], s["upload_time"],
                s["status"], s["total_vehicles"],
                s["cars"], s["motorcycles"], s["buses"], s["trucks"],
                s["processing_time"], s.get("video_path", ""),
            ])

        csv_content = output.getvalue()
        output.close()

        response = make_response(csv_content)
        response.headers["Content-Disposition"] = "attachment; filename=all_sessions_report.csv"
        response.headers["Content-Type"] = "text/csv; charset=utf-8"
        return response

    except Exception as exc:
        return error_response(f"Failed to export: {exc}", 500)
