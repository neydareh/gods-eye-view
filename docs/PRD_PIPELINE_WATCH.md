# Pipeline Watch Product Requirements Document

**Product:** God's Eye View  
**Feature:** Pipeline Watch  
**Status:** Proposed - integrated launch scope  
**Author:** Product and engineering draft  
**Date:** November 19, 2026  
**Source reviewed:** God's Eye - Pipeline 24/7 Monitoring PRD, November 7, 2026

## 1. Executive recommendation

Add Pipeline Watch as an operator mode inside God's Eye View. It should extend the existing CCTV and geospatial capabilities into a map-first pipeline security workflow: show oil-pipeline routes across the world map, attach cameras and sensors to segments, configure restricted zones, surface prioritized events, and require a human operator to confirm, dismiss, or escalate each alert.

Four capabilities from the source document are first-release scope: thermal spill detection, SCADA integration, drone integration, and dispatch integration. Persistent 24/7 edge monitoring is explicitly deferred until the supervised pilot proves the operator workflow and event model.

The release can still be delivered through dependency-ordered vertical slices. That is an implementation sequence, not a decision to defer any capability from the product architecture or pilot definition.

The launch contract is:

- **Supervised monitoring:** the browser-led pilot clearly shows when monitoring is active, paused, stale, or unavailable.
- **Unified event model:** camera, thermal, SCADA, and drone signals resolve to a pipeline segment, evidence package, confidence, and severity.
- **Human-controlled response:** review and dispatch approval are separate actions. Confirmation or escalation alone never sends a dispatch.
- **SCADA context first:** God's Eye consumes alarms and telemetry immediately; direct control writes remain behind a separate safety and authorization gate.
- **Partner-based drone operations:** God's Eye creates or receives missions and analyzes the resulting video; licensed flight operations remain with the drone partner.
- **Dispatch loop:** separately approved dispatches receive status updates. A dispatched incident closes only after a field update supplies closure evidence.
- **Future edge path:** source adapters and contracts remain compatible with a persistent edge agent, but the pilot does not claim 24/7 unattended coverage.

This approach uses the strongest parts of the current app while adding the production architecture required for a real pipeline operations product.

## 2. What the source document says

The attached monitoring specification proposes a camera-agnostic platform for pipeline operators. Its core operating model is:

1. Use existing visual and thermal cameras first.
2. Map cameras to pipeline segments and score their readiness.
3. Detect security threats and surface-visible spills.
4. Send a concise alert to a named operator.
5. Keep the human decision as the source of truth.
6. Preserve an audit trail and recommend additional cameras where coverage is weak.

It also defines important constraints that should carry into this feature: God's Eye View should complement rather than replace SCADA and other leak-detection systems; buried leaks are out of scope; response actions must not be fully automated; privacy masking is required near communities; and camera, network, power, and environmental limitations must be visible to the customer.

The source document's full scope is larger than the current app. In particular, it assumes enterprise camera networks, edge compute, thermal radiometry, named users, mobile field teams, multi-site retention, and operational integrations that do not currently exist in this repository.

## 3. Product opportunity for God's Eye View

God's Eye View already presents a live, geospatial view of the world and has a CCTV workflow that can select feeds, display live or snapshot media, run local YOLO scans, derive suspicious-behavior events, save reports, and capture human review decisions. It also has camera positioning, coverage/view-shed visualization, a local server proxy, and a map-centric interaction model.

Pipeline Watch should therefore be implemented as a focused operational layer on top of the existing CCTV system rather than as a separate monitoring product.

### Capability fit

| Pipeline Watch need                       | Current app fit       | Product implication                                                                                     |
| ----------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| Geospatial pipeline and camera context    | Strong                | Reuse the globe, camera placement, focus, and view-shed controls.                                       |
| Public or configured camera feeds         | Strong for prototype  | Extend the current catalog with customer-owned feed metadata and health state.                          |
| People, vehicle, and behavior detection   | Partial but promising | Reuse YOLO normalization and behavior rules; add pipeline-specific zones and event types.               |
| Human review                              | Strong prototype      | Promote the existing review actions into an incident queue with operator identity and required reasons. |
| Saved reports                             | Partial               | Evolve per-camera reports into incidents grouped across cameras and time.                               |
| Camera readiness and coverage gaps        | Partial               | Add segment coverage scoring and a gap report based on camera capabilities.                             |
| Thermal spill detection                   | Not present           | Add radiometric ingestion, visual/thermal fusion, baselines, spread tracking, and controlled test data. |
| Continuous 24/7 alerting                  | Not present           | Defer persistent monitoring; make session state and monitoring limitations explicit in the pilot.       |
| Enterprise identity, retention, and audit | Not present           | Add before a real customer pilot.                                                                       |
| SCADA, drones, and dispatch               | Not present           | Add adapter contracts and one pilot integration for each in the launch architecture.                    |

## 4. Problem statement

Pipeline operators can see individual cameras, but they do not yet have a pipeline-aware operating picture. A camera selection does not answer which segment is covered, whether the feed is fit for a given detection, what has changed, which events matter most, or who made the final decision.

Pipeline Watch should reduce the time from “something changed on a camera” to “an operator has understood, recorded, and routed the event.”

## 5. Goals and non-goals

### Goals for the first production-oriented milestone

- Represent a pipeline route as ordered, named segments on the map.
- Show every authorized oil pipeline as a visible route on the global world map, with a representative marker and label at world zoom.
- Let an operator select a route, zoom from the global overview into segments, and see linked cameras, sensors, coverage, and events.
- Attach one or more cameras to each segment and show readiness by use case.
- Let an operator draw or edit camera zones such as right-of-way, fence, restricted area, and water crossing.
- Detect and classify people, vehicles, motorcycles, and boats where the camera and model support it.
- Produce pipeline-specific events for intrusion, loitering, digging-like activity, tampering-like activity, and camera health degradation.
- Group observations from nearby cameras into one incident instead of flooding the operator with duplicate alerts.
- Present a prioritized alert queue with evidence, location, camera context, confidence, and a recommended next action.
- Require a human decision: confirm, dismiss, escalate, or request more review.
- Preserve an append-only decision history with user, timestamp, reason, and notes.
- Show coverage gaps and explain why a segment is limited or not usable.
- Ingest radiometric thermal data and combine it with visual evidence for surface spill alerts.
- Show monitoring session state and warn when the browser, feed, or analysis loop is unavailable.
- Ingest SCADA alarms and relevant telemetry and correlate them with camera, thermal, and drone events.
- Create, receive, and track drone missions or patrol feeds through a licensed partner integration.
- Let an authorized operator separately approve dispatch for a confirmed or escalated incident, then receive response status updates.

### Non-goals for v1

- Replacing SCADA, pressure-based detection, fibre sensing, or in-line inspection.
- Detecting buried leaks that have not reached the surface.
- Direct valve control or other safety-critical SCADA writes without a separate authorization and safety gate.
- Direct drone flight control without a licensed partner and mission-safety boundary.
- Autonomous dispatch or security response without explicit human authorization.
- Unattended 24/7 monitoring while the browser or supervised pilot session is closed.
- Face recognition or identity inference.
- Manufacturing, selling, or procuring cameras.
- Monitoring processing plants, terminals, or unrelated facilities.
- Supporting an enterprise SLA before persistent monitoring, auth, and deployment controls exist.

## 6. Users and primary jobs

| User                           | Job to be done                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Control-room operator          | Review a short, trusted queue and decide what needs action.                     |
| Security or field lead         | Understand where an event happened and what the response team should inspect.   |
| Pipeline integrity or HSE lead | Review confirmed events, evidence, and trends for follow-up and reporting.      |
| Security manager               | Identify hotspots, repeated patterns, and response performance.                 |
| IT/OT administrator            | Onboard feeds, manage camera metadata, configure access, and understand health. |

## 7. Experience concept

Pipeline Watch opens as a three-part operator surface:

1. **World map:** all authorized oil pipeline routes, representative pipeline markers, route metadata, segment status, camera positions, coverage cones, active incidents, and readiness state.
2. **Alert queue:** severity-sorted incidents with age, confidence, affected segment, and current owner.
3. **Evidence panel:** live or recent camera view, detection overlays, nearby camera handoff, event timeline, recommended action, and review controls.

The existing CCTV Watch surface remains useful for camera-by-camera exploration. Pipeline Watch adds the operational layer above it.

The world layer must not imply that public pipeline data is exhaustive or operationally authoritative. Each route and marker should expose source, freshness, geometry confidence, and visibility policy. Customer-provided route geometry is authoritative for that customer's operations.

### Suggested operator flow

1. Operator selects a pipeline or saved operating area.
2. The map shows segment status: covered, limited, offline, or unconfigured.
3. A new alert appears in the queue with a map pin and a short evidence clip or frame sequence.
4. Operator opens the alert, views the source camera and nearby cameras, and checks the zone and detection timeline.
5. Operator confirms, dismisses, escalates, or requests more review. Dismissal requires a reason.
6. Confirmed or escalated incidents remain visible on the map and in incident history. If field response is needed, an authorized operator separately approves dispatch.
7. The response lead submits a field update with closure evidence before the dispatched incident can close.
8. Operators can review recurring hotspots and camera gaps to guide patrols or future installation surveys.

## 8. Functional requirements

Priority meanings: **P0** is required for the integrated launch pilot; **P1** is required after the core path is proven but remains within the launch program; **P2** is intentionally deferred to a later production track.

### Pipeline and segment model

| ID        | Priority | Requirement                                                                                                               | Acceptance signal                                                                         |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| PW-SEG-01 | P0       | Create or import a pipeline route and divide it into named segments.                                                      | A route is visible on the map and each segment has a stable ID and name.                  |
| PW-SEG-02 | P0       | Show every authorized oil pipeline as route geometry plus a representative marker at global zoom.                         | Operators can see route extent, identity, status, and ownership without opening a camera. |
| PW-SEG-03 | P0       | Drill from a pipeline marker or route to a segment and then to linked sources and incidents.                              | Selecting a marker, route, or segment updates the map and detail context.                 |
| PW-SEG-04 | P0       | Style routes and segments by status, risk, coverage, and active incident state.                                           | Map styling has a legend and remains understandable at global and local zoom.             |
| PW-SEG-05 | P0       | Import route geometry from an approved GeoJSON, KML, or customer source.                                                  | Imported geometry preserves route IDs, segment IDs, and coordinate reference information. |
| PW-SEG-06 | P0       | Apply route-level visibility and access controls.                                                                         | Unauthorized users cannot discover or inspect protected route geometry.                   |
| PW-SEG-07 | P0       | Support route layers for approved reference data separately from customer-owned routes.                                   | Reference and private route provenance is visible and governed by different policies.     |
| PW-SEG-08 | P1       | Show route metadata such as operator, country/region, product, status, and last update.                                   | Selecting a route exposes metadata and data freshness.                                    |
| PW-SEG-09 | P0       | Store segment metadata: risk class, operating area, nearby crossings/stations, and active status.                         | An operator can open a segment and see its metadata.                                      |
| PW-SEG-10 | P0       | Link cameras to the segments they can observe.                                                                            | A segment detail view lists linked cameras and coverage state.                            |
| PW-SEG-11 | P1       | Support segment types such as valve station, crossing, hotspot, exposed section, community edge, and remote right-of-way. | Segment type changes the default zone and readiness guidance.                             |

### Camera onboarding and readiness

| ID        | Priority | Requirement                                                                                             | Acceptance signal                                                                           |
| --------- | -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| PW-CAM-01 | P0       | Show feed type, location, heading, field of view, source, and current health for each camera.           | Camera cards expose metadata and a clear online/offline/unknown state.                      |
| PW-CAM-02 | P0       | Score each camera as Ready, Limited, or Not usable for security analytics.                              | Score is explainable by capability checks and visible on the map and segment view.          |
| PW-CAM-03 | P0       | Explain coverage gaps in plain language.                                                                | Operator sees reasons such as offline, no night support, blind spot, or insufficient range. |
| PW-CAM-04 | P1       | Support customer-owned camera metadata and adapter configuration separately from public camera sources. | A camera can be managed without changing the public catalog code path.                      |
| PW-CAM-05 | P1       | Re-score readiness when health, pose, or capability metadata changes.                                   | State change creates a timestamped readiness update.                                        |

### Zones and detection policy

| ID         | Priority | Requirement                                                                                        | Acceptance signal                                                               |
| ---------- | -------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| PW-ZONE-01 | P0       | Define camera-relative or map-linked zones for right-of-way, fence, restricted area, and waterway. | Operator can create, edit, enable, and disable a zone.                          |
| PW-ZONE-02 | P0       | Configure time windows and planned-maintenance snoozes.                                            | A zone can be active only at night or be temporarily suppressed with an expiry. |
| PW-ZONE-03 | P0       | Detect people, vehicles, motorcycles, and boats where supported by the model and view.             | Detection records include class, confidence, time, camera, and zone.            |
| PW-ZONE-04 | P0       | Produce intrusion and loitering events from detections plus zone/time policy.                      | A staged event creates a single operator-facing event with evidence.            |
| PW-ZONE-05 | P1       | Add digging/excavation and tampering-like event rules.                                             | Events identify the observed pattern and the evidence used.                     |
| PW-ZONE-06 | P0       | Filter or downgrade common nuisance triggers such as animals, vegetation, rain, and headlights.    | Suppressed or downgraded events remain explainable in diagnostics.              |

### Incident queue and human review

| ID        | Priority | Requirement                                                                                   | Acceptance signal                                                             |
| --------- | -------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| PW-INC-01 | P0       | Create an incident from one or more related detections.                                       | Repeated detections do not create an alert flood.                             |
| PW-INC-02 | P0       | Group observations from nearby cameras into one incident when they overlap in time and space. | The incident shows all contributing cameras and a unified timeline.           |
| PW-INC-03 | P0       | Show severity, confidence, segment, map pin, source camera, evidence, and recommended action. | An operator can decide without searching across unrelated panels.             |
| PW-INC-04 | P0       | Support Confirm, Dismiss, Escalate, and More review decisions.                                | Each decision updates the incident state and remains in history.              |
| PW-INC-05 | P0       | Require a dismissal reason and allow an operator note on every decision.                      | Reasons include animal, weather, authorized work, false detection, and other. |
| PW-INC-06 | P0       | Record operator identity and timestamps for alert creation, acknowledgement, and decision.    | Incident history is append-only and exportable.                               |
| PW-INC-07 | P1       | Notify an assigned response lead when an incident is confirmed or escalated.                  | A configured notification adapter receives the incident payload.              |
| PW-INC-08 | P1       | Allow a nearby camera to be opened from the incident and optionally focus the map there.      | The evidence panel supports one-click camera handoff.                         |

### Coverage and operational reporting

| ID        | Priority | Requirement                                                         | Acceptance signal                                                        |
| --------- | -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| PW-COV-01 | P0       | Show per-segment coverage state and the cameras contributing to it. | A route-wide view exposes uncovered and limited segments.                |
| PW-COV-02 | P0       | Generate a camera-gap report with reason and suggested next step.   | Report distinguishes metadata/configuration fixes from new-camera needs. |
| PW-COV-03 | P1       | Show incident hotspots by segment and time window.                  | Operator can identify repeated locations and times.                      |
| PW-COV-04 | P1       | Export incident and coverage data for customer review.              | Export includes source, evidence references, decisions, and timestamps.  |

### Thermal spill detection

| ID         | Priority | Requirement                                                                            | Acceptance signal                                                              |
| ---------- | -------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| PW-LEAK-01 | P0       | Ingest visual and radiometric thermal streams as separate, time-aligned inputs.        | A test fixture can present both streams for one segment.                       |
| PW-LEAK-02 | P0       | Detect new liquid against a learned scene baseline and track area/spread.              | Controlled tests produce a measured change over time.                          |
| PW-LEAK-03 | P0       | Compare liquid color, sheen, texture, spread, and temperature behavior.                | The operator sees the evidence used by the classifier.                         |
| PW-LEAK-04 | P0       | Produce explainable likely oil, likely water, or unknown confidence.                   | A reviewable confidence score and evidence set are stored on the event.        |
| PW-LEAK-05 | P0       | Apply time-of-day, weather, dawn/dusk, rain, and fog weighting.                        | Known low-confidence conditions lower alert confidence instead of hiding data. |
| PW-LEAK-06 | P0       | Link spill alerts to nearby security incidents in the previous 24 hours.               | The incident timeline shows the relationship without claiming causation.       |
| PW-LEAK-07 | P1       | Detect warm product leaks and cold gas-leak signatures where sensor capability allows. | Staged thermal fixtures produce a distinct thermal event classification.       |

### Future persistent edge monitoring

| ID         | Priority | Requirement                                                                    | Acceptance signal                                                               |
| ---------- | -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| PW-EDGE-01 | P2       | Define the edge-agent process boundary and source contracts.                   | Future edge work can consume the same observations and incidents as the pilot.  |
| PW-EDGE-02 | P2       | Buffer detections, clips, and health events during upstream connectivity loss. | Events are retained locally and synchronized after reconnect.                   |
| PW-EDGE-03 | P2       | Expose edge heartbeat, storage, CPU/GPU, time-sync, and feed-health state.     | The control plane shows whether the site is actively monitoring.                |
| PW-EDGE-04 | P2       | Use watchdogs and automatic worker restart for failed analysis processes.      | A killed worker recovers and reports the interruption.                          |
| PW-EDGE-05 | P2       | Keep credentials and raw video inside the customer network by default.         | The edge sends only configured clips, events, and metadata upstream.            |
| PW-EDGE-06 | P2       | Support site-level configuration rollout and rollback.                         | An operator can identify the active model and policy version at each edge site. |

### SCADA integration

| ID          | Priority | Requirement                                                                     | Acceptance signal                                                                |
| ----------- | -------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| PW-SCADA-01 | P0       | Ingest SCADA alarms and selected telemetry through a customer-approved adapter. | An alarm appears as a typed observation with source and timestamp.               |
| PW-SCADA-02 | P0       | Map SCADA tags to pipeline segments, stations, valves, and camera groups.       | An alarm can automatically focus the operator on relevant evidence.              |
| PW-SCADA-03 | P0       | Correlate SCADA alarms with camera, thermal, and drone observations.            | One incident timeline shows related signals and their confidence.                |
| PW-SCADA-04 | P0       | Preserve the distinction between an incoming SCADA alarm and an AI inference.   | The UI labels source, freshness, and correlation confidence separately.          |
| PW-SCADA-05 | P0       | Support operator acknowledgement without issuing control writes.                | Acknowledgement is audited and does not change plant control state.              |
| PW-SCADA-06 | P1       | Define a separately authorized command boundary for future control actions.     | Any control capability is disabled unless an explicit safety gate is configured. |

### Drone integration

| ID          | Priority | Requirement                                                                 | Acceptance signal                                                          |
| ----------- | -------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| PW-DRONE-01 | P0       | Receive drone platform, mission, telemetry, and media metadata.             | A drone mission is visible on the map with state and source.               |
| PW-DRONE-02 | P0       | Create a patrol or call-out mission request through a licensed partner API. | A confirmed incident can produce a reviewable mission request.             |
| PW-DRONE-03 | P0       | Ingest live or recorded drone footage into the same evidence model.         | Drone evidence can be attached to an existing incident.                    |
| PW-DRONE-04 | P0       | Track mission acceptance, launch, in-flight, return, and completion states. | The operator can see mission status without controlling aircraft directly. |
| PW-DRONE-05 | P1       | Run the same detection and spill analysis on drone footage.                 | A drone frame produces normalized observations with source attribution.    |

### Dispatch integration

| ID         | Priority | Requirement                                                                 | Acceptance signal                                                           |
| ---------- | -------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| PW-DISP-01 | P0       | Require separate, recorded approval before dispatching a confirmed or escalated incident. | Confirmation or escalation sends no dispatch. After approval, the adapter receives location, severity, evidence, and instructions. |
| PW-DISP-02 | P0       | Receive acknowledgement, assignment, en-route, on-scene, and closed states. | Dispatch state is visible on the incident timeline.                         |
| PW-DISP-03 | P0       | Support webhook integration plus SMS/email fallback for the pilot.          | A test incident reaches at least one configured channel.                    |
| PW-DISP-04 | P0       | Prevent duplicate dispatches for the same incident.                         | Retries are idempotent and show one external dispatch record.               |
| PW-DISP-05 | P0       | Require a field update with closure evidence to close a dispatched incident. | A status-only update cannot close the incident. A field update with structured evidence can. |

## 9. Data model

The current per-camera report contract should remain readable for existing CCTV workflows. Pipeline Watch should add a separate domain model and reference the existing report rather than repurpose it in place.

### Core entities

- **Pipeline:** `id`, `name`, `operator`, `product`, `countries/regions`, `route`, `timezone`, `status`, `riskLevel`, `visibilityPolicy`, `source`, and `updatedAt`.
- **Segment:** `id`, `pipelineId`, `name`, `geometry`, `segmentType`, `riskLevel`, `status`.
- **Camera:** existing camera identity plus `segmentIds`, capabilities, health, readiness scores, privacy mask, and adapter metadata.
- **Zone:** `id`, `cameraId` or `segmentId`, geometry, type, schedule, enabled state, snooze expiry.
- **Edge site:** `id`, location, deployment mode, software version, health, last heartbeat, storage state, and configuration version.
- **Sensor:** camera, thermal, SCADA tag, drone source, or other observation source with capability and calibration metadata.
- **Observation:** raw detection or health signal with source, timestamp, confidence, and evidence reference.
- **Incident:** grouped observations with severity, confidence, location, affected segments/cameras/sensors, state, owner, recommended action, and response status.
- **Review:** append-only human decision with decision, reason, note, reviewer, and timestamp.
- **Dispatch approval:** separate, append-only record with approval ID, incident ID, authorized operator, timestamp, and reason.
- **Coverage assessment:** readiness result, reasons, computed-at timestamp, and recommended remediation.
- **Dispatch job:** idempotency key, incident ID, dispatch approval ID, adapter, external ID, state, retry count, and response timestamps.
- **Drone mission:** partner ID, mission type, route, linked segment, state, telemetry reference, media references, and incident ID.

### Incident state machine

Review: `new -> acknowledged -> confirmed | dismissed | escalated | more_review`.

Response for a confirmed or escalated incident: `not_dispatched -> dispatch_approved -> dispatched -> closed`. Review changes do not advance the response state. Only a separate approval recorded by an authorized operator allows dispatch. A field update with closure evidence is required to advance from `dispatched` to `closed`; an external dispatch status of `closed` alone is not sufficient.

An incident may be reopened only by creating a new review action; the original decision must remain in the audit history.

## 10. Technical approach

### Phase 1 architecture in this repository

- Extend the current CCTV source metadata with pipeline ownership and segment references.
- Add a pipeline/segment fixture format under `config/` or `data/` for local development and demos.
- Build a Pipeline Watch panel that consumes the existing CCTV catalog, camera health, view-shed geometry, scan results, and report history.
- Add a zone editor and a deterministic event policy layer above the existing normalized detections.
- Add an incident store that groups detections and references source reports instead of copying all report payloads.
- Add a normalized observation contract shared by camera, thermal, SCADA, and drone adapters.
- Define an edge-agent boundary as a future long-running process; the current pilot remains browser-led and supervised.
- Add integration interfaces for SCADA, drone missions, and dispatch with local mock adapters for deterministic tests.
- Add a thermal fixture path that preserves radiometric values, calibration metadata, and visual/thermal timestamps.
- Keep analysis output advisory. The UI must never imply that a model result is a verified incident before human review.
- Keep the current browser-capture scan and analysis loop as the pilot monitoring path, with explicit session-health indicators.

### Future production architecture

- Persistent site-edge workers that continue monitoring when the operator's browser is closed.
- Camera adapters for ONVIF/RTSP and selected VMS products, with credentials and network isolation handled outside the browser.
- Radiometric thermal adapters with calibration checks, time synchronization, and visual pairing.
- SCADA adapters for approved alarm and telemetry protocols, initially read-only.
- Drone partner adapters for mission requests, telemetry, live/recorded media, and mission status.
- Dispatch adapters with idempotent outbound requests and inbound response updates.
- Store-and-forward behavior for weak links, with alert metadata and short clips synchronized when connectivity returns.
- Role-based access, SSO/MFA, retention controls, encryption, and an append-only audit store.
- Notification adapters for SMS, email, push, and dispatch systems.
- A control-plane event bus or durable queue that correlates edge observations without requiring raw video to leave the site.

## 11. Rollout plan

The following milestones are dependency-ordered slices of the launch scope. Thermal, SCADA, drone, and dispatch capabilities are included in the supervised pilot. Persistent edge monitoring is a later production track.

### Milestone 0: Practice run (simulated end-to-end flow)

Use one synthetic pipeline segment and one simulated camera observation of a possible spill. A named operator confirms the incident without dispatching it, then separately approves a mock dispatch. A simulated field update closes the incident with evidence. No live feeds, real dispatch, or full operator console are required.

**Exit gate:** no dispatch on confirmation alone and no closure without field evidence. The completed run leaves one closed incident and one mock dispatch with an attributable audit trail. Replaying the same inputs creates no duplicates. See the [master plan](MASTER_PLAN_PIPELINE_WATCH_SOFTWARE.md#stage-1-practice-run-simulated-end-to-end-flow) for the exact scope.

### Milestone 1: Supervised security and thermal pilot

- Browser-led monitoring with explicit session-health state.
- Camera and thermal feeds are analyzed through the existing application/server path.
- Intrusion, loitering, digging-like activity, camera health, liquid detection, and oil/water/unknown classification are supported.
- SCADA alarm ingestion focuses the operator on relevant cameras and segments.
- Replay and reconnect behavior is tested without claiming unattended coverage.

**Exit gate:** staged security and spill tests meet agreed precision, latency, evidence, and operator-review targets while the supervised session is active.

### Milestone 2: Live integrations and response operations

Before connecting customer systems, verify the identity, credential, evidence-access, privacy, and retention controls in the master plan's [pre-live gate](MASTER_PLAN_PIPELINE_WATCH_SOFTWARE.md#stage-4-live-integration-and-hardware-in-the-loop).

- Customer-owned secure ONVIF/RTSP or VMS camera adapter.
- Customer-approved SCADA adapter.
- Licensed drone-partner mission and media adapter.
- Webhook dispatch integration with SMS/email fallback.
- Operator identity, role-based access, retention, privacy masking, and export controls.
- Mobile-friendly response and closure view.

**Exit gate:** the pilot runs for an agreed supervised observation window with live integrations, clearly reports session interruptions, and maintains complete dispatch/closure auditability.

### Milestone 3: Future persistent monitoring track

- Persistent edge agent independent of the browser.
- Local queue, store-and-forward, watchdogs, and site heartbeat.
- Multi-site edge fleet management and configuration rollback.
- High-availability control plane and durable event queue.
- SCADA control enablement behind the command boundary designed during the launch program, if the customer requires control actions.
- Drone patrol scheduling, beyond-visual-line-of-sight partner workflows, and broader media analysis.
- Dispatch/radio adapters, regulatory exports, and customer-specific reporting.

**Exit gate:** operational, security, safety, and customer acceptance reviews approve unattended monitoring.

## 12. Success metrics

Pilot targets should be confirmed with a real operator and measured on staged tests before being treated as product commitments.

| Metric                                      | Initial target                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Segment coverage visibility                 | 100% of pilot segments have a visible state and reason.                                                |
| Existing cameras usable without replacement | Baseline in Milestone 0; aim for at least 60% Ready or Limited.                                        |
| Supervised session availability             | 99% of scheduled pilot observation windows remain active without unexplained interruption.             |
| Event-to-operator display                   | Under 10 seconds on a healthy local link.                                                              |
| Replay/reconnect handling                   | 100% of simulated reconnect cases recover without duplicate incidents.                                 |
| Human decision time                         | Under 2 minutes median for high-priority incidents.                                                    |
| Duplicate-alert reduction                   | One incident per event across overlapping cameras and sensors.                                         |
| Spill detection                             | At least 85% of staged surface spills detected; at least 80% oil/water classification accuracy.        |
| False alarms reaching the operator          | Establish baseline in Milestone 0; tune toward fewer than 5 per camera per week.                       |
| SCADA correlation latency                   | Related camera/thermal evidence appears within 10 seconds of an alarm on a healthy link.               |
| Dispatch attempt coverage                   | At least 99% of pilot incidents with approved dispatch produce one auditable dispatch attempt.          |
| Review completeness                         | 100% of confirmed, dismissed, and escalated incidents have a reviewer, timestamp, and decision reason. |
| Coverage remediation usefulness             | Operators can identify a concrete action for every Limited or Not usable segment.                      |

## 13. Risks and mitigations

| Risk                                                           | Impact                                           | Mitigation                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| The current browser loop is mistaken for a 24/7 monitor        | Missed events when the tab closes or loses focus | Make the pilot limitation explicit; persistent edge monitoring is a separate future release track.            |
| Public cameras do not represent enterprise pipeline conditions | False confidence in pilot results                | Use fixtures and customer-owned feed adapters before committing to field performance.                         |
| Model detections are too generic for pipeline threats          | Low operator trust                               | Start with explainable zone/time rules and collect reviewed examples before adding complex models.            |
| Thermal calibration or weather effects are underestimated      | False spill alerts or missed leaks               | Require radiometric metadata, scene baselines, weather weighting, and controlled oil/water tests.             |
| Pilot session or local server is interrupted                   | Gaps in supervised monitoring                    | Expose session health, show stale/offline states, and require operator acknowledgement after recovery.        |
| SCADA protocol or tag mapping is misunderstood                 | Incorrect correlation or unsafe operator action  | Start read-only, use customer-approved adapters, validate tag maps, and label source freshness.               |
| Drone operations are unavailable or delayed                    | Slow verification of remote incidents            | Use a licensed partner, model mission acceptance as asynchronous, and provide a non-drone response path.      |
| Dispatch retries create duplicate work                         | Confused field response or duplicate dispatches  | Use idempotency keys, external IDs, retry state, and operator-visible delivery status.                        |
| Alert volume overwhelms operators                              | Queue abandonment                                | Group incidents, tune nuisance filters, require dismissal reasons, and measure operator load.                 |
| Privacy or critical-infrastructure exposure                    | Legal and reputational risk                      | Mask residential/public areas, avoid face recognition, secure camera credentials, and add retention controls. |
| Coverage maps imply more certainty than the data supports      | Unsafe placement decisions                       | Show pose confidence, range assumptions, and a clear Limited/Not usable state.                                |

## 14. Open product decisions

1. What is the first deployment boundary: hybrid edge plus in-country control plane, fully on-premise, or another model?
2. Is the first pilot based on synthetic fixtures, public cameras, or a partner's private camera network?
3. Which radiometric thermal camera and calibration format will be used for the first spill test?
4. Which SCADA protocol and read-only tags are approved for the pilot?
5. Which drone partner can provide mission requests, telemetry, and live or recorded media callbacks?
6. Which dispatch system should be the first live adapter, and is webhook delivery acceptable?
7. Should Pipeline Watch remain a mode inside the existing CCTV Watch surface or become a dedicated full-screen control room?
8. What pipeline geometry format should be the initial import contract: GeoJSON, KML, or a guided drawing tool?
9. Which operator identity should be used in the first pilot: local profile, SSO, or a named demo user?
10. What privacy, retention, and evidence-sharing rules apply in the first market and customer environment?

## 15. Recommended next build slice

Build the [practice run](PIPELINE_WATCH_WORKSTREAM_TRACKER.md#stage-1-practice-run) first. It proves that a signal can become a reviewed, dispatched, and auditable response without hardware or vendor dependencies. After it passes, expand replay coverage to thermal, SCADA, and drone inputs, then build out session health and the operator console. The global map and unattended monitoring are not prerequisites for this slice.

## Appendix A: Source-to-feature translation

| Source concept                      | Translation for God's Eye View                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Existing cameras first              | Extend the current CCTV catalog and proxy before adding new hardware workflows.                                  |
| Map cameras to pipeline segments    | Add pipeline and segment entities linked to existing camera poses.                                               |
| Readiness score                     | Add explicit capability and health scoring with reasons.                                                         |
| Human in the loop                   | Promote existing review actions into an incident lifecycle with required reasons and identity.                   |
| Security analytics                  | Reuse YOLO detections and behavior rules, then add pipeline zones and schedules.                                 |
| Edge analysis                       | Keep a clean future edge-agent boundary, but use supervised browser-led monitoring for the pilot.                |
| Visual plus thermal spill detection | Require radiometric thermal ingestion, calibration, baselines, and explainable sensor fusion in the first pilot. |
| SCADA alarms                        | Add read-only alarm and telemetry correlation at launch; keep control writes behind a safety gate.               |
| Drone patrols                       | Add partner-based mission and media adapters at launch; keep flight control outside God's Eye View.              |
| Dispatch and response               | Add idempotent dispatch plus field status and closure evidence at launch.                                        |
| Camera-gap recommendations          | Start with explainable coverage gaps and remediation suggestions, then add survey-grade placement guidance.      |

## Appendix B: Evidence reviewed

This PRD was informed by the attached Pipeline 24/7 Monitoring PRD and by the current repository's CCTV source/proxy, camera coverage/view-shed, YOLO analysis, behavior rules, report store, and human-review workflow. Statements about current implementation are based on repository inspection; proposed product behavior is recommendation, not existing functionality.
