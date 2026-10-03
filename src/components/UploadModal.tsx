import React, { useRef, useState } from 'react';
import {
  Upload,
  X,
  Link as LinkIcon,
  FileCheck,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  Archive,
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onImportUrl: (url: string, name?: string) => Promise<boolean>;
  onLoadDefaults: () => void;
  initialTab?: 'upload' | 'url';
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadFiles,
  onImportUrl,
  onLoadDefaults,
  initialTab = 'upload',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>(initialTab);
  const [urlInput, setUrlInput] = useState('');
  const [urlNameInput, setUrlNameInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
      onClose();
    }
  };

  const handleImportUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a valid URL.');
      return;
    }

    try {
      setIsImporting(true);
      setErrorMsg(null);
      const success = await onImportUrl(trimmed, urlNameInput.trim());
      if (success) {
        setUrlInput('');
        setUrlNameInput('');
        onClose();
      } else {
        setErrorMsg('Could not fetch GLB file from this URL. Check CORS or URL validity.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error importing GLB from URL.');
    } finally {
      setIsImporting(false);
    }
  };

  const popularGlbUrls = [
    {
      name: 'Khronos Damaged Helmet',
      url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
    },
    {
      name: 'Khronos Toy Car',
      url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ToyCar/glTF-Binary/ToyCar.glb',
    },
    {
      name: 'Khronos Flight Helmet',
      url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/FlightHelmet/glTF-Binary/FlightHelmet.glb',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-neutral-100">Import 3D GLB Model</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-neutral-800 px-4 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Upload File / ZIP
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'url'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Import from URL
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'upload' ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,.gltf,.zip"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                  isDragging
                    ? 'border-sky-500 bg-sky-950/20 text-sky-300'
                    : 'border-neutral-700 hover:border-neutral-600 bg-neutral-950/40 text-neutral-400'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-neutral-200">
                  {isDragging ? 'Drop your 3D files here' : 'Click to select or drag and drop'}
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                  Supports .glb, .gltf, and .zip archives (extracts all models automatically)
                </p>
                <div className="flex items-center gap-2 mt-3 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Duplicate checking enabled</span>
                </div>
                <button
                  type="button"
                  className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                >
                  Browse Device Files (.glb, .zip)
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
                <span>Want default aircraft fleet?</span>
                <button
                  type="button"
                  onClick={() => {
                    onLoadDefaults();
                    onClose();
                  }}
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Aircraft Fleet</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleImportUrlSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  Direct GLB Model URL
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    required
                    placeholder="https://example.com/models/aircraft.glb"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Ensure the host permits Cross-Origin Requests (CORS).
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  Model Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Supersonic_Jet.glb"
                  value={urlNameInput}
                  onChange={(e) => setUrlNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              {/* Sample external public GLBs */}
              <div>
                <span className="text-[11px] text-neutral-400 font-medium block mb-1.5">
                  Try open sample models:
                </span>
                <div className="space-y-1">
                  {popularGlbUrls.map((sample) => (
                    <button
                      key={sample.name}
                      type="button"
                      onClick={() => {
                        setUrlInput(sample.url);
                        setUrlNameInput(`${sample.name}.glb`);
                      }}
                      className="w-full text-left p-1.5 px-2.5 rounded-lg bg-neutral-950/60 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 flex items-center justify-between transition-colors"
                    >
                      <span>{sample.name}</span>
                      <span className="text-[10px] text-sky-400 font-mono">Select</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5"
                >
                  {isImporting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Fetching GLB...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Import Model</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
