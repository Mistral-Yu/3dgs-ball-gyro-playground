import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  computeLayoutMode,
  computePanelWidths,
  computeShellSize,
  computeUiScale,
} from '../viewer-layout.mjs';

test('computeUiScale keeps the design size at scale 1 on a roomy viewport', () => {
  const scale = computeUiScale({
    viewportHeight: DESIGN_HEIGHT + 300,
    viewportWidth: DESIGN_WIDTH + 300,
  });

  assert.equal(scale, 1);
});

test('computeUiScale responds to viewport size instead of device pixel ratio', () => {
  const scale = computeUiScale({
    viewportHeight: 900,
    viewportWidth: 1440,
    devicePixelRatio: 3,
  });

  assert.equal(scale, computeUiScale({ viewportHeight: 900, viewportWidth: 1440, devicePixelRatio: 1 }));
});

test('computeUiScale scales down to fit smaller viewports', () => {
  const scale = computeUiScale({
    viewportHeight: 700,
    viewportWidth: 1100,
  });

  assert.ok(scale < 1);
  assert.ok(scale > 0.5);
});

test('computeUiScale clamps invalid measurements to full scale', () => {
  assert.equal(computeUiScale({ viewportHeight: 0, viewportWidth: 0 }), 1);
});

test('computeLayoutMode keeps a 1200px viewport in wide mode so the inspector does not wrap below', () => {
  assert.equal(computeLayoutMode({ viewportWidth: 1200 }), 'wide');
});

test('computeLayoutMode stacks only on clearly phone-sized widths', () => {
  assert.equal(computeLayoutMode({ viewportWidth: 900 }), 'compact');
  assert.equal(computeLayoutMode({ viewportWidth: 720 }), 'stacked');
});

test('computeShellSize fills the viewport minus outer padding on large screens', () => {
  assert.deepEqual(
    computeShellSize({ viewportWidth: 3840, viewportHeight: 2160 }),
    { width: 3808, height: 2128 },
  );
});

test('computePanelWidths expands side panels modestly on large screens without leaving outer margins', () => {
  assert.deepEqual(
    computePanelWidths({ layoutMode: 'wide', viewportWidth: 3840 }),
    { left: 300, right: 420 },
  );
});
