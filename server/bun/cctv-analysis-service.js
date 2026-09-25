#!/usr/bin/env bun
import {
  cctvAnalysisFetchHandler,
  cctvAnalysisScanHandler,
} from '../providers/cctv-analysis/http.js';
import { defaultSourceRoot } from '../providers/common/source-root.js';

const port = Number.parseInt(process.env.BUN_CCTV_ANALYSIS_PORT || '4174', 10);
const sourceRoot = process.env.GEV_SOURCE_ROOT || defaultSourceRoot;

const REPORTS_PATH = '/api/cctv-analysis/reports';
const SCAN_PATH = '/api/cctv-analysis/scan';

const server = Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    let result;
    if (pathname === REPORTS_PATH) {
      result = await cctvAnalysisFetchHandler(request, { sourceRoot });
    } else if (pathname === SCAN_PATH) {
      result = await cctvAnalysisScanHandler(request);
    } else {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    });
  },
});

console.log(`Bun CCTV analysis service listening on ${server.url}`);
