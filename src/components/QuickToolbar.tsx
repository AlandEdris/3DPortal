import React, { useState } from 'react';
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
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-2xl shadow-2xl max-w-[95vw] overflow-x-auto">
      {/* 1. Camera View Presets Menu */}
      <div className="relative">
        <button
          onClick={() => {
            setShowViewMenu(!showViewMenu);
            setShowModeMenu(false);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap"
          title="Camera View Angle"
        >
          <Box className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Views</span>
          <ChevronUp className="w-3 h-3 text-neutral-400" />
        </button>

        {showViewMenu && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowViewMenu(false)}
            />
            <div className="absolute bottom-full mb-2 left-0 w-36 bg-neutral-900 border border-neutral-800 rounded-xl py-1 shadow-2xl z-40">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                Camera Angles
              </div>
              {viewPresets.map((vp) => (
                <button
                  key={vp.id}
                  onClick={() => {
                    onSelectCameraPreset(vp.id);
                    setShowViewMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  {vp.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 2. Reset / Frame Model */}
      <button
        onClick={onResetView}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap"
        title="Reset & Center View"
      >
        <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
        <span className="hidden sm:inline">Center</span>
      </button>

      {/* 2b. Zoom Out & Zoom In */}
      {onZoomOut && (
        <button
          onClick={onZoomOut}
          className="p-1.5 rounded-xl text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors"
          title="Zoom Out (Infinite)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      )}

      {onZoomIn && (
        <button
          onClick={onZoomIn}
          className="p-1.5 rounded-xl text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Divider */}
      <div className="w-[1px] h-4 bg-neutral-800 shrink-0" />

      {/* 3. Render Mode Menu */}
      <div className="relative">
        <button
          onClick={() => {
            setShowModeMenu(!showModeMenu);
            setShowViewMenu(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
            renderMode !== 'shaded'
              ? 'bg-neutral-800 text-sky-400'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
          }`}
          title="Shading Mode"
        >
          <Eye className="w-3.5 h-3.5 text-neutral-400" />
          <span className="capitalize hidden sm:inline">{renderMode}</span>
          <ChevronUp className="w-3 h-3 text-neutral-400" />
        </button>

        {showModeMenu && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowModeMenu(false)}
            />
            <div className="absolute bottom-full mb-2 left-0 w-40 bg-neutral-900 border border-neutral-800 rounded-xl py-1 shadow-2xl z-40">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                Shading Style
              </div>
              {renderModes.map((rm) => (
                <button
                  key={rm.id}
                  onClick={() => {
                    onSetRenderMode(rm.id);
                    setShowModeMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    renderMode === rm.id
                      ? 'bg-neutral-800 text-sky-400 font-medium'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  {rm.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 4. Grid Toggle */}
      <button
        onClick={onToggleGrid}
        className={`p-2 rounded-xl text-xs transition-colors ${
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
        onClick={onToggleAutoRotate}
        className={`p-2 rounded-xl text-xs transition-colors ${
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
        onClick={onTakeSnapshot}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 transition-colors shadow-sm whitespace-nowrap"
        title="Capture High-Res Photo"
      >
        <Camera className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Snapshot</span>
      </button>
    </div>
  );
};
