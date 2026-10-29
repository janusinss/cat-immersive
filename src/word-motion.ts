export const wordMotion = [
  'title', 'gather', 'hinge', 'crosswind', 'duck', 'lift', 'float', 'breathe',
  'crosswind', 'slip', 'land', 'gather', 'fall', 'ripple', 'hinge', 'lift',
  'land', 'float', 'breathe', 'resolve',
] as const;

export function wordPose(kind: typeof wordMotion[number], index: number, count: number, mobile = false) {
  const side = index % 2 ? -1 : 1;
  const centered = count > 1 ? (index / (count - 1) - .5) * 2 : 0;
  const distance = mobile ? .65 : 1;
  const base = { x: 0, yPercent: 60, rotation: 0, rotationX: 0, rotationY: 0, scale: 1, opacity: 0 };
  switch (kind) {
    case 'title': return { ...base, yPercent: 0, opacity: 1 };
    case 'gather': return { ...base, x: centered * 50 * distance, yPercent: 28, rotation: centered * 5, scale: .92 };
    case 'hinge': return { ...base, yPercent: 65, rotationX: -68, rotation: side * 3 };
    case 'crosswind': return { ...base, x: side * 65 * distance, yPercent: side * 22, rotation: side * 7 };
    case 'duck': return { ...base, yPercent: -40, rotationX: 48, scale: 1.07 };
    case 'lift': return { ...base, yPercent: 100 + index * 8, x: centered * 18 * distance, rotation: centered * 12, scale: .86 };
    case 'float': return { ...base, x: side * 26 * distance, yPercent: 20, rotation: side * 4, scale: .96 };
    case 'breathe': return { ...base, yPercent: 10, scale: 1.12 };
    case 'slip': return { ...base, x: -58 * distance, yPercent: 0, rotationY: 24 };
    case 'land': return { ...base, yPercent: -85, rotation: side * 5, scale: 1.09 };
    case 'fall': return { ...base, x: centered * 28 * distance, yPercent: -110, rotation: centered * 18, scale: .9 };
    case 'ripple': return { ...base, yPercent: 48, rotationX: side * 38, scale: .96 };
    case 'resolve': return { ...base, x: centered * 65 * distance, yPercent: 40, rotationY: centered * -28, scale: 1.18 };
  }
}
