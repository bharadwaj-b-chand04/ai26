"""Exploratory count scoring excludes unconfirmed and contradictory human data."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("evaluate_frame_counts", Path(__file__).resolve().parents[1] / "evaluation/evaluate_frame_counts.py")
review = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review)


def fixture():
    samples = [{"sample_id": f"CAM-01-{index:02d}", "camera_id": "CAM-01", "width": 100, "height": 100}
               for index in range(1, 5)]
    manifest = {"schema_version": 1, "review_set_id": "a" * 64, "samples": samples}
    box = {"class": "car", "bbox": [10, 10, 30, 30]}
    def row(count, boxes, status="reviewed"):
        return {"status": status, "vehicle_count": count, "vehicle_boxes_complete": False,
                "vehicles": copy.deepcopy(boxes), "plates": [], "notes": "",
                "reviewed_by": "Synthetic reviewer", "reviewed_at": "2026-10-18T10:00:00+00:00"}
    labels = {"schema_version": 1, "review_set_id": "a" * 64, "reviewer": "Synthetic reviewer",
              "annotations": {samples[0]["sample_id"]: row(0, []), samples[1]["sample_id"]: row(0, [box]),
                              samples[2]["sample_id"]: row(3, [box], "pending"), samples[3]["sample_id"]: row(2, [box])}}
    return manifest, labels


class FrameCountEvaluation(unittest.TestCase):
    def test_audit_excludes_conflicts_and_pending_without_promoting_box_coverage(self):
        manifest, labels = fixture()
        before = copy.deepcopy(labels)
        audit, selected = review.validate_and_audit(manifest, labels)
        self.assertEqual([s["sample_id"] for s in selected], ["CAM-01-01", "CAM-01-04"])
        self.assertEqual(audit["reviewed_count_conflicts"], 1)
        self.assertEqual(audit["pending_draft_sample_ids"], ["CAM-01-03"])
        self.assertEqual(audit["complete_vehicle_box_frames"], 0)
        self.assertIsNone(audit["detector_precision_recall"])
        self.assertEqual(labels, before)

    def test_metrics_average_frame_errors_instead_of_cancelling_totals(self):
        result = review.count_metrics([{"expected_count": 1, "predicted_count": 3},
                                       {"expected_count": 3, "predicted_count": 1},
                                       {"expected_count": 0, "predicted_count": 0}])
        self.assertAlmostEqual(result["mean_absolute_error"], 4 / 3)
        self.assertEqual(result["mean_signed_error"], 0)
        self.assertEqual(result["exact_count_frames"], 1)
        self.assertEqual(review.count_metrics([])["mean_absolute_error"], None)
        with self.assertRaises(ValueError): review.count_metrics([{"expected_count": True, "predicted_count": 1}])

    def test_mismatched_ids_boolean_counts_and_invalid_boxes_rejected(self):
        for mutation in (lambda m,l: l.update(review_set_id="b"*64),
                         lambda m,l: m["samples"].append(m["samples"][0]),
                         lambda m,l: l["annotations"]["CAM-01-01"].update(vehicle_count=True),
                         lambda m,l: l["annotations"]["CAM-01-02"]["vehicles"][0].update(bbox=[0,0,float("nan"),10]),
                         lambda m,l: l["annotations"]["CAM-01-01"].update(reviewed_at="not a time")):
            manifest, labels = fixture()
            mutation(manifest, labels)
            with self.assertRaises(ValueError): review.validate_and_audit(manifest, labels)

    def test_audit_does_not_expose_plate_text(self):
        manifest, labels = fixture()
        labels["annotations"]["CAM-01-01"]["plates"] = [{"bbox": [1,1,10,5], "readability": "readable", "text": "PRIVATEPLATE"}]
        audit, _ = review.validate_and_audit(manifest, labels)
        self.assertNotIn("PRIVATEPLATE", json.dumps(audit))
        self.assertEqual(audit["readable_plates_on_eligible_frames"], 1)

    def test_image_integrity_and_directory_escape(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "frame.jpg"
            target.write_bytes(b"synthetic image bytes")
            sample = {"image": target.name, "image_sha256": review.sha256(target.read_bytes())}
            self.assertEqual(review.image_bytes(root, sample), target.read_bytes())
            target.write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "hash"): review.image_bytes(root, sample)
            sample["image"] = "../outside.jpg"
            with self.assertRaises(ValueError): review.image_bytes(root, sample)

    def test_audit_only_freezes_input_bytes_without_overwriting_or_inference(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest, labels = fixture()
            for sample in manifest["samples"]:
                sample.update(image="frame.jpg", image_sha256=review.sha256(b"test bytes"))
            (root / "frame.jpg").write_bytes(b"test bytes")
            mp, lp = root / "manifest.json", root / "labels.json"
            mp.write_text(json.dumps(manifest)); lp.write_text(json.dumps(labels))
            before = lp.read_bytes()
            result = review.run(mp, lp, root / "output")
            self.assertIsNone(result["count_metrics"])
            self.assertEqual((root / "output/labels.json").read_bytes(), before)
            self.assertEqual(result["labels_sha256"], hashlib.sha256(before).hexdigest())
            with self.assertRaisesRegex(ValueError, "already exists"): review.run(mp, lp, root / "output")
            self.assertEqual(lp.read_bytes(), before)


if __name__ == "__main__": unittest.main()
