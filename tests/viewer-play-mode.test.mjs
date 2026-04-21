import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../viewer.css', import.meta.url), 'utf8');
const viewerSource = await readFile(new URL('../viewer.js', import.meta.url), 'utf8');

test('viewer exposes a play-mode toggle in the header', () => {
  assert.match(html, /id="view-mode-toggle-button"/);
  assert.match(html, /title="Toggle between minimal play mode and the full viewer tools\."/);
});

test('viewer starts in play mode and can toggle back to tools mode', () => {
  assert.match(viewerSource, /viewMode:\s*"play"/);
  assert.match(viewerSource, /viewModeToggleButton:\s*document\.getElementById\("view-mode-toggle-button"\)/);
  assert.match(viewerSource, /this\.state\.viewMode/);
  assert.match(viewerSource, /setViewMode\(/);
  assert.match(viewerSource, /syncViewModeUi\(/);
});

test('play mode hides the editor panels and technical viewer HUD', () => {
  assert.match(css, /body\[data-view-mode="play"\][\s\S]*?\.panel-left[\s\S]*?display:\s*none/);
  assert.match(css, /body\[data-view-mode="play"\][\s\S]*?\.panel-right[\s\S]*?display:\s*none/);
  assert.match(css, /body\[data-view-mode="play"\][\s\S]*?\.viewer-hud[\s\S]*?display:\s*none/);
  assert.match(css, /body\[data-view-mode="play"\][\s\S]*?\.workspace[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});
