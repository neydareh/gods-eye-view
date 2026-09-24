import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeParentShell } from './parentShell.js';

class FakeElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.attributes = new Map();
    this.value = '';
    this.textContent = '';
    this.className = '';
    this.innerHTML = '';
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatch(type) {
    this.listeners.get(type)?.({ target: this });
  }
}

function fixture() {
  const elements = new Map();
  const ids = [
    'parent-app-shell',
    'left-module-pane',
    'right-module-pane',
    'left-module-select',
    'right-module-select',
    'god-eye-module',
    'coming-soon-module',
  ];
  for (const id of ids) elements.set(id, new FakeElement(id));
  const documentRef = {
    createElement: (tagName) => new FakeElement('', tagName),
    getElementById: (id) => elements.get(id) || null,
  };
  let resizeCount = 0;
  const windowRef = {
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    dispatchEvent(event) {
      if (event.type === 'resize') resizeCount += 1;
    },
  };
  return {
    elements,
    documentRef,
    windowRef,
    getResizeCount: () => resizeCount,
  };
}

test('parent shell mounts God Eye left and Coming Soon right by default', () => {
  const f = fixture();
  const shell = initializeParentShell(f);
  assert.deepEqual(shell.getState(), {
    left: 'god-eye',
    right: 'coming-soon',
  });
  assert.equal(
    f.elements.get('left-module-pane').children[0],
    f.elements.get('god-eye-module'),
  );
  assert.equal(
    f.elements.get('right-module-pane').children[0],
    f.elements.get('coming-soon-module'),
  );
  assert.equal(f.getResizeCount(), 1);
});

test('parent shell publishes module changes', () => {
  const f = fixture();
  const changes = [];
  const shell = initializeParentShell({
    ...f,
    onModulesChanged: (state) => changes.push(state),
  });
  shell.setModules({ left: 'coming-soon', right: 'cctv-watch' });
  assert.deepEqual(changes, [
    { left: 'god-eye', right: 'coming-soon' },
    { left: 'coming-soon', right: 'cctv-watch' },
  ]);
});

test('parent shell schedules resize frames for smooth Cesium remounts', () => {
  const f = fixture();
  const frames = [];
  f.windowRef.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  initializeParentShell(f);
  assert.equal(f.getResizeCount(), 1);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(f.getResizeCount(), 2);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(f.getResizeCount(), 3);
});

test('parent shell moves God Eye instead of duplicating it', () => {
  const f = fixture();
  const shell = initializeParentShell(f);
  shell.setModules({ right: 'god-eye' });
  assert.deepEqual(shell.getState(), {
    left: 'coming-soon',
    right: 'god-eye',
  });
  assert.equal(
    f.elements.get('right-module-pane').children[0],
    f.elements.get('god-eye-module'),
  );
  assert.equal(
    f.elements.get('left-module-pane').children[0],
    f.elements.get('coming-soon-module'),
  );
});
