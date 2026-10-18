"""Audit private frame-review exports and measure exploratory per-frame count error.

This runner never ingests observations, changes human labels, or promotes a model.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
CLASSES = {"car", "bus", "truck", "motorcycle", "bicycle"}
SHA256 = re.compile(r"[a-f0-9]{64}")


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def load_json(path: Path, limit: int = 2 * 1024 * 1024):
    raw = path.read_bytes()
    if len(raw) > limit:
        raise ValueError("Review file exceeds the bounded 2 MiB size limit.")
    return json.loads(raw), raw


def validate_box(box: dict, sample: dict, kind: str):
    if not isinstance(box, dict):
        raise ValueError("Box must be an object.")
    coords = box.get("bbox")
    if (not isinstance(coords, list) or len(coords) != 4
            or any(type(v) not in (int, float) or not math.isfinite(v) for v in coords)
            or not 0 <= coords[0] < coords[2] <= sample["width"]
            or not 0 <= coords[1] < coords[3] <= sample["height"]):
        raise ValueError("Box coordinates must be finite and inside the reviewed image.")
    if kind == "vehicles" and box.get("class") not in CLASSES:
        raise ValueError("Vehicle box has an unsupported class.")
    if kind == "plates" and (box.get("readability") not in {"pending", "readable", "uncertain", "unreadable"}
                             or not isinstance(box.get("text"), str) or len(box["text"]) > 64):
        raise ValueError("Plate box has invalid readability or text.")


def validate_and_audit(manifest: dict, labels: dict) -> tuple[dict, list[dict]]:
    if (not isinstance(manifest, dict) or type(manifest.get("schema_version")) is not int
            or manifest["schema_version"] != 1 or not isinstance(manifest.get("samples"), list)
            or not 1 <= len(manifest["samples"]) <= 1000):
        raise ValueError("Unsupported or empty review manifest.")
    if not isinstance(manifest.get("review_set_id"), str) or not SHA256.fullmatch(manifest["review_set_id"]):
        raise ValueError("Manifest needs a SHA-256 review-set identity.")
    if (not isinstance(labels, dict) or type(labels.get("schema_version")) is not int
            or labels["schema_version"] != 1 or labels.get("review_set_id") != manifest["review_set_id"]):
        raise ValueError("Labels belong to a different review set.")
    annotations = labels.get("annotations")
    samples = manifest["samples"]
    ids = [s.get("sample_id") for s in samples if isinstance(s, dict)]
    if (len(ids) != len(samples) or any(not isinstance(s, str) or not s for s in ids)
            or len(set(ids)) != len(ids) or not isinstance(annotations, dict) or set(annotations) != set(ids)):
        raise ValueError("Manifest and label sample identities must match exactly without duplicates.")
    audit = {"review_set_id": manifest["review_set_id"], "frames": len(samples),
             "status_counts": {}, "count_conflicts": [], "pending_sample_ids": [],
             "pending_draft_sample_ids": [], "eligible_count_sample_ids": [],
             "complete_vehicle_box_frames": 0, "readable_plates_on_eligible_frames": 0,
             "detector_precision_recall": None, "ocr_exact_match_rate": None}
    status_counts, eligible = Counter(), []
    for sample in samples:
        if (any(type(sample.get(k)) is not int or sample[k] <= 0 for k in ("width", "height"))
                or not isinstance(sample.get("camera_id"), str)
                or not re.fullmatch(r"CAM-[0-9]{2}", sample["camera_id"])):
            raise ValueError("Manifest sample has invalid dimensions or camera identity.")
        row = annotations[sample["sample_id"]]
        if not isinstance(row, dict) or row.get("status") not in {"pending", "reviewed", "unusable"}:
            raise ValueError("Invalid human-review status.")
        count = row.get("vehicle_count")
        if count is not None and (type(count) is not int or not 0 <= count <= 1000):
            raise ValueError("Human count must be an integer from 0 to 1,000 or null for a pending frame.")
        if (type(row.get("vehicle_boxes_complete")) is not bool
                or not isinstance(row.get("notes"), str) or len(row["notes"]) > 2000):
            raise ValueError("Invalid review completeness or notes.")
        for kind in ("vehicles", "plates"):
            if not isinstance(row.get(kind), list) or len(row[kind]) > 1000:
                raise ValueError("Invalid bounded annotation list.")
            for box in row[kind]:
                validate_box(box, sample, kind)
        if row["status"] != "pending":
            if not isinstance(row.get("reviewed_by"), str) or not row["reviewed_by"].strip():
                raise ValueError("Completed labels need their recorded reviewer.")
            try:
                reviewed_at = datetime.fromisoformat(row["reviewed_at"])
                if reviewed_at.tzinfo is None:
                    raise ValueError("Review time must include a timezone.")
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError("Completed labels need a valid review timestamp.") from error
        if row["status"] == "reviewed" and count is None:
            raise ValueError("Reviewed frame is missing its vehicle count.")
        if row["status"] == "unusable" and not row["notes"].strip():
            raise ValueError("Unusable frame needs a reason.")
        if row["status"] == "reviewed" and any(p["readability"] == "pending" or
                (p["readability"] == "readable" and not re.search(r"[a-z0-9]", p["text"], re.I)) for p in row["plates"]):
            raise ValueError("Reviewed frame has unfinished plate labels.")
        status_counts[row["status"]] += 1
        too_many_boxes = count is not None and len(row["vehicles"]) > count
        incomplete_claim = row["vehicle_boxes_complete"] and count != len(row["vehicles"])
        bicycle_label = any(b["class"] == "bicycle" for b in row["vehicles"])
        conflict = too_many_boxes or incomplete_claim or bicycle_label
        if conflict:
            audit["count_conflicts"].append({"sample_id": sample["sample_id"], "status": row["status"],
                "vehicle_count": count, "drawn_vehicle_boxes": len(row["vehicles"]),
                "reason": "bicycle_outside_runtime_count_scope" if bicycle_label else
                          "boxes_exceed_count" if too_many_boxes else "complete_box_count_mismatch"})
        if row["status"] == "pending":
            audit["pending_sample_ids"].append(sample["sample_id"])
            if count is not None or row["vehicles"] or row["plates"] or row["notes"]:
                audit["pending_draft_sample_ids"].append(sample["sample_id"])
        if row["status"] != "reviewed" or conflict:
            continue
        eligible.append(sample)
        audit["eligible_count_sample_ids"].append(sample["sample_id"])
        audit["complete_vehicle_box_frames"] += row["vehicle_boxes_complete"]
        audit["readable_plates_on_eligible_frames"] += sum(p["readability"] == "readable" for p in row["plates"])
    audit["status_counts"] = dict(status_counts)
    audit["reviewed_count_conflicts"] = sum(r["status"] == "reviewed" for r in audit["count_conflicts"])
    audit["eligible_count_frames"] = len(eligible)
    return audit, eligible


def image_bytes(root: Path, sample: dict) -> bytes:
    name, expected = sample.get("image"), sample.get("image_sha256")
    if not isinstance(name, str) or not isinstance(expected, str) or not SHA256.fullmatch(expected):
        raise ValueError("Sample needs its exact review-image path and digest.")
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError("Review image is missing or escapes the review directory.")
    if path.stat().st_size > 32 * 1024 * 1024:
        raise ValueError("Review image exceeds the bounded 32 MiB limit.")
    raw = path.read_bytes()
    if sha256(raw) != expected:
        raise ValueError("Review-image hash differs from the annotated manifest.")
    return raw


def count_metrics(records: list[dict]) -> dict:
    if not records:
        return {"evaluated_frames": 0, "mean_absolute_error": None, "root_mean_squared_error": None,
                "mean_signed_error": None, "exact_count_frames": 0, "exact_frame_count_agreement": None}
    for row in records:
        if any(type(row.get(k)) is not int or row[k] < 0 for k in ("expected_count", "predicted_count")):
            raise ValueError("Count metrics require nonnegative integer counts.")
    errors = [r["predicted_count"] - r["expected_count"] for r in records]
    return {"evaluated_frames": len(records), "mean_absolute_error": sum(abs(e) for e in errors) / len(errors),
            "root_mean_squared_error": math.sqrt(sum(e * e for e in errors) / len(errors)),
            "mean_signed_error": sum(errors) / len(errors), "exact_count_frames": errors.count(0),
            "exact_frame_count_agreement": errors.count(0) / len(errors),
            "summed_human_frame_counts": sum(r["expected_count"] for r in records),
            "summed_predicted_frame_counts": sum(r["predicted_count"] for r in records)}


def run(manifest_path: Path, labels_path: Path, output: Path, expected_model_sha256: str | None = None) -> dict:
    if output.exists():
        raise ValueError("Output already exists; choose a new directory to preserve the prior run.")
    manifest, manifest_raw = load_json(manifest_path)
    labels, labels_raw = load_json(labels_path)
    audit, eligible = validate_and_audit(manifest, labels)
    # Verify every visible review image, including excluded rows, before publication.
    for sample in manifest["samples"]:
        image_bytes(manifest_path.parent, sample)
    output.mkdir(parents=True)
    (output / "labels.json").write_bytes(labels_raw)
    (output / "manifest.json").write_bytes(manifest_raw)
    (output / "audit.json").write_text(json.dumps(audit, indent=2) + "\n")
    report = {"schema_version": 1, "created_at": datetime.now(timezone.utc).isoformat(),
              "labels_sha256": sha256(labels_raw), "manifest_sha256": sha256(manifest_raw), "audit": audit,
              "count_metrics": None, "per_camera": {}, "model": None,
              "scope": "Exploratory per-frame count comparison on reviewed JPEG derivatives. Not held-out accuracy, tracking, passages, unique vehicles or operational performance.",
              "limitations": ["Only reviewed frames without contradictory counts/boxes are included.",
                  "Partial box sets are not promoted into complete detector ground truth.",
                  "The original review guide included bicycles; runtime YOLO counts car, bus, truck and motorcycle only. Review this class scope before treating results as definitive.",
                  "No bicycle boxes were supplied on eligible frames; unlabeled bicycles cannot be independently ruled out.",
                  "Source clips were previously inspected; repeated vehicles and correlated frames are possible.",
                  "Six sources are playback copies. Inference here uses the exact hashed JPEG derivatives shown during review.",
                  "Model outputs are not written into the app database or human labels."]}
    records = []
    if expected_model_sha256 is not None:
        if not SHA256.fullmatch(expected_model_sha256):
            raise ValueError("Expected model digest must be a lowercase SHA-256.")
        sys.path.insert(0, str(ROOT / "backend"))
        import cv2
        import numpy as np
        import inference
        for sample in eligible:
            image = cv2.imdecode(np.frombuffer(image_bytes(manifest_path.parent, sample), dtype=np.uint8), cv2.IMREAD_COLOR)
            if image is None or image.shape[:2] != (sample["height"], sample["width"]):
                raise ValueError("Review-image dimensions differ from the manifest.")
            model = inference._vehicle_model(sample["camera_id"])
            metadata = dict(inference._model_metadata)
            if metadata["checkpoint_sha256"] != expected_model_sha256:
                raise ValueError("Loaded vehicle checkpoint differs from the selected baseline.")
            started = time.perf_counter()
            predictions = model.predict(image, device=inference.DEVICE, verbose=False,
                                        classes=sorted(inference.VEHICLE_CLASS_IDS), conf=.4)[0]
            if inference.DEVICE == "cpu":
                inference.torch.set_num_threads(inference.CPU_THREADS)
            boxes = [{"class": model.names[int(b.cls[0])], "confidence": float(b.conf[0]),
                      "bbox": [float(v) for v in b.xyxy[0]]} for b in predictions.boxes]
            records.append({"sample_id": sample["sample_id"], "camera_id": sample["camera_id"],
                            "image_sha256": sample["image_sha256"],
                            "expected_count": labels["annotations"][sample["sample_id"]]["vehicle_count"],
                            "predicted_count": len(boxes), "predicted_boxes": boxes,
                            "elapsed_ms": (time.perf_counter() - started) * 1000})
            report["model"] = {"checkpoint_sha256": expected_model_sha256, "checkpoint_name": metadata["checkpoint_name"],
                               "confidence_threshold": .4, "class_ids": sorted(inference.VEHICLE_CLASS_IDS),
                               "device": inference.DEVICE, "cpu_threads": inference.CPU_THREADS,
                               "pipeline_sha256": metadata["pipeline_sha256"],
                               "ultralytics_version": metadata["ultralytics_version"]}
            print(f"Evaluated {sample['sample_id']}", flush=True)
        report["count_metrics"] = count_metrics(records)
        by_camera = defaultdict(list)
        for row in records:
            by_camera[row["camera_id"]].append(row)
        report["per_camera"] = {camera: count_metrics(rows) for camera, rows in by_camera.items()}
        report["prediction_records_sha256"] = sha256((json.dumps(records, sort_keys=True) + "\n").encode())
        (output / "predictions.json").write_text(json.dumps(records, sort_keys=True) + "\n")
    (output / "summary.json").write_text(json.dumps(report, indent=2) + "\n")
    lines = ["# Preliminary frame-count evaluation", "", report["scope"], "",
             f"Saved as reviewed: {audit['status_counts'].get('reviewed', 0)}. Pending: {audit['status_counts'].get('pending', 0)}.",
             f"Count-consistent reviewed frames eligible: {len(eligible)}. Reviewed frames needing count correction: {audit['reviewed_count_conflicts']}.", ""]
    if records:
        metrics = report["count_metrics"]
        lines += [f"Mean absolute count error: **{metrics['mean_absolute_error']:.3f} vehicles per frame**.",
                  f"Exact count agreement: **{metrics['exact_count_frames']}/{len(records)} reviewed frames**.", "",
                  "| Frame | Human count | Model count | Model minus human |", "| --- | ---: | ---: | ---: |"]
        lines += [f"| {r['sample_id']} | {r['expected_count']} | {r['predicted_count']} | {r['predicted_count'] - r['expected_count']:+d} |" for r in records]
    lines += ["", "## Count entries needing human review", "", "| Frame | Status | Entered count | Drawn boxes |",
              "| --- | --- | ---: | ---: |"]
    lines += [f"| {r['sample_id']} | {r['status']} | {r['vehicle_count']} | {r['drawn_vehicle_boxes']} |" for r in audit["count_conflicts"]]
    lines += ["", "## Limits", ""] + ["- " + text for text in report["limitations"]]
    lines += ["- Detector precision/recall and OCR accuracy were not computed by this count-only run.", ""]
    (output / "results.md").write_text("\n".join(lines))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--expected-model-sha256", help="Omit for audit only; provide to run the pinned YOLO baseline.")
    args = parser.parse_args()
    if not args.output.resolve().is_relative_to(ROOT / "backend/data/review"):
        parser.error("Keep outputs beneath backend/data/review; snapshots contain private human labels.")
    report = run(args.manifest.resolve(), args.labels.resolve(), args.output.resolve(), args.expected_model_sha256)
    print(json.dumps({"audit": report["audit"], "count_metrics": report["count_metrics"]}, indent=2))


if __name__ == "__main__":
    main()
