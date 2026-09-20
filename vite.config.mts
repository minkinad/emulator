import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/emulator/app/',
  plugins: [react()],
  publicDir: false,
  build: { outDir: 'dist/app', emptyOutDir: true, target: 'es2022' },
});
