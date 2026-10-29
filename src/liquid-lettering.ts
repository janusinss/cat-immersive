/** A bounded travelling wave that resolves to ordinary, undistorted lettering. */
export function liquidLetterPose(index: number, count: number, mobile = false) {
  const phase = count > 1 ? index / (count - 1) : .5;
  const wave = Math.sin(phase * Math.PI * 2);
  const strength = mobile ? .5 : 1;
  return {
    yPercent: wave * 33 * strength,
    rotation: wave * -9 * strength,
    skewX: Math.cos(phase * Math.PI * 2) * 12 * strength,
    scaleX: 1 + Math.abs(wave) * .16 * strength,
    scaleY: 1 - Math.abs(wave) * .28 * strength,
  };
}
