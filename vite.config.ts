import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function apiDatabasePlugin(): Plugin {
  const DATA_DIR = path.resolve(rootDir, 'data');
  const DB_FILE = path.join(DATA_DIR, 'models-db.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  function readDB(): any[] {
    try {
      if (fs.existsSync(DB_FILE)) {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      }
    } catch {}
    return [];
  }

  function writeDB(data: any[]) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch {}
  }

  return {
    name: 'api-database-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          return next();
        }

        // 1. Health check
        if (req.url === '/api/health' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'ok',
            database: 'connected',
            type: 'vite-dev-database',
            message: 'VoxelOrbit Cloud/Dev Database Connected',
            timestamp: Date.now(),
          }));
          return;
        }

        // 2. GET /api/models
        if (req.url === '/api/models' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(readDB()));
          return;
        }

        // 3. POST /api/models/metadata
        if (req.url === '/api/models/metadata' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const incoming = JSON.parse(body);
              const models = readDB();
              const idx = models.findIndex(m => m.id === incoming.id);
              if (idx >= 0) {
                models[idx] = { ...models[idx], ...incoming, updatedAt: Date.now() };
              } else {
                models.unshift({ ...incoming, createdAt: incoming.createdAt || Date.now(), updatedAt: Date.now() });
              }
              writeDB(models);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, model: incoming }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 4. PATCH /api/models/:id (renaming)
        if (req.url.startsWith('/api/models/') && req.method === 'PATCH') {
          const id = decodeURIComponent(req.url.replace('/api/models/', ''));
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const updates = JSON.parse(body);
              const models = readDB();
              const idx = models.findIndex(m => m.id === id);
              if (idx >= 0) {
                models[idx] = { ...models[idx], ...updates, updatedAt: Date.now() };
                writeDB(models);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, model: models[idx] }));
              } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Model not found' }));
              }
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 5. DELETE /api/models/:id
        if (req.url.startsWith('/api/models/') && req.method === 'DELETE') {
          const urlPath = req.url.split('?')[0];
          const id = decodeURIComponent(urlPath.replace('/api/models/', ''));
          const models = readDB();
          const filtered = models.filter(m => m.id !== id);
          writeDB(filtered);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, deletedId: id }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: process.env.GITHUB_PAGES === 'true' ? '/3DPortal/' : '/',
    plugins: [react(), tailwindcss(), apiDatabasePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/data/**',
          '**/public/models/**',
          '**/.system_generated/**',
          '**/*.log',
        ],
      },
    },
  };
});
