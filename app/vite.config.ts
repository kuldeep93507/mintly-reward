import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works inside the Android WebView.
  base: './',
  build: { target: 'es2020', outDir: 'dist', assetsInlineLimit: 0 },
  server: { port: 5173 },
});
