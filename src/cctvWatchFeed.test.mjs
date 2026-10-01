import test from 'node:test';
import assert from 'node:assert/strict';
import { cctvWatchFeed } from './cctvWatchFeed.js';

test('snapshot feeds keep using the registered frame route', () => {
  assert.deepEqual(cctvWatchFeed({ id: 'camera/1', feedType: 'image' }), {
    kind: 'image',
    url: '/api/cctv/frame/camera%2F1',
  });
});

test('registered MJPEG feeds use the media route as an image', () => {
  assert.deepEqual(cctvWatchFeed({ id: 'camera/1', feedType: 'mjpg' }), {
    kind: 'mjpeg',
    url: '/api/cctv/media/camera%2F1',
  });
});

test('registered HLS feeds use the media route and video decoder', () => {
  assert.deepEqual(cctvWatchFeed({ id: 'camera/1', feedType: 'hls' }), {
    kind: 'video',
    feedType: 'hls',
    url: '/api/cctv/media/camera%2F1',
  });
});
