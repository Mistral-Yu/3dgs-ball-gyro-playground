import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LIGHT_COLOR,
  DEFAULT_LIGHT_HELPER_SCALE,
  clampLightColor,
  createDefaultLightState,
} from '../viewer-lighting.mjs';

test('createDefaultLightState uses the requested helper-size default', () => {
  const light = createDefaultLightState({ sceneLightSerial: 1, radius: 1 });

  assert.equal(light.helperScale, DEFAULT_LIGHT_HELPER_SCALE);
  assert.equal(light.intensity, 12);
  assert.deepEqual(light.color, DEFAULT_LIGHT_COLOR);
});

test('createDefaultLightState scales intensity from scene radius', () => {
  const light = createDefaultLightState({ sceneLightSerial: 3, radius: 4 });

  assert.equal(light.name, 'Point Light 3');
  assert.equal(light.intensity, 64);
});

test('clampLightColor keeps linear sRGB channel values in the 0..1 range', () => {
  assert.deepEqual(
    clampLightColor({ r: 1.5, g: -0.25, b: 0.4 }),
    { r: 1, g: 0, b: 0.4 },
  );
});
