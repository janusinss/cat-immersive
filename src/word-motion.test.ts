import test from 'node:test';
import assert from 'node:assert/strict';
import { wordMotion, wordPose } from './word-motion.ts';
import { moments } from './moments.ts';

function wordCount(moment: typeof moments[number]) {
  return moment.layout === 'sky' || moment.layout === 'ending'
    ? moment.title.replace(/\s/g, '').length
    : moment.title.trim().split(/\s+/).length;
}

test('supplies one named motion profile for each of the 20 moments', () => {
  assert.equal(moments.length, 20);
  assert.equal(wordMotion.length, moments.length);
  for (const kind of wordMotion) {
    assert.equal(typeof kind, 'string');
    assert.ok(kind.trim().length > 0);
  }
});

test('every word pose is finite with positive scale and bounded opacity', () => {
  for (const [chapter, moment] of moments.entries()) {
    const count = wordCount(moment);
    for (let index = 0; index < count; index++) {
      for (const mobile of [false, true]) {
        const pose = wordPose(wordMotion[chapter], index, count, mobile);
        for (const property of ['x', 'yPercent', 'rotation', 'rotationX', 'rotationY', 'scale', 'opacity'] as const) {
          assert.equal(typeof pose[property], 'number');
          assert.ok(Number.isFinite(pose[property]), `${property} invalid in moment ${chapter}, word ${index}`);
        }
        assert.ok(pose.scale > 0);
        assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
      }
    }
  }
});

test('word poses remain deterministic across revisiting a moment', () => {
  for (const [chapter, moment] of moments.entries()) {
    const count = wordCount(moment);
    for (let index = 0; index < count; index++) {
      const initial = wordPose(wordMotion[chapter], index, count, false);
      wordPose(wordMotion[(chapter + 1) % wordMotion.length], 0, count, false);
      assert.deepEqual(wordPose(wordMotion[chapter], index, count, false), initial);
    }
  }
});

test('mobile motion never exceeds the desktop horizontal travel', () => {
  for (const [chapter, moment] of moments.entries()) {
    const count = wordCount(moment);
    for (let index = 0; index < count; index++) {
      const desktop = wordPose(wordMotion[chapter], index, count, false);
      const mobile = wordPose(wordMotion[chapter], index, count, true);
      assert.ok(Math.abs(mobile.x) <= Math.abs(desktop.x));
    }
  }
});

test('the opening title starts visible without a vertical reveal offset', () => {
  assert.equal(wordMotion[0], 'title');
  const count = wordCount(moments[0]);
  for (let index = 0; index < count; index++) {
    const pose = wordPose('title', index, count);
    assert.equal(pose.opacity, 1);
    assert.equal(pose.yPercent, 0);
  }
});

test('crosswind sends adjacent words in alternating horizontal directions', () => {
  for (let index = 0; index < 3; index++) {
    const first = wordPose('crosswind', index, 4);
    const next = wordPose('crosswind', index + 1, 4);
    assert.ok(first.x * next.x < 0);
  }
});

test('fall starts above the rest position and lift starts below it', () => {
  for (let index = 0; index < 4; index++) {
    assert.ok(wordPose('fall', index, 4).yPercent < 0);
    assert.ok(wordPose('lift', index, 4).yPercent > 0);
  }
});
