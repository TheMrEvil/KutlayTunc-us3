import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// Develop against the package SOURCE (no build step needed) and dedupe the
// singletons so there's only ever one copy of three / react / r3f.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@kutlaytunc/us3-core': resolve(HERE, '../../packages/core/src/index.ts'),
      '@kutlaytunc/us3-ai': resolve(HERE, '../../packages/ai/src/index.ts'),
      '@kutlaytunc/us3-anim': resolve(HERE, '../../packages/anim/src/index.ts'),
      '@kutlaytunc/us3-react': resolve(HERE, '../../packages/react/src/index.ts'),
    },
    dedupe: ['three', 'react', 'react-dom', '@react-three/fiber', '@react-three/drei'],
  },
});
