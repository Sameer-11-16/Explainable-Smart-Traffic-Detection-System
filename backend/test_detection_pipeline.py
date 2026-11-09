"""
End-to-End Test for YOLO Detection & Tracking Pipeline.
Processes backend/demo/sample_traffic.mp4 using real YOLOv8 inference,
verifies output video creation, database persistence, and SHAP explainability.
"""

import sys
import os
import time

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from models.database import insert_session, get_session, get_traffic_records
from services.detector import process_video
from services.explainer import explain_prediction

def test_full_pipeline():
    print("=== STARTING FULL END-TO-END PIPELINE TEST ===")
    app = create_app()

    with app.app_context():
        input_video = os.path.join(backend_dir, "demo", "sample_traffic.mp4")
        if not os.path.exists(input_video):
            from demo.generate_sample_video import create_sample_traffic_video
            create_sample_traffic_video(input_video)

        output_video = os.path.join(backend_dir, "processed", "test_sample_output.mp4")
        if os.path.exists(output_video):
            os.remove(output_video)

        # 1. Insert session
        session_id = insert_session("test_sample_output.mp4", "sample_traffic.mp4")
        print(f"[1/4] Created test session ID: {session_id}")

        # 2. Run real YOLO detection & tracking
        print(f"[2/4] Running YOLO detection & ByteTrack on {input_video}...")
        t0 = time.time()
        process_video(session_id, input_video, output_video)
        elapsed = time.time() - t0
        print(f"[2/4] YOLO video processing finished in {elapsed:.2f}s")

        # 3. Verify session in DB
        session = get_session(session_id)
        print(f"[3/4] Verified DB Session: status={session['status']}, total_vehicles={session['total_vehicles']}, cars={session['cars']}, processing_time={session['processing_time']}s")
        assert session["status"] == "completed", f"Expected completed, got {session['status']}"
        assert os.path.exists(output_video), "Output video file does not exist!"
        assert os.path.getsize(output_video) > 1000, "Output video file is suspiciously small or empty!"

        # 4. Verify SHAP explanation on this session
        records = get_traffic_records(session_id)
        assert len(records) > 0, "No traffic records inserted for session!"
        latest = records[-1]
        metrics = {
            "vehicle_count": latest["vehicle_count"],
            "car_count": latest["cars"],
            "motorcycle_count": latest["motorcycles"],
            "bus_count": latest["buses"],
            "truck_count": latest["trucks"],
            "avg_speed": latest["avg_speed"],
            "road_occupancy": latest["density"] * 100,
            "density": latest["density"],
        }
        explanation = explain_prediction(metrics)
        print(f"[4/4] Verified SHAP Explanation: prediction={explanation['predicted_class']}, confidence={explanation['confidence']*100:.1f}%, explanation='{explanation['explanation_text']}'")
        assert explanation["predicted_class"] in ["Low", "Medium", "High"]
        assert len(explanation["shap_values"]) > 0

    print("\n✅ ALL END-TO-END SYSTEM PIPELINE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_pipeline()

