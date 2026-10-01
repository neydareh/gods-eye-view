/**
 * End-to-end scan handler test — verifies the full Node.js scan pipeline
 * including spawn → stdin/stdout JSON protocol → detection normalization →
 * behavior rules → assessment, using a real YOLO worker but skipping the
 * expensive CCTV catalog lookup by providing frame data directly.
 */
import { runCctvAnalysisScan } from '../server/providers/cctv-analysis/scan.js';
import fs from 'node:fs';

const PYTHON = process.env.CCTV_YOLO_PYTHON || '/Users/olakunle.neye/Desktop/Project/gods-eye-view/.venv-yolo/bin/python';
const MODEL_PATH = process.env.CCTV_YOLO_MODEL || '/Users/olakunle.neye/Desktop/Project/gods-eye-view/yolo26n.pt';

// Mock runtime that spawns the real YOLO worker without catalog lookup
async function mockRuntimeAnalyze(cameraId, frameBytes) {
  const { spawn } = await import('node:child_process');
  const path = await import('node:path');
  const url = await import('node:url');

  const WORKER_PATH = path.default.join(
    path.default.dirname(url.default.fileURLToPath(import.meta.url)),
    '../server/providers/cctv-analysis/yolo_worker.py',
  );

  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [WORKER_PATH, MODEL_PATH], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    let buffer = '';
    let resolved = false;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (resolved) return;
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const result = JSON.parse(line);
          resolved = true;
          resolve({
            requestId: result.requestId,
            model: result.model,
            detections: result.detections || [],
            model: {
              kind: 'yolo',
              status: 'running',
              name: result.model,
              runtime: 'python-ultralytics',
            },
          });
          child.kill();
        } catch {
          // incomplete JSON
        }
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (!resolved) reject(new Error(`worker exited with code ${code}`));
    });

    const requestId = `test-${Date.now()}`;
    const request = JSON.stringify({ requestId, cameraId, image: frameBytes.toString('base64') });
    child.stdin.write(request + '\n');

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill();
        reject(new Error('timeout'));
      }
    }, 60000);
  });
}

async function main() {
  console.log('=== Full Scan Pipeline Test ===\n');
  console.log('Python:', PYTHON);
  console.log('Model:', MODEL_PATH);

  // Read test frame
  const testFramePath = '/tmp/test_frame.jpg';
  if (!fs.existsSync(testFramePath)) {
    console.error('❌ Test frame not found at:', testFramePath);
    process.exit(1);
  }
  const frameBytes = fs.readFileSync(testFramePath);
  const base64Image = frameBytes.toString('base64');
  const frameData = `data:image/jpeg;base64,${base64Image}`;

  console.log('Test frame size:', frameBytes.length, 'bytes\n');

  // Create mock runtime
  const mockRuntime = {
    modelPath: MODEL_PATH,
    name: 'Ultralytics YOLO',
    version: 'configured-local',
    analyze: mockRuntimeAnalyze,
  };

  // Test 1: Single scan with frame data
  console.log('Test 1: Single scan with frame data...');
  try {
    const result = await runCctvAnalysisScan(
      { cameraId: 'test-camera', frameData },
      { cameraId: 'test-camera', runtime: mockRuntime }
    );

    console.log('  HTTP Status:', result.status);
    console.log('  Payload status:', result.payload.status);
    console.log('  Camera ID:', result.payload.cameraId);
    console.log('  Model kind:', result.payload.model?.kind);
    console.log('  Model status:', result.payload.model?.status);
    console.log('  Detections:', result.payload.detections?.length || 0);
    console.log('  Tracks:', result.payload.tracks?.length || 0);
    console.log('  Events:', result.payload.events?.length || 0);
    console.log('  Schema valid:', result.payload.schemaVersion === 1);

    if (result.payload.status === 'ok' && result.payload.schemaVersion === 1) {
      console.log('  ✅ Test 1 PASSED\n');
    } else {
      console.log('  ❌ Test 1 FAILED — unexpected status:', result.payload.status, '\n');
    }
  } catch (error) {
    console.log('  ❌ Test 1 FAILED:', error.message, '\n');
  }

  // Test 2: Live scan mode
  console.log('Test 2: Live scan mode...');
  try {
    const result = await runCctvAnalysisScan(
      { cameraId: 'live-camera', frameData, mode: 'live' },
      { cameraId: 'live-camera', runtime: mockRuntime }
    );

    console.log('  Payload status:', result.payload.status);
    console.log('  Detections:', result.payload.detections?.length || 0);
    console.log('  Events:', result.payload.events?.length || 0);
    console.log('  Suspicious behaviors:', result.payload.suspiciousBehaviors?.length || 0);
    console.log('  Assessment:', result.payload.assessment ? 'present' : 'null');

    if (result.payload.status === 'ok') {
      console.log('  ✅ Test 2 PASSED\n');
    } else {
      console.log('  ❌ Test 2 FAILED — unexpected status:', result.payload.status, '\n');
    }
  } catch (error) {
    console.log('  ❌ Test 2 FAILED:', error.message, '\n');
  }

  // Test 3: Failure handling — invalid frame
  console.log('Test 3: Failure handling with invalid frame...');
  try {
    const result = await runCctvAnalysisScan(
      { cameraId: 'test-camera', frameData: 'data:image/jpeg;base64,invalid!!!' },
      { cameraId: 'test-camera', runtime: mockRuntime }
    );

    console.log('  Payload status:', result.payload.status);
    console.log('  Error:', result.payload.error);

    if (result.payload.status === 'scan_failed' || result.payload.status === 'model_unavailable') {
      console.log('  ✅ Test 3 PASSED — failure handled gracefully\n');
    } else {
      console.log('  ⚠️  Test 3 — unexpected status:', result.payload.status, '\n');
    }
  } catch (error) {
    console.log('  ❌ Test 3 FAILED:', error.message, '\n');
  }

  // Test 4: No camera ID
  console.log('Test 4: No camera ID (should return 400)...');
  try {
    const result = await runCctvAnalysisScan({}, {});
    console.log('  HTTP Status:', result.status);
    console.log('  Error:', result.payload?.error);

    if (result.status === 400 && result.payload?.error === 'camera_required') {
      console.log('  ✅ Test 4 PASSED\n');
    } else {
      console.log('  ❌ Test 4 FAILED — expected 400 camera_required\n');
    }
  } catch (error) {
    console.log('  ❌ Test 4 FAILED:', error.message, '\n');
  }

  console.log('=== All tests complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
