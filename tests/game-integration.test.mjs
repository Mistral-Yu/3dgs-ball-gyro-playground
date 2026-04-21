import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const viewerSource = await readFile(new URL('../viewer.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('viewer imports gameplay modules and advances gameplay each frame', () => {
  assert.match(viewerSource, /from "\.\/ball-game\.mjs"/);
  assert.match(viewerSource, /from "\.\/motion-controls\.mjs"/);
  assert.match(viewerSource, /from "\.\/touch-controls\.mjs"/);
  assert.match(viewerSource, /from "\.\/game-ui-state\.mjs"/);
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
  assert.match(viewerSource, /this\.setGameplayInputMode\("sensor"\);/);
});

test('viewer repositions the default cube demo away from the gameplay ball and splat obstacles', () => {
  assert.match(viewerSource, /selectedItem\.transform\.translateX = 2\.45;/);
  assert.match(viewerSource, /selectedItem\.transform\.translateY = 0\.58;/);
  assert.match(viewerSource, /selectedItem\.transform\.translateZ = -2\.05;/);
  assert.match(viewerSource, /selectedItem\.transform\.scale = 0\.82;/);
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
  assert.match(htmlSource, /id="game-touch-button"/);
  assert.match(htmlSource, /id="game-reset-button"/);
  assert.match(htmlSource, /id="game-status-text"/);
});
