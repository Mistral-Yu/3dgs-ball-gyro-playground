const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const length2 = (x, z) => Math.hypot(x, z);

export const DEFAULT_GAME_CONFIG = {
  acceleration: 6.5,
  damping: 0.92,
  restitution: 0.68,
  maxSpeed: 5.5,
  obstacleBounce: 0.72,
};

export function createDefaultStage(overrides = {}) {
  const stage = {
    spawn: { x: -2.4, y: 0.35, z: -2.1 },
    bounds: {
      minX: -3.2,
      maxX: 3.2,
      minZ: -3.2,
      maxZ: 3.2,
    },
    goal: { x: 2.35, z: 2.45, radius: 0.42 },
    splatObstacles: [
      { x: -0.6, z: -0.2, radius: 0.45, kind: 'splat' },
      { x: 1.35, z: -1.15, radius: 0.4, kind: 'splat' },
    ],
    meshObstacles: [
      { x: 0.9, z: 1.15, radius: 0.38, kind: 'mesh' },
    ],
    ...overrides,
  };
  const splatObstacles = Array.isArray(stage.splatObstacles) ? stage.splatObstacles.map((obstacle) => ({ ...obstacle, kind: 'splat' })) : [];
  const meshObstacles = Array.isArray(stage.meshObstacles) ? stage.meshObstacles.map((obstacle) => ({ ...obstacle, kind: 'mesh' })) : [];
  const legacyObstacles = Array.isArray(stage.obstacles) ? stage.obstacles : [];
  return {
    ...stage,
    splatObstacles,
    meshObstacles,
    obstacles: legacyObstacles.length > 0 ? legacyObstacles : [...splatObstacles, ...meshObstacles],
  };
}

export function getStageCollisionObstacles(stage = createDefaultStage()) {
  if (Array.isArray(stage.obstacles) && stage.obstacles.length > 0) {
    return stage.obstacles;
  }
  return [
    ...(Array.isArray(stage.splatObstacles) ? stage.splatObstacles : []),
    ...(Array.isArray(stage.meshObstacles) ? stage.meshObstacles : []),
  ];
}

const createBall = (stage) => ({
  position: { ...stage.spawn },
  velocity: { x: 0, y: 0, z: 0 },
  radius: 0.22,
});

export function createDefaultGameState(stage = createDefaultStage(), overrides = {}) {
  return {
    stage,
    status: 'idle',
    goalReached: false,
    elapsedMs: 0,
    touchMode: false,
    ball: createBall(stage),
    ...overrides,
  };
}

export function resetGameState(state) {
  return createDefaultGameState(state?.stage || createDefaultStage(), {
    touchMode: Boolean(state?.touchMode),
  });
}

const clampVelocity = (velocity, maxSpeed) => {
  const speed = length2(velocity.x, velocity.z);
  if (speed <= maxSpeed || speed <= 1e-6) {
    return velocity;
  }
  const scale = maxSpeed / speed;
  return {
    x: velocity.x * scale,
    y: velocity.y,
    z: velocity.z * scale,
  };
};

const resolveObstacleCollision = (ball, obstacle, bounce) => {
  const dx = ball.position.x - obstacle.x;
  const dz = ball.position.z - obstacle.z;
  const distance = length2(dx, dz) || 1e-6;
  const minimumDistance = obstacle.radius + ball.radius;
  if (distance >= minimumDistance) {
    return ball;
  }
  const nx = dx / distance;
  const nz = dz / distance;
  const overlap = minimumDistance - distance;
  const velocityAlongNormal = (ball.velocity.x * nx) + (ball.velocity.z * nz);
  const reflectedX = ball.velocity.x - ((1 + bounce) * velocityAlongNormal * nx);
  const reflectedZ = ball.velocity.z - ((1 + bounce) * velocityAlongNormal * nz);
  return {
    ...ball,
    position: {
      ...ball.position,
      x: ball.position.x + (nx * overlap),
      z: ball.position.z + (nz * overlap),
    },
    velocity: {
      ...ball.velocity,
      x: reflectedX,
      z: reflectedZ,
    },
  };
};

export function stepGameState(state, inputVector = { x: 0, z: 0 }, dt = 1 / 60, config = DEFAULT_GAME_CONFIG) {
  const stage = state?.stage || createDefaultStage();
  const safeState = createDefaultGameState(stage, state);
  if (safeState.status === 'won') {
    return safeState;
  }

  const deltaSeconds = Math.max(0, Number(dt) || 0);
  const acceleration = Number(config.acceleration) || DEFAULT_GAME_CONFIG.acceleration;
  const damping = clamp(Number(config.damping) || DEFAULT_GAME_CONFIG.damping, 0, 1);
  const restitution = clamp(Number(config.restitution) || DEFAULT_GAME_CONFIG.restitution, 0, 1);
  const obstacleBounce = clamp(Number(config.obstacleBounce) || DEFAULT_GAME_CONFIG.obstacleBounce, 0, 1);
  const nextStatus = safeState.status === 'idle' ? 'playing' : safeState.status;
  const inputX = clamp(Number(inputVector?.x) || 0, -1, 1);
  const inputZ = clamp(Number(inputVector?.z) || 0, -1, 1);

  let ball = {
    ...safeState.ball,
    velocity: {
      x: safeState.ball.velocity.x + (inputX * acceleration * deltaSeconds),
      y: 0,
      z: safeState.ball.velocity.z + (inputZ * acceleration * deltaSeconds),
    },
  };
  ball.velocity = clampVelocity(ball.velocity, Number(config.maxSpeed) || DEFAULT_GAME_CONFIG.maxSpeed);
  ball.velocity = {
    ...ball.velocity,
    x: ball.velocity.x * damping,
    z: ball.velocity.z * damping,
  };
  ball.position = {
    ...ball.position,
    x: ball.position.x + (ball.velocity.x * deltaSeconds),
    z: ball.position.z + (ball.velocity.z * deltaSeconds),
  };

  const minX = stage.bounds.minX + ball.radius;
  const maxX = stage.bounds.maxX - ball.radius;
  const minZ = stage.bounds.minZ + ball.radius;
  const maxZ = stage.bounds.maxZ - ball.radius;

  if (ball.position.x < minX) {
    ball.position.x = minX;
    ball.velocity.x = Math.abs(ball.velocity.x) * restitution;
  }
  if (ball.position.x > maxX) {
    ball.position.x = maxX;
    ball.velocity.x = -Math.abs(ball.velocity.x) * restitution;
  }
  if (ball.position.z < minZ) {
    ball.position.z = minZ;
    ball.velocity.z = Math.abs(ball.velocity.z) * restitution;
  }
  if (ball.position.z > maxZ) {
    ball.position.z = maxZ;
    ball.velocity.z = -Math.abs(ball.velocity.z) * restitution;
  }

  const collisionObstacles = getStageCollisionObstacles(stage);
  for (let pass = 0; pass < Math.max(collisionObstacles.length, 1); pass += 1) {
    for (const obstacle of collisionObstacles) {
      ball = resolveObstacleCollision(ball, obstacle, obstacleBounce);
    }
  }

  const goalDistance = length2(ball.position.x - stage.goal.x, ball.position.z - stage.goal.z);
  const goalReached = goalDistance <= (stage.goal.radius + ball.radius);

  return {
    ...safeState,
    status: goalReached ? 'won' : nextStatus,
    goalReached,
    elapsedMs: safeState.elapsedMs + Math.round(deltaSeconds * 1000),
    ball,
  };
}
