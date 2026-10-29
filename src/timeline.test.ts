import test from 'node:test';
import assert from 'node:assert/strict';
import { getTimeline } from './timeline.ts';

test('maps the first and last scroll positions without seeking beyond the film', () => {
  assert.deepEqual(getTimeline(0, 30.24), { progress: 0, time: 0, chapter: 0, local: 0 });
  const end = getTimeline(1, 30.24);
  assert.equal(end.progress, 1);
  assert.ok(Math.abs(end.time - 30.19) < 1e-10);
  assert.equal(end.chapter, 19);
  assert.equal(end.local, 1);
  assert.ok(end.time < 30.24);
});

test('clamps scroll positions outside the story', () => {
  assert.deepEqual(getTimeline(-0.5, 10), getTimeline(0, 10));
  assert.deepEqual(getTimeline(1.5, 10), getTimeline(1, 10));
});

test('uses the opening for nonfinite scroll positions', () => {
  for (const progress of [NaN, Infinity, -Infinity]) {
    assert.deepEqual(getTimeline(progress, 10), { progress: 0, time: 0, chapter: 0, local: 0 });
  }
});

test('covers all 20 moments and their local positions', () => {
  for (let chapter = 0; chapter < 20; chapter++) {
    const middle = getTimeline((chapter + 0.5) / 20, 30.24);
    assert.equal(middle.chapter, chapter);
    assert.ok(Math.abs(middle.local - 0.5) < 1e-12);
    const start = getTimeline((chapter + 0.00001) / 20, 30.24);
    assert.equal(start.chapter, chapter);
    assert.ok(start.local < 0.00002);
  }
});

test('reversing scroll returns the same earlier scene and frame', () => {
  const earlier = getTimeline(0.25, 30.24);
  const later = getTimeline(0.75, 30.24);
  const reversed = getTimeline(0.25, 30.24);
  assert.deepEqual(reversed, earlier);
  assert.ok(reversed.time < later.time);
  assert.ok(reversed.chapter < later.chapter);
});

test('invalid or unloaded duration keeps seeking at zero', () => {
  for (const duration of [0, -1, NaN, Infinity, -Infinity]) {
    const frame = getTimeline(0.5, duration);
    assert.equal(frame.time, 0);
    assert.equal(frame.progress, 0.5);
    assert.equal(frame.chapter, 10);
    assert.equal(frame.local, 0);
  }
});

test('very short films never produce a negative seek time', () => {
  assert.equal(getTimeline(1, 0.01).time, 0);
});

test('video time stays monotonic through 1000 forward scroll samples', () => {
  let previous = -1;
  for (let sample = 0; sample <= 1000; sample++) {
    const frame = getTimeline(sample / 1000, 30.24);
    assert.ok(frame.time >= previous, `time moved backward at sample ${sample}`);
    assert.ok(frame.local >= 0 && frame.local <= 1);
    assert.ok(frame.chapter >= 0 && frame.chapter < 20);
    previous = frame.time;
  }
});

test('moment boundaries preserve continuous video time', () => {
  const epsilon = 1e-7;
  for (let chapter = 1; chapter < 20; chapter++) {
    const boundary = chapter / 20;
    const before = getTimeline(boundary - epsilon, 30.24);
    const at = getTimeline(boundary, 30.24);
    const after = getTimeline(boundary + epsilon, 30.24);
    const expected = boundary * 30.19;
    assert.ok(Math.abs(at.time - expected) < 1e-10);
    assert.ok(Math.abs(before.time - after.time) < 1e-7);
  }
});

test('video dwells near moment edges and moves faster through the middle', () => {
  const duration = 30.24;
  const edgeAdvance = getTimeline(0.0001, duration).time - getTimeline(0, duration).time;
  const middleAdvance = getTimeline(0.0251, duration).time - getTimeline(0.025, duration).time;
  assert.ok(edgeAdvance < middleAdvance / 100);
  const boundary = 0.5;
  const boundaryAdvance = getTimeline(boundary + 0.0001, duration).time - getTimeline(boundary, duration).time;
  assert.ok(boundaryAdvance < middleAdvance / 100);
  const local = 0.25;
  const expected = (local * local * (3 - 2 * local)) / 20 * 30.19;
  assert.ok(Math.abs(getTimeline(local / 20, duration).time - expected) < 1e-10);
});
