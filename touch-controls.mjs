const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const DEFAULT_TOUCH_CONFIG = {
  maxDistance: 120,
  smoothing: 0.35,
};

export function createTouchState(overrides = {}) {
  return {
    active: false,
    origin: null,
    current: null,
    vector: { x: 0, z: 0 },
    ...overrides,
  };
}

export function startTouchDrag(state, point) {
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  return {
    ...createTouchState(state),
    active: true,
    origin: { x, y },
    current: { x, y },
  };
}

export function updateTouchDrag(state, point, config = DEFAULT_TOUCH_CONFIG) {
  const next = createTouchState(state);
  if (!next.origin) {
    return next;
  }
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  const maxDistance = Math.max(1, Number(config.maxDistance) || DEFAULT_TOUCH_CONFIG.maxDistance);
  const smoothing = clamp(Number(config.smoothing) || 0, 0, 1);
  const rawX = clamp((x - next.origin.x) / maxDistance, -1, 1);
  const rawZ = clamp((next.origin.y - y) / maxDistance, -1, 1);

  return {
    ...next,
    active: true,
    current: { x, y },
    vector: {
      x: Number((next.vector.x + ((rawX - next.vector.x) * smoothing)).toFixed(6)),
      z: Number((next.vector.z + ((rawZ - next.vector.z) * smoothing)).toFixed(6)),
    },
  };
}

export function endTouchDrag(state) {
  return {
    ...createTouchState(state),
    active: false,
    origin: null,
    current: null,
    vector: { x: 0, z: 0 },
  };
}
