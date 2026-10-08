# AI26 implementation

## Data path

1. `cameras.py` resolves original footage and local playback proxies.
2. `/api/video/{camera_id}` serves MP4s for the camera wall without inference.
3. `/api/stream/{camera_id}` reads and annotates the focused camera. YOLO recognizes
   vehicles; Fast-ALPR reads plates. Models load on the first inference request.
4. `tracking.py` assigns per-camera IDs using greedy centroid matching.
5. `plate_format.py` normalizes Indian registration plates and records OCR repairs.
   `inference.py` uses a recent per-camera vote for the displayed OCR label; raw
   reads and normalized strings remain available in each detection event.
6. `events.py` stores detections under a thread lock and computes statistics,
   trajectory links, alerts, and JSON evidence reports.
7. React fetches the API and displays camera, map, congestion, timeline, alerts,
   analytics, and query views.

## API

| Method | Route | Output |
| --- | --- | --- |
| GET | `/api/cameras` | Configured camera metadata (without filesystem paths) |
| GET | `/api/video/{camera_id}` | Browser playback MP4 |
| GET | `/api/stream/{camera_id}` | Annotated MJPEG stream |
| GET | `/api/snapshot/{camera_id}` | Annotated JPEG or 204 if unavailable |
| GET | `/api/events?camera=…&plate=…` | Filtered detection events |
| GET | `/api/stats` | Counts and mean confidence |
| GET | `/api/alerts` | Computed prototype rule alerts |
| GET | `/api/trajectory/{plate}` | Observations, accepted and rejected links |
| POST | `/api/evidence/{plate}` | JSON report with a SHA-256 package hash |
| POST | `/api/nlquery` | Keyword-based answer for `{"question": "…"}` |

## Boundaries

- Six vehicle clips are included; three plate clips require local configuration.
  Recorded inputs loop. Only an actively requested inference stream/snapshot adds
  detections, so this is not simultaneous inference over nine cameras.
- The five-minute/5,000-event buffer is process-local. Time pruning occurs on new
  detections; records can remain when inference stops. No database or background
  ingestion service is implemented.
- Trajectory links compare consecutive observations using straight-line distance
  and a fixed 160 km/h threshold. They are candidate links, not proof of identity.
- Plate OCR voting is shared per camera, not isolated per vehicle track. Centroid
  tracking is a baseline and can fail under occlusion.
- Cross-camera vehicle alerts compare class labels rather than learned appearance
  embeddings. Loitering rules count detections rather than verified visits.
- Congestion is a prototype visualization over detection activity, not a calibrated
  traffic measurement or learned baseline. Some views include labeled walkthroughs.
- Watchlist and restricted-zone entries are mock configuration. Plate-format
  validation is not registry verification. No VAHAN integration is implemented.
- Query responses come from Python keyword rules. Example SQL is explanatory;
  no SQL engine or LLM executes queries.
- Evidence hashes cover the JSON package. Reports are not digitally signed,
  persistent chain-of-custody packages, or certified legal evidence. Retention
  expiry is not enforced.

## Course development

Evaluate detector precision/recall, plate exact-match accuracy, tracker ID switches,
and trajectory-link precision separately on held-out footage. Report sample counts,
conditions, and failure cases. Database persistence, stronger tracking, and a
validated multi-camera identity model can be developed independently in AI26.
