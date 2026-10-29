export function getTimeline(value: number, duration: number) {
  const progress = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const chapter = Math.min(19, Math.floor(progress * 20));
  const local = progress === 1 ? 1 : progress * 20 - chapter;
  // Ease into and out of each shot without intercepting wheel or touch input.
  const eased = local * local * (3 - 2 * local);
  const length = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 0.05) : 0;
  return { progress, time: (chapter + eased) / 20 * length, chapter, local };
}
