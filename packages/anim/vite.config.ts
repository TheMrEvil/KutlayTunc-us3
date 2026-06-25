// Library build only — ESM, a single entry, every bare/absolute import (i.e.
// three, @kutlaytunc/us3-core) externalized. @kutlaytunc/us3-anim's only runtime peer is three.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
