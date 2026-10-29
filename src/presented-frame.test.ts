import test from 'node:test';
import assert from 'node:assert/strict';
import { watchPresentedFrames } from './presented-frame.ts';

class MockMedia extends EventTarget {
  currentTime = 0;
  seeking = false;
  pending = new Map<number, VideoFrameRequestCallback>();
  canceled: number[] = [];
  added: string[] = [];
  removed: string[] = [];
  nextHandle = 1;
  requests = 0;
  requestVideoFrameCallback: ((callback: VideoFrameRequestCallback) => number) | undefined = callback => {
    const handle = this.nextHandle++;
    this.requests++;
    this.pending.set(handle, callback);
    return handle;
  };
  cancelVideoFrameCallback: ((handle: number) => void) | undefined = handle => {
    this.canceled.push(handle);
    this.pending.delete(handle);
  };
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    this.added.push(type);
    super.addEventListener(type, callback, options);
  }
  override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
    this.removed.push(type);
    super.removeEventListener(type, callback, options);
  }
  present(mediaTime: number) {
    const entry = this.pending.entries().next().value;
    assert.ok(entry, 'a video frame callback must be pending');
    const [handle, callback] = entry;
    this.pending.delete(handle);
    callback(0, { mediaTime } as VideoFrameCallbackMetadata);
  }
  asVideo() { return this as unknown as HTMLVideoElement; }
}

test('reports presented metadata time instead of a pending currentTime seek target', () => {
  const media = new MockMedia();
  const seen: number[] = [];
  const cleanup = watchPresentedFrames(media.asVideo(), time => seen.push(time));
  media.currentTime = 24;
  media.seeking = true;
  media.present(3.25);
  assert.deepEqual(seen, [3.25]);
  assert.deepEqual(media.added, []);
  cleanup();
});

test('arms exactly one replacement callback after each presented frame', () => {
  const media = new MockMedia();
  const seen: number[] = [];
  const cleanup = watchPresentedFrames(media.asVideo(), time => seen.push(time));
  assert.equal(media.requests, 1);
  assert.equal(media.pending.size, 1);
  for (const time of [1, 2, 3]) {
    const before: number = media.requests;
    media.present(time);
    assert.equal(media.requests, before + 1);
    assert.equal(media.pending.size, 1);
  }
  assert.deepEqual(seen, [1, 2, 3]);
  cleanup();
});

test('cleanup cancels the pending callback and ignores a late callback', () => {
  const media = new MockMedia();
  const seen: number[] = [];
  const cleanup = watchPresentedFrames(media.asVideo(), time => seen.push(time));
  media.present(1);
  const [handle, late] = [...media.pending.entries()][0];
  const requests = media.requests;
  cleanup();
  assert.deepEqual(media.canceled, [handle]);
  assert.equal(media.pending.size, 0);
  late(0, { mediaTime: 10 } as VideoFrameCallbackMetadata);
  assert.deepEqual(seen, [1]);
  assert.equal(media.requests, requests);
  assert.equal(media.pending.size, 0);
});

test('unsupported frame callbacks use all media events and skip pending seeks', () => {
  const media = new MockMedia();
  media.requestVideoFrameCallback = undefined;
  media.cancelVideoFrameCallback = undefined;
  const seen: number[] = [];
  const cleanup = watchPresentedFrames(media.asVideo(), time => seen.push(time));
  assert.deepEqual([...media.added].sort(), ['loadeddata', 'seeked', 'timeupdate']);
  for (const [index, event] of ['loadeddata', 'timeupdate', 'seeked'].entries()) {
    media.currentTime = index + 1;
    media.seeking = true;
    media.dispatchEvent(new Event(event));
    assert.equal(seen.length, index);
    media.seeking = false;
    media.dispatchEvent(new Event(event));
    assert.equal(seen[index], index + 1);
  }
  assert.equal(media.requests, 0);
  cleanup();
});

test('fallback cleanup removes every media listener and stops notifications', () => {
  const media = new MockMedia();
  media.requestVideoFrameCallback = undefined;
  media.cancelVideoFrameCallback = undefined;
  const seen: number[] = [];
  const cleanup = watchPresentedFrames(media.asVideo(), time => seen.push(time));
  cleanup();
  assert.deepEqual([...media.removed].sort(), ['loadeddata', 'seeked', 'timeupdate']);
  media.currentTime = 5;
  for (const event of ['loadeddata', 'timeupdate', 'seeked']) media.dispatchEvent(new Event(event));
  assert.deepEqual(seen, []);
});

test('missing cancellation support selects the event fallback', () => {
  const media = new MockMedia();
  media.cancelVideoFrameCallback = undefined;
  const seen: number[] = [];
  const cleanup = watchPresentedFrames(media.asVideo(), time => seen.push(time));
  assert.equal(media.requests, 0);
  assert.deepEqual([...media.added].sort(), ['loadeddata', 'seeked', 'timeupdate']);
  media.currentTime = 7;
  media.dispatchEvent(new Event('seeked'));
  assert.deepEqual(seen, [7]);
  cleanup();
});
