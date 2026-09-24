const MODULES = Object.freeze([
  { id: 'god-eye', label: "God's Eye View", elementId: 'god-eye-module' },
  { id: 'coming-soon', label: 'Coming Soon', elementId: 'coming-soon-module' },
]);

function createEmptyModule(documentRef, side) {
  const surface = documentRef.createElement('section');
  surface.className = 'module-surface empty-module';
  surface.setAttribute('aria-label', `${side} module empty`);
  surface.innerHTML = `
    <div class="coming-soon-panel">
      <span class="coming-soon-kicker">UNASSIGNED</span>
      <h2>NO MODULE</h2>
      <p>Select a module from the command bar.</p>
    </div>
  `;
  return surface;
}

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

function moduleById(moduleId) {
  return MODULES.find((module) => module.id === moduleId) || MODULES[1];
}

export function initializeParentShell({
  documentRef = document,
  windowRef = window,
} = {}) {
  const shell = documentRef.getElementById('parent-app-shell');
  const leftPane = documentRef.getElementById('left-module-pane');
  const rightPane = documentRef.getElementById('right-module-pane');
  const leftSelect = documentRef.getElementById('left-module-select');
  const rightSelect = documentRef.getElementById('right-module-select');
  if (!shell || !leftPane || !rightPane || !leftSelect || !rightSelect)
    return null;

  const emptyLeft = createEmptyModule(documentRef, 'Left');
  const emptyRight = createEmptyModule(documentRef, 'Right');
  const state = {
    left: 'god-eye',
    right: 'coming-soon',
  };

  populateSelector(documentRef, leftSelect, state.left);
  populateSelector(documentRef, rightSelect, state.right);

  function selectedFor(side, nextId) {
    if (nextId !== 'god-eye') return nextId;
    const opposite = side === 'left' ? 'right' : 'left';
    if (state[opposite] === 'god-eye') state[opposite] = 'coming-soon';
    return nextId;
  }

  function mountPane(pane, side, moduleId) {
    const module = moduleById(moduleId);
    const element = documentRef.getElementById(module.elementId);
    pane.replaceChildren(element || (side === 'left' ? emptyLeft : emptyRight));
    pane.dataset.module = module.id;
  }

  function sync() {
    mountPane(leftPane, 'left', state.left);
    mountPane(rightPane, 'right', state.right);
    leftSelect.value = state.left;
    rightSelect.value = state.right;
    shell.dataset.leftModule = state.left;
    shell.dataset.rightModule = state.right;
    windowRef.dispatchEvent(new Event('resize'));
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
    setModules({ left = state.left, right = state.right } = {}) {
      state.left = selectedFor('left', left);
      state.right = selectedFor('right', right);
      if (state.left === 'god-eye' && state.right === 'god-eye')
        state.right = 'coming-soon';
      sync();
    },
  });
}
