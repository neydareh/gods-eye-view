import {
  cctvAnalysisFetchHandler,
  cctvAnalysisScanHandler,
} from './cctv-analysis/http.js';

const REPORTS_PATH = '/api/cctv-analysis/reports';
const SCAN_PATH = '/api/cctv-analysis/scan';
const REPORTS_URL = `http://local.invalid${REPORTS_PATH}`;
const SCAN_URL = `http://local.invalid${SCAN_PATH}`;

function nodeRequestToFetchRequest(req, url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(
        new Request(url, {
          method: req.method,
          headers: req.headers,
          body: chunks.join(''),
        }),
      );
    });
    req.on('error', reject);
  });
}

function writeNodeResponse(res, result) {
  res.writeHead(result.status, result.headers);
  res.end(result.body);
}

export function cctvAnalysisProxy({ sourceRoot = process.cwd() } = {}) {
  const install = ({ middlewares }) => {
    const handle = (url, handler) => async (req, res) => {
      try {
        const request = await nodeRequestToFetchRequest(req, url);
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
  };

  return {
    name: 'cctv-analysis-proxy',
    configureServer: install,
    configurePreviewServer: install,
  };
}
