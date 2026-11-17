import assert from 'node:assert/strict';
import test from 'node:test';
import { cobbAngle } from '../src/measurements.ts';
import { annotationData, readPoints } from '../src/exam.ts';

const a = { x: 0, y: 0 };
const b = { x: 20, y: 0 };
const c = { x: 3, y: 4 };
const d = { x: 3 + Math.sqrt(3), y: 5 };

test('Cobb : parallèles, 30°, 90° et ordre inversé', () => {
  assert.equal(cobbAngle([a, b, c, { x: 8, y: 4 }]), 0);
  assert.ok(Math.abs(cobbAngle([a, b, c, d])! - 30) < 1e-10);
  assert.ok(Math.abs(cobbAngle([b, a, d, c])! - 30) < 1e-10);
  assert.equal(cobbAngle([a, b, c, { x: 3, y: 9 }]), 90);
});

test('Cobb : repères incomplets ou confondus', () => {
  assert.equal(cobbAngle([a, b, c]), null);
  assert.equal(cobbAngle([a, a, c, d]), null);
});

test('Les repères conservent leurs coordonnées et sont liés aux octets de l’image', () => {
  const image = { name: 'radio.jpg', width: 200, height: 300, sha256: 'sample' };
  const points = [a, b, c, d];
  const data = annotationData(image, points);
  assert.deepEqual(readPoints(JSON.stringify(data), image), points);
  assert.throws(() => readPoints(JSON.stringify(data), { ...image, sha256: 'other' }), /autre image/);
  assert.throws(() => readPoints(JSON.stringify({ ...data, points: [{ x: -1, y: 0 }] }), image), /invalides/);
});
