const MODULES = Object.freeze([
  { id: 'god-eye', label: "God's Eye View", elementId: 'god-eye-module' },
  { id: 'cctv-watch', label: 'CCTV Watch', elementId: 'cctv-watch-module' },
]);

function populateSelector(documentRef, select, selectedId) {
  select.replaceChildren(
    ...MODULES.map((module) => {
      const option = documentRef.createElement('option');
      option.value = module.id;
      option.textContent = module.label;
      option.selected = module.id === selectedId;
      return option;
    }),
  );
}

/**
 * This function selects a module by moduleId
 * @param {*} moduleId
 * @returns the found module
 */
function moduleById(moduleId) {
  return MODULES.find((module) => module.id === moduleId) ?? MODULES[0];
}

function createModuleChangeEvent(windowRef, detail) {
  const EventCtor =
    windowRef?.CustomEvent ||
    (typeof CustomEvent === 'function' ? CustomEvent : null);

  if (EventCtor) return new EventCtor('gev:modules-changed', { detail });

  const event = new Event('gev:modules-changed');
  event.detail = detail;
  return event;
}

function dispatchResize(windowRef) {
  windowRef.dispatchEvent(new Event('resize'));
}

function scheduleResizeFrames(windowRef) {
  dispatchResize(windowRef);
  const requestFrame =
    windowRef?.requestAnimationFrame ||
    (typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : null);
  if (!requestFrame) return;
  requestFrame(() => {
    dispatchResize(windowRef);
    requestFrame(() => dispatchResize(windowRef));
  });
}

export function initializeParentShell({
  documentRef = document,
  windowRef = window,
  onModulesChanged,
} = {}) {
  // shell
  const shell = documentRef.getElementById('parent-app-shell');

  // left and right pane
  const leftPane = documentRef.getElementById('left-module-pane');
  const rightPane = documentRef.getElementById('right-module-pane');

  // left and right dropdown
  const leftSelect = documentRef.getElementById('left-module-select');
  const rightSelect = documentRef.getElementById('right-module-select');

  // screen splitter
  const splitter = documentRef.getElementById('module-splitter');
  if (!shell || !leftPane || !rightPane || !leftSelect || !rightSelect)
    return null;

  if (splitter) {
    const split =
      documentRef.querySelector?.('.parent-app-split') ||
      splitter.parentElement;
    const setSplit = (clientX) => {
      const rect = split?.getBoundingClientRect?.();
      if (!rect || !rect.width) return;
      const percent = Math.max(
        25,
        Math.min(75, ((clientX - rect.left) / rect.width) * 100),
      );
      split.style.setProperty('--module-split', `${percent}%`);
      splitter.setAttribute('aria-valuenow', String(Math.round(percent)));
      scheduleResizeFrames(windowRef);
    };
    splitter.addEventListener('pointerdown', (event) => {
      splitter.setPointerCapture?.(event.pointerId);
      split?.classList.add('is-resizing');
      setSplit(event.clientX);
    });
    splitter.addEventListener('pointermove', (event) => {
      if (splitter.hasPointerCapture?.(event.pointerId))
        setSplit(event.clientX);
    });
    const stopResize = (event) => {
      if (splitter.hasPointerCapture?.(event.pointerId))
        splitter.releasePointerCapture?.(event.pointerId);
      split?.classList.remove('is-resizing');
    };
    splitter.addEventListener('pointerup', stopResize);
    splitter.addEventListener('pointercancel', stopResize);
    splitter.addEventListener('keydown', (event) => {
      const current = Number(splitter.getAttribute('aria-valuenow')) || 50;
      const next =
        event.key === 'ArrowLeft'
          ? current - 2
          : event.key === 'ArrowRight'
            ? current + 2
            : event.key === 'Home'
              ? 25
              : event.key === 'End'
                ? 75
                : null;
      if (next === null) return;
      event.preventDefault();
      const rect = split?.getBoundingClientRect?.();
      if (rect) setSplit(rect.left + (next / 100) * rect.width);
    });
  }

  // Capture the module nodes once. Looking them up by id on every mount is
  // unsafe here: a swap moves each node out of the pane it currently lives in,
  // so the second lookup would see a node that is no longer in the document.
  const moduleElements = new Map(
    MODULES.map((module) => [
      module.id,
      documentRef.getElementById(module.elementId),
    ]),
  );

  const state = {
    left: 'god-eye',
    right: 'cctv-watch',
  };

  populateSelector(documentRef, leftSelect, state.left);
  populateSelector(documentRef, rightSelect, state.right);

  function selectedFor(side, nextId) {
    // Normalise before the id enters state so the panes, the selects and the
    // shell dataset can never disagree about which modules exist.
    const id = MODULES.some((module) => module.id === nextId)
      ? nextId
      : MODULES[0].id;
    const opposite = side === 'left' ? 'right' : 'left';
    if (state[opposite] === id) state[opposite] = state[side];
    return id;
  }

  function mountPane(pane, moduleId) {
    const module = moduleById(moduleId);
    pane.replaceChildren(moduleElements.get(module.id));
    pane.dataset.module = module.id;
  }

  /**
   * Invoking this function would sync the modules
   */
  function sync() {
    mountPane(leftPane, state.left);
    mountPane(rightPane, state.right);

    leftSelect.value = state.left;
    rightSelect.value = state.right;

    shell.dataset.leftModule = state.left;
    shell.dataset.rightModule = state.right;

    const detail = Object.freeze({ ...state });
    onModulesChanged?.(detail);
    windowRef.dispatchEvent(createModuleChangeEvent(windowRef, detail));
    scheduleResizeFrames(windowRef);
  }

  leftSelect.addEventListener('change', () => {
    state.left = selectedFor('left', leftSelect.value);
    sync();
  });

  rightSelect.addEventListener('change', () => {
    state.right = selectedFor('right', rightSelect.value);
    sync();
  });

  sync();
  return Object.freeze({
    getState: () => Object.freeze({ ...state }),
    setModules(modules = {}) {
      // Apply only the sides the caller actually named. Defaulting from state
      // here would re-feed a pre-swap value into selectedFor and undo the swap
      // that the other side just performed.
      if (modules.left !== undefined)
        state.left = selectedFor('left', modules.left);
      if (modules.right !== undefined)
        state.right = selectedFor('right', modules.right);
      sync();
    },
  });
}
