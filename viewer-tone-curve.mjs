const TONE_CURVE_CHANNELS = ['master', 'red', 'green', 'blue'];
const MIN_POINT_GAP = 0.001;
const DEFAULT_CHANNEL = 'master';

const clamp01 = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(Math.max(parsed, 0), 1);
};

const sanitizeChannel = (channel) => (TONE_CURVE_CHANNELS.includes(channel) ? channel : DEFAULT_CHANNEL);

const clonePoint = (point) => ({ x: clamp01(point?.x), y: clamp01(point?.y) });

const sortPoints = (points) => [...points]
  .map(clonePoint)
  .sort((left, right) => left.x - right.x);

const normalizeCurvePoints = (points) => {
  const source = Array.isArray(points) && points.length >= 2
    ? points.map(clonePoint)
    : [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  const lastIndex = source.length - 1;
  const normalized = [];
  source.forEach((point, index) => {
    const minX = index === 0 ? 0 : normalized[index - 1].x + MIN_POINT_GAP;
    const maxX = 1 - ((lastIndex - index) * MIN_POINT_GAP);
    normalized.push({
      x: Math.min(Math.max(point.x, minX), maxX),
      y: clamp01(point.y),
    });
  });
  return normalized;
};

const buildIdentityCurve = () => [{ x: 0, y: 0 }, { x: 1, y: 1 }];

const sameSign = (left, right) => (left === 0 || right === 0 ? left === right : Math.sign(left) === Math.sign(right));

const computeSegmentData = (points) => {
  const curve = normalizeCurvePoints(points);
  if (curve.length === 2) {
    const slope = (curve[1].y - curve[0].y) / Math.max(curve[1].x - curve[0].x, MIN_POINT_GAP);
    return {
      curve,
      tangents: [slope, slope],
    };
  }

  const spans = [];
  const slopes = [];
  for (let index = 0; index < curve.length - 1; index += 1) {
    const span = Math.max(curve[index + 1].x - curve[index].x, MIN_POINT_GAP);
    spans.push(span);
    slopes.push((curve[index + 1].y - curve[index].y) / span);
  }

  const tangents = new Array(curve.length).fill(0);
  tangents[0] = ((2 * spans[0] + spans[1]) * slopes[0] - spans[0] * slopes[1]) / (spans[0] + spans[1]);
  if (!sameSign(tangents[0], slopes[0])) {
    tangents[0] = 0;
  } else if (!sameSign(slopes[0], slopes[1]) && Math.abs(tangents[0]) > Math.abs(3 * slopes[0])) {
    tangents[0] = 3 * slopes[0];
  }

  for (let index = 1; index < curve.length - 1; index += 1) {
    const previousSlope = slopes[index - 1];
    const nextSlope = slopes[index];
    if (previousSlope === 0 || nextSlope === 0 || !sameSign(previousSlope, nextSlope)) {
      tangents[index] = 0;
      continue;
    }
    const previousSpan = spans[index - 1];
    const nextSpan = spans[index];
    const weightA = (2 * nextSpan) + previousSpan;
    const weightB = nextSpan + (2 * previousSpan);
    tangents[index] = (weightA + weightB) / ((weightA / previousSlope) + (weightB / nextSlope));
  }

  const lastSlope = slopes.at(-1);
  const previousSlope = slopes.at(-2);
  const lastSpan = spans.at(-1);
  const previousSpan = spans.at(-2);
  tangents[curve.length - 1] = ((2 * lastSpan + previousSpan) * lastSlope - lastSpan * previousSlope) / (lastSpan + previousSpan);
  if (!sameSign(tangents[curve.length - 1], lastSlope)) {
    tangents[curve.length - 1] = 0;
  } else if (!sameSign(lastSlope, previousSlope) && Math.abs(tangents[curve.length - 1]) > Math.abs(3 * lastSlope)) {
    tangents[curve.length - 1] = 3 * lastSlope;
  }

  return { curve, tangents };
};

const cloneCurveMap = (curves = {}) => Object.fromEntries(
  TONE_CURVE_CHANNELS.map((channel) => [channel, normalizeCurvePoints(curves[channel])]),
);

const cloneSelectionMap = (selectedPointIndices = {}, curves) => Object.fromEntries(
  TONE_CURVE_CHANNELS.map((channel) => {
    const index = Number(selectedPointIndices[channel]);
    const maxIndex = Math.max((curves[channel]?.length || 2) - 1, 1);
    return [channel, Number.isInteger(index) ? Math.min(Math.max(index, 0), maxIndex) : maxIndex];
  }),
);

export function buildToneCurveState() {
  const curves = Object.fromEntries(TONE_CURVE_CHANNELS.map((channel) => [channel, buildIdentityCurve()]));
  return {
    activeChannel: DEFAULT_CHANNEL,
    curves,
    selectedPointIndices: Object.fromEntries(TONE_CURVE_CHANNELS.map((channel) => [channel, 1])),
  };
}

export function normalizeToneCurveState(state) {
  const curves = cloneCurveMap(state?.curves);
  return {
    activeChannel: sanitizeChannel(state?.activeChannel),
    curves,
    selectedPointIndices: cloneSelectionMap(state?.selectedPointIndices, curves),
  };
}

export function setToneCurveActiveChannel(state, channel) {
  const normalized = normalizeToneCurveState(state);
  return {
    ...normalized,
    activeChannel: sanitizeChannel(channel),
  };
}

export function setToneCurveSelectedPoint(state, channel, index) {
  const normalized = normalizeToneCurveState(state);
  const safeChannel = sanitizeChannel(channel);
  const maxIndex = normalized.curves[safeChannel].length - 1;
  return {
    ...normalized,
    selectedPointIndices: {
      ...normalized.selectedPointIndices,
      [safeChannel]: Math.min(Math.max(Number(index) || 0, 0), maxIndex),
    },
  };
}

export function getSelectedToneCurvePoint(state, channel = null) {
  const normalized = normalizeToneCurveState(state);
  const safeChannel = sanitizeChannel(channel ?? normalized.activeChannel);
  const index = normalized.selectedPointIndices[safeChannel];
  return normalized.curves[safeChannel][index] ?? normalized.curves[safeChannel].at(-1);
}

export function sampleToneCurveChannel(points, value) {
  const { curve, tangents } = computeSegmentData(points);
  const x = clamp01(value);
  for (let index = 0; index < curve.length - 1; index += 1) {
    const start = curve[index];
    const end = curve[index + 1];
    if (x > end.x && index < curve.length - 2) {
      continue;
    }
    const span = Math.max(end.x - start.x, MIN_POINT_GAP);
    const t = Math.min(Math.max((x - start.x) / span, 0), 1);
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = (2 * t3) - (3 * t2) + 1;
    const h10 = t3 - (2 * t2) + t;
    const h01 = (-2 * t3) + (3 * t2);
    const h11 = t3 - t2;
    const y = (h00 * start.y)
      + (h10 * span * tangents[index])
      + (h01 * end.y)
      + (h11 * span * tangents[index + 1]);
    return clamp01(y);
  }
  return clamp01(curve.at(-1)?.y ?? 1);
}

export function buildToneCurveSvgPathData(points) {
  const { curve, tangents } = computeSegmentData(points);
  const toSvgX = (value) => (value * 100).toFixed(3);
  const toSvgY = (value) => (100 - (value * 100)).toFixed(3);
  const commands = [`M ${toSvgX(curve[0].x)} ${toSvgY(curve[0].y)}`];
  for (let index = 0; index < curve.length - 1; index += 1) {
    const start = curve[index];
    const end = curve[index + 1];
    const span = Math.max(end.x - start.x, MIN_POINT_GAP);
    const controlA = {
      x: start.x + (span / 3),
      y: clamp01(start.y + ((span * tangents[index]) / 3)),
    };
    const controlB = {
      x: end.x - (span / 3),
      y: clamp01(end.y - ((span * tangents[index + 1]) / 3)),
    };
    commands.push(
      `C ${toSvgX(controlA.x)} ${toSvgY(controlA.y)} ${toSvgX(controlB.x)} ${toSvgY(controlB.y)} ${toSvgX(end.x)} ${toSvgY(end.y)}`,
    );
  }
  return commands.join(' ');
}

export function insertToneCurvePoint(state, channel = null, point = {}) {
  const normalized = normalizeToneCurveState(state);
  const safeChannel = sanitizeChannel(channel ?? normalized.activeChannel);
  const currentCurve = normalized.curves[safeChannel];
  const x = clamp01(point.x ?? 0.5);
  const nextPoint = {
    x,
    y: clamp01(point.y ?? sampleToneCurveChannel(currentCurve, x)),
  };
  const curves = {
    ...normalized.curves,
    [safeChannel]: normalizeCurvePoints(sortPoints([...currentCurve, nextPoint])),
  };
  const insertedIndex = curves[safeChannel].findIndex((candidate) =>
    Math.abs(candidate.x - nextPoint.x) < 1e-6 && Math.abs(candidate.y - nextPoint.y) < 1e-6,
  );
  return {
    ...normalized,
    activeChannel: safeChannel,
    curves,
    selectedPointIndices: {
      ...normalized.selectedPointIndices,
      [safeChannel]: insertedIndex >= 0 ? insertedIndex : curves[safeChannel].length - 2,
    },
  };
}

export function updateToneCurvePoint(state, channel = null, index = 0, updates = {}) {
  const normalized = normalizeToneCurveState(state);
  const safeChannel = sanitizeChannel(channel ?? normalized.activeChannel);
  const curve = normalized.curves[safeChannel].map(clonePoint);
  if (index < 0 || index >= curve.length) {
    return normalized;
  }
  curve[index] = {
    x: clamp01(updates.x ?? curve[index].x),
    y: clamp01(updates.y ?? curve[index].y),
  };
  return {
    ...normalized,
    curves: {
      ...normalized.curves,
      [safeChannel]: normalizeCurvePoints(curve),
    },
  };
}

export function removeToneCurvePoint(state, channel = null, index = null) {
  const normalized = normalizeToneCurveState(state);
  const safeChannel = sanitizeChannel(channel ?? normalized.activeChannel);
  const curve = normalized.curves[safeChannel];
  const targetIndex = index == null ? normalized.selectedPointIndices[safeChannel] : Number(index);
  if (targetIndex <= 0 || targetIndex >= curve.length - 1) {
    return normalized;
  }
  const nextCurve = curve.filter((_, pointIndex) => pointIndex !== targetIndex);
  return {
    ...normalized,
    curves: {
      ...normalized.curves,
      [safeChannel]: nextCurve,
    },
    selectedPointIndices: {
      ...normalized.selectedPointIndices,
      [safeChannel]: Math.min(targetIndex, nextCurve.length - 1),
    },
  };
}

export function findNearestRemovableToneCurvePointIndex(points, targetPoint, threshold = 0.05) {
  const curve = normalizeCurvePoints(points);
  if (curve.length <= 2) {
    return null;
  }
  const target = clonePoint(targetPoint);
  let closestIndex = null;
  let closestDistanceSq = Math.max(Number(threshold) || 0, 0) ** 2;
  for (let index = 1; index < curve.length - 1; index += 1) {
    const candidate = curve[index];
    const distanceSq = ((candidate.x - target.x) ** 2) + ((candidate.y - target.y) ** 2);
    if (distanceSq > closestDistanceSq) {
      continue;
    }
    closestIndex = index;
    closestDistanceSq = distanceSq;
  }
  return closestIndex;
}

export function isNeutralToneCurve(state) {
  const normalized = normalizeToneCurveState(state);
  return TONE_CURVE_CHANNELS.every((channel) => {
    const curve = normalized.curves[channel];
    return curve.length === 2
      && Math.abs(curve[0].x) < 1e-6
      && Math.abs(curve[0].y) < 1e-6
      && Math.abs(curve[1].x - 1) < 1e-6
      && Math.abs(curve[1].y - 1) < 1e-6;
  });
}

const evaluateToneCurveLinear = (points, value) => {
  const curve = normalizeCurvePoints(points);
  const x = clamp01(value);
  let result = curve[0]?.y ?? 0;
  for (let index = 0; index < curve.length - 1; index += 1) {
    const start = curve[index];
    const end = curve[index + 1];
    const span = Math.max(end.x - start.x, MIN_POINT_GAP);
    const segment = Math.min(Math.max(x - start.x, 0), span);
    result += segment * ((end.y - start.y) / span);
  }
  return clamp01(result);
};

export function applyToneCurveToLinearRgb(linearRgb, state) {
  const normalized = normalizeToneCurveState(state);
  const [r = 0, g = 0, b = 0] = Array.isArray(linearRgb) ? linearRgb : [0, 0, 0];
  const masterCurve = normalized.curves.master;
  const applyChannel = (value, channel) => evaluateToneCurveLinear(
    normalized.curves[channel],
    evaluateToneCurveLinear(masterCurve, value),
  );
  return [
    applyChannel(r, 'red'),
    applyChannel(g, 'green'),
    applyChannel(b, 'blue'),
  ];
}

export function summarizeToneCurve(state) {
  const normalized = normalizeToneCurveState(state);
  return TONE_CURVE_CHANNELS.map((channel) => `${channel[0].toUpperCase()}:${normalized.curves[channel].length}`).join(' ');
}

export { MIN_POINT_GAP, TONE_CURVE_CHANNELS };
