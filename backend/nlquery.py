import re
import time

from cameras import CAMERAS, CAMERAS_BY_ID
from events import derive_alerts, get_events, stats


def _find_camera(text: str):
    text_low = text.lower()
    for cam in CAMERAS:
        if cam["location"].lower() in text_low or cam["id"].lower() in text_low:
            return cam
    return None


def _find_time(text: str):
    m = re.search(r"(\d{1,2})\s*(am|pm)", text.lower())
    if not m:
        return None
    hour = int(m.group(1)) % 12
    if m.group(2) == "pm":
        hour += 12
    now = time.localtime()
    return time.mktime((now.tm_year, now.tm_mon, now.tm_mday, hour, 0, 0, 0, 0, -1))


def answer(question: str) -> dict:
    q = question.lower()

    if "busiest" in q or "busy" in q:
        s = stats()
        if not s["busiest_camera"]:
            return {"text": "No detections logged yet in this session — cameras just started streaming."}
        cam = CAMERAS_BY_ID.get(s["busiest_camera"])
        name = cam["location"] if cam else s["busiest_camera"]
        return {
            "text": f"{s['busiest_camera']} ({name}) is busiest — {s['per_camera'][s['busiest_camera']]} detections this session, {s['events_last_minute']} in the last minute.",
            "sql": "SELECT camera_id, count(*) FROM detections GROUP BY camera_id ORDER BY 2 DESC LIMIT 1;",
        }

    if "violation" in q or "restricted" in q or "alert" in q or "anomal" in q:
        alerts = [a for a in derive_alerts() if a["severity"] != "info"]
        if not alerts:
            return {
                "text": "No rule violations in this session's data yet (impossible-travel, restricted-zone, loitering rules are live and evaluated continuously).",
                "sql": "SELECT * FROM alerts WHERE severity IN ('warning','critical');",
            }
        lines = "; ".join(f"{a['type']} — {a['summary']}" for a in alerts[:5])
        return {"text": f"{len(alerts)} rule violation(s): {lines}", "sql": "SELECT * FROM alerts WHERE severity IN ('warning','critical') ORDER BY ts DESC;"}

    cam = _find_camera(q)
    since = _find_time(q)
    if cam or "plate" in q or "crossed" in q:
        evs = get_events(camera_id=cam["id"] if cam else None, since=since)
        plate_evs = [e for e in evs if e["kind"] == "plate"]
        if not plate_evs:
            where = f" at {cam["location"]}" if cam else ""
            return {"text": f"No plate reads{where} matching that filter yet in this session's live data."}
        plates = sorted({e["plate"] for e in plate_evs})
        where = f" at {cam["location"]}" if cam else ""
        return {
            "text": f"{len(plates)} plate(s) read{where}: {', '.join(plates)}.",
            "sql": "SELECT DISTINCT plate_norm FROM detections WHERE camera_id = %s AND ts > %s;",
        }

    return {"text": "Try asking about a specific camera's plates, violations/alerts, or the busiest camera — this demo answers from the live detection log."}
