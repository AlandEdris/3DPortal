import React, { useState, useEffect } from 'react';
import {
  Cloud,
  X,
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  Radio,
  Sparkles,
} from 'lucide-react';
import {
  getFirebaseConfig,
  saveFirebaseConfig,
  clearFirebaseConfig,
  testFirebaseConnection,
  isCloudConfigured,
} from '../utils/firebase';

interface CloudConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const CloudConfigModal: React.FC<CloudConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [rawInput, setRawInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isCurrentlyConnected, setIsCurrentlyConnected] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const config = getFirebaseConfig();
      const connected = isCloudConfigured();
      setIsCurrentlyConnected(connected);
      setCurrentProjectId(config?.projectId || null);
      setStatusMessage(null);
      setRawInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper to parse pasted Firebase config (JSON or JavaScript object syntax)
  const parseFirebaseSnippet = (input: string): Record<string, string> | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Try pure JSON parse
    try {
      const json = JSON.parse(trimmed);
      if (json.apiKey && json.projectId) return json;
    } catch {}

    // 2. Try regex extraction for JS object syntax (const firebaseConfig = { ... })
    const extractField = (fieldName: string) => {
      const match = trimmed.match(new RegExp(`${fieldName}\\s*:\\s*["']([^"']+)["']`));
      return match ? match[1] : '';
    };

    const apiKey = extractField('apiKey');
    const projectId = extractField('projectId');
    const authDomain = extractField('authDomain');
    const storageBucket = extractField('storageBucket');
    const messagingSenderId = extractField('messagingSenderId');
    const appId = extractField('appId');

    if (apiKey && projectId) {
      return {
        apiKey,
        projectId,
        ...(authDomain ? { authDomain } : {}),
        ...(storageBucket ? { storageBucket } : {}),
        ...(messagingSenderId ? { messagingSenderId } : {}),
        ...(appId ? { appId } : {}),
      };
    }

    return null;
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const parsed = parseFirebaseSnippet(rawInput);
    if (!parsed || !parsed.apiKey || !parsed.projectId) {
      setStatusMessage({
        type: 'error',
        text: 'Invalid Firebase configuration. Please paste the full firebaseConfig object containing apiKey and projectId.',
      });
      return;
    }

    setIsTesting(true);
    const testResult = await testFirebaseConnection(parsed);
    setIsTesting(false);

    if (testResult.success) {
      saveFirebaseConfig(parsed);
      setIsCurrentlyConnected(true);
      setCurrentProjectId(parsed.projectId);
      setStatusMessage({
        type: 'success',
        text: `Connected to Firebase Firestore (${parsed.projectId})! Real-time sync is now active for all users.`,
      });
      onConfigChanged();
    } else {
      setStatusMessage({
        type: 'error',
        text: testResult.message,
      });
    }
  };

  const handleTestExisting = async () => {
    setIsTesting(true);
    const result = await testFirebaseConnection();
    setIsTesting(false);
    setStatusMessage({
      type: result.success ? 'success' : 'error',
      text: result.message,
    });
  };

  const handleDisconnect = () => {
    clearFirebaseConfig();
    setIsCurrentlyConnected(false);
    setCurrentProjectId(null);
    setStatusMessage({
      type: 'info',
      text: 'Disconnected from cloud database. Reverted to local browser IndexedDB storage.',
    });
    onConfigChanged();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <span>Online Database & Real-Time Cloud Sync</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-normal">
                  Firebase Free Tier
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Sync 3D models and edits across all devices & users in real-time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Current Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
              isCurrentlyConnected
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                : 'bg-neutral-950/80 border-neutral-800 text-neutral-300'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {isCurrentlyConnected ? (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 animate-pulse" />
              ) : (
                <Radio className="w-4 h-4 text-sky-400 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-semibold">
                  {isCurrentlyConnected
                    ? 'Cloud Database Connected (Live Real-Time Sync)'
                    : 'Currently Using Local Storage (IndexedDB)'}
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {isCurrentlyConnected
                    ? `Connected to Firestore project "${currentProjectId}". Every visitor sees the same live models and updates instantly.`
                    : 'Changes are currently saved only in your local browser. Connect Firebase Firestore below to sync online for everyone.'}
                </p>
              </div>
            </div>

            {isCurrentlyConnected && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleTestExisting}
                  disabled={isTesting}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>Test</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 transition-colors flex items-center gap-1"
                  title="Disconnect and use local database"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            )}
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-red-950/40 border-red-500/40 text-red-300'
                  : 'bg-neutral-800/80 border-neutral-700 text-neutral-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Form: Paste Firebase Configuration */}
          <form onSubmit={handleConnect} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Paste Firebase Configuration (JSON or JavaScript)</span>
                </label>
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline"
                >
                  <span>Open Firebase Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-portal.firebaseapp.com",\n  projectId: "my-portal",\n  storageBucket: "my-portal.appspot.com",\n  messagingSenderId: "123456789",\n  appId: "1:...:web:..."\n};`}
                rows={5}
                className="w-full p-3 font-mono text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isTesting || !rawInput.trim()}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-950"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying & Connecting...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Connect & Enable Real-Time Cloud Sync</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Setup Instructions */}
          <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-2 text-[11px] text-neutral-400">
            <p className="font-semibold text-neutral-200 flex items-center gap-1.5 text-xs">
              <span>How to get your free Firebase Config (Takes 1 Minute):</span>
            </p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>
                Open <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Firebase Console</a> & click <strong>Create a project</strong> (100% free, no credit card required).
              </li>
              <li>
                In your project, go to <strong>Build &rarr; Firestore Database</strong>, click <strong>Create Database</strong>, and select <em>Start in test mode</em> (or set read/write rules to <code className="text-neutral-300">allow read, write: if true;</code>).
              </li>
              <li>
                Click the <strong>Project Settings Gear ⚙️ &rarr; General</strong>, scroll down to <strong>Your apps</strong>, click the <strong>&lt;/&gt; (Web)</strong> icon, and register an app.
              </li>
              <li>
                Copy the generated <code className="text-sky-300">const firebaseConfig = &#123; ... &#125;;</code> and paste it above!
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Your configuration is safely stored in your browser's persistent storage.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
