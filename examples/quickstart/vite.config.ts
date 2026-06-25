import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// In this monorepo we alias to the package SOURCE so the demo always runs the latest
// us3 code with no build step. A REAL consumer outside the repo deletes this block
// entirely and just `npm i us3` — the imports below are unchanged.
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
