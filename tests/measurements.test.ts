import assert from 'node:assert/strict';
import test from 'node:test';
import { cobbAngle } from '../src/measurements.ts';
import { annotationData, readAnnotation } from '../src/exam.ts';

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

test('Cobb : 110° est conservé même si les points sont placés de droite à gauche', () => {
  const slope = Math.tan(55 * Math.PI / 180);
  const first = [{ x: 0, y: 4 }, { x: 1, y: 4 - slope }];
  const second = [{ x: 1, y: 8 + slope }, { x: 0, y: 8 }];
  assert.ok(Math.abs(cobbAngle([...first, ...second])! - 110) < 1e-10);
});

test('Les repères conservent leurs coordonnées et sont liés aux octets de l’image', () => {
  const image = { name: 'radio.jpg', width: 200, height: 300, sha256: 'sample' };
  const points = [a, b, c, d];
  const data = annotationData(image, points, 'assisted');
  assert.deepEqual(readAnnotation(JSON.stringify(data), image), { points, method: 'assisted' });
  const legacy = { ...data, measurement: { ...data.measurement, method: 'manual', algorithm: 'acute-line-angle-v1' } };
  assert.deepEqual(readAnnotation(JSON.stringify(legacy), image), { points, method: 'manual' });
  assert.throws(() => readAnnotation(JSON.stringify(data), { ...image, sha256: 'other' }), /autre image/);
  assert.throws(() => readAnnotation(JSON.stringify({ ...data, points: [{ x: -1, y: 0 }] }), image), /invalides/);
});
