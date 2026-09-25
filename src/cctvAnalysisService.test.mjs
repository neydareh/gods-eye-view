import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cctvAnalysisFetchHandler,
  cctvAnalysisScanHandler,
} from '../server/providers/cctv-analysis/http.js';
import {
  evaluateSuspiciousBehaviors,
  normalizeDetectionTick,
} from '../server/providers/cctv-analysis/rules.js';

function reportRequest(body, method = 'POST') {
  return new Request('http://local.invalid/api/cctv-analysis/reports', {
    method,
    body: body === undefined ? undefined : body,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('CCTV analysis service appends the existing report shape', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gev-cctv-analysis-'));
  const result = await cctvAnalysisFetchHandler(
    reportRequest(
      JSON.stringify({
        cameraId: 'cam-1',
        cameraName: 'Main Street',
        provider: 'demo',
        city: 'Austin',
        capturedAt: '2026-09-24T12:00:00.000Z',
        model: { kind: 'ignored', status: 'not_configured' },
        detections: [{ label: 'person', confidence: 0.9 }],
        suspiciousBehaviors: ['person lingering'],
        notes: ['ready'],
      }),
    ),
    { sourceRoot: root },
  );

  assert.equal(result.status, 200);
  const payload = JSON.parse(result.body);
  const stored = JSON.parse(await readFile(payload.file, 'utf8'));
  assert.equal(stored.schemaVersion, 1);
  assert.equal(stored.reports.length, 1);
  assert.equal(stored.reports[0].module, 'cctv-watch');
  assert.equal(stored.reports[0].cameraId, 'cam-1');
  assert.equal(stored.reports[0].model.kind, 'yolo');
  assert.equal(stored.reports[0].model.status, 'not_configured');
  assert.deepEqual(stored.reports[0].suspiciousBehaviors, ['person lingering']);
});

test('CCTV analysis service rejects missing camera IDs, malformed JSON, large reports, and wrong methods', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gev-cctv-analysis-'));

  const missingCamera = await cctvAnalysisFetchHandler(
    reportRequest(JSON.stringify({ cameraId: '' })),
    { sourceRoot: root },
  );
  assert.equal(missingCamera.status, 400);
  assert.equal(JSON.parse(missingCamera.body).error, 'camera_required');

  const malformed = await cctvAnalysisFetchHandler(reportRequest('{'), {
    sourceRoot: root,
  });
  assert.equal(malformed.status, 400);
  assert.equal(JSON.parse(malformed.body).error, 'malformed_json');

  const tooLarge = await cctvAnalysisFetchHandler(
    reportRequest(JSON.stringify({ cameraId: 'cam-1', notes: ['abcdef'] })),
    { sourceRoot: root, maxBytes: 8 },
  );
  assert.equal(tooLarge.status, 413);
  assert.equal(JSON.parse(tooLarge.body).error, 'report_too_large');

  const wrongMethod = await cctvAnalysisFetchHandler(
    reportRequest(undefined, 'GET'),
    { sourceRoot: root },
  );
  assert.equal(wrongMethod.status, 405);
  assert.equal(JSON.parse(wrongMethod.body).error, 'method_not_allowed');
});

function scanRequest(body, method = 'POST') {
  return new Request('http://local.invalid/api/cctv-analysis/scan', {
    method,
    body: body === undefined ? undefined : body,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('scan endpoint reports model_unavailable without inventing detections', async () => {
  const result = await cctvAnalysisScanHandler(
    scanRequest(JSON.stringify({ cameraId: 'cam-1', mode: 'single' })),
  );
  assert.equal(result.status, 200);
  const payload = JSON.parse(result.body);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.status, 'model_unavailable');
  assert.equal(payload.cameraId, 'cam-1');
  assert.equal(payload.model.kind, 'yolo');
  assert.equal(payload.model.status, 'not_configured');
  assert.deepEqual(payload.detections, []);
  assert.deepEqual(payload.tracks, []);
  assert.deepEqual(payload.events, []);
  assert.deepEqual(payload.suspiciousBehaviors, []);
  assert.equal(payload.assessment, null);
});

test('scan endpoint rejects missing cameras, malformed JSON, oversized bodies, and wrong methods', async () => {
  const missingCamera = await cctvAnalysisScanHandler(
    scanRequest(JSON.stringify({ cameraId: '' })),
  );
  assert.equal(missingCamera.status, 400);
  assert.equal(JSON.parse(missingCamera.body).error, 'camera_required');

  const malformed = await cctvAnalysisScanHandler(scanRequest('{'));
  assert.equal(malformed.status, 400);
  assert.equal(JSON.parse(malformed.body).error, 'malformed_json');

  const tooLarge = await cctvAnalysisScanHandler(
    scanRequest(JSON.stringify({ cameraId: 'cam-1' })),
    { maxBytes: 4 },
  );
  assert.equal(tooLarge.status, 413);
  assert.equal(JSON.parse(tooLarge.body).error, 'scan_too_large');

  const wrongMethod = await cctvAnalysisScanHandler(scanRequest(undefined, 'GET'));
  assert.equal(wrongMethod.status, 405);
  assert.equal(JSON.parse(wrongMethod.body).error, 'method_not_allowed');
});

test('behavior rules stay separate from detections and flag suspicious patterns', () => {
  const base = { x: 0.4, y: 0.4, w: 0.1, h: 0.1 };
  const at = (seconds) =>
    new Date(Date.UTC(2026, 8, 24, 12, 0, seconds)).toISOString();

  const lingering = evaluateSuspiciousBehaviors(
    [0, 30, 60, 120].map((seconds) => ({
      capturedAt: at(seconds),
      detections: [
        {
          trackId: 'p1',
          label: 'person',
          confidence: 0.9,
          box: base,
          timestamp: at(seconds),
        },
      ],
    })),
    'cam-1',
  );
  assert.deepEqual(lingering, ['person lingering']);

  const moving = evaluateSuspiciousBehaviors(
    [0, 60, 120, 180].map((seconds, index) => ({
      capturedAt: at(seconds),
      detections: [
        {
          trackId: 'p1',
          label: 'person',
          confidence: 0.9,
          box: { ...base, x: 0.05 + index * 0.2 },
          timestamp: at(seconds),
        },
      ],
    })),
    'cam-1',
  );
  assert.deepEqual(moving, []);

  const crowded = evaluateSuspiciousBehaviors(
    [
      {
        capturedAt: at(0),
        detections: Array.from({ length: 5 }, (_, index) => ({
          trackId: `p${index}`,
          label: 'person',
          confidence: 0.8,
          box: { ...base, x: index * 0.15 },
          timestamp: at(0),
        })),
      },
    ],
    'cam-1',
  );
  assert.deepEqual(crowded, ['crowding']);

  const stoppedVehicle = evaluateSuspiciousBehaviors(
    [0, 40, 90].map((seconds) => ({
      capturedAt: at(seconds),
      detections: [
        {
          trackId: 'v1',
          label: 'car',
          confidence: 0.9,
          box: base,
          timestamp: at(seconds),
        },
      ],
    })),
    'cam-1',
  );
  assert.deepEqual(stoppedVehicle, ['vehicle stopped']);

  const leftBehind = evaluateSuspiciousBehaviors(
    [
      {
        capturedAt: at(0),
        detections: [
          { trackId: 'b1', label: 'bag', confidence: 0.7, box: base, timestamp: at(0) },
          { trackId: 'p1', label: 'person', confidence: 0.9, box: base, timestamp: at(0) },
        ],
      },
      {
        capturedAt: at(70),
        detections: [
          { trackId: 'b1', label: 'bag', confidence: 0.7, box: base, timestamp: at(70) },
        ],
      },
      {
        capturedAt: at(150),
        detections: [
          { trackId: 'b1', label: 'bag', confidence: 0.7, box: base, timestamp: at(150) },
        ],
      },
    ],
    'cam-1',
  );
  assert.deepEqual(leftBehind, ['object left behind']);
});

test('detection normalization clamps boxes and fills camera context', () => {
  const tick = normalizeDetectionTick(
    {
      capturedAt: '2026-09-24T12:00:00.000Z',
      detections: [
        { label: ' PERSON ', confidence: 1.7, box: { x: -0.2, y: 0.1, w: 3, h: 0.4 } },
      ],
    },
    'cam-9',
  );
  const [detection] = tick.detections;
  assert.equal(detection.label, 'person');
  assert.equal(detection.confidence, 1);
  assert.equal(detection.cameraId, 'cam-9');
  assert.equal(detection.timestamp, '2026-09-24T12:00:00.000Z');
  assert.deepEqual(detection.box, { x: 0, y: 0.1, w: 1, h: 0.4 });
});
