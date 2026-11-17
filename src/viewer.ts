interface ImageSize {
  width: number;
  height: number;
}

export async function openImage(file: File, image: HTMLImageElement): Promise<ImageSize> {
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    throw new Error('Format non pris en charge');
  }

  // On vérifie le fichier avant de remplacer l'image affichée.
  const url = URL.createObjectURL(file);
  try {
    const preview = new Image();
    preview.src = url;
    await preview.decode();
    image.src = url;
    await image.decode();
    return { width: preview.naturalWidth, height: preview.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
