# Student frame review

This local tool prepares a prediction-blind review set for AI26's mini-project
evaluation. It runs independently of the dashboard and inference processor.
It never fills human labels from model output, edits prior plate reviews, or
claims accuracy before annotations and corresponding predictions exist.

## Current set

The first set is stored locally at
`backend/data/review/frame-set-2026-10-18/`. It contains 45 full-size JPEG images:
five evenly spaced frame positions in each of the nine available clips. The
frames are the midpoints of equal-duration strata, chosen without inspecting
predictions. CAM-01–06 use available 960×540 playback fallback files because
their configured originals are absent. CAM-07–09 use the supplied managed
original files. Source roles and dimensions are recorded per clip/frame.

The existing nine initial and twelve follow-up plate crop annotations remain
in their original private files. Their file hashes and aggregate status counts
are referenced in the new manifest; no previous plate text is copied into the
new labels.

## Review in the browser

Serve only the generated review directory on loopback:

```bash
python -m http.server 5176 --bind 127.0.0.1 \
  --directory backend/data/review/frame-set-2026-10-18
```

Open `http://127.0.0.1:5176/` and:

1. Enter your reviewer name.
2. Count visible cars, buses, trucks and motorcycles. Include
   identifiable partial vehicles; exclude people, reflections and vehicles on
   signs. Enter zero explicitly when no vehicle is visible.
3. For count-only review, leave the complete-vehicle-boxes checkbox unchecked.
4. To prepare detector scoring, draw every vehicle box, choose each vehicle's
   class and tick the complete-boxes checkbox. Box count must equal the entered
   vehicle count. Tight boxes should cover the visible vehicle extent. A
   reviewer must resolve ambiguous classes before using them for class-specific
   metrics; do not guess a class just to complete an image.
5. Optionally draw plate regions. Choose readable, uncertain or unreadable for
   each region. Transcribe characters only for a readable plate. A frame with
   multiple plates can have different readability labels for each plate.
6. Save the frame as reviewed, then use Next or Next pending. If an image cannot
   be reviewed, add a reason and mark it unusable; it must be excluded from
   accuracy denominators later.
7. Export labels JSON at the end of each session. Use Import labels to restore
   a saved file for the same set. Replacing a nonempty draft needs confirmation.

The page flags counts smaller than the number of drawn vehicle boxes, including
older exports that previously allowed this. Those entries remain available for
correction; they are not silently relabeled. **Go to next count check** navigates
between conflicts. **Use drawn-box count** explicitly copies the box total into
the input, returns the frame to pending, and still requires you to inspect and
save it. Remove duplicate or incorrect boxes instead when appropriate. A blank
count is pending; enter zero and save when the frame truly contains no vehicle.

The current count scope matches the running app: cars, buses, trucks and
motorcycles. The first version of the guide also mentioned bicycles; that was
an instruction error, corrected after the first export. Legacy bicycle boxes
can be imported for correction but are outside runtime count scoring.

Drafts are autosaved in this browser's localStorage under the review-set ID.
Changing browser/profile/URL origin, clearing browser data, private-mode limits
or storage failures can make that copy unavailable. The page reports storage
failures and offers JSON export. The server is read-only: browser edits do not
update `labels-template.json` or the observation database. Export the edited
labels and retain that file with `manifest.json` for subsequent evaluation.

### Interface and accessibility

The review tool extends AI26's inherited dark/zinc/teal identity and Plex Sans
with system fallbacks. On desktop, the source image and navigation sit beside
the observation form; at widths of 1000px or less, the form stacks below the
image. Visible labels, native controls and teal focus outlines support keyboard
entry of counts, frame navigation, and label import/export. Status messages use
a polite live region.

Creating boxes requires pointer dragging; there is no keyboard drawing mode.
Count-only review remains available without boxes. Use **Open full-size image**
to inspect details beyond the fitted image. The scoped finish review returned
ship for `.impeccable/review/frame-review-desktop.png` and
`.impeccable/review/frame-review-mobile.png`; this records the supplied review,
not a new test run or whole-app accessibility certification.

## Reproduce a new set

From the repository root:

```bash
uv run --frozen --directory backend python ../evaluation/prepare_frame_review.py \
  --per-camera 5 --output data/review/frame-set-NEW-NAME
```

An existing output directory is rejected. The preparation counts frames by
sequentially decoding the selected files rather than trusting stale container
frame counts, and extracts the selected indices without seeking. It records
the source-file SHA-256, sequential frame index, nominal-FPS time estimate,
decoded BGR pixel digest and JPEG digest. Source hashes are checked before and
after extraction. Failed preparation does not publish a partial review set.
JPEG images are research derivatives, not original evidence frames.

## What these labels support

- Explicit reviewed vehicle counts support per-frame count-error measurements
  against predictions on the exact same frames. This is not a passage count.
- Frames with complete class-labeled vehicle boxes can support detector
  precision/recall and IoU matching once corresponding predictions exist.
- Readable plate boxes and text can support region-matched OCR comparisons;
  unreadable/uncertain plates must be reported separately.
- Sparse still frames do not establish tracking ID-switch rates, cross-camera
  identity, physical speed, road density or unique vehicles across the dataset.

This set is exploratory. These source clips have already been inspected during
development, different frames can repeat the same vehicles, source sessions
are not independently verified and six sources are playback copies. It is not
an independent held-out dataset or a ready train/validation/test manifest.
Report these limitations and frame/clip denominators with later results.

Raw frames, plate labels and generated review files stay under git-ignored
`backend/data/`. The generator, interface and synthetic tests can be versioned
without publishing footage or human plate transcriptions.

## Audit an export and compare frame counts

The count runner verifies the export's set/sample identities and every reviewed
JPEG hash, preserves exact input snapshots, and excludes pending, unusable and
contradictory count entries. It never marks partial boxes complete. The example
below performs an audit only; outputs must be beneath `backend/data/review/`.

```bash
AI26_CPU_THREADS=1 uv run --frozen --directory backend python ../evaluation/evaluate_frame_counts.py \
  --manifest data/review/frame-set-2026-10-18/manifest.json \
  --labels /absolute/path/to/exported-labels.json \
  --output data/review/frame-set-2026-10-18/audit-NEW-NAME
```

Add `--expected-model-sha256 DIGEST` to run the current vehicle model on eligible
review JPEGs. Obtain and verify the desired loaded checkpoint digest from the
app's administrator health view first. A mismatching checkpoint stops the run;
no model or label is promoted. Run with the same runtime model configuration as
the desired baseline. The offline CPU-thread setting does not change the running
API process. No inference observations are ingested.

`summary.json` records input/model digests, inclusion/exclusion counts, per-camera
count metrics and limitations. `predictions.json` holds private per-frame model
boxes, and `results.md` summarizes the comparison and count conflicts. Metrics
are mean absolute count error, RMSE, signed count error and exact *frame-count*
agreement. Summed frame counts can repeat the same vehicles. Matching a count
does not establish correct localization, classification or identity. Latencies
in private prediction rows are incidental, not a controlled benchmark.

An incomplete export can support an explicitly preliminary comparison without
being called a held-out detector benchmark. The first export had 17 reviewed
frames and 28 pending; five reviewed frames contradicted their drawn-box counts,
leaving twelve count-consistent frames for exploratory scoring. No frame was
declared to have complete vehicle-box coverage. The one readable plate was on
a pending frame, so this export did not add a confirmed readable-plate example
to the count comparison. See the sanitized validation register for the measured
result and limitations.
