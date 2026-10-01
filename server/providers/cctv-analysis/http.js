import fs from 'node:fs/promises';
import {
  appendCctvAnalysisReport,
  cctvAnalysisReportFile,
  MAX_CCTV_ANALYSIS_REPORT_BYTES,
  REVIEW_DECISIONS,
  appendHumanReview,
  cctvHumanReviewFile,
  readCctvAnalysisReports,
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
  return jsonResponse(
    200,
    { ok: true, file, reportId: report.id },
    { 'Cache-Control': 'no-store' },
  );
}

export async function cctvAnalysisFetchHandler(
  request,
  {
    sourceRoot = process.cwd(),
    maxBytes = MAX_CCTV_ANALYSIS_REPORT_BYTES,
  } = {},
) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50,
      ),
    );
    const offset = Math.max(
      0,
      Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0,
    );
    try {
      const result = await readCctvAnalysisReports(
        cctvAnalysisReportFile(sourceRoot),
        {
          limit,
          offset,
          cameraId: url.searchParams.get('cameraId') || '',
        },
      );
      let reviews = [];
      try {
        const stored = JSON.parse(
          await fs.readFile(cctvHumanReviewFile(sourceRoot), 'utf8'),
        );
        reviews = Array.isArray(stored?.reviews) ? stored.reviews : [];
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      const latestByReport = new Map();
      for (const review of reviews) latestByReport.set(review.reportId, review);
      result.reports = result.reports.map((report) => ({
        ...report,
        humanReview: latestByReport.has(report.id)
          ? latestByReport.get(report.id)
          : report.humanReview,
      }));
      return jsonResponse(200, result, { 'Cache-Control': 'no-store' });
    } catch (error) {
      return jsonResponse(500, {
        error: error.message || 'report_read_failed',
      });
    }
  }
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

export async function cctvHumanReviewHandler(
  request,
  { sourceRoot = process.cwd(), maxBytes = 16 * 1024 } = {},
) {
  if (request.method !== 'POST') {
    return jsonResponse(
      405,
      { error: 'method_not_allowed' },
      { Allow: 'POST' },
    );
  }
  let input;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maxBytes)
      return jsonResponse(413, { error: 'review_too_large' });
    input = JSON.parse(body || '{}');
  } catch {
    return jsonResponse(400, { error: 'malformed_json' });
  }
  const reportId = String(input?.reportId || '');
  const decision = String(input?.decision || '');
  if (!reportId) return jsonResponse(400, { error: 'report_required' });
  if (!REVIEW_DECISIONS.includes(decision))
    return jsonResponse(400, { error: 'invalid_decision' });
  try {
    const { reports } = await readCctvAnalysisReports(
      cctvAnalysisReportFile(sourceRoot),
      { limit: 500, offset: 0 },
    );
    if (!reports.some((report) => report.id === reportId))
      return jsonResponse(404, { error: 'report_not_found' });
  } catch (error) {
    return jsonResponse(500, { error: error.message || 'report_read_failed' });
  }
  const review = {
    schemaVersion: 1,
    id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    reportId,
    status:
      decision === 'confirm'
        ? 'confirmed'
        : decision === 'dismiss'
          ? 'dismissed'
          : decision,
    decision,
    reviewedBy: String(input?.reviewedBy || 'operator'),
    reviewedAt: new Date().toISOString(),
    reviewNote: String(input?.reviewNote || '').slice(0, 2000),
  };
  try {
    await appendHumanReview(cctvHumanReviewFile(sourceRoot), review);
    return jsonResponse(
      200,
      { ok: true, review },
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    return jsonResponse(500, { error: error.message || 'review_write_failed' });
  }
}
