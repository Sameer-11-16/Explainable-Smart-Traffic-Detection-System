"""
ByteTrack: Multi-Object Vehicle Tracker for Intelligent Traffic Systems.
Implements the ByteTrack association paradigm:
1. Partition detections into high-confidence and low-confidence pools.
2. First association: Match active tracks with high-confidence detections using IoU.
3. Second association: Match remaining active tracks with low-confidence detections using IoU
   to prevent track fragmentation during occlusions.
4. Unmatched high-confidence detections spawn new tracks.
5. Lost tracks are pruned after `max_disappeared` frames.
"""

import math
from collections import OrderedDict


def compute_iou(box1, box2):
    """
    Compute Intersection over Union (IoU) between two bounding boxes [x1, y1, x2, y2].
    """
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_w = max(0.0, x2 - x1)
    inter_h = max(0.0, y2 - y1)
    intersection = inter_w * inter_h

    area1 = max(0.0, (box1[2] - box1[0])) * max(0.0, (box1[3] - box1[1]))
    area2 = max(0.0, (box2[2] - box2[0])) * max(0.0, (box2[3] - box2[1]))
    union = area1 + area2 - intersection

    if union <= 0.0:
        return 0.0
    return intersection / union


class TrackedVehicle:
    """Represents a single tracked vehicle instance."""
    def __init__(self, track_id, bbox, class_name, confidence):
        self.track_id = track_id
        self.bbox = list(bbox)
        self.class_name = class_name
        self.confidence = confidence
        self.centroid = self._calc_centroid(bbox)
        self.disappeared = 0
        self.history = [self.centroid]
        self.previous_centroid = None

    @staticmethod
    def _calc_centroid(bbox):
        return (
            int((bbox[0] + bbox[2]) / 2.0),
            int((bbox[1] + bbox[3]) / 2.0)
        )

    def update(self, bbox, class_name, confidence):
        self.previous_centroid = self.centroid
        self.bbox = list(bbox)
        self.centroid = self._calc_centroid(bbox)
        self.class_name = class_name
        self.confidence = confidence
        self.disappeared = 0
        self.history.append(self.centroid)
        if len(self.history) > 30:
            self.history.pop(0)


class ByteTracker:
    """
    ByteTrack implementation for intelligent vehicle tracking and traffic density analysis.
    """
    def __init__(self, high_thresh=0.45, low_thresh=0.15, match_thresh=0.3, max_disappeared=30, max_distance=80):
        self.high_thresh = high_thresh
        self.low_thresh = low_thresh
        self.match_thresh = match_thresh
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

        self.next_object_id = 0
        self.tracks = OrderedDict()                   # track_id -> TrackedVehicle
        self.all_registered_classes = OrderedDict()   # track_id -> class_name (audit history)

    def update(self, detections):
        """
        Process a list of detections for the current frame using the ByteTrack 2-stage association.

        Parameters
        ----------
        detections : list[dict]
            Each dict has keys: 'bbox' [x1, y1, x2, y2], 'class_name', 'confidence'.

        Returns
        -------
        tuple (tracked_objects, displacements)
            tracked_objects : dict {track_id: (cx, cy)}
            displacements : dict {track_id: displacement_pixels}
        """
        if not detections:
            # Increment disappeared for all tracks
            to_remove = []
            for tid, track in self.tracks.items():
                track.disappeared += 1
                if track.disappeared > self.max_disappeared:
                    to_remove.append(tid)
            for tid in to_remove:
                del self.tracks[tid]
            return {tid: t.centroid for tid, t in self.tracks.items()}, {}

        # 1. Partition detections into high and low confidence pools
        high_dets = []
        low_dets = []
        for d in detections:
            conf = d.get("confidence", 1.0)
            if conf >= self.high_thresh:
                high_dets.append(d)
            elif conf >= self.low_thresh:
                low_dets.append(d)

        active_track_ids = list(self.tracks.keys())
        active_tracks = [self.tracks[tid] for tid in active_track_ids]

        # 2. First Association: Match active tracks with high-confidence detections
        matched_tracks_1, unmatched_tracks_1, unmatched_high_dets = self._associate(
            active_tracks, high_dets, iou_threshold=self.match_thresh
        )

        # Update matched tracks
        for t_idx, d_idx in matched_tracks_1:
            track = active_tracks[t_idx]
            det = high_dets[d_idx]
            track.update(det["bbox"], det["class_name"], det["confidence"])

        # 3. Second Association: Match remaining active tracks with low-confidence detections
        remaining_tracks = [active_tracks[i] for i in unmatched_tracks_1]
        matched_tracks_2, unmatched_tracks_2, _ = self._associate(
            remaining_tracks, low_dets, iou_threshold=0.2
        )

        for t_idx, d_idx in matched_tracks_2:
            track = remaining_tracks[t_idx]
            det = low_dets[d_idx]
            track.update(det["bbox"], det["class_name"], det["confidence"])

        # 4. Handle unmatched tracks (increment disappearance)
        for t_idx in unmatched_tracks_2:
            track = remaining_tracks[t_idx]
            track.disappeared += 1

        # Remove dead tracks
        to_remove = [tid for tid, track in self.tracks.items() if track.disappeared > self.max_disappeared]
        for tid in to_remove:
            del self.tracks[tid]

        # 5. Spawn new tracks from unmatched high-confidence detections
        for d_idx in unmatched_high_dets:
            det = high_dets[d_idx]
            tid = self.next_object_id
            self.next_object_id += 1
            new_track = TrackedVehicle(tid, det["bbox"], det["class_name"], det["confidence"])
            self.tracks[tid] = new_track
            self.all_registered_classes[tid] = det["class_name"]

        # Compute output centroids and displacement vectors
        tracked_objects = {}
        displacements = {}
        for tid, track in self.tracks.items():
            tracked_objects[tid] = track.centroid
            if track.previous_centroid is not None:
                p1 = track.previous_centroid
                p2 = track.centroid
                disp = math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
                displacements[tid] = disp

        return tracked_objects, displacements

    def _associate(self, tracks, detections, iou_threshold=0.3):
        """
        Greedy IoU bipartite association between tracks and detections.
        Falls back to centroid proximity if IoU is 0 but distance is close.
        """
        if not tracks or not detections:
            return [], list(range(len(tracks))), list(range(len(detections)))

        # Build cost/similarity matrix
        matrix = []
        for t in tracks:
            row = []
            for d in detections:
                iou = compute_iou(t.bbox, d["bbox"])
                # Centroid proximity backup
                c_dist = math.sqrt((t.centroid[0] - (d["bbox"][0]+d["bbox"][2])/2.0)**2 +
                                   (t.centroid[1] - (d["bbox"][1]+d["bbox"][3])/2.0)**2)
                if iou == 0.0 and c_dist < self.max_distance:
                    # Provide an artificial similarity for close centroids
                    iou = max(0.05, 1.0 - (c_dist / self.max_distance))
                row.append(iou)
            matrix.append(row)

        matched_tracks = []
        matched_dets = set()
        unmatched_tracks = set(range(len(tracks)))

        # Greedy match highest IoUs first
        matches_flat = []
        for r in range(len(tracks)):
            for c in range(len(detections)):
                matches_flat.append((matrix[r][c], r, c))
        matches_flat.sort(key=lambda x: x[0], reverse=True)

        used_r = set()
        used_c = set()
        for score, r, c in matches_flat:
            if r in used_r or c in used_c:
                continue
            if score < iou_threshold:
                break
            matched_tracks.append((r, c))
            used_r.add(r)
            used_c.add(c)
            unmatched_tracks.discard(r)

        unmatched_dets = [c for c in range(len(detections)) if c not in used_c]
        return matched_tracks, list(unmatched_tracks), unmatched_dets

    def get_unique_vehicle_count(self):
        """Total number of unique vehicle IDs assigned across the entire session."""
        return self.next_object_id

    def get_all_unique_class_counts(self):
        """Total unique vehicles recorded per class."""
        counts = {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0}
        for class_name in self.all_registered_classes.values():
            if class_name in counts:
                counts[class_name] += 1
            elif class_name != "unknown":
                counts[class_name] = counts.get(class_name, 0) + 1
        return counts

    def get_class_counts(self):
        """Class counts among currently active tracks."""
        counts = {}
        for track in self.tracks.values():
            counts[track.class_name] = counts.get(track.class_name, 0) + 1
        return counts

    def reset(self):
        """Reset the tracker."""
        self.next_object_id = 0
        self.tracks.clear()
        self.all_registered_classes.clear()


# Backward-compatible alias
CentroidTracker = ByteTracker
