import React, { useRef, useState } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Download,
  Search,
  Box,
  FileBox,
  Link as LinkIcon,
  X,
  Edit3,
  Check,
  RotateCcw,
  Database,
  ArrowDownToLine,
  Plane,
  User,
  Clock,
  Gamepad2,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ModelItem, formatModelDisplayName } from '../types/model';
import { exportModelsMetadataJSON } from '../utils/db';
import { getModelCreatorDisplayName } from '../utils/firebase';

interface ModelLibraryProps {
  models: ModelItem[];
  currentModel: ModelItem | null;
  onSelectModel: (model: ModelItem) => void;
  onDeleteModel: (id: string) => void;
  onRequestDelete?: (model: ModelItem) => void;
  onRenameModel: (id: string, newName: string) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onOpenUrlModal: () => void;
  onOpenCloudModal?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onLoadDefaults: () => void;
  userProfiles?: Record<string, string>;
  currentUser?: { uid?: string; email?: string | null; displayName?: string | null } | null;
  dbStatus?: { online: boolean; message: string };
  onToggleNeoGame?: (id: string) => void;
}

export const ModelLibrary: React.FC<ModelLibraryProps> = ({
  models,
  currentModel,
  onSelectModel,
  onDeleteModel,
  onRequestDelete,
  onRenameModel,
  onUploadFiles,
  onOpenUrlModal,
  onOpenCloudModal,
  isOpen,
  onClose,
  onOpen,
  onLoadDefaults,
  userProfiles,
  currentUser,
  dbStatus = { online: true, message: 'Database Connected' },
  onToggleNeoGame,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [gameFilter, setGameFilter] = useState<'all' | 'game' | 'pending'>('all');

  const filteredModels = models.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.fileName && m.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (gameFilter === 'game') return !!m.inNeoGame;
    if (gameFilter === 'pending') return !m.inNeoGame;
    return true;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const startEditing = (e: React.MouseEvent, model: ModelItem) => {
    e.stopPropagation();
    setEditingModelId(model.id);
    setEditNameValue(formatModelDisplayName(model.name));
    setEditError(null);
  };

  const saveRename = (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const clean = formatModelDisplayName(editNameValue.trim());

    if (!clean) {
      setEditError('Name cannot be empty');
      return;
    }

    const norm = clean.toLowerCase();
    const duplicate = models.some(
      (m) => m.id !== id && formatModelDisplayName(m.name).toLowerCase() === norm
    );

    if (duplicate) {
      setEditError('Name already taken');
      return;
    }

    onRenameModel(id, clean);
    setEditingModelId(null);
    setEditError(null);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingModelId(null);
    setEditError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTriangles = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return `${count}`;
  };

  const handleDownload = (e: React.MouseEvent, model: ModelItem) => {
    e.stopPropagation();
    if (!model.fileUrl) return;
    const a = document.createElement('a');
    a.href = model.fileUrl;
    const filename = model.fileName || (model.name.toLowerCase().endsWith('.glb') ? model.name : `${model.name}.glb`);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) {
    return (
      <aside className="fixed left-0 top-20 z-30 select-none animate-fade-in">
        <button
          id="btn-vs-toolbox-tab"
          onClick={onOpen}
          className="group flex flex-col items-center gap-2 py-3 px-1.5 bg-neutral-950/95 hover:bg-neutral-900 text-neutral-400 hover:text-sky-400 border border-neutral-800 border-l-0 rounded-r-xl shadow-2xl backdrop-blur-md transition-all cursor-pointer hover:shadow-sky-950/40 hover:border-sky-500/50"
          title="Expand Model Library (VS Toolbox)"
        >
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-transform" />
          <FileBox className="w-4 h-4 text-sky-400" />
          <span className="text-[11px] font-semibold tracking-wider uppercase [writing-mode:vertical-rl] rotate-180 py-2 text-neutral-300 group-hover:text-white font-mono">
            Model Library ({models.length})
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="fixed inset-y-14 left-0 w-84 bg-neutral-950/95 border-r border-neutral-800 z-30 flex flex-col backdrop-blur-md transition-all shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileBox className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-neutral-100">Model Library</h2>
          <span className="text-xs text-neutral-400 font-mono">({models.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            id="btn-export-library"
            onClick={() => exportModelsMetadataJSON(models)}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors cursor-pointer"
            title="Export Database Backup (JSON)"
          >
            <ArrowDownToLine className="w-4 h-4" />
          </button>
          {/* Collapse button next to the download button */}
          <button
            id="btn-collapse-sidebar"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-sky-400 hover:bg-neutral-900 transition-colors cursor-pointer"
            title="Collapse Sidebar to Left (VS Toolbox style)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Upload & Import Buttons */}
      <div className="p-3 border-b border-neutral-800/80 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf,.zip"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload GLB / ZIP</span>
        </button>
        <button
          onClick={onOpenUrlModal}
          className="flex items-center justify-center p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
          title="Import from URL"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Drag & Drop Target Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mx-3 my-2 border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-sky-500 bg-sky-950/20 text-sky-300'
            : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/40 text-neutral-400'
        }`}
      >
        <Upload className="w-4 h-4 mx-auto mb-1 text-neutral-400" />
        <p className="text-xs font-medium text-neutral-200">
          {isDragging ? 'Drop GLB or ZIP here' : 'Drop .glb or .zip archive'}
        </p>
        <p className="text-[10px] text-neutral-500 mt-0.5">Duplicate prevention enabled</p>
      </div>

      {/* Search Input */}
      {models.length > 2 && (
        <div className="px-3 pb-2 space-y-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Quick Filter: All vs Neo Game Roster */}
          <div className="flex items-center gap-1 text-[11px] pt-0.5">
            <button
              type="button"
              id="btn-filter-all"
              onClick={() => setGameFilter('all')}
              className={`flex-1 py-1 rounded-md font-medium transition-colors ${
                gameFilter === 'all'
                  ? 'bg-neutral-800 text-white font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              All ({models.length})
            </button>
            <button
              type="button"
              id="btn-filter-game"
              onClick={() => setGameFilter('game')}
              className={`flex-1 py-1 rounded-md font-medium flex items-center justify-center gap-1 transition-colors ${
                gameFilter === 'game'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-neutral-400 hover:text-emerald-400 hover:bg-neutral-900'
              }`}
              title="Planes marked as added to Neo Game"
            >
              <Gamepad2 className="w-3 h-3" />
              <span>In Game ({models.filter((m) => m.inNeoGame).length})</span>
            </button>
            <button
              type="button"
              id="btn-filter-pending"
              onClick={() => setGameFilter('pending')}
              className={`flex-1 py-1 rounded-md font-medium transition-colors ${
                gameFilter === 'pending'
                  ? 'bg-neutral-800 text-amber-300 font-semibold'
                  : 'text-neutral-400 hover:text-amber-300 hover:bg-neutral-900'
              }`}
            >
              Pending ({models.filter((m) => !m.inNeoGame).length})
            </button>
          </div>
        </div>
      )}

      {/* Models Scrollable List */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2">
        {filteredModels.length === 0 ? (
          <div className="py-8 text-center px-4">
            <Box className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">No models found</p>
            <button
              onClick={onLoadDefaults}
              className="mt-3 text-xs text-sky-400 hover:text-sky-300 flex items-center justify-center gap-1.5 mx-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restore Aircraft Models</span>
            </button>
          </div>
        ) : (
          filteredModels.map((model) => {
            const isSelected = currentModel?.id === model.id;
            const isEditing = editingModelId === model.id;

            return (
              <div
                key={model.id}
                onClick={() => onSelectModel(model)}
                className={`group relative p-2.5 rounded-xl border cursor-pointer transition-all overflow-hidden ${
                  isSelected
                    ? model.inNeoGame
                      ? 'bg-gradient-to-l from-emerald-900/40 via-emerald-950/20 to-neutral-900 border-emerald-500/60 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/30'
                      : 'bg-neutral-900 border-sky-500/60 shadow-lg shadow-sky-950/20 ring-1 ring-sky-500/30'
                    : model.inNeoGame
                    ? 'bg-gradient-to-l from-emerald-900/25 via-emerald-950/10 to-neutral-900/40 border-neutral-800/90 hover:border-emerald-500/40 hover:from-emerald-900/35'
                    : 'bg-neutral-900/40 border-neutral-800/80 hover:bg-neutral-900/80 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Thumbnail / 3D Icon */}
                  <div className="relative w-11 h-11 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
                    {model.thumbnailUrl ? (
                      <img
                        src={model.thumbnailUrl}
                        alt={model.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Plane className="w-5 h-5 text-sky-400/80" />
                    )}
                  </div>

                  {/* Info or Edit Form */}
                  <div className="flex-1 min-w-0 pr-12">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => saveRename(e, model.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="space-y-1"
                      >
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            autoFocus
                            className="w-full px-2 py-1 bg-neutral-950 border border-sky-500 rounded text-xs text-white focus:outline-none font-medium"
                          />
                          <button
                            type="submit"
                            title="Save Rename"
                            className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            title="Cancel"
                            className="p-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {editError && (
                          <p className="text-[10px] text-red-400">{editError}</p>
                        )}
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <p
                            className={`text-xs font-semibold truncate ${
                              isSelected ? 'text-sky-300' : 'text-neutral-200'
                            }`}
                            title={model.fileName ? `${formatModelDisplayName(model.name)} (File: ${model.fileName})` : formatModelDisplayName(model.name)}
                          >
                            {formatModelDisplayName(model.name)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-1 font-mono">
                          <span>{formatFileSize(model.size)}</span>
                          <span aria-hidden="true" className="text-neutral-600">·</span>
                          <span>{formatTriangles(model.metrics?.triangles || 0)} tris</span>
                        </div>

                        {/* Author, Timestamp & Marker Checkbox on the exact SAME ROW */}
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-1.5 pt-1.5 border-t border-neutral-800/60 whitespace-nowrap overflow-hidden">
                          <div
                            className="flex items-center gap-1 truncate max-w-[80px] shrink min-w-0"
                            title={`Added by: ${getModelCreatorDisplayName(model, userProfiles, currentUser)}`}
                          >
                            <User className="w-3 h-3 text-sky-400 shrink-0" />
                            <span className="truncate text-neutral-300 font-medium">
                              {getModelCreatorDisplayName(model, userProfiles, currentUser)}
                            </span>
                          </div>
                          <span className="text-neutral-600 shrink-0">·</span>
                          <div
                            className="flex items-center gap-1 shrink-0 text-neutral-400"
                            title={new Date(model.createdAt).toLocaleString()}
                          >
                            <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>
                              {new Date(model.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <span className="text-neutral-600 shrink-0">·</span>
                          {/* Checkbox directly next to date */}
                          <label
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center cursor-pointer select-none p-0.5 rounded hover:bg-neutral-800/80 transition-colors shrink-0"
                            title={
                              model.inNeoGame
                                ? `Added to Our Neo Game (${model.neoGameAddedBy || 'Team'}) - Click to unmark`
                                : 'Mark as added to Our Neo Game'
                            }
                          >
                            <input
                              type="checkbox"
                              id={`chk-neogame-${model.id}`}
                              checked={!!model.inNeoGame}
                              onChange={() => onToggleNeoGame?.(model.id)}
                              className="w-3.5 h-3.5 rounded border-neutral-700 bg-neutral-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-emerald-500 shrink-0"
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions (Rename / Download / Delete) */}
                {!isEditing && (
                  <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-neutral-900/95 rounded-lg p-0.5 border border-neutral-700/60 shadow-md">
                    <button
                      onClick={(e) => startEditing(e, model)}
                      title="Rename Model"
                      className="p-1 rounded text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDownload(e, model)}
                      title="Download GLB"
                      className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onRequestDelete) {
                          onRequestDelete(model);
                        } else {
                          onDeleteModel(model.id);
                        }
                      }}
                      title="Delete model"
                      className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info: Database Status & Reload */}
      <div className="p-3 border-t border-neutral-800/80 text-[11px] flex items-center justify-between bg-neutral-950/70">
        <button
          type="button"
          onClick={onOpenCloudModal}
          className="flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors cursor-pointer group text-left"
          title="Click to configure Real-Time Online Database Sync"
        >
          <Database className={`w-3.5 h-3.5 ${dbStatus.online ? 'text-emerald-400' : 'text-sky-400'}`} />
          <span className="font-medium group-hover:underline">
            {dbStatus.message || (dbStatus.online ? 'Cloud Synced' : 'Local IndexedDB')}
          </span>
        </button>
        <button
          onClick={onLoadDefaults}
          className="text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors hover:underline"
          title="Reset to default aircraft models"
        >
          <RotateCcw className="w-3 h-3 text-sky-400" />
          <span>Defaults</span>
        </button>
      </div>
    </aside>
  );
};
