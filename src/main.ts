import './style.css';
import { setupExam } from './exam-panel.ts';
import { formatAngle } from './measurements.ts';

const home = document.querySelector<HTMLElement>('#accueil')!;
const tool = document.querySelector<HTMLElement>('#outil')!;

function showPage(focus: boolean) {
  const openTool = window.location.hash === '#outil';
  home.hidden = openTool;
  tool.hidden = !openTool;
  document.title = openTool ? 'Visionneuse OrthoVision' : 'OrthoVision';
  if (focus) (openTool ? tool : home).focus();
}

showPage(false);
window.addEventListener('hashchange', () => showPage(true));

const exams = document.querySelector<HTMLElement>('#exams')!;
const template = document.querySelector<HTMLTemplateElement>('#exam-template')!;
const compare = document.querySelector<HTMLButtonElement>('#compare')!;
const comparison = document.querySelector<HTMLElement>('#comparison')!;
const difference = document.querySelector<HTMLElement>('#difference')!;
const report = document.querySelector<HTMLButtonElement>('#report')!;
const first = addExam('Examen A');
const second = addExam('Examen B');
second.element.hidden = true;

function addExam(title: string) {
  const element = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  exams.append(element);
  return setupExam(element, title, updateComparison);
}

function updateComparison() {
  const bVisible = !second.element.hidden;
  comparison.hidden = !bVisible;
  report.disabled = !first.hasImage && (!bVisible || !second.hasImage);
  if (first.angle === null || second.angle === null) {
    difference.textContent = 'Mesurez un angle sur chaque examen pour afficher l’écart.';
    return;
  }
  difference.textContent = `A : ${formatAngle(first.angle)} · B : ${formatAngle(second.angle)} · Écart absolu : ${formatAngle(Math.abs(second.angle - first.angle))}`;
}

function showCompare(show: boolean) {
  compare.setAttribute('aria-pressed', String(show));
  second.element.hidden = !show;
  updateComparison();
}

compare.onclick = () => showCompare(second.element.hidden);
document.querySelector<HTMLButtonElement>('#demo')!.onclick = async () => {
  showCompare(true);
  await Promise.all([
    first.openExample('spine-before.jpg', 'Radiographie avant intervention'),
    second.openExample('spine-after.jpg', 'Radiographie après intervention'),
  ]);
};

report.onclick = () => {
  first.resetView();
  second.resetView();
  window.print();
};
