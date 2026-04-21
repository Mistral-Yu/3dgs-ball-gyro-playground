import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../viewer.css', import.meta.url), 'utf8');
const viewerSource = await readFile(new URL('../viewer.js', import.meta.url), 'utf8');

test('viewer does not expose the tools toggle in the header', () => {
  assert.doesNotMatch(html, /id="view-mode-toggle-button"/);
});

test('viewer stays locked to play mode', () => {
  assert.match(viewerSource, /viewMode:\s*"play"/);
  assert.match(viewerSource, /this\.state\.viewMode/);
  assert.match(viewerSource, /syncViewModeUi\(/);
  assert.doesNotMatch(viewerSource, /this\.dom\.viewModeToggleButton\?\.addEventListener/);
});

test('play mode hides the editor panels and technical viewer HUD', () => {
  assert.match(css, /body\[data-view-mode="play"\][\s\S]*?\.panel-left[\s\S]*?display:\s*none/);
  assert.match(css, /body\[data-view-mode="play"\][\s\S]*?\.panel-right[\s\S]*?display:\s*none/);
  assert.match(css, /body\[data-view-mode="play"\][\s\S]*?\.viewer-hud[\s\S]*?display:\s*none/);
  assert.match(css, /body\[data-view-mode="play"\][\s\S]*?\.workspace[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test('play mode removes blur compositing from the viewer shell and gameplay HUD to reduce flicker', () => {
  assert.match(css, /body\[data-view-mode="play"\] \.viewer-panel[\s\S]*?backdrop-filter:\s*none/);
  assert.match(css, /body\[data-view-mode="play"\] \.game-ui[\s\S]*?backdrop-filter:\s*none/);
});
