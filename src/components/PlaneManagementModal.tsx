import React, { useState, useMemo } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  Search,
  Cloud,
  HardDrive,
  Gamepad2,
  RotateCcw,
  CheckSquare,
  Square,
  RefreshCw,
  Box,
  User,
  Clock,
  Layers,
  ShieldAlert,
  Flame,
  Check,
} from 'lucide-react';
import { ModelItem, formatModelDisplayName } from '../types/model';
import {
  deleteAllModelsFromCloud,
  deleteMultipleModelsFromCloud,
  deleteModelFromCloud,
  isCloudConfigured,
} from '../utils/firebase';
import {
  clearAllModelsInDB,
  deleteMultipleModelsFromDB,
  deleteModelFromDB,
  recordMultipleDeletedModelIds,
  recordDeletedModelId,
  clearDeletedModelIds,
} from '../utils/db';
import { DEFAULT_AIRCRAFT_MODELS } from '../utils/defaultModels';

interface PlaneManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelItem[];
  currentModel: ModelItem | null;
  onModelsChanged: (nextModels: ModelItem[], nextActive: ModelItem | null) => void;
  onRestoreFleet: () => Promise<void>;
  userProfiles: Record<string, string>;
  currentUserEmail?: string | null;
  currentUserId?: string | null;
  currentUserNickname?: string | null;
  onShowToast: (msg: string, type?: 'info' | 'error' | 'success') => void;
  dbStatus: { online: boolean; message: string };
}

export const PlaneManagementModal: React.FC<PlaneManagementModalProps> = ({
  isOpen,
  onClose,
  models,
  currentModel,
  onModelsChanged,
  onRestoreFleet,
  userProfiles,
  currentUserEmail,
  currentUserId,
  currentUserNickname,
  onShowToast,
  dbStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'cloud' | 'game' | 'defaults'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingAllModalOpen, setIsDeletingAllModalOpen] = useState(false);
  const [isDeletingSelectedModalOpen, setIsDeletingSelectedModalOpen] = useState(false);
  const [planeToDeleteDirectly, setPlaneToDeleteDirectly] = useState<ModelItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const activeAuthor = currentUserNickname?.trim() || currentUserEmail || 'Authorized User';

  // Filtered planes
  const filteredPlanes = useMemo(() => {
    return models.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.fileName && m.fileName.toLowerCase().includes(q)) ||
        (m.createdBy && m.createdBy.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterType === 'cloud') return !!m.serverSynced || !m.isDefault;
      if (filterType === 'game') return !!m.inNeoGame;
      if (filterType === 'defaults') return !!m.isDefault;

      return true;
    });
  }, [models, searchQuery, filterType]);

  // Statistics
  const totalCount = models.length;
  const cloudCount = models.filter((m) => !!m.serverSynced || !m.isDefault).length;
  const gameCount = models.filter((m) => !!m.inNeoGame).length;
  const totalSizeBytes = models.reduce((acc, m) => acc + (m.size || 0), 0);
  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredPlanes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPlanes.map((m) => m.id)));
    }
  };

  const handleToggleSelectPlane = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Format creator name
  const formatCreator = (model: ModelItem) => {
    if (model.createdById && userProfiles[model.createdById]) {
      return userProfiles[model.createdById];
    }
    if (model.createdBy && userProfiles[model.createdBy.toLowerCase()]) {
      return userProfiles[model.createdBy.toLowerCase()];
    }
    return model.createdBy || 'Default System';
  };

  // Permanent Delete Single Plane
  const handleConfirmDeleteSingle = async (model: ModelItem) => {
    setIsProcessing(true);
    try {
      // 1. Delete from Cloud Firestore & Storage
      if (isCloudConfigured()) {
        await deleteModelFromCloud(model.id, model.name, activeAuthor, currentUserId || undefined);
      }
      // 2. Delete from local IndexedDB
      await deleteModelFromDB(model.id);
      recordDeletedModelId(model.id);

      // 3. Update active state
      const nextModels = models.filter((m) => m.id !== model.id);
      const nextActive = currentModel?.id === model.id ? (nextModels[0] || null) : currentModel;
      onModelsChanged(nextModels, nextActive);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(model.id);
        return next;
      });

      onShowToast(`Permanently deleted plane "${formatModelDisplayName(model.name)}"`, 'success');
      setPlaneToDeleteDirectly(null);
    } catch (err: any) {
      console.error('Delete single error:', err);
      onShowToast(`Failed to delete plane: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Permanent Delete Selected Planes
  const handleConfirmDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    const idsToDelete = Array.from(selectedIds);

    try {
      // 1. Delete from Cloud Firestore & Storage
      if (isCloudConfigured()) {
        await deleteMultipleModelsFromCloud(idsToDelete, activeAuthor, currentUserId || undefined);
      }

      // 2. Delete from local IndexedDB
      await deleteMultipleModelsFromDB(idsToDelete);
      recordMultipleDeletedModelIds(idsToDelete);

      // 3. Update active state
      const idSet = new Set(idsToDelete);
      const nextModels = models.filter((m) => !idSet.has(m.id));
      const nextActive = currentModel && idSet.has(currentModel.id) ? (nextModels[0] || null) : currentModel;
      onModelsChanged(nextModels, nextActive);

      setSelectedIds(new Set());
      setIsDeletingSelectedModalOpen(false);
      onShowToast(`Permanently deleted ${idsToDelete.length} plane(s) from Firebase Firestore and system`, 'success');
    } catch (err: any) {
      console.error('Delete selected error:', err);
      onShowToast(`Failed to delete selected planes: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Permanent Purge & Clean ALL Planes from Firebase Firestore and System
  const handleConfirmPurgeAll = async () => {
    setIsProcessing(true);
    try {
      let cloudDeleted = 0;
      // 1. Purge all records from Firebase Firestore
      if (isCloudConfigured()) {
        const cloudResult = await deleteAllModelsFromCloud(activeAuthor, currentUserId || undefined);
        cloudDeleted = cloudResult.deletedCount;
      }

      // 2. Purge all records from local IndexedDB
      await clearAllModelsInDB();

      // 3. Mark all current IDs as deleted to prevent auto-reloading
      const allIds = models.map((m) => m.id);
      recordMultipleDeletedModelIds(allIds);
      // Also record all default aircraft IDs so they are completely cleaned as requested
      recordMultipleDeletedModelIds(DEFAULT_AIRCRAFT_MODELS.map((dm) => dm.id));

      // 4. Reset library state
      onModelsChanged([], null);
      setSelectedIds(new Set());
      setIsDeletingAllModalOpen(false);

      onShowToast(
        `Firebase Firestore cleaned: Permanently deleted all ${cloudDeleted || allIds.length} plane(s) from the system!`,
        'success'
      );
    } catch (err: any) {
      console.error('Purge all error:', err);
      onShowToast(`Failed to purge Firestore: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore Fleet
  const handleRestoreFleetClick = async () => {
    setIsProcessing(true);
    try {
      await onRestoreFleet();
      setSelectedIds(new Set());
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800/90 flex items-center justify-between bg-neutral-900/60 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600/20 to-sky-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-neutral-100 tracking-tight">
                  Plane & Firestore Database Management
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono">
                  {models.length} Total Planes
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    dbStatus.online
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  <Cloud className="w-2.5 h-2.5" />
                  {dbStatus.message || (dbStatus.online ? 'Cloud Connected' : 'Local Mode')}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Permanent deletion, Firestore database cleaning, and storage management
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850 transition-colors cursor-pointer"
            title="Close Management Page"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-neutral-900/30 border-b border-neutral-800/80 shrink-0">
          <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/80 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-neutral-400">Total Planes</div>
              <div className="text-base font-bold text-neutral-100 font-mono">{totalCount}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/80 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-neutral-400">In Cloud Firestore</div>
              <div className="text-base font-bold text-emerald-400 font-mono">{cloudCount}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/80 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-neutral-400">In Neo Game</div>
              <div className="text-base font-bold text-indigo-400 font-mono">{gameCount}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/80 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-neutral-400">Total Storage</div>
              <div className="text-base font-bold text-neutral-100 font-mono">{totalSizeMB} MB</div>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Action Buttons */}
        <div className="p-4 border-b border-neutral-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0 bg-neutral-950">
          {/* Search & Filter Tabs */}
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative min-w-[200px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search plane by name, author, filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-900/90 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500/60 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800 text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-neutral-800 text-white font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                All ({models.length})
              </button>
              <button
                onClick={() => setFilterType('cloud')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'cloud'
                    ? 'bg-neutral-800 text-white font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Cloud ({cloudCount})
              </button>
              <button
                onClick={() => setFilterType('game')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'game'
                    ? 'bg-neutral-800 text-white font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Neo Game ({gameCount})
              </button>
            </div>
          </div>

          {/* Action Buttons: Delete Selected & Clean All */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Delete Selected Button */}
            {selectedIds.size > 0 && (
              <button
                onClick={() => setIsDeletingSelectedModalOpen(true)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-200 bg-rose-950/80 hover:bg-rose-900/90 border border-rose-700/80 rounded-xl transition-all shadow-lg shadow-rose-950/40 cursor-pointer animate-fade-in"
                title="Permanently delete chosen planes from Firestore and system"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            )}

            {/* Restore Fleet Button */}
            <button
              onClick={handleRestoreFleetClick}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-xl transition-colors cursor-pointer"
              title="Restore the 10 real aircraft GLBs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
              <span>Restore Fleet</span>
            </button>

            {/* Permanent Purge ALL Planes from Firebase Firestore */}
            <button
              id="btn-purge-firestore"
              onClick={() => setIsDeletingAllModalOpen(true)}
              disabled={isProcessing || models.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 border border-rose-500/50 rounded-xl transition-all shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clean and permanently delete ALL planes from Firebase Firestore and system"
            >
              <Flame className="w-3.5 h-3.5 text-amber-200" />
              <span>Clean & Delete ALL Plains</span>
            </button>
          </div>
        </div>

        {/* Management Table */}
        <div className="flex-1 overflow-y-auto">
          {filteredPlanes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-neutral-400">
              <Box className="w-12 h-12 text-neutral-600 mb-3" />
              <p className="text-sm font-semibold text-neutral-300">No Planes Found</p>
              <p className="text-xs text-neutral-500 max-w-sm mt-1 mb-4">
                {models.length === 0
                  ? 'All planes have been deleted or cleaned from Firebase Firestore.'
                  : 'No planes match your current filter query.'}
              </p>
              {models.length === 0 && (
                <button
                  onClick={handleRestoreFleetClick}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-medium transition-colors shadow-md shadow-sky-950 cursor-pointer"
                >
                  Restore Starter Aircraft Fleet
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider z-10">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title={selectedIds.size === filteredPlanes.length ? 'Deselect All' : 'Select All'}
                    >
                      {selectedIds.size === filteredPlanes.length && filteredPlanes.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Plane Model</th>
                  <th className="py-3 px-4">Storage Source</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Author / Date</th>
                  <th className="py-3 px-4">Neo Game</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850/60 text-xs">
                {filteredPlanes.map((plane) => {
                  const isSelected = selectedIds.has(plane.id);
                  const isCurrent = currentModel?.id === plane.id;

                  return (
                    <tr
                      key={plane.id}
                      className={`hover:bg-neutral-900/60 transition-colors group ${
                        isSelected ? 'bg-sky-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleSelectPlane(plane.id)}
                          className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400" />
                          )}
                        </button>
                      </td>

                      {/* Plane Title & File */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              isCurrent
                                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                            }`}
                          >
                            <Box className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 max-w-xs sm:max-w-md">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-neutral-100 truncate">
                                {formatModelDisplayName(plane.name)}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate font-mono">
                              {plane.fileName || `${plane.name}.glb`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4">
                        {plane.serverSynced || !plane.isDefault ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <Cloud className="w-3 h-3" />
                            Cloud Firestore
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                            <HardDrive className="w-3 h-3" />
                            Starter Fleet
                          </span>
                        )}
                      </td>

                      {/* Size */}
                      <td className="py-3 px-4 font-mono text-neutral-300 whitespace-nowrap">
                        {formatSize(plane.size)}
                      </td>

                      {/* Author / Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-200 truncate max-w-[140px]">
                            {formatCreator(plane)}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {new Date(plane.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Neo Game Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {plane.inNeoGame ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            In Neo Game
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-neutral-500">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setPlaneToDeleteDirectly(plane)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors cursor-pointer"
                          title={`Permanently delete "${plane.name}" from Firestore and database`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info & selection bar */}
        <div className="p-3.5 border-t border-neutral-800 bg-neutral-900/70 flex items-center justify-between text-xs text-neutral-400 shrink-0">
          <div>
            Showing <span className="font-semibold text-neutral-200">{filteredPlanes.length}</span> of{' '}
            <span className="font-semibold text-neutral-200">{models.length}</span> planes
            {selectedIds.size > 0 && (
              <span className="ml-2 text-sky-400 font-semibold">
                ({selectedIds.size} selected)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-neutral-500">
              Direct permanent deletion updates Firestore real-time for all connected team members
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Purge ALL Planes from Firebase Firestore */}
      {isDeletingAllModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-950 border border-rose-800/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl ring-1 ring-rose-600/40 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-sm">
              <Flame className="w-6 h-6 text-rose-500 animate-pulse" />
            </div>

            <h3 className="text-lg font-bold text-neutral-100 tracking-tight">
              Permanently Purge & Clean ALL Planes?
            </h3>

            <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
              You are about to <span className="text-rose-400 font-bold">PERMANENTLY DELETE ALL {models.length} PLANES</span> from{' '}
              <strong className="text-white">Firebase Firestore</strong>, clean cloud storage, and wipe the system library.
            </p>

            <div className="my-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Irreversible Permanent Action</span>
              </div>
              <p className="text-[11px] text-rose-300/90 pl-5">
                Every plane document in Firestore collection <code className="font-mono bg-black/40 px-1 rounded">models</code> and all local database models will be permanently wiped.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setIsDeletingAllModalOpen(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-purge-all"
                onClick={handleConfirmPurgeAll}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-950 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging Firestore...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Permanently Delete All Plains</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Selected */}
      {isDeletingSelectedModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl ring-1 ring-white/10 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-sm">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-neutral-100 tracking-tight">
              Permanently Delete {selectedIds.size} Selected Plane(s)?
            </h3>

            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              These planes will be permanently removed from <strong className="text-neutral-200">Firebase Firestore</strong>, cloud storage, and your local database.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setIsDeletingSelectedModalOpen(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-950 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete {selectedIds.size} Plane(s)</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Single Plane */}
      {planeToDeleteDirectly && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl ring-1 ring-white/10 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-sm">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-neutral-100 tracking-tight">
              Permanently Delete Plane?
            </h3>

            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-neutral-100">"{formatModelDisplayName(planeToDeleteDirectly.name)}"</strong> from Firebase Firestore and the system?
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setPlaneToDeleteDirectly(null)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteSingle(planeToDeleteDirectly)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-950 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Permanently Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
