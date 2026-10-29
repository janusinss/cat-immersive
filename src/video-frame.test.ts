import test from 'node:test';
import assert from 'node:assert/strict';
import { getFrameTime } from './video-frame.ts';

test('clamps the opening and ending to decoded frame boundaries', () => {
  assert.equal(getFrameTime(0, 30.24), 0);
  assert.equal(getFrameTime(-10, 30.24), 0);
  const lastFrame = Math.floor((30.24 - 0.001) * 24) / 24;
  assert.equal(getFrameTime(30.24, 30.24), lastFrame);
  assert.equal(getFrameTime(50, 30.24), lastFrame);
  assert.ok(lastFrame < 30.24);
  assert.equal(getFrameTime(0.0005, 0.0005), 0);
});

test('rounds nearby targets to exactly the same video frame', () => {
  const frame = 100 / 24;
  assert.equal(getFrameTime(frame, 30.24), frame);
  for (const offset of [-0.01, -0.001, 0, 0.001, 0.01]) {
    assert.equal(getFrameTime(frame + offset, 30.24), frame);
  }
  assert.equal(getFrameTime(frame + 0.03, 30.24), 101 / 24);
  assert.equal(getFrameTime(frame - 0.03, 30.24), 99 / 24);
});

test('reverse seeking returns the identical earlier quantized target', () => {
  const first = getFrameTime(3.141, 30.24);
  const later = getFrameTime(22.765, 30.24);
  const reverse = getFrameTime(3.141, 30.24);
  assert.equal(reverse, first);
  assert.ok(reverse < later);
});

test('1001 forward targets remain monotonic and stay inside playable bounds', () => {
  const duration = 30.24;
  const lastFrame = Math.floor((duration - 0.001) * 24) / 24;
  let previous = -1;
  for (let sample = 0; sample <= 1000; sample++) {
    const target = getFrameTime(sample / 1000 * duration, duration);
    assert.ok(target >= previous, `target reversed at sample ${sample}`);
    assert.ok(target >= 0 && target <= lastFrame);
    assert.ok(Math.abs(target * 24 - Math.round(target * 24)) < 1e-9);
    previous = target;
  }
});

test('invalid duration or time produces the opening frame', () => {
  for (const duration of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(getFrameTime(5, duration), 0);
  }
  for (const time of [NaN, Infinity, -Infinity]) {
    assert.equal(getFrameTime(time, 30.24), 0);
  }
});

test('invalid frame rates fall back to 24 fps', () => {
  const defaultTarget = getFrameTime(3.141, 30.24);
  for (const fps of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(getFrameTime(3.141, 30.24, fps), defaultTarget);
  }
});

test('an explicit valid frame rate controls rounding and the ending frame', () => {
  assert.equal(getFrameTime(1.019, 30.24, 30), 31 / 30);
  assert.equal(getFrameTime(30.24, 30.24, 30), Math.floor((30.24 - 0.001) * 30) / 30);
  assert.equal(getFrameTime(0.75, 30.24, 2), 1);
});
