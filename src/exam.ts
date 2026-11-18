/*
 * Données et fichiers d’un examen.
 * Prépare les exports et vérifie que les repères importés vont sur la bonne radio.
 */

import { legAngle, type Point } from './measurements.ts';

export interface ExamImage {
  name: string;
  width: number;
  height: number;
  sha256: string;
}

export type MeasurementMethod = 'manual' | 'assisted' | 'example';
export type Orientation = 'unknown' | 'right-first' | 'left-first';

// Regroupe les points et la mesure pour préparer un fichier JSON.
export function annotationData(image: ExamImage, points: readonly Point[], method: MeasurementMethod = 'manual', orientation: Orientation = 'unknown') {
  return {
    version: 2,
    image,
    orientation,
    points,
    measurement: {
      type: 'bilateral-leg-alignment',
      method,
      algorithm: 'neutral-zero-inward-positive',
      unit: 'degree',
      imageLeft: legAngle(points, 0),
      imageRight: legAngle(points, 1),
    },
  };
}

// Lit les repères et vérifie qu’ils appartiennent à la radio ouverte.
export function readAnnotation(text: string, image: ExamImage): { points: Point[]; method: MeasurementMethod; orientation: Orientation } {
  const data = JSON.parse(text);
  if (data?.version !== 2 || data.measurement?.type !== 'bilateral-leg-alignment' || !Array.isArray(data.points)) {
    throw new Error('Format de repères non reconnu.');
  }
  if (data.image?.sha256 !== image.sha256 || data.image.width !== image.width || data.image.height !== image.height) {
    throw new Error('Ces repères correspondent à une autre image.');
  }
  if (data.points.length > 6 || data.points.some((point: Point) =>
    !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
    point.x < 0 || point.x > image.width || point.y < 0 || point.y > image.height)) {
    throw new Error('Les coordonnées des repères sont invalides.');
  }
  return {
    points: data.points.map(({ x, y }: Point) => ({ x, y })),
    method: ['assisted', 'example'].includes(data.measurement.method) ? data.measurement.method : 'manual',
    orientation: ['right-first', 'left-first'].includes(data.orientation) ? data.orientation : 'unknown',
  };
}

// Calcule une empreinte qui permet de reconnaître le contenu d’un fichier.
export async function sha256Hex(bytes: BufferSource) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Calcule l’empreinte de la radio pour pouvoir retrouver ses repères.
export async function imageHash(file: Blob) {
  return sha256Hex(await file.arrayBuffer());
}

// Lance le téléchargement dans le navigateur et libère ensuite le lien temporaire.
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
