import React, { useEffect } from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import { ModelItem } from '../types/model';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ModelItem | null;
  onConfirm: (id: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  model,
  onConfirm,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !model) return null;

  const handleConfirm = () => {
    onConfirm(model.id);
    onClose();
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">Delete 3D Model</h2>
              <p className="text-[11px] text-neutral-400">Remove model from library and database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-neutral-300 leading-relaxed">
            Are you sure you want to delete <span className="font-semibold text-white">"{model.name}"</span>?
          </p>

          {/* Model info card */}
          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-mono">File Size</span>
              <span className="text-neutral-200 font-medium font-mono">{formatSize(model.size)}</span>
            </div>
            {model.metrics && model.metrics.triangles > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 font-mono">Polygon Count</span>
                <span className="text-neutral-200 font-medium font-mono">
                  {model.metrics.triangles.toLocaleString()} triangles
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>This model file and its cached geometry will be permanently removed.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-end gap-2 bg-neutral-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors flex items-center gap-1.5 shadow-lg shadow-red-950"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Model</span>
          </button>
        </div>
      </div>
    </div>
  );
};
