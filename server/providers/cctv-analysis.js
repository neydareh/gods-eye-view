import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_REPORT_BYTES = 128 * 1024;

function readRequestBody(req, maxBytes = MAX_REPORT_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error('Report body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function reportFilePath(sourceRoot) {
  const configured = process.env.CCTV_ANALYSIS_REPORT_FILE;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(sourceRoot, configured);
  }
  return path.resolve(sourceRoot, 'data/cctv-analysis-reports.json');
}

function safeReport(input) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    receivedAt: now,
    module: 'cctv-watch',
    cameraId: String(input?.cameraId || ''),
    cameraName: String(input?.cameraName || input?.cameraId || ''),
    provider: String(input?.provider || ''),
    city: String(input?.city || ''),
    capturedAt: String(input?.capturedAt || now),
    model: {
      kind: 'yolo',
      status: String(input?.model?.status || 'not_configured'),
    },
    detections: Array.isArray(input?.detections) ? input.detections : [],
    suspiciousBehaviors: Array.isArray(input?.suspiciousBehaviors)
      ? input.suspiciousBehaviors
      : [],
    notes: Array.isArray(input?.notes) ? input.notes.map(String) : [],
  };
}

async function appendReport(file, report) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  let existing = [];
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    existing = Array.isArray(parsed?.reports) ? parsed.reports : [];
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  existing.push(report);
  await fs.writeFile(
    file,
    JSON.stringify({ schemaVersion: 1, reports: existing }, null, 2) + '\n',
  );
}

export function cctvAnalysisProxy({ sourceRoot = process.cwd() } = {}) {
  const file = reportFilePath(sourceRoot);

  const install = ({ middlewares }) => {
    middlewares.use('/api/cctv-analysis/reports', async (req, res) => {
      try {
        if (req.method !== 'POST') {
          res.writeHead(405, {
            'Content-Type': 'application/json',
            Allow: 'POST',
          });
          res.end(JSON.stringify({ error: 'method_not_allowed' }));
          return;
        }
        const body = await readRequestBody(req);
        const parsed = JSON.parse(body || '{}');
        const report = safeReport(parsed);
        if (!report.cameraId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'camera_required' }));
          return;
        }
        await appendReport(file, report);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ ok: true, file }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'cctv_analysis_report_failed',
            message: error?.message || String(error),
          }),
        );
      }
    });
  };

  return {
    name: 'cctv-analysis-proxy',
    configureServer: install,
    configurePreviewServer: install,
  };
}
