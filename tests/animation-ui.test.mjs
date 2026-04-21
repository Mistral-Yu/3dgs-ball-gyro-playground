import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../viewer.css', import.meta.url), 'utf8');

test('timeline panel is removed from the viewer page', () => {
  assert.doesNotMatch(html, /<section class="timeline-panel"[\s\S]*?<\/section>/);
  assert.doesNotMatch(html, /id="animation-play-button"/);
  assert.doesNotMatch(html, /id="animation-pause-button"/);
  assert.doesNotMatch(html, /id="animation-reset-button"/);
  assert.doesNotMatch(html, /id="animation-time-range"/);
  assert.doesNotMatch(css, /\.timeline-panel\s*\{/);
  assert.doesNotMatch(css, /\.button-pair\.button-pair-timeline\s*\{/);
});

test('animation tab keeps preset load beside preset and script actions in the panel', () => {
  const animationMatch = html.match(/<section class="inspector-panel" id="inspector-animation"[\s\S]*?<\/section>/);
  assert.ok(animationMatch, 'animation panel should exist');
  const panel = animationMatch[0];

  assert.match(panel, /id="animation-preset-select"[\s\S]*id="animation-load-preset-button"/);
  assert.match(panel, /value="explosion"/);
  assert.match(panel, /value="reveal"/);
  assert.match(panel, /id="animation-origin-mode-select"/);
  assert.match(panel, /id="animation-origin-x-input"/);
  assert.match(panel, /id="animation-origin-y-input"/);
  assert.match(panel, /id="animation-origin-z-input"/);
  assert.match(panel, />Load Script</);
  assert.match(panel, />Save Script</);
  assert.match(panel, />Apply Script</);
  assert.match(panel, /<textarea class="script-editor" id="animation-script-editor"[^>]*rows="24"/);
  assert.match(css, /\.script-editor\s*\{[\s\S]*min-height:\s*calc\(360px \* var\(--ui-scale\)\)/);
});

test('open file actions expose the auto-lod toggle beside file loading and viewer hud chip', () => {
  const helpersMatch = html.match(/<section class="panel-section">[\s\S]*?id="open-file-button"[\s\S]*?<\/section>/);
  assert.ok(helpersMatch, 'helpers section should exist');
  const helpers = helpersMatch[0];

  assert.match(helpers, /id="open-file-button"[\s\S]*id="lod-auto-checkbox"/);
  assert.match(helpers, /<input id="lod-auto-checkbox" type="checkbox">/);
  assert.match(html, /id="lod-chip">LOD Auto Off</);
  assert.match(css, /\.hud-chip-lod/);
});

test('inspector tabs stay pinned to a stable two-row grid', () => {
  const tabsMatch = html.match(/<div class="inspector-tabs" role="tablist" aria-label="Inspector tabs">[\s\S]*?<\/div>/);
  assert.ok(tabsMatch, 'inspector tablist should exist');
  assert.match(tabsMatch[0], /id="tab-scene-button"/);
  assert.match(tabsMatch[0], /id="tab-export-button"/);
  assert.equal((tabsMatch[0].match(/data-inspector-tab=/g) || []).length, 6);
  assert.match(css, /\.inspector-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /\.inspector-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
});

test('inspector sections rely on the green labels instead of duplicated white h2 headings', () => {
  const inspectorMatch = html.match(/<section class="panel-section inspector-shell">[\s\S]*?<\/section>/);
  assert.ok(inspectorMatch, 'inspector shell should exist');
  const inspector = inspectorMatch[0];

  assert.doesNotMatch(inspector, /<h2>Splats \/ Color \/ Light \/ Animation \/ Info \/ Export<\/h2>/);
  assert.doesNotMatch(inspector, /<h2>/);
});

test('color tab exposes point-based linear-srgb tone curve controls', () => {
  const colorMatch = html.match(/<section class="inspector-panel" id="inspector-color"[\s\S]*?<\/section>/);
  assert.ok(colorMatch, 'color panel should exist');
  const panel = colorMatch[0];

  assert.match(panel, /id="tone-curve-channel-select"/);
  assert.match(panel, /id="tone-curve-graph"/);
  assert.match(panel, /id="tone-curve-add-point-button"/);
  assert.match(panel, /id="tone-curve-remove-point-button"/);
  assert.match(panel, /id="tone-curve-point-x-input"/);
  assert.match(panel, /id="tone-curve-point-y-input"/);
  assert.match(panel, /linear sRGB/);
  assert.match(css, /\.tone-curve-graph/);
  assert.match(css, /\.tone-curve-point-list/);
});

test('info tab exposes post-load auto-lod and load-mode fields', () => {
  const infoMatch = html.match(/<section class="inspector-panel" id="inspector-info"[\s\S]*?<\/section>/);
  assert.ok(infoMatch, 'info panel should exist');
  const panel = infoMatch[0];

  assert.match(panel, /id="info-auto-lod"/);
  assert.match(panel, /id="info-load-mode"/);
});
