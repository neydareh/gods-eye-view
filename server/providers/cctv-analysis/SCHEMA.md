# CCTV Analysis Contract v1

Every stored report and human review uses `schemaVersion: 1`. Detection boxes use normalized `x`, `y`, `w`, and `h` values in the 0-1 range. Model output contains the model name and runtime when inference runs.

Reports keep automated assessment separate from the human review record. Assessment threat levels are `normal`, `watch`, `elevated`, and `critical_review`; `elevated` and `critical_review` require `requiresHumanReview: true`. Automated assessments always have `finalDecision: null`.

Detections carry `id`, `trackId`, `label`, `confidence`, `box`, `zone`, and `timestamp`. Events carry `id`, `type`, `severity`, `confidence`, `cameraId`, `trackIds`, `startedAt`, `endedAt`, and human-readable `evidence`.

Human review records are append-only in `data/cctv-human-reviews.json`. Decisions are `confirm`, `dismiss`, `escalate`, and `needs_more_review`; report reads include the latest decision without rewriting the original report.

## Local YOLO Runtime

Install the Python dependencies with `python3 -m pip install -r server/providers/cctv-analysis/requirements.txt`, then set `CCTV_YOLO_MODEL=yolo26n.pt` or provide a local model path. Ultralytics downloads recognized pretrained weights on first use. Optionally set `CCTV_YOLO_PYTHON` to the Python executable. The first scan starts a persistent Ultralytics worker. It fetches snapshots only from the registered camera catalog; it does not accept a client-provided upstream URL. No frame files are retained by the analysis service.
