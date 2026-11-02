import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';

const bytes = crypto.getRandomValues(new Uint8Array(257));
const filmPaths = ['/media/film-mobile-v2.mp4', '/media/film.mp4'];

function assetsFixture(responseFactory) {
  const calls = [];
  const env = { ASSETS: { fetch: async (request) => {
    calls.push(request);
    return responseFactory ? responseFactory() : new Response(bytes.slice(), { headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } });
  } } };
  return { calls, env };
}

async function bodyBytes(response) {
  return new Uint8Array(await response.arrayBuffer());
}

test('both allowed film paths return the complete video with byte-range support', async () => {
  for (const path of filmPaths) {
    const { env, calls } = assetsFixture();
    const response = await worker.fetch(new Request(`https://film.test${path}`), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'video/mp4');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-length'), String(bytes.length));
    assert.deepEqual(await bodyBytes(response), bytes);
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, path.replace('/media/', '/'));
  }
});

test('a bounded byte range returns an exact slice and strips range and conditional source headers', async () => {
  const { env, calls } = assetsFixture();
  const response = await worker.fetch(new Request('https://film.test/media/film.mp4', {
    headers: { Range: 'bytes=5-17', 'If-Range': '"etag"', 'If-None-Match': '"etag"', 'If-Match': '"etag"', 'If-Modified-Since': 'Mon, 01 Jan 2024 00:00:00 GMT', 'If-Unmodified-Since': 'Mon, 01 Jan 2024 00:00:00 GMT' },
  }), env);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), `bytes 5-17/${bytes.length}`);
  assert.equal(response.headers.get('content-length'), '13');
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
  assert.deepEqual(await bodyBytes(response), bytes.slice(5, 18));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  for (const header of ['range', 'if-range', 'if-none-match', 'if-match', 'if-modified-since', 'if-unmodified-since']) {
    assert.equal(calls[0].headers.has(header), false, `${header} must not reach the raw asset request`);
  }
});

test('suffix, open-ended, and oversized end ranges produce the correct slices', async () => {
  for (const [range, start, end] of [['bytes=-7', 250, 256], ['bytes=250-', 250, 256], ['bytes=250-999', 250, 256], ['bytes=-999', 0, 256]]) {
    const { env } = assetsFixture();
    const response = await worker.fetch(new Request('https://film.test/media/film.mp4', { headers: { Range: range } }), env);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
    assert.equal(response.headers.get('content-length'), String(end - start + 1));
    assert.deepEqual(await bodyBytes(response), bytes.slice(start, end + 1));
  }
});

test('HEAD returns full response metadata with no body and fetches the source as GET', async () => {
  const { env, calls } = assetsFixture();
  const response = await worker.fetch(new Request('https://film.test/media/film.mp4', { method: 'HEAD' }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-length'), String(bytes.length));
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
  assert.equal((await bodyBytes(response)).length, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});

test('invalid, unsatisfiable, and multiple ranges return 416 with the complete size', async () => {
  for (const range of ['bytes=257-', 'bytes=20-10', 'bytes=-0', 'bytes=abc', 'bytes=0-1,4-5', 'items=0-1', 'bytes=-']) {
    const { env } = assetsFixture();
    const response = await worker.fetch(new Request('https://film.test/media/film.mp4', { headers: { Range: range } }), env);
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`, range);
  }
});

test('unsupported media paths return 404 without fetching any asset', async () => {
  for (const path of ['/media/unknown.mp4', '/media/film-mobile.mp4', '/media/film.mp4/extra']) {
    const { env, calls } = assetsFixture();
    assert.equal((await worker.fetch(new Request(`https://film.test${path}`), env)).status, 404);
    assert.equal(calls.length, 0);
  }
});

test('unsupported film methods return 405 without fetching any asset', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const { env, calls } = assetsFixture();
    assert.equal((await worker.fetch(new Request('https://film.test/media/film.mp4', { method }), env)).status, 405);
    assert.equal(calls.length, 0);
  }
});

test('nonmedia routes pass through ASSETS without rewriting the response', async () => {
  const source = new Response('app-shell', { status: 200, headers: { 'content-type': 'text/html', 'x-asset': 'unchanged' } });
  const { env, calls } = assetsFixture(() => source);
  const request = new Request('https://film.test/about?preview=1');
  const response = await worker.fetch(request, env);
  assert.equal(response, source);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, request.url);
  assert.equal(await response.text(), 'app-shell');
});

test('unexpected source status, nonvideo type, and oversized film responses return 502', async () => {
  const invalidSources = [
    () => new Response(bytes.slice(), { status: 206, headers: { 'content-type': 'video/mp4' } }),
    () => new Response('missing', { status: 404 }),
    () => new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response(new Uint8Array(0), { headers: { 'content-type': 'video/mp4' } }),
    () => new Response(new Uint8Array(20 * 1024 * 1024 + 1), { headers: { 'content-type': 'video/mp4', 'content-length': String(20 * 1024 * 1024 + 1) } }),
    () => new Response(new Uint8Array(20 * 1024 * 1024 + 1), { headers: { 'content-type': 'video/mp4' } }),
  ];
  for (const factory of invalidSources) {
    const { env } = assetsFixture(factory);
    const response = await worker.fetch(new Request('https://film.test/media/film.mp4'), env);
    assert.equal(response.status, 502);
  }
});
