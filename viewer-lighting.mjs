export const DEFAULT_LIGHT_COLOR = {
  r: 1,
  g: 0.7,
  b: 0.45,
};

export const DEFAULT_LIGHT_HELPER_SCALE = 0.1;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function clampLightColor(color = {}) {
  return {
    r: Number(clamp(Number(color.r) || 0, 0, 1).toFixed(4)),
    g: Number(clamp(Number(color.g) || 0, 0, 1).toFixed(4)),
    b: Number(clamp(Number(color.b) || 0, 0, 1).toFixed(4)),
  };
}

export function createDefaultLightState({ sceneLightSerial, radius } = {}) {
  const serial = Number.isFinite(sceneLightSerial) ? sceneLightSerial : 1;
  const safeRadius = Math.max(Number(radius) || 0, 1);
  return {
    color: clampLightColor(DEFAULT_LIGHT_COLOR),
    helperScale: DEFAULT_LIGHT_HELPER_SCALE,
    intensity: Math.max(safeRadius * safeRadius * 4, 12),
    name: `Point Light ${serial}`,
  };
}
