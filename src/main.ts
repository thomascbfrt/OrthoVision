import './style.css';
import { openImage } from './viewer';

const input = document.querySelector<HTMLInputElement>('#image-input')!;
const image = document.querySelector<HTMLImageElement>('#image')!;
const placeholder = document.querySelector<HTMLElement>('#placeholder')!;
const imageName = document.querySelector<HTMLElement>('#image-name')!;
const imageSize = document.querySelector<HTMLElement>('#image-size')!;
const message = document.querySelector<HTMLElement>('#message')!;

input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;

  try {
    const size = await openImage(file, image);
    placeholder.hidden = true;
    image.hidden = false;
    imageName.textContent = file.name;
    imageSize.textContent = `${size.width} × ${size.height} px`;
    message.textContent = '';
  } catch {
    message.textContent = 'Impossible de lire cette image. Choisissez un fichier PNG ou JPEG valide.';
  } finally {
    // Permet de sélectionner à nouveau le même fichier après une erreur.
    input.value = '';
  }
});
