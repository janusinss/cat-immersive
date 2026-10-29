/** Native media time is the clock: no easing, seeking, or speed conversion. */
export function getPlaybackPosition(time: number, duration: number) {
  const progress = Number.isFinite(duration) && duration > 0 && Number.isFinite(time)
    ? Math.max(0, Math.min(1, time / duration)) : 0;
  const chapter = Math.min(19, Math.floor(progress * 20));
  return { progress, chapter, local: progress === 1 ? 1 : progress * 20 - chapter };
}
