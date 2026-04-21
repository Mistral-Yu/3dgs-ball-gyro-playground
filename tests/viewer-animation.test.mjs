import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANIMATION_PRESET_LIBRARY,
  DEFAULT_ANIMATION_SCRIPT_NAME,
  buildAnimationDownloadName,
  canPlayAnimation,
  createDefaultAnimationPlaybackState,
  getAnimationPresetScriptText,
  parseAnimationScript,
  shouldRenderAnimationFrame,
} from '../viewer-animation.mjs';

const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const isVec3 = (value) =>
  Boolean(value) &&
  typeof value === 'object' &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y) &&
  Number.isFinite(value.z);
const mapVec3 = (value, fn) => vec3(fn(value.x), fn(value.y), fn(value.z));
const zipVec3 = (left, right, fn) => vec3(
  fn(left.x, right.x),
  fn(left.y, right.y),
  fn(left.z, right.z),
);
const vec3Length = (value) => Math.hypot(value.x, value.y, value.z);

const addValue = (left, right) => {
  if (isVec3(left) && isVec3(right)) {
    return zipVec3(left, right, (a, b) => a + b);
  }
  if (isVec3(left)) {
    return mapVec3(left, (value) => value + right);
  }
  if (isVec3(right)) {
    return mapVec3(right, (value) => left + value);
  }
  return left + right;
};

const subValue = (left, right) => {
  if (isVec3(left) && isVec3(right)) {
    return zipVec3(left, right, (a, b) => a - b);
  }
  if (isVec3(left)) {
    return mapVec3(left, (value) => value - right);
  }
  if (isVec3(right)) {
    return mapVec3(right, (value) => left - value);
  }
  return left - right;
};

const mulValue = (left, right) => {
  if (isVec3(left) && isVec3(right)) {
    return zipVec3(left, right, (a, b) => a * b);
  }
  if (isVec3(left)) {
    return mapVec3(left, (value) => value * right);
  }
  if (isVec3(right)) {
    return mapVec3(right, (value) => left * value);
  }
  return left * right;
};

const divValue = (left, right) => {
  if (isVec3(left) && isVec3(right)) {
    return zipVec3(left, right, (a, b) => a / b);
  }
  if (isVec3(left)) {
    return mapVec3(left, (value) => value / right);
  }
  if (isVec3(right)) {
    return mapVec3(right, (value) => left / value);
  }
  return left / right;
};

const normalizeVec3 = (value) => {
  const length = vec3Length(value);
  return length > 1e-9 ? divValue(value, length) : vec3();
};

const crossVec3 = (left, right) => vec3(
  left.y * right.z - left.z * right.y,
  left.z * right.x - left.x * right.z,
  left.x * right.y - left.y * right.x,
);

const createNumericDyno = () => {
  const dyno = {
    Gsplat: Symbol('Gsplat'),
    add: addValue,
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    combineGsplat: ({ gsplat, ...patch }) => ({ ...gsplat, ...patch }),
    cos: Math.cos,
    cross: crossVec3,
    div: divValue,
    dynoBlock: (_inputs, _outputs, fn) => (inputs) => fn(inputs),
    dynoConst: (_type, value) => value,
    length: vec3Length,
    Max: Math.max,
    mul: mulValue,
    normalize: normalizeVec3,
    pow: Math.pow,
    splitGsplat: (gsplat) => ({ outputs: gsplat }),
    sub: subValue,
  };
  return dyno;
};

const evaluateExplosionPresetSample = ({
  center,
  scale = 0.18,
  time = 1.3,
}) => {
  const script = parseAnimationScript(getAnimationPresetScriptText('explosion'));
  const dyno = createNumericDyno();
  const handles = {
    distanceScale: script.params.distanceScale,
    epsilon: 0.0001,
    epsilonVector: vec3(0.0001, 0.0001, 0.0001),
    opacityPower: script.params.opacityPower,
    origin: vec3(0, 0, 0),
    scaleInfluence: script.params.scaleInfluence,
    speed: script.params.speed,
    strength: script.params.strength,
    swirl: script.params.swirl,
    time,
    up: normalizeVec3(vec3(0, 1, 0.35)),
  };
  const modifier = script.createModifier({ dyno, handles });
  return modifier({
    gsplat: {
      center,
      opacity: 1,
      scales: vec3(scale, scale, scale),
    },
  }).gsplat;
};

test('built-in presets include explosion and reveal scripts', () => {
  assert.deepEqual(Object.keys(ANIMATION_PRESET_LIBRARY), ['explosion', 'reveal']);

  const explosion = parseAnimationScript(getAnimationPresetScriptText('explosion'));
  const reveal = parseAnimationScript(getAnimationPresetScriptText('reveal'));

  assert.equal(explosion.name, DEFAULT_ANIMATION_SCRIPT_NAME);
  assert.equal(explosion.preset, 'explosion');
  assert.equal(explosion.originMode, 'centroid');
  assert.equal(reveal.preset, 'reveal');
  assert.equal(reveal.originMode, 'centroid');
  assert.equal(typeof reveal.createModifier, 'function');
});

test('explosion preset keeps a visible opacity floor for uniform primitive shells', () => {
  const explosionSource = getAnimationPresetScriptText('explosion');

  assert.match(explosionSource, /fadeFloor/);
  assert.match(explosionSource, /max\(fade,\s*fadeFloor\)/);
});

test('explosion preset keeps primitive sphere shell splats visibly clustered through the burst window', () => {
  const primitiveShellCenters = [
    vec3(0.6, 0.2, 0.1),
    vec3(-0.55, 0.35, 0.15),
    vec3(0.12, -0.58, -0.22),
    vec3(0.75, 0, 0),
    vec3(0, 0.75, 0),
    vec3(0, 0, 0.75),
  ];
  const burstWindow = [1.2, 1.4, 1.6];

  primitiveShellCenters.forEach((center) => {
    const initialDistance = vec3Length(center);
    const animatedSamples = burstWindow.map((time) => evaluateExplosionPresetSample({ center, time }));
    const animatedDistances = animatedSamples.map((sample) => vec3Length(sample.center));
    const minOpacity = Math.min(...animatedSamples.map((sample) => sample.opacity));
    const maxDistanceRatio = Math.max(...animatedDistances.map((distance) => distance / initialDistance));
    const burstDistanceRatio = vec3Length(animatedSamples[1].center) / initialDistance;

    assert.ok(minOpacity >= 0.4, `burst opacity should stay clearly visible (got ${minOpacity.toFixed(3)})`);
    assert.ok(burstDistanceRatio > 1.05, `preset should still read as a subtle outward burst (got ${burstDistanceRatio.toFixed(3)}x)`);
    assert.ok(
      maxDistanceRatio <= 1.12,
      `animated shell splat should stay visually near the primitive shell during playback (got ${maxDistanceRatio.toFixed(3)}x radius)`,
    );
  });
});

test('legacy diffusion scripts are rejected instead of being silently remapped', () => {
  assert.throws(
    () => parseAnimationScript(JSON.stringify({ preset: 'diffusion', duration: 6, loop: true, params: {} })),
    /Unknown animation preset: diffusion/,
  );
});

test('parseAnimationScript clamps numeric parameters and keeps manual origin vectors', () => {
  const parsed = parseAnimationScript(`({
    name: 'Custom Burst',
    preset: 'explosion',
    loop: false,
    duration: 12,
    originMode: 'manual',
    origin: [1, 2, 3],
    params: {
      distanceScale: -4,
      opacityPower: 9,
      scaleInfluence: 3,
      speed: 2.5,
      strength: 8,
      swirl: 4,
    },
    createModifier: ({ handles }) => handles.speed,
  })`);

  assert.equal(parsed.originMode, 'manual');
  assert.deepEqual(parsed.origin, { x: 1, y: 2, z: 3 });
  assert.equal(parsed.loop, false);
  assert.equal(parsed.params.distanceScale, 0);
  assert.equal(parsed.params.opacityPower, 4);
  assert.equal(parsed.params.scaleInfluence, 3);
  assert.equal(parsed.params.speed, 2.5);
  assert.equal(typeof parsed.createModifier, 'function');
});

test('parseAnimationScript rejects scripts without movement code', () => {
  assert.throws(
    () => parseAnimationScript(`({
      name: 'Broken Script',
      preset: 'explosion',
      duration: 2,
      loop: true,
      params: { speed: 1 }
    })`),
    /createModifier/,
  );
});

test('buildAnimationDownloadName normalizes the script name for saving', () => {
  assert.equal(buildAnimationDownloadName('Diffuse / Burst v1'), 'diffuse-burst-v1.js');
});

test('createDefaultAnimationPlaybackState keeps animation off when no script is loaded', () => {
  const state = createDefaultAnimationPlaybackState(null);

  assert.equal(state.animationLoop, false);
  assert.equal(state.animationPlaying, false);
  assert.equal(state.animationTime, 0);
  assert.equal(state.animationDuration, 0);
  assert.equal(state.animationApplied, false);
});

test('shouldRenderAnimationFrame requires an applied script that is actively playing', () => {
  assert.equal(shouldRenderAnimationFrame({ animationApplied: false, animationPlaying: true }), false);
  assert.equal(shouldRenderAnimationFrame({ animationApplied: true, animationPlaying: false }), false);
  assert.equal(shouldRenderAnimationFrame({ animationApplied: true, animationPlaying: true }), true);
});

test('canPlayAnimation requires an already applied modifier and does not auto-apply loaded scripts', () => {
  assert.equal(canPlayAnimation({ animationApplied: false, hasModifier: false }), false);
  assert.equal(canPlayAnimation({ animationApplied: false, hasModifier: true }), false);
  assert.equal(canPlayAnimation({ animationApplied: true, hasModifier: false }), false);
  assert.equal(canPlayAnimation({ animationApplied: true, hasModifier: true }), true);
});
