/** Local Blob URLs remain seekable when a static host ignores HTTP Range requests. */
export async function loadSeekableVideo(source: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(source, { signal, cache: 'force-cache' });
  if (!response.ok) throw new Error(`Video request failed (${response.status}).`);
  const blob = await response.blob();
  if (signal.aborted) throw new DOMException('Video loading cancelled.', 'AbortError');
  if (!blob.size || (blob.type && !blob.type.startsWith('video/') && blob.type !== 'application/octet-stream')) {
    throw new Error('The server did not return a video file.');
  }
  return URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'video/mp4' }));
}
