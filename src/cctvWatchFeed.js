import { isVideoFeedType, normalizeFeedType } from './sources/cctvTypes.js';

export function cctvWatchFeed(camera) {
  const feedType = normalizeFeedType(camera.feedType);
  const id = encodeURIComponent(camera.id);
  if (feedType === 'mjpeg')
    return { kind: 'mjpeg', url: `/api/cctv/media/${id}` };
  if (isVideoFeedType(feedType))
    return { kind: 'video', feedType, url: `/api/cctv/media/${id}` };
  return { kind: 'image', url: `/api/cctv/frame/${id}` };
}
