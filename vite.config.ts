import { defineConfig } from 'vite';

export default defineConfig({
  // Précompiler les deux moteurs avant leur import à la demande évite
  // un rechargement de la page pendant la première segmentation.
  optimizeDeps: {
    include: ['onnxruntime-web/webgpu', 'onnxruntime-web/wasm'],
  },
});
