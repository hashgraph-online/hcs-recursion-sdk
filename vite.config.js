import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'HCSRecusionSDK',
      fileName: () => `hcs-recursion-sdk.js`,
      formats: ['umd'],
    },
    rollupOptions: {
      external: [], // No externals, include everything
    },
    commonjsOptions: {
      include: [/node_modules/],
    },
    minify: 'terser',
    sourcemap: false,
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
});
