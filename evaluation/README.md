# Evaluation inputs

Run from the repository root:

```bash
python evaluation/evaluate.py --records evaluation/example.jsonl --output evaluation/results/fixture.json
```

The included records are **synthetic correctness fixtures**, not model accuracy.
Supply held-out, manually labeled prediction records to measure the real models.
Each line has a unique sample_id and optional expected_plate/predicted_plate,
expected_boxes/predicted_boxes (class label, bbox; optional ground-truth identity
and predicted track_id), expected_link/predicted_link and expected_rule/predicted_rule
Booleans, and independently counted expected_passages/predicted_passages.
Use camera/session fields and chronological source-frame order for tracking.
Plate strings should be canonical; null predicted_plate means abstention.

Keep a dataset manifest with clip hashes, camera/session/vehicle split membership,
source/capture clock metadata, location calibration, readable/unreadable plate labels,
and recording/weather conditions. Never use adjacent frames from the same vehicle
as independent training and test examples. Report denominators, abstentions,
positive/negative pair selection, hardware and inference settings with results.
The runner does not verify split independence or replace manual labeling. Add
held-out conditions, passage fragmentation and balanced rule/link negative cases
before making reliability claims. No detector/OCR benchmark target is claimed met.
