import {
  appendCctvAnalysisReport,
  cctvAnalysisReportFile,
  MAX_CCTV_ANALYSIS_REPORT_BYTES,
  safeCctvAnalysisReport,
  validateCctvAnalysisReport,
} from './report-store.js';
import { jsonResponse } from './response.js';

export { jsonResponse };
export {
  MAX_CCTV_ANALYSIS_SCAN_BYTES,
  cctvAnalysisScanHandler,
  resolveYoloRuntime,
  runCctvAnalysisScan,
} from './scan.js';

export async function storeCctvAnalysisReport(input, { sourceRoot } = {}) {
  const file = cctvAnalysisReportFile(sourceRoot);
  const report = safeCctvAnalysisReport(input);
  const validation = validateCctvAnalysisReport(report);
  if (!validation.ok) {
    return jsonResponse(400, { error: validation.error });
  }
  await appendCctvAnalysisReport(file, report);
  return jsonResponse(200, { ok: true, file }, { 'Cache-Control': 'no-store' });
}

export async function cctvAnalysisFetchHandler(
  request,
  {
    sourceRoot = process.cwd(),
    maxBytes = MAX_CCTV_ANALYSIS_REPORT_BYTES,
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
    return jsonResponse(413, { error: 'report_too_large' });
  }

  let parsed;
  try {
    parsed = JSON.parse(body || '{}');
  } catch {
    return jsonResponse(400, { error: 'malformed_json' });
  }

  try {
    return await storeCctvAnalysisReport(parsed, { sourceRoot });
  } catch (error) {
    return jsonResponse(500, {
      error: 'cctv_analysis_report_failed',
      message: error?.message || String(error),
    });
  }
}
