import test from 'node:test';
import assert from 'node:assert/strict';
import { artDirection } from './art-direction.ts';
import { getTimeline } from './timeline.ts';

test('provides exactly one art direction entry for each of the 20 timeline moments', () => {
  assert.equal(artDirection.length, 20);
  for (let index = 0; index < 20; index++) {
    const moment = getTimeline((index + 0.5) / 20, 30.24);
    assert.equal(moment.chapter, index);
    assert.ok(artDirection[moment.chapter], `missing art direction for moment ${index}`);
  }
  assert.ok(artDirection[getTimeline(0, 30.24).chapter]);
  assert.ok(artDirection[getTimeline(1, 30.24).chapter]);
});

test('frame scales are finite, positive, and contained within the full frame', () => {
  for (const [index, direction] of artDirection.entries()) {
    for (const axis of ['frameX', 'frameY'] as const) {
      const scale = direction[axis];
      assert.equal(typeof scale, 'number', `${axis} must be numeric at moment ${index}`);
      assert.ok(Number.isFinite(scale), `${axis} must be finite at moment ${index}`);
      assert.ok(scale > 0 && scale <= 1, `${axis} must be in (0, 1] at moment ${index}`);
    }
  }
});

test('every frame scale supports finite inverse compensation with a product of 1', () => {
  for (const [index, direction] of artDirection.entries()) {
    for (const scale of [direction.frameX, direction.frameY]) {
      const compensation = 1 / scale;
      assert.ok(Number.isFinite(compensation), `invalid inverse compensation at moment ${index}`);
      assert.ok(Math.abs(scale * compensation - 1) < 1e-12, `distorting scale at moment ${index}`);
    }
  }
});

test('uses the poster composition exactly once at the beginning', () => {
  assert.equal(artDirection[0].composition, 'poster');
  assert.equal(artDirection.filter(direction => direction.composition === 'poster').length, 1);
});

test('uses the outro composition exactly once at the end', () => {
  assert.equal(artDirection[19].composition, 'outro');
  assert.equal(artDirection.filter(direction => direction.composition === 'outro').length, 1);
});

test('all moments declare a supported nonempty composition and string echo', () => {
  const compositions = new Set(['poster', 'split', 'fall', 'outro', 'whisper', 'sweep', 'rise', 'vertical', 'impact', 'horizon']);
  for (const [index, direction] of artDirection.entries()) {
    assert.equal(typeof direction.composition, 'string');
    assert.ok(direction.composition.trim().length > 0, `empty composition at moment ${index}`);
    assert.ok(compositions.has(direction.composition), `unknown composition at moment ${index}`);
    assert.equal(typeof direction.echo, 'string', `echo must be a string at moment ${index}`);
  }
});
