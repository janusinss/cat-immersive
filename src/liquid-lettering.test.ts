import test from 'node:test';
import assert from 'node:assert/strict';
import { liquidLetterPose } from './liquid-lettering.ts';

test('all letter poses remain finite across word lengths from 1 to 25', () => {
  for (let count = 1; count <= 25; count++) {
    for (let index = 0; index < count; index++) {
      for (const mobile of [false, true]) {
        const pose = liquidLetterPose(index, count, mobile);
        for (const key of ['yPercent', 'rotation', 'skewX', 'scaleX', 'scaleY'] as const) {
          assert.equal(typeof pose[key], 'number');
          assert.ok(Number.isFinite(pose[key]), `${key} invalid for letter ${index} of ${count}`);
        }
      }
    }
  }
});

test('letter scales stay positive within readable deformation bounds', () => {
  for (let count = 1; count <= 25; count++) {
    for (let index = 0; index < count; index++) {
      for (const mobile of [false, true]) {
        const pose = liquidLetterPose(index, count, mobile);
        assert.ok(pose.scaleX >= 0.5 && pose.scaleX <= 1.3);
        assert.ok(pose.scaleY >= 0.5 && pose.scaleY <= 1.3);
      }
    }
  }
});

test('returning to a letter produces the same pose', () => {
  for (let index = 0; index < 9; index++) {
    for (const mobile of [false, true]) {
      const original = liquidLetterPose(index, 9, mobile);
      liquidLetterPose((index + 1) % 9, 9, mobile);
      assert.deepEqual(liquidLetterPose(index, 9, mobile), original);
    }
  }
});

test('mobile deformation never exceeds desktop travel, tilt, skew, or scale deviation', () => {
  for (let count = 1; count <= 25; count++) {
    for (let index = 0; index < count; index++) {
      const desktop = liquidLetterPose(index, count, false);
      const mobile = liquidLetterPose(index, count, true);
      for (const key of ['yPercent', 'rotation', 'skewX'] as const) {
        assert.ok(Math.abs(mobile[key]) <= Math.abs(desktop[key]) + 1e-12);
      }
      for (const key of ['scaleX', 'scaleY'] as const) {
        assert.ok(Math.abs(mobile[key] - 1) <= Math.abs(desktop[key] - 1) + 1e-12);
      }
    }
  }
});

test('a 9-letter wave includes upward and downward positions', () => {
  for (const mobile of [false, true]) {
    const positions = Array.from({ length: 9 }, (_, index) => liquidLetterPose(index, 9, mobile).yPercent);
    assert.ok(positions.some(position => position < 0));
    assert.ok(positions.some(position => position > 0));
  }
});

test('a single letter has a finite readable pose', () => {
  for (const mobile of [false, true]) {
    const pose = liquidLetterPose(0, 1, mobile);
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.ok(pose.scaleX > 0 && pose.scaleY > 0);
  }
});
