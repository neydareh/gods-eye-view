import { initializeParentShell } from './parentShell.js';

const CREATED_STATE = Object.freeze({ status: 'created', phase: null });

let applicationInstance = null;
let applicationLoadPromise = null;
let cctvWatchModuleInstance = null;
let cctvWatchModuleLoadPromise = null;
const pendingApplicationSubscribers = new Set();
const applicationUnsubscribers = new Map();

function selectedModules(state) {
  return new Set([state?.left, state?.right].filter(Boolean));
}

async function describeStartupError(error) {
  try {
    const { describeError } = await import('./standalone/errors.js');
    return describeError(error);
  } catch {
    return error?.message || String(error);
  }
}

function showGodEyeStartupError(error) {
  console.error("God's Eye View initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  if (!loaderStatus) return;
  void describeStartupError(error).then((message) => {
    loaderStatus.textContent = `Error: ${message}`;
    loaderStatus.style.color = '#ff4444';
  });
}

async function loadGodEyeApplication() {
  if (applicationInstance) return applicationInstance;
  const { createStandaloneApplication } =
    await import('./standalone/application.js');
  applicationInstance = createStandaloneApplication({
    googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
    cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
    allowQaRegistration: import.meta.env.DEV,
  });
  for (const listener of pendingApplicationSubscribers) {
    applicationUnsubscribers.set(
      listener,
      applicationInstance.subscribe(listener),
    );
  }
  return applicationInstance;
}

function startGodEyeApplication() {
  applicationLoadPromise ||= loadGodEyeApplication().then((app) => {
    app.start().catch(showGodEyeStartupError);
    return app;
  });
  return applicationLoadPromise;
}

function startCctvWatchModule() {
  cctvWatchModuleLoadPromise ||= import('./cctvWatchModule.js').then(
    ({ initializeCctvWatchModule }) => {
      cctvWatchModuleInstance = initializeCctvWatchModule();
      return cctvWatchModuleInstance;
    },
  );
  return cctvWatchModuleLoadPromise;
}

function startSelectedModules(state) {
  const selected = selectedModules(state);
  if (selected.has('god-eye')) void startGodEyeApplication();
  if (selected.has('cctv-watch')) void startCctvWatchModule();
}

export const application = Object.freeze({
  async start() {
    const app = await startGodEyeApplication();
    return app.start();
  },
  async destroy() {
    const app = await applicationLoadPromise;
    return app?.destroy?.();
  },
  getState() {
    return applicationInstance?.getState?.() || CREATED_STATE;
  },
  getComponents() {
    return applicationInstance?.getComponents?.() || Object.freeze({});
  },
  subscribe(listener) {
    if (applicationInstance) return applicationInstance.subscribe(listener);
    if (typeof listener !== 'function') return () => {};
    listener(CREATED_STATE);
    pendingApplicationSubscribers.add(listener);
    return () => {
      pendingApplicationSubscribers.delete(listener);
      applicationUnsubscribers.get(listener)?.();
      applicationUnsubscribers.delete(listener);
    };
  },
});

export const cctvWatchModule = Object.freeze({
  async loadCameras() {
    const module = await startCctvWatchModule();
    return module?.loadCameras?.();
  },
  async selectCamera(cameraId) {
    const module = await startCctvWatchModule();
    return module?.selectCamera?.(cameraId);
  },
  getState() {
    return (
      cctvWatchModuleInstance?.getState?.() ||
      Object.freeze({
        cameraCount: 0,
        filteredCameraCount: 0,
        selectedCameraId: null,
      })
    );
  },
});

export const parentShell = initializeParentShell({
  onModulesChanged: startSelectedModules,
});

if (parentShell) startSelectedModules(parentShell.getState());
