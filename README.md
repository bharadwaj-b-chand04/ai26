# AI26 — Multi-camera vehicle analytics

AI course project for vehicle detection, number-plate recognition, cross-camera
trajectory reconstruction, and traffic analysis. The application accepts recorded
camera footage and runs inference on the focused camera.

## Features

- YOLO vehicle detection with per-camera centroid tracking and motion trails.
- Fast-ALPR plate OCR, Indian plate-format normalization, and short-window OCR voting.
- Camera wall, OpenStreetMap view, and congestion/analytics panels.
- Plate trajectories with travel-speed checks and rejected-hop explanations.
- Mock watchlist/restricted-zone rules, alerts, and JSON evidence reports with hashes.
- Rule-based natural-language questions over the detection log.
- A separate static walkthrough with synthetic data in `demo/`.

## Start

Install Python 3.12+, Node.js 22.12+ and npm, and `uv`, then run:

```bash
uv run run.py
```

This installs the locked dependencies and starts the app at
**http://localhost:5174**, with the API at **http://127.0.0.1:8001**.
The first inference request may download the Fast-ALPR models. See [RUN.md](RUN.md)
for footage configuration, separate-process startup, and troubleshooting.

## Structure

| Path | Purpose |
| --- | --- |
| `backend/` | FastAPI endpoints, inference, tracking, plate normalization, event log |
| `frontend/` | React/TypeScript application |
| `demo/` | Standalone synthetic HTML/CSS/JS walkthrough |
| `docs/IMPLEMENTATION.md` | Architecture and current implementation limits |
| `docs/IMPORT.md` | Import provenance and separation from the SIH project |
| `tests/` | Backend regression checks for the imported functionality |

## Current limits

This is a prototype. Events are stored in memory, with a five-minute rolling window
applied when detections arrive. Refreshing the UI does not persist evidence to a
database; restarting the backend clears events. Only the focused camera produces
inference events. Six vehicle playback clips are included; three plate-camera
clips must be supplied locally. Plates are normalized against format rules; no
live government registry is connected. Class-based cross-camera alerts do not
establish vehicle identity, and the query feature is a keyword matcher, not an LLM.
Walkthrough data is explicitly labeled synthetic. See the implementation document
for the scope of evidence hashing and trajectory checks.

AI26 is maintained as an independent course project. SIH submissions, pitch decks,
competition plans, and SIH branding remain in the original project.
