import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PipelineWatchContractError,
  createPipeline,
  createSegment,
  validatePipelineAndSegment,
} from './pipeline.js';

const pipelineInput = {
  id: 'pipe-north-001',
  name: 'North Synthetic Route',
  operator: 'Synthetic Energy',
  product: 'crude_oil',
  countries: ['US'],
  regions: ['north'],
  route: {
    type: 'LineString',
    coordinates: [
      [-97.1, 30.1],
      [-96.2, 30.8],
    ],
  },
  timezone: 'America/Chicago',
  status: 'active',
  riskLevel: 'medium',
  visibilityPolicy: 'private',
  source: { kind: 'customer', id: 'synthetic-fixture' },
  updatedAt: '2026-11-22T12:00:00Z',
};

const segmentInput = {
  id: 'seg-north-001-a',
  pipelineId: pipelineInput.id,
  name: 'North Synthetic Segment A',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-97.1, 30.1],
      [-96.7, 30.45],
    ],
  },
  segmentType: 'remote_right_of_way',
  riskLevel: 'medium',
  status: 'active',
};

test('creates immutable Pipeline and Segment records with stable ownership', () => {
  const pipeline = createPipeline(pipelineInput);
  const segment = createSegment(segmentInput, pipeline);

  assert.deepEqual(pipeline, pipelineInput);
  assert.deepEqual(segment, segmentInput);
  assert.equal(Object.isFrozen(pipeline), true);
  assert.equal(Object.isFrozen(pipeline.route), true);
  assert.equal(Object.isFrozen(segment), true);
  assert.equal(Object.isFrozen(segment.geometry.coordinates), true);
  assert.deepEqual(validatePipelineAndSegment(pipeline, segment), {
    pipeline,
    segment,
  });
});

test('rejects a segment with missing parent pipeline', () => {
  assert.throws(
    () => createSegment(segmentInput),
    (error) =>
      error instanceof PipelineWatchContractError &&
      error.code === 'parent_pipeline_missing' &&
      error.field === 'pipelineId',
  );
});

test('rejects a segment whose owner conflicts with the supplied pipeline', () => {
  const otherPipeline = createPipeline({
    ...pipelineInput,
    id: 'pipe-south-002',
  });

  assert.throws(
    () => createSegment(segmentInput, otherPipeline),
    (error) =>
      error instanceof PipelineWatchContractError &&
      error.code === 'segment_owner_mismatch' &&
      error.field === 'pipelineId',
  );
});

test('rejects invalid route geometry and missing visibility policy', () => {
  assert.throws(
    () =>
      createPipeline({
        ...pipelineInput,
        route: { type: 'Point', coordinates: [1, 2] },
      }),
    /route must be a GeoJSON LineString or MultiLineString/,
  );
  assert.throws(
    () => createPipeline({ ...pipelineInput, visibilityPolicy: '' }),
    /visibilityPolicy must be a non-empty string or object/,
  );
});
