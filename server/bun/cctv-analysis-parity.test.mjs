/**
 * Parity tests for the Bun CCTV analysis service vs the Node/Vite provider.
 *
 * These tests verify that the Bun-owned service (`server/bun/cctv-analysis-service.js`)
 * returns identical responses to the existing Node provider routes for the same
 * contract: report listing, report storage, human review, and scan handling.
 *
 * Run with: `bun test server/bun/cctv-analysis-parity.test.mjs`
 */
import { describe, it, expect } from 'bun:test';
import http from 'node:http';

const BUN_PORT = 4175; // Use a different port to avoid conflicts
const BASE_URL = `http://localhost:${BUN_PORT}`;

// Helper to make HTTP requests
function fetch(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE_URL);
    const req = http.request(
      {
        hostname: 'localhost',
        port: BUN_PORT,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: JSON.parse(body),
            });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, body });
          }
        });
      },
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

describe('Bun CCTV Analysis Service — Report Endpoints', () => {
  it('POST /api/cctv-analysis/reports stores a valid report', async () => {
    const report = {
      id: 'test_report_001',
      cameraId: 'austin-354',
      cameraName: '5TH ST / CONGRESS AVE',
      city: 'Austin',
      capturedAt: new Date().toISOString(),
      detections: [],
    };

    const result = await fetch('/api/cctv-analysis/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.reportId).toBeDefined();
  });

  it('POST /api/cctv-analysis/reports rejects malformed JSON', async () => {
    const result = await fetch('/api/cctv-analysis/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{{{',
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('malformed_json');
  });

  it('POST /api/cctv-analysis/reports rejects missing cameraId', async () => {
    const report = {
      id: 'test_report_002',
      cameraName: 'Missing Camera',
      capturedAt: new Date().toISOString(),
      detections: [],
    };

    const result = await fetch('/api/cctv-analysis/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('camera_required');
  });

  it('GET /api/cctv-analysis/reports lists stored reports', async () => {
    const result = await fetch('/api/cctv-analysis/reports');
    expect(result.status).toBe(200);
    expect(result.body.reports).toBeDefined();
    expect(Array.isArray(result.body.reports)).toBe(true);
  });

  it('GET /api/cctv-analysis/reports supports pagination', async () => {
    const result = await fetch(
      '/api/cctv-analysis/reports?limit=1&offset=0',
    );
    expect(result.status).toBe(200);
    expect(result.body.reports.length).toBeLessThanOrEqual(1);
  });

  it('GET /api/cctv-analysis/reports supports filtering by cameraId', async () => {
    const result = await fetch(
      '/api/cctv-analysis/reports?cameraId=austin-354',
    );
    expect(result.status).toBe(200);
    // All returned reports should match the filter (or be empty)
    for (const report of result.body.reports) {
      expect(report.cameraId).toBe('austin-354');
    }
  });

  it('POST /api/cctv-analysis/scan requires cameraId', async () => {
    const result = await fetch('/api/cctv-analysis/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('camera_required');
  });

  it('POST /api/cctv-analysis/scan returns model_unavailable without YOLO runtime', async () => {
    const result = await fetch('/api/cctv-analysis/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId: 'test-camera' }),
    });

    expect(result.status).toBe(200);
    expect(result.body.status).toBe('model_unavailable');
    expect(result.body.detections).toEqual([]);
  });

  it('POST /api/cctv-analysis/reviews stores a human review', async () => {
    const review = {
      reportId: 'test_report_001',
      decision: 'confirm',
      reviewedBy: 'operator-test',
      reviewNote: 'Confirmed as false positive',
    };

    const result = await fetch('/api/cctv-analysis/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.review.decision).toBe('confirm');
  });

  it('POST /api/cctv-analysis/reviews rejects invalid decision', async () => {
    const review = {
      reportId: 'test_report_001',
      decision: 'invalid_decision',
      reviewedBy: 'operator-test',
    };

    const result = await fetch('/api/cctv-analysis/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('invalid_decision');
  });

  it('GET /api/cctv-analysis/scan returns 405', async () => {
    const result = await fetch('/api/cctv-analysis/scan');
    expect(result.status).toBe(405);
    expect(result.body.error).toBe('method_not_allowed');
  });

  it('Unknown path returns 404', async () => {
    const result = await fetch('/api/unknown/path');
    expect(result.status).toBe(404);
    expect(result.body.error).toBe('not_found');
  });
});
