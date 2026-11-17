import type { InferenceSession } from 'onnxruntime-web';
import { sha256Hex } from './exam.ts';

const size = 256;
const pixels = size * size;
const model = 'https://huggingface.co/VictorButoi/flexray/resolve/b3d892015a51848f675739107f697c8e7ea709f4/members/flux0375';
const modelUrl = `${model}/onnx/flexray-flux0375-256-fp16.onnx`;
const modelBytes = 203297320;
const checksum = 'b8eb8851121cc694f9b529f2cd46f4f1bda29fcbb0eada7b1512af0d57462f15';

type Runtime = typeof import('onnxruntime-web/webgpu');
type Provider = 'webgpu' | 'wasm';
interface Geometry { width: number; height: number; left: number; top: number; side: number }
export interface Segmentation {
  geometry: Geometry;
  probabilities: Float32Array;
  labels: string[];
  provider: Provider;
}

let runtime: Runtime;
let cachedModel: Promise<{ bytes: Uint8Array; labels: string[] }> | undefined;
let session: InferenceSession | undefined;
let provider: Provider | undefined;

async function fetchModel(status: (message: string) => void) {
  const [response, schema] = await Promise.all([
    fetch(modelUrl),
    fetch(`${model}/label_schema.json`),
  ]);
  if (!response.ok || !response.body || !schema.ok) throw new Error('Téléchargement de FleXray impossible.');
  const { label_names: labels } = await schema.json();
  if (!Array.isArray(labels) || labels.length !== 61 || labels[0] !== 'background') {
    throw new Error('Schéma de segmentation inattendu.');
  }

  const bytes = new Uint8Array(modelBytes);
  const reader = response.body.getReader();
  let offset = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.length > bytes.length) throw new Error('Taille du modèle inattendue.');
      bytes.set(value, offset);
      offset += value.length;
      status(`Téléchargement de FleXray : ${Math.floor(100 * offset / modelBytes)} %`);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  if (offset !== modelBytes || await sha256Hex(bytes) !== checksum) {
    throw new Error('Le modèle téléchargé est incomplet ou corrompu.');
  }
  return { bytes, labels: labels as string[] };
}

// Filtre bilinéaire séparable de la démo FleXray. À la réduction, le filtre
// couvre plusieurs pixels source pour éviter de perdre les détails fins.
function resample(source: Float32Array, width: number, height: number, outWidth: number) {
  const result = new Float32Array(outWidth * height);
  const scale = width / outWidth;
  const support = Math.max(scale, 1);
  for (let x = 0; x < outWidth; x++) {
    const center = (x + 0.5) * scale - 0.5;
    const start = Math.max(0, Math.ceil(center - support));
    const stop = Math.min(width - 1, Math.floor(center + support));
    const weights = [];
    let total = 0;
    for (let sx = start; sx <= stop; sx++) {
      const weight = Math.max(0, 1 - Math.abs(sx - center) / support);
      weights.push(weight);
      total += weight;
    }
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let sx = start; sx <= stop; sx++) sum += source[y * width + sx] * weights[sx - start];
      result[y * outWidth + x] = sum / total;
    }
  }
  return result;
}

function transpose(source: Float32Array, width: number, height: number) {
  const result = new Float32Array(source.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) result[x * height + y] = source[y * width + x];
  }
  return result;
}

function prepareImage(image: HTMLImageElement) {
  const scale = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const side = Math.max(width, height);
  const left = Math.floor((side - width) / 2);
  const top = Math.floor((side - height) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Float32Array(side * side);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      gray[(y + top) * side + x + left] =
        (0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]) / 255;
    }
  }

  const rows = transpose(resample(gray, side, side, size), size, side);
  const input = transpose(resample(rows, side, size, size), size, size);
  const sorted = input.slice().sort();
  function percentile(fraction: number) {
    const index = fraction * (pixels - 1);
    const lower = Math.floor(index);
    return sorted[lower] + (index - lower) * (sorted[lower + 1] - sorted[lower]);
  }
  const low = percentile(0.005);
  const high = percentile(0.995);
  const range = Math.max(high - low, 1e-8);
  for (let i = 0; i < pixels; i++) input[i] = Math.max(0, Math.min(1, (input[i] - low) / range));
  return { input, geometry: { width, height, side, left, top } };
}

export async function segmentImage(image: HTMLImageElement, status: (message: string) => void): Promise<Segmentation> {
  status('Chargement de FleXray (environ 203 Mo au premier usage)…');
  runtime ??= await import('onnxruntime-web/webgpu');
  runtime.env.wasm.numThreads = 1;
  cachedModel ??= fetchModel(status).catch(error => { cachedModel = undefined; throw error; });
  const { bytes, labels } = await cachedModel;
  const { input, geometry } = prepareImage(image);
  const tensor = new runtime.Tensor('float32', input, [1, 1, size, size]);
  const providers: Provider[] = (navigator as Navigator & { gpu?: object }).gpu && provider !== 'wasm' ? ['webgpu', 'wasm'] : ['wasm'];
  let lastError: unknown;

  for (const backend of providers) {
    status(`Segmentation locale : ${backend === 'webgpu' ? 'WebGPU' : 'WebAssembly'}…`);
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      session ??= await runtime.InferenceSession.create(bytes, { executionProviders: [backend] });
      const result = await session.run({ input: tensor });
      const output = result.probabilities;
      if (!output || output.dims.join(',') !== '1,61,256,256' || !(output.data instanceof Float32Array)) {
        throw new Error('Sortie du modèle inattendue.');
      }
      provider = backend;
      return { geometry, probabilities: output.data, labels, provider };
    } catch (error) {
      lastError = error;
      await session?.release().catch(() => {});
      session = undefined;
    }
  }
  throw new Error('Ce navigateur n’a pas pu exécuter FleXray.', { cause: lastError });
}

export function drawMask(segmentation: Segmentation, selected: number) {
  const { geometry, probabilities, labels } = segmentation;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const channels = selected === -1
    ? labels.map((label, index) => label.startsWith('vertebra_') ? index : -1).filter(index => index !== -1)
    : [selected];
  for (let i = 0; i < pixels; i++) {
    if (!channels.some(channel => probabilities[channel * pixels + i] >= 0.5)) continue;
    image.data.set([45, 218, 255, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);

  const cropped = document.createElement('canvas');
  const factor = size / geometry.side;
  cropped.width = Math.max(1, Math.round(geometry.width * factor));
  cropped.height = Math.max(1, Math.round(geometry.height * factor));
  const croppedCtx = cropped.getContext('2d')!;
  croppedCtx.imageSmoothingEnabled = false;
  croppedCtx.drawImage(canvas, geometry.left * factor, geometry.top * factor,
    geometry.width * factor, geometry.height * factor, 0, 0, cropped.width, cropped.height);
  return cropped;
}
