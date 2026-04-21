export const DESIGN_WIDTH = 1888;
export const DESIGN_HEIGHT = 1048;
export const VIEWPORT_PADDING = 16;
export const MIN_UI_SCALE = 0.6;
export const MAX_UI_SCALE = 1;
export const LAYOUT_BREAKPOINTS = {
  compact: 860,
  wide: 1100,
};
export const PANEL_WIDTH_LIMITS = {
  wide: {
    left: { min: 220, max: 300, ratio: 0.16 },
    right: { min: 280, max: 420, ratio: 0.22 },
  },
  compact: {
    left: 220,
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function computeUiScale({
  viewportWidth,
  viewportHeight,
  padding = VIEWPORT_PADDING,
  minScale = MIN_UI_SCALE,
  maxScale = MAX_UI_SCALE,
} = {}) {
  const usableWidth = Number(viewportWidth) - (padding * 2);
  const usableHeight = Number(viewportHeight) - (padding * 2);
  if (!Number.isFinite(usableWidth) || !Number.isFinite(usableHeight) || usableWidth <= 0 || usableHeight <= 0) {
    return 1;
  }
  const widthScale = usableWidth / DESIGN_WIDTH;
  const heightScale = usableHeight / DESIGN_HEIGHT;
  return Number(clamp(Math.min(widthScale, heightScale, maxScale), minScale, maxScale).toFixed(4));
}

export function computeLayoutMode({ viewportWidth } = {}) {
  const width = Number(viewportWidth);
  if (!Number.isFinite(width) || width <= 0) {
    return 'wide';
  }
  if (width <= LAYOUT_BREAKPOINTS.compact) {
    return 'stacked';
  }
  if (width < LAYOUT_BREAKPOINTS.wide) {
    return 'compact';
  }
  return 'wide';
}

export function computeShellSize({ viewportWidth, viewportHeight, padding = VIEWPORT_PADDING } = {}) {
  const width = Math.max(0, Math.round((Number(viewportWidth) || 0) - (padding * 2)));
  const height = Math.max(0, Math.round((Number(viewportHeight) || 0) - (padding * 2)));
  return { width, height };
}

export function computePanelWidths({ layoutMode = 'wide', viewportWidth } = {}) {
  const width = Number(viewportWidth) || 0;
  if (layoutMode === 'compact') {
    return { left: PANEL_WIDTH_LIMITS.compact.left, right: 0 };
  }
  if (layoutMode === 'stacked') {
    return { left: 0, right: 0 };
  }
  const wide = PANEL_WIDTH_LIMITS.wide;
  return {
    left: Math.round(clamp(width * wide.left.ratio, wide.left.min, wide.left.max)),
    right: Math.round(clamp(width * wide.right.ratio, wide.right.min, wide.right.max)),
  };
}
