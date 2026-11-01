/** Local Blob URLs remain seekable when a static host ignores HTTP Range requests. */
export async function loadSeekableVideo(source: string, signal: AbortSignal, onProgress?: (percent: number) => void): Promise<string> {
  const response = await fetch(source, { signal, cache: 'force-cache' });
  if (!response.ok) throw new Error(`Video request failed (${response.status}).`);
  let blob: Blob;
  if (onProgress && response.body) {
    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    const total = Number(response.headers.get('content-length'));
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (signal.aborted) throw new DOMException('Video loading cancelled.', 'AbortError');
        chunks.push(value);
        received += value.byteLength;
        if (total > 0) onProgress(Math.min(99, Math.floor(received / total * 100)));
      }
    } finally { reader.releaseLock(); }
    blob = new Blob(chunks, { type: response.headers.get('content-type') || 'video/mp4' });
    onProgress(100);
  } else blob = await response.blob();
  if (signal.aborted) throw new DOMException('Video loading cancelled.', 'AbortError');
  if (!blob.size || (blob.type && !blob.type.startsWith('video/') && blob.type !== 'application/octet-stream')) {
    throw new Error('The server did not return a video file.');
  }
  return URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'video/mp4' }));
}
