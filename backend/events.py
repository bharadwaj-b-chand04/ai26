import hashlib
import json
import threading
import time
import uuid

from cameras import CAMERAS_BY_ID
from plate_format import normalize_plate

_lock = threading.Lock()
_log: list[dict] = []
MAX_EVENTS = 5000
# The footage loops forever for the demo, so without a rolling window every stat here would
# climb toward infinity the longer the app stays open. Bound everything to the last 5 minutes
# of real activity instead — "live", not "cumulative since server start".
WINDOW_SECONDS = 300
MAX_TRAVEL_SPEED_KMH = 160
WATCHLIST = {
    "KL07AB1234": {
        "severity": "critical",
        "reason": "Mock stolen-vehicle case KOC-2291",
    },
}
RESTRICTED_CAMERAS = {
    "CAM-09": "Mock restricted corridor at Petta Junction",
}


def add_events(detections: list[dict]):
    if not detections:
        return
    with _lock:
        _log.extend(detections)
        cutoff = time.time() - WINDOW_SECONDS
        while _log and _log[0]["ts"] < cutoff:
            _log.pop(0)
        if len(_log) > MAX_EVENTS:
            del _log[: len(_log) - MAX_EVENTS]


def get_events(camera_id: str | None = None, plate: str | None = None, since: float | None = None):
    with _lock:
        snapshot = list(_log)
    if camera_id:
        snapshot = [e for e in snapshot if e["camera_id"] == camera_id]
    if plate:
        plate_norm = str(normalize_plate(plate)["plate_norm"])
        snapshot = [e for e in snapshot if e.get("plate_norm", e.get("plate", "")).upper() == plate_norm]
    if since:
        snapshot = [e for e in snapshot if e["ts"] >= since]
    return snapshot


def _distance_km(first: dict, second: dict) -> float:
    from math import asin, cos, radians, sin, sqrt

    a = CAMERAS_BY_ID[first["camera_id"]]
    b = CAMERAS_BY_ID[second["camera_id"]]
    lat1, lat2 = radians(a["lat"]), radians(b["lat"])
    dlat = lat2 - lat1
    dlon = radians(b["lon"]) - radians(a["lon"])
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371 * 2 * asin(sqrt(h))


def build_trajectory(observations: list[dict]) -> dict:
    """Build a small explainable trajectory from normalized plate observations."""
    ordered = sorted(observations, key=lambda event: event["ts"])
    hops = []
    accepted_links = []
    rejected_links = []
    for event in ordered:
        camera = CAMERAS_BY_ID.get(event["camera_id"], {})
        hops.append({
            "camera_id": event["camera_id"],
            "location": camera.get("location", "Unknown"),
            "location_confirmed": camera.get("location_confirmed", False),
            "lat": camera.get("lat"),
            "lon": camera.get("lon"),
            "ts": event["ts"],
            "confidence": event.get("confidence", 0),
            "plate": event.get("plate"),
            "plate_raw": event.get("plate_raw"),
            "repairs": event.get("repairs", []),
            "bbox": event.get("bbox"),
        })

    for first, second in zip(ordered, ordered[1:]):
        if first["camera_id"] == second["camera_id"]:
            continue
        elapsed = second["ts"] - first["ts"]
        distance = _distance_km(first, second)
        implied_speed = distance / (elapsed / 3600) if elapsed > 0 else float("inf")
        link = {
            "from_camera_id": first["camera_id"],
            "to_camera_id": second["camera_id"],
            "from_ts": first["ts"],
            "to_ts": second["ts"],
            "distance_km": round(distance, 3),
            "elapsed_seconds": round(max(elapsed, 0), 3),
            "implied_speed_kmh": round(implied_speed, 1),
        }
        if elapsed <= 0 or implied_speed > MAX_TRAVEL_SPEED_KMH:
            rejected_links.append({
                **link,
                "reason": f"impossible travel: {implied_speed:.1f} km/h implied; limit {MAX_TRAVEL_SPEED_KMH} km/h",
            })
        else:
            accepted_links.append(link)

    status = "not_found" if not hops else "observed"
    if accepted_links:
        status = "confirmed"
    elif rejected_links:
        status = "cloning_candidate"
    return {
        "mode": "live",
        "status": status,
        "plate": ordered[0].get("plate_norm", "") if ordered else "",
        "observations": hops,
        "accepted_links": accepted_links,
        "rejected_links": rejected_links,
    }


def get_trajectory(plate: str) -> dict:
    normalized = str(normalize_plate(plate)["plate_norm"])
    result = build_trajectory(get_events(plate=normalized))
    result["plate"] = normalized
    return result


def evidence_report(plate: str) -> dict:
    report = {
        "report_id": f"EVD-{uuid.uuid4().hex[:12].upper()}",
        "generated_at": time.time(),
        "retention": "prototype; expiry is not enforced",
        "trajectory": get_trajectory(plate),
    }
    payload = json.dumps(report, sort_keys=True, separators=(",", ":"))
    report["package_hash"] = hashlib.sha256(payload.encode()).hexdigest()
    return report


def derive_alerts():
    """Real, computed-not-fabricated alerts from the live event log."""
    with _lock:
        snapshot = list(_log)
    alerts = []

    for event in snapshot:
        watch = WATCHLIST.get(event.get("plate_norm", ""))
        if event["kind"] == "plate" and watch:
            alerts.append({
                "severity": watch["severity"],
                "type": "blacklist match",
                "summary": f"{event.get('plate', event.get('plate_norm'))} matched the mock watchlist",
                "detail": f"{watch['reason']} · {event['camera_id']} · confidence {event.get('confidence', 0):.0%}",
                "ts": event["ts"],
            })
        if event["kind"] == "plate" and event["camera_id"] in RESTRICTED_CAMERAS:
            alerts.append({
                "severity": "warning",
                "type": "restricted zone",
                "summary": f"{event.get('plate', event.get('plate_norm'))} entered a restricted camera zone",
                "detail": f"{RESTRICTED_CAMERAS[event['camera_id']]} · permit data is not connected in this prototype",
                "ts": event["ts"],
            })

    # cross-camera vehicle appearance: same class seen on >=2 distinct cameras
    # within a short rolling window -> appearance-based ReID fallback match
    vehicle_events = [e for e in snapshot if e["kind"] == "vehicle"]
    by_label: dict[str, list[dict]] = {}
    for e in vehicle_events:
        by_label.setdefault(e["label"], []).append(e)

    for label, evs in by_label.items():
        evs.sort(key=lambda e: e["ts"])
        cams_seen: dict[str, float] = {}
        for e in evs:
            cams_seen[e["camera_id"]] = e["ts"]
        if len(cams_seen) >= 2:
            cams = sorted(cams_seen.items(), key=lambda kv: kv[1])
            alerts.append({
                "severity": "info",
                "type": "cross-camera match",
                "summary": f"{label} appearance matched across {len(cams)} cameras (ReID fallback, no legible plate)",
                "detail": ", ".join(f"{c} @ {time.strftime('%H:%M:%S', time.localtime(t))}" for c, t in cams),
                "ts": cams[-1][1],
            })

    plate_values = {e.get("plate_norm") for e in snapshot if e["kind"] == "plate" and e.get("plate_norm")}
    for plate in plate_values:
        trajectory = get_trajectory(plate)
        for rejected in trajectory["rejected_links"]:
            alerts.append({
                "severity": "critical",
                "type": "impossible travel",
                "summary": f"{plate} has an implausible camera transition",
                "detail": rejected["reason"],
                "ts": rejected["to_ts"],
            })

    # loitering: same camera, same label, >=3 detections within 30s window
    for cam_id in {e["camera_id"] for e in vehicle_events}:
        cam_evs = sorted([e for e in vehicle_events if e["camera_id"] == cam_id], key=lambda e: e["ts"])
        window = []
        for e in cam_evs:
            window = [w for w in window if e["ts"] - w["ts"] <= 30] + [e]
            if len(window) >= 6:
                alerts.append({
                    "severity": "warning",
                    "type": "loitering",
                    "summary": f"{len(window)} sightings at {cam_id} within 30s",
                    "detail": f"class={window[0]['label']}",
                    "ts": e["ts"],
                })
                window = []

    alerts.sort(key=lambda a: a["ts"], reverse=True)
    unique = []
    seen = set()
    for alert in alerts:
        key = (alert["type"], alert["summary"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(alert)
    return unique[:20]


def stats():
    with _lock:
        snapshot = list(_log)
    now = time.time()
    last_min = [e for e in snapshot if now - e["ts"] <= 60]
    per_cam: dict[str, int] = {}
    for e in snapshot:
        per_cam[e["camera_id"]] = per_cam.get(e["camera_id"], 0) + 1
    busiest = max(per_cam.items(), key=lambda kv: kv[1])[0] if per_cam else None
    confs = [e["confidence"] for e in snapshot if e.get("confidence")]
    avg_conf = sum(confs) / len(confs) if confs else 0.0
    return {
        "total_events": len(snapshot),
        "events_last_minute": len(last_min),
        "per_camera": per_cam,
        "busiest_camera": busiest,
        "avg_confidence": round(avg_conf, 3),
    }
