"""Content-addressed raw-frame/crop artifacts with verification and age-based cleanup."""
import hashlib
import os
import re
import time
from pathlib import Path
import cv2

ROOT = Path(os.environ.get('AI26_DATA_ROOT', Path(__file__).parent / 'data')) / 'artifacts'


def save_image(frame, role):
    ok, data = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not ok: return None
    raw = data.tobytes()
    digest = hashlib.sha256(raw).hexdigest()
    ROOT.mkdir(parents=True, exist_ok=True)
    path = ROOT / (digest + '.jpg')
    if not path.exists():
        # One processor writes artifacts; replace makes interrupted writes recoverable.
        temp = path.with_suffix('.tmp')
        temp.write_bytes(raw)
        temp.replace(path)
    else:
        os.utime(path, None)
    return {'sha256': digest, 'role': role, 'media_type': 'image/jpeg', 'size': len(raw), 'url': f'/api/artifacts/{digest}'}


def artifact_bytes(digest):
    if not re.fullmatch(r'[a-f0-9]{64}', digest): return None
    path = ROOT / (digest + '.jpg')
    if not path.is_file() or time.time()-path.stat().st_mtime >= 7*86400: return None
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != digest: raise ValueError('Artifact hash verification failed')
    return data


def cleanup_artifacts(cutoff):
    if ROOT.exists():
        for path in ROOT.glob('*.jpg'):
            if path.stat().st_mtime < cutoff: path.unlink(missing_ok=True)
