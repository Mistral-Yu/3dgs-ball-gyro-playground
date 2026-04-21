import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLodChipLabel,
  buildLodInfoLabel,
  buildSplatMeshLoadOptions,
  detectLodAvailability,
} from '../viewer-lod.mjs';

test('buildSplatMeshLoadOptions keeps Auto LoD disabled unless explicitly enabled', () => {
  assert.deepEqual(buildSplatMeshLoadOptions(true), { lod: true });
  assert.deepEqual(buildSplatMeshLoadOptions(false), {});
});

test('detectLodAvailability reports active when packed splats expose lod data', () => {
  assert.equal(detectLodAvailability({ packedSplats: { lodSplats: {} } }), true);
  assert.equal(detectLodAvailability({ extSplats: { lodSplats: {} } }), true);
  assert.equal(detectLodAvailability({ csplatArray: { has_lod: () => true } }), true);
  assert.equal(detectLodAvailability({ packedSplats: { splatEncoding: { lodOpacity: true } } }), true);
  assert.equal(detectLodAvailability({ packedSplats: { splatEncoding: { lodOpacity: false } } }), false);
});

test('buildLodChipLabel distinguishes enabled and disabled load modes', () => {
  assert.equal(buildLodChipLabel({ autoLodEnabled: true, lodActive: true }), 'LOD Auto On / Active');
  assert.equal(buildLodChipLabel({ autoLodEnabled: true, lodActive: false }), 'LOD Auto On');
  assert.equal(buildLodChipLabel({ autoLodEnabled: false, lodActive: false }), 'LOD Auto Off');
  assert.equal(buildLodChipLabel({ autoLodEnabled: false, lodActive: true }), 'LOD Auto Off / Active');
});

test('buildLodInfoLabel describes post-load auto-LoD mode and active data state', () => {
  assert.equal(buildLodInfoLabel({ autoLodEnabled: true, lodActive: true }), 'Auto-LoD enabled / LoD data active');
  assert.equal(buildLodInfoLabel({ autoLodEnabled: true, lodActive: false }), 'Auto-LoD enabled / Full-res only');
  assert.equal(buildLodInfoLabel({ autoLodEnabled: false, lodActive: false }), 'Auto-LoD disabled / Full-res only');
});
