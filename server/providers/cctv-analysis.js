import {
  cctvAnalysisFetchHandler,
  cctvAnalysisScanHandler,
  cctvHumanReviewHandler,
} from './cctv-analysis/http.js';
import { createCctvCatalog } from './cctv/catalog.js';
import { runCctvAnalysisScan } from './cctv-analysis/scan.js';

const REPORTS_PATH = '/api/cctv-analysis/reports';
const SCAN_PATH = '/api/cctv-analysis/scan';
const REVIEWS_PATH = '/api/cctv-analysis/reviews';
const REPORTS_URL = `http://local.invalid${REPORTS_PATH}`;
const SCAN_URL = `http://local.invalid${SCAN_PATH}`;
const REVIEWS_URL = `http://local.invalid${REVIEWS_PATH}`;
const LIVE_PATH = '/api/cctv-analysis/live';

function nodeRequestToFetchRequest(req, url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const init = { method: req.method, headers: req.headers };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = chunks.join('');
      }
      resolve(new Request(url, init));
    });
    req.on('error', reject);
  });
}

function writeNodeResponse(res, result) {
  res.writeHead(result.status, result.headers);
  res.end(result.body);
}

export function cctvAnalysisProxy({ sourceRoot = process.cwd() } = {}) {
  const getCctvSources = createCctvCatalog({ sourceRoot });
  const install = ({ middlewares }) => {
    const handle = (url, handler) => async (req, res) => {
      try {
        const requestUrl = `${url}${new URL(req.url || '/', 'http://local.invalid').search}`;
        const request = await nodeRequestToFetchRequest(req, requestUrl);
        const result = await handler(request, { sourceRoot });
        writeNodeResponse(res, result);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'cctv_analysis_report_failed',
            message: error?.message || String(error),
          }),
        );
      }
    };

    middlewares.use(
      REPORTS_PATH,
      handle(REPORTS_URL, cctvAnalysisFetchHandler),
    );
    middlewares.use(SCAN_PATH, handle(SCAN_URL, cctvAnalysisScanHandler));
    middlewares.use(REVIEWS_PATH, handle(REVIEWS_URL, cctvHumanReviewHandler));
    middlewares.use(LIVE_PATH, async (req, res) => {
      const cameraId = decodeURIComponent(
        String(req.url || '')
          .split('?')[0]
          .replace(/^\//, ''),
      );
      if (req.method !== 'GET' || !cameraId || cameraId.includes('/')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'camera_required' }));
        return;
      }
      const sources = await getCctvSources();
      if (!sources.some((source) => source.id === cameraId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'camera_not_registered' }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      let running = false;
      let previousEventIds = new Set();
      const sendScan = async () => {
        if (running || res.destroyed) return;
        running = true;
        try {
          const { payload } = await runCctvAnalysisScan(
            { cameraId, mode: 'live' },
            { sourceRoot },
          );
          const type =
            payload.status === 'ok' ? 'detection_tick' : 'scan_status';
          res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
          if (payload.status === 'scan_failed') {
            clearInterval(timer);
            res.end();
            return;
          }
          for (const event of payload.events || []) {
            const eventType = previousEventIds.has(event.id)
              ? 'event_updated'
              : 'event_started';
            res.write(
              `event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`,
            );
          }
          previousEventIds = new Set(
            (payload.events || []).map((event) => event.id),
          );
          if (payload.assessment)
            res.write(
              `event: assessment_updated\ndata: ${JSON.stringify(payload.assessment)}\n\n`,
            );
        } catch {
          if (!res.destroyed) {
            res.write('event: scan_status\ndata: {"status":"scan_failed"}\n\n');
            clearInterval(timer);
            res.end();
          }
        } finally {
          running = false;
        }
      };
      const timer = setInterval(sendScan, 2000);
      void sendScan();
      res.on('close', () => clearInterval(timer));
    });
  };

  return {
    name: 'cctv-analysis-proxy',
    configureServer: install,
    configurePreviewServer: install,
  };
}
