// Library build — ESM, single entry, every bare/absolute import externalized so
// the consumer supplies one deduped copy of react/three/r3f/drei. @kutlaytunc/us3-core
// is also externalized (it is its own package).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: resolve(HERE, 'dist'),
    emptyOutDir: true,
    lib: {
      entry: { index: resolve(HERE, 'src/index.ts') },
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !isAbsolute(id),
    },
  },
});
