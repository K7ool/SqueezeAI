import React from 'react';
import { User, UserQuota } from '../types';
import { Sparkles, User as UserIcon, LogOut, LayoutDashboard, Zap, HardDrive } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  quota: UserQuota | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenDashboard: () => void;
  onOpenStudioGuide: () => void;
  onOpenProjectWorkspace: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  quota,
  onOpenAuth,
  onLogout,
  onOpenDashboard,
  onOpenStudioGuide,
  onOpenProjectWorkspace,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF6]/90 backdrop-blur-md border-b border-[#0B120D]/10">
      <nav className="max-w-[1180px] mx-auto px-6 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-2.5 no-underline text-[#0B120D] group">
          <span className="w-8 h-8 rounded-xl bg-[#FFC93C] flex items-center justify-center shadow-[0_3px_0_#F0A500] text-base group-hover:scale-105 transition-transform">
            🍋
          </span>
          <span className="font-display font-extrabold text-2xl tracking-tight">Squeeze</span>
        </a>

        {/* Navigation Links */}
        <ul className="hidden md:flex items-center gap-6 text-[14px] font-semibold text-[#0B120D]/75 list-none m-0 p-0">
          <li>
            <a href="#how" className="hover:text-[#0B120D] transition-colors">How it works</a>
          </li>
          <li>
            <a href="#features" className="hover:text-[#0B120D] transition-colors">Features</a>
          </li>
          <li>
            <a href="#debugger" className="hover:text-[#FF6B4A] transition-colors flex items-center gap-1">
              <span>Debug Error</span>
              <span className="text-[10px] bg-[#FF6B4A]/15 text-[#FF6B4A] px-1.5 py-0.5 rounded-full font-bold">New</span>
            </a>
          </li>
          <li>
            <a href="#showcase" className="hover:text-[#0B120D] transition-colors">Showcase</a>
          </li>
          <li>
            <button
              onClick={onOpenProjectWorkspace}
              className="hover:text-[#0B120D] transition-colors cursor-pointer bg-transparent border-0 font-semibold p-0 text-[14px] text-[#0B120D]/75 flex items-center gap-1.5"
            >
              <HardDrive className="w-3.5 h-3.5 text-[#F0A500]" />
              <span>Project Studio</span>
            </button>
          </li>
          <li>
            <a href="#pricing" className="hover:text-[#0B120D] transition-colors">Pricing</a>
          </li>
          <li>
            <button 
              onClick={onOpenStudioGuide} 
              className="hover:text-[#0B120D] transition-colors cursor-pointer bg-transparent border-0 font-semibold p-0 text-[14px] text-[#0B120D]/75"
            >
              Studio Plugin
            </button>
          </li>
          <li>
            <a href="#faq" className="hover:text-[#0B120D] transition-colors">FAQ</a>
          </li>
        </ul>

        {/* User / CTA Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Project Disk Trigger */}
          <button
            onClick={onOpenProjectWorkspace}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF8E7] border border-[#0B120D]/10 hover:border-[#F0A500] text-xs font-mono font-bold text-[#0B120D] transition-all cursor-pointer"
            title="Open Local Disk Workspace"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#F0A500]" />
            <span>Disk Workspace</span>
          </button>

          {user ? (
            <div className="flex items-center gap-2.5">
              {/* Quota Badge */}
              <div 
                onClick={onOpenDashboard}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF8E7] border border-[#0B120D]/10 rounded-full cursor-pointer hover:border-[#F0A500] transition-colors text-xs font-mono"
                title="Generations remaining"
              >
                <Zap className="w-3.5 h-3.5 text-[#F0A500] fill-[#F0A500]" />
                <span className="font-bold text-[#0B120D]">
                  {quota?.isUnlimited ? '∞ Unlimited' : `${quota?.remaining ?? 25} left`}
                </span>
                <span className="text-[#0B120D]/50 uppercase text-[10px] font-bold">({user.plan})</span>
              </div>

              {/* Dashboard Trigger */}
              <button
                onClick={onOpenDashboard}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#142019] text-[#FFFDF6] text-sm font-semibold hover:bg-[#1D2E24] transition-all cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 text-[#FFC93C]" />
                <span>Dashboard</span>
              </button>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="p-2 text-[#0B120D]/60 hover:text-[#E85C4A] transition-colors cursor-pointer"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onOpenAuth('login')}
                className="text-sm font-semibold text-[#0B120D]/80 hover:text-[#0B120D] transition-colors px-2 py-1 cursor-pointer"
              >
                Log in
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="btn-squeeze font-bold text-sm px-5 py-2 rounded-full cursor-pointer"
              >
                Start building
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};
