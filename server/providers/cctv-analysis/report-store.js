import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_CCTV_ANALYSIS_REPORT_BYTES = 128 * 1024;

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
    suspiciousBehaviors: Array.isArray(input?.suspiciousBehaviors)
      ? input.suspiciousBehaviors
      : [],
    notes: Array.isArray(input?.notes) ? input.notes.map(String) : [],
  };
}

export function validateCctvAnalysisReport(report) {
  if (!report.cameraId) return { ok: false, error: 'camera_required' };
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
  await fs.writeFile(
    file,
    JSON.stringify({ schemaVersion: 1, reports: existing }, null, 2) + '\n',
  );
}
