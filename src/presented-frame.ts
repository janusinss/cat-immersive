/** Read the frame the browser has actually presented, not a pending seek target. */
export function watchPresentedFrames(media: HTMLVideoElement, onFrame: (time: number) => void) {
  let active = true;
  let handle: number | null = null;
  const supported = typeof media.requestVideoFrameCallback === 'function' && typeof media.cancelVideoFrameCallback === 'function';
  const frame: VideoFrameRequestCallback = (_now, metadata) => {
    if (!active) return;
    onFrame(metadata.mediaTime);
    handle = media.requestVideoFrameCallback(frame);
  };
  const fallback = () => { if (active && !media.seeking) onFrame(media.currentTime); };
  if (supported) handle = media.requestVideoFrameCallback(frame);
  else { media.addEventListener('seeked', fallback); media.addEventListener('timeupdate', fallback); media.addEventListener('loadeddata', fallback); }
  return () => {
    active = false;
    if (handle !== null) media.cancelVideoFrameCallback(handle);
    media.removeEventListener('seeked', fallback);
    media.removeEventListener('timeupdate', fallback);
    media.removeEventListener('loadeddata', fallback);
  };
}
