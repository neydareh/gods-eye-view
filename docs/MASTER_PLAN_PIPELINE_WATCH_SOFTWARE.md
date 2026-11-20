# Pipeline Watch Software Master Plan

**Product:** God's Eye View  
**Program:** Pipeline Watch  
**Status:** Proposed implementation plan  
**Date:** November 19, 2026  
**Related document:** [Pipeline Watch Product Requirements Document](PRD_PIPELINE_WATCH.md)

## 1. Purpose

This plan turns Pipeline Watch into an implementable software program. It covers the supervised operator application, thermal analytics, SCADA correlation, drone workflows, dispatch integration, data contracts, testing, deployment, and pilot readiness. Persistent 24/7 edge monitoring is a later production track, not a requirement for the initial pilot.

The first milestone is a practice run with one synthetic event and no live connections. Visual cameras, thermal cameras, SCADA, drones, and dispatch remain part of the launch architecture, but do not all have to be simulated to pass the first milestone. Mocks use the same contracts as their eventual real integrations.

### Execution tracking

Use the [Pipeline Watch Workstream Tracker](PIPELINE_WATCH_WORKSTREAM_TRACKER.md) as the operational source of truth for implementation progress. The tracker breaks this plan into atomic tasks with IDs, dependencies, primary write scopes, acceptance criteria, verification commands, statuses, and handoff rules for humans and code agents. Keep task status updates in the tracker and keep architectural decisions in this master plan.

## 2. Product outcome

Pipeline Watch should take an observation from any supported source and move it through one controlled workflow:

`source -> edge observation -> correlation -> incident -> human review -> separate dispatch approval -> dispatch -> field update with evidence -> closure`

The browser-led session is the monitoring source of truth for the pilot. The persistent edge agent is a future source of truth that will consume the same contracts.

## 3. Engineering principles

1. **Contract-first:** source adapters, edge events, incidents, and integrations use versioned schemas before real hardware is connected.
2. **Replay before live:** every detection and integration path must work with deterministic fixtures and recorded events.
3. **Human-controlled response:** models recommend; operators review; dispatch requires a separate, audited approval. Confirmation or escalation alone does not dispatch.
4. **Read-only OT boundary:** SCADA alarms and telemetry are inbound in the initial release. No valve or control writes are enabled by default.
5. **Partner-controlled drones:** the software requests missions and consumes telemetry/media; flight safety and direct piloting remain outside the product boundary.
6. **Supervised-first processing:** the pilot makes session health, stale feeds, and browser/server interruptions visible; it does not claim unattended 24/7 coverage.
7. **Observable failure:** offline sites, stale feeds, model failures, dropped events, retries, and partial integrations must be visible.
8. **Future-compatible boundary:** preserve a clean edge-agent interface without taking on persistent deployment complexity before the pilot proves the workflow.

## 4. Starting point in the current application

The current repository provides useful building blocks:

- CCTV source catalog, proxy, feed playback, health state, and camera positioning.
- Camera coverage and view-shed geometry on the map.
- Local YOLO scan endpoint and normalized detections.
- Deterministic suspicious-behavior rules for lingering, stopped vehicles, crowding, and objects left behind.
- Saved analysis reports and append-only human review records.
- Map-first UI, camera focus, shareable state, and existing test infrastructure.

The implementation should extend these foundations. It should not replace them with a separate application or make the browser responsible for persistent monitoring.

## 5. Target architecture

### 5.1 Future edge agent

The edge agent is a later long-running process deployed inside the customer's network or site enclosure. The initial pilot does not depend on the edge agent's contracts or its deployment; all W2 edge-boundary work, including the contract definitions, is deferred until the supervised pilot is accepted.

Responsibilities:

- Connect to visual and thermal feeds.
- Consume approved SCADA alarms and telemetry.
- Receive drone mission/media callbacks or replayed patrol data.
- Run inference and deterministic policy rules.
- Normalize observations into the shared event contract.
- Correlate observations across cameras, thermal sensors, SCADA, and drones.
- Store events and selected evidence locally when the upstream link is unavailable.
- Synchronize with the control plane using idempotent delivery.
- Report health, storage, clock, model, feed, and queue state.
- Apply signed or authenticated configuration updates with rollback.

When this track begins, the first implementation can run as a local Node process or container on a developer workstation before moving to an industrial edge computer.

### 5.2 Control plane

The control plane manages fleet configuration and operational records.

Core services:

- Pipeline and segment registry.
- Camera, thermal sensor, SCADA tag, drone, and edge-site registry.
- Zone and policy configuration.
- Incident API and correlation state.
- Review and audit store.
- Dispatch adapter and response-state updates.
- Notification routing.
- Configuration versioning and rollout state.
- Coverage/readiness reports.

The control plane may run locally, on-premise, or in an in-country cloud deployment. The software must not assume that raw video is available centrally.

### 5.3 Operator application

Pipeline Watch should add an operational surface around the current CCTV/map experience:

- Pipeline and segment map.
- Global oil-pipeline route layer with representative markers, route labels, and zoom-level detail.
- Coverage/readiness layer.
- Alert queue sorted by severity, age, and response state.
- Evidence panel with visual, thermal, SCADA, and drone context.
- Incident timeline.
- Human review actions.
- Dispatch status and field closure.
- Edge-site and source health.
- Configuration screens for zones, schedules, and camera/segment links.
- Coverage gap and incident exports.

## 6. Shared domain contracts

All adapters should produce the same source-independent records.

### 6.1 Observation

```json
{
  "schemaVersion": 1,
  "id": "obs_...",
  "source": {
    "kind": "camera|thermal|scada|drone",
    "sourceId": "...",
    "edgeSiteId": "..."
  },
  "pipelineId": "...",
  "segmentId": "...",
  "capturedAt": "2026-11-17T18:00:00.000Z",
  "receivedAt": "2026-11-17T18:00:02.000Z",
  "type": "person|vehicle|liquid|scada_alarm|drone_mission|health",
  "confidence": 0.86,
  "location": { "lat": 0, "lon": 0 },
  "evidence": [],
  "attributes": {},
  "provenance": { "modelVersion": "...", "policyVersion": "..." }
}
```

### 6.2 Incident

An incident groups observations that refer to the same event in time and space.

Required fields:

- Stable incident ID and idempotency key.
- Pipeline and segment.
- Severity, confidence, and incident type.
- Source observations and evidence references.
- Current state and response state.
- Created, acknowledged, reviewed, dispatched, and closed timestamps.
- Assigned operator and response lead.
- Recommended action.
- Human decision history.
- Separate dispatch approval and closure evidence references, when present.

### 6.3 Evidence

Evidence should reference rather than duplicate large media where possible:

- Source ID and capture time.
- Frame, clip, thermal matrix, SCADA payload, drone media, or field photo.
- Local edge URI and synchronized control-plane URI, if available.
- Hash, retention expiry, and access policy.
- Redaction/privacy-mask status.

### 6.4 Integration command

Outbound commands must be idempotent and auditable:

- Command ID and incident ID.
- Adapter name and external system ID.
- Requested action and payload version.
- Retry count and next retry time.
- External acknowledgement and status.
- Human authorizing the action; dispatch commands reference the separate approval record, which includes the operator, timestamp, and reason.

## 7. Software workstreams

### W0 Foundation and contracts

Deliverables:

- Domain types and schema versioning.
- Pipeline, segment, source, edge-site, incident, review, evidence, and dispatch models.
- Fixture loader and deterministic clock.
- Correlation/idempotency utilities.
- Contract tests for every adapter.

Exit gate: a complete simulated observation can be validated, persisted, replayed, and grouped into an incident.

### W1 Simulation and replay lab

Deliverables:

- Synthetic pipeline route and segment fixtures.
- Recorded visual camera fixtures.
- Radiometric thermal fixtures with temperature matrices and calibration metadata.
- SCADA alarm/telemetry generator.
- Drone mission and media replay generator.
- Dispatch webhook simulator.
- Network loss, latency, clock drift, storage-full, and worker-crash scenarios.

Exit gate: the entire event-to-response flow runs deterministically without physical hardware.

### W2 Future edge boundary

Deliverables:

- Edge-agent process boundary and adapter interface.
- Future local event/evidence queue contract.
- Future heartbeat and health telemetry contract.
- Future configuration versioning and rollback contract.
- Secure credential boundary design.
- No unattended monitoring dependency in the pilot.

These deliverables map to tracker tasks `PW-W2-001` through `PW-W2-005`; every W2 task is `DEFERRED` until the supervised pilot is accepted.

Exit gate: future edge work can consume pilot observations and incidents without changing the operator or integration contracts.

### W3 Source adapters

Deliverables:

- Visual camera adapter for RTSP/secure ONVIF/VMS feeds.
- Thermal adapter preserving radiometric values and calibration metadata.
- SCADA adapter interface with a read-only reference implementation.
- Drone partner adapter interface for missions, telemetry, and media callbacks.
- Source health and freshness checks.

Exit gate: each source produces the shared observation contract and can be replayed through the same correlation pipeline.

### W4 Analytics and correlation

Deliverables:

- Person, vehicle, motorcycle, boat, intrusion, loitering, digging-like, tampering-like, and camera-health policies.
- Liquid detection and spread tracking.
- Oil/water/unknown evidence model.
- Camera readiness scoring with plain-language gap reasons.
- Segment coverage state and camera-gap reporting.
- Weather/time-of-day confidence weighting.
- SCADA/camera/thermal/drone correlation.
- Cross-camera and cross-source incident grouping.
- Severity and recommended-action policy.

Exit gate: staged events produce explainable incidents with source provenance and no duplicate alert flood.

### W5 Operator console

Deliverables:

- Pipeline and segment map layer.
- Global oil-pipeline inventory layer with route geometry, representative markers, source/freshness metadata, and private-route access controls.
- Zoom-level rendering that uses markers at world view, route lines at regional view, and segments/assets at local view.
- Zone and schedule editor.
- Coverage/readiness view backed by computed readiness and coverage states, including the camera-gap report.
- Drone mission map layer with mission state and source.
- Mobile-friendly response and closure view.
- Unified alert queue.
- Evidence panel with side-by-side visual/thermal context.
- Incident timeline.
- Confirm, dismiss, escalate, and more-review actions.
- Separate dispatch approval, dispatch state, and field closure with evidence.
- Edge/source health views.

Exit gate: an operator can understand, decide, dispatch, and close an event without leaving Pipeline Watch.

### W6 Integrations and response

Deliverables:

- Webhook dispatch adapter.
- SMS/email fallback.
- SCADA operator acknowledgement without control writes.
- SCADA command boundary with control disabled by default.
- Response-lead notification on confirm or escalate.
- One SCADA protocol integration.
- One drone partner integration or partner sandbox.
- Field response update endpoint.
- Export formats for incident, audit, and coverage data.

Exit gate: confirmation or escalation alone does not dispatch. A separate approval allows one auditable dispatch, and a field update with closure evidence is required to close the dispatched incident.

### W7 Security, deployment, and operations

Deliverables:

- Role-based access and operator identity.
- SSO/MFA integration boundary.
- Encryption and secret management.
- Privacy masks and evidence access policy.
- Retention and deletion jobs.
- Edge fleet monitoring.
- Deployment bundles and upgrade/rollback procedure.
- Backup, restore, and incident-recovery runbooks.

Exit gate: the pilot deployment can be operated, upgraded, audited, and recovered without manual database editing.

## 8. Dependency-ordered implementation plan

The schedule below is indicative and should be adjusted after the first contract review.

### Stage 1: Practice run (simulated end-to-end flow)

Build only the W0 and W1 tasks needed for [one deterministic practice run](PIPELINE_WATCH_WORKSTREAM_TRACKER.md#stage-1-practice-run). The goal is to prove the operator workflow, not detection accuracy.

- Replay one pre-labeled possible-spill observation from a simulated camera on one synthetic pipeline segment. Create one incident with a reference to the simulated evidence.
- Have a named operator confirm the incident, then separately approve one mock dispatch. Record who approved it, when, and why. The practice run never sends a real notification or dispatch.
- Apply a simulated field update with closure evidence to close the incident. A local test harness is enough; the full operator console is not required.

**Gate:** the replay test proves that confirmation alone sends no dispatch and that a field update without closure evidence leaves the incident open. With separate approval and a field update containing evidence, the incident closes with an attributable audit trail. Replaying the same inputs against the same state leaves one incident and one mock dispatch with no duplicate decisions, approvals, or state changes.

Do not make this gate depend on real feeds, thermal classification, SCADA or drone simulators, a global map, or unattended monitoring.

### Stage 2: Core analytics and supervised monitoring

Build W3, W4, and the core of W5. All W2 edge-boundary work stays deferred until the supervised pilot is accepted.

- Keep the monitoring session browser-led.
- Add visual and thermal replay.
- Add SCADA correlation.
- Add the drone simulator and expand the mock dispatch scenarios from Stage 1.
- Add source and session health.
- Add explicit stale/offline states and operator recovery prompts.

**Gate:** the supervised session produces explainable incidents and clearly reports when monitoring is interrupted.

### Stage 3: Operator workflow

Build W5 against the simulated and replayed backends.

- Map segments and source coverage.
- Configure zones and schedules.
- Review evidence.
- Confirm/dismiss/escalate.
- Approve dispatch separately and close dispatched incidents only with a field update containing closure evidence.

**Gate:** a trained operator can complete the workflow in one session.

### Stage 4: Live integration and hardware-in-the-loop

Build W6 and connect one real source at a time.

**Entry gate:** before connecting customer systems, verify operator identity, server-side credential handling, role-based evidence access, and privacy and retention controls. Keep adapters in simulation or a sandbox until these checks pass. Before enabling live dispatch, also verify that authorization is enforced and retries cannot create duplicate dispatches.

1. Real visual camera or secure VMS feed.
2. Real radiometric thermal camera.
3. Real read-only SCADA connection.
4. Drone provider sandbox or partner integration.
5. Live dispatch endpoint.

**Gate:** each live source passes contract, latency, health, failure, and audit tests without changing the supervised operator workflow.

### Stage 5: Pilot hardening

Build W7 and complete production-readiness work.

- Operational hardening of the access, secrets, and evidence controls already required by Stage 4; observability, deployment, backup, and runbooks.
- Load and soak tests.
- Session interruption and recovery tests.
- Controlled spill and security tests.
- Customer acceptance and safety review.

**Gate:** the pilot can run for the agreed supervised observation window with complete auditability and explicit session limitations.

### Stage 6: Future persistent monitoring

Begin W2 as a production track after the supervised pilot demonstrates product value and the deployment model is approved.

- Implement the long-running edge process.
- Add local queueing, store-and-forward, watchdogs, and site heartbeat.
- Run browser-independent monitoring and reconnect tests.
- Add fleet configuration, rollout, rollback, and edge hardware qualification.

**Gate:** unattended monitoring is separately accepted for operational, safety, security, and customer requirements.

## 9. Repository implementation map

Suggested additions, preserving current boundaries:

```text
src/pipelineWatch/
  contracts/           Shared client-safe domain contracts and schema versions
  testing/             Fixture clock and replay tests (*.test.mjs)
  map/                 Pipeline, segment, zone, coverage overlays
  incidents/           Queue, detail, review, timeline
  evidence/            Visual, thermal, SCADA, drone evidence views
  health/              Edge and source health presentation

server/pipelineWatch/
  contracts/           Validation and schema versions
  incidents/           Correlation, grouping, state transitions
  dispatch/             Adapter interface and retry/idempotency
  scada/                Read-only adapter interface
  drones/               Mission/media adapter interface
  edge/                 Future edge runtime boundary, queue, sync, watchdog
  storage/              Incident, evidence, audit, and config stores

data/pipeline-fixtures/
  routes/
  cameras/
  thermal/
  scada/
  drones/
  dispatch/
```

Place automated Pipeline Watch tests under `src/pipelineWatch/` so `npm test` discovers them.

The existing CCTV provider and analysis modules should remain compatible. Pipeline Watch should consume their normalized outputs during the supervised pilot, then gradually move persistent analysis into the future edge runtime.

## 10. Test strategy

### Unit tests

- Schema validation and version migration.
- Zone matching and schedules.
- Camera readiness scoring and coverage computation.
- Thermal baseline, liquid spread, and confidence weighting.
- Incident grouping and severity.
- Idempotency and retry behavior.
- SCADA tag-to-segment mapping.
- Drone mission state transitions.
- Dispatch state transitions.
- Review state machine and audit records.

### Replay tests

Use fixed timestamps and fixtures to replay:

- Normal scene with no event.
- Intrusion at night.
- Rain and animal false triggers.
- Visual liquid without thermal agreement.
- Thermal liquid with weak visual confirmation.
- SCADA alarm with supporting camera evidence.
- SCADA alarm without camera evidence.
- Drone mission requested, delayed, failed, and completed.
- Dispatch timeout, retry, duplicate, acknowledgement, and closure.

### Resilience tests

- Browser/session interruption.
- Camera disconnect.
- Thermal sensor unavailable.
- SCADA gateway unavailable.
- Drone callback delayed or duplicated.
- Dispatch endpoint unavailable.
- Network partition and reconnect.
- Disk nearly full.
- Clock drift or time-sync failure.

Future edge-track resilience tests will add browser-independent monitoring, edge worker crashes, store-and-forward, and watchdog recovery.

### Hardware-in-the-loop tests

Hardware is introduced only after replay tests pass. Each real source must be tested for:

- Stream compatibility.
- Timestamp accuracy.
- Latency.
- Health and recovery.
- Credential rotation.
- Evidence retention.
- Environmental and power interruption behavior.

## 11. Safety and security gates

These are release gates, not backlog items to defer indefinitely:

- No direct SCADA control writes in the initial release.
- No direct drone flight control in the initial release.
- Every dispatch request requires a separate approval recorded by an authorized operator; confirmation or escalation alone is not approval.
- Every incident decision is append-only and attributable to an operator.
- An external dispatch status of `closed` does not close the incident without a field update containing closure evidence.
- Raw video and thermal streams are handled according to the supervised pilot's explicit evidence policy.
- Evidence access is role-controlled and retention-limited.
- Camera and SCADA credentials never enter browser code or client-visible URLs.
- All external integration retries are idempotent.
- Health state distinguishes “not monitored,” “offline,” “stale,” and “healthy.”
- Model output is always labeled as automated evidence until human review.
- The pilot never presents itself as unattended 24/7 monitoring.

## 12. Definition of software pilot readiness

The software pilot is ready when:

- A synthetic end-to-end flow passes deterministically.
- The supervised monitoring session exposes active, stale, paused, and unavailable states.
- Visual and radiometric thermal observations use the same contract.
- SCADA alarms correlate with other evidence without issuing control writes.
- Drone missions and media callbacks are represented in incidents.
- Dispatch requests are idempotent and receive response updates.
- Operators can review and close incidents with evidence.
- Camera readiness and per-segment coverage states are computed, visible, and explained.
- Network loss does not silently drop events.
- All state changes are auditable.
- The system exposes its own health and configuration versions.
- At least one live source passes hardware-in-the-loop validation.

Persistent edge readiness is explicitly outside the pilot definition and is assessed in the future monitoring track.

## 13. Immediate engineering backlog

The detailed, assignable backlog now lives in the [Pipeline Watch Workstream Tracker](PIPELINE_WATCH_WORKSTREAM_TRACKER.md). The list below remains a short program-level summary; do not assign it directly when an atomic tracker task exists.

Start with the [Stage 1 practice run](PIPELINE_WATCH_WORKSTREAM_TRACKER.md#stage-1-practice-run). The broader backlog below is not a prerequisite for that gate.

1. Create the Pipeline Watch domain package and schema version constants.
2. Define `Pipeline`, `Segment`, `Observation`, `Evidence`, `Incident`, `Review`, `DispatchApproval`, `DispatchJob`, and `EdgeHeartbeat` contracts.
3. Build a deterministic fixture clock and replay runner.
4. Add a global oil-pipeline route fixture with representative markers, source metadata, and private-route visibility states.
5. Add zoom-level map rendering from world marker to route line to local segment/asset detail.
6. Add per-source synthetic fixtures: a pipeline route with segments, visual and thermal camera scenes, SCADA tags, and a drone mission/media replay.
7. Implement incident grouping and idempotency utilities.
8. Implement a mock dispatch webhook with retry and response-state simulation.
9. Implement a mock SCADA adapter and alarm generator.
10. Implement a mock drone mission adapter and media replay.
11. Add explicit monitoring-session health and stale/offline UI states.
12. Add a Pipeline Watch alert queue backed by simulated incidents.
13. Add replay tests for spill, intrusion, SCADA correlation, drone callbacks, dispatch failure, and session interruption.
14. Define the future edge-agent interface without implementing unattended monitoring.
15. Update the PRD with the selected deployment, thermal, SCADA, drone, dispatch, and pipeline-data choices.

## 14. Decisions required before live integration

- First pilot deployment model: hybrid, fully on-premise, or in-country cloud.
- First thermal camera and radiometric data format.
- First SCADA protocol and approved read-only tag list.
- First drone partner and supported mission/media callbacks.
- First dispatch target and webhook/security requirements.
- Initial retention, privacy, and evidence-sharing policy.
- Future edge hardware class and maximum camera/thermal streams per site.

Until these decisions are made, all pilot development can proceed with simulators and replay data without locking the software to a hardware vendor or an unattended deployment model.
