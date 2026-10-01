import fs from 'node:fs/promises';
import path from 'node:path';
import { THREAT_LEVELS } from './rules.js';

export const MAX_CCTV_ANALYSIS_REPORT_BYTES = 128 * 1024;
export const MAX_CCTV_ANALYSIS_STORE_BYTES = 5 * 1024 * 1024;
export const MAX_CCTV_ANALYSIS_REPORTS = 500;
export const REVIEW_DECISIONS = Object.freeze([
  'confirm',
  'dismiss',
  'escalate',
  'needs_more_review',
]);

export function cctvAnalysisReportFile(sourceRoot = process.cwd()) {
  const configured = process.env.CCTV_ANALYSIS_REPORT_FILE;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(sourceRoot, configured);
  }
  return path.resolve(sourceRoot, 'data/cctv-analysis-reports.json');
}

export function safeCctvAnalysisReport(input, now = new Date()) {
  const receivedAt = now.toISOString();
  return {
    schemaVersion: 1,
    id: String(
      input?.id ||
        `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ),
    receivedAt,
    module: 'cctv-watch',
    cameraId: String(input?.cameraId || ''),
    cameraName: String(input?.cameraName || input?.cameraId || ''),
    provider: String(input?.provider || ''),
    city: String(input?.city || ''),
    capturedAt: String(input?.capturedAt || receivedAt),
    model: {
      kind: 'yolo',
      status: String(input?.model?.status || 'not_configured'),
    },
    detections: Array.isArray(input?.detections) ? input.detections : [],
    tracks: Array.isArray(input?.tracks) ? input.tracks : [],
    events: Array.isArray(input?.events) ? input.events : [],
    assessment:
      input?.assessment && typeof input.assessment === 'object'
        ? input.assessment
        : null,
    humanReview:
      input?.humanReview && typeof input.humanReview === 'object'
        ? input.humanReview
        : {
            status: 'pending_review',
            decision: null,
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: '',
          },
    suspiciousBehaviors: Array.isArray(input?.suspiciousBehaviors)
      ? input.suspiciousBehaviors
      : [],
    notes: Array.isArray(input?.notes) ? input.notes.map(String) : [],
  };
}

export function validateCctvAnalysisReport(report) {
  if (!report.cameraId) return { ok: false, error: 'camera_required' };
  if (!report.id || report.schemaVersion !== 1)
    return { ok: false, error: 'invalid_report_schema' };
  if (report.assessment) {
    if (!THREAT_LEVELS.includes(report.assessment.threatLevel)) {
      return { ok: false, error: 'invalid_assessment_threat_level' };
    }
    if (
      ['elevated', 'critical_review'].includes(report.assessment.threatLevel) &&
      report.assessment.requiresHumanReview !== true
    ) {
      return { ok: false, error: 'human_review_required' };
    }
  }
  return { ok: true };
}

export async function appendCctvAnalysisReport(file, report) {
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
  while (existing.length > MAX_CCTV_ANALYSIS_REPORTS) existing.shift();
  let output =
    JSON.stringify({ schemaVersion: 1, reports: existing }, null, 2) + '\n';
  while (
    Buffer.byteLength(output) > MAX_CCTV_ANALYSIS_STORE_BYTES &&
    existing.length > 1
  ) {
    existing.shift();
    output =
      JSON.stringify({ schemaVersion: 1, reports: existing }, null, 2) + '\n';
  }
  await fs.writeFile(file, output);
}

export async function readCctvAnalysisReports(
  file,
  { limit = 50, offset = 0, cameraId = '' } = {},
) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return { total: 0, reports: [] };
    throw new Error('report_store_malformed');
  }
  const reports = (Array.isArray(parsed?.reports) ? parsed.reports : []).filter(
    (report) => !cameraId || report.cameraId === cameraId,
  );
  return {
    total: reports.length,
    reports: reports
      .slice()
      .reverse()
      .slice(Math.max(0, offset), Math.max(0, offset) + limit),
  };
}

export function cctvHumanReviewFile(sourceRoot = process.cwd()) {
  return path.resolve(sourceRoot, 'data/cctv-human-reviews.json');
}

export async function appendHumanReview(file, review) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  let reviews = [];
  try {
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    reviews = Array.isArray(stored?.reviews) ? stored.reviews : [];
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error('review_store_malformed');
  }
  reviews.push(review);
  while (reviews.length > 2000) reviews.shift();
  await fs.writeFile(
    file,
    JSON.stringify({ schemaVersion: 1, reviews }, null, 2) + '\n',
  );
}
