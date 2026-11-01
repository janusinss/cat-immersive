import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSeekableVideo, selectVideoSource } from './seekable-video.ts';

async function withMediaMocks(
  response: Response,
  check: (state: { requests: Array<{ input: RequestInfo | URL; init?: RequestInit }>; blobs: Blob[] }) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const blobs: Blob[] = [];
  globalThis.fetch = async (input, init) => { requests.push({ input, init }); return response; };
  URL.createObjectURL = blob => { assert.ok(blob instanceof Blob); blobs.push(blob); return 'blob:test-film'; };
  try {
    await check({ requests, blobs });
  } finally {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
  }
}

test('loads a video Blob URL with the supplied abort signal and force-cache', { concurrency: false }, async () => {
  const controller = new AbortController();
  await withMediaMocks(new Response(new Blob(['film'], { type: 'video/mp4' })), async ({ requests, blobs }) => {
    assert.equal(await loadSeekableVideo('/VIDEO.mp4', controller.signal), 'blob:test-film');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].input, '/VIDEO.mp4');
    assert.equal(requests[0].init?.signal, controller.signal);
    assert.equal(requests[0].init?.cache, 'force-cache');
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].type, 'video/mp4');
    assert.equal(await blobs[0].text(), 'film');
  });
});

test('rejects an HTTP 404 without creating an object URL', { concurrency: false }, async () => {
  await withMediaMocks(new Response('missing', { status: 404 }), async ({ blobs }) => {
    await assert.rejects(loadSeekableVideo('/missing.mp4', new AbortController().signal), /404/);
    assert.equal(blobs.length, 0);
  });
});

test('rejects an HTML response without creating an object URL', { concurrency: false }, async () => {
  const response = new Response(new Blob(['<html>fallback</html>'], { type: 'text/html' }));
  await withMediaMocks(response, async ({ blobs }) => {
    await assert.rejects(loadSeekableVideo('/VIDEO.mp4', new AbortController().signal), /video file/i);
    assert.equal(blobs.length, 0);
  });
});

test('rejects an empty video response without creating an object URL', { concurrency: false }, async () => {
  await withMediaMocks(new Response(new Blob([], { type: 'video/mp4' })), async ({ blobs }) => {
    await assert.rejects(loadSeekableVideo('/VIDEO.mp4', new AbortController().signal), /video file/i);
    assert.equal(blobs.length, 0);
  });
});

test('aborting during Blob loading rejects without creating an object URL', { concurrency: false }, async () => {
  const controller = new AbortController();
  const response = new Response(new Blob(['film'], { type: 'video/mp4' }));
  response.blob = async () => {
    controller.abort();
    return new Blob(['film'], { type: 'video/mp4' });
  };
  await withMediaMocks(response, async ({ blobs }) => {
    await assert.rejects(loadSeekableVideo('/VIDEO.mp4', controller.signal), { name: 'AbortError' });
    assert.equal(blobs.length, 0);
  });
});

test('normalizes a typeless Blob to video/mp4 without changing its bytes', { concurrency: false }, async () => {
  await withMediaMocks(new Response(new Blob(['film-bytes'])), async ({ blobs }) => {
    assert.equal(await loadSeekableVideo('/VIDEO.mp4', new AbortController().signal), 'blob:test-film');
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].type, 'video/mp4');
    assert.equal(await blobs[0].text(), 'film-bytes');
  });
});

test('accepts application/octet-stream video bytes from a static host', { concurrency: false }, async () => {
  const response = new Response(new Blob(['film'], { type: 'application/octet-stream' }));
  await withMediaMocks(response, async ({ blobs }) => {
    assert.equal(await loadSeekableVideo('/VIDEO.mp4', new AbortController().signal), 'blob:test-film');
    assert.equal(blobs.length, 1);
    assert.equal(await blobs[0].text(), 'film');
  });
});

test('streamed loading preserves chunk bytes and video type with monotonic progress ending at 100', { concurrency: false }, async () => {
  const chunks = [new Uint8Array([0, 255]), new Uint8Array([1, 128, 42]), new Uint8Array([9])];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const response = new Response(stream, { headers: { 'content-type': 'video/mp4', 'content-length': '6' } });
  await withMediaMocks(response, async ({ blobs }) => {
    const progress: number[] = [];
    assert.equal(await loadSeekableVideo('/VIDEO.mp4', new AbortController().signal, percent => progress.push(percent)), 'blob:test-film');
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].type, 'video/mp4');
    assert.deepEqual(new Uint8Array(await blobs[0].arrayBuffer()), new Uint8Array([0, 255, 1, 128, 42, 9]));
    assert.ok(progress.length > 1);
    assert.ok(progress.some(percent => percent > 0 && percent < 100));
    assert.equal(progress.at(-1), 100);
    assert.equal(progress.filter(percent => percent === 100).length, 1);
    for (let index = 0; index < progress.length; index++) {
      assert.ok(Number.isFinite(progress[index]) && progress[index] >= 0 && progress[index] <= 100);
      if (index) assert.ok(progress[index] >= progress[index - 1]);
    }
    assert.equal(response.body?.locked, false);
  });
});

test('aborting during streamed reading creates no object URL and releases the reader', { concurrency: false }, async () => {
  const controller = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    start(reader) {
      reader.enqueue(new Uint8Array([1, 2]));
      reader.enqueue(new Uint8Array([3, 4]));
      reader.close();
    },
  });
  const response = new Response(stream, { headers: { 'content-type': 'video/mp4', 'content-length': '4' } });
  await withMediaMocks(response, async ({ blobs }) => {
    const progress: number[] = [];
    await assert.rejects(loadSeekableVideo('/VIDEO.mp4', controller.signal, percent => {
      progress.push(percent);
      controller.abort();
    }), { name: 'AbortError' });
    assert.ok(progress.length > 0);
    assert.ok(!progress.includes(100));
    assert.equal(blobs.length, 0);
    assert.equal(response.body?.locked, false);
  });
});

test('HTML is rejected through the streamed progress path without creating an object URL', { concurrency: false }, async () => {
  const response = new Response('<html>fallback page</html>', { headers: { 'content-type': 'text/html' } });
  await withMediaMocks(response, async ({ blobs }) => {
    await assert.rejects(loadSeekableVideo('/VIDEO.mp4', new AbortController().signal, () => {}), /video file/i);
    assert.equal(blobs.length, 0);
    assert.equal(response.body?.locked, false);
  });
});

test('streamed video without a content length still reports completion and preserves bytes', { concurrency: false }, async () => {
  const response = new Response(new Blob(['unmetered-film'], { type: 'video/webm' }));
  await withMediaMocks(response, async ({ blobs }) => {
    const progress: number[] = [];
    await loadSeekableVideo('/VIDEO.webm', new AbortController().signal, percent => progress.push(percent));
    assert.equal(progress.at(-1), 100);
    assert.ok(progress.every(Number.isFinite));
    assert.equal(blobs[0].type, 'video/webm');
    assert.equal(await blobs[0].text(), 'unmetered-film');
  });
});

test('a valid range probe keeps the original URL and cancels its body without creating a Blob URL', { concurrency: false }, async () => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { canceled = true; } });
  const response = new Response(body, { status: 206, headers: { 'content-range': 'bytes 0-1/123456', 'content-type': 'video/mp4' } });
  const controller = new AbortController();
  await withMediaMocks(response, async ({ requests, blobs }) => {
    assert.equal(await selectVideoSource('/VIDEO.mp4', controller.signal), '/VIDEO.mp4');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].input, '/VIDEO.mp4');
    assert.equal(requests[0].init?.signal, controller.signal);
    assert.equal(requests[0].init?.cache, 'no-cache');
    assert.equal(new Headers(requests[0].init?.headers).get('range'), 'bytes=0-1');
    assert.equal(canceled, true);
    assert.equal(blobs.length, 0);
  });
});

test('a host ignoring Range reuses the same full response without a duplicate fetch', { concurrency: false }, async () => {
  const response = new Response(new Blob(['the-complete-film'], { type: 'video/mp4' }), { status: 200 });
  await withMediaMocks(response, async ({ requests, blobs }) => {
    const progress: number[] = [];
    assert.equal(await selectVideoSource('/VIDEO.mp4', new AbortController().signal, percent => progress.push(percent)), 'blob:test-film');
    assert.equal(requests.length, 1);
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].type, 'video/mp4');
    assert.equal(await blobs[0].text(), 'the-complete-film');
    assert.equal(progress.at(-1), 100);
    assert.equal(response.bodyUsed, true);
  });
});

test('malformed or mismatched 206 content ranges reject without a Blob URL', { concurrency: false }, async () => {
  for (const contentRange of [null, 'bytes 1-1/100', 'bytes 0-2/100', 'bytes 0-1/0', 'bytes 0-1/*', 'bytes 0-1/01', 'not-a-range']) {
    const headers = new Headers({ 'content-type': 'video/mp4' });
    if (contentRange !== null) headers.set('content-range', contentRange);
    await withMediaMocks(new Response('x', { status: 206, headers }), async ({ blobs, requests }) => {
      await assert.rejects(selectVideoSource('/VIDEO.mp4', new AbortController().signal));
      assert.equal(blobs.length, 0);
      assert.equal(requests.length, 1);
    });
  }
});

test('a failed range probe rejects HTTP 404 without retrying or creating a Blob URL', { concurrency: false }, async () => {
  await withMediaMocks(new Response('missing', { status: 404 }), async ({ requests, blobs }) => {
    await assert.rejects(selectVideoSource('/missing.mp4', new AbortController().signal), /404/);
    assert.equal(requests.length, 1);
    assert.equal(blobs.length, 0);
  });
});

test('a full HTML fallback is rejected by source selection', { concurrency: false }, async () => {
  const response = new Response('<html>fallback</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  await withMediaMocks(response, async ({ requests, blobs }) => {
    await assert.rejects(selectVideoSource('/VIDEO.mp4', new AbortController().signal, () => {}), /video file/i);
    assert.equal(requests.length, 1);
    assert.equal(blobs.length, 0);
  });
});

test('an aborted source selection cannot return a valid range URL', { concurrency: false }, async () => {
  const controller = new AbortController();
  controller.abort();
  const response = new Response('x', { status: 206, headers: { 'content-range': 'bytes 0-1/100' } });
  await withMediaMocks(response, async ({ blobs }) => {
    await assert.rejects(selectVideoSource('/VIDEO.mp4', controller.signal), { name: 'AbortError' });
    assert.equal(blobs.length, 0);
  });
});

test('aborting a full-response selection during reading creates no Blob URL', { concurrency: false }, async () => {
  const controller = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    start(reader) {
      reader.enqueue(new Uint8Array([1, 2]));
      reader.enqueue(new Uint8Array([3, 4]));
      reader.close();
    },
  });
  const response = new Response(stream, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '4' } });
  await withMediaMocks(response, async ({ blobs, requests }) => {
    await assert.rejects(selectVideoSource('/VIDEO.mp4', controller.signal, () => controller.abort()), { name: 'AbortError' });
    assert.equal(blobs.length, 0);
    assert.equal(requests.length, 1);
    assert.equal(response.body?.locked, false);
  });
});
