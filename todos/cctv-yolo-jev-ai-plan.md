# CCTV YOLO + JEV AI Plan

## Goal

Build a real-time CCTV analysis workflow where YOLO extracts visual evidence, JEV AI evaluates the evidence, and a human operator makes the final decision.

Core principle:

```text
YOLO detects evidence
-> rules group evidence into events
-> JEV AI assigns provisional threat level
-> dashboard shows rationale
-> human confirms, dismisses, or escalates
-> final report is saved
```

JEV AI must support decisions, not replace the human reviewer.

## Decision

Use YOLO as the continuous vision layer and JEV AI as the near-real-time reasoning layer.

Recommended split:

1. YOLO runs continuously on selected live camera feeds.
2. YOLO output is normalized into detections and tracks.
3. A deterministic event engine converts detections into behavior events.
4. JEV AI analyzes structured event summaries, not every raw frame.
5. Human review is required for serious alerts.

Do not send every video frame to JEV AI. Send summarized evidence when something meaningful changes.

## Threat Levels

- `normal`: no meaningful concern.
- `watch`: low-confidence pattern worth watching.
- `elevated`: meaningful pattern requiring operator review.
- `critical_review`: urgent review required, not automatically confirmed.

Avoid labels like `criminal`, `confirmed_threat`, or `dangerous_person`.

## Phase 1: Data Contracts

- Define JSON schemas for:
  - `Detection`
  - `Track`
  - `Event`
  - `Assessment`
  - `Report`
  - `HumanReview`
- Add schema versioning to every persisted object.
- Keep bounding boxes normalized from 0 to 1.
- Include model metadata on every inference result.
- Include source camera metadata in every report.
- Include audit fields for human decisions.

Detection shape:

```json
{
  "id": "det_001",
  "trackId": "track_12",
  "label": "person",
  "confidence": 0.91,
  "box": { "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4 },
  "zone": "entry",
  "capturedAt": "2026-09-24T00:00:00.000Z"
}
```

Assessment shape:

```json
{
  "threatLevel": "elevated",
  "score": 68,
  "confidence": 0.72,
  "summary": "Possible unattended object near active pedestrian area.",
  "evidence": [
    "object remained stationary for 180 seconds",
    "associated person track left the scene"
  ],
  "recommendedAction": "Review feed and confirm object status.",
  "requiresHumanReview": true,
  "finalDecision": null,
  "reviewedBy": null,
  "reviewedAt": null
}
```

Acceptance:

- Schemas are documented and unit tested.
- Reports can be written and read without losing fields.
- Serious alerts always have `requiresHumanReview: true`.

## Phase 2: Scan API Scaffold

- Replace the current placeholder scan behavior with a real API boundary.
- Add `POST /api/cctv-analysis/scan`.
- Keep `POST /api/cctv-analysis/reports`.
- Add `GET /api/cctv-analysis/reports`.
- Return a clear `model_unavailable` status until YOLO is configured.
- Keep the UI honest when inference is not running.

Scan input:

```json
{
  "cameraId": "camera_123",
  "mode": "single",
  "frameUrl": "/api/cctv/frame/camera_123"
}
```

Scan output:

```json
{
  "schemaVersion": 1,
  "status": "model_unavailable",
  "detections": [],
  "tracks": [],
  "events": [],
  "assessment": null
}
```

Repo touchpoints:

- `server/providers/cctv-analysis.js`
- `server/providers/local.js`
- `src/cctvWatchModule.js`
- `index.html`
- `src/ui/styles/cctv-watch.css`

Acceptance:

- No scan runs before a camera is selected.
- The UI can display model unavailable, scan running, scan failed, and scan complete.
- Reports remain append-only JSON for now.

## Phase 3: Real-Time YOLO Worker

- Add a selected-camera frame sampler.
- Sample every 0.5 to 2 seconds by default.
- Do not analyze every camera in the catalog.
- Run YOLO on sampled frames.
- Generate detections with labels, confidence, boxes, and timestamps.
- Add object tracking across frames.
- Keep a rolling per-camera buffer.

Rolling buffer:

- last 30 seconds of detection ticks
- last 120 seconds of events
- active tracks
- latest JEV AI assessment
- latest human review state

Recommended model/runtime order:

1. Server-side Python + Ultralytics YOLO for first real implementation.
2. ONNX export for runtime portability.
3. TensorRT for NVIDIA GPU or Jetson.
4. OpenVINO for Intel CPU/iGPU/NPU.
5. ONNX Runtime Web/WebGPU only for browser prototype.

Acceptance:

- One selected camera can produce live detection ticks.
- YOLO failures do not break the dashboard.
- Runtime config is visible in report output.

## Phase 4: Event Engine

- Convert raw detections into behavior events.
- Keep this deterministic and testable.
- Use JEV AI after event generation, not before.

Initial events:

- `person_lingering`
- `vehicle_stopped`
- `crowd_forming`
- `object_left_behind`
- `restricted_zone_entry`
- `crash_or_fire_review`
- `weapon_like_object_review`

Event shape:

```json
{
  "id": "event_001",
  "type": "object_left_behind",
  "severity": "elevated",
  "confidence": 0.74,
  "cameraId": "camera_123",
  "trackIds": ["track_12", "track_19"],
  "startedAt": "2026-09-24T00:00:00.000Z",
  "endedAt": null,
  "evidence": [
    "object track_19 stationary for 180 seconds",
    "person track_12 left frame after object appeared"
  ]
}
```

Acceptance:

- Event rules are unit tested with synthetic detection sequences.
- Events include human-readable evidence strings.
- Event severity does not exceed available evidence.

## Phase 5: JEV AI Assessor

- Add a JEV AI assessment step after event generation.
- Send structured summaries to JEV AI.
- Avoid sending raw images unless escalation requires it.
- Require strict JSON output.
- Store the model name, prompt version, and assessment version.

Trigger JEV AI when:

- a new event starts
- event severity changes
- event confidence crosses a threshold
- the operator opens a camera
- an active incident needs refresh every 10 to 30 seconds
- a human requests reassessment

JEV input:

```json
{
  "camera": {
    "id": "camera_123",
    "name": "Main Street",
    "city": "Austin",
    "provider": "City feed"
  },
  "windowSeconds": 60,
  "events": [],
  "activeTracks": [],
  "recentDetectionsSummary": {}
}
```

JEV output:

```json
{
  "threatLevel": "watch",
  "score": 31,
  "confidence": 0.66,
  "summary": "One person has remained near the curb longer than normal.",
  "evidence": ["person track_7 remained in the same zone for 95 seconds"],
  "recommendedAction": "Continue monitoring.",
  "requiresHumanReview": false
}
```

Acceptance:

- JEV AI never finalizes critical decisions.
- JEV AI output is schema-validated before storage.
- Invalid AI output is rejected and logged as assessment failure.

## Phase 6: Real-Time Transport

- Add live update transport for the selected camera.
- Prefer Server-Sent Events first for simplicity.
- Use WebSocket only if two-way live control is needed.

Endpoint:

```text
GET /api/cctv-analysis/live/:cameraId
```

Stream event types:

- `detection_tick`
- `event_started`
- `event_updated`
- `assessment_updated`
- `review_updated`
- `scan_status`

Acceptance:

- UI subscribes only to the selected camera.
- Switching cameras closes the previous stream.
- No background live analysis starts for unselected cameras.

## Phase 7: CCTV Watch Dashboard

- Extend CCTV Watch from scan panel to live dashboard.
- Keep the current design system.
- Preserve the searchable camera dropdown.
- Add live threat chip.
- Add detection/event timeline.
- Add JEV AI assessment panel.
- Add human review actions.
- Add report history.

Dashboard sections:

- selected feed
- current threat level
- active detections
- active events
- JEV AI assessment
- evidence list
- report timeline
- human review controls

Human actions:

- `confirm`
- `dismiss`
- `escalate`
- `needs_more_review`

Acceptance:

- Dashboard states are clear at idle, scanning, live, failed, and review-required.
- Serious alerts show "Human review required".
- Confirm/dismiss/escalate writes to the report.

## Phase 8: Human Review and Audit

- Add human decision fields to every report.
- Keep AI assessment separate from final decision.
- Save reviewer, timestamp, decision, and optional note.

Review shape:

```json
{
  "status": "pending_review",
  "decision": null,
  "reviewedBy": null,
  "reviewedAt": null,
  "reviewNote": ""
}
```

Allowed statuses:

- `pending_review`
- `confirmed`
- `dismissed`
- `escalated`
- `needs_more_review`

Acceptance:

- A critical review cannot be marked final by AI alone.
- Human review updates are append-only or audit-safe.
- Reports distinguish provisional assessment from final decision.

## Phase 9: Storage

- Start with JSON files.
- Add file-size caps and rotation.
- Keep schemas stable before moving to a database.

Initial files:

- `data/cctv-detections.json`
- `data/cctv-events.json`
- `data/cctv-analysis-reports.json`
- `data/cctv-human-reviews.json`

Later database candidate:

- SQLite for local desktop/dev.
- PostgreSQL for multi-user/server deployment.

Acceptance:

- Large report files do not grow forever.
- Malformed JSON is handled safely.
- Report list endpoint can paginate.

## Phase 10: Privacy and Safety

- Treat all outputs as advisory.
- Require human review for high-risk alerts.
- Do not identify people.
- Do not infer protected traits.
- Avoid biometric recognition.
- Keep raw frames short-lived by default.
- Make retention explicit and configurable.
- Include model confidence and limitations in reports.
- Respect camera provider licenses and data-use terms.

Acceptance:

- Dashboard language says "possible", "observed", and "requires review".
- No UI copy claims a confirmed threat without human decision.
- Raw frame retention defaults to off or short-lived.

## Phase 11: Tests

- Test detection schema normalization.
- Test event rules with synthetic detections.
- Test scan endpoint unavailable-model behavior.
- Test report writing and reading.
- Test human review updates.
- Test selected-camera-only live stream behavior.
- Test camera switch closes previous live stream.
- Test dashboard copy for critical review states.

Acceptance:

- Unit tests cover core event logic.
- API tests cover scan/report/review endpoints.
- UI tests cover no-camera-selected and selected-camera states.

## Build Order

1. Add schemas and report contract.
2. Add `/api/cctv-analysis/scan` with fake/model-unavailable output.
3. Extend CCTV Watch dashboard around fake live data.
4. Add event engine with synthetic detections.
5. Add JEV AI assessor stub with strict JSON.
6. Add real YOLO service for selected camera scans.
7. Add SSE live updates.
8. Add human review workflow.
9. Add storage caps and report listing.
10. Tune model/runtime and performance.

## Non-Goals

- No all-camera live analysis by default.
- No automated final threat decisions.
- No face recognition or identity matching.
- No protected-trait inference.
- No raw video retention unless explicitly enabled.
- No production claims until real model validation exists.

## First Implementation Task

Create the scan contract and dashboard states without real YOLO:

1. Add `POST /api/cctv-analysis/scan`.
2. Return `model_unavailable` with the final schema.
3. Update `RUN SCAN` to call the scan endpoint.
4. Show the result in CCTV Watch.
5. Keep report writing separate from scan execution.
