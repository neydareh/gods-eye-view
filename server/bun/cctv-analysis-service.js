#!/usr/bin/env bun
import {
  cctvAnalysisFetchHandler,
  cctvAnalysisScanHandler,
  cctvHumanReviewHandler,
} from '../providers/cctv-analysis/http.js';
import { defaultSourceRoot } from '../providers/common/source-root.js';
import { createCctvCatalog } from '../providers/cctv/catalog.js';
import { runCctvAnalysisScan } from '../providers/cctv-analysis/scan.js';

const port = Number.parseInt(process.env.BUN_CCTV_ANALYSIS_PORT || '4174', 10);
const sourceRoot = process.env.GEV_SOURCE_ROOT || defaultSourceRoot;
const getCctvSources = createCctvCatalog({ sourceRoot });

const REPORTS_PATH = '/api/cctv-analysis/reports';
const SCAN_PATH = '/api/cctv-analysis/scan';
const REVIEWS_PATH = '/api/cctv-analysis/reviews';

const server = Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/cctv-analysis/live/')) {
      const cameraId = decodeURIComponent(
        pathname.slice('/api/cctv-analysis/live/'.length),
      );
      if (
        request.method !== 'GET' ||
        !cameraId ||
        !(await getCctvSources()).some((source) => source.id === cameraId)
      ) {
        return Response.json(
          { error: 'camera_not_registered' },
          { status: 404 },
        );
      }
      let stopStream = () => {};
      const stream = new ReadableStream({
        start(controller) {
          let closed = false;
          let busy = false;
          const send = (name, payload) =>
            controller.enqueue(
              new TextEncoder().encode(
                `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`,
              ),
            );
          const poll = async () => {
            if (closed || busy) return;
            busy = true;
            try {
              const { payload } = await runCctvAnalysisScan(
                { cameraId, mode: 'live' },
                { sourceRoot },
              );
              send(
                payload.status === 'ok' ? 'detection_tick' : 'scan_status',
                payload,
              );
              if (payload.status === 'scan_failed') stopStream();
              if (payload.assessment)
                send('assessment_updated', payload.assessment);
            } catch {
              send('scan_status', { status: 'scan_failed' });
              stopStream();
            } finally {
              busy = false;
            }
          };
          const timer = setInterval(poll, 2000);
          stopStream = (close = true) => {
            if (closed) return;
            closed = true;
            clearInterval(timer);
            if (close) controller.close();
          };
          void poll();
          request.signal.addEventListener(
            'abort',
            () => {
              stopStream();
            },
            { once: true },
          );
        },
        cancel() {
          stopStream(false);
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }
    let result;
    if (pathname === REPORTS_PATH) {
      result = await cctvAnalysisFetchHandler(request, { sourceRoot });
    } else if (pathname === SCAN_PATH) {
      result = await cctvAnalysisScanHandler(request, { sourceRoot });
    } else if (pathname === REVIEWS_PATH) {
      result = await cctvHumanReviewHandler(request, { sourceRoot });
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
