import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths: served by the game server at /admin/ and packed into the Android APK.
  base: './',
  build: { target: 'es2020', outDir: 'dist', assetsInlineLimit: 0 },
  server: { port: 5174 },
});
