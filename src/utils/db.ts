import { ModelItem } from '../types/model';

const DB_NAME = 'voxelorbit_3d_db';
const STORE_NAME = 'models';
const DB_VERSION = 2; // Incremented for schema updates

/**
 * Open or upgrade the client-side IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('size', 'size', { unique: false });
      }
    };
  });
}

// Request persistent storage in modern browsers (Chrome, Edge, Firefox)
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Duplicate Detector:
 * Checks whether an incoming model already exists in the library.
 * Matches by normalized name (ignoring casing and extensions) or exact size + name.
 */
export function checkIsDuplicate(
  existingModels: ModelItem[],
  candidate: { name: string; size: number }
): { isDuplicate: boolean; duplicateOf?: ModelItem; reason?: string } {
  const normalize = (name: string) =>
    name
      .toLowerCase()
      .replace(/\.(glb|gltf)$/i, '')
      .replace(/[_\s-]+/g, ' ')
      .trim();

  const candidateNorm = normalize(candidate.name);

  for (const existing of existingModels) {
    const existingNorm = normalize(existing.name);

    // Exact normalized name match
    if (existingNorm === candidateNorm) {
      return {
        isDuplicate: true,
        duplicateOf: existing,
        reason: `Model with name "${existing.name}" is already in your library`,
      };
    }

    // Exact size and close name match
    if (candidate.size > 0 && existing.size === candidate.size && (
      existingNorm.includes(candidateNorm) || candidateNorm.includes(existingNorm)
    )) {
      return {
        isDuplicate: true,
        duplicateOf: existing,
        reason: `Identical file (${(existing.size / (1024 * 1024)).toFixed(1)} MB) already exists as "${existing.name}"`,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Check if the backend publishing server / API is reachable.
 */
export async function checkServerStatus(): Promise<{ online: boolean; message: string }> {
  try {
    const res = await fetch('/api/health', { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      return { online: true, message: data.message || 'Server database connected' };
    }
    return { online: false, message: 'Server database endpoint not active (using local IndexedDB)' };
  } catch {
    return { online: false, message: 'Offline / Static mode (IndexedDB active)' };
  }
}

/**
 * Save or insert a model into IndexedDB and optionally sync to backend server.
 */
export async function saveModelToDB(model: ModelItem): Promise<void> {
  // 1. Save to local IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // We preserve fileBlob for offline/reloads, but clear transient object URLs
      const isBlobUrl = model.fileUrl?.startsWith('blob:');
      const recordToStore = {
        ...model,
        fileUrl: isBlobUrl ? '' : model.fileUrl,
        updatedAt: Date.now(),
      };

      const request = store.put(recordToStore);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to save model to IndexedDB:', err);
  }

  // 2. Sync to server API if available (for publish / multi-device persistence)
  try {
    if (model.fileBlob) {
      const formData = new FormData();
      formData.append('file', model.fileBlob, model.name);
      formData.append('id', model.id);
      formData.append('name', model.name);
      formData.append('size', model.size.toString());
      formData.append('metrics', JSON.stringify(model.metrics || {}));
      formData.append('tags', JSON.stringify(model.tags || []));
      formData.append('isDefault', String(!!model.isDefault));

      fetch('/api/models', {
        method: 'POST',
        body: formData,
      }).catch(() => {
        // Silently skip if server API is not available
      });
    } else {
      // Just metadata sync
      fetch('/api/models/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: model.id,
          name: model.name,
          size: model.size,
          fileUrl: model.fileUrl,
          metrics: model.metrics,
          tags: model.tags,
          isDefault: model.isDefault,
        }),
      }).catch(() => {});
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Update an existing model in the database (e.g. Renaming).
 */
export async function updateModelInDB(
  id: string,
  updates: Partial<Omit<ModelItem, 'id'>>
): Promise<void> {
  // 1. Update in IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) {
          resolve();
          return;
        }

        const updated = {
          ...existing,
          ...updates,
          updatedAt: Date.now(),
        };

        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('Failed to update model in IndexedDB:', err);
  }

  // 2. Sync rename to server API if online
  try {
    fetch(`/api/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});
  } catch {
    // Non-blocking
  }
}

/**
 * Retrieve all saved models from IndexedDB.
 */
export async function getAllModelsFromDB(): Promise<ModelItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result || [];
        const models: ModelItem[] = records.map((rec) => {
          let fileUrl = rec.fileUrl;
          if (rec.fileBlob) {
            fileUrl = URL.createObjectURL(rec.fileBlob);
          }
          return {
            ...rec,
            fileUrl,
          };
        });
        resolve(models);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to get models from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete a model from IndexedDB and server.
 */
export async function deleteModelFromDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to delete model from IndexedDB:', err);
  }

  // Sync delete with server API
  try {
    fetch(`/api/models/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch {
    // Non-blocking
  }
}

/**
 * Clear all records from the database.
 */
export async function clearAllModelsInDB(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to clear models from IndexedDB:', err);
  }
}

/**
 * Export all models metadata as a JSON backup file.
 */
export function exportModelsMetadataJSON(models: ModelItem[]): void {
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    platform: 'VoxelOrbit 3D Studio',
    count: models.length,
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      size: m.size,
      fileUrl: m.fileUrl.startsWith('blob:') ? '' : m.fileUrl,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      isDefault: m.isDefault,
      tags: m.tags,
      metrics: m.metrics,
    })),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `voxelorbit-library-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
