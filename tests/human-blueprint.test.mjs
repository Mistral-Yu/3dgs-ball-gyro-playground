import test from 'node:test';
import assert from 'node:assert/strict';

import { HUMAN_HEIGHT_METERS, createHumanBlueprint } from '../primitives/human-blueprint.mjs';

test('createHumanBlueprint builds a 1.8m tall primitive by default', () => {
  const blueprint = createHumanBlueprint();

  assert.equal(blueprint.heightMeters, HUMAN_HEIGHT_METERS);
  assert.equal(blueprint.label, 'Human 1.8m');
  assert.ok(blueprint.bounds.min.x <= -0.3);
  assert.ok(blueprint.bounds.max.x >= 0.3);
  assert.ok(blueprint.bounds.min.y <= -0.95);
  assert.ok(blueprint.bounds.max.y >= 0.8);
});

test('createHumanBlueprint contains the expected body groups', () => {
  const blueprint = createHumanBlueprint();
  const kinds = new Set(blueprint.parts.map((part) => part.kind));
  const labels = blueprint.parts.map((part) => part.label);

  assert.deepEqual(kinds, new Set(['ellipsoid', 'tube']));
  assert.ok(labels.includes('Head'));
  assert.ok(labels.includes('Torso'));
  assert.ok(labels.includes('Left Arm'));
  assert.ok(labels.includes('Right Arm'));
  assert.ok(labels.includes('Left Leg'));
  assert.ok(labels.includes('Right Leg'));
});

test('createHumanBlueprint scales proportionally for a custom height', () => {
  const blueprint = createHumanBlueprint({ heightMeters: 2.0 });

  assert.equal(blueprint.heightMeters, 2.0);
  assert.ok(blueprint.bounds.min.x <= -0.33);
  assert.ok(blueprint.bounds.max.x >= 0.33);
  assert.ok(blueprint.bounds.min.y <= -1.05);
  assert.ok(blueprint.bounds.max.y >= 0.88);
  const head = blueprint.parts.find((part) => part.label === 'Head');
  assert.ok(head.radii.every((value) => value > 0.09));
});
