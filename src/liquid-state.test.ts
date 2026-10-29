import test from 'node:test';
import assert from 'node:assert/strict';
import { getLiquidState } from './liquid-state.ts';

test('invalid time resolves to a finite opening state', () => {
  const opening = getLiquidState(0, 30);
  for (const time of [NaN, Infinity, -Infinity]) {
    assert.deepEqual(getLiquidState(time, 30), opening);
  }
  for (const value of Object.values(opening)) assert.ok(Number.isFinite(value));
});

test('negative time clamps to zero', () => {
  assert.deepEqual(getLiquidState(-10, 30), getLiquidState(0, 30));
  assert.equal(getLiquidState(-10, 30).time, 0);
  assert.equal(getLiquidState(-10, 30).progress, 0);
});

test('invalid duration preserves valid time with finite opening progress', () => {
  for (const duration of [0, -1, NaN, Infinity, -Infinity]) {
    const state = getLiquidState(5, duration);
    assert.equal(state.time, 5);
    assert.equal(state.progress, 0);
    assert.ok(Number.isFinite(state.energy));
    assert.ok(state.energy >= 0.18 && state.energy <= 1);
  }
});

test('state is deterministic when returning to an earlier playback time', () => {
  const earlier = getLiquidState(8.55, 30);
  getLiquidState(27, 30);
  assert.deepEqual(getLiquidState(8.55, 30), earlier);
});

test('leap moments produce stronger liquid energy than quiet scenes', () => {
  const duration = 30;
  const quietEnergies = [0, 0.45, 0.95].map(progress => getLiquidState(progress * duration, duration).energy);
  for (const progress of [0.285, 0.625, 0.775]) {
    const leap = getLiquidState(progress * duration, duration);
    assert.ok(leap.energy > 0.9);
    for (const quiet of quietEnergies) assert.ok(leap.energy > quiet + 0.5);
  }
});

test('liquid energy decays after each leap peak', () => {
  const duration = 30;
  for (const peak of [0.285, 0.625, 0.775]) {
    const peakEnergy = getLiquidState(peak * duration, duration).energy;
    const departingEnergy = getLiquidState((peak + 0.02) * duration, duration).energy;
    const quietEnergy = getLiquidState((peak + 0.05) * duration, duration).energy;
    assert.ok(peakEnergy > departingEnergy);
    assert.ok(departingEnergy > quietEnergy);
  }
});

test('sampled states stay finite with bounded progress and energy', () => {
  const duration = 30;
  for (let sample = 0; sample <= 1100; sample++) {
    const time = sample / 1000 * duration;
    const state = getLiquidState(time, duration);
    assert.equal(state.time, time);
    assert.ok(Number.isFinite(state.energy));
    assert.ok(state.energy >= 0.18 && state.energy <= 1);
    assert.ok(state.progress >= 0 && state.progress <= 1);
  }
  assert.equal(getLiquidState(duration * 2, duration).progress, 1);
});
