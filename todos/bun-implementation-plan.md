# Bun Implementation Plan

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

## First Implementation Task

Create a minimal Bun CCTV analysis service behind the existing report contract, then run the current app against it without changing the frontend module behavior.
