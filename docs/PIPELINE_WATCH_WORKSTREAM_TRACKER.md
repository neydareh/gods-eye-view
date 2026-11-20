# Pipeline Watch Workstream Tracker

**Program:** Pipeline Watch  
**Tracker status:** Active planning  
**Last updated:** November 19, 2026  
**Primary plan:** [Pipeline Watch Software Master Plan](MASTER_PLAN_PIPELINE_WATCH_SOFTWARE.md)  
**Product requirements:** [Pipeline Watch PRD](PRD_PIPELINE_WATCH.md)

## 1. How to use this tracker

This file is the execution tracker for humans and code agents. The master plan explains the architecture and sequencing; this file explains the smallest work items that can be assigned, implemented, reviewed, and verified independently.

The current pilot includes supervised browser-led monitoring, thermal spill detection, SCADA read-only correlation, drone mission/media integration, dispatch, and the global pipeline map. Persistent 24/7 edge monitoring is deferred and marked `DEFERRED` below.

The first milestone is the [Stage 1 practice run](#stage-1-practice-run), not the full pilot. Deliver it before expanding to additional sources or screens.

Per-task HTML plans live in `docs/pipeline-watch-plans/html/`, one page per tracker ID. When a task is added or its row changes materially, create or update its page (`npm run plans -- new ID`, then `npm run plans -- build` and `npm run plans -- check`) so the plan set stays in sync with this tracker.

### Status values

| Status        | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `PLANNED`     | Defined but not ready for implementation.                          |
| `READY`       | Dependencies are complete and acceptance criteria are clear.       |
| `IN_PROGRESS` | One person or agent owns the work.                                 |
| `REVIEW`      | Implementation is complete and waiting for review or verification. |
| `BLOCKED`     | Cannot proceed until a named dependency or decision changes.       |
| `DONE`        | Acceptance criteria and verification passed.                       |
| `DEFERRED`    | Intentionally outside the current supervised pilot.                |

### Atomic work-item rules

Every task should:

- Have one ID, one owner, and one primary write scope.
- Be small enough to finish in roughly one focused working session or one to two days.
- Change one coherent behavior or contract.
- Name its dependencies before implementation starts.
- Include a test or deterministic verification command.
- State what is explicitly out of scope.
- Avoid editing another task's primary files unless the coordinator reassigns the task.

If a task grows beyond that size, split it into a new child task before continuing. Do not silently expand the task.

## 2. Workstream rollup

| Workstream | Scope                                 | Current status | Ready work          | Primary owner          |
| ---------- | ------------------------------------- | -------------- | ------------------- | ---------------------- |
| W0         | Domain contracts and validation       | `PLANNED`      | `PW-W0-001`         | Coordinator / platform |
| W1         | Fixtures, simulators, and replay      | `PLANNED`      | After `PW-W0-002`   | Test infrastructure    |
| W2         | Future persistent edge boundary       | `DEFERRED`     | None                | Future platform owner  |
| W3         | Source adapters                       | `PLANNED`      | After W0/W1         | Integrations           |
| W4         | Analytics and correlation             | `PLANNED`      | After W0/W1         | Detection / data       |
| W5         | Operator console and map              | `PLANNED`      | After W0/W1         | Frontend / geospatial  |
| W6         | SCADA, drone, dispatch, and response  | `PLANNED`      | After W0/W3/W4/W5   | Integrations           |
| W7         | Security, audit, and pilot operations | `PLANNED`      | After core workflow | Platform / QA          |

The coordinator updates this rollup after each accepted task. Agents should report status in their handoff; they should not concurrently edit this tracker unless assigned a tracker-maintenance task.

Dependency cells use the short form `W0-001`; the full task ID is `PW-W0-001`.

## 3. Dependency flow

```text
W0 core contracts + W1 practice run
          |
          +--> Broader fixtures, analytics, source adapters, and operator console
                      |
                      +--> Sandbox integration + pre-live security checks
                                  |
                                  +--> Live integrations --> Pilot hardening

W2 future edge boundary remains deferred until the supervised pilot is accepted.
```

Do not enable a live customer connection until the [Stage 4 entry gate](MASTER_PLAN_PIPELINE_WATCH_SOFTWARE.md#stage-4-live-integration-and-hardware-in-the-loop) passes. W6 implementation and W7 verification may run against fixtures or a sandbox before then.

## 4. Assignment and handoff protocol

Before starting a task, the assignee records:

1. Task ID and owner.
2. Expected files to change.
3. Dependencies verified as complete.
4. Planned verification command.
5. Any decision needed from the coordinator.

At handoff, the assignee reports:

```text
Task: PW-...
Status: REVIEW | BLOCKED | DONE
Changed: absolute or repository-relative file paths
Behavior: one paragraph describing the result
Verification: exact commands and outcomes
Open questions: none or named decisions
Follow-ups: task IDs, if any
```

For parallel agent work, use one branch/worktree per task or per disjoint task group. Never assign two agents overlapping primary write scopes at the same time.

## 5. Atomic task backlog

### W0 Domain contracts and validation

| ID        | Task                                             | Depends on             | Primary write scope                          | Done when and verify                                                                                                                                  | Status    |
| --------- | ------------------------------------------------ | ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| PW-W0-001 | Add shared schema version and enum constants.    | None                   | `src/pipelineWatch/contracts/version.js`     | Constants cover source kinds, incident states, review decisions, and response states; run `node --test src/pipelineWatch/contracts/version.test.mjs`. | `READY`   |
| PW-W0-002 | Define Pipeline and Segment records.             | W0-001                 | `src/pipelineWatch/contracts/pipeline.js`    | Records validate IDs, geometry, status, visibility, and segment ownership; add unit tests.                                                            | `PLANNED` |
| PW-W0-003 | Define Observation record.                       | W0-001                 | `src/pipelineWatch/contracts/observation.js` | Camera, thermal, SCADA, drone, and health observations share one validated shape; add unit tests.                                                     | `PLANNED` |
| PW-W0-004 | Define Evidence record.                          | W0-001                 | `src/pipelineWatch/contracts/evidence.js`    | Frame, clip, thermal matrix, SCADA payload, drone media, and field photo references validate; add unit tests.                                         | `PLANNED` |
| PW-W0-005 | Define Incident and Review records.              | W0-002, W0-003, W0-004 | `src/pipelineWatch/contracts/incident.js`    | State transitions, reviewer fields, severity, source references, and audit fields validate; add state-machine tests.                                  | `PLANNED` |
| PW-W0-006 | Define DispatchApproval and DispatchJob records. | W0-001, W0-005         | `src/pipelineWatch/contracts/dispatch.js`    | Approval records include incident, operator, time, and reason. Jobs require an approval reference and idempotency key; add unit tests. | `PLANNED` |
| PW-W0-007 | Add contract validation helpers and error codes. | W0-002 through W0-006  | `src/pipelineWatch/contracts/validation.js`  | Invalid payloads fail with stable errors; run contract test suite.                                                                                    | `PLANNED` |
| PW-W0-008 | Add deterministic fixture clock.                 | W0-001                 | `src/pipelineWatch/testing/clock.js`         | Tests can freeze, advance, and inspect time without using wall clock; add unit tests.                                                                 | `PLANNED` |

### W1 Fixtures, simulators, and replay

| ID        | Task                                           | Depends on                    | Primary write scope                     | Done when and verify                                                                                       | Status    |
| --------- | ---------------------------------------------- | ----------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| PW-W1-001 | Add one synthetic route with one segment.     | W0-002                        | `data/pipeline-fixtures/routes/`        | Fixture includes geometry, IDs, risk, visibility, and metadata; validate with the shared contracts.       | `PLANNED` |
| PW-W1-002 | Add visual camera replay fixture.              | W0-003, W1-001                | `data/pipeline-fixtures/cameras/`       | Fixture emits normal, intrusion, loitering, and nuisance scenes with timestamps.                           | `PLANNED` |
| PW-W1-003 | Add radiometric thermal replay fixture.        | W0-003, W0-004, W1-001        | `data/pipeline-fixtures/thermal/`       | Fixture includes temperature matrix, calibration metadata, visual pairing, and spill scenarios.            | `PLANNED` |
| PW-W1-004 | Add SCADA alarm and telemetry generator.       | W0-003, W1-001                | `data/pipeline-fixtures/scada/`         | Generator emits normal, alarm, stale, and bad-quality points with source timestamps.                       | `PLANNED` |
| PW-W1-005 | Add drone mission and media replay fixture.    | W0-003, W0-004, W1-001        | `data/pipeline-fixtures/drones/`        | Fixture covers requested, accepted, launched, failed, completed, and callback-duplicate states.            | `PLANNED` |
| PW-W1-006 | Add local mock dispatch adapter.                | W0-006                        | `data/pipeline-fixtures/dispatch/`      | Mock accepts one idempotency key, returns a stable job ID and simulated field update, and makes no external calls. | `PLANNED` |
| PW-W1-007 | Build deterministic replay runner.             | W0-008                        | `src/pipelineWatch/testing/replay.js`   | Replays supplied inputs in stable timestamp order using the fixture clock, without requiring every source; add replay test. | `PLANNED` |
| PW-W1-008 | Add failure switches to replay scenarios.      | W1-007, W1-012                | `src/pipelineWatch/testing/failures.js` | Simulate latency, disconnects, duplicate callbacks, stale/unavailable sources, and additional dispatch outcomes and retryable failures. | `PLANNED` |
| PW-W1-009 | Add one possible-spill observation fixture.    | W0-003, W0-004, W1-001        | `data/pipeline-fixtures/cameras/practice-spill.json` | One pre-labeled camera observation links the synthetic segment and evidence with fixed IDs and timestamps. | `PLANNED` |
| PW-W1-010 | Add practice-run incident and review steps.    | W0-005, W1-009                | `server/pipelineWatch/incidents/practiceReview.js` | Repeated input resolves to one incident; confirmation records the operator, reason, and time once.         | `PLANNED` |
| PW-W1-011 | Add practice-run response and closure steps.  | W1-006, W1-010                | `server/pipelineWatch/incidents/practiceResponse.js` | Confirmation sends no dispatch. Separate recorded approval allows one mock dispatch. A field update with closure evidence closes the incident. | `PLANNED` |
| PW-W1-012 | Verify the full practice run.                   | W1-007, W1-011                | `src/pipelineWatch/testing/practiceRun.test.mjs` | The Stage 1 gate below passes in the targeted test and in `npm test`.                                    | `PLANNED` |

#### Stage 1 practice run

- **Owner:** Coordinator / platform, with test infrastructure owning the replay verification.
- **Required tasks:** `PW-W0-001` through `PW-W0-008`, `PW-W1-001`, `PW-W1-006`, `PW-W1-007`, and `PW-W1-009` through `PW-W1-012`. The remaining fixtures, full console, global map, and live integrations are not dependencies. `PW-W0-007` is included because `PW-W1-001` validates fixtures with the shared contract helpers.
- **Verification:** Run `node --test src/pipelineWatch/testing/practiceRun.test.mjs`, then `npm test` after implementing the test.
- **Pass condition:** Zero dispatches on confirmation alone. Separate approval allows one mock dispatch. A field update without closure evidence leaves the incident open; a field update with evidence closes it. The audit trail records confirmation and approval separately. Replaying the same inputs against the same state adds no duplicate incidents, dispatches, decisions, approvals, or state changes.

### W2 Future persistent edge boundary

These tasks are intentionally deferred. They define compatibility boundaries only; they do not enable unattended monitoring in the pilot.

| ID        | Task                                              | Depends on     | Primary write scope                         | Done when and verify                                                                             | Status     |
| --------- | ------------------------------------------------- | -------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- |
| PW-W2-001 | Define future EdgeAgent interface.                | W0-003, W0-004 | `server/pipelineWatch/edge/interface.js`    | Interface consumes and emits shared contracts without coupling to browser UI; add contract test. | `DEFERRED` |
| PW-W2-002 | Define future heartbeat and site-health contract. | W0-001         | `src/pipelineWatch/contracts/edgeHealth.js` | Health fields cover session, feed, storage, model, clock, and connectivity state.                | `DEFERRED` |
| PW-W2-003 | Define future configuration-version contract.     | W0-001         | `src/pipelineWatch/contracts/edgeConfig.js` | Configuration includes version, validation result, rollout state, and rollback reference.        | `DEFERRED` |
| PW-W2-004 | Define future local event/evidence queue contract. | W0-003, W0-004 | `src/pipelineWatch/contracts/edgeQueue.js` | Queue contract covers local buffering of events, clips, and health signals with store-and-forward replay fields; add contract test. | `DEFERRED` |
| PW-W2-005 | Design the secure credential boundary for edge sites. | W0-001 | `docs/pipeline-watch-edge-credential-boundary.md` | Design documents how edge sites store and rotate camera, SCADA, drone, and dispatch credentials without exposing them to the control plane or browser; record review sign-off. | `DEFERRED` |

### W3 Source adapters

| ID        | Task                                          | Depends on     | Primary write scope                              | Done when and verify                                                                      | Status    |
| --------- | --------------------------------------------- | -------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------- |
| PW-W3-001 | Define source-adapter interface.              | W0-003, W0-004 | `server/pipelineWatch/adapters/interface.js`     | Adapter lifecycle, health, timestamps, and observation output are documented and tested.  | `PLANNED` |
| PW-W3-002 | Implement visual camera replay adapter.       | W3-001, W1-002 | `server/pipelineWatch/adapters/cameraReplay.js`  | Replay fixture produces validated observations and evidence references.                   | `PLANNED` |
| PW-W3-003 | Implement radiometric thermal replay adapter. | W3-001, W1-003 | `server/pipelineWatch/adapters/thermalReplay.js` | Adapter preserves matrix, calibration, pairing, and timestamp metadata.                   | `PLANNED` |
| PW-W3-004 | Define read-only SCADA adapter interface.     | W3-001, W1-004 | `server/pipelineWatch/adapters/scada.js`         | Adapter exposes points, alarms, quality, and source timestamps without write methods.     | `PLANNED` |
| PW-W3-005 | Define drone mission adapter interface.       | W3-001, W1-005 | `server/pipelineWatch/adapters/drone.js`         | Adapter supports mission request, callback, telemetry, media, and state transitions.      | `PLANNED` |
| PW-W3-006 | Define dispatch adapter interface.            | W0-006, W1-006 | `server/pipelineWatch/adapters/dispatch.js`      | Adapter supports idempotent send, retry, acknowledgement, and response updates.           | `PLANNED` |
| PW-W3-007 | Normalize source-health states.               | W3-001         | `server/pipelineWatch/adapters/health.js`        | Sources expose healthy, stale, offline, unavailable, and unsupported states consistently. | `PLANNED` |

### W4 Analytics and correlation

| ID        | Task                                              | Depends on                             | Primary write scope                                 | Done when and verify                                                                    | Status    |
| --------- | ------------------------------------------------- | -------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- | --------- |
| PW-W4-001 | Implement map-linked zone matching.               | W0-002, W0-003                         | `server/pipelineWatch/analytics/zones.js`           | Observations resolve to the correct segment/zone; add boundary tests.                   | `PLANNED` |
| PW-W4-002 | Implement zone schedules and maintenance snooze.  | W0-008, W4-001                         | `server/pipelineWatch/analytics/schedules.js`       | Active/inactive decisions are deterministic for time windows and expiry.                | `PLANNED` |
| PW-W4-003 | Implement intrusion policy.                       | W4-001, W4-002                         | `server/pipelineWatch/analytics/intrusion.js`       | Person/vehicle/motorcycle/boat entry creates a typed event with evidence.                          | `PLANNED` |
| PW-W4-004 | Implement loitering policy.                       | W4-001, W4-002                         | `server/pipelineWatch/analytics/loitering.js`       | Duration and displacement thresholds are configurable and tested.                       | `PLANNED` |
| PW-W4-005 | Implement digging/tampering policy.               | W4-001, W4-002                         | `server/pipelineWatch/analytics/tampering.js`       | Pattern rules produce explainable events with source detections.                        | `PLANNED` |
| PW-W4-006 | Implement nuisance filtering.                     | W4-003 through W4-005                  | `server/pipelineWatch/analytics/nuisance.js`        | Animal, vegetation, rain, and headlights can downgrade or suppress events with reasons. | `PLANNED` |
| PW-W4-007 | Implement thermal scene baseline.                 | W3-003, W0-008                         | `server/pipelineWatch/analytics/thermalBaseline.js` | Baseline varies by time/weather fixture and detects meaningful deviation.               | `PLANNED` |
| PW-W4-008 | Implement liquid area and spread tracking.        | W4-007                                 | `server/pipelineWatch/analytics/liquidSpread.js`    | Area, growth, and spread rate are calculated from replay frames.                        | `PLANNED` |
| PW-W4-009 | Implement oil/water/unknown evidence scoring.     | W4-008                                 | `server/pipelineWatch/analytics/liquidType.js`      | Visual and thermal cues produce explainable evidence without overstating certainty.     | `PLANNED` |
| PW-W4-010 | Implement weather/time confidence weighting.      | W4-009, W1-004                         | `server/pipelineWatch/analytics/confidence.js`      | Rain, fog, dawn, and dusk lower confidence according to policy tests.                   | `PLANNED` |
| PW-W4-011 | Implement cross-source correlation.               | W0-003, W4-003, W4-009, W3-004, W3-005 | `server/pipelineWatch/analytics/correlation.js`     | Related camera, thermal, SCADA, and drone observations share one incident context.      | `PLANNED` |
| PW-W4-012 | Implement incident deduplication.                 | W0-005, W4-011                         | `server/pipelineWatch/analytics/dedupe.js`          | Repeated observations and duplicate callbacks do not create duplicate incidents.        | `PLANNED` |
| PW-W4-013 | Implement severity and recommended-action policy. | W4-011, W4-012                         | `server/pipelineWatch/analytics/severity.js`        | Severity is deterministic, explainable, and covered by scenario tests.                  | `PLANNED` |
| PW-W4-014 | Implement camera-health degradation policy. | W0-003, W3-007 | `server/pipelineWatch/analytics/cameraHealth.js` | Sustained staleness, low confidence, and repeated nuisance patterns produce typed camera-health events with recommended remediation; add policy tests. | `PLANNED` |
| PW-W4-015 | Implement camera readiness scoring. | W0-002, W3-007 | `server/pipelineWatch/analytics/readiness.js` | Cameras score as Ready, Limited, or Not usable with plain-language gap reasons; metadata or health changes create timestamped re-scores; add unit tests. | `PLANNED` |
| PW-W4-016 | Implement segment coverage state and camera-gap report. | W0-002, W4-015 | `server/pipelineWatch/analytics/coverage.js` | Segments compute coverage state from camera readiness and geometry, and the gap report distinguishes configuration fixes from new-camera needs; add unit tests. | `PLANNED` |

### W5 Operator console and global map

| ID        | Task                                            | Depends on     | Primary write scope                       | Done when and verify                                                                              | Status    |
| --------- | ----------------------------------------------- | -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------- | --------- |
| PW-W5-001 | Add Pipeline and Segment client models.         | W0-002, W1-001 | `src/pipelineWatch/map/models.js`         | UI can load route, segment, visibility, source, and freshness metadata.                           | `PLANNED` |
| PW-W5-002 | Add global oil-pipeline route layer.            | W5-001         | `src/pipelineWatch/map/routes.js`         | Authorized oil pipelines render as route geometry on the world map.                               | `PLANNED` |
| PW-W5-003 | Add representative pipeline markers and labels. | W5-002         | `src/pipelineWatch/map/markers.js`        | World zoom shows one marker/label per authorized pipeline without excessive overlap.              | `PLANNED` |
| PW-W5-004 | Add map level-of-detail transitions.            | W5-002, W5-003 | `src/pipelineWatch/map/lod.js`            | World markers transition to route lines, then segments/assets at local zoom.                      | `PLANNED` |
| PW-W5-005 | Add route metadata and provenance panel.        | W5-001, W5-002 | `src/pipelineWatch/map/routeDetails.js`   | Selecting a route shows operator, product, region, source, freshness, confidence, and visibility. | `PLANNED` |
| PW-W5-006 | Add segment detail panel.                       | W5-001, W5-005 | `src/pipelineWatch/map/segmentDetails.js` | Segment view lists cameras, sensors, coverage, incidents, and readiness.                          | `PLANNED` |
| PW-W5-007 | Add zone editor.                                | W4-001, W5-006 | `src/pipelineWatch/zones/editor.js`       | Operator can create, edit, disable, schedule, and snooze a zone.                                  | `PLANNED` |
| PW-W5-008 | Add unified alert queue.                        | W0-005, W4-013 | `src/pipelineWatch/incidents/queue.js`    | Queue sorts by severity/age and opens the selected incident.                                      | `PLANNED` |
| PW-W5-009 | Add evidence panel.                             | W0-004, W5-008 | `src/pipelineWatch/incidents/evidence.js` | Visual, thermal, SCADA, drone, and field evidence render with provenance.                         | `PLANNED` |
| PW-W5-010 | Add review actions and reasons.                 | W0-005, W5-008 | `src/pipelineWatch/incidents/review.js`   | Confirm, dismiss, escalate, and more-review persist with operator and reason.                     | `PLANNED` |
| PW-W5-011 | Add dispatch approval, timeline, and field closure. | W0-006, W5-010 | `src/pipelineWatch/incidents/response.js` | Approval is separate from review. The timeline shows dispatch state and closure evidence. | `PLANNED` |
| PW-W5-012 | Add supervised session-health display.          | W3-007         | `src/pipelineWatch/health/session.js`     | Active, paused, stale, offline, and unavailable states are visible and actionable.                | `PLANNED` |
| PW-W5-013 | Add route and evidence visibility controls.     | W0-002, W5-005 | `src/pipelineWatch/access/visibility.js`  | Protected customer routes are not discoverable to unauthorized users.                             | `PLANNED` |
| PW-W5-014 | Add coverage/readiness layer and gap-report view. | W4-016, W5-006 | `src/pipelineWatch/map/coverage.js` | The map shows per-segment coverage and readiness states, and the camera-gap report is viewable from the console. | `PLANNED` |
| PW-W5-015 | Add drone mission map layer. | W5-004, W6-004 | `src/pipelineWatch/map/droneMissions.js` | Requested, active, completed, and failed missions render on the map with state and source visible to authorized operators. | `PLANNED` |
| PW-W5-016 | Add mobile-friendly response and closure view. | W5-011 | `src/pipelineWatch/incidents/mobile.js` | An operator can review, approve dispatch, and record field closure from a phone-sized viewport without desktop-only controls. | `PLANNED` |
| PW-W5-017 | Add route geometry import for GeoJSON and KML. | W0-002 | `src/pipelineWatch/map/import.js` | An approved GeoJSON or KML source imports into Pipeline and Segment records preserving route IDs, segment IDs, and coordinate reference information; add unit tests. | `PLANNED` |

### W6 Integrations and response

| ID        | Task                                   | Depends on     | Primary write scope                                   | Done when and verify                                                        | Status    |
| --------- | -------------------------------------- | -------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- | --------- |
| PW-W6-001 | Map SCADA points to pipeline segments. | W0-002, W3-004 | `server/pipelineWatch/integrations/scadaMapping.js`   | Approved tags resolve to the correct route/station/segment.                 | `PLANNED` |
| PW-W6-002 | Add SCADA alarm focus behavior.        | W6-001, W5-006 | `src/pipelineWatch/integrations/scadaFocus.js`        | Alarm selects the relevant map context and evidence sources.                | `PLANNED` |
| PW-W6-003 | Add drone mission request flow.        | W3-005, W5-010 | `src/pipelineWatch/integrations/droneMission.js`      | Confirmed incident creates one reviewable mission request.                  | `PLANNED` |
| PW-W6-004 | Add drone mission status callbacks.    | W3-005, W0-005 | `server/pipelineWatch/integrations/droneStatus.js`    | Mission states update the incident timeline idempotently.                   | `PLANNED` |
| PW-W6-005 | Add dispatch outbound request.         | W3-006, W5-011 | `server/pipelineWatch/integrations/dispatchSend.js`   | Reject dispatch without separate, recorded approval. Approved requests are auditable and idempotent. | `PLANNED` |
| PW-W6-006 | Add dispatch response callbacks.       | W3-006, W0-006 | `server/pipelineWatch/integrations/dispatchStatus.js` | External statuses update the dispatch job; external `closed` status alone does not close the incident. | `PLANNED` |
| PW-W6-007 | Add field closure endpoint.            | W0-004, W0-005 | `server/pipelineWatch/integrations/fieldClosure.js`   | A dispatched incident remains open until a field update includes closure evidence. | `PLANNED` |
| PW-W6-008 | Add incident, audit, and coverage export. | W0-005, W0-006, W4-016 | `server/pipelineWatch/integrations/export.js` | Export includes source, evidence references, decisions, response state, and segment coverage state. | `PLANNED` |
| PW-W6-009 | Add SMS/email dispatch fallback. | W6-005 | `server/pipelineWatch/integrations/dispatchFallback.js` | An approved dispatch that cannot reach the webhook is delivered through the SMS/email fallback with the same approval reference and idempotency key; add unit tests. | `PLANNED` |
| PW-W6-010 | Add SCADA operator acknowledgement. | W6-002 | `server/pipelineWatch/integrations/scadaAcknowledgement.js` | Operators acknowledge SCADA alarms; acknowledgements are audited and no control writes are issued to SCADA; add a test asserting zero SCADA writes. | `PLANNED` |
| PW-W6-011 | Add response-lead notification. | W0-005, W5-010 | `server/pipelineWatch/integrations/notifications.js` | Confirming or escalating an incident with an assigned response lead sends one notification containing the incident payload; add unit tests. | `PLANNED` |
| PW-W6-012 | Define the SCADA command boundary with control disabled by default. | W6-001 | `server/pipelineWatch/integrations/scadaCommandGate.js` | No control-write path exists unless an explicit safety gate is configured, and the separately authorized command boundary is documented; add a test asserting control writes stay disabled by default. | `PLANNED` |

### W7 Security, audit, and pilot operations

| ID        | Task                                         | Depends on             | Primary write scope                         | Done when and verify                                                                | Status    |
| --------- | -------------------------------------------- | ---------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- | --------- |
| PW-W7-001 | Add append-only audit event writer.          | W0-005, W0-006         | `server/pipelineWatch/audit/events.js`      | Every review, dispatch, callback, and configuration change is recorded.             | `PLANNED` |
| PW-W7-002 | Add privacy-mask model and rendering policy. | W0-002, W5-009         | `src/pipelineWatch/privacy/masks.js`        | Masked areas are applied consistently to evidence views.                            | `PLANNED` |
| PW-W7-003 | Add retention metadata and cleanup policy.   | W0-004, W0-005         | `server/pipelineWatch/storage/retention.js` | Evidence and audit records expose retention state and safe cleanup behavior.        | `PLANNED` |
| PW-W7-004 | Add pilot operator identity boundary.        | W0-005, W5-010         | `server/pipelineWatch/access/operator.js`   | Reviews and dispatch actions use a named operator identity.                         | `PLANNED` |
| PW-W7-005 | Add secret/configuration boundary checks.    | W3-001, W6-005         | `server/pipelineWatch/security/secrets.js`  | Camera, SCADA, drone, and dispatch secrets never enter browser payloads.            | `PLANNED` |
| PW-W7-006 | Add supervised pilot runbook.                | W5-012, W6-008         | `docs/runbooks/pipeline-watch-pilot.md`     | Runbook covers startup, monitoring state, recovery, review, dispatch, and shutdown. | `PLANNED` |
| PW-W7-007 | Add end-to-end pilot verification script.    | W1-007, W5-010, W6-008 | `scripts/pipeline-watch-pilot-check.mjs`    | One command runs the core replay and reports pass/fail by workstream.               | `PLANNED` |

## 6. Progress update procedure

After a task is implemented:

1. Run its listed verification plus the relevant broader test suite.
2. Inspect the actual diff and confirm the write scope stayed narrow.
3. Update the task status to `REVIEW` in the handoff, not by editing this file mid-task.
4. The coordinator reviews the handoff, merges the work, and changes the tracker row to `DONE` or `BLOCKED`.
5. If the task reveals new work, add a new task ID rather than expanding the completed task.
6. Update the workstream rollup only after the task status is accepted.

### Definition of done for any task

- Acceptance statement is demonstrably true.
- Tests or deterministic verification pass.
- No unrelated files changed.
- Contracts and behavior are documented where another agent needs them.
- Handoff includes changed files, commands, result, and follow-ups.

## 7. Coordinator review checklist

Before assigning a task:

- Is the task independent enough to assign?
- Are all dependencies complete?
- Is the write scope disjoint from active tasks?
- Does the acceptance statement describe observable behavior?
- Is the verification command available or included in the task?
- Is the task truly in current scope rather than the deferred edge track?

Before marking it done:

- Does the diff match the task only?
- Did the deterministic checks pass?
- Does the implementation preserve source provenance and safety boundaries?
- Did the agent report any unresolved assumptions?
- Should a follow-up task be created?

## 8. PRD requirement coverage

Every requirement ID from [PRD §8 Functional requirements](PRD_PIPELINE_WATCH.md#8-functional-requirements) maps to the tracker task or tasks that implement it. Rows marked `Unplanned (P1)` are intentionally not yet assigned; revisit them before the stage that needs them. Rows marked `(deferred)` are P2 edge-monitoring requirements implemented by `DEFERRED` W2 tasks (see §3); `PW-EDGE-04` is the one row mapped to a plan reference — master plan Stage 6 — rather than a task ID, because its watchdog and worker-restart work is deliberately unscheduled. Where a mapped task's done-when criteria do not spell out an acceptance nuance (for example the PW-SEG-01 import path, PW-SCADA-02 valve and camera-group scoping, or the PW-LEAK-06 24-hour lookback), the PRD requirement text remains authoritative. Keep this appendix in sync when tasks are added or changed.

| PRD ID | Priority | Covered by | Notes |
| --- | --- | --- | --- |
| PW-SEG-01 | P0 | PW-W5-001, PW-W5-002, PW-W1-001 | Route and segment records, map layer, fixture geometry. |
| PW-SEG-02 | P0 | PW-W5-002, PW-W5-003 | World-zoom markers and labels. |
| PW-SEG-03 | P0 | PW-W5-004, PW-W5-006 | Level-of-detail drill-down into segments. |
| PW-SEG-04 | P0 | PW-W5-004, PW-W5-014 | Styling by status, risk, coverage, and incident state. |
| PW-SEG-05 | P0 | PW-W5-017, PW-W1-001 | GeoJSON/KML import plus fixture geometry. |
| PW-SEG-06 | P0 | PW-W5-013 | Route visibility and access controls. |
| PW-SEG-07 | P0 | PW-W5-013, PW-W5-005 | Reference vs customer-owned route provenance. |
| PW-SEG-08 | P1 | PW-W5-005 | Route metadata panel. |
| PW-SEG-09 | P0 | PW-W5-006 | Segment metadata in detail panel. |
| PW-SEG-10 | P0 | PW-W5-006, PW-W1-001 | Linked cameras and coverage in segment view. |
| PW-SEG-11 | P1 | Unplanned (P1) | Segment types; revisit before type-specific guidance is needed. |
| PW-CAM-01 | P0 | PW-W5-001, PW-W3-007 | Camera metadata and health states. |
| PW-CAM-02 | P0 | PW-W4-015 | Readiness scoring. |
| PW-CAM-03 | P0 | PW-W4-015, PW-W5-014 | Plain-language gap reasons and the gap-report view. |
| PW-CAM-04 | P1 | Unplanned (P1) | Customer camera metadata adapter. |
| PW-CAM-05 | P1 | PW-W4-015 | Re-scoring on metadata or health change is part of the readiness task. |
| PW-ZONE-01 | P0 | PW-W5-007, PW-W4-001 | Zone editor and matching. |
| PW-ZONE-02 | P0 | PW-W4-002, PW-W5-007 | Schedules and maintenance snooze. |
| PW-ZONE-03 | P0 | PW-W4-003 | Detection classes include motorcycles. |
| PW-ZONE-04 | P0 | PW-W4-003, PW-W4-004 | Intrusion and loitering events. |
| PW-ZONE-05 | P1 | PW-W4-005 | Digging/tampering policy. |
| PW-ZONE-06 | P0 | PW-W4-006 | Nuisance filtering. |
| PW-INC-01 | P0 | PW-W4-011, PW-W4-012, PW-W5-008 | Grouping, dedupe, and alert queue. |
| PW-INC-02 | P0 | PW-W4-011 | Cross-camera grouping. |
| PW-INC-03 | P0 | PW-W4-013, PW-W5-008, PW-W5-009 | Severity, queue, and evidence display. |
| PW-INC-04 | P0 | PW-W5-010 | Review decisions. |
| PW-INC-05 | P0 | PW-W5-010 | Dismissal reasons and notes. |
| PW-INC-06 | P0 | PW-W7-004, PW-W7-001 | Operator identity and audit trail. |
| PW-INC-07 | P1 | PW-W6-011 | Response-lead notification. |
| PW-INC-08 | P1 | Unplanned (P1) | Nearby-camera handoff. |
| PW-COV-01 | P0 | PW-W4-016, PW-W5-014 | Coverage state compute and view. |
| PW-COV-02 | P0 | PW-W4-016, PW-W5-014 | Camera-gap report compute and view. |
| PW-COV-03 | P1 | Unplanned (P1) | Incident hotspots. |
| PW-COV-04 | P1 | PW-W6-008 | Export extended to include coverage data. |
| PW-LEAK-01 | P0 | PW-W1-003, PW-W3-003 | Thermal fixture and adapter. |
| PW-LEAK-02 | P0 | PW-W4-007, PW-W4-008 | Baseline and spread tracking. |
| PW-LEAK-03 | P0 | PW-W4-009 | Liquid color/sheen/texture/temperature evidence. |
| PW-LEAK-04 | P0 | PW-W4-009 | Oil/water/unknown confidence. |
| PW-LEAK-05 | P0 | PW-W4-010 | Weather/time-of-day weighting. |
| PW-LEAK-06 | P0 | PW-W4-011 | Cross-source correlation links spill alerts to recent incidents. |
| PW-LEAK-07 | P1 | Unplanned (P1) | Warm/cold leak signatures. |
| PW-EDGE-01 | P2 | PW-W2-001 (deferred) | Edge-agent interface. |
| PW-EDGE-02 | P2 | PW-W2-004 (deferred) | Local event/evidence queue contract. |
| PW-EDGE-03 | P2 | PW-W2-002 (deferred) | Heartbeat and health telemetry contract. |
| PW-EDGE-04 | P2 | Master plan Stage 6 (deferred) | Watchdogs and worker restart are Stage 6 implementation work; no contract task needed yet. |
| PW-EDGE-05 | P2 | PW-W2-005 (deferred), PW-W7-005 | Credential boundary design and server-side secret checks. |
| PW-EDGE-06 | P2 | PW-W2-003 (deferred) | Configuration versioning and rollback contract. |
| PW-SCADA-01 | P0 | PW-W1-004, PW-W3-004 | SCADA generator and read-only adapter. |
| PW-SCADA-02 | P0 | PW-W6-001 | Tag mapping. |
| PW-SCADA-03 | P0 | PW-W4-011, PW-W6-002 | Correlation and alarm focus. |
| PW-SCADA-04 | P0 | PW-W6-002, PW-W5-009 | Source labeling in alarm focus and evidence panel. |
| PW-SCADA-05 | P0 | PW-W6-010 | Operator acknowledgement without control writes. |
| PW-SCADA-06 | P1 | PW-W6-012 | Command boundary with control disabled by default. |
| PW-DRONE-01 | P0 | PW-W5-015, PW-W6-004 | Mission map layer and status callbacks. |
| PW-DRONE-02 | P0 | PW-W6-003, PW-W3-005 | Mission request flow and adapter. |
| PW-DRONE-03 | P0 | PW-W5-009, PW-W3-005 | Drone evidence in the evidence panel. |
| PW-DRONE-04 | P0 | PW-W6-004, PW-W1-005 | Mission state transitions. |
| PW-DRONE-05 | P1 | Unplanned (P1) | Detection and spill analysis on drone footage. |
| PW-DISP-01 | P0 | PW-W5-011, PW-W6-005, PW-W0-006 | Separate approval and outbound dispatch. |
| PW-DISP-02 | P0 | PW-W6-006, PW-W5-011 | Response callbacks and timeline. |
| PW-DISP-03 | P0 | PW-W6-005, PW-W6-009 | Webhook plus SMS/email fallback. |
| PW-DISP-04 | P0 | PW-W6-005, PW-W6-006 | Idempotent dispatch and callbacks. |
| PW-DISP-05 | P0 | PW-W6-007, PW-W5-011 | Field closure with evidence. |

Enabling tasks (shared contracts, fixtures, replay, validation, and audit plumbing) intentionally have no §8 row. `PW-W5-016` maps to PRD §11 Milestone 2 (mobile-friendly response and closure view) rather than a numbered §8 requirement.
