import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Box,
  Sun,
  Eye,
  EyeOff,
  Crosshair,
  Layers,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Palette,
  Edit3,
  Check,
  Download,
  Database,
  Trash2,
} from 'lucide-react';
import {
  LightingPreset,
  BackgroundMode,
  ModelItem,
  formatModelDisplayName,
} from '../types/model';
import { SceneNode, MaterialDetail } from '../utils/modelAnalyzer';
import { getModelCreatorDisplayName } from '../utils/firebase';

interface InspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: ModelItem | null;
  hierarchy: SceneNode | null;
  materials: MaterialDetail[];
  // Studio settings
  lighting: LightingPreset;
  onSetLighting: (preset: LightingPreset) => void;
  background: BackgroundMode;
  onSetBackground: (bg: BackgroundMode) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showShadows: boolean;
  onToggleShadows: () => void;
  showBoundingBox: boolean;
  onToggleBoundingBox: () => void;
  cameraFov: number;
  onSetCameraFov: (fov: number) => void;
  isOrthographic: boolean;
  onToggleOrthographic: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  autoRotateSpeed: number;
  onSetAutoRotateSpeed: (speed: number) => void;
  // Animation settings
  activeAnimationIndex: number;
  onSelectAnimation: (idx: number) => void;
  isPlayingAnimation: boolean;
  onTogglePlayAnimation: () => void;
  animationSpeed: number;
  onSetAnimationSpeed: (speed: number) => void;
  animationProgress: number;
  onSeekAnimation: (progress: number) => void;
  // Node focus & visibility
  hiddenNodeIds: Set<string>;
  onToggleNodeVisibility: (nodeId: string) => void;
  focusedNodeId: string | null;
  onFocusNode: (nodeId: string) => void;
  // Material overrides
  materialOverrides: Record<string, { colorHex?: string; roughness?: number; metalness?: number; wireframe?: boolean }>;
  onUpdateMaterial: (materialId: string, updates: { colorHex?: string; roughness?: number; metalness?: number; wireframe?: boolean }) => void;
  onRenameModel?: (id: string, newName: string) => void;
  onDeleteModel?: (id: string) => void;
  onRequestDelete?: (model: ModelItem) => void;
  userProfiles?: Record<string, string>;
  currentUser?: { uid?: string; email?: string | null; displayName?: string | null } | null;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  isOpen,
  onClose,
  currentModel,
  hierarchy,
  materials,
  lighting,
  onSetLighting,
  background,
  onSetBackground,
  showGrid,
  onToggleGrid,
  showShadows,
  onToggleShadows,
  showBoundingBox,
  onToggleBoundingBox,
  cameraFov,
  onSetCameraFov,
  isOrthographic,
  onToggleOrthographic,
  autoRotate,
  onToggleAutoRotate,
  autoRotateSpeed,
  onSetAutoRotateSpeed,
  activeAnimationIndex,
  onSelectAnimation,
  isPlayingAnimation,
  onTogglePlayAnimation,
  animationSpeed,
  onSetAnimationSpeed,
  animationProgress,
  onSeekAnimation,
  hiddenNodeIds,
  onToggleNodeVisibility,
  focusedNodeId,
  onFocusNode,
  materialOverrides,
  onUpdateMaterial,
  onRenameModel,
  onDeleteModel,
  onRequestDelete,
  userProfiles,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'inspect' | 'studio' | 'materials' | 'animations'>('inspect');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    if (currentModel) {
      setRenameInput(currentModel.name.replace(/\.(glb|gltf)$/i, ''));
      setIsRenaming(false);
      setRenameError(null);
    }
  }, [currentModel?.id, currentModel?.name]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const hasAnimations = (currentModel?.metrics?.animations || 0) > 0;

  if (!isOpen) return null;

  // Render Scene Node Item
  const renderSceneNode = (node: SceneNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id) || depth < 1;
    const hasChildren = node.children && node.children.length > 0;
    const isHidden = hiddenNodeIds.has(node.id);
    const isFocused = focusedNodeId === node.id;

    return (
      <div key={node.id} className="text-xs">
        <div
          className={`flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-neutral-900 group transition-colors ${
            isFocused ? 'bg-neutral-800/80 text-sky-400 font-medium' : 'text-neutral-300'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-0.5 text-neutral-400 hover:text-neutral-200"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          <span
            className="truncate flex-1 cursor-pointer"
            onClick={() => onFocusNode(node.id)}
            title={`${node.name} (${node.type})`}
          >
            {node.name}
          </span>

          {node.triangleCount !== undefined && node.triangleCount > 0 && (
            <span className="text-[10px] text-neutral-400 font-mono">
              {node.triangleCount}t
            </span>
          )}

          {/* Node Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onFocusNode(node.id)}
              title="Focus in camera"
              className="p-1 text-neutral-400 hover:text-sky-400 hover:bg-neutral-800 rounded"
            >
              <Crosshair className="w-3 h-3" />
            </button>
            <button
              onClick={() => onToggleNodeVisibility(node.id)}
              title={isHidden ? 'Show part' : 'Hide part'}
              className="p-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded"
            >
              {isHidden ? (
                <EyeOff className="w-3 h-3 text-red-400" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderSceneNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="fixed inset-y-14 right-0 w-80 sm:w-88 bg-neutral-950/95 border-l border-neutral-800 z-30 flex flex-col backdrop-blur-md transition-all shadow-2xl">
      {/* Header & Tabs */}
      <div className="border-b border-neutral-800">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-neutral-100">Inspector & Studio</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md hover:bg-neutral-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center px-3 gap-1 pb-2">
          <button
            onClick={() => setActiveTab('inspect')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'inspect'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            Inspect
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'studio'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            Studio
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'materials'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            Materials
          </button>
          {hasAnimations && (
            <button
              onClick={() => setActiveTab('animations')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'animations'
                  ? 'bg-neutral-800 text-sky-400'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              Motion
            </button>
          )}
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* TAB 1: INSPECT */}
        {activeTab === 'inspect' && (
          <div className="space-y-5">
            {/* Model Information & Renaming Card */}
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Model Information & Name
                </span>
                {!isRenaming && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setRenameInput(currentModel?.name.replace(/\.(glb|gltf)$/i, '') || '');
                        setIsRenaming(true);
                        setRenameError(null);
                      }}
                      className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium transition-colors"
                      title="Rename this GLB"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Rename</span>
                    </button>
                    {currentModel && (onRequestDelete || onDeleteModel) && (
                      <button
                        onClick={() => {
                          if (onRequestDelete) {
                            onRequestDelete(currentModel);
                          } else if (onDeleteModel) {
                            onDeleteModel(currentModel.id);
                          }
                        }}
                        className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors"
                        title="Delete this model"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isRenaming ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={renameInput}
                      onChange={(e) => {
                        setRenameInput(e.target.value);
                        if (renameError) setRenameError(null);
                      }}
                      placeholder="Model name"
                      className="flex-1 px-2.5 py-1.5 bg-neutral-950 border border-sky-500 rounded-lg text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const trimmed = renameInput.trim();
                        if (!trimmed) {
                          setRenameError('Name cannot be empty');
                          return;
                        }
                        if (currentModel && onRenameModel) {
                          onRenameModel(currentModel.id, trimmed);
                        }
                        setIsRenaming(false);
                      }}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsRenaming(false);
                        setRenameError(null);
                      }}
                      className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {renameError && (
                    <p className="text-[10px] text-red-400">{renameError}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-100 truncate pr-2" title={currentModel?.name}>
                    {formatModelDisplayName(currentModel?.name || '')}
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 shrink-0">
                    {((currentModel?.size || 0) / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80 text-[11px] font-mono">
                <span className="text-sky-400 font-semibold">GLB Model</span>
                <span className="text-emerald-400">Cloud Synced</span>
              </div>

              {/* Added By & Timestamp details */}
              <div className="pt-2 border-t border-neutral-800/80 text-[11px] space-y-1">
                {(currentModel?.fileName || currentModel?.name) && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">File Name:</span>
                    <span className="text-neutral-300 font-mono text-[10px] truncate max-w-[170px]" title={currentModel?.fileName || currentModel?.name}>
                      {currentModel?.fileName || currentModel?.name}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Added By:</span>
                  <span className="text-neutral-300 font-medium">
                    {getModelCreatorDisplayName(currentModel, userProfiles, currentUser)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Added On:</span>
                  <span className="text-neutral-300 font-mono text-[10px]">
                    {currentModel?.createdAt
                      ? new Date(currentModel.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Initial Provision'}
                  </span>
                </div>
              </div>
            </div>

            {/* Metric Grid */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2.5">
                Model Statistics
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-neutral-900/60 border border-neutral-800/80 p-2.5 rounded-lg">
                  <span className="text-[11px] text-neutral-400">Triangles</span>
                  <p className="text-sm font-semibold text-neutral-100 font-mono tabular-nums mt-0.5">
                    {currentModel?.metrics?.triangles.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="bg-neutral-900/60 border border-neutral-800/80 p-2.5 rounded-lg">
                  <span className="text-[11px] text-neutral-400">Vertices</span>
                  <p className="text-sm font-semibold text-neutral-100 font-mono tabular-nums mt-0.5">
                    {currentModel?.metrics?.vertices.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="bg-neutral-900/60 border border-neutral-800/80 p-2.5 rounded-lg">
                  <span className="text-[11px] text-neutral-400">Meshes</span>
                  <p className="text-sm font-semibold text-neutral-100 font-mono tabular-nums mt-0.5">
                    {currentModel?.metrics?.meshes || '0'}
                  </p>
                </div>
                <div className="bg-neutral-900/60 border border-neutral-800/80 p-2.5 rounded-lg">
                  <span className="text-[11px] text-neutral-400">Materials</span>
                  <p className="text-sm font-semibold text-neutral-100 font-mono tabular-nums mt-0.5">
                    {currentModel?.metrics?.materials || '0'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bounding Dimensions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Bounding Box (XYZ)
                </h3>
                <button
                  onClick={onToggleBoundingBox}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    showBoundingBox
                      ? 'border-sky-500/50 text-sky-400 bg-sky-950/30'
                      : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {showBoundingBox ? 'Box Visible' : 'Show Box'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-neutral-900/50 border border-neutral-800 p-2 rounded-lg font-mono">
                  <span className="text-[10px] text-neutral-400">Width (X)</span>
                  <p className="text-neutral-200 font-medium">{currentModel?.metrics?.dimensions?.x ?? 0}m</p>
                </div>
                <div className="bg-neutral-900/50 border border-neutral-800 p-2 rounded-lg font-mono">
                  <span className="text-[10px] text-neutral-400">Height (Y)</span>
                  <p className="text-neutral-200 font-medium">{currentModel?.metrics?.dimensions?.y ?? 0}m</p>
                </div>
                <div className="bg-neutral-900/50 border border-neutral-800 p-2 rounded-lg font-mono">
                  <span className="text-[10px] text-neutral-400">Depth (Z)</span>
                  <p className="text-neutral-200 font-medium">{currentModel?.metrics?.dimensions?.z ?? 0}m</p>
                </div>
              </div>
            </div>

            {/* Scene Graph Hierarchy Tree */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Scene Graph Nodes
                </h3>
                <span className="text-[10px] text-neutral-400">Click to focus</span>
              </div>
              <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-2 max-h-60 overflow-y-auto">
                {hierarchy ? (
                  renderSceneNode(hierarchy)
                ) : (
                  <p className="text-xs text-neutral-400 p-3 text-center">Loading scene hierarchy...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STUDIO CONTROLS */}
        {activeTab === 'studio' && (
          <div className="space-y-5">
            {/* Lighting Preset */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-neutral-400" />
                <span>Studio Lighting</span>
              </h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {(['studio', 'cyber', 'sunset', 'darkroom', 'daylight'] as LightingPreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => onSetLighting(preset)}
                    className={`py-2 px-3 rounded-lg border text-left capitalize transition-colors ${
                      lighting === preset
                        ? 'bg-neutral-800 border-sky-500/60 text-sky-400 font-medium'
                        : 'bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Style */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-neutral-400" />
                <span>Background Horizon</span>
              </h3>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(['obsidian', 'slate', 'white', 'navy', 'transparent'] as BackgroundMode[]).map((bg) => (
                  <button
                    key={bg}
                    onClick={() => onSetBackground(bg)}
                    className={`py-2 px-2.5 rounded-lg border text-center capitalize transition-colors ${
                      background === bg
                        ? 'bg-neutral-800 border-sky-500/60 text-sky-400 font-medium'
                        : 'bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60'
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Scene Environment Toggles */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-neutral-400" />
                <span>Ground & Helpers</span>
              </h3>
              <div className="space-y-2 text-xs">
                <label className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/50 border border-neutral-800 cursor-pointer">
                  <span className="text-neutral-300">Ground Grid</span>
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={onToggleGrid}
                    className="rounded border-neutral-700 bg-neutral-800 text-sky-500 focus:ring-0"
                  />
                </label>
                <label className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/50 border border-neutral-800 cursor-pointer">
                  <span className="text-neutral-300">Contact Shadows</span>
                  <input
                    type="checkbox"
                    checked={showShadows}
                    onChange={onToggleShadows}
                    className="rounded border-neutral-700 bg-neutral-800 text-sky-500 focus:ring-0"
                  />
                </label>
                <label className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/50 border border-neutral-800 cursor-pointer">
                  <span className="text-neutral-300">Orthographic Camera</span>
                  <input
                    type="checkbox"
                    checked={isOrthographic}
                    onChange={onToggleOrthographic}
                    className="rounded border-neutral-700 bg-neutral-800 text-sky-500 focus:ring-0"
                  />
                </label>
              </div>
            </div>

            {/* Camera FOV Slider (if perspective) */}
            {!isOrthographic && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-400">Field of View (FOV)</span>
                  <span className="font-mono text-neutral-200">{cameraFov}°</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="90"
                  value={cameraFov}
                  onChange={(e) => onSetCameraFov(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {/* Turntable Auto-Rotate */}
            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/50 border border-neutral-800 cursor-pointer text-xs">
                <span className="text-neutral-300">Auto Turntable Spin</span>
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={onToggleAutoRotate}
                  className="rounded border-neutral-700 bg-neutral-800 text-sky-500 focus:ring-0"
                />
              </label>

              {autoRotate && (
                <div className="px-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-400">Spin Speed</span>
                    <span className="font-mono text-neutral-200">{autoRotateSpeed}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="6.0"
                    step="0.5"
                    value={autoRotateSpeed}
                    onChange={(e) => onSetAutoRotateSpeed(Number(e.target.value))}
                    className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MATERIALS INSPECTOR */}
        {activeTab === 'materials' && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Model Materials ({materials.length})
            </h3>
            {materials.length === 0 ? (
              <p className="text-xs text-neutral-400">No mesh materials detected.</p>
            ) : (
              materials.map((mat) => {
                const currentOverride = materialOverrides[mat.id] || {};
                const activeColor = currentOverride.colorHex || mat.colorHex;
                const activeRoughness = currentOverride.roughness !== undefined ? currentOverride.roughness : mat.roughness;
                const activeMetalness = currentOverride.metalness !== undefined ? currentOverride.metalness : mat.metalness;

                return (
                  <div
                    key={mat.id}
                    className="p-3 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-200 truncate max-w-[170px]" title={mat.name}>
                        {mat.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <label
                          className="w-6 h-6 rounded-md border border-neutral-700 cursor-pointer overflow-hidden block"
                          style={{ backgroundColor: activeColor }}
                          title="Change Material Tint"
                        >
                          <input
                            type="color"
                            value={activeColor}
                            onChange={(e) => onUpdateMaterial(mat.id, { colorHex: e.target.value })}
                            className="opacity-0 w-0 h-0"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Roughness slider */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-neutral-400">Roughness</span>
                        <span className="font-mono text-neutral-300">
                          {activeRoughness.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeRoughness}
                        onChange={(e) => onUpdateMaterial(mat.id, { roughness: Number(e.target.value) })}
                        className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Metalness slider */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-neutral-400">Metalness</span>
                        <span className="font-mono text-neutral-300">
                          {activeMetalness.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeMetalness}
                        onChange={(e) => onUpdateMaterial(mat.id, { metalness: Number(e.target.value) })}
                        className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 4: ANIMATIONS */}
        {activeTab === 'animations' && hasAnimations && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Motion Timeline
            </h3>

            {/* Animation Selector */}
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">Select Clip</label>
              <select
                value={activeAnimationIndex}
                onChange={(e) => onSelectAnimation(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 rounded-lg p-2 focus:outline-none focus:border-sky-500"
              >
                {currentModel?.metrics?.animationNames?.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Scrubber */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400">Timeline</span>
                <span className="font-mono text-neutral-300">
                  {Math.round(animationProgress * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={animationProgress}
                onChange={(e) => onSeekAnimation(Number(e.target.value))}
                className="w-full accent-sky-500 bg-neutral-800 h-2 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 py-2">
              <button
                onClick={() => onSeekAnimation(0)}
                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
                title="Restart Animation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={onTogglePlayAnimation}
                className="p-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-lg transition-colors"
                title={isPlayingAnimation ? 'Pause' : 'Play'}
              >
                {isPlayingAnimation ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
            </div>

            {/* Speed Multiplier */}
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">Playback Speed</label>
              <div className="grid grid-cols-5 gap-1 text-xs">
                {[0.25, 0.5, 1, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => onSetAnimationSpeed(spd)}
                    className={`py-1.5 rounded-lg border font-mono transition-colors ${
                      animationSpeed === spd
                        ? 'bg-neutral-800 border-sky-500 text-sky-400 font-semibold'
                        : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
