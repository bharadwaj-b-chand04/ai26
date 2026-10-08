# Running AI26

## Prerequisites

- Python 3.12+ (`backend/.python-version` selects 3.12 through uv).
- Node.js 22.12+ and npm; uv installed and on PATH.
- Internet for dependency installation, first-use ALPR model downloads, map tiles,
  and fonts. CPU inference is supported; CUDA is used when available.

## One-command startup

```bash
uv run run.py
```

The launcher installs the locked backend/frontend dependencies and runs both
processes. Open http://localhost:5174. Ctrl+C stops both processes.

## Optional configuration

Copy `.env.example` to `.env`, edit it, and export it **before** running the launcher.
Neither service loads the root `.env` automatically:

```bash
cp .env.example .env
set -a
. ./.env
set +a
uv run run.py
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI26_BACKEND_PORT` | `8001` | Launcher API port and default frontend proxy target |
| `AI26_FRONTEND_PORT` | `5174` | Frontend port and backend CORS origins |
| `AI26_API_TARGET` | `http://127.0.0.1:8001` | Optional override for the frontend proxy |
| `AI26_FOOTAGE_ROOT` | `backend/data/footage` | Original-footage root used by the camera catalog |

AI26 uses different default ports from the original project's 8000/5173, so both
can run at the same time. Variables are namespaced to AI26.

## Footage

The six included H.264 clips at `backend/static/playback/CAM-01.mp4` through
`CAM-06.mp4` support playback and inference without an external footage directory.
For CAM-07 through CAM-09, provide these files under `AI26_FOOTAGE_ROOT`:

```text
numberplate-vids/clip 4.mp4
numberplate-vids/clip_2_00_25-00_50.mp4
numberplate-vids/clip_2_00_30-01_00.mp4
```

Alternatively place browser-compatible H.264 MP4 files at
`backend/static/playback/CAM-07.mp4`, `CAM-08.mp4`, and `CAM-09.mp4` locally.
These extra clips and original footage are ignored by Git. Original filenames
for the six vehicle cameras are in `backend/cameras.py`; original footage takes
priority for inference, while included H.264 proxies take priority for playback.
Camera labels and coordinates describe the supplied Kochi demo footage. If you
replace footage, update that catalog to match your own camera locations.

An unavailable camera returns HTTP 404 for video/stream instead of looping over a
missing file. The catalog still lists all nine configured cameras. Missing plates
or empty statistics remain empty until inference produces events.

## Separate processes

Backend (default settings):

```bash
cd backend
uv sync --frozen
uv run --frozen uvicorn main:app --host 127.0.0.1 --port 8001
```

Frontend (a second terminal):

```bash
cd frontend
npm ci
npm run dev
```

Check http://127.0.0.1:8001/api/cameras and http://127.0.0.1:8001/docs.
Model initialization is deferred until a stream or snapshot needs inference.

## Checks

```bash
python -m unittest discover -s tests -v
python -m compileall -q backend run.py
cd frontend
npm run lint
npm run build
```

The unit checks exercise backend logic without loading ML models. They do not
measure detector or OCR accuracy. A production frontend host must route `/api`
to the backend; Vite's proxy is for development only.

## Static walkthrough

```bash
python -m http.server 8080 --directory demo
```

Open http://localhost:8080. This version uses synthetic events and simulated
queries. It needs no backend or ML models; its CDN maps/charts require internet.
