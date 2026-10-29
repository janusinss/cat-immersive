import test from 'node:test';
import assert from 'node:assert/strict';
import { wordEffect, overdrivePose, glyphPose } from './word-overdrive.ts';
import { moments } from './moments.ts';

const semanticWords = ['UP', 'LOW', 'LINES', 'ALONE', 'BREATHE', 'GO', 'LANDING', 'ACROSS', 'OPEN', 'WATER', 'ONWARD', 'CLOSE'];
const momentWords = moments.flatMap(moment => moment.title.trim().split(/\s+/));

test('semantically different action words receive distinct motion families', () => {
  const effects = semanticWords.map(wordEffect);
  assert.equal(new Set(effects).size, semanticWords.length);
});

test('letter case and punctuation preserve a word motion family', () => {
  for (const word of [...semanticWords, 'THE']) {
    assert.equal(wordEffect(word.toLowerCase()), wordEffect(word));
    assert.equal(wordEffect(`(${word.toLowerCase()}.)!`), wordEffect(word));
  }
});

test('the film uses at least 10 distinct word motion families', () => {
  assert.ok(new Set(momentWords.map(wordEffect)).size >= 10);
});

test('every film word and glyph has finite transforms with positive scales', () => {
  for (const [wordIndex, word] of momentWords.entries()) {
    const effect = wordEffect(word);
    const count = Math.max(1, word.replace(/[^a-z]/gi, '').length);
    for (const mobile of [false, true]) {
      const pose = overdrivePose(effect, wordIndex, momentWords.length, mobile);
      assert.ok(Object.values(pose).every(Number.isFinite), `nonfinite word pose for ${word}`);
      assert.ok(pose.scaleX > 0 && pose.scaleY > 0);
      assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
      for (let index = 0; index < count; index++) {
        const glyph = glyphPose(effect, index, count, mobile);
        assert.ok(Object.values(glyph).every(Number.isFinite), `nonfinite glyph pose for ${word}, letter ${index}`);
        assert.ok(glyph.scaleX > 0 && glyph.scaleY > 0);
      }
    }
  }
});

test('mobile word and glyph motion never exceeds desktop travel or rotation', () => {
  for (const word of semanticWords) {
    const effect = wordEffect(word);
    for (let index = 0; index < 9; index++) {
      const desktopWord = overdrivePose(effect, index, 9, false);
      const mobileWord = overdrivePose(effect, index, 9, true);
      const desktopGlyph = glyphPose(effect, index, 9, false);
      const mobileGlyph = glyphPose(effect, index, 9, true);
      for (const key of ['x', 'yPercent', 'rotation', 'rotationY'] as const) {
        assert.ok(Math.abs(mobileWord[key]) <= Math.abs(desktopWord[key]) + 1e-12);
        assert.ok(Math.abs(mobileGlyph[key]) <= Math.abs(desktopGlyph[key]) + 1e-12);
      }
      assert.ok(Math.abs(mobileWord.rotationX) <= Math.abs(desktopWord.rotationX) + 1e-12);
    }
  }
});

test('word and glyph poses are deterministic when revisiting an effect', () => {
  for (const word of semanticWords) {
    const effect = wordEffect(word);
    for (const mobile of [false, true]) {
      assert.deepEqual(overdrivePose(effect, 1, 5, mobile), overdrivePose(effect, 1, 5, mobile));
      assert.deepEqual(glyphPose(effect, 1, 5, mobile), glyphPose(effect, 1, 5, mobile));
    }
  }
});
