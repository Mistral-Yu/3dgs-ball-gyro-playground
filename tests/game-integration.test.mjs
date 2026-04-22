import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const viewerSource = await readFile(new URL('../viewer.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('viewer imports gameplay modules and advances gameplay each frame', () => {
  assert.match(viewerSource, /from "\.\/ball-game\.mjs"/);
  assert.match(viewerSource, /from "\.\/motion-controls\.mjs"/);
  assert.match(viewerSource, /from "\.\/game-ui-state\.mjs"/);
  assert.doesNotMatch(viewerSource, /from "\.\/touch-controls\.mjs"/);
  assert.match(viewerSource, /const gameplayActive = this\.updateGameplay\(delta, frameStartedAt\);/);
  assert.match(viewerSource, /keepAnimating = keepAnimating \|\| movedByKeys \|\| animationActive \|\| animationShouldRender \|\| gameplayActive;/);
});

test('viewer renders the gameplay ball as a primitive-sphere-matched 3DGS asset, mixes splat + mesh obstacles, and mirrors scene items into gameplay box collision', () => {
  assert.match(viewerSource, /this\.gameStage\.splatObstacles/);
  assert.match(viewerSource, /this\.gameStage\.meshObstacles/);
  assert.match(viewerSource, /this\.gameStage\.additionalCollisionObstacles = this\.collectGameplaySceneCollisionObstacles\(\);/);
  assert.match(viewerSource, /collectGameplaySceneCollisionObstacles\(\)/);
  assert.match(viewerSource, /shape: "box"/);
  assert.match(viewerSource, /halfSizeX,/);
  assert.match(viewerSource, /halfSizeZ,/);
  assert.match(viewerSource, /rotation,/);
  assert.match(viewerSource, /await this\.createGameplaySplatAsset\(\{\s*kind: "sphere",\s*radius: this\.gameState\.ball\.radius\s*\}\)/);
  assert.match(viewerSource, /this\.gameBallSplatRoot/);
  assert.doesNotMatch(viewerSource, /await this\.createGameplaySplatAsset\(\{\s*kind: "sphere",\s*radius: this\.gameState\.ball\.radius,\s*colorHex:/);
  assert.doesNotMatch(viewerSource, /new THREE\.SphereGeometry\(0\.22, 32, 24\)/);
});

test('viewer registers game HUD controls and motion permission actions', () => {
  assert.match(viewerSource, /gamePrimaryButton: document\.getElementById\("game-primary-button"\)/);
  assert.match(viewerSource, /gameEnableMotionButton: document\.getElementById\("game-enable-motion-button"\)/);
  assert.match(viewerSource, /gameCalibrateButton: document\.getElementById\("game-calibrate-button"\)/);
  assert.match(viewerSource, /this\.dom\.gameEnableMotionButton\?\.addEventListener\("click", \(\) => this\.requestMotionPermission\(\)\)/);
  assert.match(viewerSource, /window\.addEventListener\("deviceorientation", this\.handleDeviceOrientation, true\);/);
  assert.doesNotMatch(viewerSource, /gameTouchButton: document\.getElementById\("game-touch-button"\)/);
  assert.doesNotMatch(viewerSource, /this\.setGameplayInputMode\("touch"\);/);
});

test('viewer repositions the default cube demo away from the gameplay ball and splat obstacles', () => {
  assert.match(viewerSource, /selectedItem\.transform\.translateX = 2\.45;/);
  assert.match(viewerSource, /selectedItem\.transform\.translateY = 0\.58;/);
  assert.match(viewerSource, /selectedItem\.transform\.translateZ = -2\.05;/);
  assert.match(viewerSource, /selectedItem\.transform\.scale = 0\.82;/);
});

test('viewer batches viewport resize work and skips redundant stage resizes to reduce flicker', () => {
  assert.match(viewerSource, /this\.viewportResizeFrame = 0;/);
  assert.match(viewerSource, /this\.lastStageSize = \{ width: 0, height: 0 \};/);
  assert.match(viewerSource, /window\.cancelAnimationFrame\(this\.viewportResizeFrame\);/);
  assert.match(viewerSource, /this\.viewportResizeFrame = window\.requestAnimationFrame\(\(\) => \{/);
  assert.match(viewerSource, /if \(this\.lastStageSize\.width === width && this\.lastStageSize\.height === height\) \{/);
});

test('viewer uses an opaque gameplay floor mesh to avoid translucent base flicker', () => {
  assert.match(viewerSource, /const planeMaterial = new THREE\.MeshStandardMaterial\(\{/);
  assert.match(viewerSource, /color: 0x10202b,/);
  assert.doesNotMatch(viewerSource, /const planeMaterial = new THREE\.MeshBasicMaterial\(\{[\s\S]*?opacity: 0\.36,[\s\S]*?transparent: true,[\s\S]*?\}\);/);
});

test('viewer starts with scene exposure at -5 and adds a ball-following point light for gameplay', () => {
  assert.match(viewerSource, /exposure:\s*-5,/);
  assert.match(viewerSource, /this\.gameBallLight = new THREE\.PointLight\(0xffffff, 20(?:\.0)?, 2\.8, 2\);/);
  assert.match(viewerSource, /this\.gameBallLight\?\.position\.set\(position\.x, position\.y \+ 0\.85, position\.z\);/);
  assert.match(viewerSource, /const ambient = new THREE\.AmbientLight\(0xffffff, 0\.04\);/);
  assert.match(viewerSource, /const key = new THREE\.DirectionalLight\(0xffffff, 0\.18\);/);
});

test('index defaults the primitive picker to cube for the gameplay demo', () => {
  assert.match(htmlSource, /<option value="cube" selected>Cube<\/option>/);
  assert.doesNotMatch(htmlSource, /<option value="sphere" selected>Sphere<\/option>/);
  assert.match(viewerSource, /this\.dom\.primitiveSelect\.value = "cube";/);
  assert.match(viewerSource, /await this\.loadPrimitive\("cube"\);/);
});

test('index exposes the gameplay HUD overlay inside the viewer stage', () => {
  assert.match(htmlSource, /id="game-ui"/);
  assert.match(htmlSource, /id="game-primary-button"/);
  assert.match(htmlSource, /id="game-enable-motion-button"/);
  assert.match(htmlSource, /id="game-reset-button"/);
  assert.match(htmlSource, /id="game-status-text"/);
  assert.doesNotMatch(htmlSource, /id="game-touch-button"/);
});

test('viewer keeps the prototype in play-only mode without exposing the tools toggle', () => {
  assert.doesNotMatch(htmlSource, /id="view-mode-toggle-button"/);
  assert.doesNotMatch(viewerSource, /viewModeToggleButton:\s*document\.getElementById\("view-mode-toggle-button"\)/);
});
