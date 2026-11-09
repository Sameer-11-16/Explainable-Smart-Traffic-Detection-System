"""
Traffic analytics service.
Calculates density, congestion level, road occupancy, and estimated speed.
"""

from utils.helpers import safe_divide


def compute_density(vehicle_count, frame_width, frame_height):
    """
    Compute normalised traffic density.

    density = vehicle_count / reference_area
    We normalise so that ~25 vehicles in a 1280×720 frame ≈ 1.0.
    """
    reference_area = safe_divide(frame_width * frame_height, 1280 * 720, default=1.0)
    density = safe_divide(vehicle_count, 25.0 * reference_area, default=0.0)
    return round(min(density, 1.0), 4)


def compute_road_occupancy(bboxes, frame_width, frame_height):
    """
    Estimate road occupancy as the fraction of the frame area covered by
    vehicle bounding boxes (simple sum, no overlap handling).

    Parameters
    ----------
    bboxes : list[list[float]]
        Each entry is [x1, y1, x2, y2].
    frame_width : int
    frame_height : int

    Returns
    -------
    float
        Occupancy percentage 0–100.
    """
    if not bboxes or frame_width == 0 or frame_height == 0:
        return 0.0
    total_bbox_area = 0.0
    for x1, y1, x2, y2 in bboxes:
        w = max(0, x2 - x1)
        h = max(0, y2 - y1)
        total_bbox_area += w * h
    frame_area = frame_width * frame_height
    occupancy = (total_bbox_area / frame_area) * 100.0
    return round(min(occupancy, 100.0), 2)


def classify_congestion(density, vehicle_count):
    """
    Classify congestion level.

    Returns
    -------
    str
        "Low", "Medium", or "High".
    """
    if density >= 0.6 or vehicle_count >= 15:
        return "High"
    if density >= 0.3 or vehicle_count >= 5:
        return "Medium"
    return "Low"


def estimate_average_speed(displacements, fps=30, pixels_per_meter=8.0):
    """
    Estimate average speed from per-object pixel displacements.

    Parameters
    ----------
    displacements : dict
        object_id -> pixel displacement in one frame interval.
    fps : float
        Frames per second of the video.
    pixels_per_meter : float
        Rough calibration factor (pixels per real-world meter).

    Returns
    -------
    float
        Estimated average speed in km/h.
    """
    if not displacements:
        return 0.0
    avg_disp = sum(displacements.values()) / len(displacements)
    # displacement (px) / pixels_per_meter → meters per frame
    meters_per_frame = avg_disp / pixels_per_meter
    # meters per second
    meters_per_sec = meters_per_frame * fps
    # km/h
    speed_kmh = meters_per_sec * 3.6
    # Clamp to reasonable range
    speed_kmh = max(0.0, min(speed_kmh, 200.0))
    return round(speed_kmh, 2)


def compute_analytics(vehicle_count, bboxes, displacements,
                      frame_width, frame_height, fps=30,
                      class_counts=None):
    """
    Compute a full analytics snapshot for one frame / interval.

    Returns
    -------
    dict
        Keys: vehicle_count, density, road_occupancy, congestion_level,
              avg_speed, cars, motorcycles, buses, trucks.
    """
    density = compute_density(vehicle_count, frame_width, frame_height)
    occupancy = compute_road_occupancy(bboxes, frame_width, frame_height)
    congestion = classify_congestion(density, vehicle_count)
    avg_speed = estimate_average_speed(displacements, fps=fps)

    cc = class_counts or {}

    return {
        "vehicle_count": vehicle_count,
        "density": density,
        "road_occupancy": occupancy,
        "occupancy_percent": occupancy,
        "congestion_level": congestion,
        "avg_speed": avg_speed,
        "cars": cc.get("car", 0),
        "motorcycles": cc.get("motorcycle", 0),
        "buses": cc.get("bus", 0),
        "trucks": cc.get("truck", 0),
    }
