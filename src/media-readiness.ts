/** Metadata permits seeking and a user-initiated play even when mobile defers loadeddata. */
export function watchMediaReadiness(
  media: HTMLVideoElement,
  onReady: () => void,
  onStalled: () => void,
  timeoutMs = 30_000,
) {
  let settled = false;
  const events = ['loadedmetadata', 'durationchange', 'canplay', 'loadeddata'];
  const cleanup = () => {
    clearTimeout(timer);
    events.forEach(event => media.removeEventListener(event, check));
    media.removeEventListener('error', fail);
    settled = true;
  };
  const finish = (callback: () => void) => {
    if (settled) return;
    cleanup();
    callback();
  };
  const check = () => {
    if (media.readyState >= 1 && Number.isFinite(media.duration) && media.duration > 0) finish(onReady);
  };
  const fail = () => finish(onStalled);
  const timer = setTimeout(fail, timeoutMs);
  events.forEach(event => media.addEventListener(event, check));
  media.addEventListener('error', fail);
  check();
  return cleanup;
}
