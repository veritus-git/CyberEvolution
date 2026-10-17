import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    allowedHosts: true,
    fs: {
      allow: ['.'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    cors: true,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      '/assets': resolve(import.meta.dirname, './assets'),
    },
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 4096,
  },
});
