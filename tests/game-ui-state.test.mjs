import test from 'node:test';
import assert from 'node:assert/strict';

import { createGameplayHudModel } from '../game-ui-state.mjs';

test('HUD model requests motion permission when sensor support exists but permission is pending', () => {
  const hud = createGameplayHudModel({
    motion: {
      permission: 'unknown',
      mode: 'sensor',
      hasSensorSupport: true,
    },
    game: {
      status: 'idle',
      goalReached: false,
      elapsedMs: 0,
      touchMode: false,
    },
  });

  assert.equal(hud.primaryAction.id, 'enable-motion');
  assert.match(hud.primaryAction.label, /Motion/i);
  assert.equal(hud.showTouchHint, false);
});

test('HUD model recommends touch mode when the sensor is unavailable', () => {
  const hud = createGameplayHudModel({
    motion: {
      permission: 'denied',
      mode: 'touch',
      hasSensorSupport: false,
    },
    game: {
      status: 'idle',
      goalReached: false,
      elapsedMs: 0,
      touchMode: true,
    },
  });

  assert.equal(hud.primaryAction.id, 'touch-mode');
  assert.equal(hud.showTouchHint, true);
  assert.match(hud.statusText, /Touch/i);
});

test('HUD model surfaces a win state with retry affordance and formatted timer', () => {
  const hud = createGameplayHudModel({
    motion: {
      permission: 'granted',
      mode: 'sensor',
      hasSensorSupport: true,
    },
    game: {
      status: 'won',
      goalReached: true,
      elapsedMs: 12345,
      touchMode: false,
    },
  });

  assert.equal(hud.primaryAction.id, 'retry');
  assert.match(hud.statusText, /Goal/i);
  assert.equal(hud.timerText, '12.35s');
  assert.equal(hud.showCalibrate, true);
});
