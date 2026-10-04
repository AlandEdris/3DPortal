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
  limit,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
  Auth,
} from 'firebase/auth';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  FirebaseStorage,
} from 'firebase/storage';
import { ModelItem, ActivityLog } from '../types/model';

export const DEFAULT_FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: 'AIzaSyASC0WRkmv9RnfGEBR9e6EOi5JQHwsmTg8',
  authDomain: 'dportal-bcce2.firebaseapp.com',
  projectId: 'dportal-bcce2',
  storageBucket: 'dportal-bcce2.firebasestorage.app',
  messagingSenderId: '564498646134',
  appId: '1:564498646134:web:5f692fdba77e0a7ab80b57',
  measurementId: 'G-X95SFJRSK0',
};

const STORAGE_KEY = 'voxelorbit_firebase_config';
const COLLECTION_MODELS = 'voxelorbit_models';
const COLLECTION_LOGS = 'voxelorbit_activity_logs';
const COLLECTION_USERS = 'voxelorbit_users';

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;

/**
 * Get active Firebase configuration (custom override, env vars, or default configuration).
 */
export function getFirebaseConfig(): FirebaseOptions {
  // 1. Check user-configured override in localStorage
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
      console.warn('Failed to parse stored Firebase config override:', e);
    }
  }

  // 2. Check Vite environment variables
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

  // 3. Built-in default configuration
  return DEFAULT_FIREBASE_CONFIG;
}

/**
 * Initialize or get active Firebase App.
 */
export function getFirebaseApp(): FirebaseApp {
  if (appInstance) return appInstance;
  const config = getFirebaseConfig();
  const apps = getApps();
  appInstance = apps.length > 0 ? apps[0] : initializeApp(config);
  return appInstance;
}

/**
 * Initialize or get active Firestore instance.
 */
export function getFirestoreDB(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;
  try {
    const app = getFirebaseApp();
    firestoreInstance = getFirestore(app);
    return firestoreInstance;
  } catch (err) {
    console.error('Failed to initialize Firebase Firestore:', err);
    return null;
  }
}

/**
 * Initialize or get active Firebase Auth instance.
 */
export function getFirebaseAuth(): Auth | null {
  if (authInstance) return authInstance;
  try {
    const app = getFirebaseApp();
    authInstance = getAuth(app);
    return authInstance;
  } catch (err) {
    console.error('Failed to initialize Firebase Auth:', err);
    return null;
  }
}

/**
 * Initialize or get active Firebase Storage instance.
 */
export function getFirebaseStorage(): FirebaseStorage | null {
  if (storageInstance) return storageInstance;
  try {
    const app = getFirebaseApp();
    storageInstance = getStorage(app);
    return storageInstance;
  } catch (err) {
    console.warn('Failed to initialize Firebase Storage:', err);
    return null;
  }
}

/**
 * Check if online cloud sync is configured.
 */
export function isCloudConfigured(): boolean {
  return true; // Always configured out of the box with the default project
}

/**
 * Sign in existing user with email and password.
 */
export async function signInUser(
  email: string,
  pass: string
): Promise<{ user: User | null; error?: string }> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { user: null, error: 'Firebase Authentication service is unavailable.' };
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return { user: cred.user };
  } catch (err: any) {
    console.error('Firebase Auth sign in error:', err);
    let msg = 'Authentication failed. Please check your credentials.';
    if (
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/wrong-password' ||
      err.code === 'auth/user-not-found'
    ) {
      msg = 'Invalid email or password. Only registered accounts can access the portal.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';
    } else if (err.code === 'auth/too-many-requests') {
      msg = 'Account temporarily locked due to repeated failed logins. Please try again in a few minutes.';
    } else if (err.message) {
      msg = err.message;
    }
    return { user: null, error: msg };
  }
}

/**
 * Sign out the currently authenticated user.
 */
export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Subscribe to authentication state changes.
 */
export function subscribeToAuth(callback: (user: User | null) => void): Unsubscribe | null {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  return onAuthStateChanged(auth, callback);
}

/**
 * Get currently logged-in user synchronously.
 */
export function getCurrentFirebaseUser(): User | null {
  const auth = getFirebaseAuth();
  return auth ? auth.currentUser : null;
}

/**
 * Update the current user's Nickname in Firebase Auth and Firestore.
 */
export async function updateUserNickname(
  nickname: string
): Promise<{ success: boolean; error?: string }> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) {
    return { success: false, error: 'No user is currently signed in.' };
  }

  const trimmed = nickname.trim();
  try {
    // 1. Update Firebase Auth displayName
    await updateProfile(user, { displayName: trimmed });

    // 2. Update Firestore user profile
    const db = getFirestoreDB();
    if (db) {
      const userDocRef = doc(db, COLLECTION_USERS, user.uid);
      await setDoc(
        userDocRef,
        {
          uid: user.uid,
          email: user.email || '',
          nickname: trimmed,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    // 3. Cache in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`voxelorbit_nick_${user.uid}`, trimmed);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to update user nickname:', err);
    return { success: false, error: err.message || 'Could not update nickname.' };
  }
}

/**
 * Subscribe to all user profiles in Firestore (maps uid -> nickname, and email -> nickname).
 */
export function subscribeToUserProfiles(
  onUpdate: (profiles: Record<string, string>) => void
): Unsubscribe | null {
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    const colRef = collection(db, COLLECTION_USERS);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const map: Record<string, string> = {};
        snapshot.forEach((d) => {
          const data = d.data();
          if (data.nickname) {
            map[d.id] = data.nickname;
            if (data.email) {
              map[data.email.toLowerCase()] = data.nickname;
            }
          }
        });
        onUpdate(map);
      },
      (err) => {
        console.warn('User profiles subscription warning:', err);
      }
    );
  } catch (err) {
    console.warn('Could not establish user profiles listener:', err);
    return null;
  }
}

/**
 * Resolve display name for a plane's creator:
 * If the user has a Nickname, return Nickname.
 * If Nickname is null/empty, return Email.
 */
export function getModelCreatorDisplayName(
  model: { createdBy?: string; createdById?: string } | null | undefined,
  userProfiles?: Record<string, string>,
  currentUser?: { uid?: string; email?: string | null; displayName?: string | null } | null
): string {
  if (!model) return 'Default System';

  // 1. If createdById matches a known profile in userProfiles
  if (model.createdById && userProfiles && userProfiles[model.createdById]) {
    return userProfiles[model.createdById];
  }

  // 2. If createdById matches the current user
  if (currentUser && model.createdById && model.createdById === currentUser.uid) {
    if (currentUser.displayName && currentUser.displayName.trim()) {
      return currentUser.displayName.trim();
    }
    if (currentUser.email) {
      return currentUser.email;
    }
  }

  // 3. If createdBy is an email and that email has a nickname in userProfiles
  if (model.createdBy && userProfiles && userProfiles[model.createdBy.toLowerCase()]) {
    return userProfiles[model.createdBy.toLowerCase()];
  }

  // 4. If createdBy is a valid email or custom name (not generic 'Authorized User')
  if (model.createdBy && model.createdBy !== 'Authorized User') {
    return model.createdBy;
  }

  // 5. Fallback for the current user if createdBy is 'Authorized User'
  if (currentUser?.displayName && currentUser.displayName.trim()) {
    return currentUser.displayName.trim();
  }
  if (currentUser?.email) {
    return currentUser.email;
  }

  return model.createdBy || 'Default System';
}

/**
 * Upload binary GLB blob to Firebase Storage and get permanent download URL.
 */
export async function uploadModelBlob(
  modelId: string,
  fileName: string,
  blob: Blob
): Promise<string | null> {
  const storage = getFirebaseStorage();
  if (!storage) return null;

  try {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileRef = storageRef(storage, `models/${modelId}/${cleanFileName}`);
    const snapshot = await uploadBytes(fileRef, blob, {
      contentType: 'model/gltf-binary',
      customMetadata: {
        modelId,
        originalName: fileName,
      },
    });
    return await getDownloadURL(snapshot.ref);
  } catch (err) {
    console.warn('Firebase Storage upload warning (fallback to direct URL):', err);
    return null;
  }
}

/**
 * Save Firebase configuration override to localStorage and re-initialize.
 */
export function saveFirebaseConfig(config: FirebaseOptions): boolean {
  try {
    if (!config.apiKey || !config.projectId) {
      throw new Error('API Key and Project ID are required.');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    appInstance = null;
    firestoreInstance = null;
    authInstance = null;
    storageInstance = null;
    return !!getFirestoreDB();
  } catch (err) {
    console.error('Failed to save Firebase config:', err);
    return false;
  }
}

/**
 * Clear custom configuration and revert to default.
 */
export function clearFirebaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    appInstance = null;
    firestoreInstance = null;
    authInstance = null;
    storageInstance = null;
  } catch (err) {
    console.error('Failed to clear Firebase config:', err);
  }
}

/**
 * Test connectivity to Firebase Firestore.
 */
export async function testFirebaseConnection(
  configToTest?: FirebaseOptions
): Promise<{ success: boolean; message: string }> {
  try {
    const config = configToTest || getFirebaseConfig();
    const testApp = initializeApp(config, `test-app-${Date.now()}`);
    const testDb = getFirestore(testApp);
    const colRef = collection(testDb, COLLECTION_MODELS);
    await getDocs(colRef);
    return {
      success: true,
      message: `Connected to Firestore project "${config.projectId}" successfully!`,
    };
  } catch (err: any) {
    console.error('Firebase test connection failed:', err);
    let msg = err.message || 'Connection failed';
    if (msg.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
      msg = 'Permission denied: Please ensure your Firestore Security Rules allow read/write.';
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
    const colRef = collection(db, COLLECTION_MODELS);
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
            fileName: data.fileName || data.name,
            size: Number(data.size) || 0,
            fileUrl: data.fileUrl || '',
            thumbnailUrl: data.thumbnailUrl || undefined,
            createdAt: Number(data.createdAt) || Date.now(),
            updatedAt: Number(data.updatedAt) || Date.now(),
            createdBy: data.createdBy || 'Default Fleet',
            createdById: data.createdById || undefined,
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
export async function saveModelToCloud(
  model: ModelItem,
  userEmail?: string,
  userId?: string
): Promise<boolean> {
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    let cloudFileUrl = model.fileUrl;

    // If binary blob is present and URL is local object URL, upload to Firebase Storage
    if (model.fileBlob && model.fileUrl.startsWith('blob:')) {
      const storageUrl = await uploadModelBlob(model.id, model.name, model.fileBlob);
      if (storageUrl) {
        cloudFileUrl = storageUrl;
        model.fileUrl = storageUrl;
      }
    }

    const docRef = doc(db, COLLECTION_MODELS, model.id);
    const cleanRecord: Record<string, any> = {
      id: model.id,
      name: model.name,
      fileName: model.fileName || model.name,
      size: model.size,
      fileUrl: cloudFileUrl.startsWith('blob:') ? '' : cloudFileUrl,
      createdAt: model.createdAt || Date.now(),
      updatedAt: Date.now(),
      createdBy: model.createdBy || userEmail || 'Authorized User',
      createdById: model.createdById || userId || '',
      isDefault: !!model.isDefault,
      serverSynced: true,
      tags: model.tags || [],
      metrics: model.metrics || {},
    };

    if (model.thumbnailUrl) {
      cleanRecord.thumbnailUrl = model.thumbnailUrl;
    }

    await setDoc(docRef, cleanRecord, { merge: true });

    // Record activity audit log
    await logActivity(
      'added',
      model.id,
      model.name,
      model.createdBy || userEmail || 'Authorized User',
      model.createdById || userId || '',
      `Saved 3D model (${(model.size / (1024 * 1024)).toFixed(2)} MB)`
    );

    return true;
  } catch (err) {
    console.warn('Failed to save model to Firestore:', err);
    return false;
  }
}

/**
 * Update an existing model in Firebase Firestore (e.g. Rename, Thumbnail).
 */
export async function updateModelInCloud(
  id: string,
  updates: Partial<ModelItem>,
  userEmail?: string,
  userId?: string,
  logDescription?: string
): Promise<boolean> {
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const docRef = doc(db, COLLECTION_MODELS, id);
    const cleanUpdates: Record<string, any> = {
      ...updates,
      updatedAt: Date.now(),
      serverSynced: true,
    };
    delete cleanUpdates.fileBlob;

    await updateDoc(docRef, cleanUpdates);

    // Record activity audit log if naming or structural changes occurred
    if (updates.name) {
      await logActivity(
        'renamed',
        id,
        updates.name,
        userEmail || 'Authorized User',
        userId || '',
        logDescription || `Renamed model to "${updates.name}"`
      );
    } else if (logDescription) {
      await logActivity(
        'modified',
        id,
        updates.name || id,
        userEmail || 'Authorized User',
        userId || '',
        logDescription
      );
    }

    return true;
  } catch (err) {
    console.warn('Failed to update model in Firestore:', err);
    return false;
  }
}

/**
 * Delete a model from Firebase Firestore.
 */
export async function deleteModelFromCloud(
  id: string,
  modelName?: string,
  userEmail?: string,
  userId?: string
): Promise<boolean> {
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const docRef = doc(db, COLLECTION_MODELS, id);
    await deleteDoc(docRef);

    // Try deleting object from Firebase Storage if applicable
    const storage = getFirebaseStorage();
    if (storage && modelName) {
      const cleanFileName = modelName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileRef = storageRef(storage, `models/${id}/${cleanFileName}`);
      deleteObject(fileRef).catch(() => {});
    }

    // Record activity audit log
    await logActivity(
      'deleted',
      id,
      modelName || id,
      userEmail || 'Authorized User',
      userId || '',
      `Deleted model "${modelName || id}" from cloud database`
    );

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
    const colRef = collection(db, COLLECTION_MODELS);
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
        createdBy: data.createdBy || 'Default Fleet',
        createdById: data.createdById || undefined,
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

/**
 * Log an audit action to Firestore.
 */
export async function logActivity(
  action: 'added' | 'modified' | 'deleted' | 'renamed' | 'duplicate_skipped',
  modelId: string,
  modelName: string,
  userEmail: string,
  userId?: string,
  details?: string
): Promise<void> {
  const db = getFirestoreDB();
  if (!db) return;

  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logDoc = doc(db, COLLECTION_LOGS, logId);
    const entry: ActivityLog = {
      id: logId,
      action,
      modelId,
      modelName,
      userEmail: userEmail || 'Authorized User',
      userId: userId || '',
      timestamp: Date.now(),
      details: details || '',
    };
    await setDoc(logDoc, entry);
  } catch (err) {
    console.warn('Could not record activity log in Firestore:', err);
  }
}

/**
 * Subscribe to real-time activity logs.
 */
export function subscribeToActivityLogs(
  onUpdate: (logs: ActivityLog[]) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    const colRef = collection(db, COLLECTION_LOGS);
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(150));

    return onSnapshot(
      q,
      (snapshot) => {
        const logs: ActivityLog[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          logs.push({
            id: data.id || d.id,
            action: data.action || 'modified',
            modelId: data.modelId || '',
            modelName: data.modelName || 'Model',
            userEmail: data.userEmail || 'Authorized User',
            userId: data.userId || '',
            timestamp: Number(data.timestamp) || Date.now(),
            details: data.details || '',
          });
        });
        onUpdate(logs);
      },
      (err) => {
        console.warn('Activity logs subscription error:', err);
        onError?.(err);
      }
    );
  } catch (err: any) {
    console.warn('Failed to listen for activity logs:', err);
    onError?.(err);
    return null;
  }
}
