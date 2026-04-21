import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../viewer.js', import.meta.url), 'utf8');

test('applyRenderMode keeps apply-only scripts visually idle and updates modifier pipelines consistently', () => {
  assert.match(source, /shouldAttachAnimationModifier\(/);
  assert.match(source, /this\.state\.animationPlaying \|\| this\.state\.animationTime > 0/);
  assert.match(source, /const animationModifier = this\.shouldAttachAnimationModifier\(\) \? this\.activeAnimationModifier : null;/);
  assert.match(source, /item\.mesh\.enableLod = !animationModifier;/);
  assert.match(source, /item\.mesh\.covObjectModifiers = item\.mesh\.objectModifiers;/);
  assert.match(source, /item\.mesh\.covWorldModifiers = item\.mesh\.worldModifiers;/);
  assert.match(source, /this\.applyShLevel\(true\);/);
});

test('tone curve state is stored per scene item and applied only to the selected item', () => {
  assert.match(source, /settings:\s*\{[\s\S]*toneCurve:\s*buildToneCurveState\(\)/);
  assert.match(source, /this\.state\.toneCurve = normalizeToneCurveState\(item\?\.settings\?\.toneCurve \?\? buildToneCurveState\(\)\);/);
  assert.match(source, /item\.settings\.toneCurve = normalizeToneCurveState\(this\.state\.toneCurve\);/);
  assert.match(source, /if \(item\.id === this\.selectedSceneItemId && !isNeutralToneCurve\(item\.settings\.toneCurve\)\)/);
  assert.match(source, /createToneCurveColorModifier\(item\.settings\.toneCurve\)/);
  assert.match(source, /const toneCurve = item\.settings\?\.toneCurve \?\? buildToneCurveState\(\);/);
  assert.doesNotMatch(source, /createToneCurveColorModifier\(this\.state\.toneCurve\)/);
});

test('tone curve graph supports direct left-click add and right-click remove without using the add button', () => {
  assert.match(source, /this\.dom\.toneCurveGraph\?\.addEventListener\("pointerdown", \(event\) => this\.handleToneCurveGraphPointerDown\(event\)\);/);
  assert.match(source, /this\.dom\.toneCurveGraph\?\.addEventListener\("contextmenu", \(event\) => this\.handleToneCurveGraphContextMenu\(event\)\);/);
  assert.match(source, /handleToneCurveGraphPointerDown\(event\)\s*\{[\s\S]*if \(event\.button !== 0\)[\s\S]*insertToneCurvePoint\(this\.state\.toneCurve,\s*channel,\s*\{\s*x,\s*y\s*\}\)/);
  assert.match(source, /handleToneCurveGraphContextMenu\(event\)\s*\{[\s\S]*findNearestRemovableToneCurvePointIndex\([\s\S]*removeToneCurvePoint\(this\.state\.toneCurve,\s*channel,\s*index\)/);
});

test('tone curve endpoint editing stays enabled for point inputs and graph dragging while deletion remains protected', () => {
  assert.match(source, /setSelectedToneCurvePointValue\(axis, value, \{ commit = true \} = \{\}\) \{[\s\S]*updateToneCurvePoint\(toneCurve,\s*channel,\s*index,\s*\{ \[axis\]: value \}\)/);
  assert.doesNotMatch(source, /this\.dom\.toneCurvePointXInput\.disabled = isEndpoint/);
  assert.doesNotMatch(source, /this\.dom\.toneCurvePointYInput\.disabled = isEndpoint/);
  assert.match(source, /this\.dom\.toneCurveRemovePointButton\.disabled = isEndpoint/);
  assert.doesNotMatch(source, /startToneCurvePointDrag\(index, event\)\s*\{[\s\S]*if \(index <= 0 \|\| !this\.dom\.toneCurveGraph\)/);
  assert.doesNotMatch(source, /startToneCurvePointDrag\(index, event\)\s*\{[\s\S]*if \(index >= toneCurve\.curves\[channel\]\.length - 1\)/);
});

test('exposure and tone-curve edits use deferred low-fps preview while inputs are active', () => {
  assert.match(source, /setExposure\(value, \{ commit = true, syncInput = true \} = \{\}\) \{[\s\S]*if \(commit\) \{[\s\S]*this\.finishDeferredInteraction\(\);[\s\S]*\} else \{[\s\S]*this\.startDeferredInteraction\(\);/);
  assert.match(source, /setSelectedExposure\(value, \{ commit = true, syncInput = true \} = \{\}\) \{[\s\S]*if \(commit\) \{[\s\S]*this\.finishDeferredInteraction\(\);[\s\S]*\} else \{[\s\S]*this\.startDeferredInteraction\(\);/);
  assert.match(source, /setSelectedToneCurvePointValue\(axis, value, \{ commit = true \} = \{\}\) \{/);
  assert.match(source, /range\?\.addEventListener\("input", \(event\) => onChange\(event\.target\.value, \{[\s\S]*commit:\s*false/);
  assert.match(source, /range\?\.addEventListener\("change", \(event\) => onChange\(event\.target\.value, \{[\s\S]*commit:\s*true/);
});

test('info panel metadata includes auto-lod and load-mode summaries', () => {
  assert.match(source, /infoAutoLod: document\.getElementById\("info-auto-lod"\)/);
  assert.match(source, /infoLoadMode: document\.getElementById\("info-load-mode"\)/);
  assert.match(source, /this\.dom\.infoAutoLod\.textContent = this\.state\.autoLodEnabled \? "Enabled" : "Disabled";/);
  assert.match(source, /this\.dom\.infoLoadMode\.textContent = buildLodInfoLabel\(\{/);
});

test('Auto LoD starts disabled in the viewer state', () => {
  assert.match(source, /autoLodEnabled:\s*false,/);
  assert.doesNotMatch(source, /autoLodEnabled:\s*true,/);
});
