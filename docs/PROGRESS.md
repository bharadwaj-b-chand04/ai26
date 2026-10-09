# AI26 implementation progress — 9 October 2026

This is the first reliability implementation, not a completed accuracy release.
The original audit/plan remain the baseline. AI26 alone was changed; the Godseye
SIH source was left intact. The app runs on http://127.0.0.1:5174/.

## Status

Across all 80 planned tasks: **37 done, 25 partial, 18 pending**. Done means the stated engineering behavior works within the documented local prototype scope. It does not imply real OCR/identity accuracy. Partial tasks retain explicit remaining work below.

## What now works

Shared background six-camera processing; durable SQLite observations/passages;
per-track OCR abstention; real empty investigations; editable persistent local
rules and review; truthful camera health/activity; bounded historical query
intents; immutable evidence JSON/ZIP/print; source/derivative hashes; report expiry and artifact leases; cached camera previews;
CPU lockfile; clean launcher shutdown/restart; regression and evaluation tooling.

## Performance update

The camera wall uses six cached 320×180 previews and one focused recorded player;
shared detections remain a separately labeled sampled view. Polling pauses when
hidden and requests do not overlap. The log fetches at most 40 rows. CPU/decode
threads are bounded. See `docs/PERFORMANCE.md` in the repository for the measured
short before/after samples and limits. Active-report retention is now implemented.

## Validation

- 55 isolated backend tests pass with the frozen Python 3.12 CPU environment.
- Frontend lint passes with two existing shared-component Fast Refresh warnings;
  TypeScript/Vite production build passes.
- Fresh frozen sync installed CPU torch 2.14.0+cpu and torchvision 0.29.0+cpu.
- Live restart retained all ten sampled observation IDs; all six available cameras
  returned decodable JPEG snapshots. No old service children survived launcher stop.
- Browser mobile checks at 390×844 verified camera wall, investigation and alerts,
  disabled empty export, and focus trapping/Escape restoration.
- An isolated synthetic fixture on 5175/8002 exercised browser report creation,
  JSON and ZIP downloads, matching manifest/artifact hashes, and dedicated print.
  Fixture services/tabs were closed; its records were never added to the main DB.
- Evaluation command processes two deliberately imperfect synthetic records; these
  are metric regressions, not evidence of model accuracy.

Machine-readable runtime evidence is in the adjacent delivery's
`AI26_RUNTIME_CHECKS.json`. CI remote status belongs to the PR checks, not these
local results. Short runtime samples do not establish sustained throughput.

## Remaining release gates and execution order

1. Supply CAM-07–09 readable footage plus original recording timestamps, and label
   a held-out vehicle/camera/session dataset (P0-02, EV-01). Source availability
   is already explicit while these files are absent.
2. Improve local association and vehicle/plate linkage, benchmark OCR/fusion and
   tracker errors (P1-12, EV-02–05). Current centroid IDs are a baseline.
3. Validate coordinates/clocks and camera-pair topology/travel constraints, then
   evaluate exact/fuzzy identity links (P1-14–16, EV-06).
4. Calibrate traffic counts/density/speed and historical segment baselines;
   evaluate rules on positive and negative real cases (P2-01–04, EV-07–09).
5. Complete camera/link catalog persistence, ALPR weight provenance and
   authenticated escalation where needed.
6. Optional research/production phases remain separate. No restored/reconstructed
   pixels, registry verification, signed evidence, RTSP capture or production auth
   is represented as implemented.

## Full checklist

### Correctness and investigation

| ID | Status | Task | Evidence / remaining work |
| --- | --- | --- | --- |
| P0-01 | Partial | Supply CAM-07–09 readable-plate clips, or reduce the catalog honestly to available inputs. | Six available sources and three missing sources are explicit; readable plate inputs are still absent. |
| P0-02 | Pending | Prove real plate reads on supplied footage, retaining raw and canonical strings. | Real OCR cannot be proved without CAM-07–09 readable plate footage. |
| P0-03 | Done | Isolate OCR voting by camera + vehicle/plate track, not camera alone. | Camera + local plate-track consensus; independent tracks and conflicts are regression-tested. |
| P0-04 | Done | Keep `plate`, `plate_norm`, watchlist checks and UI labels consistent. | Canonical plate fields, identity queries and local watchlist use the same normalization; raw strings remain separate. |
| P0-05 | Done | Show a true no-results state for an unknown plate; make walkthrough selection explicit. | Unknown-plate browser check shows true empty results with disabled export; walkthrough requires explicit selection. |
| P0-06 | Done | Build the printable report solely from its evidence payload; never hash empty data while presenting demo hops. | Dedicated print reads the immutable snapshot; empty export is HTTP 409; print contains raw supporting reads. |
| P0-07 | Done | Deduplicate frame reads into vehicle observations before traffic counting or dwell rules. | Distinct camera/session/kind/track passages drive counts, rather than repeated frame reads. Baseline count accuracy is unmeasured. |
| P0-08 | Done | Replace six-frame loitering with tested identity/dwell-time logic. | Explicit configured zone, elapsed duration, at least three samples and bounded gaps; exits/gaps tested. Uses local baseline tracks. |
| P0-09 | Done | Rename the class-based cross-camera alert or implement real, validated identity matching. | Removed class-only cross-camera ReID/clone alert; route review does not claim identity. |
| P0-10 | Done | Expire stale observations even while all streams are idle. | Every rolling-window read filters current time, even with no new ingestion; durable history stays separate. |
| P0-11 | Done | Make equal/invalid timestamps serialize safely with an explicit rejection reason. | Equal timestamps produce null speed/rejection; finite and ordered time bounds are validated. |
| P0-12 | Done | Define trajectory status when accepted and rejected hops coexist; do not equate one accepted link with a proven journey. | Mixed routes require review; accepted links remain candidates rather than verified journeys. |
| P0-13 | Done | Plot accepted paths separately from rejected candidate hops. | Solid teal travel-gated links, dashed red rejected links, dashed amber unresolved calibration. |
| P0-14 | Done | Correct online/healthy/verified wording to reflect actual availability and validation. | Source availability and measured processor freshness replace all-camera healthy and registry-verification claims. |

### Reliable core pipeline

| ID | Status | Task | Evidence / remaining work |
| --- | --- | --- | --- |
| P1-01 | Done | Add background per-camera ingestion/inference independent of the current browser page. | One background round-robin owner processes all available cameras without a browser; six live snapshots verified. |
| P1-02 | Done | Define inference ownership so multiple viewers do not create duplicate processing/event streams. | Streams/snapshots only consume cache; two-consumer regression and exclusive Linux data-directory ownership lock. |
| P1-03 | Done | Add a typed observation schema with stable event IDs and per-track passage IDs. | Typed finite observations, deterministic idempotent read IDs, per-session local passage IDs. |
| P1-04 | Partial | Preserve source clip/frame timestamp separately from processing time; define cross-camera clock handling. | Replay source position and processing time are separate; original capture times and synchronized clocks are missing. |
| P1-05 | Partial | Add persistent observations, camera catalog, tracks, links and alert storage with migrations. | Version-2 SQLite with tested version-1 migration and report artifact leases; catalog is still static and links derived. |
| P1-06 | Done | Expose a validated ingestion path rather than relying only on streaming request side effects. | Processor writes through typed validated ingestion rather than request-side streaming effects. No external ingestion API is claimed. |
| P1-07 | Partial | Store source-frame and plate-crop references with hashes and model/version metadata. | Selected frame/crop digests, source SHA and pipeline/model versions retained; exact ALPR weight digests and per-read frame coverage remain. |
| P1-08 | Done | Test reconnect, corrupt video, end-of-file, missing clips and inference exceptions with bounded retry/backoff. | Controlled reconnect, loop boundary, missing/corrupt input, decode failure and model-download exception tests; 10-second retry and stale-frame suppression. |
| P1-09 | Done | Reset camera and panel errors after input changes or successful recovery. | Camera change/success clears focused-feed failures; API panels clear errors after recovery. Missing-to-available thumbnail remount supported. |
| P1-10 | Done | Return correct HTTP status/error schemas for invalid cameras, plates and request bodies. | Known invalid cameras/missing sources 404; invalid bodies/plates/times 422; unready snapshot 503; JSON error envelope. |
| P1-11 | Done | Add actual health/FPS/frame-age/queue/last-event metrics per camera. | Real per-camera frame age, FPS, latency, last read, source/error state; queue depth zero for the no-queue architecture. |
| P1-12 | Partial | Separate local tracking from cross-camera identity; improve association under occlusion and clip loops. | Local IDs reset on loop/reopen and remain distinct from cross-camera candidates; stronger occlusion association is pending. |
| P1-13 | Done | Deduplicate repeated same-track plate reads and retain corrections without silently overwriting evidence. | Immutable raw reads, deduplicated plate passages and conflict exclusion; uncertain corrections do not silently become supported identity. |
| P1-14 | Pending | Add plate matching confidence and fuzzy matching with measured false-link limits. | Measured fuzzy matching/confidence and false-link limits require labeled identity data. |
| P1-15 | Pending | Use validated camera locations and camera-pair travel constraints for cross-camera links. | Independent camera coordinate validation, road topology and camera-pair travel gates are not implemented. |
| P1-16 | Partial | Handle missing cameras, clock skew, conflicting identities and disconnected routes explicitly. | Missing sources, unsynchronized replay, conflicting tracks and rejected/unresolved links are explicit; calibrated skew/disconnected-route inference is pending. |
| P1-17 | Done | Add an explicit mock known-plates registry if that is part of course scope, or remove registry-verification wording. | Removed registry-verification wording; no government registry or mock registry is presented as real verification. |
| P1-18 | Partial | Make watchlist and restricted-zone data editable and persistent; add permit/history conditions where required. | Editable persisted watchlist, camera zones and dwell zones; permits and history conditions are absent, zone alerts only mean sightings. |
| P1-19 | Done | Add supported plate/camera/type/time intents and clear unsupported-query responses. | Bounded plate/camera/class/time/busiest/alert intents; unknown cameras and unsupported/multiple identities rejected; no fake SQL. |
| P1-20 | Done | Fix timezone/date filters; a today query must not silently mean only the last five minutes. | Timezone-aware today/yesterday/date/time bounds query retained SQL history, not just the default five-minute view. |
| P1-21 | Done | Refresh trajectory results as new observations arrive; debounce typing and clear stale export state. | Submitted searches refresh every three seconds without overlapping requests; typing does not query; changing filters replaces export state. |
| P1-22 | Done | Add a persistent CPU setup/profile and tested restart command; current manual CPU installation must not be replaced by unintended CUDA sync. | Frozen Linux CPU torch/torchvision lock; clean install, restart and launcher process-group shutdown verified. |

### Dashboard and evidence

| ID | Status | Task | Evidence / remaining work |
| --- | --- | --- | --- |
| P2-01 | Partial | Define and compute unique vehicle counts, occupancy/density and any speed metric using suitable calibration. | Deduplicated sampled camera-local passages work; globally unique counts, calibrated occupancy/density/speed do not. |
| P2-02 | Pending | Store historical segment counts/speeds and compare weekday/hour baselines rather than relative detection share. | Historical segment counts/speeds and weekday/hour congestion baselines need independent calibration/data. |
| P2-03 | Done | Implement computed OD aggregation from accepted, deduplicated trajectories and remove fixed live flow rows. | OD counts derive from accepted deduplicated links; fixed sample rows removed. Unsynchronized footage yields no accepted flow. |
| P2-04 | Partial | Implement a measured spatial/road-segment heatmap with honest unobserved/unknown states. | Observed camera activity and unknown/missing states are honest; no calibrated spatial/road-segment heatmap. |
| P2-05 | Done | Keep detector confidence separate from measured accuracy and human verification status. | Model confidence is explicitly separate from measured accuracy and human verification. |
| P2-06 | Done | Persist alert IDs, trigger observations, acknowledgement/review/disposition and reviewer timestamps. | Stable alert IDs, supporting read IDs, review state/history, named reviewer and timestamps persisted across reopen. |
| P2-07 | Partial | Connect a real human-review/escalation workflow; add notifications only if required by the project. | Local acknowledgement/review/dismissal works; authenticated reviewer identity, escalation and notifications are pending. |
| P2-08 | Done | Package evidence observations, raw/canonical OCR, frames/crops, accepted/rejected paths and metadata consistently. | Manifest/raw reads/canonical strings/artifacts/link decisions/provenance packaged consistently with verified digests; derivative and coverage limits stated. |
| P2-09 | Done | Provide direct JSON/package download and a dedicated PDF/print layout with matching report data. | Browser JSON/ZIP downloads verified; dedicated print contains the same stored snapshot and raw reads. PDF uses the browser print dialog. |
| P2-10 | Done | Enforce defined retention/expiry rather than displaying a retention string. | 24-hour report expiry, seven-day source cleanup, version-2 artifact leases, and independent maintenance; boundary and processing-disabled tests pass. |
| P2-11 | Partial | Add report access/audit records and signing if independently verifiable evidence is required. | Local report access and review audit records exist; digital signing and independently verifiable audit chain do not. |
| P2-12 | Done | Keep demonstrations separate from live queries, including colors, confidence values and statuses. | Synthetic walkthrough/alerts are explicit selection; real queries never substitute them or export them as observed evidence. |
| P2-13 | Done | Test query, camera recovery, empty investigation and evidence export flows end to end. | Browser empty investigation, focused missing-to-working camera recovery, keyboard/mobile and isolated synthetic report downloads/print verified; API query regressions pass. |
| P2-14 | Done | Address fixed-width mobile layouts and keyboard/focus behavior in navigation and forms. | 390×844 camera wall, investigation and alerts have no root horizontal overflow; navigation focus trap/Escape restoration verified; focus/reduced-motion styles. |

### Evaluation and release

| ID | Status | Task | Evidence / remaining work |
| --- | --- | --- | --- |
| EV-01 | Pending | Prepare labeled vehicle/plate data and split by vehicle, camera/location and recording session. | No labeled held-out vehicle/plate dataset or vehicle/camera/session splits supplied. |
| EV-02 | Partial | Measure vehicle precision/recall and false positives rather than quoting model confidence. | IoU-matched detector precision/recall evaluator implemented; no real labeled measurements. |
| EV-03 | Partial | Measure exact plate-string accuracy and rejected/invalid read rates on readable and difficult footage. | Exact string/abstention evaluator implemented; no real OCR accuracy or difficult-input strata. |
| EV-04 | Partial | Compare per-track fusion against single-frame OCR; verify it never mixes identities. | Consensus isolation/conflict regression passes; measured single-frame versus fusion ablation is pending. |
| EV-05 | Partial | Measure tracker ID switches, fragmentation and passage-count error. | ID-switch and passage error metrics implemented; fragmentation and real labeled tracker evaluation pending. |
| EV-06 | Partial | Measure accepted/rejected trajectory-link precision and impossible-travel false alerts. | Positive/negative link evaluation implemented; real false-link/false-alert estimates pending. |
| EV-07 | Partial | Evaluate loitering/restricted-zone/watchlist rules with both positive and negative cases. | Positive/negative dwell, watchlist/review and zone configuration tests; labeled footage-level rule evaluation pending. |
| EV-08 | Partial | Validate derived traffic metrics against independent counts or known synthetic ground truth. | Known synthetic passage fixtures verify deduplication; independent real traffic counts/calibration pending. |
| EV-09 | Partial | Benchmark warm/cold inference latency, sustained multi-stream throughput, dropped frames and memory. | Short CPU health/RSS/snapshot smoke recorded; cold/warm/sustained profiling and dropped-frame accounting pending. |
| EV-10 | Done | Test page changes, multiple clients, restart, idle expiry, duplicate events, bad input and model-download failure. | Isolated tests cover multiple consumers, restart, idle expiry, duplicates, invalid input, corrupt capture, replay boundaries and simulated model-download failure; live launcher restart verified. |
| EV-11 | Partial | Record sample sizes, hardware, conditions and failure cases; do not infer accuracy from the current smoke tests. | Runtime conditions and synthetic sample sizes documented; held-out accuracy samples/failure strata remain absent. |
| EV-12 | Done | Add CI for regression/build checks and a reproducible evaluation command. | Pinned-action CPU/backend/frontend CI workflow and reproducible evaluation CLI; local equivalent checks pass. Remote result recorded separately. |

### Optional research

| ID | Status | Task | Evidence / remaining work |
| --- | --- | --- | --- |
| RS-01 | Pending | Rule-based scene/plate quality and weather router with an unchanged raw-reference branch. | Optional research work; no implementation or measured evaluation claimed. |
| RS-02 | Pending | Classical CLAHE/gamma/white-balance/Retinex/dark-channel enhancement and restrained sharpening. | Optional research work; no implementation or measured evaluation claimed. |
| RS-03 | Partial | Per-track best-shot/top-k frame selection and OCR character-level consensus. | Confidence-selected artifact caching and per-track full-string votes exist; top-k quality scoring and character consensus are pending. |
| RS-04 | Pending | Frame alignment/optical flow, probabilistic fusion and calibrated plate confidence. | Optional research work; no implementation or measured evaluation claimed. |
| RS-05 | Pending | Collect adverse-weather data and build a controlled degradation generator. | Optional research work; no implementation or measured evaluation claimed. |
| RS-06 | Pending | Train/evaluate a quality classifier, dehazing and deblurring models, and Indian-plate OCR adaptation. | Optional research work; no implementation or measured evaluation claimed. |
| RS-07 | Partial | Add restoration safety checks and preserve raw versus enhanced/reconstructed artifact provenance. | Unannotated derivative/source digest provenance exists; enhancement/restoration branches and their safety checks are absent. |
| RS-08 | Pending | Optional burst super-resolution with an explicit reconstructed status, not a raw-evidence claim. | Optional research work; no implementation or measured evaluation claimed. |
| RS-09 | Pending | Learned camera topology and calibrated travel-time distributions. | Optional research work; no implementation or measured evaluation claimed. |
| RS-10 | Pending | Complete raw/classical/learned/fusion ablations and model cards with data lineage. | Optional research work; no implementation or measured evaluation claimed. |

### Optional production and edge

| ID | Status | Task | Evidence / remaining work |
| --- | --- | --- | --- |
| OP-01 | Pending | RTSP/ONVIF camera integration and resilient capture queues. | Optional production/edge work; not implemented for this local course prototype. |
| OP-02 | Pending | Authentication, role-based access and purpose/case-scoped sensitive operations. | Optional production/edge work; not implemented for this local course prototype. |
| OP-03 | Pending | Occupant face blurring and keyed plate pseudonyms in analytics views if those privacy features remain in scope. | Optional production/edge work; not implemented for this local course prototype. |
| OP-04 | Partial | Durable audit logs, retention jobs, secrets handling and TLS. | Local SQLite audit and expiry cleanup exist; tamper-resistant audit, secrets/TLS and operational retention jobs pending. |
| OP-05 | Pending | Container/Compose setup, database backups and production frontend-to-API routing. | Optional production/edge work; not implemented for this local course prototype. |
| OP-06 | Pending | Edge model export/quantization and benchmark on actual target hardware. | Optional production/edge work; not implemented for this local course prototype. |
| OP-07 | Partial | Canary/model-version pinning, rollback and branch-level disablement. | Dependency/model identifiers and processing-disable switch exist; canary rollout/model rollback are absent. |
| OP-08 | Partial | Operational monitoring and sustained reliability/recovery tests. | Basic health, retry and restart smoke exist; operational monitoring and sustained recovery runs remain. |

## Practical limitations

Real plate cameras are absent, original recording clocks are unknown, and camera
locations/topology have not been independently calibrated. Cross-camera replay
links abstain from physical speed/accepted-flow claims. No held-out accuracy can
be reported. CPU sampling is sparse, not full-frame-rate processing. Counts are
local tracked passages; plate and vehicle association remains unvalidated.

Artifacts are selected JPEG derivatives, not a full original-frame archive. Their
seven-day source lifetime is extended by active report leases until report expiry.
Missing/corrupt source images reject report creation; later manual file removal or
corruption makes downloads fail explicitly rather than hiding missing evidence. SQLite reviewer/audit data is local and unauthenticated. Hashes
detect changed bytes and do not prove correctness or authenticated custody.
