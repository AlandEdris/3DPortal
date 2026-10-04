import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCcw,
  Grid,
  RefreshCw,
  Box,
  Eye,
  Camera,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Check,
} from 'lucide-react';
import { CameraViewPreset, RenderMode } from '../types/model';

interface QuickToolbarProps {
  renderMode: RenderMode;
  onSetRenderMode: (mode: RenderMode) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onResetView: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onSelectCameraPreset: (preset: CameraViewPreset) => void;
  onTakeSnapshot: () => void;
}

export const QuickToolbar: React.FC<QuickToolbarProps> = ({
  renderMode,
  onSetRenderMode,
  showGrid,
  onToggleGrid,
  autoRotate,
  onToggleAutoRotate,
  onResetView,
  onZoomIn,
  onZoomOut,
  onSelectCameraPreset,
  onTakeSnapshot,
}) => {
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);

  const viewMenuRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setShowViewMenu(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, []);

  const viewPresets: { id: CameraViewPreset; label: string }[] = [
    { id: 'iso', label: 'Isometric' },
    { id: 'front', label: 'Front' },
    { id: 'back', label: 'Back' },
    { id: 'top', label: 'Top' },
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
    { id: 'bottom', label: 'Bottom' },
  ];

  const renderModes: { id: RenderMode; label: string }[] = [
    { id: 'shaded', label: 'Realistic PBR' },
    { id: 'wireframe', label: 'Wireframe' },
    { id: 'clay', label: 'Matte Clay' },
    { id: 'normals', label: 'Surface Normals' },
    { id: 'xray', label: 'X-Ray Ghost' },
  ];

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-2xl shadow-2xl max-w-[95vw]">
      {/* 1. Camera View Presets Menu */}
      <div ref={viewMenuRef} className="relative">
        <button
          id="btn-quick-views"
          onClick={() => {
            setShowViewMenu((prev) => !prev);
            setShowModeMenu(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            showViewMenu
              ? 'bg-neutral-800 text-sky-400'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
          }`}
          title="Camera View Angle"
        >
          <Box className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Views</span>
          <ChevronUp className={`w-3 h-3 text-neutral-400 transition-transform ${showViewMenu ? 'rotate-180' : ''}`} />
        </button>

        {showViewMenu && (
          <div className="absolute bottom-full mb-3 left-0 w-44 bg-neutral-950/95 border border-neutral-800 rounded-xl py-1.5 shadow-2xl z-50 backdrop-blur-md animate-fade-in">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800/80 mb-1">
              Camera Angles
            </div>
            {viewPresets.map((vp) => (
              <button
                key={vp.id}
                id={`btn-view-${vp.id}`}
                onClick={() => {
                  onSelectCameraPreset(vp.id);
                  setShowViewMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:text-sky-300 hover:bg-neutral-900/90 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>{vp.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Reset / Frame Model */}
      <button
        id="btn-quick-center"
        onClick={onResetView}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer"
        title="Reset & Center View"
      >
        <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
        <span className="hidden sm:inline">Center</span>
      </button>

      {/* 2b. Zoom Out & Zoom In */}
      {onZoomOut && (
        <button
          id="btn-quick-zoomout"
          onClick={onZoomOut}
          className="p-1.5 rounded-xl text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Zoom Out (Infinite)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      )}

      {onZoomIn && (
        <button
          id="btn-quick-zoomin"
          onClick={onZoomIn}
          className="p-1.5 rounded-xl text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Divider */}
      <div className="w-[1px] h-4 bg-neutral-800 shrink-0" />

      {/* 3. Render Mode Menu */}
      <div ref={modeMenuRef} className="relative">
        <button
          id="btn-quick-shaded"
          onClick={() => {
            setShowModeMenu((prev) => !prev);
            setShowViewMenu(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            showModeMenu || renderMode !== 'shaded'
              ? 'bg-neutral-800 text-sky-400'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
          }`}
          title="Shading Mode"
        >
          <Eye className="w-3.5 h-3.5 text-sky-400" />
          <span className="capitalize hidden sm:inline">{renderMode}</span>
          <ChevronUp className={`w-3 h-3 text-neutral-400 transition-transform ${showModeMenu ? 'rotate-180' : ''}`} />
        </button>

        {showModeMenu && (
          <div className="absolute bottom-full mb-3 left-0 w-44 bg-neutral-950/95 border border-neutral-800 rounded-xl py-1.5 shadow-2xl z-50 backdrop-blur-md animate-fade-in">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800/80 mb-1">
              Shading Style
            </div>
            {renderModes.map((rm) => (
              <button
                key={rm.id}
                id={`btn-mode-${rm.id}`}
                onClick={() => {
                  onSetRenderMode(rm.id);
                  setShowModeMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  renderMode === rm.id
                    ? 'bg-sky-500/10 text-sky-400 font-semibold'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900/90'
                }`}
              >
                <span>{rm.label}</span>
                {renderMode === rm.id && (
                  <Check className="w-3.5 h-3.5 text-sky-400" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Grid Toggle */}
      <button
        id="btn-quick-grid"
        onClick={onToggleGrid}
        className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
          showGrid
            ? 'bg-neutral-800 text-sky-400'
            : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
        }`}
        title={showGrid ? 'Hide Ground Grid' : 'Show Ground Grid'}
      >
        <Grid className="w-4 h-4" />
      </button>

      {/* 5. Auto Rotate Toggle */}
      <button
        id="btn-quick-autorotate"
        onClick={onToggleAutoRotate}
        className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
          autoRotate
            ? 'bg-neutral-800 text-sky-400'
            : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
        }`}
        title={autoRotate ? 'Stop Turntable Spin' : 'Start Turntable Spin'}
      >
        <RefreshCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
      </button>

      {/* Divider */}
      <div className="w-[1px] h-4 bg-neutral-800 shrink-0" />

      {/* 6. Snapshot button */}
      <button
        id="btn-quick-snapshot"
        onClick={onTakeSnapshot}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
        title="Capture High-Res Photo"
      >
        <Camera className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Snapshot</span>
      </button>
    </div>
  );
};
