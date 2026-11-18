/*
 * Commandes d’un examen.
 * Ouvre la radio, relie les boutons à la visionneuse et affiche la mesure.
 */

import { annotationData, download, imageHash, readAnnotation, type ExamImage, type Orientation, type MeasurementMethod } from './exam.ts';
import { legAngle, describe } from './measurements.ts';
import { annotatedPng, createViewer } from './viewer.ts';
import type { Segmentation } from './flexray.ts';

let modelBusy = false;

// Prépare les commandes et les données propres à un examen.
export function setupExam(element: HTMLElement, title: string, onChange: () => void) {
  // Recherche un bouton ou un champ à l’intérieur du panneau de cet examen.
  function find<T extends Element>(selector: string) {
    return element.querySelector<T>(selector)!;
  }
  const viewer = createViewer(find<SVGSVGElement>('.viewer'), updateResult);
  const status = find<HTMLElement>('.status');
  const aiStatus = find<HTMLElement>('.ai-status');
  const result = find<HTMLElement>('.result');
  const resultNote = find<HTMLElement>('.result-note');
  const details = find<HTMLDetailsElement>('.measurement-details');
  const comparison = find<HTMLElement>('.side-comparison');
  const coordinates = find<HTMLElement>('.coordinates');
  const select = find<HTMLSelectElement>('.structures select');
  const opacity = find<HTMLInputElement>('.opacity input');
  const segment = find<HTMLButtonElement>('.segment');
  const suggest = find<HTMLButtonElement>('.suggest');
  const pan = find<HTMLButtonElement>('.pan');
  let image: HTMLImageElement | undefined;
  let examImage: ExamImage | undefined;
  let segmentation: Segmentation | undefined;
  let mask: HTMLCanvasElement | null = null;
  let loadId = 0;
  let measurementMethod: MeasurementMethod = 'manual';
  const orientation = find<HTMLSelectElement>('.orientation select');
  const instruction = find<HTMLElement>('.instruction');
  const joints = ['hanche', 'genou', 'cheville'];
  orientation.onchange = updateResult;

  // Nomme chaque jambe selon le marqueur de côté vérifié par l’utilisateur.
  function sideNames() {
    if (orientation.value === 'right-first') return ['Jambe droite', 'Jambe gauche'];
    if (orientation.value === 'left-first') return ['Jambe gauche', 'Jambe droite'];
    return ['À gauche de l’image', 'À droite de l’image'];
  }
  let pointsRevision = 0;
  find('h2').textContent = title;

  // Recalcule l’angle après un changement des repères et rafraîchit la comparaison.
  function updateResult() {
    const points = viewer.points;
    pointsRevision++;
    if (!points.length) measurementMethod = 'manual';
    const sides = sideNames();
    const angles = [legAngle(points, 0), legAngle(points, 1)];
    result.textContent = sides.map((name, i) => name + ' · ' + describe(angles[i])).join('\n');
    const [first, second] = angles;
    comparison.hidden = first === null || second === null;
    if (first !== null && second !== null) {
      const gap = Math.abs(first) - Math.abs(second);
      if (Math.abs(gap) < 0.05) comparison.textContent = 'Les deux genoux présentent le même écart à l’axe droit.';
      else comparison.textContent = sides[gap > 0 ? 0 : 1] + ' · le genou s’écarte davantage de l’axe hanche–cheville.';
    }
    instruction.textContent = points.length < 6
      ? sides[Math.floor(points.length / 3)] + ' — place le centre de l’articulation (' + joints[points.length % 3] + ').'
      : 'Fais glisser un point pour ajuster la mesure.';
    resultNote.hidden = !points.length;
    const invalid = angles.some((value, i) => points.length >= (i + 1) * 3 && value === null);
    resultNote.textContent = invalid ? 'Vérifie l’ordre des repères de haut en bas : hanche, genou, cheville.'
      : measurementMethod === 'assisted' ? 'Repères estimés par FleXray, à vérifier sur la radio.'
      : measurementMethod === 'example' ? 'Repères pédagogiques placés à la main.' : 'Mesure manuelle.';
    details.hidden = !points.length;
    if (!points.length) details.open = false;
    coordinates.textContent = points.length
      ? points.map(({ x, y }, i) => `P${i + 1} (${x.toFixed(1)}, ${y.toFixed(1)})`).join(' · ') + ' px'
      : '';
    onChange();
  }

  // Ouvre une radio et remet à zéro les repères de l’image précédente.
  async function open(source: Blob, name: string, id: number) {
    if (!['image/png', 'image/jpeg'].includes(source.type)) throw new Error('Choisissez un fichier PNG ou JPEG.');
    const url = URL.createObjectURL(source);
    const next = new Image();
    next.src = url;
    try {
      const [, sha256] = await Promise.all([next.decode(), imageHash(source)]);
      // Ignore un chargement terminé trop tard si une autre radio a été demandée.
      if (id !== loadId) return;
      const previous = image;
      image = next;
      examImage = { name, width: next.naturalWidth, height: next.naturalHeight, sha256 };
      segmentation = undefined;
      orientation.value = 'unknown';
      mask = null;
      find<HTMLElement>('.structures').hidden = true;
      find<HTMLElement>('.opacity').hidden = true;
      aiStatus.textContent = '';
      status.textContent = '';
      find('.image-info').textContent = `${name} · ${examImage.width} × ${examImage.height} px`;
      viewer.setImage(url, examImage);
      viewer.setPan(false);
      pan.setAttribute('aria-pressed', 'false');
      for (const selector of ['.view-controls', '.instruction', '.exports', '.ai', '.orientation']) {
        find<HTMLElement>(selector).hidden = false;
      }
      if (previous) URL.revokeObjectURL(previous.src);
    } finally {
      if (image !== next) URL.revokeObjectURL(url);
    }
  }

  // Charge le fichier choisi par l’utilisateur.
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
  // Relie les boutons de zoom et de remise à zéro à la visionneuse.
  find<HTMLButtonElement>('.zoom-in').onclick = () => viewer.zoom(0.8);
  find<HTMLButtonElement>('.zoom-out').onclick = () => viewer.zoom(1.25);
  find<HTMLButtonElement>('.reset').onclick = viewer.reset;
  // Bascule entre le déplacement de la radio et la manipulation des points.
  pan.onclick = () => {
    const enabled = pan.getAttribute('aria-pressed') === 'false';
    pan.setAttribute('aria-pressed', String(enabled));
    viewer.setPan(enabled);
  };
  // Permet de retirer le dernier point ou tous les repères.
  find<HTMLButtonElement>('.undo').onclick = () => viewer.setPoints(viewer.points.slice(0, -1));
  find<HTMLButtonElement>('.clear').onclick = () => viewer.setPoints([]);

  // Rouvre les repères d’un fichier JSON pour la radio affichée.
  find<HTMLInputElement>('.import input').onchange = async event => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const target = examImage;
    if (!file || !target) return;
    try {
      const { points, method, orientation: savedSide } = readAnnotation(await file.text(), target);
      if (examImage !== target) return;
      measurementMethod = method;
      orientation.value = savedSide;
      viewer.setPoints(points);
      status.textContent = 'Repères importés.';
    } catch (error) {
      if (examImage === target) status.textContent = error instanceof SyntaxError ? 'Fichier JSON invalide.' : (error as Error).message;
    }
  };
  // Télécharge les points et la mesure au format JSON.
  find<HTMLButtonElement>('.json').onclick = () => {
    if (!examImage) return;
    const data = JSON.stringify(annotationData(examImage, viewer.points, measurementMethod, orientation.value as Orientation), null, 2);
    download(new Blob([data], { type: 'application/json' }), `orthovision-${title.at(-1)}.json`);
  };
  // Télécharge la radio avec les traits et le masque visible au format PNG.
  find<HTMLButtonElement>('.png').onclick = async () => {
    if (!image) return;
    try {
      download(await annotatedPng(image, viewer.points, mask, Number(opacity.value) / 100), `orthovision-${title.at(-1)}.png`);
    } catch {
      status.textContent = 'Impossible d’exporter le PNG.';
    }
  };

  // Règle la transparence du masque pour garder la radio visible dessous.
  function updateOpacity() {
    if (mask) viewer.setMask(mask.toDataURL(), Number(opacity.value) / 100);
  }

  // Affiche le masque choisi dans la liste, ou le retire.
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

  // Réutilise les résultats de FleXray pour la radio ouverte ou lance le modèle.
  async function withPrediction(action: (prediction: Segmentation, target: HTMLImageElement) => Promise<void> | void) {
    const target = image;
    if (!target) return;
    const id = loadId;
    segment.disabled = suggest.disabled = true;
    let ownsModel = false;
    try {
      let prediction = segmentation;
      if (!prediction) {
        if (modelBusy) {
          aiStatus.textContent = 'Une autre segmentation est en cours.';
          return;
        }
        modelBusy = ownsModel = true;
        const { segmentImage } = await import('./flexray.ts');
        prediction = await segmentImage(target, message => {
          if (image === target && loadId === id) aiStatus.textContent = message;
        });
      }
      if (image !== target || loadId !== id) return;
      segmentation = prediction;
      await action(prediction, target);
    } catch (error) {
      if (image === target && loadId === id) aiStatus.textContent = (error as Error).message;
    } finally {
      if (ownsModel) modelBusy = false;
      segment.disabled = suggest.disabled = false;
    }
  }

  // Prépare la liste des structures et affiche les masques des jambes.
  segment.onclick = () => withPrediction(async (prediction, target) => {
    select.replaceChildren(new Option('Masquer', ''), new Option('Fémurs et tibias', '-1'));
    prediction.labels.forEach((label, index) => {
      if (label === 'femurs' || label === 'tibiae') select.add(new Option(label === 'femurs' ? 'Fémurs' : 'Tibias', String(index)));
    });
    select.value = '-1';
    find<HTMLElement>('.structures').hidden = false;
    find<HTMLElement>('.opacity').hidden = false;
    await selectMask();
    if (image === target) aiStatus.textContent = `Masques FleXray (${prediction.provider}).`;
  });

  // Propose trois points pour chaque jambe à partir des masques.
  suggest.onclick = () => {
    const revision = pointsRevision;
    const id = loadId;
    return withPrediction(async (prediction, target) => {
      const { suggestLegs } = await import('./leg-suggestion.ts');
      if (image !== target || loadId !== id) return;
      // Garde les repères si l’utilisateur les a modifiés pendant le calcul.
      if (pointsRevision !== revision) {
        aiStatus.textContent = 'Tes modifications ont été conservées. Relance la proposition si tu veux les remplacer.';
        return;
      }
      const proposal = suggestLegs(prediction, target.naturalWidth, target.naturalHeight);
      if (!proposal) {
        aiStatus.textContent = 'Les deux jambes entières n’ont pas pu être repérées. Tu peux placer les points à la main.';
        return;
      }
      measurementMethod = 'assisted';
      viewer.setPoints(proposal);
      status.textContent = '';
      aiStatus.textContent = '';
    });
  };

  return {
    element,
    resetView: viewer.reset,
    // Indique si la radio est chargée pour les commandes de comparaison et d’impression.
    get hasImage() { return Boolean(image); },
    // Donne l’angle actuel à la page de comparaison.
    get patientAngles() {
      if (orientation.value === 'unknown') return null;
      const angles = [legAngle(viewer.points, 0), legAngle(viewer.points, 1)];
      return orientation.value === 'right-first' ? angles : angles.reverse();
    },
    // Ouvre une des radios fournies avec l’application.
    async openExample() {
      const id = ++loadId;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}examples/legs.jpg`);
        if (!response.ok) throw new Error();
        await open(await response.blob(), 'Radio d’exemple', id);
        if (id !== loadId) return;
        // Le marqueur R apparaît à gauche de cette radio.
        orientation.value = 'right-first';
        measurementMethod = 'example';
        viewer.setPoints([{ x: 82, y: 102 }, { x: 88, y: 399 }, { x: 32, y: 635 },
          { x: 248, y: 100 }, { x: 229, y: 394 }, { x: 278, y: 633 }]);
      } catch {
        if (id === loadId) status.textContent = 'Impossible de charger la radiographie d’exemple.';
      }
    },
  };
}
