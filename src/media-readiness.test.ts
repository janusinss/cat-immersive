import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { watchMediaReadiness } from './media-readiness.ts';

class MockReadinessMedia extends EventTarget {
  duration = NaN;
  readyState = 0;
  added: string[] = [];
  removed: string[] = [];
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    this.added.push(type);
    super.addEventListener(type, callback, options);
  }
  override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
    this.removed.push(type);
    super.removeEventListener(type, callback, options);
  }
  asVideo() { return this as unknown as HTMLVideoElement; }
}

const readinessEvents = ['loadedmetadata', 'durationchange', 'canplay', 'loadeddata'];

test('already loaded metadata enables readiness immediately and only once', async () => {
  const media = new MockReadinessMedia();
  media.duration = 30.24;
  media.readyState = 1;
  let ready = 0;
  let stalled = 0;
  const cleanup = watchMediaReadiness(media.asVideo(), () => { ready++; }, () => { stalled++; }, 10);
  try {
    assert.equal(ready, 1);
    for (const event of readinessEvents) media.dispatchEvent(new Event(event));
    await delay(30);
    assert.equal(ready, 1);
    assert.equal(stalled, 0);
  } finally { cleanup(); }
});

test('each readiness event can enable a valid video with metadata but no decoded frame', () => {
  for (const event of readinessEvents) {
    const media = new MockReadinessMedia();
    let ready = 0;
    const cleanup = watchMediaReadiness(media.asVideo(), () => { ready++; }, () => {}, 1000);
    try {
      assert.equal(ready, 0);
      media.duration = 30.24;
      media.readyState = 1;
      media.dispatchEvent(new Event(event));
      assert.equal(ready, 1, `${event} must enable metadata-ready media`);
      for (const repeated of readinessEvents) media.dispatchEvent(new Event(repeated));
      assert.equal(ready, 1);
    } finally { cleanup(); }
  }
});

test('invalid duration and missing metadata cannot enable readiness', () => {
  for (const duration of [0, -1, NaN, Infinity, -Infinity]) {
    const media = new MockReadinessMedia();
    media.duration = duration;
    media.readyState = 4;
    let ready = 0;
    const cleanup = watchMediaReadiness(media.asVideo(), () => { ready++; }, () => {}, 1000);
    try {
      for (const event of readinessEvents) media.dispatchEvent(new Event(event));
      assert.equal(ready, 0);
    } finally { cleanup(); }
  }
  const media = new MockReadinessMedia();
  media.duration = 30.24;
  let ready = 0;
  const cleanup = watchMediaReadiness(media.asVideo(), () => { ready++; }, () => {}, 1000);
  try {
    for (const event of readinessEvents) media.dispatchEvent(new Event(event));
    assert.equal(ready, 0);
  } finally { cleanup(); }
});

test('unready media reports stalled after the timeout', async () => {
  const media = new MockReadinessMedia();
  let ready = 0;
  let stalled = 0;
  const cleanup = watchMediaReadiness(media.asVideo(), () => { ready++; }, () => { stalled++; }, 10);
  try {
    assert.equal(stalled, 0);
    await delay(30);
    assert.equal(ready, 0);
    assert.equal(stalled, 1);
  } finally { cleanup(); }
});

test('a media error reports stalled immediately', () => {
  const media = new MockReadinessMedia();
  let stalled = 0;
  const cleanup = watchMediaReadiness(media.asVideo(), () => {}, () => { stalled++; }, 1000);
  try {
    media.dispatchEvent(new Event('error'));
    assert.equal(stalled, 1);
  } finally { cleanup(); }
});

test('readiness before timeout prevents a later stalled notification', async () => {
  const media = new MockReadinessMedia();
  let ready = 0;
  let stalled = 0;
  const cleanup = watchMediaReadiness(media.asVideo(), () => { ready++; }, () => { stalled++; }, 10);
  try {
    media.duration = 30.24;
    media.readyState = 1;
    media.dispatchEvent(new Event('loadedmetadata'));
    await delay(30);
    assert.equal(ready, 1);
    assert.equal(stalled, 0);
  } finally { cleanup(); }
});

test('cleanup removes all listeners and prevents late event or timer callbacks', async () => {
  const media = new MockReadinessMedia();
  let ready = 0;
  let stalled = 0;
  const cleanup = watchMediaReadiness(media.asVideo(), () => { ready++; }, () => { stalled++; }, 10);
  const expectedEvents = [...readinessEvents, 'error'].sort();
  assert.deepEqual([...media.added].sort(), expectedEvents);
  cleanup();
  assert.deepEqual([...media.removed].sort(), expectedEvents);
  media.duration = 30.24;
  media.readyState = 4;
  for (const event of expectedEvents) media.dispatchEvent(new Event(event));
  await delay(30);
  assert.equal(ready, 0);
  assert.equal(stalled, 0);
});
