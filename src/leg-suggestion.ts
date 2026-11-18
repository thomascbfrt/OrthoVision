/*
 * Estime les six repères à partir des zones de fémur et de tibia reconnues.
 * Les positions proposées sont approximatives et restent modifiables.
 */
import type { Segmentation } from './flexray.ts';
import type { Point } from './measurements.ts';

// Sépare les deux os en groupes de pixels voisins et ignore les petits fragments.
function pairedBones(prediction: Segmentation, label: string, size: number) {
  const index = prediction.labels.indexOf(label);
  if (index < 0) return [];
  const count = size * size;
  const remaining = Uint8Array.from(prediction.probabilities.subarray(index * count, (index + 1) * count), p => Number(p >= 0.5));
  const bones: Point[][] = [];
  for (let i = 0; i < count; i++) {
    if (!remaining[i]) continue;
    const queue = [i];
    const bone: Point[] = [];
    remaining[i] = 0;
    for (const pixel of queue) {
      const x = pixel % size;
      bone.push({ x, y: Math.floor(pixel / size) });
      for (const next of [x ? pixel - 1 : -1, x < size - 1 ? pixel + 1 : -1, pixel - size, pixel + size]) {
        if (!remaining[next]) continue;
        remaining[next] = 0;
        queue.push(next);
      }
    }
    if (bone.length >= 50) bones.push(bone);
  }
  return bones.sort((a, b) => b.length - a.length).slice(0, 2);
}

// Cherche le milieu d’une bande près d’une extrémité de l’os.
function end(bone: Point[], fraction: number): Point {
  const rows = bone.map(p => p.y);
  const top = Math.min(...rows);
  const height = Math.max(...rows) - top;
  const y = top + fraction * height;
  const band = bone.filter(p => Math.abs(p.y - y) <= Math.max(1, height * 0.015));
  const xs = band.map(p => p.x);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y };
}

// Associe chaque fémur au tibia du même côté et remet les points à la taille de la radio.
export function suggestLegs(prediction: Segmentation, width: number, height: number): Point[] | null {
  const { geometry: g } = prediction;
  const size = Math.sqrt(prediction.probabilities.length / prediction.labels.length);
  const thighs = pairedBones(prediction, 'femurs', size).map(b => ({ hip: end(b, 0.045), bottom: end(b, 0.98) }))
    .sort((a, b) => a.hip.x - b.hip.x);
  const shins = pairedBones(prediction, 'tibiae', size).map(b => ({ top: end(b, 0.025), ankle: end(b, 0.97) }))
    .sort((a, b) => a.ankle.x - b.ankle.x);
  if (thighs.length !== 2 || shins.length !== 2) return null;
  const points: Point[] = [];
  for (const [i, { hip, bottom }] of thighs.entries()) {
    const { top, ankle } = shins[i];
    const thighLength = bottom.y - hip.y;
    const shinLength = ankle.y - top.y;
    if (Math.min(thighLength, shinLength) < size * 0.14 ||
        Math.hypot(bottom.x - top.x, bottom.y - top.y) > Math.min(thighLength, shinLength) * 0.25) return null;
    for (const p of [hip, { x: (bottom.x + top.x) / 2, y: (bottom.y + top.y) / 2 }, ankle]) {
      const x = ((p.x + 0.5) * g.side / size - g.left) * width / g.width;
      const y = ((p.y + 0.5) * g.side / size - g.top) * height / g.height;
      if (!(x > 0 && x < width && y > 0 && y < height)) return null;
      points.push({ x, y });
    }
  }
  return points;
}
