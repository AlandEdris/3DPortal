import React from 'react';
import {
  Upload,
  Camera,
  FolderOpen,
  Sliders,
  Link as LinkIcon,
  Maximize2,
  Box,
  ChevronDown,
  Edit3,
  Database,
  Cloud,
} from 'lucide-react';
import { ModelItem } from '../types/model';

interface TopNavProps {
  currentModel: ModelItem | null;
  models: ModelItem[];
  onSelectModel: (model: ModelItem) => void;
  onOpenUploadModal: () => void;
  onOpenUrlModal: () => void;
  onTakeSnapshot: () => void;
  onOpenRenameModal?: () => void;
  onOpenCloudModal?: () => void;
  isLibraryOpen: boolean;
  onToggleLibrary: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  onToggleFullscreen: () => void;
  dbStatus?: { online: boolean; message: string };
}

export const TopNav: React.FC<TopNavProps> = ({
  currentModel,
  models,
  onSelectModel,
  onOpenUploadModal,
  onOpenUrlModal,
  onTakeSnapshot,
  onOpenRenameModal,
  onOpenCloudModal,
  isLibraryOpen,
  onToggleLibrary,
  isInspectorOpen,
  onToggleInspector,
  onToggleFullscreen,
  dbStatus = { online: true, message: 'Database Connected' },
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  return (
    <header className="h-14 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md px-4 flex items-center justify-between z-20 shrink-0">
      {/* Zone 1: Brand & Model Selection */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLibrary}
          title={isLibraryOpen ? 'Hide Library' : 'Show Library'}
          className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
            isLibraryOpen ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Box className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-neutral-100">VoxelOrbit</span>
            <span className="text-[10px] text-neutral-400 hidden sm:inline">3D GLB Studio Portal</span>
          </div>
        </div>

        {/* Model Selector Dropdown & Quick Rename */}
        <div className="flex items-center gap-1 ml-2 sm:ml-4">
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-xs font-medium text-neutral-200 transition-colors max-w-[160px] sm:max-w-[220px] truncate"
            >
              <span className="truncate">{currentModel?.name || 'No Model Loaded'}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl py-1 z-50 max-h-72 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                    Select Model ({models.length})
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectModel(m);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-neutral-800 transition-colors ${
                        currentModel?.id === m.id ? 'bg-neutral-800/80 text-sky-400 font-medium' : 'text-neutral-300'
                      }`}
                    >
                      <span className="truncate pr-2">{m.name}</span>
                      <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                        {(m.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {currentModel && onOpenRenameModal && (
            <button
              onClick={onOpenRenameModal}
              title="Rename Current Model"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-sky-300 hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors hidden sm:flex items-center justify-center"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Zone 2: Primary Actions & Database Status */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Database Status Button */}
        <button
          type="button"
          onClick={onOpenCloudModal}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 font-medium mr-1 transition-colors cursor-pointer group"
          title="Click to configure Cloud Database & Real-Time Sync"
        >
          <Cloud className={`w-3 h-3 ${dbStatus.online ? 'text-emerald-400' : 'text-sky-400'}`} />
          <span className="truncate max-w-[130px] group-hover:text-white transition-colors">
            {dbStatus.message || (dbStatus.online ? 'Cloud Synced' : 'IndexedDB')}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'}`} />
        </button>

        <button
          onClick={onOpenUrlModal}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors whitespace-nowrap"
          title="Import from URL"
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Import URL</span>
        </button>

        <button
          onClick={onOpenUploadModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors shadow-sm shadow-sky-950 whitespace-nowrap"
          title="Upload GLB File or ZIP"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload GLB</span>
        </button>

        <button
          onClick={onTakeSnapshot}
          className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 rounded-lg transition-colors"
          title="Capture High-Res Screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleFullscreen}
          className="hidden sm:flex p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 rounded-lg transition-colors"
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleInspector}
          title={isInspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
          className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
            isInspectorOpen ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
