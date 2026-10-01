/**
 * Fast YOLO worker integration test — skips catalog lookup by mocking
 * the runtime.analyze() call directly against the spawned Python worker.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(
  path.dirname(__dirname),
  'server/providers/cctv-analysis/yolo_worker.py',
);

const PYTHON = process.env.CCTV_YOLO_PYTHON || '/Users/olakunle.neye/Desktop/Project/gods-eye-view/.venv-yolo/bin/python';
const MODEL_PATH = process.env.CCTV_YOLO_MODEL || '/Users/olakunle.neye/Desktop/Project/gods-eye-view/yolo26n.pt';

async function runTest(cameraId, frameBytes) {
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
          resolve(result);
          child.kill();
        } catch {
          // incomplete JSON, wait for more
        }
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (!resolved) reject(new Error(`worker exited with code ${code}`));
    });

    // Send request
    const requestId = `test-${Date.now()}`;
    const request = JSON.stringify({ requestId, cameraId, image: frameBytes.toString('base64') });
    child.stdin.write(request + '\n');

    // Timeout after 60s
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
  console.log('=== Fast YOLO Worker Test ===\n');
  console.log('Python:', PYTHON);
  console.log('Model:', MODEL_PATH);
  console.log('Worker:', WORKER_PATH);

  // Verify files exist
  if (!fs.existsSync(WORKER_PATH)) {
    console.error('❌ Worker not found at:', WORKER_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(MODEL_PATH)) {
    console.error('❌ Model not found at:', MODEL_PATH);
    process.exit(1);
  }
  console.log('✅ All files exist\n');

  // Read test frame
  const testFramePath = '/tmp/test_frame.jpg';
  if (!fs.existsSync(testFramePath)) {
    console.error('❌ Test frame not found at:', testFramePath);
    process.exit(1);
  }
  const frameBytes = fs.readFileSync(testFramePath);
  console.log('Test frame size:', frameBytes.length, 'bytes\n');

  // Run multiple tests
  const cameras = ['camera-1', 'camera-2', 'camera-3'];
  let allPassed = true;

  for (const cameraId of cameras) {
    try {
      console.log(`Testing ${cameraId}...`);
      const start = Date.now();
      const result = await runTest(cameraId, frameBytes);
      const elapsed = Date.now() - start;

      const hasRequestId = result.requestId && result.requestId.startsWith('test-');
      const hasModel = result.model === MODEL_PATH;
      const hasDetections = Array.isArray(result.detections);

      if (hasRequestId && hasModel && hasDetections) {
        console.log(`  ✅ ${cameraId} passed in ${elapsed}ms`);
        console.log(`     Detections: ${result.detections.length}, Model: ${result.model}`);
      } else {
        console.log(`  ❌ ${cameraId} failed — invalid response shape`);
        console.log('     Response:', JSON.stringify(result).slice(0, 200));
        allPassed = false;
      }
    } catch (error) {
      console.log(`  ❌ ${cameraId} failed: ${error.message}`);
      allPassed = false;
    }
  }

  console.log('\n' + (allPassed ? '✅ All tests PASSED' : '❌ Some tests FAILED'));
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
