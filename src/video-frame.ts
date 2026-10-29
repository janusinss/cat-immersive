/** Seek to a real source frame, rather than repeatedly decoding fractional times. */
export function getFrameTime(time: number, duration: number, fps = 24) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 24;
  const safeTime = Number.isFinite(time) ? Math.max(0, Math.min(duration, time)) : 0;
  const lastFrame = Math.floor(Math.max(0, duration - 0.001) * rate);
  return Math.min(lastFrame, Math.round(safeTime * rate)) / rate;
}
