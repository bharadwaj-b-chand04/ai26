import time
from pathlib import Path
from collections import Counter, defaultdict, deque

import cv2
import torch
from fast_alpr import ALPR
from ultralytics import YOLO

from plate_format import normalize_plate
from tracking import CentroidTracker

VEHICLE_CLASS_IDS = {2, 3, 5, 7}  # car, motorcycle, bus, truck (COCO)
DEVICE = 0 if torch.cuda.is_available() else "cpu"

# Multi-frame fusion for plate OCR (same idea as the project's documented log-odds pooling,
# simplified to a majority vote): raw single-frame OCR flickers between near-misses of the
# same plate, which reads as broken. Holding a short per-camera history and displaying the
# most-common recent read is real temporal fusion, not fabrication — the raw per-frame read
# still goes into the event log untouched.
PLATE_MIN_CONF = 0.35
_plate_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=8))
_vehicle_trackers: dict[str, CentroidTracker] = defaultdict(CentroidTracker)
_plate_trackers: dict[str, CentroidTracker] = defaultdict(lambda: CentroidTracker(max_distance=90))

_yolo = YOLO(str(Path(__file__).parent / "yolov8n.pt"))
_alpr = ALPR(
    detector_model="yolo-v9-t-384-license-plate-end2end",
    ocr_model="global-plates-mobile-vit-v2-model",
)

ACCENT = (200, 211, 34)  # BGR, matches the detection overlay accent
CRIT = (114, 92, 255)


def annotate_vehicle_frame(frame, camera_id: str):
    """Runs real YOLO vehicle detection, draws boxes, returns (frame, detections)."""
    results = _yolo.predict(frame, device=DEVICE, verbose=False, classes=list(VEHICLE_CLASS_IDS), conf=0.4)
    detections = []
    r = results[0]
    raw_detections = []
    for box in r.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]
        label = _yolo.names[cls_id]
        raw_detections.append({"label": label, "bbox": [x1, y1, x2, y2], "confidence": conf})

    for detection in _vehicle_trackers[camera_id].update(raw_detections):
        label = detection["label"]
        x1, y1, x2, y2 = detection["bbox"]
        conf = detection["confidence"]
        history = detection["track_history"]
        for start, end in zip(history, history[1:]):
            cv2.line(frame, start, end, ACCENT, 2, cv2.LINE_AA)
        cv2.rectangle(frame, (x1, y1), (x2, y2), ACCENT, 2)
        tag = f"#{detection['track_id']} {label} {conf * 100:.0f}%"
        (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 6, y1), ACCENT, -1)
        cv2.putText(frame, tag, (x1 + 3, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (10, 10, 10), 1, cv2.LINE_AA)
        detections.append({
            "camera_id": camera_id,
            "kind": "vehicle",
            "label": label,
            "confidence": round(conf, 3),
            "track_id": detection["track_id"],
            "bbox": [x1, y1, x2, y2],
            "ts": time.time(),
        })
    return frame, detections


def annotate_plate_frame(frame, camera_id: str):
    """Runs real Fast-ALPR plate detection+OCR, draws boxes, returns (frame, detections)."""
    results = _alpr.predict(frame)
    detections = []
    history = _plate_history[camera_id]
    raw_detections = []
    for res in results:
        bb = res.detection.bounding_box
        x1, y1, x2, y2 = int(bb.x1), int(bb.y1), int(bb.x2), int(bb.y2)
        plate_text = res.ocr.text if res.ocr else "?"
        ocr_conf = res.ocr.confidence if res.ocr else 0.0
        if isinstance(ocr_conf, list):
            ocr_conf = sum(ocr_conf) / len(ocr_conf) if ocr_conf else 0.0
        ocr_conf = float(ocr_conf)

        normalized = normalize_plate(plate_text)
        raw_detections.append({
            "label": "plate",
            "bbox": [x1, y1, x2, y2],
            "plate_text": plate_text,
            "ocr_conf": ocr_conf,
            "normalized": normalized,
        })

    for detection in _plate_trackers[camera_id].update(raw_detections):
        x1, y1, x2, y2 = detection["bbox"]
        plate_text = detection["plate_text"]
        ocr_conf = detection["ocr_conf"]
        normalized = detection["normalized"]
        for start, end in zip(detection["track_history"], detection["track_history"][1:]):
            cv2.line(frame, start, end, CRIT, 2, cv2.LINE_AA)
        cv2.rectangle(frame, (x1, y1), (x2, y2), CRIT, 2)
        if ocr_conf < PLATE_MIN_CONF or not normalized["format_valid"]:
            tag = f"PLATE DETECTED #{detection['track_id']} {ocr_conf * 100:.0f}%"
            (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 6, y1), CRIT, -1)
            cv2.putText(frame, tag, (x1 + 3, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
            continue  # show the region, but reject unreliable text from the event log

        plate_norm = str(normalized["plate_norm"])
        history.append(plate_norm)
        fused_text, _ = Counter(history).most_common(1)[0]

        tag = f"PLATE #{detection['track_id']} {fused_text} {ocr_conf * 100:.0f}%"
        (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 6, y1), CRIT, -1)
        cv2.putText(frame, tag, (x1 + 3, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
        detections.append({
            "camera_id": camera_id,
            "kind": "plate",
            "plate": fused_text,
            "plate_norm": plate_norm,
            "plate_raw": plate_text,
            "format_valid": True,
            "repairs": normalized["repairs"],
            "track_id": detection["track_id"],
            "confidence": round(ocr_conf, 3),
            "bbox": [x1, y1, x2, y2],
            "ts": time.time(),
        })
    return frame, detections
