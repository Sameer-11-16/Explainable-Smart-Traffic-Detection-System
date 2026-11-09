"""
YOLO-based vehicle detection engine.
Uses ultralytics YOLOv8n for lightweight, real-time vehicle detection.
Processes video files frame-by-frame, draws annotated bounding boxes,
and saves the processed video.
"""

import os
import time
import threading
import cv2
import numpy as np

from services.tracker import CentroidTracker
from services.analytics import compute_analytics
from models.database import (
    update_session,
    insert_traffic_record,
    get_setting,
)

# COCO class IDs for vehicles
VEHICLE_CLASS_IDS = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# Colours for each vehicle class (BGR)
CLASS_COLOURS = {
    "car": (0, 255, 0),        # green
    "motorcycle": (255, 165, 0),  # orange-ish
    "bus": (0, 0, 255),        # red
    "truck": (255, 0, 0),      # blue
}

# Global lock for YOLO model initialisation
_model_lock = threading.Lock()
_model = None


def _get_model():
    """Lazy-load the YOLO model (thread-safe, cached)."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from ultralytics import YOLO
                _model = YOLO("yolov8n.pt")
    return _model


# ---------- public processing entry point ----------

# In-memory store of processing progress keyed by session_id
processing_progress = {}


def process_video(session_id, input_path, output_path):
    """
    Process a video file: detect vehicles, track them, compute analytics,
    annotate frames, and save the output video.

    This function is designed to be called inside a background thread.

    Parameters
    ----------
    session_id : int
        Database session ID.
    input_path : str
        Path to the uploaded video file.
    output_path : str
        Path where the annotated video will be saved.
    """
    start_time = time.time()

    try:
        # Mark session as processing
        update_session(session_id, status="processing")
        processing_progress[session_id] = {
            "status": "processing",
            "progress": 0,
            "current_frame": 0,
            "total_frames": 0,
        }

        # Read settings
        confidence_threshold = float(get_setting("confidence_threshold") or 0.5)
        frame_skip = int(get_setting("frame_skip") or 3)

        # Open video
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {input_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        processing_progress[session_id]["total_frames"] = total_frames

        # Video writer – use mp4v codec for broad compatibility
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height))

        # Tracker
        tracker = CentroidTracker(max_disappeared=int(fps), max_distance=80)

        # Accumulators for session-level stats
        total_class_counts = {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0}
        all_analytics = []
        frame_idx = 0
        model = _get_model()

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            processing_progress[session_id]["current_frame"] = frame_idx
            processing_progress[session_id]["progress"] = int(
                (frame_idx / max(total_frames, 1)) * 100
            )

            # Only run detection every `frame_skip` frames
            if frame_idx % frame_skip == 0:
                # Run YOLO inference
                results = model.predict(
                    frame,
                    conf=confidence_threshold,
                    verbose=False,
                    classes=list(VEHICLE_CLASS_IDS.keys()),
                )

                detections = []
                bboxes = []

                if results and len(results) > 0:
                    result = results[0]
                    if result.boxes is not None and len(result.boxes) > 0:
                        for box in result.boxes:
                            cls_id = int(box.cls[0])
                            if cls_id not in VEHICLE_CLASS_IDS:
                                continue
                            conf = float(box.conf[0])
                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                            class_name = VEHICLE_CLASS_IDS[cls_id]

                            detections.append({
                                "bbox": [x1, y1, x2, y2],
                                "class_name": class_name,
                                "confidence": conf,
                            })
                            bboxes.append([x1, y1, x2, y2])

                # Update tracker
                tracked_objects, displacements = tracker.update(detections)
                class_counts = tracker.get_class_counts()

                # Draw bounding boxes on the frame
                for det in detections:
                    x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
                    cls = det["class_name"]
                    conf = det["confidence"]
                    colour = CLASS_COLOURS.get(cls, (255, 255, 255))
                    cv2.rectangle(frame, (x1, y1), (x2, y2), colour, 2)
                    label = f"{cls} {conf:.2f}"
                    # Background for text
                    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                    cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw, y1), colour, -1)
                    cv2.putText(frame, label, (x1, y1 - 4),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1,
                                cv2.LINE_AA)

                # Draw tracked IDs
                for oid, centroid in tracked_objects.items():
                    cx, cy = centroid
                    cv2.circle(frame, (cx, cy), 4, (255, 255, 255), -1)
                    cv2.putText(frame, f"ID {oid}", (cx - 10, cy - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1,
                                cv2.LINE_AA)

                # Compute analytics for this detection frame
                vehicle_count = len(tracked_objects)
                analytics = compute_analytics(
                    vehicle_count=vehicle_count,
                    bboxes=bboxes,
                    displacements=displacements,
                    frame_width=frame_width,
                    frame_height=frame_height,
                    fps=fps,
                    class_counts=class_counts,
                )
                all_analytics.append(analytics)

                # Draw HUD overlay
                _draw_hud(frame, analytics)

            # Write the (possibly annotated) frame
            out.write(frame)

        cap.release()
        out.release()

        unique_vehicles = tracker.get_unique_vehicle_count()
        all_class_counts = tracker.get_all_unique_class_counts()
        total_cars = all_class_counts.get("car", 0)
        total_motorcycles = all_class_counts.get("motorcycle", 0)
        total_buses = all_class_counts.get("bus", 0)
        total_trucks = all_class_counts.get("trucks", all_class_counts.get("truck", 0))

        # Aggregate session-level statistics
        if all_analytics:
            avg_density = sum(a["density"] for a in all_analytics) / len(all_analytics)
            avg_speed = sum(a["avg_speed"] for a in all_analytics) / len(all_analytics)
        else:
            avg_density = avg_speed = 0.0

        processing_time = round(time.time() - start_time, 2)

        # Persist session results
        update_session(
            session_id,
            status="completed",
            total_vehicles=unique_vehicles,
            cars=total_cars,
            motorcycles=total_motorcycles,
            buses=total_buses,
            trucks=total_trucks,
            processing_time=processing_time,
            video_path=os.path.basename(output_path),
        )

        # Store a summary traffic record
        summary_record = {
            "vehicle_count": unique_vehicles,
            "density": round(avg_density, 4),
            "congestion_level": all_analytics[-1]["congestion_level"] if all_analytics else "Low",
            "avg_speed": round(avg_speed, 2),
            "cars": total_cars,
            "motorcycles": total_motorcycles,
            "buses": total_buses,
            "trucks": total_trucks,
        }
        insert_traffic_record(session_id, summary_record)

        processing_progress[session_id] = {
            "status": "completed",
            "progress": 100,
            "current_frame": total_frames,
            "total_frames": total_frames,
        }

    except Exception as exc:
        processing_time = round(time.time() - start_time, 2)
        update_session(session_id, status="failed", processing_time=processing_time)
        processing_progress[session_id] = {
            "status": "failed",
            "progress": 0,
            "error": str(exc),
            "current_frame": 0,
            "total_frames": 0,
        }
        raise


def _draw_hud(frame, analytics):
    """Draw a translucent HUD overlay on the top-left of the frame."""
    overlay = frame.copy()
    h, w = frame.shape[:2]
    # Semi-transparent rectangle
    cv2.rectangle(overlay, (10, 10), (320, 140), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.5, frame, 0.5, 0, frame)

    lines = [
        f"Vehicles: {analytics['vehicle_count']}",
        f"Density: {analytics['density']:.2f}",
        f"Congestion: {analytics['congestion_level']}",
        f"Speed: {analytics['avg_speed']:.1f} km/h",
        f"Occupancy: {analytics['road_occupancy']:.1f}%",
    ]
    y = 32
    for line in lines:
        colour = (0, 255, 0)
        if "High" in line:
            colour = (0, 0, 255)
        elif "Medium" in line:
            colour = (0, 200, 255)
        cv2.putText(frame, line, (20, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                    colour, 1, cv2.LINE_AA)
        y += 22


# ---------- Live Camera & CCTV Stream Support ----------

latest_live_stats = {
    "active": False,
    "fps": 0.0,
    "vehicle_count": 0,
    "density": 0.0,
    "congestion_level": "Low",
    "avg_speed": 0.0,
    "road_occupancy": 0.0,
    "cars": 0,
    "motorcycles": 0,
    "buses": 0,
    "trucks": 0,
}


def stop_live_stream():
    """Signal live stream generator to terminate."""
    global latest_live_stats
    latest_live_stats["active"] = False


def generate_live_stream(source="demo", conf_thresh=0.45):
    """
    Generator that yields real-time multipart JPEG frames with live YOLO & ByteTrack detection.
    Source can be 'demo' (looping CCTV video) or 'webcam' (device index 0).
    """
    global latest_live_stats
    latest_live_stats["active"] = True

    cap = None
    if source == "webcam":
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            demo_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), "demo", "sample_traffic.mp4"
            )
            cap = cv2.VideoCapture(demo_path)
    else:
        demo_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "demo", "sample_traffic.mp4"
        )
        if not os.path.exists(demo_path):
            from demo.generate_sample_video import create_sample_traffic_video
            create_sample_traffic_video(demo_path)
        cap = cv2.VideoCapture(demo_path)

    model = _get_model()
    tracker = CentroidTracker(max_disappeared=20, max_distance=80)
    prev_time = time.time()

    try:
        while latest_live_stats["active"]:
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if not ret:
                    break

            now = time.time()
            fps = 1.0 / max(now - prev_time, 0.001)
            prev_time = now

            frame_h, frame_w = frame.shape[:2]

            # YOLO inference
            results = model.predict(
                frame,
                conf=conf_thresh,
                verbose=False,
                classes=list(VEHICLE_CLASS_IDS.keys()),
            )
            detections = []
            bboxes = []

            if results and len(results) > 0:
                res = results[0]
                if res.boxes is not None and len(res.boxes) > 0:
                    for box in res.boxes:
                        cls_id = int(box.cls[0])
                        if cls_id not in VEHICLE_CLASS_IDS:
                            continue
                        conf = float(box.conf[0])
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        cls_name = VEHICLE_CLASS_IDS[cls_id]
                        detections.append({
                            "bbox": [x1, y1, x2, y2],
                            "class_name": cls_name,
                            "confidence": conf,
                        })
                        bboxes.append([x1, y1, x2, y2])

            tracked_objs, displacements = tracker.update(detections)
            class_counts = tracker.get_class_counts()

            # Draw bounding boxes
            for det in detections:
                x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
                cls = det["class_name"]
                conf = det["confidence"]
                col = CLASS_COLOURS.get(cls, (255, 255, 255))
                cv2.rectangle(frame, (x1, y1), (x2, y2), col, 2)
                label = f"{cls} {conf:.2f}"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw, y1), col, -1)
                cv2.putText(frame, label, (x1, y1 - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

            # Draw tracking IDs
            for tid, (cx, cy) in tracked_objs.items():
                cv2.circle(frame, (cx, cy), 3, (255, 255, 255), -1)
                cv2.putText(frame, f"#{tid}", (cx - 8, cy - 8),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)

            # Analytics
            analytics = compute_analytics(
                vehicle_count=len(tracked_objs),
                bboxes=bboxes,
                displacements=displacements,
                frame_width=frame_w,
                frame_height=frame_h,
                fps=fps,
                class_counts=class_counts,
            )

            # HUD
            _draw_hud(frame, analytics)
            cv2.putText(frame, f"LIVE STREAM | FPS: {fps:.1f}", (frame_w - 220, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2, cv2.LINE_AA)
            cv2.circle(frame, (frame_w - 235, 25), 6, (0, 0, 255), -1)

            # Update live stats
            latest_live_stats.update({
                "fps": round(fps, 1),
                "vehicle_count": len(tracked_objs),
                "density": analytics["density"],
                "congestion_level": analytics["congestion_level"],
                "avg_speed": analytics["avg_speed"],
                "road_occupancy": analytics["road_occupancy"],
                "cars": class_counts.get("car", 0),
                "motorcycles": class_counts.get("motorcycle", 0),
                "buses": class_counts.get("bus", 0),
                "trucks": class_counts.get("truck", 0),
            })

            # JPEG encode
            ret_enc, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ret_enc:
                continue

            frame_bytes = buffer.tobytes()
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")

            time.sleep(0.03)

    finally:
        if cap:
            cap.release()
        latest_live_stats["active"] = False

