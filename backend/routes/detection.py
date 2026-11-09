"""
Detection routes – video upload, processing status, results, session management.
"""

import os
import threading

from flask import Blueprint, request, current_app

from models.database import (
    insert_session,
    get_session,
    get_all_sessions,
    delete_session,
    get_traffic_records,
)
from services.detector import process_video, processing_progress
from utils.helpers import (
    allowed_file,
    generate_unique_filename,
    success_response,
    error_response,
    ensure_directory,
)

detection_bp = Blueprint("detection", __name__, url_prefix="/api/detection")


@detection_bp.route("/upload", methods=["POST"])
def upload_video():
    """Upload a video file, validate it, save it, and kick off background processing."""
    if "video" not in request.files:
        return error_response("No video file provided in 'video' field.", 400)

    file = request.files["video"]
    if file.filename == "":
        return error_response("Empty filename.", 400)

    allowed_ext = current_app.config.get("ALLOWED_EXTENSIONS", {"mp4", "avi", "mov"})
    if not allowed_file(file.filename, allowed_ext):
        return error_response(
            f"Invalid file format. Allowed: {', '.join(allowed_ext)}", 400
        )

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    processed_folder = current_app.config["PROCESSED_FOLDER"]
    ensure_directory(upload_folder)
    ensure_directory(processed_folder)

    unique_name = generate_unique_filename(file.filename)
    input_path = os.path.join(upload_folder, unique_name)
    file.save(input_path)

    # Create a DB session
    session_id = insert_session(unique_name, file.filename)

    # Output path
    output_name = f"processed_{unique_name}"
    # Ensure output is mp4
    output_name = os.path.splitext(output_name)[0] + ".mp4"
    output_path = os.path.join(processed_folder, output_name)

    # Start processing in a background thread
    t = threading.Thread(
        target=_background_process,
        args=(current_app._get_current_object(), session_id, input_path, output_path),
        daemon=True,
    )
    t.start()

    return success_response(
        {"session_id": session_id, "filename": file.filename, "status": "pending"},
        message="Video uploaded successfully. Processing started.",
        status_code=201,
    )


@detection_bp.route("/demo", methods=["POST"])
def run_demo_video():
    """Load bundled sample traffic video and run actual YOLO inference on it."""
    import shutil
    from demo.generate_sample_video import create_sample_traffic_video

    demo_video_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "demo", "sample_traffic.mp4"
    )
    if not os.path.exists(demo_video_path):
        create_sample_traffic_video(demo_video_path)

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    processed_folder = current_app.config["PROCESSED_FOLDER"]
    ensure_directory(upload_folder)
    ensure_directory(processed_folder)

    unique_name = generate_unique_filename("sample_traffic_demo.mp4")
    input_path = os.path.join(upload_folder, unique_name)
    shutil.copyfile(demo_video_path, input_path)

    session_id = insert_session(unique_name, "sample_traffic_demo.mp4")
    output_name = f"processed_{unique_name}"
    output_name = os.path.splitext(output_name)[0] + ".mp4"
    output_path = os.path.join(processed_folder, output_name)

    t = threading.Thread(
        target=_background_process,
        args=(current_app._get_current_object(), session_id, input_path, output_path),
        daemon=True,
    )
    t.start()

    return success_response(
        {"session_id": session_id, "filename": "sample_traffic_demo.mp4", "status": "pending"},
        message="Demo sample video loaded. Real YOLO inference started.",
        status_code=201,
    )


def _background_process(app, session_id, input_path, output_path):
    """Wrapper to run process_video inside the Flask app context."""
    with app.app_context():
        try:
            process_video(session_id, input_path, output_path)
        except Exception as exc:
            # Error already handled inside process_video; log here for safety
            print(f"[ERROR] Processing session {session_id} failed: {exc}")


@detection_bp.route("/process/<int:session_id>", methods=["GET"])
def get_processing_status(session_id):
    """Return current processing progress for a session."""
    progress = processing_progress.get(session_id)
    if progress is not None:
        return success_response(progress)

    # Fallback to DB status
    session = get_session(session_id)
    if session is None:
        return error_response("Session not found.", 404)

    return success_response({
        "status": session["status"],
        "progress": 100 if session["status"] == "completed" else 0,
        "current_frame": 0,
        "total_frames": 0,
    })


@detection_bp.route("/results/<int:session_id>", methods=["GET"])
def get_results(session_id):
    """Return detection results for a completed session."""
    session = get_session(session_id)
    if session is None:
        return error_response("Session not found.", 404)

    traffic_records = get_traffic_records(session_id)

    # Build video URL (served by Flask static route)
    video_url = ""
    if session.get("video_path"):
        video_url = f"/processed/{session['video_path']}"

    data = dict(session)
    data["session"] = session
    data["traffic_records"] = traffic_records
    data["video_url"] = video_url
    data["processed_video"] = video_url
    return success_response(data)


@detection_bp.route("/sessions", methods=["GET"])
def list_sessions():
    """List all detection sessions."""
    limit = request.args.get("limit", 50, type=int)
    sessions = get_all_sessions(limit=limit)
    return success_response(sessions)


@detection_bp.route("/sessions/<int:session_id>", methods=["DELETE"])
def remove_session(session_id):
    """Delete a detection session and its data."""
    session = get_session(session_id)
    if session is None:
        return error_response("Session not found.", 404)

    # Clean up files
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    processed_folder = current_app.config["PROCESSED_FOLDER"]

    upload_file = os.path.join(upload_folder, session["filename"])
    if os.path.exists(upload_file):
        try:
            os.remove(upload_file)
        except OSError:
            pass

    if session.get("video_path"):
        processed_file = os.path.join(processed_folder, session["video_path"])
        if os.path.exists(processed_file):
            try:
                os.remove(processed_file)
            except OSError:
                pass

    delete_session(session_id)

    # Clean progress cache
    processing_progress.pop(session_id, None)

    return success_response(message="Session deleted successfully.")
