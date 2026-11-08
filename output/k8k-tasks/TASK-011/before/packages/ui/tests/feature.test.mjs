import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeK8KTheme } from '../dist/feature.js';
test('presentation opt-in survives navigation and explicit zero wins; no storage is required', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map();
  const fake = {
    location: { search: '?ui.k8k=1' },
    document: { documentElement: { dataset: {} } },
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fake });
  try {
    assert.equal(initializeK8KTheme(), true);
    fake.location.search = '';
    assert.equal(initializeK8KTheme(), true);
    fake.location.search = '?ui.k8k=0';
    assert.equal(initializeK8KTheme(), false);
    assert.equal(fake.document.documentElement.dataset.k8k, undefined);
    fake.sessionStorage.getItem = () => {
      throw Error('storage blocked');
    };
    fake.sessionStorage.setItem = () => {
      throw Error('storage blocked');
    };
    fake.location.search = '?ui.k8k=1';
    assert.equal(initializeK8KTheme(), true);
    fake.location.search = '?ui.k8k=0';
    assert.equal(initializeK8KTheme(), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
  }
});
