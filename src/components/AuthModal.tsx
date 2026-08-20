import React, { useState } from 'react';
import { AuthMode, User } from '../types';
import { X, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2, RefreshCw, Zap } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
  onChangeMode: (mode: AuthMode) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSuccess,
  onChangeMode,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);
    setIsLoading(true);

    try {
      if (mode === 'forgot_password') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send reset email.');
        setSuccessInfo(data.message || 'Password reset link sent! Check your inbox.');
        setIsLoading(false);
        return;
      }

      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register' 
        ? { email: email.trim(), password, name: name.trim() } 
        : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      onSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/google-sim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'builder@squeeze.gg' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Demo login failed.');
      onSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#FFFDF6] text-[#0B120D] w-full max-w-md rounded-3xl border border-[#0B120D]/15 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 bg-[#142019] text-[#FFFDF6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#FFC93C] text-[#0B120D] flex items-center justify-center font-bold text-base shadow-sm">
              🍋
            </span>
            <div>
              <h3 className="font-display font-bold text-lg leading-tight">
                {mode === 'login' && 'Log in to Squeeze'}
                {mode === 'register' && 'Create Squeeze Account'}
                {mode === 'forgot_password' && 'Reset Password'}
              </h3>
              <p className="text-xs text-[#FFFDF6]/60 font-mono">
                {mode === 'register' ? 'Get 25 free Luau generations' : 'Access your scripts & settings'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#FFFDF6]/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          
          {/* Quick Demo 1-Click Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl border border-[#0B120D]/15 bg-[#FFF8E7] hover:bg-[#FFC93C] text-[#0B120D] font-bold text-xs sm:text-sm font-mono flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Zap className="w-4 h-4 text-[#F0A500] fill-[#F0A500]" />
            <span>1-Click Demo Login (BloxDev Alex · Pro Plan)</span>
          </button>

          <div className="flex items-center gap-3 text-xs text-[#0B120D]/40 font-mono">
            <div className="flex-1 h-px bg-[#0B120D]/10" />
            <span>or continue with email</span>
            <div className="flex-1 h-px bg-[#0B120D]/10" />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 text-[#FF6B4A] text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3 rounded-xl bg-[#A8E6B0]/20 border border-[#A8E6B0]/40 text-[#2A6B47] text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successInfo}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-mono text-[#0B120D]/70 mb-1">Your Name / Roblox Handle</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-3 text-[#0B120D]/40" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. TycoonMaster"
                    className="w-full bg-white border border-[#0B120D]/15 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC93C] transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-[#0B120D]/70 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[#0B120D]/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-white border border-[#0B120D]/15 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC93C] transition-colors"
                />
              </div>
            </div>

            {mode !== 'forgot_password' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-mono text-[#0B120D]/70">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => onChangeMode('forgot_password')}
                      className="text-[11px] font-mono text-[#FF6B4A] hover:underline bg-transparent border-0 p-0 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#0B120D]/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-white border border-[#0B120D]/15 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC93C] transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-squeeze font-bold text-sm py-3 rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing…</span>
                </>
              ) : (
                <span>
                  {mode === 'login' && 'Log In'}
                  {mode === 'register' && 'Create Account'}
                  {mode === 'forgot_password' && 'Send Reset Email'}
                </span>
              )}
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="pt-2 text-center text-xs font-mono text-[#0B120D]/60">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => onChangeMode('register')}
                  className="font-bold text-[#FF6B4A] hover:underline bg-transparent border-0 p-0 cursor-pointer"
                >
                  Sign up free
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => onChangeMode('login')}
                  className="font-bold text-[#FF6B4A] hover:underline bg-transparent border-0 p-0 cursor-pointer"
                >
                  Log in
                </button>
              </p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
