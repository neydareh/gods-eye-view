import { jsonResponse } from './response.js';
import {
  evaluateSuspiciousBehaviors,
  normalizeDetectionTick,
} from './rules.js';

export const MAX_CCTV_ANALYSIS_SCAN_BYTES = 256 * 1024;

/**
 * Resolve the configured YOLO runtime. Until a real runtime is wired, this
 * returns null so scans report `model_unavailable` instead of fake detections.
 */
export function resolveYoloRuntime() {
  return null;
}

function emptyScanResult(status, cameraId) {
  return {
    schemaVersion: 1,
    status,
    cameraId: String(cameraId || ''),
    model: { kind: 'yolo', status: 'not_configured' },
    detections: [],
    tracks: [],
    events: [],
    suspiciousBehaviors: [],
    assessment: null,
  };
}

function normalizeScanInput(input) {
  return {
    cameraId: String(input?.cameraId || ''),
    mode: input?.mode === 'live' ? 'live' : 'single',
    frameUrl: String(input?.frameUrl || ''),
    ticks: Array.isArray(input?.ticks) ? input.ticks : [],
  };
}

/**
 * Run one scan. With no YOLO runtime configured this always returns
 * `model_unavailable` with empty detections — the UI must never present it
 * as a successful analysis.
 */
export async function runCctvAnalysisScan(input, { cameraId } = {}) {
  const request = normalizeScanInput(input);
  const targetCameraId = request.cameraId || cameraId || '';
  if (!targetCameraId) {
    return { status: 400, payload: { error: 'camera_required' } };
  }

  const runtime = resolveYoloRuntime();
  if (!runtime) {
    return {
      status: 200,
      payload: emptyScanResult('model_unavailable', targetCameraId),
    };
  }

  const ticks = request.ticks.map((tick) =>
    normalizeDetectionTick(tick, targetCameraId),
  );
  const detections = ticks.flatMap((tick) => tick.detections);
  return {
    status: 200,
    payload: {
      schemaVersion: 1,
      status: 'ok',
      cameraId: targetCameraId,
      model: { kind: 'yolo', status: 'running' },
      detections,
      tracks: [],
      events: [],
      suspiciousBehaviors: evaluateSuspiciousBehaviors(ticks, targetCameraId),
      assessment: null,
    },
  };
}

export async function cctvAnalysisScanHandler(
  request,
  { maxBytes = MAX_CCTV_ANALYSIS_SCAN_BYTES } = {},
) {
  if (request.method !== 'POST') {
    return jsonResponse(
      405,
      { error: 'method_not_allowed' },
      { Allow: 'POST' },
    );
  }

  let body = '';
  try {
    body = await request.text();
  } catch (error) {
    return jsonResponse(400, {
      error: 'body_read_failed',
      message: error?.message || String(error),
    });
  }

  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    return jsonResponse(413, { error: 'scan_too_large' });
  }

  let parsed;
  try {
    parsed = JSON.parse(body || '{}');
  } catch {
    return jsonResponse(400, { error: 'malformed_json' });
  }

  try {
    const result = await runCctvAnalysisScan(parsed);
    return jsonResponse(result.status, result.payload, {
      'Cache-Control': 'no-store',
    });
  } catch (error) {
    return jsonResponse(500, {
      error: 'cctv_analysis_scan_failed',
      message: error?.message || String(error),
    });
  }
}
