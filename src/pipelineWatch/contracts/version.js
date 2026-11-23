export const PIPELINE_WATCH_SCHEMA_VERSION = 1;

export const PIPELINE_WATCH_SOURCE_KINDS = Object.freeze([
  'camera',
  'thermal',
  'scada',
  'drone',
]);

export const PIPELINE_WATCH_INCIDENT_STATES = Object.freeze([
  'new',
  'acknowledged',
  'confirmed',
  'dismissed',
  'escalated',
  'more_review',
]);

export const PIPELINE_WATCH_REVIEW_DECISIONS = Object.freeze([
  'confirm',
  'dismiss',
  'escalate',
  'more_review',
]);

export const PIPELINE_WATCH_RESPONSE_STATES = Object.freeze([
  'not_dispatched',
  'dispatch_approved',
  'dispatched',
  'closed',
]);
