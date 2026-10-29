export type WordEffect = 'ribbon' | 'rise' | 'sink' | 'fracture' | 'hinge' | 'breathe' | 'gravity' | 'impact' | 'sweep' | 'unfold' | 'resolve' | 'orbit' | 'gather';
export function wordEffect(text: string): WordEffect {
  const word = text.replace(/[^a-z]/gi, '').toUpperCase();
  if (['WATER', 'REEDS', 'RIVER'].includes(word)) return 'ribbon';
  if (['UP', 'ABOVE', 'LEAP'].includes(word)) return 'rise';
  if (['LOW', 'STAY'].includes(word)) return 'sink';
  if (['LINES', 'STRAIGHT', 'BREAKS'].includes(word)) return 'fracture';
  if (['ALONE', 'NOT'].includes(word)) return 'orbit';
  if (['BREATHE', 'STILLNESS', 'STILL'].includes(word)) return 'breathe';
  if (['GO', 'LET', 'OUT'].includes(word)) return 'gravity';
  if (['LANDING', 'PAWS', 'STANDING'].includes(word)) return 'impact';
  if (['ACROSS', 'REACH'].includes(word)) return 'sweep';
  if (['OPEN', 'GAP', 'FIND'].includes(word)) return 'unfold';
  if (['ONWARD'].includes(word)) return 'resolve';
  if (['CLOSE', 'TOO'].includes(word)) return 'hinge';
  return 'gather';
}

export function overdrivePose(effect: WordEffect, index: number, count: number, mobile = false) {
  const side = index % 2 ? -1 : 1;
  const strength = mobile ? .55 : 1;
  const center = count > 1 ? index / (count - 1) * 2 - 1 : 0;
  const base = { x: 0, yPercent: 0, rotation: 0, rotationX: 0, rotationY: 0, scaleX: 1, scaleY: 1, skewX: 0, opacity: 0 };
  switch (effect) {
    case 'ribbon': return { ...base, yPercent: 40, scaleX: 1 + .3 * strength, scaleY: 1 - .5 * strength, skewX: side * 15 * strength };
    case 'rise': return { ...base, yPercent: 125 * strength, rotation: side * -9 * strength, scaleX: .8, scaleY: 1.2 };
    case 'sink': return { ...base, yPercent: -45 * strength, scaleX: 1.12, scaleY: .28, rotationX: 35 * strength };
    case 'fracture': return { ...base, x: side * 65 * strength, rotation: side * 5 * strength };
    case 'hinge': return { ...base, yPercent: 35, rotationX: -75 * strength, scaleY: .8 };
    case 'breathe': return { ...base, scaleX: 1.2, scaleY: 1.2 };
    case 'gravity': return { ...base, yPercent: -115 * strength, rotation: center * 16 * strength, scaleX: .92, scaleY: 1.05 };
    case 'impact': return { ...base, yPercent: -80 * strength, scaleX: .88, scaleY: 1.22 };
    case 'sweep': return { ...base, x: -100 * strength, skewX: 16 * strength };
    case 'unfold': return { ...base, scaleX: .15, rotationY: side * 60 * strength };
    case 'resolve': return { ...base, x: center * 55 * strength, rotationY: center * -40 * strength, scaleX: 1.1, scaleY: 1.1 };
    case 'orbit': return { ...base, x: side * 24 * strength, rotationY: side * 78 * strength, rotation: side * 6 * strength };
    default: return { ...base, yPercent: 30, x: side * 18 * strength, scaleX: .95, scaleY: .95 };
  }
}

export function glyphPose(effect: WordEffect, index: number, count: number, mobile = false) {
  const center = count > 1 ? index / (count - 1) * 2 - 1 : 0;
  const side = index % 2 ? -1 : 1;
  const s = mobile ? .5 : 1;
  const base = { x: 0, yPercent: 0, rotation: 0, rotationY: 0, skewX: 0, scaleX: 1, scaleY: 1 };
  switch (effect) {
    case 'fracture': return { ...base, x: center * 18 * s, yPercent: side * 36 * s, rotation: side * 9 * s };
    case 'rise': return { ...base, yPercent: (1 - center * center) * 38 * s, rotation: center * 12 * s };
    case 'gravity': return { ...base, yPercent: center * 35 * s, rotation: center * 14 * s };
    case 'unfold': return { ...base, rotationY: center * 60 * s, scaleX: .7 };
    case 'impact': return { ...base, yPercent: side * 12 * s, scaleY: 1.15 };
    case 'orbit': return { ...base, yPercent: Math.sin(center * Math.PI) * 20 * s, rotationY: center * 35 * s };
    case 'resolve': return { ...base, x: center * 12 * s, scaleX: .88, scaleY: .88 };
    default: return base;
  }
}
