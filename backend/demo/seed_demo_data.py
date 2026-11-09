"""
Seeds the database with realistic sample traffic sessions and records
so that the dashboard, reports, analysis, and SHAP charts immediately
show rich real-world smart-city monitoring data upon first launch.
"""

import sys
import os
from datetime import datetime, timedelta, timezone

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from models.database import init_db, get_db, insert_session, update_session, insert_traffic_record

def seed():
    init_db()
    conn = get_db()
    existing = conn.execute("SELECT COUNT(*) AS cnt FROM detection_sessions WHERE status='completed'").fetchone()["cnt"]
    conn.close()

    if existing >= 5:
        print(f"Database already has {existing} completed sessions. Skipping seed.")
        return

    print("Seeding sample traffic sessions...")
    now = datetime.now(timezone.utc)

    sample_sessions = [
        {
            "filename": "highway_morning_peak.mp4",
            "time_offset_hours": 18,
            "status": "completed",
            "total_vehicles": 28,
            "cars": 18,
            "motorcycles": 5,
            "buses": 3,
            "trucks": 2,
            "processing_time": 24.5,
            "density": 0.78,
            "congestion": "High",
            "speed": 18.2,
        },
        {
            "filename": "arterial_midday_flow.mp4",
            "time_offset_hours": 12,
            "status": "completed",
            "total_vehicles": 12,
            "cars": 8,
            "motorcycles": 2,
            "buses": 1,
            "trucks": 1,
            "processing_time": 18.2,
            "density": 0.38,
            "congestion": "Medium",
            "speed": 42.6,
        },
        {
            "filename": "expressway_night_freeflow.mp4",
            "time_offset_hours": 8,
            "status": "completed",
            "total_vehicles": 4,
            "cars": 3,
            "motorcycles": 1,
            "buses": 0,
            "trucks": 0,
            "processing_time": 14.1,
            "density": 0.12,
            "congestion": "Low",
            "speed": 68.4,
        },
        {
            "filename": "junction_evening_rush.mp4",
            "time_offset_hours": 4,
            "status": "completed",
            "total_vehicles": 22,
            "cars": 14,
            "motorcycles": 4,
            "buses": 2,
            "trucks": 2,
            "processing_time": 22.8,
            "density": 0.65,
            "congestion": "High",
            "speed": 22.5,
        },
        {
            "filename": "cctv_central_avenue.mp4",
            "time_offset_hours": 1,
            "status": "completed",
            "total_vehicles": 15,
            "cars": 10,
            "motorcycles": 3,
            "buses": 1,
            "trucks": 1,
            "processing_time": 19.4,
            "density": 0.44,
            "congestion": "Medium",
            "speed": 36.8,
        },
    ]

    for item in sample_sessions:
        upload_time = (now - timedelta(hours=item["time_offset_hours"])).isoformat()
        sid = insert_session(item["filename"], item["filename"])
        update_session(
            sid,
            status=item["status"],
            total_vehicles=item["total_vehicles"],
            cars=item["cars"],
            motorcycles=item["motorcycles"],
            buses=item["buses"],
            trucks=item["trucks"],
            processing_time=item["processing_time"],
            video_path="sample_traffic_demo.mp4",
        )
        insert_traffic_record(sid, {
            "vehicle_count": item["total_vehicles"],
            "density": item["density"],
            "congestion_level": item["congestion"],
            "avg_speed": item["speed"],
            "cars": item["cars"],
            "motorcycles": item["motorcycles"],
            "buses": item["buses"],
            "trucks": item["trucks"],
        })

    print("✅ Sample traffic sessions successfully seeded.")

if __name__ == "__main__":
    seed()

