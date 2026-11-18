/*
 * Réglages de Vite.
 * Prépare les moteurs de FleXray pour éviter un rechargement au premier lancement.
 */

import { defineConfig } from 'vite';

export default defineConfig({
  // Prépare les deux moteurs dès le démarrage du serveur de développement.
  optimizeDeps: {
    include: ['onnxruntime-web/webgpu', 'onnxruntime-web/wasm'],
  },
});
