import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSeekableVideo } from './seekable-video.ts';

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
