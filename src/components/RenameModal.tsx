import React, { useState, useEffect, useRef } from 'react';
import { Edit3, X, Check, AlertCircle } from 'lucide-react';
import { ModelItem } from '../types/model';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ModelItem | null;
  onRename: (id: string, newName: string) => void;
  existingModels: ModelItem[];
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  model,
  onRename,
  existingModels,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (model) {
      // Strip .glb if user is editing human name
      const baseName = model.name.replace(/\.(glb|gltf)$/i, '');
      setNameInput(baseName);
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [model, isOpen]);

  if (!isOpen || !model) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();

    if (!trimmed) {
      setError('Model name cannot be empty');
      return;
    }

    // Check duplicate name against other models
    const normalizedInput = trimmed.toLowerCase();
    const isDuplicate = existingModels.some(
      (m) =>
        m.id !== model.id &&
        m.name.toLowerCase().replace(/\.(glb|gltf)$/i, '') === normalizedInput
    );

    if (isDuplicate) {
      setError(`A model named "${trimmed}" already exists in your library.`);
      return;
    }

    // Append .glb if not present or preserve natural display name
    onRename(model.id, trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">Rename 3D Model</h2>
              <p className="text-[11px] text-neutral-400">Update model display title in library & database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              New Model Name
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter model name..."
                className={`w-full px-3.5 py-2.5 bg-neutral-950 border rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors ${
                  error
                    ? 'border-red-500/80 focus:border-red-400'
                    : 'border-neutral-700/80 focus:border-sky-500'
                }`}
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="text-[11px] text-neutral-400 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80 space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">Original File:</span>
              <span className="font-mono text-neutral-300 truncate max-w-[220px]">{model.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">File Size:</span>
              <span className="font-mono text-neutral-300">{(model.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Database Sync:</span>
              <span className="text-emerald-400 font-medium">Automatic on save</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-sky-950"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Name</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
