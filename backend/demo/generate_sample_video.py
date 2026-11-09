"""
Sample Traffic Video Generator for testing and demonstration.
Generates a 10-second 30fps traffic video with realistic road, lanes,
and moving vehicles (cars, trucks, buses, motorcycles).
Used to test end-to-end YOLO detection, ByteTrack tracking,
traffic density estimation, and SHAP explainability.
"""

import os
import cv2
import numpy as np

def create_sample_traffic_video(output_path="backend/demo/sample_traffic.mp4", duration_sec=8, fps=24):
    width, height = 640, 480
    total_frames = duration_sec * fps
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    # Vehicle definitions: (start_frame, lane, speed, type, color)
    # lanes: 0 (y=160), 1 (y=240), 2 (y=320)
    vehicles = [
        {"start": 0, "y": 160, "speed": 4.5, "type": "car", "color": (40, 40, 200), "w": 65, "h": 35},
        {"start": 10, "y": 240, "speed": 3.8, "type": "car", "color": (200, 50, 50), "w": 65, "h": 35},
        {"start": 25, "y": 320, "speed": 2.8, "type": "truck", "color": (50, 160, 50), "w": 100, "h": 45},
        {"start": 40, "y": 160, "speed": 5.2, "type": "motorcycle", "color": (220, 180, 40), "w": 40, "h": 20},
        {"start": 60, "y": 240, "speed": 2.5, "type": "bus", "color": (30, 120, 220), "w": 120, "h": 45},
        {"start": 80, "y": 320, "speed": 4.0, "type": "car", "color": (180, 180, 180), "w": 65, "h": 35},
        {"start": 100, "y": 160, "speed": 4.8, "type": "car", "color": (30, 180, 180), "w": 65, "h": 35},
        {"start": 120, "y": 240, "speed": 3.2, "type": "truck", "color": (80, 80, 90), "w": 95, "h": 42},
    ]

    for f in range(total_frames):
        # Draw background: asphalt road with lanes
        frame = np.full((height, width, 3), (35, 38, 42), dtype=np.uint8)

        # Grass borders
        frame[0:100, :] = (45, 90, 45)
        frame[390:height, :] = (45, 90, 45)

        # White border lines
        cv2.line(frame, (0, 100), (width, 100), (255, 255, 255), 3)
        cv2.line(frame, (0, 390), (width, 390), (255, 255, 255), 3)

        # Dashed lane markings
        dash_offset = int((f * 5) % 40)
        for x in range(-40 + dash_offset, width + 40, 40):
            cv2.line(frame, (x, 195), (x + 20, 195), (200, 200, 200), 2)
            cv2.line(frame, (x, 295), (x + 20, 295), (200, 200, 200), 2)

        # Draw moving vehicles
        for v in vehicles:
            if f >= v["start"]:
                elapsed = f - v["start"]
                x = int(-v["w"] + elapsed * v["speed"])
                y = v["y"]
                if x < width + 100:
                    # Vehicle body
                    cv2.rectangle(frame, (x, y), (x + v["w"], y + v["h"]), v["color"], -1)
                    cv2.rectangle(frame, (x, y), (x + v["w"], y + v["h"]), (255, 255, 255), 1)

                    # Windshield / windows
                    if v["type"] in ["car", "bus", "truck"]:
                        win_x = x + int(v["w"] * 0.6)
                        cv2.rectangle(frame, (win_x, y + 4), (win_x + 12, y + v["h"] - 4), (200, 230, 255), -1)

                    # Headlights
                    cv2.circle(frame, (x + v["w"] - 2, y + 5), 3, (255, 255, 180), -1)
                    cv2.circle(frame, (x + v["w"] - 2, y + v["h"] - 5), 3, (255, 255, 180), -1)

                    # Tail lights
                    cv2.circle(frame, (x + 2, y + 5), 2, (0, 0, 255), -1)
                    cv2.circle(frame, (x + 2, y + v["h"] - 5), 2, (0, 0, 255), -1)

        # Timestamp watermark
        cv2.putText(frame, f"SMART CITY CCTV CAM 04 | FRAME {f:04d}", (15, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1, cv2.LINE_AA)

        out.write(frame)

    cap = out
    cap.release()
    print(f"Sample traffic video generated at: {output_path} ({total_frames} frames)")
    return output_path

if __name__ == "__main__":
    create_sample_traffic_video()

