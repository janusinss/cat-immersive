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
