/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { Viewer3D } from './components/Viewer3D';
import { TopNav } from './components/TopNav';
import { ModelLibrary } from './components/ModelLibrary';
import { InspectorPanel } from './components/InspectorPanel';
import { QuickToolbar } from './components/QuickToolbar';
import { UploadModal } from './components/UploadModal';
import { SnapshotModal } from './components/SnapshotModal';
import { RenameModal } from './components/RenameModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { CloudConfigModal } from './components/CloudConfigModal';
import { LoginPage } from './components/LoginPage';
import { ActivityLogsModal } from './components/ActivityLogsModal';
import { UserProfileModal } from './components/UserProfileModal';
import {
  isCloudConfigured,
  subscribeToCloudModels,
  saveModelToCloud,
  updateModelInCloud,
  deleteModelFromCloud,
  getFirebaseConfig,
  subscribeToAuth,
  signOutUser,
  subscribeToUserProfiles,
  logActivity,
} from './utils/firebase';
import type { User } from 'firebase/auth';
import {
  LightingPreset,
  RenderMode,
  BackgroundMode,
  CameraViewPreset,
  ModelItem,
  formatModelDisplayName,
} from './types/model';
import { SceneNode, MaterialDetail } from './utils/modelAnalyzer';
import { DEFAULT_AIRCRAFT_MODELS } from './utils/defaultModels';
import {
  saveModelToDB,
  getAllModelsFromDB,
  deleteModelFromDB,
  updateModelInDB,
  checkIsDuplicate,
  checkServerStatus,
  requestPersistentStorage,
} from './utils/db';
import { Upload, AlertCircle } from 'lucide-react';

export default function App() {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [currentModel, setCurrentModel] = useState<ModelItem | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dbStatus, setDbStatus] = useState<{ online: boolean; message: string }>({
    online: true,
    message: 'Initializing Database...',
  });

  // Studio Settings
  const [lighting, setLighting] = useState<LightingPreset>('studio');
  const [renderMode, setRenderMode] = useState<RenderMode>('shaded');
  const [background, setBackground] = useState<BackgroundMode>('obsidian');
  const [customBgColor, setCustomBgColor] = useState('#09090b');
  const [autoRotate, setAutoRotate] = useState(false);
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(2.0);
  const [showGrid, setShowGrid] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [showBoundingBox, setShowBoundingBox] = useState(false);
  const [cameraFov, setCameraFov] = useState(45);
  const [isOrthographic, setIsOrthographic] = useState(false);
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<{
    preset: CameraViewPreset;
    timestamp: number;
  } | null>(null);
  const [resetViewTrigger, setResetViewTrigger] = useState(0);
  const [zoomTrigger, setZoomTrigger] = useState<{ delta: number; timestamp: number } | null>(null);

  const handleZoomIn = useCallback(() => {
    setZoomTrigger({ delta: -1, timestamp: Date.now() });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomTrigger({ delta: 1, timestamp: Date.now() });
  }, []);

  // Animation Settings
  const [activeAnimationIndex, setActiveAnimationIndex] = useState(0);
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Model Inspection State
  const [hierarchy, setHierarchy] = useState<SceneNode | null>(null);
  const [materials, setMaterials] = useState<MaterialDetail[]>([]);
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [materialOverrides, setMaterialOverrides] = useState<
    Record<string, { colorHex?: string; roughness?: number; metalness?: number; wireframe?: boolean }>
  >({});

  // Layout UI Toggles
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalTab, setUploadModalTab] = useState<'upload' | 'url'>('upload');
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<ModelItem | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [cloudSyncVersion, setCloudSyncVersion] = useState(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isActivityLogsOpen, setIsActivityLogsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});
  const [globalDragActive, setGlobalDragActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const dragCounter = useRef(0);

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Subscribe to User Profiles in Firestore
  useEffect(() => {
    const unsub = subscribeToUserProfiles((profiles) => {
      setUserProfiles(profiles);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const activeUserNickname =
    currentUser?.displayName ||
    (currentUser?.uid ? userProfiles[currentUser.uid] : null);

  // Toast notification helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    setCurrentUser(null);
    showToast('Signed out of 3D Portal');
  }, [showToast]);

  // 1. Initial Load: Retrieve from Database or Load Real Aircraft GLBs
  useEffect(() => {
    let isCancelled = false;

    async function initPlatform() {
      try {
        await requestPersistentStorage();
        
        // Check Cloud status
        const isCloud = isCloudConfigured();
        const firebaseConfig = getFirebaseConfig();

        if (isCloud && firebaseConfig?.projectId) {
          if (!isCancelled) {
            setDbStatus({
              online: true,
              message: `Cloud: ${firebaseConfig.projectId}`,
            });
          }
        } else {
          const serverStatus = await checkServerStatus();
          if (!isCancelled) {
            setDbStatus(serverStatus.online ? serverStatus : { online: false, message: 'Local (Click to Sync)' });
          }
        }

        const storedModels = await getAllModelsFromDB();
        if (isCancelled) return;

        const isInitialized = localStorage.getItem('voxelorbit_db_initialized') === 'true';

        // Filter out any legacy synthetic/procedural models ("Cyber_Stealth_Drone", etc.)
        const validStored = (storedModels || []).filter(
          (m) =>
            !m.isSample &&
            m.name !== 'Cyber_Stealth_Drone' &&
            m.name !== 'Quantum_Resonance_Orb' &&
            m.name !== 'Retro_Arcade_Cabinet' &&
            m.name !== 'Holo_Crystal_Array'
        );

        if (validStored && validStored.length > 0) {
          setModels(validStored);
          setCurrentModel(validStored[0]);
        } else if (!isInitialized) {
          // Initialize with real aircraft GLB models from the provided archives on first launch
          setModels(DEFAULT_AIRCRAFT_MODELS);
          setCurrentModel(DEFAULT_AIRCRAFT_MODELS[0]);
          for (const s of DEFAULT_AIRCRAFT_MODELS) {
            await saveModelToDB(s);
          }
          localStorage.setItem('voxelorbit_db_initialized', 'true');
        } else {
          // User intentionally deleted all models from the library
          setModels([]);
          setCurrentModel(null);
        }
      } catch (err) {
        console.error('Error initializing models:', err);
        setModels(DEFAULT_AIRCRAFT_MODELS);
        setCurrentModel(DEFAULT_AIRCRAFT_MODELS[0]);
      } finally {
        if (!isCancelled) {
          setIsInitializing(false);
          // Auto open panels on desktop
          if (window.innerWidth >= 1024) {
            setIsLibraryOpen(true);
            setIsInspectorOpen(true);
          }
        }
      }
    }

    initPlatform();

    return () => {
      isCancelled = true;
    };
  }, [cloudSyncVersion]);

  // 1b. Real-Time Cloud Firestore Sync Listener
  useEffect(() => {
    if (!isCloudConfigured()) return;

    const unsubscribe = subscribeToCloudModels(
      (cloudModels) => {
        if (cloudModels && cloudModels.length > 0) {
          setModels(cloudModels);
          setCurrentModel((prev) => {
            if (!prev) return cloudModels[0];
            const match = cloudModels.find((m) => m.id === prev.id);
            return match || cloudModels[0];
          });
          // Cache in local IndexedDB for fast offline startup
          for (const cm of cloudModels) {
            saveModelToDB(cm).catch(() => {});
          }
        }
      },
      (err) => {
        console.warn('Real-time cloud sync warning, using local fallback:', err);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [cloudSyncVersion]);

  // 2. Window Drag and Drop Handling for any GLB or ZIP
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        setGlobalDragActive(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        setGlobalDragActive(false);
        dragCounter.current = 0;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setGlobalDragActive(false);
      dragCounter.current = 0;

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleUploadFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // 3. Handle File Uploads (GLB / GLTF / ZIP) with Duplicate Prevention
  const handleUploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const glbOrGltfFiles: File[] = [];
      let zipExtractedCount = 0;

      // Process dropped files and unpack any .zip archives
      for (const f of fileArray) {
        if (f.name.toLowerCase().endsWith('.zip')) {
          try {
            showToast(`Unpacking ZIP: ${f.name}...`);
            const zip = await JSZip.loadAsync(f);
            const entries = Object.keys(zip.files);

            for (const filename of entries) {
              const entry = zip.files[filename];
              if (
                !entry.dir &&
                (filename.toLowerCase().endsWith('.glb') ||
                  filename.toLowerCase().endsWith('.gltf'))
              ) {
                const blob = await entry.async('blob');
                const cleanName = filename.split('/').pop() || filename;
                const extractedFile = new File([blob], cleanName, {
                  type: cleanName.toLowerCase().endsWith('.glb')
                    ? 'model/gltf-binary'
                    : 'model/gltf+json',
                });
                glbOrGltfFiles.push(extractedFile);
                zipExtractedCount++;
              }
            }
          } catch (err) {
            console.error('Error unpacking zip file:', err);
            showToast(`Could not extract ZIP archive: ${f.name}`);
          }
        } else if (
          f.name.toLowerCase().endsWith('.glb') ||
          f.name.toLowerCase().endsWith('.gltf') ||
          f.type === 'model/gltf-binary'
        ) {
          glbOrGltfFiles.push(f);
        }
      }

      if (zipExtractedCount > 0) {
        showToast(`Extracted ${zipExtractedCount} 3D model(s) from ZIP archive!`);
      }

      if (glbOrGltfFiles.length === 0) {
        showToast('Please upload valid .glb, .gltf, or .zip archive containing 3D models.');
        return;
      }

      const newItems: ModelItem[] = [];
      const skippedDuplicates: string[] = [];

      // Check each candidate file against duplicates
      for (const file of glbOrGltfFiles) {
        const duplicateCheck = checkIsDuplicate([...models, ...newItems], {
          name: file.name,
          fileName: file.name,
          size: file.size,
        });

        if (duplicateCheck.isDuplicate) {
          skippedDuplicates.push(file.name);
          const creatorDisplayName =
            activeUserNickname?.trim() ||
            currentUser?.email ||
            'Authorized User';
          const reasonMsg = duplicateCheck.duplicateOf
            ? `File "${file.name}" was not imported because of duplication with existing model "${duplicateCheck.duplicateOf.fileName || duplicateCheck.duplicateOf.name}".`
            : `File "${file.name}" was not imported because of duplication.`;

          if (isCloudConfigured()) {
            logActivity(
              'duplicate_skipped',
              duplicateCheck.duplicateOf?.id || 'duplicate',
              file.name,
              creatorDisplayName,
              currentUser?.uid,
              reasonMsg
            ).catch(console.warn);
          }
          continue;
        }

        const url = URL.createObjectURL(file);
        const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const creatorDisplayName =
          activeUserNickname?.trim() ||
          currentUser?.email ||
          'Authorized User';

        const newItem: ModelItem = {
          id,
          name: formatModelDisplayName(file.name),
          fileName: file.name,
          size: file.size,
          fileUrl: url,
          fileBlob: file,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: creatorDisplayName,
          createdById: currentUser?.uid || '',
          metrics: {
            triangles: 0,
            vertices: 0,
            meshes: 0,
            materials: 0,
            textures: 0,
            animations: 0,
            dimensions: { x: 0, y: 0, z: 0 },
            animationNames: [],
          },
        };

        newItems.push(newItem);
        await saveModelToDB(newItem);

        // Record activity log for newly added model
        logActivity(
          'added',
          newItem.id,
          newItem.name,
          creatorDisplayName,
          currentUser?.uid,
          `Added 3D plane "${newItem.name}" (${(newItem.size / (1024 * 1024)).toFixed(2)} MB)`
        ).catch(console.warn);

        if (isCloudConfigured()) {
          saveModelToCloud(
            newItem,
            creatorDisplayName,
            currentUser?.uid
          ).catch((err) =>
            console.warn('Cloud sync error on upload:', err)
          );
        }
      }

      if (newItems.length > 0) {
        setModels((prev) => [...newItems, ...prev]);
        setCurrentModel(newItems[0]);
        // Reset transient overrides
        setMaterialOverrides({});
        setHiddenNodeIds(new Set());
        setFocusedNodeId(null);
        setActiveAnimationIndex(0);
      }

      // User feedback on imported items and duplicates
      if (newItems.length > 0 && skippedDuplicates.length > 0) {
        showToast(
          `Imported ${newItems.length} model(s). Notice: ${skippedDuplicates.length} file(s) not imported because of duplication: ${skippedDuplicates.join(', ')}`
        );
      } else if (newItems.length > 0) {
        showToast(
          `Successfully saved ${newItems.length} 3D model${newItems.length > 1 ? 's' : ''} to database!`
        );
      } else if (skippedDuplicates.length > 0) {
        showToast(
          `This file is not imported because of duplication: ${skippedDuplicates.join(', ')}`
        );
      }
    },
    [models, showToast, activeUserNickname, currentUser]
  );

  // 4. Handle Direct URL Import with Duplicate Prevention
  const handleImportUrl = useCallback(
    async (url: string, name?: string): Promise<boolean> => {
      try {
        const resolvedName =
          name || url.split('/').pop()?.split('#')[0].split('?')[0] || 'Imported_Model.glb';
        const cleanName = resolvedName.toLowerCase().endsWith('.glb')
          ? resolvedName
          : `${resolvedName}.glb`;

        // Check if candidate name is duplicate
        const duplicateCheck = checkIsDuplicate(models, {
          name: cleanName,
          fileName: cleanName,
          size: 0,
        });
        if (duplicateCheck.isDuplicate) {
          const reasonMsg = `This file is not imported because of duplication: "${cleanName}"`;
          showToast(reasonMsg);
          if (isCloudConfigured()) {
            logActivity(
              'duplicate_skipped',
              duplicateCheck.duplicateOf?.id || 'duplicate',
              cleanName,
              activeUserNickname?.trim() || currentUser?.email || 'Authorized User',
              currentUser?.uid,
              `File "${cleanName}" was not imported because of duplication.`
            ).catch(console.warn);
          }
          return false;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();

        // Check with actual size
        const sizeCheck = checkIsDuplicate(models, {
          name: cleanName,
          fileName: cleanName,
          size: blob.size,
        });
        if (sizeCheck.isDuplicate) {
          const reasonMsg = `This file is not imported because of duplication: "${cleanName}" (${(blob.size / (1024 * 1024)).toFixed(1)} MB)`;
          showToast(reasonMsg);
          if (isCloudConfigured()) {
            logActivity(
              'duplicate_skipped',
              sizeCheck.duplicateOf?.id || 'duplicate',
              cleanName,
              activeUserNickname?.trim() || currentUser?.email || 'Authorized User',
              currentUser?.uid,
              `File "${cleanName}" was not imported because of duplication.`
            ).catch(console.warn);
          }
          return false;
        }

        const fileUrl = URL.createObjectURL(blob);
        const id = `url-${Date.now()}`;
        const creatorDisplayName =
          activeUserNickname?.trim() ||
          currentUser?.email ||
          'Authorized User';

        const newItem: ModelItem = {
          id,
          name: formatModelDisplayName(cleanName),
          fileName: cleanName,
          size: blob.size,
          fileUrl,
          fileBlob: blob,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: creatorDisplayName,
          createdById: currentUser?.uid || '',
          metrics: {
            triangles: 0,
            vertices: 0,
            meshes: 0,
            materials: 0,
            textures: 0,
            animations: 0,
            dimensions: { x: 0, y: 0, z: 0 },
            animationNames: [],
          },
        };

        await saveModelToDB(newItem);

        // Record activity log for newly imported model
        logActivity(
          'added',
          newItem.id,
          newItem.name,
          creatorDisplayName,
          currentUser?.uid,
          `Imported 3D plane "${newItem.name}" from URL (${(newItem.size / (1024 * 1024)).toFixed(2)} MB)`
        ).catch(console.warn);

        if (isCloudConfigured()) {
          saveModelToCloud(
            newItem,
            creatorDisplayName,
            currentUser?.uid
          ).catch((err) =>
            console.warn('Cloud sync error on import:', err)
          );
        }
        setModels((prev) => [newItem, ...prev]);
        setCurrentModel(newItem);
        setMaterialOverrides({});
        setHiddenNodeIds(new Set());
        setFocusedNodeId(null);
        setActiveAnimationIndex(0);

        showToast(`Model "${cleanName}" imported & saved to database!`);
        return true;
      } catch (err: any) {
        console.error('URL import error:', err);
        return false;
      }
    },
    [models, showToast]
  );

  // 5. Handle Renaming GLB Model (Settings & Persistence)
  const handleRenameModel = useCallback(
    async (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;

      const targetModel = models.find((m) => m.id === id);
      const oldName = targetModel ? formatModelDisplayName(targetModel.name) : id;

      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, name: trimmed, updatedAt: Date.now() } : m))
      );

      if (currentModel?.id === id) {
        setCurrentModel((prev) => (prev ? { ...prev, name: trimmed, updatedAt: Date.now() } : null));
      }

      await updateModelInDB(id, { name: trimmed });

      const userDisplayName =
        activeUserNickname?.trim() ||
        currentUser?.email ||
        'Authorized User';

      // Always record rename immediately in Activity Logs
      await logActivity(
        'renamed',
        id,
        trimmed,
        userDisplayName,
        currentUser?.uid,
        `Renamed plane from "${oldName}" to "${trimmed}"`
      );

      if (isCloudConfigured()) {
        updateModelInCloud(
          id,
          { name: trimmed },
          userDisplayName,
          currentUser?.uid,
          `Renamed plane from "${oldName}" to "${trimmed}"`
        ).catch((err) =>
          console.warn('Cloud sync error on rename:', err)
        );
      }
      showToast(`Renamed to "${trimmed}" & updated in database.`);
    },
    [models, currentModel, currentUser, activeUserNickname, showToast]
  );

  // 6. Delete Model
  const handleDeleteModel = useCallback(
    async (id: string) => {
      const targetModel = models.find((m) => m.id === id);
      const modelDisplayName = targetModel ? formatModelDisplayName(targetModel.name) : id;
      const userDisplayName =
        activeUserNickname?.trim() ||
        currentUser?.email ||
        'Authorized User';

      // Always record delete immediately in Activity Logs
      await logActivity(
        'deleted',
        id,
        modelDisplayName,
        userDisplayName,
        currentUser?.uid,
        `Deleted plane "${modelDisplayName}" from library`
      );

      try {
        await deleteModelFromDB(id);
      } catch (err) {
        console.error('Failed to delete model from DB:', err);
      }

      if (isCloudConfigured()) {
        deleteModelFromCloud(
          id,
          targetModel?.name,
          userDisplayName,
          currentUser?.uid
        ).catch((err) =>
          console.warn('Cloud sync error on delete:', err)
        );
      }

      const nextModels = models.filter((m) => m.id !== id);
      setModels(nextModels);

      if (currentModel?.id === id) {
        const nextActive = nextModels[0] || null;
        setCurrentModel(nextActive);
        setMaterialOverrides({});
        setHiddenNodeIds(new Set());
        setFocusedNodeId(null);
        setActiveAnimationIndex(0);
      }
      showToast('Model removed from library & database.');
    },
    [models, currentModel, currentUser, activeUserNickname, showToast]
  );

  // 6b. Toggle Neo Game Deployment Marker
  const handleToggleNeoGame = useCallback(
    async (id: string) => {
      const targetModel = models.find((m) => m.id === id);
      if (!targetModel) return;

      const nextStatus = !targetModel.inNeoGame;
      const userDisplayName =
        activeUserNickname?.trim() ||
        currentUser?.email ||
        'Authorized User';

      const updates: Partial<ModelItem> = {
        inNeoGame: nextStatus,
        neoGameAddedAt: nextStatus ? Date.now() : undefined,
        neoGameAddedBy: nextStatus ? userDisplayName : undefined,
        updatedAt: Date.now(),
      };

      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      );

      if (currentModel?.id === id) {
        setCurrentModel((prev) => (prev ? { ...prev, ...updates } : null));
      }

      await updateModelInDB(id, updates);

      const planeName = formatModelDisplayName(targetModel.name);

      // Record activity log
      await logActivity(
        'modified',
        id,
        planeName,
        userDisplayName,
        currentUser?.uid,
        nextStatus
          ? `Marked plane "${planeName}" as added to Neo Game 🎮`
          : `Removed plane "${planeName}" from Neo Game roster`
      );

      if (isCloudConfigured()) {
        updateModelInCloud(
          id,
          updates,
          userDisplayName,
          currentUser?.uid,
          nextStatus
            ? `Marked plane "${planeName}" as added to Neo Game 🎮`
            : `Removed plane "${planeName}" from Neo Game roster`
        ).catch((err) =>
          console.warn('Cloud sync error on neo game toggle:', err)
        );
      }

      showToast(
        nextStatus
          ? `✓ "${planeName}" marked as added to Neo Game!`
          : `"${planeName}" removed from Neo Game roster.`
      );
    },
    [models, currentModel, currentUser, activeUserNickname, showToast]
  );

  // 7. Reload Default Aircraft Fleet
  const handleLoadDefaults = useCallback(async () => {
    showToast('Restoring real aircraft fleet...');
    localStorage.setItem('voxelorbit_db_initialized', 'true');
    for (const m of DEFAULT_AIRCRAFT_MODELS) {
      await saveModelToDB(m);
      if (isCloudConfigured()) {
        saveModelToCloud(m).catch(() => {});
      }
    }
    setModels((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const fresh = DEFAULT_AIRCRAFT_MODELS.filter((m) => !existingIds.has(m.id));
      return [...fresh, ...prev];
    });
    if (DEFAULT_AIRCRAFT_MODELS.length > 0) {
      setCurrentModel(DEFAULT_AIRCRAFT_MODELS[0]);
    }
    showToast('10 real aircraft GLBs restored and saved in database!');
  }, [showToast]);

  // 8. Analysis Update from Viewer3D
  const handleModelAnalyzed = useCallback(
    (
      metrics: ModelItem['metrics'],
      sceneHierarchy: SceneNode,
      materialDetails: MaterialDetail[]
    ) => {
      setHierarchy(sceneHierarchy);
      setMaterials(materialDetails);

      if (currentModel) {
        const currentTris = currentModel.metrics?.triangles;
        if (!currentTris || currentTris !== metrics.triangles) {
          setModels((prev) =>
            prev.map((m) => (m.id === currentModel.id ? { ...m, metrics } : m))
          );
          setCurrentModel((prev) => (prev ? { ...prev, metrics } : null));
        }
      }
    },
    [currentModel]
  );

  // 9. Capture Thumbnail callback
  const handleCaptureThumbnail = useCallback(
    (dataUrl: string) => {
      if (currentModel && !currentModel.thumbnailUrl) {
        setModels((prev) =>
          prev.map((m) => (m.id === currentModel.id ? { ...m, thumbnailUrl: dataUrl } : m))
        );
        setCurrentModel((prev) => (prev ? { ...prev, thumbnailUrl: dataUrl } : null));
        updateModelInDB(currentModel.id, { thumbnailUrl: dataUrl }).catch(() => {});
        if (isCloudConfigured()) {
          updateModelInCloud(currentModel.id, { thumbnailUrl: dataUrl }).catch(() => {});
        }
      }
    },
    [currentModel]
  );

  // 10. Snapshot high-res trigger
  const handleTakeSnapshot = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    setSnapshotUrl(dataUrl);
    setIsSnapshotModalOpen(true);
  }, []);

  // 11. Toggle node visibility
  const handleToggleNodeVisibility = useCallback((nodeId: string) => {
    setHiddenNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // 12. Material update
  const handleUpdateMaterial = useCallback(
    (
      materialId: string,
      updates: { colorHex?: string; roughness?: number; metalness?: number; wireframe?: boolean }
    ) => {
      setMaterialOverrides((prev) => ({
        ...prev,
        [materialId]: {
          ...prev[materialId],
          ...updates,
        },
      }));

      if (currentModel) {
        const userDisplayName = activeUserNickname?.trim() || currentUser?.email || 'Authorized User';
        const changedProps = Object.keys(updates).join(', ');
        logActivity(
          'modified',
          currentModel.id,
          formatModelDisplayName(currentModel.name),
          userDisplayName,
          currentUser?.uid,
          `Modified material properties (${changedProps})`
        ).catch(console.warn);
      }
    },
    [currentModel, activeUserNickname, currentUser]
  );

  // 13. Fullscreen Toggle
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // 14. Authentication Gatekeeper
  if (isAuthLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="w-10 h-10 border-2 border-neutral-700 border-t-sky-400 rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-neutral-400">Connecting to Firebase Cloud...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-neutral-950 text-neutral-100 font-sans">
      {/* Global Drag-and-Drop Overlay */}
      {globalDragActive && (
        <div className="fixed inset-0 z-50 bg-sky-950/70 border-4 border-dashed border-sky-400 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none transition-all">
          <div className="p-6 rounded-3xl bg-neutral-900/90 border border-sky-500/40 shadow-2xl flex flex-col items-center gap-3">
            <Upload className="w-12 h-12 text-sky-400 animate-bounce" />
            <h2 className="text-xl font-bold text-white tracking-tight">
              Drop 3D GLB or ZIP File to Load
            </h2>
            <p className="text-sm text-neutral-300">
              Automatic duplicate checking & database persistence enabled
            </p>
          </div>
        </div>
      )}

      {/* Top Header Navigation */}
      <TopNav
        currentModel={currentModel}
        models={models}
        onSelectModel={(model) => {
          setCurrentModel(model);
          setMaterialOverrides({});
          setHiddenNodeIds(new Set());
          setFocusedNodeId(null);
          setActiveAnimationIndex(0);
        }}
        onOpenUploadModal={() => {
          setUploadModalTab('upload');
          setIsUploadModalOpen(true);
        }}
        onOpenUrlModal={() => {
          setUploadModalTab('url');
          setIsUploadModalOpen(true);
        }}
        onTakeSnapshot={handleTakeSnapshot}
        onOpenRenameModal={() => setIsRenameModalOpen(true)}
        isLibraryOpen={isLibraryOpen}
        onToggleLibrary={() => setIsLibraryOpen(!isLibraryOpen)}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        onOpenActivityLogs={() => setIsActivityLogsOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        userEmail={currentUser?.email}
        userNickname={activeUserNickname}
        onSignOut={handleSignOut}
        dbStatus={dbStatus}
      />

      {/* Main Studio Viewport & Sidebars */}
      <main className="relative flex-1 w-full overflow-hidden flex">
        {/* Left: Model Library Drawer / Sidebar */}
        <ModelLibrary
          models={models}
          currentModel={currentModel}
          onSelectModel={(model) => {
            setCurrentModel(model);
            setMaterialOverrides({});
            setHiddenNodeIds(new Set());
            setFocusedNodeId(null);
            setActiveAnimationIndex(0);
          }}
          onDeleteModel={handleDeleteModel}
          onRequestDelete={(model) => setModelToDelete(model)}
          onRenameModel={handleRenameModel}
          onUploadFiles={handleUploadFiles}
          onOpenUrlModal={() => {
            setUploadModalTab('url');
            setIsUploadModalOpen(true);
          }}
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
          onOpen={() => setIsLibraryOpen(true)}
          onLoadDefaults={handleLoadDefaults}
          onOpenCloudModal={() => setIsCloudModalOpen(true)}
          userProfiles={userProfiles}
          currentUser={currentUser}
          dbStatus={dbStatus}
          onToggleNeoGame={handleToggleNeoGame}
        />

        {/* Center: 3D WebGL Viewport */}
        <div className="relative flex-1 w-full h-full overflow-hidden">
          {isInitializing ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-neutral-950">
              <div className="w-10 h-10 border-2 border-neutral-700 border-t-sky-400 rounded-full animate-spin" />
              <p className="text-sm font-medium text-neutral-300">Loading 3D Models & Database...</p>
            </div>
          ) : currentModel ? (
            <Viewer3D
              currentModel={currentModel}
              lighting={lighting}
              renderMode={renderMode}
              background={background}
              customBgColor={customBgColor}
              autoRotate={autoRotate}
              autoRotateSpeed={autoRotateSpeed}
              showGrid={showGrid}
              showShadows={showShadows}
              showBoundingBox={showBoundingBox}
              cameraFov={cameraFov}
              isOrthographic={isOrthographic}
              cameraPresetTrigger={cameraPresetTrigger}
              resetViewTrigger={resetViewTrigger}
              zoomTrigger={zoomTrigger}
              activeAnimationIndex={activeAnimationIndex}
              isPlayingAnimation={isPlayingAnimation}
              animationSpeed={animationSpeed}
              animationProgress={animationProgress}
              onAnimationTimeUpdate={(prog) => setAnimationProgress(prog)}
              onModelAnalyzed={handleModelAnalyzed}
              onCaptureThumbnail={handleCaptureThumbnail}
              hiddenNodeIds={hiddenNodeIds}
              focusedNodeId={focusedNodeId}
              materialOverrides={materialOverrides}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-950">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-100 mb-1">
                No 3D Models in Library
              </h2>
              <p className="text-xs text-neutral-400 max-w-sm mb-5">
                Drop any .glb file or .zip archive here, or browse your device to begin inspecting 3D geometry and animations.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setUploadModalTab('upload');
                    setIsUploadModalOpen(true);
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-sky-950"
                >
                  Upload GLB File
                </button>
                <button
                  onClick={handleLoadDefaults}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 rounded-xl text-xs font-medium transition-colors"
                >
                  Restore Aircraft Fleet
                </button>
              </div>
            </div>
          )}

          {/* Quick HUD Toolbar (Floating at Bottom) */}
          {currentModel && (
            <QuickToolbar
              renderMode={renderMode}
              onSetRenderMode={setRenderMode}
              showGrid={showGrid}
              onToggleGrid={() => setShowGrid(!showGrid)}
              autoRotate={autoRotate}
              onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
              onResetView={() => setResetViewTrigger(Date.now())}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onSelectCameraPreset={(preset) =>
                setCameraPresetTrigger({ preset, timestamp: Date.now() })
              }
              onTakeSnapshot={handleTakeSnapshot}
            />
          )}
        </div>

        {/* Right: Inspector & Studio Panel */}
        <InspectorPanel
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          currentModel={currentModel}
          hierarchy={hierarchy}
          materials={materials}
          lighting={lighting}
          onSetLighting={setLighting}
          background={background}
          onSetBackground={setBackground}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
          showShadows={showShadows}
          onToggleShadows={() => setShowShadows(!showShadows)}
          showBoundingBox={showBoundingBox}
          onToggleBoundingBox={() => setShowBoundingBox(!showBoundingBox)}
          cameraFov={cameraFov}
          onSetCameraFov={setCameraFov}
          isOrthographic={isOrthographic}
          onToggleOrthographic={() => setIsOrthographic(!isOrthographic)}
          autoRotate={autoRotate}
          onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
          autoRotateSpeed={autoRotateSpeed}
          onSetAutoRotateSpeed={setAutoRotateSpeed}
          activeAnimationIndex={activeAnimationIndex}
          onSelectAnimation={setActiveAnimationIndex}
          isPlayingAnimation={isPlayingAnimation}
          onTogglePlayAnimation={() => setIsPlayingAnimation(!isPlayingAnimation)}
          animationSpeed={animationSpeed}
          onSetAnimationSpeed={setAnimationSpeed}
          animationProgress={animationProgress}
          onSeekAnimation={setAnimationProgress}
          hiddenNodeIds={hiddenNodeIds}
          onToggleNodeVisibility={handleToggleNodeVisibility}
          focusedNodeId={focusedNodeId}
          onFocusNode={(nodeId) => setFocusedNodeId(nodeId)}
          materialOverrides={materialOverrides}
          onUpdateMaterial={handleUpdateMaterial}
          onRenameModel={handleRenameModel}
          onDeleteModel={handleDeleteModel}
          onRequestDelete={(model) => setModelToDelete(model)}
          userProfiles={userProfiles}
          currentUser={currentUser}
          onToggleNeoGame={handleToggleNeoGame}
        />
      </main>

      {/* Upload & Import Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadFiles={handleUploadFiles}
        onImportUrl={handleImportUrl}
        onLoadDefaults={handleLoadDefaults}
        initialTab={uploadModalTab}
      />

      {/* Snapshot Preview Modal */}
      <SnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        imageUrl={snapshotUrl}
        modelName={currentModel?.name || '3D_Render'}
      />

      {/* Rename Model Modal */}
      <RenameModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        model={currentModel}
        onRename={handleRenameModel}
        existingModels={models}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!modelToDelete}
        onClose={() => setModelToDelete(null)}
        model={modelToDelete}
        onConfirm={handleDeleteModel}
      />

      {/* Cloud Database Sync Modal */}
      <CloudConfigModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        onConfigChanged={() => {
          setCloudSyncVersion((v) => v + 1);
          showToast('Cloud database configuration updated!');
        }}
      />

      {/* Activity & Audit Logs Modal */}
      <ActivityLogsModal
        isOpen={isActivityLogsOpen}
        onClose={() => setIsActivityLogsOpen(false)}
      />

      {/* User Profile & Nickname Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onNicknameUpdated={(newNick) => {
          if (currentUser) {
            setUserProfiles((prev) => ({
              ...prev,
              [currentUser.uid]: newNick,
              ...(currentUser.email ? { [currentUser.email.toLowerCase()]: newNick } : {}),
            }));
          }
          showToast(newNick ? `Nickname saved: "${newNick}"` : 'Nickname reset to email');
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl text-xs font-medium text-neutral-100 flex items-center gap-2 backdrop-blur-md animate-fade-in max-w-md text-center">
          <AlertCircle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
