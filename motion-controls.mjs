const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const DEFAULT_MOTION_CONFIG = {
  deadZone: 0.08,
  invertX: false,
  invertZ: false,
  maxTiltDeg: 35,
  sensitivity: 8,
  smoothing: 0.2,
  timeoutMs: 1200,
};

export function createMotionState(overrides = {}) {
  return {
    permission: 'unknown',
    rawBeta: 0,
    rawGamma: 0,
    filteredX: 0,
    filteredZ: 0,
    calibratedOffsetBeta: 0,
    calibratedOffsetGamma: 0,
    hasSignal: false,
    hasSensorSupport: true,
    lastEventTs: 0,
    mode: 'sensor',
    ...overrides,
  };
}

export function normalizeTilt(value, maxTiltDeg = DEFAULT_MOTION_CONFIG.maxTiltDeg) {
  const maxTilt = Number(maxTiltDeg);
  if (!Number.isFinite(value) || !Number.isFinite(maxTilt) || maxTilt <= 0) {
    return 0;
  }
  return clamp(value / maxTilt, -1, 1);
}

export function calibrateMotionState(state, { beta = 0, gamma = 0 } = {}) {
  return {
    ...createMotionState(state),
    calibratedOffsetBeta: Number.isFinite(beta) ? beta : 0,
    calibratedOffsetGamma: Number.isFinite(gamma) ? gamma : 0,
  };
}

const applyDeadZone = (value, deadZone) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.abs(value) < deadZone ? 0 : value;
};

export function updateMotionState(state, sample = {}, config = DEFAULT_MOTION_CONFIG) {
  const next = createMotionState(state);
  const rawBeta = Number(sample.beta);
  const rawGamma = Number(sample.gamma);
  const now = Number(sample.now) || 0;
  const smoothing = clamp(Number(config.smoothing) || 0, 0, 1);
  const deadZone = Math.max(0, Number(config.deadZone) || 0);
  const beta = Number.isFinite(rawBeta) ? rawBeta : 0;
  const gamma = Number.isFinite(rawGamma) ? rawGamma : 0;
  const normalizedX = applyDeadZone(normalizeTilt(gamma - next.calibratedOffsetGamma, config.maxTiltDeg), deadZone);
  const normalizedZ = applyDeadZone(normalizeTilt(beta - next.calibratedOffsetBeta, config.maxTiltDeg), deadZone);

  return {
    ...next,
    permission: 'granted',
    rawBeta: beta,
    rawGamma: gamma,
    filteredX: Number((next.filteredX + ((normalizedX - next.filteredX) * smoothing)).toFixed(6)),
    filteredZ: Number((next.filteredZ + ((normalizedZ - next.filteredZ) * smoothing)).toFixed(6)),
    hasSignal: true,
    lastEventTs: now,
  };
}

export function buildGravityVector(state, {
  sensitivity = DEFAULT_MOTION_CONFIG.sensitivity,
  invertX = DEFAULT_MOTION_CONFIG.invertX,
  invertZ = DEFAULT_MOTION_CONFIG.invertZ,
} = {}) {
  const scale = Number.isFinite(sensitivity) ? sensitivity : DEFAULT_MOTION_CONFIG.sensitivity;
  const filteredX = Number(state?.filteredX) || 0;
  const filteredZ = Number(state?.filteredZ) || 0;
  return {
    x: Number((((invertX ? -1 : 1) * filteredX) * scale).toFixed(6)),
    z: Number((((invertZ ? -1 : 1) * filteredZ) * scale).toFixed(6)),
  };
}

export function shouldFallbackToTouch({
  hasSensorSupport = true,
  permission = 'unknown',
  hasSignal = false,
  lastEventTs = 0,
  now = 0,
  timeoutMs = DEFAULT_MOTION_CONFIG.timeoutMs,
} = {}) {
  if (!hasSensorSupport || permission === 'denied') {
    return true;
  }
  if (permission !== 'granted' || !hasSignal) {
    return false;
  }
  return ((Number(now) || 0) - (Number(lastEventTs) || 0)) >= (Number(timeoutMs) || DEFAULT_MOTION_CONFIG.timeoutMs);
}
