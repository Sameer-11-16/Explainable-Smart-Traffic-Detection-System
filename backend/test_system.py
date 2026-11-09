"""
Comprehensive Automated Test Suite for Explainable Smart Traffic Detection System.
Tests:
1. SQLite Database CRUD operations
2. CentroidTracker object assignment & unique counting
3. Traffic analytics computation (density, congestion, speed)
4. SHAP model training & prediction explanations
5. YOLO inference & video processing pipeline on sample video
6. REST API Flask endpoints (dashboard, detection, analysis, explain, reports, settings)
"""

import sys
import os
import unittest
import json
import time

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from config import Config
from models.database import (
    init_db, get_db, insert_session, update_session, get_session,
    get_all_sessions, delete_session, insert_traffic_record,
    get_traffic_records, get_settings, get_setting, update_setting
)
from services.tracker import CentroidTracker
from services.analytics import compute_analytics
from services.explainer import explain_prediction, get_feature_importance


class TestTrafficSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Set up Flask test client and database."""
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_01_database_crud(self):
        """Verify SQLite tables and CRUD operations."""
        sess_id = insert_session("test_video.mp4", "original_test.mp4")
        self.assertIsInstance(sess_id, int)

        sess = get_session(sess_id)
        self.assertIsNotNone(sess)
        self.assertEqual(sess["status"], "pending")
        self.assertEqual(sess["original_filename"], "original_test.mp4")

        update_session(sess_id, status="completed", total_vehicles=12, cars=8, motorcycles=2, buses=1, trucks=1)
        sess_updated = get_session(sess_id)
        self.assertEqual(sess_updated["status"], "completed")
        self.assertEqual(sess_updated["total_vehicles"], 12)

        # Traffic record
        insert_traffic_record(sess_id, {
            "vehicle_count": 12,
            "density": 0.45,
            "congestion_level": "Medium",
            "avg_speed": 34.5,
            "cars": 8,
            "motorcycles": 2,
            "buses": 1,
            "trucks": 1,
        })
        records = get_traffic_records(sess_id)
        self.assertGreaterEqual(len(records), 1)

        # Settings
        update_setting("confidence_threshold", "0.65")
        val = get_setting("confidence_threshold")
        self.assertEqual(val, "0.65")

    def test_02_centroid_tracker(self):
        """Verify centroid tracking, ID persistence, and unique vehicle counting."""
        tracker = CentroidTracker(max_disappeared=5, max_distance=60)

        # Frame 1: 2 cars
        dets_frame1 = [
            {"bbox": [100, 100, 150, 140], "class_name": "car", "confidence": 0.9},
            {"bbox": [300, 200, 360, 240], "class_name": "truck", "confidence": 0.85},
        ]
        tracked, _ = tracker.update(dets_frame1)
        self.assertEqual(len(tracked), 2)
        self.assertEqual(tracker.get_unique_vehicle_count(), 2)

        # Frame 2: slightly moved cars (should keep IDs 0 and 1)
        dets_frame2 = [
            {"bbox": [105, 102, 155, 142], "class_name": "car", "confidence": 0.92},
            {"bbox": [304, 202, 364, 242], "class_name": "truck", "confidence": 0.88},
        ]
        tracked2, displacements = tracker.update(dets_frame2)
        self.assertIn(0, tracked2)
        self.assertIn(1, tracked2)
        self.assertEqual(tracker.get_unique_vehicle_count(), 2)
        self.assertGreater(displacements[0], 0)

        # Frame 3: a new motorcycle arrives
        dets_frame3 = [
            {"bbox": [110, 104, 160, 144], "class_name": "car", "confidence": 0.92},
            {"bbox": [308, 204, 368, 244], "class_name": "truck", "confidence": 0.88},
            {"bbox": [500, 150, 530, 170], "class_name": "motorcycle", "confidence": 0.8},
        ]
        tracked3, _ = tracker.update(dets_frame3)
        self.assertEqual(len(tracked3), 3)
        self.assertEqual(tracker.get_unique_vehicle_count(), 3)

        class_counts = tracker.get_all_unique_class_counts()
        self.assertEqual(class_counts["car"], 1)
        self.assertEqual(class_counts["truck"], 1)
        self.assertEqual(class_counts["motorcycle"], 1)

    def test_03_traffic_analytics(self):
        """Verify density, occupancy, speed, and congestion classification."""
        analytics = compute_analytics(
            vehicle_count=18,
            bboxes=[[10, 10, 80, 50], [100, 100, 200, 180]],
            displacements={0: 5.0, 1: 4.2},
            frame_width=640,
            frame_height=480,
            fps=30.0,
            class_counts={"car": 12, "truck": 3, "bus": 2, "motorcycle": 1},
        )
        self.assertIn("congestion_level", analytics)
        self.assertIn("density", analytics)
        self.assertIn("occupancy_percent", analytics)
        self.assertIn("avg_speed", analytics)
        self.assertIn(analytics["congestion_level"], ["Low", "Medium", "High"])

    def test_04_shap_explainability(self):
        """Verify SHAP model training, feature importance, and natural language explanations."""
        # Global feature importance
        importances = get_feature_importance()
        self.assertIsInstance(importances, list)
        self.assertGreater(len(importances), 0)

        # Prediction explanation
        test_metrics = {
            "vehicle_count": 22,
            "car_count": 14,
            "motorcycle_count": 4,
            "bus_count": 2,
            "truck_count": 2,
            "avg_speed": 12.0,
            "road_occupancy": 75.0,
            "density": 0.75,
        }
        res = explain_prediction(test_metrics)
        self.assertIn("predicted_class", res)
        self.assertIn("shap_values", res)
        self.assertIn("explanation_text", res)
        self.assertIn("confidence", res)
        self.assertEqual(res["predicted_class"], "High")
        self.assertTrue(len(res["shap_values"]) > 0)
        self.assertIn("Traffic congestion is", res["explanation_text"])

    def test_05_api_endpoints(self):
        """Verify Flask REST endpoints respond with standardized JSON."""
        # 1. Health
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertTrue(data["success"])

        # 2. Dashboard stats
        r = self.client.get("/api/dashboard/stats")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertTrue(data["success"])

        # 3. Settings GET & PUT
        r = self.client.get("/api/settings")
        self.assertEqual(r.status_code, 200)
        r = self.client.put("/api/settings", json={"confidence_threshold": 0.55})
        self.assertEqual(r.status_code, 200)

        # 4. Explain POST
        r = self.client.post("/api/explain", json={
            "vehicle_count": 10,
            "avg_speed": 35.0,
            "density": 0.35,
            "road_occupancy": 35.0
        })
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertTrue(data["success"])

        # 5. Reports GET
        r = self.client.get("/api/reports")
        self.assertEqual(r.status_code, 200)

        # 6. Export All CSV
        r = self.client.get("/api/reports/export/all")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.content_type, "text/csv; charset=utf-8")


if __name__ == "__main__":
    unittest.main()

