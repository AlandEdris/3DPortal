import React, { useState } from 'react';
import { Box, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { signInUser } from '../utils/firebase';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await signInUser(email, password);

    setIsLoading(false);
    if (result.error) {
      setErrorMessage(result.error);
    } else if (result.user) {
      onLoginSuccess();
    }
  };

  return (
    <div className="relative min-h-screen w-screen flex items-center justify-center bg-neutral-950 text-neutral-100 overflow-hidden select-none">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md mx-4 p-8 sm:p-10 rounded-3xl bg-neutral-900/80 border border-neutral-800/80 shadow-2xl backdrop-blur-xl z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20 mb-4 ring-1 ring-white/20">
            <Box className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            3D Portal Studio
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs">
            Real-Time Cloud Synced Aircraft & 3D Model Inspection Platform
          </p>
        </div>

        {/* Security / System Access Notice */}
        <div className="mb-6 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/60 flex items-center gap-2.5 text-[11px] text-neutral-400">
          <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            Authorized Firebase accounts only. Self-registration is disabled for security.
          </span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-left leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5 text-left">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="input-login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-neutral-100 text-xs placeholder:text-neutral-600 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5 text-left">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="input-login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-neutral-100 text-xs placeholder:text-neutral-600 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-sky-950/50 hover:shadow-sky-500/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating with Firebase...</span>
              </>
            ) : (
              <>
                <span>Sign In to 3D Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-neutral-800/60 text-center">
          <p className="text-[11px] text-neutral-500">
            Connected to Cloud Project: <span className="text-neutral-300 font-mono">dportal-bcce2</span>
          </p>
        </div>
      </div>
    </div>
  );
};
