/*
 * Calcul de l’angle de Cobb.
 * Les calculs utilisent les coordonnées des repères, indépendamment du zoom.
 */

export interface Point {
  x: number;
  y: number;
}

// Calcule l’écart en degrés entre les deux traits formés par les quatre points.
export function cobbAngle(points: readonly Point[]): number | null {
  if (points.length !== 4) return null;

  const [a, b, c, d] = points;
  // Oriente toujours le trait dans le même sens, même si les points ont été posés à l’envers.
  function orientation(from: Point, to: Point) {
    const x = to.x - from.x;
    const y = to.y - from.y;
    if (!x && !y) return null;
    const sign = x < 0 || (x === 0 && y < 0) ? -1 : 1;
    return Math.atan2(y * sign, x * sign);
  }
  const upper = orientation(a, b);
  const lower = orientation(c, d);
  if (upper === null || lower === null) return null;
  return Math.abs(lower - upper) * 180 / Math.PI;
}

// Affiche un angle avec une décimale et une virgule.
export function formatAngle(angle: number): string {
  return `${angle.toFixed(1).replace('.', ',')}°`;
}
