/*
 * Mesure de l’alignement des deux jambes sur une radio de face.
 * Chaque groupe de trois points va de la hanche à la cheville.
 */
export interface Point { x: number; y: number }

// Renvoie l’écart à l’axe droit. Un angle positif indique un genou vers l’intérieur.
export function legAngle(points: readonly Point[], side: number): number | null {
  const [hip, knee, ankle] = points.slice(side * 3, side * 3 + 3);
  if (!ankle || hip.y >= knee.y || knee.y >= ankle.y) return null;
  const thigh = Math.atan2(knee.x - hip.x, knee.y - hip.y);
  const shin = Math.atan2(ankle.x - knee.x, ankle.y - knee.y);
  return (thigh - shin) * (side === 0 ? 1 : -1) * 180 / Math.PI;
}

// Affiche l’amplitude et le sens de la déviation à un dixième de degré.
export function describe(angle: number | null) {
  if (angle === null) return '—';
  const value = Math.abs(angle).toFixed(1).replace('.', ',');
  if (value === '0,0') return '0,0° (aligné)';
  return value + (angle > 0 ? '° vers l’intérieur (X)' : '° vers l’extérieur (O)');
}
