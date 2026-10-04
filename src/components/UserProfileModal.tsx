import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Tag,
  ShieldCheck,
  Check,
  LogOut,
  AlertCircle,
  Loader2,
  KeyRound,
  Plane,
} from 'lucide-react';
import { updateUserNickname } from '../utils/firebase';
import type { User } from 'firebase/auth';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSignOut: () => void;
  onNicknameUpdated: (newNickname: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignOut,
  onNicknameUpdated,
}) => {
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      setNicknameInput(currentUser.displayName || '');
      setStatusMessage(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nicknameInput.trim();
    setIsSaving(true);
    setStatusMessage(null);

    const result = await updateUserNickname(trimmed);
    setIsSaving(false);

    if (result.success) {
      setStatusMessage({
        type: 'success',
        text: trimmed
          ? `Nickname updated to "${trimmed}"! All your aircraft will now display this nickname.`
          : 'Nickname cleared. Your email will be displayed on planes.',
      });
      onNicknameUpdated(trimmed);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Failed to update nickname.',
      });
    }
  };

  const initial = (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header with Background Gradient */}
        <div className="relative p-6 bg-gradient-to-b from-sky-950/40 to-transparent border-b border-neutral-800/80 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-sky-950/50 ring-2 ring-white/20">
              {initial}
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                User Profile
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-[210px]">
                {currentUser.email}
              </p>
            </div>
          </div>

          <button
            id="btn-close-profile"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-left leading-relaxed">{statusMessage.text}</div>
            </div>
          )}

          {/* Nickname Field */}
          <form onSubmit={handleSaveNickname} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-sky-400" />
                  Your Nickname
                </span>
                <span className="text-[10px] text-neutral-500 font-normal">
                  (Shown on all your planes)
                </span>
              </label>
              <div className="relative">
                <input
                  id="input-profile-nickname"
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="e.g. Captain Aland"
                  maxLength={40}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-neutral-100 text-xs placeholder:text-neutral-600 outline-none transition-all"
                />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">
                If a nickname is set, it will be displayed on all 3D planes you add or modify. If left empty, your email (<span className="text-neutral-300 font-mono text-[10px]">{currentUser.email}</span>) will be used.
              </p>
            </div>

            <button
              id="btn-save-nickname"
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-md shadow-sky-950 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Nickname to Firebase...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Nickname</span>
                </>
              )}
            </button>
          </form>

          {/* Read-Only Account Details */}
          <div className="pt-4 border-t border-neutral-800/80 space-y-2.5 text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Account Credentials
            </span>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/60 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-neutral-400">
                <Mail className="w-3.5 h-3.5 text-neutral-500" />
                <span>Email:</span>
              </div>
              <span className="font-mono text-neutral-200 select-all">{currentUser.email}</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/60 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-neutral-400">
                <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
                <span>UID:</span>
              </div>
              <span className="font-mono text-neutral-400 text-[10px] truncate max-w-[190px] select-all">
                {currentUser.uid}
              </span>
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="pt-2">
            <button
              id="btn-modal-signout"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="w-full py-2 px-4 rounded-xl bg-neutral-950 hover:bg-rose-950/40 border border-neutral-800 hover:border-rose-500/40 text-neutral-300 hover:text-rose-300 font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
