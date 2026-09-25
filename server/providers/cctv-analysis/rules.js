/**
 * Deterministic suspicious-behavior rules over normalized YOLO detection
 * ticks. Rules stay separate from raw detections: they only ever consume
 * normalized ticks and emit plain behavior labels for report payloads.
 */

export const DEFAULT_BEHAVIOR_RULES = Object.freeze({
  personLingeringSeconds: 90,
  crowdMinPeople: 5,
  vehicleStoppedSeconds: 60,
  objectLeftBehindSeconds: 120,
  lingeringMaxDisplacement: 0.05,
  stoppedMaxDisplacement: 0.02,
});

const VEHICLE_LABELS = new Set([
  'car',
  'truck',
  'bus',
  'motorcycle',
  'vehicle',
  'van',
  'pickup',
]);

const OBJECT_LABELS = new Set([
  'bag',
  'backpack',
  'suitcase',
  'luggage',
  'box',
  'parcel',
  'object',
]);

function clampUnit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

export function normalizeDetectionBox(box) {
  return {
    x: clampUnit(box?.x),
    y: clampUnit(box?.y),
    w: clampUnit(box?.w),
    h: clampUnit(box?.h),
  };
}

/** Normalize one raw detection into the report contract shape. */
export function normalizeDetection(detection, cameraId = '') {
  return {
    label: String(detection?.label || '')
      .toLowerCase()
      .trim(),
    confidence: clampUnit(detection?.confidence),
    box: normalizeDetectionBox(detection?.box),
    timestamp: String(detection?.timestamp || ''),
    cameraId: String(detection?.cameraId || cameraId || ''),
    trackId:
      detection?.trackId === null || detection?.trackId === undefined
        ? null
        : String(detection.trackId),
  };
}

/** Normalize one sampled frame's detection list into the tick contract. */
export function normalizeDetectionTick(tick, cameraId = '') {
  const capturedAt = String(tick?.capturedAt || '');
  return {
    capturedAt,
    detections: (Array.isArray(tick?.detections) ? tick.detections : []).map(
      (detection) => {
        const normalized = normalizeDetection(detection, cameraId);
        return normalized.timestamp
          ? normalized
          : { ...normalized, timestamp: capturedAt };
      },
    ),
  };
}

function centerOf(box) {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function displacementBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function timedSamples(samples) {
  return samples
    .map((sample) => ({ ...sample, time: Date.parse(sample.at) }))
    .filter((sample) => Number.isFinite(sample.time))
    .sort((a, b) => a.time - b.time);
}

function collectTracks(ticks) {
  const tracks = new Map();
  for (const tick of ticks) {
    for (const detection of tick.detections) {
      const key = detection.trackId || detection.label;
      if (!key) continue;
      if (!tracks.has(key)) {
        tracks.set(key, { label: detection.label, samples: [] });
      }
      tracks.get(key).samples.push({
        at: detection.timestamp || tick.capturedAt,
        center: centerOf(detection.box),
      });
    }
  }
  return tracks;
}

function trackSpan(track) {
  const timed = timedSamples(track.samples);
  if (timed.length < 2) return null;
  const first = timed[0];
  const last = timed[timed.length - 1];
  return {
    seconds: (last.time - first.time) / 1000,
    displacement: displacementBetween(first.center, last.center),
    lastTime: last.time,
  };
}

function personLeftScene(tracks, objectSpan) {
  const personLastTimes = [];
  for (const track of tracks.values()) {
    if (track.label !== 'person') continue;
    const timed = timedSamples(track.samples);
    if (!timed.length) continue;
    personLastTimes.push(timed[timed.length - 1].time);
  }
  if (!personLastTimes.length) return false;
  return Math.max(...personLastTimes) < objectSpan.lastTime;
}

/**
 * Evaluate behavior rules across detection ticks for one camera.
 * Returns an array of plain behavior strings; never mutates detections.
 */
export function evaluateSuspiciousBehaviors(ticks, cameraId = '', rules = {}) {
  const config = { ...DEFAULT_BEHAVIOR_RULES, ...rules };
  const normalized = (Array.isArray(ticks) ? ticks : []).map((tick) =>
    normalizeDetectionTick(tick, cameraId),
  );
  const behaviors = new Set();

  for (const tick of normalized) {
    const people = tick.detections.filter((d) => d.label === 'person').length;
    if (people >= config.crowdMinPeople) {
      behaviors.add('crowding');
      break;
    }
  }

  const tracks = collectTracks(normalized);
  for (const track of tracks.values()) {
    const span = trackSpan(track);
    if (!span) continue;
    if (
      track.label === 'person' &&
      span.seconds >= config.personLingeringSeconds &&
      span.displacement <= config.lingeringMaxDisplacement
    ) {
      behaviors.add('person lingering');
    }
    if (
      VEHICLE_LABELS.has(track.label) &&
      span.seconds >= config.vehicleStoppedSeconds &&
      span.displacement <= config.stoppedMaxDisplacement
    ) {
      behaviors.add('vehicle stopped');
    }
    if (
      OBJECT_LABELS.has(track.label) &&
      span.seconds >= config.objectLeftBehindSeconds &&
      span.displacement <= config.stoppedMaxDisplacement &&
      personLeftScene(tracks, span)
    ) {
      behaviors.add('object left behind');
    }
  }

  return [...behaviors];
}
