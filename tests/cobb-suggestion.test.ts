/*
 * Tests de la proposition de repères sur une radio simulée.
 * Vérifie le recalage sur le bord visible et le cas où le contraste manque.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestCobbFromPixels } from '../src/cobb-suggestion.ts';
import { cobbAngle } from '../src/measurements.ts';

// Construit une fausse radio et des masques décalés pour tester le repérage des bords.
function sample() {
  const size = 160;
  const centers = [[89, 25], [78, 51], [70, 77], [78, 103], [89, 129]];
  const slopes = [0.4, 0.36, 0, -0.36, -0.4];
  const pixels = new Float32Array(size * size).fill(8);
  const probabilities = new Float32Array((centers.length + 1) * size * size);
  centers.forEach(([centerX, centerY], index) => {
    for (let x = centerX - 15; x <= centerX + 15; x++) {
      const edge = centerY + slopes[index] * (x - centerX);
      for (let y = Math.ceil(edge - 9); y <= Math.floor(edge + 9); y++) {
        pixels[y * size + x] = 130;
        // Le masque est décalé de 3 px vers le haut par rapport à la radio.
        probabilities[(index + 1) * size * size + (y - 3) * size + x] = 0.9;
      }
    }
  });
  const geometry = { width: size, height: size, left: 0, top: 0, side: size };
  const labels = ['background', ...centers.map((_, index) => `vertebra_t${index + 3}`)];
  const segmentation = { geometry, labels, probabilities, provider: 'wasm' as const };
  return { segmentation, image: { width: size, height: size, pixels } };
}

test('La proposition retrouve les bords visibles même si les masques sont décalés', () => {
  const { segmentation, image } = sample();
  const result = suggestCobbFromPixels(segmentation, image);
  assert.ok(result);
  assert.equal(result.upper, 'T4');
  assert.equal(result.lower, 'T6');
  const [a, b, c, d] = result.points;
  for (const { x, y } of [a, b]) assert.ok(Math.abs(y - (42 + 0.36 * (x - 78))) < 2);
  for (const { x, y } of [c, d]) assert.ok(Math.abs(y - (112 - 0.36 * (x - 78))) < 2);
  assert.ok(Math.abs(cobbAngle(result.points)! - 39.6) < 5);
});

test('Une radio sans contraste ne produit pas de faux traits à partir des seuls masques', () => {
  const { segmentation, image } = sample();
  image.pixels.fill(100);
  assert.equal(suggestCobbFromPixels(segmentation, image), null);
});
