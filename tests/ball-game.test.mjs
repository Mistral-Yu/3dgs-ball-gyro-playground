import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GAME_CONFIG,
  createDefaultGameState,
  createDefaultStage,
  getStageCollisionObstacles,
  resetGameState,
  stepGameState,
} from '../ball-game.mjs';

const advance = (state, input, steps, dt = 1 / 60) => {
  let next = state;
  for (let index = 0; index < steps; index += 1) {
    next = stepGameState(next, input, dt, DEFAULT_GAME_CONFIG);
  }
  return next;
};

test('default game state starts idle at the stage spawn point', () => {
  const stage = createDefaultStage();
  const state = createDefaultGameState(stage);

  assert.equal(state.status, 'idle');
  assert.deepEqual(state.ball.position, stage.spawn);
  assert.deepEqual(state.ball.velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(state.ball.acceleration, { x: 0, y: 0, z: 0 });
  assert.equal(state.elapsedMs, 0);
});

test('stepGameState integrates persistent acceleration from the active input vector', () => {
  const stage = createDefaultStage();
  const state = createDefaultGameState(stage);
  const next = advance(state, { x: 0.8, z: 0.3 }, 30);

  assert.ok(next.ball.position.x > stage.spawn.x, `expected x movement, got ${next.ball.position.x}`);
  assert.ok(next.ball.position.z > stage.spawn.z, `expected z movement, got ${next.ball.position.z}`);
  assert.ok(next.ball.acceleration.x > 0, `expected positive x acceleration, got ${next.ball.acceleration.x}`);
  assert.ok(next.ball.acceleration.z > 0, `expected positive z acceleration, got ${next.ball.acceleration.z}`);
  assert.ok(next.elapsedMs > 400);
});

test('stepGameState feels like gravity by building strong downhill speed from sustained tilt', () => {
  const stage = createDefaultStage();
  const state = createDefaultGameState(stage);
  const next = advance(state, { x: 1, z: 0 }, 12);
  const speed = Math.hypot(next.ball.velocity.x, next.ball.velocity.z);

  assert.ok(speed >= 0.7, `expected stronger downhill speed, got ${speed}`);
  assert.ok(next.ball.position.x >= stage.spawn.x + 0.06, `expected stronger downhill travel, got ${next.ball.position.x}`);
});

test('stepGameState returns to idle once the ball has fully settled so the next run can start without reset', () => {
  const stage = createDefaultStage();
  const state = {
    ...createDefaultGameState(stage),
    status: 'playing',
    ball: {
      ...createDefaultGameState(stage).ball,
      acceleration: { x: 0.02, y: 0, z: -0.01 },
      velocity: { x: 0.01, y: 0, z: -0.01 },
    },
  };

  const next = stepGameState(state, { x: 0, z: 0 }, 1 / 60, DEFAULT_GAME_CONFIG);

  assert.equal(next.status, 'idle');
  assert.equal(next.ball.velocity.x, 0);
  assert.equal(next.ball.velocity.z, 0);
  assert.equal(next.ball.acceleration.x, 0);
  assert.equal(next.ball.acceleration.z, 0);
});

test('stepGameState clamps the ball inside the stage walls and bounces velocity', () => {
  const stage = createDefaultStage({ dropOnExit: false });
  const state = {
    ...createDefaultGameState(stage),
    status: 'playing',
    ball: {
      ...createDefaultGameState(stage).ball,
      position: { x: stage.bounds.maxX - 0.05, y: 0.35, z: 0 },
      velocity: { x: 3, y: 0, z: 0 },
    },
  };
  const next = stepGameState(state, { x: 1, z: 0 }, 1 / 30, DEFAULT_GAME_CONFIG);

  assert.ok(next.ball.position.x <= stage.bounds.maxX - next.ball.radius + 1e-6);
  assert.ok(next.ball.velocity.x < 0, `expected reflected x velocity, got ${next.ball.velocity.x}`);
});

test('stepGameState lets the ball reach the visible rim before falling on the circular platform', () => {
  const stage = createDefaultStage();
  const initial = createDefaultGameState(stage);
  const nearRimState = {
    ...initial,
    status: 'playing',
    ball: {
      ...initial.ball,
      position: { x: stage.rimInnerRadius - initial.ball.radius - 0.04, y: stage.spawn.y, z: 0 },
      velocity: { x: 0.12, y: 0, z: 0 },
    },
  };

  const next = stepGameState(nearRimState, { x: 0, z: 0 }, 1 / 60, DEFAULT_GAME_CONFIG);

  assert.notEqual(next.status, 'falling');
  assert.ok(
    Math.hypot(next.ball.position.x, next.ball.position.z) <= stage.rimInnerRadius + 1e-6,
    `expected the ball to stay on the visible platform, got radius ${Math.hypot(next.ball.position.x, next.ball.position.z)}`,
  );
});

test('stepGameState lets the ball fall off the stage and restarts from spawn after it drops below the reset height', () => {
  const stage = createDefaultStage({
    fallResetY: -1.4,
    spawn: { x: -2.4, y: 0.35, z: -2.1 },
  });
  const initial = createDefaultGameState(stage);
  const leavingState = {
    ...initial,
    status: 'playing',
    elapsedMs: 880,
    ball: {
      ...initial.ball,
      position: { x: stage.rimInnerRadius + 0.18, y: stage.spawn.y, z: 0 },
      velocity: { x: 0.9, y: 0, z: 0.1 },
    },
  };

  const falling = stepGameState(leavingState, { x: 0.4, z: 0 }, 1 / 60, DEFAULT_GAME_CONFIG);
  assert.equal(falling.status, 'falling');
  assert.ok(falling.ball.position.y < stage.spawn.y, `expected falling y, got ${falling.ball.position.y}`);
  assert.ok(falling.elapsedMs > leavingState.elapsedMs, `expected timer to advance while falling, got ${falling.elapsedMs}`);

  let restarted = falling;
  for (let index = 0; index < 60; index += 1) {
    restarted = stepGameState(restarted, { x: 0, z: 0 }, 1 / 60, DEFAULT_GAME_CONFIG);
    if (restarted.status === 'idle' && restarted.elapsedMs === 0) {
      break;
    }
  }
  assert.equal(restarted.status, 'idle');
  assert.equal(restarted.goalReached, false);
  assert.equal(restarted.elapsedMs, 0);
  assert.deepEqual(restarted.ball.position, stage.spawn);
  assert.deepEqual(restarted.ball.velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(restarted.ball.acceleration, { x: 0, y: 0, z: 0 });
});

test('stepGameState resolves circular obstacle collisions without tunneling through the obstacle', () => {
  const stage = createDefaultStage({
    obstacles: [{ x: 0, z: 0, radius: 0.45 }],
    goal: { x: 2.6, z: 2.6, radius: 0.35 },
  });
  const state = {
    ...createDefaultGameState(stage),
    status: 'playing',
    ball: {
      ...createDefaultGameState(stage).ball,
      position: { x: -0.6, y: 0.35, z: 0 },
      velocity: { x: 3.5, y: 0, z: 0 },
    },
  };
  const next = stepGameState(state, { x: 0, z: 0 }, 1 / 10, DEFAULT_GAME_CONFIG);
  const distanceToObstacle = Math.hypot(next.ball.position.x - stage.obstacles[0].x, next.ball.position.z - stage.obstacles[0].z);

  assert.ok(distanceToObstacle >= stage.obstacles[0].radius + next.ball.radius - 1e-6, `ball overlapped obstacle: ${distanceToObstacle}`);
});

test('default stage exposes both splat and mesh gameplay obstacles', () => {
  const stage = createDefaultStage();

  assert.ok(Array.isArray(stage.splatObstacles));
  assert.ok(Array.isArray(stage.meshObstacles));
  assert.ok(Array.isArray(stage.additionalCollisionObstacles));
  assert.ok(stage.splatObstacles.length > 0);
  assert.ok(stage.meshObstacles.length > 0);
  assert.equal(
    getStageCollisionObstacles(stage).length,
    stage.splatObstacles.length + stage.meshObstacles.length + stage.additionalCollisionObstacles.length,
  );
});

test('getStageCollisionObstacles includes additional scene-driven colliders', () => {
  const stage = createDefaultStage({
    splatObstacles: [{ x: 0, z: 0, radius: 0.45 }],
    meshObstacles: [{ x: 1.4, z: 0, radius: 0.4 }],
    additionalCollisionObstacles: [{ x: -1.1, z: 1.2, halfSizeX: 0.55, halfSizeZ: 0.35, rotation: Math.PI / 8, shape: 'box', kind: 'scene-item' }],
  });

  assert.deepEqual(getStageCollisionObstacles(stage), [
    { x: 0, z: 0, radius: 0.45, kind: 'splat' },
    { x: 1.4, z: 0, radius: 0.4, kind: 'mesh' },
    { x: -1.1, z: 1.2, halfSizeX: 0.55, halfSizeZ: 0.35, rotation: Math.PI / 8, shape: 'box', kind: 'scene-item' },
  ]);
});

test('stepGameState resolves collisions against box colliders without letting the ball enter the box footprint', () => {
  const stage = createDefaultStage({
    splatObstacles: [],
    meshObstacles: [],
    additionalCollisionObstacles: [
      { x: 0, z: 0, halfSizeX: 0.5, halfSizeZ: 0.35, rotation: 0, shape: 'box', kind: 'scene-item' },
    ],
    goal: { x: 2.6, z: 2.6, radius: 0.35 },
  });
  const initial = createDefaultGameState(stage);
  const state = {
    ...initial,
    status: 'playing',
    ball: {
      ...initial.ball,
      position: { x: -0.9, y: 0.35, z: 0 },
      velocity: { x: 5.2, y: 0, z: 0 },
    },
  };
  const next = stepGameState(state, { x: 0, z: 0 }, 1 / 4, DEFAULT_GAME_CONFIG);

  assert.ok(next.ball.position.x <= -0.5 - next.ball.radius + 1e-6, `ball entered box footprint: ${next.ball.position.x}`);
  assert.ok(next.ball.velocity.x <= 0, `expected reflected x velocity, got ${next.ball.velocity.x}`);
});

test('stepGameState resolves collisions against both splat and mesh obstacles', () => {
  const stage = createDefaultStage({
    splatObstacles: [{ x: 0, z: 0, radius: 0.45 }],
    meshObstacles: [{ x: 1.4, z: 0, radius: 0.4 }],
    goal: { x: 2.6, z: 2.6, radius: 0.35 },
  });
  const initial = createDefaultGameState(stage);
  const state = {
    ...initial,
    status: 'playing',
    ball: {
      ...initial.ball,
      position: { x: -0.6, y: 0.35, z: 0 },
      velocity: { x: 4.8, y: 0, z: 0 },
    },
  };
  const next = stepGameState(state, { x: 0, z: 0 }, 1 / 4, DEFAULT_GAME_CONFIG);
  const collisionObstacles = getStageCollisionObstacles(stage);

  for (const obstacle of collisionObstacles) {
    const distance = Math.hypot(next.ball.position.x - obstacle.x, next.ball.position.z - obstacle.z);
    assert.ok(distance >= obstacle.radius + next.ball.radius - 1e-6, `ball overlapped obstacle at ${obstacle.x},${obstacle.z}: ${distance}`);
  }
});

test('stepGameState marks the run complete when the ball reaches the goal', () => {
  const stage = createDefaultStage({
    goal: { x: -2.1, z: -1.95, radius: 0.36 },
  });
  let state = createDefaultGameState(stage);
  state = advance(state, { x: 0.9, z: 0.8 }, 20);

  assert.equal(state.status, 'won');
  assert.equal(state.goalReached, true);
  assert.ok(state.elapsedMs > 0);
});

test('resetGameState restores the spawn pose and clears timer/goal status', () => {
  const stage = createDefaultStage();
  const progressed = advance(createDefaultGameState(stage), { x: 1, z: 0.4 }, 20);
  const reset = resetGameState(progressed);

  assert.equal(reset.status, 'idle');
  assert.equal(reset.goalReached, false);
  assert.equal(reset.elapsedMs, 0);
  assert.deepEqual(reset.ball.position, stage.spawn);
  assert.deepEqual(reset.ball.velocity, { x: 0, y: 0, z: 0 });
});
