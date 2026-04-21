export const HUMAN_HEIGHT_METERS = 1.8;

const round = (value) => Number(value.toFixed(6));
const scaleVec = (values, scale) => values.map((value) => round(value * scale));
const scalePath = (points, scale) => points.map((point) => scaleVec(point, scale));
const lerp = (start, end, t) => start + ((end - start) * t);

function computeBounds(parts) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  const expand = (x, y, z, padding = 0) => {
    min.x = Math.min(min.x, x - padding);
    min.y = Math.min(min.y, y - padding);
    min.z = Math.min(min.z, z - padding);
    max.x = Math.max(max.x, x + padding);
    max.y = Math.max(max.y, y + padding);
    max.z = Math.max(max.z, z + padding);
  };

  parts.forEach((part) => {
    if (part.kind === 'ellipsoid') {
      const [cx, cy, cz] = part.center;
      const [rx, ry, rz] = part.radii;
      expand(cx, cy, cz, 0);
      min.x = Math.min(min.x, cx - rx);
      min.y = Math.min(min.y, cy - ry);
      min.z = Math.min(min.z, cz - rz);
      max.x = Math.max(max.x, cx + rx);
      max.y = Math.max(max.y, cy + ry);
      max.z = Math.max(max.z, cz + rz);
      return;
    }

    if (part.kind === 'tube') {
      const samples = Math.max(part.path.length * 12, 24);
      for (let index = 0; index <= samples; index += 1) {
        const t = index / samples;
        const segmentPosition = t * (part.path.length - 1);
        const segmentIndex = Math.min(Math.floor(segmentPosition), part.path.length - 2);
        const localT = segmentPosition - segmentIndex;
        const start = part.path[segmentIndex];
        const end = part.path[segmentIndex + 1];
        const x = lerp(start[0], end[0], localT);
        const y = lerp(start[1], end[1], localT);
        const z = lerp(start[2], end[2], localT);
        expand(x, y, z, part.radius);
      }
    }
  });

  return {
    min: {
      x: round(min.x),
      y: round(min.y),
      z: round(min.z),
    },
    max: {
      x: round(max.x),
      y: round(max.y),
      z: round(max.z),
    },
  };
}

export function createHumanBlueprint({ heightMeters = HUMAN_HEIGHT_METERS } = {}) {
  const scale = heightMeters / HUMAN_HEIGHT_METERS;
  const parts = [
      {
        alpha: 0.94,
        center: scaleVec([0, 0.67, 0], scale),
        color: [0.86, 0.74, 0.63],
        count: 120,
        kind: 'ellipsoid',
        label: 'Head',
        radii: scaleVec([0.11, 0.13, 0.1], scale),
        scaleMajor: round(0.038 * scale),
        scaleMinor: round(0.015 * scale),
      },
      {
        alpha: 0.92,
        center: scaleVec([0, 0.24, 0], scale),
        color: [0.22, 0.36, 0.88],
        count: 260,
        kind: 'ellipsoid',
        label: 'Torso',
        radii: scaleVec([0.21, 0.38, 0.14], scale),
        scaleMajor: round(0.06 * scale),
        scaleMinor: round(0.02 * scale),
      },
      {
        alpha: 0.9,
        color: [0.24, 0.31, 0.84],
        kind: 'tube',
        label: 'Left Arm',
        path: scalePath([[0.16, 0.42, 0], [0.26, 0.16, 0], [0.2, -0.22, 0]], scale),
        radialSteps: 10,
        radius: round(0.045 * scale),
        segments: 36,
      },
      {
        alpha: 0.9,
        color: [0.24, 0.31, 0.84],
        kind: 'tube',
        label: 'Right Arm',
        path: scalePath([[-0.16, 0.42, 0], [-0.26, 0.16, 0], [-0.2, -0.22, 0]], scale),
        radialSteps: 10,
        radius: round(0.045 * scale),
        segments: 36,
      },
      {
        alpha: 0.91,
        color: [0.08, 0.1, 0.16],
        kind: 'tube',
        label: 'Left Leg',
        path: scalePath([[0.08, -0.08, 0], [0.09, -0.52, 0.01], [0.1, -0.9, 0.03]], scale),
        radialSteps: 12,
        radius: round(0.052 * scale),
        segments: 42,
      },
      {
        alpha: 0.91,
        color: [0.08, 0.1, 0.16],
        kind: 'tube',
        label: 'Right Leg',
        path: scalePath([[-0.08, -0.08, 0], [-0.09, -0.52, 0.01], [-0.1, -0.9, 0.03]], scale),
        radialSteps: 12,
        radius: round(0.052 * scale),
        segments: 42,
      },
    ];

  return {
    bounds: computeBounds(parts),
    heightMeters: round(heightMeters),
    label: `Human ${round(heightMeters)}m`,
    parts,
  };
}
