import { jsonResponse } from './response.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessEvents,
  buildAnalysisEvents,
  evaluateSuspiciousBehaviors,
  normalizeDetectionTick,
} from './rules.js';

export const MAX_CCTV_ANALYSIS_SCAN_BYTES = 256 * 1024;

/** Resolve the local Ultralytics worker only when model weights are configured. */
const WORKER_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'yolo_worker.py',
);
const yoloWorkers = new Map();
const liveBuffers = new Map();

function liveWindow(cameraId, tick) {
  const now = Date.parse(tick.capturedAt) || Date.now();
  if (!liveBuffers.has(cameraId)) {
    if (liveBuffers.size >= 32)
      liveBuffers.delete(liveBuffers.keys().next().value);
    liveBuffers.set(cameraId, { ticks: [], eventStarts: new Map() });
  }
  const state = liveBuffers.get(cameraId);
  state.ticks.push(tick);
  state.ticks = state.ticks.filter(
    (item) => now - Date.parse(item.capturedAt) <= 120000,
  );
  while (
    state.ticks.reduce((total, item) => total + item.detections.length, 0) >
    12000
  ) {
    state.ticks.shift();
  }
  return state;
}

export function resolveYoloRuntime({ sourceRoot = process.cwd() } = {}) {
  const modelPath = String(process.env.CCTV_YOLO_MODEL || '').trim();
  if (!modelPath) return null;
  const python = String(process.env.CCTV_YOLO_PYTHON || 'python3');
  return {
    modelPath,
    name: 'Ultralytics YOLO',
    version: 'configured-local',
    async analyze(cameraId, frameBytes = null) {
      let imageBytes = frameBytes;
      if (!imageBytes) {
        const [{ createCctvCatalog }, { fetchCctvImageFromUpstream }] =
          await Promise.all([import('../cctv/catalog.js'), import('../cctv.js')]);
        const sources = await createCctvCatalog({ sourceRoot })();
        const camera = sources.find((source) => source.id === cameraId);
        if (!camera) throw new Error('camera_not_registered');
        const imageUrl = camera.snapshotUrl || camera.url;
        const image = await fetchCctvImageFromUpstream(imageUrl);
        if (!image?.ok) throw new Error('camera_frame_unavailable');
        imageBytes = image.body;
      }
      const output = await runYoloWorker(
        python,
        modelPath,
        cameraId,
        imageBytes,
      );
      return {
        ...output,
        model: {
          kind: 'yolo',
          status: 'running',
          name: output.model,
          runtime: 'python-ultralytics',
        },
      };
    },
  };
}

function runYoloWorker(python, modelPath, cameraId, imageBytes) {
  const key = `${python}\n${modelPath}`;
  let worker = yoloWorkers.get(key);
  if (!worker || worker.child.exitCode !== null) {
    worker = createYoloWorker(python, modelPath, key);
    yoloWorkers.set(key, worker);
  }
  return worker.run(cameraId, imageBytes);
}

function createYoloWorker(python, modelPath, key) {
  const child = spawn(python, [WORKER_PATH, modelPath], {
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  const pending = new Map();
  let buffer = '';
  let nextId = 0;
  let busy = Promise.resolve();
  const failPending = (error) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
    if (yoloWorkers.get(key)?.child === child) yoloWorkers.delete(key);
  };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try {
        const result = JSON.parse(line);
        const entry = pending.get(result.requestId);
        if (!entry) continue;
        pending.delete(result.requestId);
        clearTimeout(entry.timer);
        if (result.error) entry.reject(new Error(result.error));
        else entry.resolve(result);
      } catch {
        failPending(new Error('yolo_worker_invalid_output'));
      }
    }
  });
  child.on('error', (error) => failPending(error));
  child.on('exit', (code) =>
    failPending(new Error(`yolo_worker_exit_${code}`)),
  );
  child.stdin.on('error', (error) => failPending(error));
  return {
    child,
    run(cameraId, imageBytes) {
      const request = () =>
        new Promise((resolve, reject) => {
          const requestId = ++nextId;
          const timer = setTimeout(() => {
            pending.delete(requestId);
            child.kill('SIGKILL');
            reject(new Error('yolo_worker_timeout'));
          }, 45000);
          pending.set(requestId, { resolve, reject, timer });
          child.stdin.write(
            `${JSON.stringify({ requestId, cameraId, image: imageBytes.toString('base64') })}\n`,
            (error) => {
              if (error) {
                clearTimeout(timer);
                pending.delete(requestId);
                reject(error);
              }
            },
          );
        });
      const result = busy.then(request, request);
      busy = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

function emptyScanResult(status, cameraId) {
  return {
    schemaVersion: 1,
    status,
    cameraId: String(cameraId || ''),
    model: {
      kind: 'yolo',
      status: status === 'scan_failed' ? 'error' : 'not_configured',
    },
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
    frameData: String(input?.frameData || ''),
    ticks: Array.isArray(input?.ticks) ? input.ticks : [],
  };
}

/**
 * Run one scan. With no YOLO runtime configured this always returns
 * `model_unavailable` with empty detections — the UI must never present it
 * as a successful analysis.
 */
export async function runCctvAnalysisScan(
  input,
  { cameraId, sourceRoot = process.cwd(), runtime: suppliedRuntime } = {},
) {
  const request = normalizeScanInput(input);
  const targetCameraId = request.cameraId || cameraId || '';
  if (!targetCameraId) {
    return { status: 400, payload: { error: 'camera_required' } };
  }

  const runtime = suppliedRuntime || resolveYoloRuntime({ sourceRoot });
  if (!runtime) {
    return {
      status: 200,
      payload: emptyScanResult('model_unavailable', targetCameraId),
    };
  }

  if (typeof runtime.analyze === 'function') {
    try {
      const frameMatch = request.frameData.match(
        /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/,
      );
      const frameBytes = frameMatch
        ? Buffer.from(frameMatch[1], 'base64')
        : null;
      if (
        request.frameData &&
        (!frameBytes?.length || frameBytes.length > 180 * 1024)
      )
        throw new Error('invalid_frame_data');
      const inference = await runtime.analyze(targetCameraId, frameBytes);
      const capturedAt = new Date().toISOString();
      const tick = normalizeDetectionTick(
        { capturedAt, detections: inference.detections || [] },
        targetCameraId,
      );
      const state =
        request.mode === 'live' ? liveWindow(targetCameraId, tick) : null;
      const ticks = state ? state.ticks : [tick];
      const detections = ticks.flatMap((tick) => tick.detections);
      let events = buildAnalysisEvents(ticks, targetCameraId);
      if (state) {
        events = events.map((event) => {
          const prior = state.eventStarts.get(event.type);
          const stable = prior || { id: event.id, startedAt: event.startedAt };
          state.eventStarts.set(event.type, stable);
          return { ...event, id: stable.id, startedAt: stable.startedAt };
        });
        const activeTypes = new Set(events.map((event) => event.type));
        for (const type of state.eventStarts.keys()) {
          if (!activeTypes.has(type)) state.eventStarts.delete(type);
        }
      }
      return {
        status: 200,
        payload: {
          schemaVersion: 1,
          status: 'ok',
          cameraId: targetCameraId,
          capturedAt,
          model: inference.model,
          detections: state ? tick.detections : detections,
          tracks: [
            ...new Set(
              detections.map((detection) => detection.trackId).filter(Boolean),
            ),
          ].map((id) => ({ schemaVersion: 1, id, cameraId: targetCameraId })),
          events,
          suspiciousBehaviors: evaluateSuspiciousBehaviors(
            ticks,
            targetCameraId,
          ),
          assessment: assessEvents(events),
        },
      };
    } catch {
      console.warn('[cctv-analysis] local YOLO inference failed');
      return {
        status: 200,
        payload: {
          ...emptyScanResult('scan_failed', targetCameraId),
          error: 'inference_failed',
        },
      };
    }
  }

  const ticks = request.ticks.map((tick) =>
    normalizeDetectionTick(tick, targetCameraId),
  );
  const detections = ticks.flatMap((tick) => tick.detections);
  const events = buildAnalysisEvents(ticks, targetCameraId);
  return {
    status: 200,
    payload: {
      schemaVersion: 1,
      status: 'ok',
      cameraId: targetCameraId,
      model: { kind: 'yolo', status: 'running' },
      detections,
      tracks: [
        ...new Set(detections.map((item) => item.trackId).filter(Boolean)),
      ].map((id) => ({ schemaVersion: 1, id, cameraId: targetCameraId })),
      events,
      suspiciousBehaviors: evaluateSuspiciousBehaviors(ticks, targetCameraId),
      assessment: assessEvents(events),
    },
  };
}

export async function cctvAnalysisScanHandler(
  request,
  {
    maxBytes = MAX_CCTV_ANALYSIS_SCAN_BYTES,
    sourceRoot = process.cwd(),
    runtime,
  } = {},
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
    const result = await runCctvAnalysisScan(parsed, { sourceRoot, runtime });
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
