const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const length2 = (x, z) => Math.hypot(x, z);

export const DEFAULT_GAME_CONFIG = {
  acceleration: 12,
  accelerationResponsiveness: 18,
  damping: 0.96,
  fallAcceleration: 22,
  restitution: 0.68,
  maxSpeed: 5.5,
  obstacleBounce: 0.72,
  settleAcceleration: 0.05,
  settleSpeed: 0.045,
};

export function createDefaultStage(overrides = {}) {
  const stage = {
    dropOnExit: true,
    floorRadius: 4.4,
    rimInnerRadius: 4.1,
    rimOuterRadius: 4.35,
    fallResetY: -2.8,
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
    additionalCollisionObstacles: [],
    ...overrides,
  };
  const splatObstacles = Array.isArray(stage.splatObstacles) ? stage.splatObstacles.map((obstacle) => ({ ...obstacle, kind: 'splat' })) : [];
  const meshObstacles = Array.isArray(stage.meshObstacles) ? stage.meshObstacles.map((obstacle) => ({ ...obstacle, kind: 'mesh' })) : [];
  const additionalCollisionObstacles = Array.isArray(stage.additionalCollisionObstacles)
    ? stage.additionalCollisionObstacles.map((obstacle) => ({ ...obstacle, kind: obstacle.kind || 'scene-item' }))
    : [];
  const legacyObstacles = Array.isArray(stage.obstacles) ? stage.obstacles : [];
  return {
    ...stage,
    splatObstacles,
    meshObstacles,
    additionalCollisionObstacles,
    obstacles: legacyObstacles.length > 0 ? legacyObstacles : [...splatObstacles, ...meshObstacles],
  };
}

export function getStageCollisionObstacles(stage = createDefaultStage()) {
  const additionalCollisionObstacles = Array.isArray(stage.additionalCollisionObstacles)
    ? stage.additionalCollisionObstacles
    : [];
  if (Array.isArray(stage.obstacles) && stage.obstacles.length > 0) {
    return [...stage.obstacles, ...additionalCollisionObstacles];
  }
  return [
    ...(Array.isArray(stage.splatObstacles) ? stage.splatObstacles : []),
    ...(Array.isArray(stage.meshObstacles) ? stage.meshObstacles : []),
    ...additionalCollisionObstacles,
  ];
}

const createBall = (stage) => ({
  acceleration: { x: 0, y: 0, z: 0 },
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
    ball: createBall(stage),
    ...overrides,
  };
}

export function resetGameState(state) {
  return createDefaultGameState(state?.stage || createDefaultStage());
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

const reflectVelocity = (velocity, nx, nz, bounce) => {
  const velocityAlongNormal = (velocity.x * nx) + (velocity.z * nz);
  return {
    ...velocity,
    x: velocity.x - ((1 + bounce) * velocityAlongNormal * nx),
    z: velocity.z - ((1 + bounce) * velocityAlongNormal * nz),
  };
};

const resolveCircleObstacleCollision = (ball, obstacle, bounce) => {
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
  return {
    ...ball,
    position: {
      ...ball.position,
      x: ball.position.x + (nx * overlap),
      z: ball.position.z + (nz * overlap),
    },
    velocity: reflectVelocity(ball.velocity, nx, nz, bounce),
  };
};

const resolveBoxObstacleCollision = (ball, obstacle, bounce) => {
  const rotation = Number(obstacle.rotation) || 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const relX = ball.position.x - obstacle.x;
  const relZ = ball.position.z - obstacle.z;
  const localX = (relX * cos) + (relZ * sin);
  const localZ = (-relX * sin) + (relZ * cos);
  const halfSizeX = Math.max(Number(obstacle.halfSizeX) || 0, 0.001);
  const halfSizeZ = Math.max(Number(obstacle.halfSizeZ) || 0, 0.001);
  const clampedX = clamp(localX, -halfSizeX, halfSizeX);
  const clampedZ = clamp(localZ, -halfSizeZ, halfSizeZ);
  let deltaX = localX - clampedX;
  let deltaZ = localZ - clampedZ;
  let distance = length2(deltaX, deltaZ);

  if (distance < ball.radius) {
    if (distance <= 1e-6) {
      const gapX = halfSizeX - Math.abs(localX);
      const gapZ = halfSizeZ - Math.abs(localZ);
      if (gapX < gapZ) {
        deltaX = localX >= 0 ? 1 : -1;
        deltaZ = 0;
        distance = Math.max(gapX, 0);
      } else {
        deltaX = 0;
        deltaZ = localZ >= 0 ? 1 : -1;
        distance = Math.max(gapZ, 0);
      }
    }

    const nxLocal = deltaX / Math.max(distance, 1e-6);
    const nzLocal = deltaZ / Math.max(distance, 1e-6);
    const pushDistance = ball.radius - distance;
    const worldNx = (nxLocal * cos) - (nzLocal * sin);
    const worldNz = (nxLocal * sin) + (nzLocal * cos);
    return {
      ...ball,
      position: {
        ...ball.position,
        x: ball.position.x + (worldNx * pushDistance),
        z: ball.position.z + (worldNz * pushDistance),
      },
      velocity: reflectVelocity(ball.velocity, worldNx, worldNz, bounce),
    };
  }

  return ball;
};

const resolveObstacleCollision = (ball, obstacle, bounce) => {
  if (obstacle?.shape === 'box') {
    return resolveBoxObstacleCollision(ball, obstacle, bounce);
  }
  return resolveCircleObstacleCollision(ball, obstacle, bounce);
};

export function stepGameState(state, inputVector = { x: 0, z: 0 }, dt = 1 / 60, config = DEFAULT_GAME_CONFIG) {
  const stage = state?.stage || createDefaultStage();
  const safeState = createDefaultGameState(stage, state);
  if (safeState.status === 'won') {
    return safeState;
  }

  const deltaSeconds = Math.max(0, Number(dt) || 0);
  const acceleration = Number(config.acceleration) || DEFAULT_GAME_CONFIG.acceleration;
  const accelerationResponsiveness = Math.max(0, Number(config.accelerationResponsiveness) || DEFAULT_GAME_CONFIG.accelerationResponsiveness);
  const damping = clamp(Number(config.damping) || DEFAULT_GAME_CONFIG.damping, 0, 1);
  const fallAcceleration = Math.max(0, Number(config.fallAcceleration) || DEFAULT_GAME_CONFIG.fallAcceleration);
  const restitution = clamp(Number(config.restitution) || DEFAULT_GAME_CONFIG.restitution, 0, 1);
  const obstacleBounce = clamp(Number(config.obstacleBounce) || DEFAULT_GAME_CONFIG.obstacleBounce, 0, 1);
  const settleSpeed = Math.max(0, Number(config.settleSpeed) || DEFAULT_GAME_CONFIG.settleSpeed);
  const settleAcceleration = Math.max(0, Number(config.settleAcceleration) || DEFAULT_GAME_CONFIG.settleAcceleration);
  const inputX = clamp(Number(inputVector?.x) || 0, -1, 1);
  const inputZ = clamp(Number(inputVector?.z) || 0, -1, 1);

  let ball = {
    ...safeState.ball,
    acceleration: {
      ...(safeState.ball.acceleration || { x: 0, y: 0, z: 0 }),
      y: safeState.status === 'falling' ? (safeState.ball.acceleration?.y || 0) : 0,
    },
    velocity: {
      ...safeState.ball.velocity,
      y: safeState.status === 'falling' ? (safeState.ball.velocity?.y || 0) : 0,
    },
  };
  const maxSpeed = Number(config.maxSpeed) || DEFAULT_GAME_CONFIG.maxSpeed;
  const minSubstep = 1 / 120;
  const substeps = Math.max(1, Math.ceil(deltaSeconds / minSubstep));
  const substepSeconds = deltaSeconds / substeps;

  if (safeState.status === 'falling') {
    for (let stepIndex = 0; stepIndex < substeps; stepIndex += 1) {
      ball.acceleration = { x: 0, y: -fallAcceleration, z: 0 };
      ball.velocity = {
        x: ball.velocity.x * damping,
        y: ball.velocity.y + (ball.acceleration.y * substepSeconds),
        z: ball.velocity.z * damping,
      };
      ball.position = {
        x: ball.position.x + (ball.velocity.x * substepSeconds),
        y: ball.position.y + (ball.velocity.y * substepSeconds),
        z: ball.position.z + (ball.velocity.z * substepSeconds),
      };
    }

    if (ball.position.y <= (Number(stage.fallResetY) || -2.8)) {
      return resetGameState(safeState);
    }

    return {
      ...safeState,
      status: 'falling',
      elapsedMs: safeState.elapsedMs + Math.round(deltaSeconds * 1000),
      goalReached: false,
      ball,
    };
  }

  for (let stepIndex = 0; stepIndex < substeps; stepIndex += 1) {
    const accelerationBlend = clamp(accelerationResponsiveness * substepSeconds, 0, 1);
    const targetAccelerationX = inputX * acceleration;
    const targetAccelerationZ = inputZ * acceleration;
    ball.acceleration = {
      x: ball.acceleration.x + ((targetAccelerationX - ball.acceleration.x) * accelerationBlend),
      y: 0,
      z: ball.acceleration.z + ((targetAccelerationZ - ball.acceleration.z) * accelerationBlend),
    };
    ball.velocity = {
      x: ball.velocity.x + (ball.acceleration.x * substepSeconds),
      y: 0,
      z: ball.velocity.z + (ball.acceleration.z * substepSeconds),
    };
    ball.velocity = clampVelocity(ball.velocity, maxSpeed);
    ball.velocity = {
      ...ball.velocity,
      x: ball.velocity.x * damping,
      z: ball.velocity.z * damping,
    };
    ball.position = {
      ...ball.position,
      x: ball.position.x + (ball.velocity.x * substepSeconds),
      z: ball.position.z + (ball.velocity.z * substepSeconds),
    };

    const minX = stage.bounds.minX + ball.radius;
    const maxX = stage.bounds.maxX - ball.radius;
    const minZ = stage.bounds.minZ + ball.radius;
    const maxZ = stage.bounds.maxZ - ball.radius;

    if (stage.dropOnExit) {
      const dropRadius = Math.max(
        0.001,
        Number(stage.dropRadius)
          || (Number(stage.rimInnerRadius) || Number(stage.floorRadius) || Math.max(
            Math.abs(stage.bounds.maxX),
            Math.abs(stage.bounds.minX),
            Math.abs(stage.bounds.maxZ),
            Math.abs(stage.bounds.minZ),
          )) - ball.radius,
      );
      const distanceFromCenter = length2(ball.position.x, ball.position.z);
      const hasLeftStage = distanceFromCenter > dropRadius;
      if (hasLeftStage) {
        ball.acceleration = { x: 0, y: -fallAcceleration, z: 0 };
        ball.velocity.y = Math.min(ball.velocity.y, -0.35);
        ball.position.y += ball.velocity.y * substepSeconds;
        return {
          ...safeState,
          status: 'falling',
          elapsedMs: safeState.elapsedMs + Math.round(deltaSeconds * 1000),
          goalReached: false,
          ball,
        };
      }
    } else {
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
    }

    const collisionObstacles = getStageCollisionObstacles(stage);
    for (let pass = 0; pass < Math.max(collisionObstacles.length, 1); pass += 1) {
      for (const obstacle of collisionObstacles) {
        ball = resolveObstacleCollision(ball, obstacle, obstacleBounce);
      }
    }
  }

  const goalDistance = length2(ball.position.x - stage.goal.x, ball.position.z - stage.goal.z);
  const goalReached = goalDistance <= (stage.goal.radius + ball.radius);
  const speed = length2(ball.velocity.x, ball.velocity.z);
  const accelerationMagnitude = length2(ball.acceleration.x, ball.acceleration.z);
  const inputMagnitude = length2(inputX, inputZ);
  const settled = !goalReached
    && inputMagnitude < 0.001
    && speed <= settleSpeed
    && accelerationMagnitude <= settleAcceleration;

  if (settled) {
    ball = {
      ...ball,
      acceleration: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    };
  }

  const hasActiveMotion = inputMagnitude >= 0.001 || speed > settleSpeed || accelerationMagnitude > settleAcceleration;
  const nextStatus = goalReached
    ? 'won'
    : settled
      ? 'idle'
      : (safeState.status === 'idle' && hasActiveMotion ? 'playing' : safeState.status);

  return {
    ...safeState,
    status: nextStatus,
    goalReached,
    elapsedMs: safeState.elapsedMs + Math.round(deltaSeconds * 1000),
    ball,
  };
}
