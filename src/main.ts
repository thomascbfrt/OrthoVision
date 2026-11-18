/*
 * Point de départ de l’application.
 * Relie l’accueil, la visionneuse et la comparaison des deux examens.
 */

import './style.css';
import { setupExam } from './exam-panel.ts';

const home = document.querySelector<HTMLElement>('#accueil')!;
const tool = document.querySelector<HTMLElement>('#outil')!;

// Affiche l’accueil ou la visionneuse selon la fin de l’adresse.
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

// Crée un panneau d’examen à partir du modèle défini dans la page.
function addExam(title: string) {
  const element = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  exams.append(element);
  return setupExam(element, title, updateComparison);
}

// Met à jour les angles et leur écart quand un examen change.
function updateComparison() {
  const bVisible = !second.element.hidden;
  comparison.hidden = !bVisible;
  report.disabled = !first.hasImage && (!bVisible || !second.hasImage);
  const a = first.patientAngles;
  const b = second.patientAngles;
  if (!a || !b) {
    difference.textContent = 'Identifie le côté du patient sur chaque radio pour comparer les mêmes jambes.';
    return;
  }
  difference.textContent = ['Droite', 'Gauche'].map((side, i) => {
    const before = a[i];
    const after = b[i];
    if (before === null || after === null) return side + ' · mesure à compléter';
    const delta = after - before;
    if (Math.abs(delta) < 0.05) return side + ' · même angle à 0,1° près';
    return side + ' · de A à B, ' + Math.abs(delta).toFixed(1).replace('.', ',') + '° vers ' + (delta > 0 ? 'l’intérieur' : 'l’extérieur');
  }).join(' / ');

}

// Affiche ou masque le deuxième examen.
function showCompare(show: boolean) {
  compare.setAttribute('aria-pressed', String(show));
  second.element.hidden = !show;
  updateComparison();
}

compare.onclick = () => showCompare(second.element.hidden);
// Ouvre la radio locale avec ses six repères pédagogiques.
document.querySelector<HTMLButtonElement>('#demo')!.onclick = () => first.openExample();

// Rétablit la vue complète des radios avant de lancer l’impression.
report.onclick = () => {
  first.resetView();
  second.resetView();
  window.print();
};
