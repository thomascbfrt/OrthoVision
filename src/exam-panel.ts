import { annotationData, download, imageHash, readPoints, type ExamImage } from './exam.ts';
import { cobbAngle, formatAngle } from './measurements.ts';
import { annotatedPng, createViewer } from './viewer.ts';
import type { Segmentation } from './flexray.ts';

let modelBusy = false;

export function setupExam(element: HTMLElement, title: string, onChange: () => void) {
  function find<T extends Element>(selector: string) {
    return element.querySelector<T>(selector)!;
  }
  const viewer = createViewer(find<SVGSVGElement>('.viewer'), updateResult);
  const status = find<HTMLElement>('.status');
  const aiStatus = find<HTMLElement>('.ai-status');
  const result = find<HTMLElement>('.result');
  const coordinates = find<HTMLElement>('.coordinates');
  const select = find<HTMLSelectElement>('.structures select');
  const opacity = find<HTMLInputElement>('.opacity input');
  const segment = find<HTMLButtonElement>('.segment');
  const pan = find<HTMLButtonElement>('.pan');
  let image: HTMLImageElement | undefined;
  let examImage: ExamImage | undefined;
  let segmentation: Segmentation | undefined;
  let mask: HTMLCanvasElement | null = null;
  let loadId = 0;
  find('h2').textContent = title;

  function updateResult() {
    const points = viewer.points;
    const angle = cobbAngle(points);
    const value = angle === null ? (points.length === 4 ? 'repères confondus' : '—') : formatAngle(angle);
    result.textContent = `Angle de Cobb manuel : ${value}`;
    coordinates.textContent = points.length
      ? points.map(({ x, y }, i) => `P${i + 1} (${x.toFixed(1)}, ${y.toFixed(1)})`).join(' · ') + ' px'
      : '';
    onChange();
  }

  async function open(source: Blob, name: string, id: number) {
    if (!['image/png', 'image/jpeg'].includes(source.type)) throw new Error('Choisissez un fichier PNG ou JPEG.');
    const url = URL.createObjectURL(source);
    const next = new Image();
    next.src = url;
    try {
      const [, sha256] = await Promise.all([next.decode(), imageHash(source)]);
      if (id !== loadId) return;
      const previous = image;
      image = next;
      examImage = { name, width: next.naturalWidth, height: next.naturalHeight, sha256 };
      segmentation = undefined;
      mask = null;
      find<HTMLElement>('.structures').hidden = true;
      find<HTMLElement>('.opacity').hidden = true;
      aiStatus.textContent = '';
      status.textContent = '';
      find('.image-info').textContent = `${name} · ${examImage.width} × ${examImage.height} px`;
      viewer.setImage(url, examImage);
      viewer.setPan(false);
      pan.setAttribute('aria-pressed', 'false');
      for (const selector of ['.view-controls', '.instruction', '.exports', '.ai']) {
        find<HTMLElement>(selector).hidden = false;
      }
      if (previous) URL.revokeObjectURL(previous.src);
    } finally {
      if (image !== next) URL.revokeObjectURL(url);
    }
  }

  find<HTMLInputElement>('.file').onchange = async event => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const id = ++loadId;
    try {
      await open(file, file.name, id);
    } catch {
      if (id === loadId) status.textContent = 'Impossible de lire cette image PNG ou JPEG.';
    }
  };
  find<HTMLButtonElement>('.zoom-in').onclick = () => viewer.zoom(0.8);
  find<HTMLButtonElement>('.zoom-out').onclick = () => viewer.zoom(1.25);
  find<HTMLButtonElement>('.reset').onclick = viewer.reset;
  pan.onclick = () => {
    const enabled = pan.getAttribute('aria-pressed') === 'false';
    pan.setAttribute('aria-pressed', String(enabled));
    viewer.setPan(enabled);
  };
  find<HTMLButtonElement>('.undo').onclick = () => viewer.setPoints(viewer.points.slice(0, -1));
  find<HTMLButtonElement>('.clear').onclick = () => viewer.setPoints([]);

  find<HTMLInputElement>('.import input').onchange = async event => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const target = examImage;
    if (!file || !target) return;
    try {
      const points = readPoints(await file.text(), target);
      if (examImage !== target) return;
      viewer.setPoints(points);
      status.textContent = 'Repères importés.';
    } catch (error) {
      if (examImage === target) status.textContent = error instanceof SyntaxError ? 'Fichier JSON invalide.' : (error as Error).message;
    }
  };
  find<HTMLButtonElement>('.json').onclick = () => {
    if (!examImage) return;
    const data = JSON.stringify(annotationData(examImage, viewer.points), null, 2);
    download(new Blob([data], { type: 'application/json' }), `orthovision-${title.at(-1)}.json`);
  };
  find<HTMLButtonElement>('.png').onclick = async () => {
    if (!image) return;
    try {
      download(await annotatedPng(image, viewer.points, mask, Number(opacity.value) / 100), `orthovision-${title.at(-1)}.png`);
    } catch {
      status.textContent = 'Impossible d’exporter le PNG.';
    }
  };

  function updateOpacity() {
    if (mask) viewer.setMask(mask.toDataURL(), Number(opacity.value) / 100);
  }

  async function selectMask() {
    const current = segmentation;
    const selected = select.value;
    if (!current) return;
    if (selected === '') {
      mask = null;
      viewer.setMask('', 0);
      return;
    }
    const { drawMask } = await import('./flexray.ts');
    if (segmentation !== current || select.value !== selected) return;
    mask = drawMask(current, Number(selected));
    updateOpacity();
  }

  opacity.oninput = updateOpacity;
  select.onchange = selectMask;
  segment.onclick = async () => {
    const target = image;
    if (!target) return;
    if (modelBusy) {
      aiStatus.textContent = 'Une autre segmentation est en cours.';
      return;
    }
    modelBusy = true;
    segment.disabled = true;
    try {
      const { segmentImage } = await import('./flexray.ts');
      const prediction = await segmentImage(target, message => {
        if (image === target) aiStatus.textContent = message;
      });
      if (image !== target) return;
      segmentation = prediction;
      select.replaceChildren(new Option('Masquer', ''), new Option('Toutes les vertèbres', '-1'));
      prediction.labels.forEach((label, index) => {
        if (!index) return;
        const name = label.startsWith('vertebra_') ? `Vertèbre ${label.slice(9).toUpperCase()}` : label.replaceAll('_', ' ');
        select.add(new Option(name, String(index)));
      });
      select.value = '-1';
      find<HTMLElement>('.structures').hidden = false;
      find<HTMLElement>('.opacity').hidden = false;
      await selectMask();
      if (image === target) aiStatus.textContent = `Masques FleXray (${prediction.provider}). Les points de Cobb se placent à la main.`;
    } catch (error) {
      if (image === target) aiStatus.textContent = (error as Error).message;
    } finally {
      modelBusy = false;
      segment.disabled = false;
    }
  };

  return {
    element,
    resetView: viewer.reset,
    get hasImage() { return Boolean(image); },
    get angle() { return cobbAngle(viewer.points); },
    async openExample(filename: string, name: string) {
      const id = ++loadId;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}examples/${filename}`);
        if (!response.ok) throw new Error();
        await open(await response.blob(), name, id);
      } catch {
        if (id === loadId) status.textContent = 'Impossible de charger la radiographie d’exemple.';
      }
    },
  };
}
