import React, { useState, useEffect } from 'react';
import { AuthMode, User } from '../types';
import { X, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2, RefreshCw, Zap, Eye, EyeOff } from 'lucide-react';
import { safeFetchJson } from '../utils/api';

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
  onChangeMode: (mode: AuthMode) => void;
}

interface UserExtended extends User {
  isOnboarded: boolean;
  onboardingCompletedAt?: string;
}

interface AuthModalState {
  email: string;
  password: string;
  name: string;
  showPassword: boolean;
  rememberMe: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  successInfo: string | null;
  isCheckingRememberMe: boolean;
}

const DEFAULT_REMEMBER_ME = false;

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSuccess,
  onChangeMode,
}) => {
  const [state, setState] = useState<AuthModalState>({
    email: '',
    password: '',
    name: '',
    showPassword: false,
    rememberMe: DEFAULT_REMEMBER_ME,
    isLoading: false,
    errorMessage: null,
    successInfo: null,
    isCheckingRememberMe: false,
  });

  useEffect(() => {
    setState(prev => ({
      ...prev,
      email: '',
      password: '',
      name: '',
      showPassword: false,
      rememberMe: DEFAULT_REMEMBER_ME,
      errorMessage: null,
      successInfo: null,
    }));
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, errorMessage: null, successInfo: null, isLoading: true }));

    try {
      if (mode === 'forgot_password') {
        const res = await safeFetchJson('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: state.email.trim() }),
        });
        if (!res.ok) throw new Error(res.error || 'Failed to send reset email.');
        setState(prev => ({ ...prev, successInfo: res.data?.message || 'Password reset link sent! Check your inbox.', isLoading: false }));
        return;
      }

      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body: Record<string, any> = {
        email: state.email.trim(),
        password: state.password,
        rememberMe: state.rememberMe,
      };

      if (mode === 'register') {
        body.name = state.name.trim();
      }

      const res = await safeFetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.data) {
        throw new Error(res.error || 'Authentication failed.');
      }

      const user: UserExtended = res.data.user;
      const token = res.data.token;

      if (state.rememberMe) {
        localStorage.setItem('squeeze:rememberMe', JSON.stringify({
          email: state.email,
          name: user.name,
          plan: user.plan,
        }));
      }

      if (!user.isOnboarded) {
        setState(prev => ({ ...prev, successInfo: `Welcome! Complete your onboarding to unlock full features.`, isLoading: false }));
        return;
      }

      onSuccess(user, token);
      onClose();
    } catch (err: any) {
      setState(prev => ({ ...prev, errorMessage: err.message || 'Something went wrong. Please check your details.', isLoading: false }));
    } finally {
      if (state.isCheckingRememberMe) {
        setTimeout(() => setState(prev => ({ ...prev, isCheckingRememberMe: false })), 1000);
      }
    }
  };

  const handleDemoLogin = async () => {
    setState(prev => ({ ...prev, isLoading: true, errorMessage: null }));
    try {
      const res = await safeFetchJson('/api/auth/google-sim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'builder@squeeze.gg' }),
      });
      if (!res.ok || !res.data) throw new Error(res.error || 'Demo login failed.');
      onSuccess(res.data.user, res.data.token);
      onClose();
    } catch (err: any) {
      setState(prev => ({ ...prev, errorMessage: err.message || 'Demo login failed.', isLoading: false }));
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('squeeze:rememberMe');
    if (stored) {
      const data = JSON.parse(stored);
      setState(prev => ({ ...prev, email: data.email, name: data.name, rememberMe: true }));
    }
  }, []);

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
            disabled={state.isLoading}
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

          {state.errorMessage && (
            <div className="p-3 rounded-xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 text-[#FF6B4A] text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{state.errorMessage}</span>
            </div>
          )}

          {state.successInfo && (
            <div className="p-3 rounded-xl bg-[#A8E6B0]/20 border border-[#A8E6B0]/40 text-[#2A6B47] text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{state.successInfo}</span>
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
                    value={state.name}
                    onChange={(e) => setState(prev => ({ ...prev, name: e.target.value }))}
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
                  value={state.email}
                  onChange={(e) => setState(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
                  pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                  title="Please enter a valid email address"
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
                    value={state.password}
                    onChange={(e) => setState(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    maxLength={128}
                    className="w-full bg-white border border-[#0B120D]/15 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC93C] transition-colors"
                    id="password-input"
                    aria-describedby="password-strength"
                  />
                  <div id="password-strength" className="mt-1 text-xs text-[#0B120D]/50 font-mono">
                    {8 <= state.password.length && state.password.length < 12 && state.password.match(/[a-z]/) && state.password.match(/[0-9]/) ? 'Good: mixed case & numbers' : 'Minimum 8 characters with uppercase, numbers recommended'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                    className="absolute right-3 top-3 text-[#0B120D]/40 hover:text-[#FFC93C] transition-colors pointer-events-none rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-[#FFC93C] focus:ring-offset-2"
                    aria-label={state.showPassword ? 'Hide password' : 'Show password'}
                  >
                    {state.showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <label className="block text-xs font-mono text-[#0B120D]/70">
              <input
                type="checkbox"
                checked={state.rememberMe}
                onChange={(e) => setState(prev => ({ ...prev, rememberMe: e.target.checked }))}
                className="rounded border-[#0B120D]/15 w-4 h-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFC93C] focus:ring-offset-2"
                aria-label="Remember me"
              />{' '}Remember me
            </label>

            <button
              type="submit"
              disabled={state.isLoading}
              className="w-full btn-squeeze font-bold text-sm py-3 rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {state.isLoading ? (
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

          {/* Onboarding Prompt for new users */}
          {mode === 'register' && !state.successInfo?.includes('Welcome') && (
            <div className="pt-3 text-xs text-[#0B120D]/50 font-mono">
              <span>After registration, complete onboarding to unlock:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5 max-w-xs">
                <li>Personalized script generation</li>
                <li>Save your favorite setups</li>
                <li>Track usage quotas</li>
              </ul>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};