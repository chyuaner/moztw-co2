import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'src/gen/dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/core/frontend/main.tsx',
      output: {
        entryFileNames: 'client.js',
        chunkFileNames: 'client-[hash].js',
        assetFileNames: 'client-[name].[ext]'
      }
    }
  }
});
