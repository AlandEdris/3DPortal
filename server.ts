import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and large payloads
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Database folder and JSON database file
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'models-db.json');
const UPLOADS_DIR = path.resolve(__dirname, 'public/models');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Database helper functions
interface ServerModelRecord {
  id: string;
  name: string;
  size: number;
  fileUrl: string;
  createdAt: number;
  updatedAt?: number;
  isDefault?: boolean;
  tags?: string[];
  metrics?: any;
}

function readDB(): ServerModelRecord[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read models DB file:', err);
    return [];
  }
}

function writeDB(models: ServerModelRecord[]): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(models, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write models DB file:', err);
  }
}

// --- API Endpoints ---

// 1. Health & Status
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    type: 'server-filesystem-db',
    message: 'VoxelOrbit Cloud Database Connected',
    timestamp: Date.now(),
  });
});

// 2. Get all models
app.get('/api/models', (_req, res) => {
  const models = readDB();
  res.json(models);
});

// 3. Save or update model metadata
app.post('/api/models/metadata', (req, res) => {
  const incoming = req.body as ServerModelRecord;
  if (!incoming || !incoming.id || !incoming.name) {
    res.status(400).json({ error: 'Missing required model id or name' });
    return;
  }

  const models = readDB();
  const index = models.findIndex((m) => m.id === incoming.id);

  if (index >= 0) {
    models[index] = {
      ...models[index],
      ...incoming,
      updatedAt: Date.now(),
    };
  } else {
    models.unshift({
      ...incoming,
      createdAt: incoming.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
  }

  writeDB(models);
  res.json({ success: true, model: incoming });
});

// 4. Save model with base64 binary payload or file
app.post('/api/models', (req, res) => {
  const { id, name, size, base64Data, metrics, tags, isDefault } = req.body;
  if (!id || !name) {
    res.status(400).json({ error: 'Missing required id or name' });
    return;
  }

  let finalUrl = `/models/${name}`;
  if (base64Data) {
    try {
      const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const targetFilePath = path.join(UPLOADS_DIR, name);
      fs.writeFileSync(targetFilePath, buffer);
      finalUrl = `/models/${name}`;
    } catch (err) {
      console.error('Error saving binary GLB:', err);
    }
  }

  const models = readDB();
  const existingIdx = models.findIndex((m) => m.id === id);
  const record: ServerModelRecord = {
    id,
    name,
    size: Number(size) || 0,
    fileUrl: finalUrl,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: !!isDefault,
    tags: tags || [],
    metrics: metrics || {},
  };

  if (existingIdx >= 0) {
    models[existingIdx] = record;
  } else {
    models.unshift(record);
  }

  writeDB(models);
  res.json({ success: true, model: record });
});

// 5. Rename / Update Model
app.patch('/api/models/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const models = readDB();
  const index = models.findIndex((m) => m.id === id);

  if (index < 0) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }

  models[index] = {
    ...models[index],
    ...updates,
    updatedAt: Date.now(),
  };

  writeDB(models);
  res.json({ success: true, model: models[index] });
});

// 6. Delete Model
app.delete('/api/models/:id', (req, res) => {
  const { id } = req.params;
  const models = readDB();
  const filtered = models.filter((m) => m.id !== id);
  writeDB(filtered);
  res.json({ success: true, deletedId: id });
});

// Static assets (for both production build and public files)
const distPath = path.resolve(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}
app.use(express.static(path.resolve(__dirname, 'public')));

// Catch-all route to index.html for SPA routing
app.get('*', (_req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.sendFile(path.resolve(__dirname, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`[VoxelOrbit Studio] Server running on port ${PORT}`);
});
