import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PIPELINE_WATCH_INCIDENT_STATES,
  PIPELINE_WATCH_RESPONSE_STATES,
  PIPELINE_WATCH_REVIEW_DECISIONS,
  PIPELINE_WATCH_SCHEMA_VERSION,
  PIPELINE_WATCH_SOURCE_KINDS,
} from './version.js';

test('publishes the shared Pipeline Watch schema version', () => {
  assert.equal(PIPELINE_WATCH_SCHEMA_VERSION, 1);
});

test('publishes the canonical source kinds', () => {
  assert.deepEqual(PIPELINE_WATCH_SOURCE_KINDS, [
    'camera',
    'thermal',
    'scada',
    'drone',
  ]);
});

test('publishes the incident state machine vocabulary', () => {
  assert.deepEqual(PIPELINE_WATCH_INCIDENT_STATES, [
    'new',
    'acknowledged',
    'confirmed',
    'dismissed',
    'escalated',
    'more_review',
  ]);
});

test('keeps review decisions separate from response states', () => {
  assert.deepEqual(PIPELINE_WATCH_REVIEW_DECISIONS, [
    'confirm',
    'dismiss',
    'escalate',
    'more_review',
  ]);
  assert.deepEqual(PIPELINE_WATCH_RESPONSE_STATES, [
    'not_dispatched',
    'dispatch_approved',
    'dispatched',
    'closed',
  ]);
  assert.equal(
    PIPELINE_WATCH_REVIEW_DECISIONS.includes('dispatch_approved'),
    false,
  );
  assert.equal(PIPELINE_WATCH_REVIEW_DECISIONS.includes('dispatched'), false);
});

test('freezes every exported vocabulary', () => {
  for (const vocabulary of [
    PIPELINE_WATCH_SOURCE_KINDS,
    PIPELINE_WATCH_INCIDENT_STATES,
    PIPELINE_WATCH_REVIEW_DECISIONS,
    PIPELINE_WATCH_RESPONSE_STATES,
  ]) {
    assert.equal(Object.isFrozen(vocabulary), true);
    assert.equal(new Set(vocabulary).size, vocabulary.length);
  }
});
