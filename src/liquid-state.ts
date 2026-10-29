export function getLiquidState(value: number, duration: number) {
  const time = Number.isFinite(value) ? Math.max(0, value) : 0;
  const progress = Number.isFinite(duration) && duration > 0 ? Math.min(1, time / duration) : 0;
  const pulse = Math.max(...[.285, .625, .775].map(center => Math.exp(-Math.pow((progress - center) / .035, 2))));
  return { time, progress, energy: .18 + .82 * pulse };
}
