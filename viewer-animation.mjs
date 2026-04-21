export const DEFAULT_ANIMATION_SCRIPT_NAME = 'Splat Explosion';

const EXPLOSION_SCRIPT_SOURCE = `({
  version: 1,
  name: 'Splat Explosion',
  preset: 'explosion',
  duration: 3.2,
  loop: true,
  originMode: 'centroid',
  origin: [0, 0, 0],
  params: {
    distanceScale: 1.1,
    opacityPower: 0.65,
    scaleInfluence: 1.6,
    speed: 0.6,
    strength: 1.2,
    swirl: 0.35,
  },
  createModifier: ({ dyno, handles }) => {
    const {
      Gsplat,
      add,
      clamp,
      combineGsplat,
      cos,
      cross,
      div,
      dynoBlock,
      dynoConst,
      length,
      max = dyno.Max,
      mul,
      normalize,
      pow,
      splitGsplat,
      sub,
    } = dyno;
    const {
      distanceScale,
      epsilon,
      epsilonVector,
      opacityPower,
      origin,
      scaleInfluence,
      speed,
      strength,
      swirl,
      time,
      up,
    } = handles;
    return dynoBlock({ gsplat: Gsplat }, { gsplat: Gsplat }, ({ gsplat }) => {
      if (!gsplat) {
        throw new Error('No gsplat input');
      }
      const outputs = splitGsplat(gsplat).outputs;
      const floatZero = dynoConst('float', 0);
      const floatOne = dynoConst('float', 1);
      const burstWave = dynoConst('float', 8.0);
      const fadeFloor = dynoConst('float', 0.42);
      const radialBias = dynoConst('float', 0.18);
      const radialScale = dynoConst('float', 0.065);
      const shellBias = dynoConst('float', 0.5);
      const swirlScale = dynoConst('float', 0.014);
      const swirlFalloff = dynoConst('float', 0.45);
      const burstEaseTwo = dynoConst('float', 2.0);
      const relative = sub(outputs.center, origin);
      const distanceFromOrigin = max(length(relative), epsilon);
      const direction = normalize(add(relative, epsilonVector));
      const tangent = normalize(add(cross(direction, up), epsilonVector));
      const scaleMagnitude = max(length(outputs.scales), epsilon);
      const scaleFactor = add(floatOne, mul(scaleMagnitude, scaleInfluence));
      const travel = sub(mul(mul(time, speed), scaleFactor), mul(distanceFromOrigin, distanceScale));
      const burst = clamp(travel, floatZero, floatOne);
      const fade = pow(sub(floatOne, burst), opacityPower);
      const burstEase = mul(burst, sub(burstEaseTwo, burst));
      const distanceEnvelope = div(distanceFromOrigin, add(distanceFromOrigin, add(scaleMagnitude, shellBias)));
      const radialOffset = mul(
        direction,
        mul(
          distanceFromOrigin,
          mul(
            add(radialBias, distanceEnvelope),
            mul(strength, mul(scaleFactor, mul(radialScale, burstEase))),
          ),
        ),
      );
      const swirlOffset = mul(
        tangent,
        mul(
          cos(add(mul(distanceFromOrigin, burstWave), mul(time, add(swirl, dynoConst('float', 1.5))))),
          mul(
            distanceFromOrigin,
            mul(strength, mul(swirl, mul(swirlScale, mul(burstEase, sub(floatOne, mul(burst, swirlFalloff)))))),
          ),
        ),
      );
      return {
        gsplat: combineGsplat({
          gsplat,
          center: add(outputs.center, add(radialOffset, swirlOffset)),
          opacity: clamp(max(fade, fadeFloor), floatZero, floatOne),
        }),
      };
    });
  },
})`;

const REVEAL_SCRIPT_SOURCE = `({
  version: 1,
  name: 'Splat Reveal',
  preset: 'reveal',
  duration: 3.6,
  loop: true,
  originMode: 'centroid',
  origin: [0, 0, 0],
  params: {
    distanceScale: 0.85,
    opacityPower: 1.15,
    scaleInfluence: 0.8,
    speed: 1.0,
    strength: 1.5,
    swirl: 0.2,
  },
  createModifier: ({ dyno, handles }) => {
    const {
      Gsplat,
      add,
      clamp,
      combineGsplat,
      dynoBlock,
      dynoConst,
      length,
      max = dyno.Max,
      mul,
      pow,
      splitGsplat,
      sub,
    } = dyno;
    const {
      distanceScale,
      epsilon,
      opacityPower,
      origin,
      scaleInfluence,
      speed,
      strength,
      time,
    } = handles;
    return dynoBlock({ gsplat: Gsplat }, { gsplat: Gsplat }, ({ gsplat }) => {
      if (!gsplat) {
        throw new Error('No gsplat input');
      }
      const outputs = splitGsplat(gsplat).outputs;
      const floatZero = dynoConst('float', 0);
      const floatOne = dynoConst('float', 1);
      const relative = sub(outputs.center, origin);
      const distanceFromOrigin = max(length(relative), epsilon);
      const scaleMagnitude = max(length(outputs.scales), epsilon);
      const revealEdge = sub(mul(mul(time, speed), add(floatOne, mul(scaleMagnitude, scaleInfluence))), mul(distanceFromOrigin, distanceScale));
      const reveal = clamp(revealEdge, floatZero, floatOne);
      const opacity = pow(reveal, opacityPower);
      const drift = mul(relative, mul(sub(floatOne, reveal), mul(strength, dynoConst('float', 0.12))));
      return {
        gsplat: combineGsplat({
          gsplat,
          center: sub(outputs.center, drift),
          opacity: opacity,
        }),
      };
    });
  },
})`;

const PRESET_SCRIPT_LIBRARY = {
  explosion: EXPLOSION_SCRIPT_SOURCE,
  reveal: REVEAL_SCRIPT_SOURCE,
};

export const ANIMATION_PRESET_LIBRARY = PRESET_SCRIPT_LIBRARY;

const PRESET_DEFAULTS = {
  explosion: {
    duration: 3.2,
    loop: true,
    origin: [0, 0, 0],
    originMode: 'centroid',
    params: {
      distanceScale: 1.1,
      opacityPower: 0.65,
      scaleInfluence: 1.6,
      speed: 0.6,
      strength: 1.2,
      swirl: 0.35,
    },
  },
  reveal: {
    duration: 3.6,
    loop: true,
    origin: [0, 0, 0],
    originMode: 'centroid',
    params: {
      distanceScale: 0.85,
      opacityPower: 1.15,
      scaleInfluence: 0.8,
      speed: 1,
      strength: 1.5,
      swirl: 0.2,
    },
  },
};

const PARAM_LIMITS = {
  distanceScale: { min: 0, max: 6, default: 1.2 },
  opacityPower: { min: 0.1, max: 4, default: 1.2 },
  scaleInfluence: { min: 0, max: 4, default: 1 },
  speed: { min: 0.05, max: 8, default: 1 },
  strength: { min: 0, max: 12, default: 1.5 },
  swirl: { min: 0, max: 6, default: 0 },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value, digits = 4) => Number(Number(value).toFixed(digits));
const indentBlock = (text, spaces = 2) => String(text).replace(/\n/g, `\n${' '.repeat(spaces)}`);

const normalizeOrigin = (origin) => {
  const values = Array.isArray(origin) ? origin : [origin?.x, origin?.y, origin?.z];
  return {
    x: round(Number(values[0]) || 0),
    y: round(Number(values[1]) || 0),
    z: round(Number(values[2]) || 0),
  };
};

const normalizeOriginMode = (value, fallback = 'manual') => {
  if (value === 'centroid' || value === 'manual') {
    return value;
  }
  return fallback;
};

const normalizeParams = (params = {}, defaults = {}) => {
  const result = {};
  Object.entries(PARAM_LIMITS).forEach(([key, limits]) => {
    const fallback = defaults[key] ?? limits.default;
    const value = params[key] ?? fallback;
    result[key] = round(clamp(Number(value) || 0, limits.min, limits.max));
  });
  return result;
};

const evaluateAnimationScriptSource = (text) => {
  const source = String(text || '').trim();
  if (!source) {
    throw new Error('Animation script is empty');
  }
  return Function(`"use strict"; return (${source}\n);`)();
};

const normalizeAnimationConfig = (source) => {
  if (!source || typeof source !== 'object') {
    throw new Error('Animation script must evaluate to an object');
  }
  if (source.preset != null && !(source.preset in PRESET_SCRIPT_LIBRARY)) {
    throw new Error(`Unknown animation preset: ${source.preset}`);
  }
  if (typeof source.createModifier !== 'function') {
    throw new Error('Animation script must define createModifier({ dyno, handles })');
  }
  const preset = source.preset ?? 'explosion';
  const presetDefaults = PRESET_DEFAULTS[preset];
  const originMode = normalizeOriginMode(source.originMode, presetDefaults.originMode ?? 'manual');
  return {
    createModifier: source.createModifier,
    duration: round(clamp(Number(source.duration) || presetDefaults.duration, 0.1, 120), 3),
    loop: source.loop !== false,
    name: String(source.name || DEFAULT_ANIMATION_SCRIPT_NAME).trim() || DEFAULT_ANIMATION_SCRIPT_NAME,
    origin: normalizeOrigin(source.origin ?? presetDefaults.origin),
    originMode,
    params: normalizeParams(source.params, presetDefaults.params),
    preset,
    version: 1,
  };
};

export function parseAnimationScript(text) {
  return normalizeAnimationConfig(evaluateAnimationScriptSource(text));
}

export function serializeAnimationScript(config) {
  const parsed = typeof config === 'string' ? parseAnimationScript(config) : normalizeAnimationConfig(config);
  const originSource = indentBlock(JSON.stringify([parsed.origin.x, parsed.origin.y, parsed.origin.z], null, 2));
  const paramsSource = indentBlock(JSON.stringify(parsed.params, null, 2));
  const modifierSource = indentBlock(parsed.createModifier.toString());
  return `({
  version: ${parsed.version},
  name: ${JSON.stringify(parsed.name)},
  preset: ${JSON.stringify(parsed.preset)},
  duration: ${parsed.duration},
  loop: ${parsed.loop},
  originMode: ${JSON.stringify(parsed.originMode || 'manual')},
  origin: ${originSource},
  params: ${paramsSource},
  createModifier: ${modifierSource},
})`;
}

export function createAnimationModifierFromScript(script, { dyno, handles }) {
  if (!script) {
    return null;
  }
  return script.createModifier({ dyno, handles });
}

export function getAnimationPresetScriptText(name) {
  if (!(name in PRESET_SCRIPT_LIBRARY)) {
    throw new Error(`Unknown animation preset: ${name}`);
  }
  return PRESET_SCRIPT_LIBRARY[name];
}

export function buildAnimationDownloadName(name) {
  const normalized = String(name || 'animation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'animation';
  return `${normalized}.js`;
}

export function createDefaultAnimationPlaybackState(script) {
  return {
    animationApplied: false,
    animationDuration: Math.max(script?.duration || 0, 0),
    animationLoop: Boolean(script?.loop),
    animationPlaying: false,
    animationTime: 0,
  };
}

export function shouldRenderAnimationFrame(state) {
  return Boolean(state?.animationApplied && state?.animationPlaying);
}

export function canPlayAnimation({ animationApplied, hasModifier }) {
  return Boolean(animationApplied && hasModifier);
}
