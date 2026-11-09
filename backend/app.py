"""
Flask application factory and main entry point for the
Explainable Smart Traffic Detection System.
"""

import os

# Configure cache directories to prevent permission issues
_base_dir = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("MPLCONFIGDIR", os.path.join(_base_dir, ".mplconfig"))
os.environ.setdefault("YOLO_CONFIG_DIR", os.path.join(_base_dir, ".yoloconfig"))

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from config import Config
from models.database import init_db
from utils.helpers import ensure_directory


def create_app(config_class=Config):
    """Create and configure the Flask application."""

    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config_class)
    # Copy custom config keys that aren't standard Flask keys
    app.config["UPLOAD_FOLDER"] = config_class.UPLOAD_FOLDER
    app.config["PROCESSED_FOLDER"] = config_class.PROCESSED_FOLDER
    app.config["DATABASE"] = config_class.DATABASE
    app.config["ALLOWED_EXTENSIONS"] = config_class.ALLOWED_EXTENSIONS

    # Enable CORS
    CORS(app, origins=config_class.CORS_ORIGINS, supports_credentials=True)

    # Ensure required directories exist
    ensure_directory(app.config["UPLOAD_FOLDER"])
    ensure_directory(app.config["PROCESSED_FOLDER"])

    # Initialise the database
    with app.app_context():
        init_db()

    # ---- Register blueprints ----
    from routes.detection import detection_bp
    from routes.dashboard import dashboard_bp
    from routes.analysis import analysis_bp
    from routes.explainability import explainability_bp
    from routes.reports import reports_bp
    from routes.settings import settings_bp

    app.register_blueprint(detection_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(explainability_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(settings_bp)

    # ---- Serve processed videos as static files ----
    @app.route("/processed/<path:filename>")
    @app.route("/api/processed/<path:filename>")
    def serve_processed_video(filename):
        """Serve a processed video file."""
        return send_from_directory(app.config["PROCESSED_FOLDER"], filename)

    # ---- Health check ----
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({"success": True, "message": "API is running"}), 200

    # ---- Production SPA Static Serving ----
    dist_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "frontend",
        "dist",
    )

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend_app(path):
        """Serve compiled frontend SPA for production deployment."""
        if path.startswith("api/") or path == "api" or path.startswith("processed/"):
            return jsonify({"success": False, "error": "Endpoint not found"}), 404

        if os.path.exists(dist_dir):
            file_path = os.path.join(dist_dir, path)
            if path != "" and os.path.isfile(file_path):
                return send_from_directory(dist_dir, path)
            return send_from_directory(dist_dir, "index.html")

        return jsonify({"success": True, "message": "ESTDS Backend API is active."}), 200

    # ---- Error handlers ----
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"success": False, "error": "Bad request"}), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"success": False, "error": "Resource not found"}), 404

    @app.errorhandler(413)
    def payload_too_large(error):
        return jsonify({
            "success": False,
            "error": "File too large. Maximum size is 500 MB.",
        }), 413

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"success": False, "error": "Internal server error"}), 500

    return app


# ---- Run directly ----
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
