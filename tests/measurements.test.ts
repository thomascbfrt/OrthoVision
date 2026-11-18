/*
 * Vérifie le sens des angles pour deux jambes en miroir.
 * Les repères exportés gardent leur ordre, leur côté et leur image.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { legAngle } from '../src/measurements.ts';
import { annotationData, readAnnotation } from '../src/exam.ts';

const points = [{ x: 10, y: 0 }, { x: 20, y: 10 }, { x: 20, y: 20 },
  { x: 60, y: 0 }, { x: 50, y: 10 }, { x: 50, y: 20 }];

test('Deux genoux en X donnent le même angle positif', () => {
  assert.equal(legAngle(points, 0), 45);
  assert.equal(legAngle(points, 1), 45);
});

test('Un genou en O donne un angle négatif et une jambe droite donne zéro', () => {
  assert.equal(legAngle([{ x: 30, y: 0 }, ...points.slice(1)], 0), -45);
  assert.equal(legAngle([{ x: 20, y: 0 }, ...points.slice(1)], 0), 0);
  assert.equal(legAngle(points.slice(0, 5), 1), null);
  assert.equal(legAngle([points[1], points[1], points[2]], 0), null);
});

test('Les six points et le côté sont liés à la radio et au type de mesure', () => {
  const image = { name: 'radio.jpg', width: 80, height: 30, sha256: 'sample' };
  const data = annotationData(image, points, 'assisted', 'right-first');
  assert.deepEqual(readAnnotation(JSON.stringify(data), image), { points, method: 'assisted', orientation: 'right-first' });
  assert.throws(() => readAnnotation(JSON.stringify(data), { ...image, sha256: 'other' }), /autre image/);
  assert.throws(() => readAnnotation(JSON.stringify({ ...data, version: 1 }), image), /non reconnu/);
});
