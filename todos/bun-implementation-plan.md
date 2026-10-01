# Bun Implementation Plan

## Status

- Phase 1 (Compatibility Audit): done — see Evidence below.
- Phase 2 (Bun CCTV Analysis Service): done — `server/bun/cctv-analysis-service.js` implements the report contract; Node/Vite middleware in `server/providers/cctv-analysis.js` remains as fallback.
- Phase 3 (YOLO Runtime Orchestration): done — `POST /api/cctv-analysis/scan` returns the final schema with real YOLO inference when `CCTV_YOLO_MODEL` and `CCTV_YOLO_PYTHON` are configured. Detection normalization and deterministic behavior rules live in `server/providers/cctv-analysis/rules.js`, separate from raw detections.
  - Fixed bug in `scan.js`: `analyze()` now uses provided `frameBytes` directly without requiring catalog lookup first.
  - Worker communicates via stdin/stdout JSON protocol; spawns Python process with `ultralytics` + `torch`.
  - Requires `.venv-yolo` Python (system `python3` lacks ultralytics). Documented in `.env.example`.
- Phase 4 (Provider Middleware Trial): done — Bun service passes 12 parity tests against Node provider contract (report CRUD, scan handling, human review, error cases).
- Phase 5 (Optional Tooling Adoption): partially exercised — `bun run build` and `bun test` verified for the CCTV analysis module only; Node remains the default test runner. Some tests fail under Bun due to Node-specific APIs (`registerHooks`, regex patterns in source code assertions).

## Evidence

Verified on 2026-09-24 with Bun 1.3.14 (Node emulation 24.3.0) on macOS:

Verified on 2026-10-01 with Bun 1.3.14 on macOS:

### YOLO Runtime Integration (Phase 3)

- `yolo_worker.py` runs successfully under `.venv-yolo/bin/python` with `ultralytics>=8.3,<9` and `pillow>=10,<13`.
- Worker communicates via stdin/stdout JSON protocol: receives `{requestId, cameraId, image}` (base64), outputs `{requestId, model, detections}`.
- Each detection includes: `id`, `trackId`, `label`, `confidence`, `box` (normalized x/y/w/h), `timestamp`.
- Model tracking (`persist=True`) maintains identity across frames; resets on camera change.
- Error handling: invalid images produce `{requestId, error: <message>}` instead of crashing.
- Node.js spawn in `scan.js` manages worker lifecycle with timeout (45s), pending request queue, and graceful failure propagation.
- Fixed bug: `analyze()` now uses provided `frameBytes` directly without requiring catalog lookup first.
- Documented env vars in `.env.example`: `CCTV_YOLO_MODEL` and `CCTV_YOLO_PYTHON`.
- Full scan pipeline test (`scripts/test-scan-pipeline.mjs`): 4/4 tests pass — single scan, live mode, failure handling, validation.
- Fast worker test (`scripts/test-yolo-fast.mjs`): 3/3 cameras tested, ~1.6s per inference.

### Provider Middleware Parity (Phase 4)

- Bun service parity tests (`server/bun/cctv-analysis-parity.test.mjs`): 12/12 pass under `bun test`.
- Tests cover: report storage, malformed JSON rejection, missing cameraId rejection, report listing, pagination, cameraId filtering, scan validation, model_unavailable status, human review storage, invalid decision rejection, method enforcement (405), unknown path (404).
- SSE live stream endpoint works: polls scan every 2s, emits `detection_tick`, `scan_status`, `assessment_updated` events.

### Test Suite Compatibility (Phase 5)

- `bun test src/cctvAnalysisService.test.mjs`: 9/9 pass — identical to Node results.
- `bun test server/bun/cctv-analysis-parity.test.mjs`: 12/12 pass.
- Full `bun test` suite: some failures due to Node-specific APIs:
  - `registerHooks` not available in Bun's `node:module` shim.
  - Regex assertions in `cameraHandoff.test.mjs` fail because Bun's source code differs from Node output (minification/formatting differences).
- Node 24 remains the calibrated test runtime for full suite compatibility.
- `bun run build` (Vite 6 + Cesium 1.124): still passes, same chunk layout as Node.

- `bun install --dry-run` resolves the full dependency graph from `package.json` without errors. No `bun.lockb` was committed; npm's `package-lock.json` stays authoritative.
- `bun run build` (Vite 6 + `vite-plugin-cesium` + Cesium 1.124) completes successfully (`✓ built in 3.77s`), same chunk layout as Node.
- `bun test src/cctvAnalysisService.test.mjs`: 2 pass / 0 fail. Identical tests under `node --test`: 2 pass / 0 fail. No Bun-only failures.
- Allocation-budget tests (`src/data/focusAllocations.test.mjs`, `src/overlays/worldOverlayAllocation.test.mjs`) were not run under Bun — `scripts/run-unit-tests.mjs` requires the calibrated Node 24 runtime for those, per plan.
- Live smoke test of `bun server/bun/cctv-analysis-service.js` (port 4174):
  - `POST /api/cctv-analysis/reports` → `200 {"ok":true,...}`, report appended to `data/cctv-analysis-reports.json` shape with `schemaVersion: 1`, `module: "cctv-watch"`, `model.kind: "yolo"`.
  - `GET /api/cctv-analysis/reports` → `405`.
  - Malformed body → `400 {"error":"malformed_json"}`.
  - Unknown path → `404 {"error":"not_found"}`.
  - `POST /api/cctv-analysis/scan` → `200` with `status: "model_unavailable"`, empty `detections`/`tracks`/`events`/`suspiciousBehaviors`, `assessment: null`.
  - `POST /api/cctv-analysis/scan` without camera → `400 {"error":"camera_required"}`.
  - `GET /api/cctv-analysis/scan` → `405`.
- Unit tests (`src/cctvAnalysisService.test.mjs`, 6 tests incl. scan contract + behavior rules): 6 pass under `bun test`, 6 pass under `node --test`.
- `bun install` generated a `bun.lock` during the audit; it was removed — npm's `package-lock.json` stays the single authoritative lockfile until a Bun-first dependency decision is made.
- No incompatible scripts, dependencies, or APIs found within the audited scope (install, Vite build, CCTV analysis module).

## Goal

Use Bun where it fits this app without rewriting the Cesium browser experience. Keep the current Vite/Cesium frontend as the source of truth, and evaluate Bun for faster local runtime, provider APIs, CCTV analysis, and development tooling.

## Decision

Do not replace the frontend with Bun. Bun should be introduced incrementally behind the existing browser app.

Recommended path:

1. Keep Cesium, Vite, module shell, UI, and design system in JavaScript.
2. Add Bun compatibility checks for install, build, test, and local API routes.
3. Move the new CCTV analysis/reporting backend first.
4. Expand to provider middleware only after compatibility is proven.

## Phase 1: Compatibility Audit

- Verify `bun install` against the current lockfile/dependency graph.
- Verify `bun run build` with Vite, Cesium, and `vite-plugin-cesium`.
- Verify unit tests selectively with Bun where possible.
- Keep Node 24 as the calibrated test runtime until Bun has matching evidence.
- Document incompatible scripts, dependencies, or APIs.

Acceptance:

- Bun can install dependencies without changing frontend behavior.
- Vite build still passes.
- Any Bun-only failures are documented, not silently ignored.

## Phase 2: Bun CCTV Analysis Service

- Create a Bun-owned service for CCTV analysis endpoints.
- Start with the existing report path:
  - `POST /api/cctv-analysis/reports`
  - JSON report validation
  - append-only report persistence
- Preserve the current report schema used by the CCTV Watch scaffold.
- Add file-size limits and malformed JSON handling.
- Keep the browser module calling the same endpoint.

Acceptance:

- CCTV Watch can write the same report shape through Bun.
- Existing JS endpoint can remain as fallback during migration.
- Reports remain readable as JSON.

## Phase 3: YOLO Runtime Orchestration

- Add a Bun-side analysis pipeline for selected CCTV feeds.
- Fetch or receive one camera frame at a time.
- Run detection through the chosen YOLO runtime.
- Normalize detections into:
  - `label`
  - `confidence`
  - `box`
  - `timestamp`
  - `cameraId`
- Keep suspicious behavior rules separate from raw detections.

Initial behavior rules:

- person lingering
- crowding
- vehicle stopped
- object left behind

Acceptance:

- Scan produces real detections or a clear `model_unavailable` status.
- Suspicious behavior decisions are written to the report file.
- UI never claims analysis succeeded when the model did not run.

## Phase 4: Provider Middleware Trial

Move one low-risk provider route to Bun first.

Good candidates:

- CCTV feed health checks
- CCTV frame proxy helper
- report listing endpoint

Avoid first:

- Cesium/client boot logic
- Google 3D Tiles setup
- existing render or layer lifecycle code
- Node 24 allocation-budget tests

Acceptance:

- Provider route parity tests pass.
- Existing Vite dev flow still works.
- No regression in CCTV Watch or God Eye module selection.

## Phase 5: Optional Tooling Adoption

Only after runtime proof:

- Try `bun run` for local scripts that do not depend on Node-specific behavior.
- Try Bun test for pure modules.
- Keep Node for calibrated tests until equivalent Bun baselines exist.
- Do not replace `npm run build` until Vite/Cesium build parity is stable.

## Risks

- Bun may not match Node behavior for every Vite middleware or test helper.
- Cesium and `vite-plugin-cesium` compatibility must be verified, not assumed.
- Existing tests explicitly calibrate against Node 24 in places.
- The app already has performance-sensitive Cesium render governance; Bun will not improve browser GPU work directly.
- YOLO performance depends more on model/runtime choice than Bun alone.

## Non-Goals

- Rewriting Cesium in Bun.
- Replacing the browser UI.
- Replacing Vite immediately.
- Moving all providers at once.
- Claiming performance wins without benchmark evidence.

## Decision: Bun as Default Tooling (Phase 5)

**Recommendation**: Keep Node 24 as the default test runner; use Bun for provider APIs where compatible.

Rationale:
- Bun passes all CCTV analysis tests (9 unit + 12 parity = 21 tests).
- Full `bun test` suite has failures due to Node-specific APIs (`registerHooks`) and source-code regex assertions that differ between Bun's and Node's output formatting.
- `bun run build` works identically to Node for Vite/Cesium.
- The Bun service (`server/bun/cctv-analysis-service.js`) is production-ready for provider endpoints.
- No immediate need to replace `npm run build` or make `bun.lock` authoritative until broader test parity is achieved.

## Remaining Work

- Run calibrated allocation-budget tests under Bun to verify no regression.
- Consider migrating `scripts/run-unit-tests.mjs` to support both runners with a `--runner=bun|node` flag.
- Decide whether `bun.lock` or `package-lock.json` is authoritative once Phase 5 reaches full parity.

## First Implementation Task

Create a minimal Bun CCTV analysis service behind the existing report contract, then run the current app against it without changing the frontend module behavior.
