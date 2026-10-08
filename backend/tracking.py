from collections import deque
from dataclasses import dataclass, field
from math import hypot


@dataclass
class _Track:
    track_id: int
    label: str
    center: tuple[int, int]
    bbox: tuple[int, int, int, int]
    missed: int = 0
    history: deque[tuple[int, int]] = field(default_factory=lambda: deque(maxlen=12))


class CentroidTracker:
    """Small single-camera tracker for readable demo IDs and motion trails."""

    def __init__(self, max_distance: float = 140, max_missing: int = 12):
        self.max_distance = max_distance
        self.max_missing = max_missing
        self._next_id = 1
        self._tracks: list[_Track] = []

    def update(self, detections: list[dict]) -> list[dict]:
        # ponytail: greedy centroid matching; use ByteTrack/DeepSORT if occlusion becomes a demo limit.
        for track in self._tracks:
            track.missed += 1

        candidates = []
        for det_index, detection in enumerate(detections):
            x1, y1, x2, y2 = detection["bbox"]
            center = ((x1 + x2) // 2, (y1 + y2) // 2)
            for track_index, track in enumerate(self._tracks):
                if track.label != detection["label"]:
                    continue
                distance = hypot(center[0] - track.center[0], center[1] - track.center[1])
                candidates.append((distance, det_index, track_index, center))

        matched_detections: set[int] = set()
        matched_tracks: set[int] = set()
        updated: list[dict | None] = [None] * len(detections)
        for distance, det_index, track_index, center in sorted(candidates):
            if det_index in matched_detections or track_index in matched_tracks:
                continue
            x1, y1, x2, y2 = detections[det_index]["bbox"]
            limit = max(self.max_distance, (x2 - x1) * 0.75)
            if distance > limit:
                continue
            track = self._tracks[track_index]
            track.center = center
            track.bbox = (x1, y1, x2, y2)
            track.missed = 0
            track.history.append(center)
            updated[det_index] = {**detections[det_index], "track_id": track.track_id, "track_history": list(track.history)}
            matched_detections.add(det_index)
            matched_tracks.add(track_index)

        for det_index, detection in enumerate(detections):
            if det_index in matched_detections:
                continue
            x1, y1, x2, y2 = detection["bbox"]
            center = ((x1 + x2) // 2, (y1 + y2) // 2)
            track = _Track(self._next_id, detection["label"], center, (x1, y1, x2, y2))
            track.history.append(center)
            self._next_id += 1
            self._tracks.append(track)
            updated[det_index] = {**detection, "track_id": track.track_id, "track_history": list(track.history)}

        self._tracks = [track for track in self._tracks if track.missed <= self.max_missing]
        return [detection for detection in updated if detection is not None]


if __name__ == "__main__":
    tracker = CentroidTracker(max_distance=20)
    first = tracker.update([{"label": "car", "bbox": [0, 0, 20, 20]}])
    second = tracker.update([{"label": "car", "bbox": [4, 0, 24, 20]}])
    assert first[0]["track_id"] == second[0]["track_id"]
