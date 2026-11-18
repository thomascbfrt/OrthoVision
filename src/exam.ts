import { cobbAngle, type Point } from './measurements.ts';

export interface ExamImage {
  name: string;
  width: number;
  height: number;
  sha256: string;
}

export type MeasurementMethod = 'manual' | 'assisted';

export function annotationData(image: ExamImage, points: readonly Point[], method: MeasurementMethod = 'manual') {
  return {
    version: 1,
    image,
    points,
    measurement: {
      type: 'cobb',
      method,
      algorithm: 'left-to-right-angle-v2',
      unit: 'degree',
      value: cobbAngle(points),
    },
  };
}

export function readAnnotation(text: string, image: ExamImage): { points: Point[]; method: MeasurementMethod } {
  const data = JSON.parse(text);
  if (data?.version !== 1 || data.measurement?.type !== 'cobb' || !Array.isArray(data.points)) {
    throw new Error('Format de repères non reconnu.');
  }
  if (data.image?.sha256 !== image.sha256 || data.image.width !== image.width || data.image.height !== image.height) {
    throw new Error('Ces repères correspondent à une autre image.');
  }
  if (data.points.length > 4 || data.points.some((point: Point) =>
    !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
    point.x < 0 || point.x > image.width || point.y < 0 || point.y > image.height)) {
    throw new Error('Les coordonnées des repères sont invalides.');
  }
  return {
    points: data.points.map(({ x, y }: Point) => ({ x, y })),
    method: data.measurement.method === 'assisted' ? 'assisted' : 'manual',
  };
}

export async function sha256Hex(bytes: BufferSource) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function imageHash(file: Blob) {
  return sha256Hex(await file.arrayBuffer());
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
