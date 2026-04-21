import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TOUCH_CONFIG,
  createTouchState,
  endTouchDrag,
  startTouchDrag,
  updateTouchDrag,
} from '../touch-controls.mjs';

test('startTouchDrag stores the drag origin and activates touch mode', () => {
  const state = startTouchDrag(createTouchState(), { x: 120, y: 300 });

  assert.equal(state.active, true);
  assert.deepEqual(state.origin, { x: 120, y: 300 });
  assert.deepEqual(state.current, { x: 120, y: 300 });
});

test('updateTouchDrag converts drag distance into a smoothed normalized vector', () => {
  let state = startTouchDrag(createTouchState(), { x: 100, y: 100 });
  state = updateTouchDrag(state, { x: 160, y: 40 }, { ...DEFAULT_TOUCH_CONFIG, maxDistance: 100, smoothing: 0.5 });

  assert.equal(state.active, true);
  assert.ok(state.vector.x > 0.25 && state.vector.x < 0.35, `unexpected x value: ${state.vector.x}`);
  assert.ok(state.vector.z > 0.25 && state.vector.z < 0.35, `unexpected z value: ${state.vector.z}`);
});

test('updateTouchDrag clamps large drags to unit length', () => {
  let state = startTouchDrag(createTouchState(), { x: 0, y: 0 });
  state = updateTouchDrag(state, { x: 1000, y: -1000 }, { ...DEFAULT_TOUCH_CONFIG, maxDistance: 80, smoothing: 1 });

  assert.deepEqual(state.vector, { x: 1, z: 1 });
});

test('endTouchDrag keeps touch mode available but zeros the active vector', () => {
  let state = startTouchDrag(createTouchState(), { x: 0, y: 0 });
  state = updateTouchDrag(state, { x: 50, y: 0 }, { ...DEFAULT_TOUCH_CONFIG, maxDistance: 100, smoothing: 1 });
  state = endTouchDrag(state);

  assert.equal(state.active, false);
  assert.deepEqual(state.vector, { x: 0, z: 0 });
  assert.deepEqual(state.origin, null);
});
