/*
 * Proposition de repères pour mesurer l’angle de Cobb.
 * Les masques repèrent les vertèbres. La radio sert à chercher leurs bords.
 */

import type { Segmentation } from './flexray.ts';
import type { Point } from './measurements.ts';

interface GrayImage {
  width: number;
  height: number;
  pixels: Float32Array;
}

interface Vertebra {
  name: string;
  level: number;
  center: Point;
  region: Point[];
  tilt: number;
}

export interface CobbSuggestion {
  points: Point[];
  upper: string;
  lower: string;
  checkEdges: boolean;
}

// Garde la plus grande zone de pixels reliés et écarte les petits groupes isolés.
function largestRegion(probabilities: Float32Array, size: number) {
  const visited = new Uint8Array(probabilities.length);
  const queue = new Int32Array(probabilities.length);
  let largest = new Int32Array(0);

  for (let pixel = 0; pixel < probabilities.length; pixel++) {
    if (visited[pixel] || !(probabilities[pixel] >= 0.5)) continue;
    queue[0] = pixel;
    visited[pixel] = 1;
    let count = 1;
    for (let head = 0; head < count; head++) {
      const i = queue[head];
      const x = i % size;
      const neighbors = [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, i - size, i + size];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= probabilities.length || visited[neighbor] || !(probabilities[neighbor] >= 0.5)) continue;
        visited[neighbor] = 1;
        queue[count++] = neighbor;
      }
    }
    if (count > largest.length) largest = queue.slice(0, count);
  }
  return largest;
}

// Repère le centre des vertèbres du thorax et du bas du dos, puis les range dans l’ordre.
function findVertebrae(segmentation: Segmentation, image: GrayImage) {
  const { probabilities, labels, geometry } = segmentation;
  const size = Math.sqrt(probabilities.length / labels.length);
  const channelSize = size * size;
  const vertebrae: Vertebra[] = [];

  labels.forEach((label, index) => {
    const match = /^vertebra_([tl])(\d+)$/.exec(label);
    if (!match) return;
    const region: Point[] = [];
    const component = largestRegion(probabilities.subarray(index * channelSize, (index + 1) * channelSize), size);
    for (const pixel of component) {
      // Ramener les centres des pixels du masque carré dans le repère de la radio.
      const x = ((pixel % size + 0.5) * geometry.side / size - geometry.left) * image.width / geometry.width;
      const y = ((Math.floor(pixel / size) + 0.5) * geometry.side / size - geometry.top) * image.height / geometry.height;
      if (x >= 0 && x < image.width && y >= 0 && y < image.height) region.push({ x, y });
    }
    if (region.length < channelSize * 0.001) return;
    const center = {
      x: region.reduce((sum, point) => sum + point.x, 0) / region.length,
      y: region.reduce((sum, point) => sum + point.y, 0) / region.length,
    };
    vertebrae.push({
      name: match[1].toUpperCase() + match[2],
      level: Number(match[2]) + (match[1] === 'l' ? 12 : 0),
      center,
      region,
      tilt: 0,
    });
  });

  return vertebrae.sort((a, b) => a.level - b.level);
}

// Estime l’inclinaison de chaque vertèbre à partir de ses deux voisines.
function lineCandidates(vertebrae: Vertebra[]) {
  return vertebrae.filter((vertebra, index) => {
    const previous = vertebrae[index - 1];
    const next = vertebrae[index + 1];
    // Une estimation d'orientation a besoin de deux voisines identifiées.
    if (!previous || !next || previous.level + 1 !== vertebra.level || next.level !== vertebra.level + 1) return false;
    const above = vertebra.center.y - previous.center.y;
    const below = next.center.y - vertebra.center.y;
    if (above <= 0 || below <= 0) return false;
    const first = Math.atan2(previous.center.x - vertebra.center.x, above);
    const second = Math.atan2(vertebra.center.x - next.center.x, below);
    vertebra.tilt = (first + second) / 2;
    return true;
  });
}

// Lit le niveau de gris d’un pixel, ou indique que le point sort de l’image.
function intensity(image: GrayImage, point: Point) {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  return image.pixels[y * image.width + x];
}

// Cherche un trait qui suit le bord supérieur ou inférieur de la vertèbre.
function fitEndplate(image: GrayImage, vertebra: Vertebra, edge: 'upper' | 'lower') {
  const { center, region, tilt } = vertebra;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const local = region.map(point => {
    const x = point.x - center.x;
    const y = point.y - center.y;
    return { x: x * cos + y * sin, y: -x * sin + y * cos };
  });
  const xLeft = Math.min(...local.map(point => point.x));
  const xRight = Math.max(...local.map(point => point.x));
  const width = xRight - xLeft;
  if (width < 8) return null;
  const start = xLeft + width * 0.17;
  const end = xRight - width * 0.17;
  const centralY = local.filter(point => point.x >= start && point.x <= end).map(point => point.y).sort((a, b) => a - b);
  if (!centralY.length) return null;
  const maskBorder = centralY[Math.floor((centralY.length - 1) * (edge === 'upper' ? 0.12 : 0.88))];
  const searchBand = Math.max(3, width * 0.22);
  const step = Math.max(1, width / 24);
  const gradientStep = Math.max(1, Math.min(3, width / 18));

  // Replace un point calculé autour de la vertèbre dans les coordonnées de la radio.
  function fromLocal(x: number, y: number): Point {
    return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos };
  }

  // Essaie plusieurs traits près du bord du masque.
  // Compare la luminosité de chaque côté du trait pour retrouver le bord sur la radio.
  let best: { slope: number; offset: number; score: number; contrast: number; support: number } | undefined;
  for (let slope = -0.45; slope <= 0.451; slope += 0.05) {
    for (let shift = -searchBand; shift <= searchBand; shift += step) {
      const offset = maskBorder + shift;
      let signed = 0;
      let strength = 0;
      let strong = 0;
      let samples = 0;
      for (let x = start; x <= end; x += step) {
        const y = offset + x * slope;
        const before = intensity(image, fromLocal(x, y - gradientStep));
        const after = intensity(image, fromLocal(x, y + gradientStep));
        if (before === null || after === null) continue;
        const gradient = Math.max(-32, Math.min(32, after - before));
        signed += gradient;
        strength += Math.abs(gradient);
        strong += Number(Math.abs(gradient) >= 5);
        samples++;
      }
      if (samples < 6) continue;
      const contrast = strength / samples;
      const support = strong / samples;
      if (contrast < 3 || support < 0.3) continue;
      const score = 0.6 * contrast + 0.4 * Math.abs(signed) / samples
        - 2 * Math.abs(shift) / searchBand - 2 * Math.abs(slope);
      if (!best || score > best.score) best = { slope, offset, score, contrast, support };
    }
  }

  if (!best) return null;
  const { slope, offset, contrast, support } = best;
  const points = [fromLocal(start, offset + start * slope), fromLocal(end, offset + end * slope)];
  if (points.some(point => intensity(image, point) === null)) return null;
  // Signale un trait incertain si le contraste est faible ou si le trait s’éloigne de l’inclinaison estimée.
  const weak = contrast < 6 || support < 0.55 || Math.abs(Math.atan(slope)) > Math.PI / 12;
  return { points, weak };
}

// Choisit deux vertèbres et renvoie quatre points si les deux bords sont repérés.
export function suggestCobbFromPixels(segmentation: Segmentation, image: GrayImage): CobbSuggestion | null {
  const candidates = lineCandidates(findVertebrae(segmentation, image));
  let pair: { upper: Vertebra; lower: Vertebra; difference: number } | undefined;
  for (const [index, upper] of candidates.entries()) {
    for (const lower of candidates.slice(index + 1)) {
      if (lower.level - upper.level < 2 || lower.center.y <= upper.center.y) continue;
      const difference = Math.abs(lower.tilt - upper.tilt);
      if (!pair || difference > pair.difference) pair = { upper, lower, difference };
    }
  }
  if (!pair) return null;
  const top = fitEndplate(image, pair.upper, 'upper');
  const bottom = fitEndplate(image, pair.lower, 'lower');
  if (!top || !bottom) return null;
  return {
    points: [...top.points, ...bottom.points],
    upper: pair.upper.name,
    lower: pair.lower.name,
    checkEdges: top.weak || bottom.weak,
  };
}

// Lit les pixels de la radio et remet les points proposés à sa taille d’origine.
export function suggestCobb(segmentation: Segmentation, image: HTMLImageElement): CobbSuggestion | null {
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  const width = canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const pixels = new Float32Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    const offset = 4 * i;
    pixels[i] = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
  }
  const suggestion = suggestCobbFromPixels(segmentation, { width, height, pixels });
  if (suggestion) {
    suggestion.points = suggestion.points.map(({ x, y }) => ({
      x: x * image.naturalWidth / width,
      y: y * image.naturalHeight / height,
    }));
  }
  return suggestion;
}
