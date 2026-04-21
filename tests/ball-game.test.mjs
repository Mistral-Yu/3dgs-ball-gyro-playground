import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GAME_CONFIG,
  createDefaultGameState,
  createDefaultStage,
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
  assert.equal(state.elapsedMs, 0);
});

test('stepGameState accelerates the ball according to the active input vector', () => {
  const stage = createDefaultStage();
  const state = createDefaultGameState(stage);
  const next = advance(state, { x: 0.8, z: 0.3 }, 30);

  assert.ok(next.ball.position.x > stage.spawn.x, `expected x movement, got ${next.ball.position.x}`);
  assert.ok(next.ball.position.z > stage.spawn.z, `expected z movement, got ${next.ball.position.z}`);
  assert.ok(next.elapsedMs > 400);
});

test('stepGameState clamps the ball inside the stage walls and bounces velocity', () => {
  const stage = createDefaultStage();
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
