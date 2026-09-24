import * as Cesium from 'cesium';

const PINCH_ZOOM_MULTIPLIER = 8;
const MAX_PINCH_PIXEL_DELTA = 120;
const PERFORMANCE_STORAGE_KEY = 'gev:performance-mode';

function envValue(name) {
  return import.meta.env?.[name];
}

function storageValue(key) {
  try {
    return globalThis.localStorage?.getItem(key) || '';
  } catch {
    return '';
  }
}

function normalizeMode(value) {
  const mode = String(value || '')
    .trim()
    .toLowerCase();
  return ['quality', 'balanced', 'performance'].includes(mode) ? mode : '';
}

function defaultPerformanceMode() {
  const navigatorRef = globalThis.navigator;
  const memory = Number(navigatorRef?.deviceMemory);
  const cores = Number(navigatorRef?.hardwareConcurrency);
  if ((Number.isFinite(memory) && memory <= 4) || (cores && cores <= 4))
    return 'balanced';
  return 'quality';
}

function boolValue(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function resolveViewerPerformanceOptions({
  env = envValue,
  storage = storageValue,
  mode = normalizeMode(env('VITE_GEV_PERFORMANCE_MODE')) ||
    normalizeMode(storage(PERFORMANCE_STORAGE_KEY)) ||
    defaultPerformanceMode(),
} = {}) {
  const presets = {
    quality: {
      mode: 'quality',
      msaaSamples: 4,
      preserveDrawingBuffer: true,
      resolutionScale: 1,
      targetFrameRate: 120,
    },
    balanced: {
      mode: 'balanced',
      msaaSamples: 2,
      preserveDrawingBuffer: true,
      resolutionScale: 0.9,
      targetFrameRate: 120,
    },
    performance: {
      mode: 'performance',
      msaaSamples: 1,
      preserveDrawingBuffer: false,
      resolutionScale: 0.75,
      targetFrameRate: 120,
    },
  };
  const base = presets[mode] || presets.quality;
  return {
    ...base,
    msaaSamples: numberValue(env('VITE_GEV_MSAA_SAMPLES'), base.msaaSamples),
    preserveDrawingBuffer: boolValue(
      env('VITE_GEV_PRESERVE_DRAWING_BUFFER'),
      base.preserveDrawingBuffer,
    ),
    resolutionScale: numberValue(
      env('VITE_GEV_RESOLUTION_SCALE'),
      base.resolutionScale,
    ),
    targetFrameRate: numberValue(
      env('VITE_GEV_TARGET_FRAME_RATE'),
      base.targetFrameRate,
    ),
  };
}

export function applyViewerSmoothness(viewer) {
  const controller = viewer?.scene?.screenSpaceCameraController;
  if (!controller) return;
  controller.inertiaSpin = 0.92;
  controller.inertiaTranslate = 0.92;
  controller.inertiaZoom = 0.86;
  controller.maximumMovementRatio = 0.07;
}

function boundedPinchDelta(delta) {
  if (!Number.isFinite(delta) || delta === 0) return delta;
  return (
    Math.sign(delta) *
    Math.min(Math.abs(delta) * PINCH_ZOOM_MULTIPLIER, MAX_PINCH_PIXEL_DELTA)
  );
}

/**
 * Add browser trackpad pinch to Cesium's zoom inputs and return its disposer.
 * Browsers expose this gesture as a small pixel-mode Ctrl+wheel event.
 */
export function installTrackpadPinchZoom(
  viewer,
  { createWheelEvent = (type, init) => new WheelEvent(type, init) } = {},
) {
  const controller = viewer?.scene?.screenSpaceCameraController;
  const container = viewer?.container;
  const canvas = viewer?.canvas;
  if (!controller || !container || !canvas)
    throw new TypeError('A complete Cesium viewer is required');

  const originalZoomEventTypes = controller.zoomEventTypes;
  const zoomEventTypes = Array.isArray(originalZoomEventTypes)
    ? originalZoomEventTypes
    : originalZoomEventTypes === undefined
      ? []
      : [originalZoomEventTypes];
  const alreadyHandlesControlWheel = zoomEventTypes.some(
    (binding) =>
      binding?.eventType === Cesium.CameraEventType.WHEEL &&
      binding?.modifier === Cesium.KeyboardEventModifier.CTRL,
  );
  const configuredZoomEventTypes = alreadyHandlesControlWheel
    ? originalZoomEventTypes
    : [
        ...zoomEventTypes,
        {
          eventType: Cesium.CameraEventType.WHEEL,
          modifier: Cesium.KeyboardEventModifier.CTRL,
        },
      ];
  if (!alreadyHandlesControlWheel)
    controller.zoomEventTypes = configuredZoomEventTypes;

  const relayedEvents = new WeakSet();
  const relayPinch = (event) => {
    if (
      !event.ctrlKey ||
      relayedEvents.has(event) ||
      event.deltaMode !== 0 ||
      !Number.isFinite(event.deltaY) ||
      event.deltaY === 0
    )
      return;
    let relayed;
    try {
      relayed = createWheelEvent('wheel', {
        deltaX: event.deltaX,
        deltaY: boundedPinchDelta(event.deltaY),
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        view: globalThis.window,
      });
    } catch {
      // The registered Ctrl+wheel binding can still consume the original.
      return;
    }
    relayedEvents.add(relayed);
    event.preventDefault();
    event.stopPropagation();
    canvas.dispatchEvent(relayed);
  };
  container.addEventListener('wheel', relayPinch, {
    capture: true,
    passive: false,
  });

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    container.removeEventListener('wheel', relayPinch, true);
    if (
      !alreadyHandlesControlWheel &&
      controller.zoomEventTypes === configuredZoomEventTypes
    )
      controller.zoomEventTypes = originalZoomEventTypes;
  };
}

/** Create the standard globe viewer in caller-owned, visible containers. */
export function createApplicationViewer({ container, creditContainer }) {
  if (!container || !creditContainer)
    throw new TypeError('Viewer and credit containers are required');
  const performanceOptions = resolveViewerPerformanceOptions();
  const viewer = new Cesium.Viewer(container, {
    timeline: false,
    animation: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    vrButton: false,
    selectionIndicator: false,
    infoBox: false,
    baseLayer: false,
    creditContainer,
    msaaSamples: performanceOptions.msaaSamples,
    contextOptions: {
      webgl: {
        preserveDrawingBuffer: performanceOptions.preserveDrawingBuffer,
      },
    },
  });
  try {
    viewer.targetFrameRate = performanceOptions.targetFrameRate;
    viewer.resolutionScale = performanceOptions.resolutionScale;
    applyViewerSmoothness(viewer);
    viewer.scene.globe.show = false;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.atmosphereLightIntensity = 18;
    viewer.scene.skyAtmosphere.saturationShift = -0.12;
    viewer.scene.skyAtmosphere.brightnessShift = -0.08;
    return viewer;
  } catch (error) {
    viewer.destroy();
    throw error;
  }
}
