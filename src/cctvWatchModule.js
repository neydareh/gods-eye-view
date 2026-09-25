const OPTION_RENDER_LIMIT = 80;

function cameraFrameUrl(camera) {
  const params = new URLSearchParams({
    label: camera.name || camera.id,
    city: camera.city || '',
    lat: String(camera.lat ?? ''),
    lon: String(camera.lon ?? ''),
    heading: String(Math.round(Number(camera.headingDeg) || 0)),
    fov: String(Math.round(Number(camera.fovDeg) || 80)),
    pitch: String(Math.round(Number(camera.pitchDeg) || -10)),
    ts: String(Date.now()),
  });
  return `/api/cctv/frame/${encodeURIComponent(camera.id)}?${params.toString()}`;
}

function reportPayload(camera, scan) {
  const modelRan = scan?.status === 'ok';
  return {
    schemaVersion: 1,
    module: 'cctv-watch',
    cameraId: camera.id,
    cameraName: camera.name || camera.id,
    provider: camera.provider || '',
    city: camera.city || '',
    capturedAt: new Date().toISOString(),
    model: {
      kind: 'yolo',
      status: modelRan
        ? 'running'
        : scan
          ? scan.model?.status || 'not_configured'
          : 'not_configured',
    },
    detections: modelRan ? scan.detections || [] : [],
    suspiciousBehaviors: modelRan ? scan.suspiciousBehaviors || [] : [],
    scanStatus: scan?.status || 'not_run',
    notes: modelRan
      ? ['Report generated from a completed YOLO scan.']
      : [
          scan
            ? 'Scan returned no detections: YOLO model did not run.'
            : 'No scan has run. Wire a YOLO runtime before treating this as analysis.',
        ],
  };
}

function searchTextForCamera(camera) {
  if (camera._cctvWatchSearchText) return camera._cctvWatchSearchText;
  return [
    camera.id,
    camera.name,
    camera.city,
    camera.cityId,
    camera.provider,
    camera.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function filterCameras(cameras, query) {
  const terms = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return cameras;
  return cameras.filter((camera) => {
    const haystack = searchTextForCamera(camera);
    return terms.every((term) => haystack.includes(term));
  });
}

function normalizeCamera(camera) {
  return {
    ...camera,
    _cctvWatchSearchText: searchTextForCamera(camera),
  };
}

export function initializeCctvWatchModule({
  documentRef = document,
  fetchImpl = (...args) => fetch(...args),
} = {}) {
  const root = documentRef.getElementById('cctv-watch-module');
  if (!root) return null;

  const elements = {
    refresh: documentRef.getElementById('cctv-watch-refresh'),
    status: documentRef.getElementById('cctv-watch-list-status'),
    combo: documentRef.getElementById('cctv-watch-camera-combobox'),
    options: documentRef.getElementById('cctv-watch-camera-options'),
    frame: documentRef.getElementById('cctv-watch-frame'),
    empty: documentRef.getElementById('cctv-watch-empty'),
    provider: documentRef.getElementById('cctv-watch-provider'),
    title: documentRef.getElementById('cctv-watch-title'),
    meta: documentRef.getElementById('cctv-watch-meta'),
    analyze: documentRef.getElementById('cctv-watch-analyze'),
    saveReport: documentRef.getElementById('cctv-watch-save-report'),
    report: documentRef.getElementById('cctv-watch-report'),
  };

  let cameras = [];
  let filteredCameras = [];
  let selectedCamera = null;
  let lastScan = null;

  function setStatus(text) {
    if (elements.status) elements.status.textContent = text;
  }

  function cameraLabel(camera) {
    return `${camera.name || camera.id} · ${camera.city || 'Global'}`;
  }

  function setOptionsOpen(open) {
    if (!elements.options || !elements.combo) return;
    elements.options.hidden = !open;
    elements.combo.setAttribute('aria-expanded', String(open));
  }

  function renderOptions() {
    if (!elements.options) return;
    if (!filteredCameras.length) {
      const empty = documentRef.createElement('div');
      empty.className = 'cctv-watch-option-empty';
      empty.textContent = cameras.length
        ? 'No matching cameras'
        : 'No cameras available';
      elements.options.replaceChildren(empty);
      return;
    }
    const visibleCameras = filteredCameras.slice(0, OPTION_RENDER_LIMIT);
    const optionNodes = visibleCameras.map((camera) => {
      const option = documentRef.createElement('button');
      option.type = 'button';
      option.className = 'cctv-watch-option';
      option.setAttribute('role', 'option');
      option.setAttribute(
        'aria-selected',
        String(camera.id === selectedCamera?.id),
      );
      const name = documentRef.createElement('strong');
      name.textContent = camera.name || camera.id;
      const meta = documentRef.createElement('span');
      meta.textContent = `${camera.city || 'Global'} · ${camera.provider || 'Unknown provider'}`;
      option.append(name, meta);
      option.addEventListener('click', () => selectCamera(camera.id));
      return option;
    });
    if (filteredCameras.length > OPTION_RENDER_LIMIT) {
      const more = documentRef.createElement('div');
      more.className = 'cctv-watch-option-empty';
      more.textContent = `${filteredCameras.length - OPTION_RENDER_LIMIT} more matches. Keep typing to narrow.`;
      optionNodes.push(more);
    }
    elements.options.replaceChildren(...optionNodes);
  }

  function syncComboValue() {
    if (!elements.combo) return;
    elements.combo.value = selectedCamera ? cameraLabel(selectedCamera) : '';
    elements.combo.disabled = cameras.length === 0;
  }

  function clearSelectedCamera() {
    selectedCamera = null;
    lastScan = null;
    syncComboValue();
    renderOptions();
    setOptionsOpen(false);
    elements.empty.hidden = false;
    elements.frame.hidden = true;
    elements.frame.removeAttribute('src');
    elements.frame.alt = '';
    elements.provider.textContent = 'NO FEED SELECTED';
    elements.title.textContent = 'Camera detail';
    elements.meta.textContent = 'Choose a camera to prepare analysis.';
    elements.analyze.disabled = true;
    if (elements.saveReport) elements.saveReport.disabled = true;
    elements.report.textContent = 'YOLO scaffold idle.';
  }

  function applySearch() {
    filteredCameras = filterCameras(cameras, elements.combo?.value || '');
    const statusText = elements.combo?.value
      ? `${filteredCameras.length} of ${cameras.length} cameras matched`
      : `${cameras.length} cameras available`;
    if (
      selectedCamera &&
      !filteredCameras.some((camera) => camera.id === selectedCamera.id)
    ) {
      selectedCamera = null;
      renderOptions();
      setOptionsOpen(true);
      setStatus(statusText);
      return;
    }
    renderOptions();
    setOptionsOpen(true);
    setStatus(statusText);
  }

  function selectCamera(cameraId) {
    selectedCamera = cameras.find((camera) => camera.id === cameraId) || null;
    if (!selectedCamera) {
      clearSelectedCamera();
      return;
    }
    lastScan = null;
    filteredCameras = filterCameras(cameras, cameraLabel(selectedCamera));
    syncComboValue();
    renderOptions();
    setOptionsOpen(false);
    elements.empty.hidden = true;
    elements.frame.hidden = false;
    elements.frame.alt = `${selectedCamera.name || selectedCamera.id} CCTV feed`;
    elements.frame.src = cameraFrameUrl(selectedCamera);
    elements.provider.textContent = selectedCamera.provider || 'CCTV SOURCE';
    elements.title.textContent = selectedCamera.name || selectedCamera.id;
    elements.meta.textContent = [
      selectedCamera.city || 'Global',
      selectedCamera.feedType || 'image',
      selectedCamera.sourceKind || 'source',
    ].join(' · ');
    elements.analyze.disabled = false;
    if (elements.saveReport) elements.saveReport.disabled = true;
    elements.report.textContent =
      'YOLO scaffold ready. Run scan to analyze this feed.';
  }

  async function loadCameras() {
    setStatus('Loading cameras');
    elements.refresh.disabled = true;
    try {
      const response = await fetchImpl('/api/cctv/sources', {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      cameras = Array.isArray(payload?.sources)
        ? payload.sources.map(normalizeCamera)
        : [];
      filteredCameras = cameras;
      if (elements.combo) elements.combo.disabled = cameras.length === 0;
      setStatus(`${cameras.length} cameras available`);
      clearSelectedCamera();
    } catch (error) {
      cameras = [];
      filteredCameras = [];
      if (elements.combo) elements.combo.disabled = true;
      clearSelectedCamera();
      setStatus('Camera list unavailable');
      elements.report.textContent = `Camera load failed: ${error?.message || error}`;
    } finally {
      elements.refresh.disabled = false;
    }
  }

  async function runScan() {
    if (!selectedCamera) return;
    elements.analyze.disabled = true;
    if (elements.saveReport) elements.saveReport.disabled = true;
    elements.report.textContent = 'Scan running…';
    try {
      const response = await fetchImpl('/api/cctv-analysis/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraId: selectedCamera.id,
          mode: 'single',
          frameUrl: cameraFrameUrl(selectedCamera),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const scan = await response.json();
      lastScan = scan;
      if (scan.status === 'model_unavailable') {
        elements.report.textContent =
          'Model unavailable: YOLO is not configured on this server. No detections were produced.';
      } else if (scan.status === 'ok') {
        elements.report.textContent = JSON.stringify(scan, null, 2);
      } else {
        elements.report.textContent = `Scan finished with unknown status: ${scan.status || 'none'}`;
      }
      if (elements.saveReport) elements.saveReport.disabled = false;
    } catch (error) {
      lastScan = null;
      elements.report.textContent = `Scan failed: ${error?.message || error}`;
    } finally {
      elements.analyze.disabled = false;
    }
  }

  async function writeReport() {
    if (!selectedCamera) return;
    const payload = reportPayload(selectedCamera, lastScan);
    if (elements.saveReport) elements.saveReport.disabled = true;
    elements.report.textContent = JSON.stringify(payload, null, 2);
    try {
      const response = await fetchImpl('/api/cctv-analysis/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      elements.report.textContent = JSON.stringify(
        { ...payload, reportFile: result.file },
        null,
        2,
      );
    } catch (error) {
      elements.report.textContent = JSON.stringify(
        { ...payload, writeError: String(error?.message || error) },
        null,
        2,
      );
    } finally {
      if (elements.saveReport) elements.saveReport.disabled = false;
    }
  }

  elements.refresh?.addEventListener('click', loadCameras);
  elements.combo?.addEventListener('input', applySearch);
  elements.combo?.addEventListener('focus', () => {
    filteredCameras = filterCameras(cameras, elements.combo?.value || '');
    renderOptions();
    setOptionsOpen(true);
  });
  elements.combo?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOptionsOpen(false);
    if (event.key === 'Enter' && filteredCameras[0]) {
      event.preventDefault();
      selectCamera(filteredCameras[0].id);
    }
  });
  documentRef.addEventListener?.('click', (event) => {
    if (!root.contains(event.target)) setOptionsOpen(false);
  });
  elements.analyze?.addEventListener('click', runScan);
  elements.saveReport?.addEventListener('click', writeReport);
  void loadCameras();

  return Object.freeze({
    loadCameras,
    selectCamera,
    runScan,
    writeReport,
    getState: () =>
      Object.freeze({
        cameraCount: cameras.length,
        filteredCameraCount: filteredCameras.length,
        selectedCameraId: selectedCamera?.id || null,
        lastScanStatus: lastScan?.status || null,
      }),
  });
}
