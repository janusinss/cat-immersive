import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlaybackPosition } from './playback.ts';

test('maps the opening, midpoint, and ending of normal playback', () => {
  assert.deepEqual(getPlaybackPosition(0, 30), { progress: 0, chapter: 0, local: 0 });
  assert.deepEqual(getPlaybackPosition(15, 30), { progress: 0.5, chapter: 10, local: 0 });
  assert.deepEqual(getPlaybackPosition(30, 30), { progress: 1, chapter: 19, local: 1 });
});

test('each elapsed second advances progress linearly without easing or slowing', () => {
  const duration = 30;
  let previous = getPlaybackPosition(0, duration).progress;
  for (let second = 1; second <= duration; second++) {
    const position = getPlaybackPosition(second, duration);
    assert.ok(Math.abs(position.progress - second / duration) < 1e-12);
    assert.ok(Math.abs(position.progress - previous - 1 / duration) < 1e-12);
    previous = position.progress;
  }
  assert.equal(getPlaybackPosition(0.375, 30).progress, 0.0125);
  assert.equal(getPlaybackPosition(0.375, 30).local, 0.25);
});

test('all 20 moments map to the expected chapter and linear local position', () => {
  for (let chapter = 0; chapter < 20; chapter++) {
    for (const local of [0.125, 0.5, 0.875]) {
      const time = (chapter + local) / 20 * 30;
      const position = getPlaybackPosition(time, 30);
      assert.equal(position.chapter, chapter);
      assert.ok(Math.abs(position.local - local) < 1e-12);
      assert.ok(Math.abs(position.progress - time / 30) < 1e-12);
    }
  }
});

test('out-of-range playback time clamps to the first or final moment', () => {
  assert.deepEqual(getPlaybackPosition(-1, 30), { progress: 0, chapter: 0, local: 0 });
  assert.deepEqual(getPlaybackPosition(31, 30), { progress: 1, chapter: 19, local: 1 });
});

test('invalid playback times resolve to the opening', () => {
  for (const time of [NaN, Infinity, -Infinity]) {
    assert.deepEqual(getPlaybackPosition(time, 30), { progress: 0, chapter: 0, local: 0 });
  }
});

test('invalid or unloaded duration resolves to the opening', () => {
  for (const duration of [0, -1, NaN, Infinity, -Infinity]) {
    assert.deepEqual(getPlaybackPosition(15, duration), { progress: 0, chapter: 0, local: 0 });
  }
});

test('chapter boundaries follow elapsed playback time without a dwell', () => {
  const epsilon = 1e-6;
  for (let chapter = 1; chapter < 20; chapter++) {
    const time = chapter * 1.5;
    const before = getPlaybackPosition(time - epsilon, 30);
    const at = getPlaybackPosition(time, 30);
    const after = getPlaybackPosition(time + epsilon, 30);
    assert.equal(before.chapter, chapter - 1);
    assert.equal(at.chapter, chapter);
    assert.equal(after.chapter, chapter);
    assert.ok(Math.abs((after.progress - before.progress) - 2 * epsilon / 30) < 1e-12);
  }
});
