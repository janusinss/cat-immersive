// Native media decoders need honest byte ranges, including on a cold Pages cache.
const files = new Set(['film.mp4', 'film-mobile-v2.mp4']);
const maxBytes = 20 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/media/')) return env.ASSETS.fetch(request);
    const file = url.pathname.slice('/media/'.length);
    if (!files.has(file)) return new Response('Not found', { status: 404 });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });

    const assetUrl = new URL(`/${file}`, url.origin);
    // Never forward Range or conditional headers: the function slices the complete asset.
    const asset = await env.ASSETS.fetch(new Request(assetUrl, { method: 'GET' }));
    if (asset.status !== 200 || !asset.headers.get('content-type')?.startsWith('video/') || Number(asset.headers.get('content-length')) > maxBytes) {
      await asset.body?.cancel();
      return new Response('Video unavailable', { status: 502 });
    }
    const bytes = await asset.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > maxBytes) return new Response('Video unavailable', { status: 502 });
    const size = bytes.byteLength;
    const headers = new Headers({
      'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff',
      'Content-Length': String(size),
    });
    // HEAD describes the complete representation; its Range header is ignored.
    if (request.method === 'HEAD') return new Response(null, { headers });
    const range = request.headers.get('range');
    if (!range) return new Response(bytes, { headers });
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = 0;
    let end = size - 1;
    if (match && (match[1] || match[2])) {
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    }
    if (!match || (!match[1] && !match[2]) || (!match[1] && Number(match[2]) === 0) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
      headers.set('Content-Range', `bytes */${size}`);
      headers.set('Content-Length', '0');
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(bytes.slice(start, end + 1), { status: 206, headers });
  },
};
