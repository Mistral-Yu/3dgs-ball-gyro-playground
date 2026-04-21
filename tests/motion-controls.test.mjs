import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MOTION_CONFIG,
  buildGravityVector,
  calibrateMotionState,
  createMotionState,
  normalizeTilt,
  shouldFallbackToTouch,
  updateMotionState,
} from '../motion-controls.mjs';

test('normalizeTilt clamps to [-1, 1] using the configured max tilt', () => {
  assert.equal(normalizeTilt(0, 45), 0);
  assert.equal(normalizeTilt(22.5, 45), 0.5);
  assert.equal(normalizeTilt(90, 45), 1);
  assert.equal(normalizeTilt(-90, 45), -1);
});

test('calibrateMotionState stores the current beta/gamma sample as offsets', () => {
  const calibrated = calibrateMotionState(createMotionState(), { beta: 8, gamma: -12 });

  assert.equal(calibrated.calibratedOffsetBeta, 8);
  assert.equal(calibrated.calibratedOffsetGamma, -12);
});

test('updateMotionState applies offsets, dead-zone filtering, and smoothing', () => {
  const calibrated = calibrateMotionState(createMotionState(), { beta: 4, gamma: -6 });
  const updated = updateMotionState(calibrated, {
    beta: 26,
    gamma: 12,
    now: 1000,
  }, {
    ...DEFAULT_MOTION_CONFIG,
    smoothing: 0.25,
    deadZone: 0.1,
    maxTiltDeg: 40,
  });

  assert.equal(updated.permission, 'granted');
  assert.equal(updated.rawBeta, 26);
  assert.equal(updated.rawGamma, 12);
  assert.ok(updated.filteredX > 0.1 && updated.filteredX < 0.25, `expected smoothed x tilt, got ${updated.filteredX}`);
  assert.ok(updated.filteredZ > 0.1 && updated.filteredZ < 0.25, `expected smoothed z tilt, got ${updated.filteredZ}`);
  assert.equal(updated.hasSignal, true);
  assert.equal(updated.lastEventTs, 1000);
});

test('updateMotionState zeroes tiny input inside the dead zone', () => {
  const updated = updateMotionState(createMotionState(), {
    beta: 2,
    gamma: -2,
    now: 100,
  }, {
    ...DEFAULT_MOTION_CONFIG,
    smoothing: 1,
    deadZone: 0.2,
    maxTiltDeg: 45,
  });

  assert.equal(updated.filteredX, 0);
  assert.equal(updated.filteredZ, 0);
});

test('buildGravityVector applies sensitivity and inversion flags', () => {
  const motionState = {
    ...createMotionState(),
    filteredX: 0.4,
    filteredZ: -0.25,
  };

  assert.deepEqual(
    buildGravityVector(motionState, { sensitivity: 9, invertX: true, invertZ: false }),
    { x: -3.6, z: -2.25 },
  );
});

test('shouldFallbackToTouch returns true for unsupported or timed-out sensors', () => {
  assert.equal(shouldFallbackToTouch({ hasSensorSupport: false, permission: 'unknown', hasSignal: false, lastEventTs: 0, now: 1000 }), true);
  assert.equal(shouldFallbackToTouch({ hasSensorSupport: true, permission: 'denied', hasSignal: false, lastEventTs: 0, now: 1000 }), true);
  assert.equal(shouldFallbackToTouch({ hasSensorSupport: true, permission: 'granted', hasSignal: true, lastEventTs: 1000, now: 2200, timeoutMs: 1000 }), true);
  assert.equal(shouldFallbackToTouch({ hasSensorSupport: true, permission: 'granted', hasSignal: true, lastEventTs: 1500, now: 2200, timeoutMs: 1000 }), false);
});
