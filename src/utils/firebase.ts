import { initializeApp, getApps, FirebaseApp, FirebaseOptions } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  Unsubscribe,
  query,
  orderBy,
} from 'firebase/firestore';
import { ModelItem } from '../types/model';

const STORAGE_KEY = 'voxelorbit_firebase_config';
const COLLECTION_NAME = 'voxelorbit_models';

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;

/**
 * Get active Firebase configuration from localStorage or Vite environment variables.
 */
export function getFirebaseConfig(): FirebaseOptions | null {
  // 1. Check user-configured config in localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stored Firebase config:', e);
    }
  }

  // 2. Check Vite environment variables (VITE_FIREBASE_*)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const env = import.meta.env;
    if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
      return {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      };
    }
  }

  return null;
}

/**
 * Initialize or get active Firestore instance.
 */
export function getFirestoreDB(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    const apps = getApps();
    appInstance = apps.length > 0 ? apps[0] : initializeApp(config);
    firestoreInstance = getFirestore(appInstance);
    return firestoreInstance;
  } catch (err) {
    console.error('Failed to initialize Firebase Firestore:', err);
    return null;
  }
}

/**
 * Check if online cloud sync is configured and active.
 */
export function isCloudConfigured(): boolean {
  return !!getFirebaseConfig();
}

/**
 * Save Firebase configuration to localStorage and re-initialize.
 */
export function saveFirebaseConfig(config: FirebaseOptions): boolean {
  try {
    if (!config.apiKey || !config.projectId) {
      throw new Error('API Key and Project ID are required.');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    appInstance = null;
    firestoreInstance = null;
    return !!getFirestoreDB();
  } catch (err) {
    console.error('Failed to save Firebase config:', err);
    return false;
  }
}

/**
 * Clear stored Firebase configuration and revert to local storage.
 */
export function clearFirebaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    appInstance = null;
    firestoreInstance = null;
  } catch (err) {
    console.error('Failed to clear Firebase config:', err);
  }
}

/**
 * Test connectivity to Firebase Firestore.
 */
export async function testFirebaseConnection(configToTest?: FirebaseOptions): Promise<{ success: boolean; message: string }> {
  try {
    const config = configToTest || getFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId) {
      return { success: false, message: 'Missing API Key or Project ID.' };
    }

    const testApp = initializeApp(config, `test-app-${Date.now()}`);
    const testDb = getFirestore(testApp);
    const colRef = collection(testDb, COLLECTION_NAME);

    // Try a lightweight query
    await getDocs(colRef);
    return { success: true, message: `Connected to Firestore project "${config.projectId}" successfully!` };
  } catch (err: any) {
    console.error('Firebase test connection failed:', err);
    let msg = err.message || 'Connection failed';
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      msg = 'Permission denied: Please ensure your Firestore Security Rules allow read/write (e.g. Test Mode).';
    }
    return { success: false, message: msg };
  }
}

/**
 * Real-time listener for cloud models:
 * Automatically invokes callback whenever ANY user adds, renames, or deletes a model.
 */
export function subscribeToCloudModels(
  onUpdate: (models: ModelItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const cloudModels: ModelItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          cloudModels.push({
            id: data.id || docSnap.id,
            name: data.name,
            size: Number(data.size) || 0,
            fileUrl: data.fileUrl || '',
            thumbnailUrl: data.thumbnailUrl || undefined,
            createdAt: Number(data.createdAt) || Date.now(),
            updatedAt: Number(data.updatedAt) || Date.now(),
            isDefault: !!data.isDefault,
            serverSynced: true,
            tags: data.tags || [],
            metrics: data.metrics || {
              triangles: 0,
              vertices: 0,
              meshes: 0,
              materials: 0,
              textures: 0,
              animations: 0,
              dimensions: { x: 0, y: 0, z: 0 },
              animationNames: [],
            },
          });
        });
        onUpdate(cloudModels);
      },
      (err) => {
        console.warn('Firestore subscription warning:', err);
        onError?.(err);
      }
    );
  } catch (err: any) {
    console.warn('Could not establish Firestore subscription:', err);
    onError?.(err);
    return null;
  }
}

/**
 * Save or insert model into Firebase Firestore.
 */
export async function saveModelToCloud(model: ModelItem): Promise<boolean> {
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const docRef = doc(db, COLLECTION_NAME, model.id);
    const cleanRecord: Record<string, any> = {
      id: model.id,
      name: model.name,
      size: model.size,
      fileUrl: model.fileUrl.startsWith('blob:') ? '' : model.fileUrl,
      createdAt: model.createdAt || Date.now(),
      updatedAt: Date.now(),
      isDefault: !!model.isDefault,
      serverSynced: true,
      tags: model.tags || [],
      metrics: model.metrics || {},
    };

    if (model.thumbnailUrl) {
      cleanRecord.thumbnailUrl = model.thumbnailUrl;
    }

    await setDoc(docRef, cleanRecord, { merge: true });
    return true;
  } catch (err) {
    console.warn('Failed to save model to Firestore:', err);
    return false;
  }
}

/**
 * Update an existing model in Firebase Firestore (e.g. Rename).
 */
export async function updateModelInCloud(id: string, updates: Partial<ModelItem>): Promise<boolean> {
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const cleanUpdates: Record<string, any> = {
      ...updates,
      updatedAt: Date.now(),
      serverSynced: true,
    };
    delete cleanUpdates.fileBlob; // Don't upload Blob objects directly into Firestore documents

    await updateDoc(docRef, cleanUpdates);
    return true;
  } catch (err) {
    console.warn('Failed to update model in Firestore:', err);
    return false;
  }
}

/**
 * Delete a model from Firebase Firestore.
 */
export async function deleteModelFromCloud(id: string): Promise<boolean> {
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('Failed to delete model from Firestore:', err);
    return false;
  }
}

/**
 * Retrieve all models once from Firestore.
 */
export async function getAllModelsFromCloud(): Promise<ModelItem[]> {
  const db = getFirestoreDB();
  if (!db) return [];

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const cloudModels: ModelItem[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      cloudModels.push({
        id: data.id || docSnap.id,
        name: data.name,
        size: Number(data.size) || 0,
        fileUrl: data.fileUrl || '',
        thumbnailUrl: data.thumbnailUrl,
        createdAt: Number(data.createdAt) || Date.now(),
        updatedAt: Number(data.updatedAt) || Date.now(),
        isDefault: !!data.isDefault,
        serverSynced: true,
        tags: data.tags || [],
        metrics: data.metrics || {
          triangles: 0,
          vertices: 0,
          meshes: 0,
          materials: 0,
          textures: 0,
          animations: 0,
          dimensions: { x: 0, y: 0, z: 0 },
          animationNames: [],
        },
      });
    });

    return cloudModels;
  } catch (err) {
    console.warn('Failed to fetch models from Firestore:', err);
    return [];
  }
}
