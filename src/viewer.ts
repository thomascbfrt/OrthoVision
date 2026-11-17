import type { Point } from './measurements.ts';

const svgNamespace = 'http://www.w3.org/2000/svg';
const colors = ['#7aedcc', '#ffcf65'];

export function createViewer(svg: SVGSVGElement, onChange: () => void) {
  const image = svg.querySelector<SVGImageElement>('.radiograph')!;
  const marks = svg.querySelector<SVGGElement>('.marks')!;
  let width = 0;
  let height = 0;
  let view = { x: 0, y: 0, width: 1, height: 1 };
  let points: Point[] = [];
  let pan = false;
  let drag: { id: number; index: number; start: Point } | null = null;

  function applyView() {
    svg.setAttribute('viewBox', [view.x, view.y, view.width, view.height].join(' '));
  }

  function reset() {
    view = { x: 0, y: 0, width, height };
    if (width) applyView();
  }

  function zoom(factor: number, center = { x: view.x + view.width / 2, y: view.y + view.height / 2 }) {
    if (!width || view.width * factor > width * 1.01 || view.width * factor < width / 10) return;
    view.x = center.x + (view.x - center.x) * factor;
    view.y = center.y + (view.y - center.y) * factor;
    view.width *= factor;
    view.height *= factor;
    applyView();
  }

  function draw() {
    marks.replaceChildren();
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      const color = colors[Math.floor(index / 2)];
      if (index % 2 === 1) {
        const start = points[index - 1];
        const line = document.createElementNS(svgNamespace, 'line');
        line.setAttribute('x1', String(start.x));
        line.setAttribute('y1', String(start.y));
        line.setAttribute('x2', String(point.x));
        line.setAttribute('y2', String(point.y));
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        marks.prepend(line);
      }
      const circle = document.createElementNS(svgNamespace, 'circle');
      circle.setAttribute('cx', String(point.x));
      circle.setAttribute('cy', String(point.y));
      circle.setAttribute('r', String(Math.max(width, height) / 105));
      circle.setAttribute('fill', color);
      circle.setAttribute('stroke', '#172320');
      circle.setAttribute('vector-effect', 'non-scaling-stroke');
      circle.dataset.index = String(index);
      marks.append(circle);
    }
    onChange();
  }

  function setPoints(next: Point[]) {
    points = next;
    draw();
  }

  function imagePoint(event: MouseEvent): Point | null {
    const matrix = svg.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  }

  svg.addEventListener('pointerdown', event => {
    if (!width || event.button !== 0 || drag) return;
    const point = imagePoint(event);
    if (!point) return;
    const target = event.target as SVGElement;
    if (pan) drag = { id: event.pointerId, index: -1, start: point };
    else if (target.dataset.index !== undefined) {
      drag = { id: event.pointerId, index: Number(target.dataset.index), start: point };
    } else if (points.length < 4 && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height) {
      setPoints([...points, { x: point.x, y: point.y }]);
    }
    if (drag) svg.setPointerCapture(event.pointerId);
  });

  svg.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const point = imagePoint(event);
    if (!point) return;
    if (drag.index < 0) {
      view.x += drag.start.x - point.x;
      view.y += drag.start.y - point.y;
      applyView();
    } else {
      points[drag.index] = {
        x: Math.min(width, Math.max(0, point.x)),
        y: Math.min(height, Math.max(0, point.y)),
      };
      draw();
    }
  });
  svg.addEventListener('lostpointercapture', event => {
    if (drag?.id === event.pointerId) drag = null;
  });
  svg.addEventListener('wheel', event => {
    if (!width || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.25 : 0.8, imagePoint(event) ?? undefined);
  }, { passive: false });

  return {
    setImage(url: string, size: { width: number; height: number }) {
      ({ width, height } = size);
      for (const layer of [image]) {
        layer.setAttribute('width', String(width));
        layer.setAttribute('height', String(height));
        layer.setAttribute('preserveAspectRatio', 'none');
      }
      image.setAttribute('href', url);
      svg.dataset.ready = '';
      reset();
      setPoints([]);
    },
    setPan(enabled: boolean) {
      pan = enabled;
      svg.toggleAttribute('data-pan', enabled);
    },
    get points(): readonly Point[] { return points; },
    setPoints,
    reset,
    zoom,
  };
}

export function annotatedPng(image: HTMLImageElement, points: readonly Point[]) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const radius = Math.max(canvas.width, canvas.height) / 105;
  ctx.lineWidth = Math.max(2, radius / 2);
  for (let index = 0; index < points.length; index += 2) {
    const [a, b] = points.slice(index, index + 2);
    ctx.strokeStyle = colors[index / 2];
    ctx.fillStyle = ctx.strokeStyle;
    if (b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const point of [a, b].filter(Boolean)) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Export PNG impossible.')), 'image/png');
  });
}
