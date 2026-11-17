export interface Point {
  x: number;
  y: number;
}

export function cobbAngle(points: readonly Point[]): number | null {
  if (points.length !== 4) return null;

  const [a, b, c, d] = points;
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = d.x - c.x;
  const vy = d.y - c.y;
  if ((!ux && !uy) || (!vx && !vy)) return null;

  // La valeur absolue du produit scalaire rend l'angle indépendant du sens des deux droites.
  const cross = ux * vy - uy * vx;
  const dot = ux * vx + uy * vy;
  return Math.atan2(Math.abs(cross), Math.abs(dot)) * 180 / Math.PI;
}

export function formatAngle(angle: number): string {
  return `${angle.toFixed(1).replace('.', ',')}°`;
}
