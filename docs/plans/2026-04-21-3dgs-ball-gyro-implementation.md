# 3DGS Ball Gyro Implementation Plan

> **For Hermes:** follow TDD for each new module and integration point. Keep scope constrained to the user's requested Phase 6 prototype, but explicitly mark browser/device verification as pending in README until real-device testing is done after push.

**Goal:** Build a mobile-first 3DGS web page where a ball can be controlled by device orientation, with iPhone permission flow, touch fallback, calibration, simple stage/goal/obstacles, and reset/retry UX.

**Architecture:** Reuse the static Spark viewer as the rendering shell. Add focused modules for sensor normalization, touch fallback, simple ball physics/stage logic, and mobile HUD/state. Keep 3DGS as the visual background and game collisions in a separate lightweight world.

**Tech Stack:** Static HTML/CSS/JS, Spark 2.0, Three.js, Node built-in test runner, esbuild.

---

## Task 1: Add testable gameplay modules

**Objective:** Create pure modules that can be tested without a browser runtime.

**Files:**
- Create: `ball-game.mjs`
- Create: `motion-controls.mjs`
- Create: `touch-controls.mjs`
- Create: `game-ui-state.mjs`
- Test: `tests/ball-game.test.mjs`
- Test: `tests/motion-controls.test.mjs`
- Test: `tests/touch-controls.test.mjs`
- Test: `tests/game-ui-state.test.mjs`

**Steps:**
1. Write failing tests for normalization, calibration, dead-zone filtering, touch vector smoothing, and simple stage/goal collision behavior.
2. Run the targeted tests and verify failure.
3. Implement the minimum code to pass.
4. Re-run targeted tests, then full `npm test`.

## Task 2: Add sensor smoke-test page

**Objective:** Provide a standalone verification page for permission flow and raw/filtered motion values.

**Files:**
- Create: `sensor-smoke-test.html`
- Create: `sensor-smoke-test.js`
- Modify: `README.md`
- Test: `tests/motion-controls.test.mjs`

**Steps:**
1. Extend motion-control tests for permission-state helpers and timeout/fallback decisions.
2. Implement the smoke-test page with permission, calibration, and live beta/gamma display.
3. Ensure build/test/check still pass.

## Task 3: Add gameplay HUD and mobile layout hooks

**Objective:** Extend the viewer shell with mobile controls and gameplay status UI.

**Files:**
- Modify: `index.html`
- Modify: `viewer.css`
- Test: `tests/viewer-layout.test.mjs`
- Create: `tests/game-ui-state.test.mjs`

**Steps:**
1. Add failing tests for any new layout helper behavior if needed.
2. Introduce semantic HUD/action markup for start, enable motion, calibrate, touch mode, retry/reset, timer, goal status, and quality hint.
3. Update styles for mobile-safe placement and non-intrusive overlays.
4. Run tests/build.

## Task 4: Integrate ball renderer and gameplay loop into the viewer

**Objective:** Spawn a ball mesh and stage helpers on top of the 3DGS scene with simple physics.

**Files:**
- Modify: `viewer.js`
- Modify: `README.md`
- Test: `tests/ball-game.test.mjs`
- Test: `tests/viewer-render-pipeline.test.mjs` if needed for pure helper coverage

**Steps:**
1. Keep gameplay logic in pure modules; only glue scene wiring into `viewer.js`.
2. Add a plane, walls, obstacles, goal marker, timer/reset flow, and overlay state wiring.
3. Keep camera behavior constrained enough for mobile play.
4. Rebuild and run all tests.

## Task 5: Integrate sensor + touch input routing

**Objective:** Route device orientation and touch fallback into the gameplay gravity vector with calibration and permission UX.

**Files:**
- Modify: `viewer.js`
- Modify: `index.html`
- Modify: `viewer.css`
- Test: `tests/motion-controls.test.mjs`
- Test: `tests/touch-controls.test.mjs`
- Test: `tests/game-ui-state.test.mjs`

**Steps:**
1. Add failing tests for router decisions and fallback state.
2. Implement iPhone `requestPermission()` path, Android-compatible listeners, timeout detection, and touch fallback.
3. Add invert/mode/calibration/reset behavior required for stable play.
4. Run full validation.

## Task 6: Final verification, docs, and publish

**Objective:** Produce a green build and push to a new GitHub repository.

**Files:**
- Modify: `README.md`
- Modify: `package.json` only if needed

**Steps:**
1. Ensure README clearly states that browser/device verification is still pending.
2. Run `npm test`, `npm run build`, and `npm run check` with no errors.
3. Initialize commit history in the new repo, create the GitHub remote, and push `main`.
4. Leave the project ready for post-push real-device testing.
