import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

function serveStaticAssets() {
  return {
    name: 'serve-static-assets',
    configureServer(server: any) {
      const handler = (req: any, res: any, next: any) => {
        const decodedUrl = decodeURIComponent(req.url || '');
        if (decodedUrl.startsWith('/assets/')) {
          const relativePath = decodedUrl.slice('/assets/'.length).split('?')[0];
          const filePath = resolve(import.meta.dirname, 'assets', relativePath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.svg': 'image/svg+xml',
              '.txt': 'text/plain; charset=utf-8',
              '.json': 'application/json',
              '.mp3': 'audio/mpeg',
              '.wav': 'audio/wav',
              '.ogg': 'audio/ogg',
              '.ttf': 'font/ttf',
              '.woff': 'font/woff',
              '.woff2': 'font/woff2',
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.setHeader('Access-Control-Allow-Origin', '*');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      };
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      const handler = (req: any, res: any, next: any) => {
        const decodedUrl = decodeURIComponent(req.url || '');
        if (decodedUrl.startsWith('/assets/')) {
          const relativePath = decodedUrl.slice('/assets/'.length).split('?')[0];
          const filePath = resolve(import.meta.dirname, 'assets', relativePath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.svg': 'image/svg+xml',
              '.txt': 'text/plain; charset=utf-8',
              '.json': 'application/json',
              '.mp3': 'audio/mpeg',
              '.wav': 'audio/wav',
              '.ogg': 'audio/ogg',
              '.ttf': 'font/ttf',
              '.woff': 'font/woff',
              '.woff2': 'font/woff2',
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.setHeader('Access-Control-Allow-Origin', '*');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      };
      server.middlewares.use(handler);
    },
    closeBundle() {
      // Copy assets folder to dist/assets/
      const srcDir = resolve(import.meta.dirname, 'assets');
      const destDir = resolve(import.meta.dirname, 'dist', 'assets');
      if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, destDir, { recursive: true });
        console.log('[serve-static-assets] Copied ./assets to ./dist/assets');
      }
    },
  };
}

export default defineConfig({
  plugins: [serveStaticAssets()],
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

