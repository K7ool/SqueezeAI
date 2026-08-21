import React, { useState, useEffect } from 'react';
import { User, UserQuota } from '../types';
import { 
  Sparkles, User as UserIcon, LogOut, LayoutDashboard, Zap, 
  HardDrive, Volume2, VolumeX, Menu, X, Terminal, BookOpen, Gift, Flame
} from 'lucide-react';
import { sound } from '../utils/audio';

interface NavbarProps {
  user: User | null;
  quota: UserQuota | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenDashboard: () => void;
  onOpenStudioGuide: () => void;
  onOpenProjectWorkspace: () => void;
  onOpenDailyRewards: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  quota,
  onOpenAuth,
  onLogout,
  onOpenDashboard,
  onOpenStudioGuide,
  onOpenProjectWorkspace,
  onOpenDailyRewards,
}) => {
  const [isMuted, setIsMuted] = useState(sound.isMuted());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleSoundChange = (e: any) => {
      setIsMuted(e.detail?.muted ?? sound.isMuted());
    };
    window.addEventListener('squeeze_sound_change', handleSoundChange);
    return () => window.removeEventListener('squeeze_sound_change', handleSoundChange);
  }, []);

  const handleToggleSound = () => {
    const newMuted = sound.toggleMute();
    setIsMuted(newMuted);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF6]/95 backdrop-blur-md border-b border-[#0B120D]/10">
      <nav className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo */}
        <a 
          href="#" 
          onClick={() => sound.pop()} 
          className="flex items-center gap-2 sm:gap-2.5 no-underline text-[#0B120D] group shrink-0"
        >
          <span className="w-8 h-8 rounded-xl bg-[#FFC93C] flex items-center justify-center shadow-[0_3px_0_#F0A500] text-base group-hover:scale-110 group-hover:rotate-6 active:scale-95 transition-all">
            🍋
          </span>
          <span className="font-display font-extrabold text-xl sm:text-2xl tracking-tight">Squeeze</span>
        </a>

        {/* Desktop Navigation Links */}
        <ul className="hidden xl:flex items-center gap-5 lg:gap-6 text-[13.5px] font-semibold text-[#0B120D]/75 list-none m-0 p-0 whitespace-nowrap shrink-0">
          <li>
            <a 
              href="#how" 
              onClick={() => sound.click()} 
              className="hover:text-[#0B120D] transition-colors py-1 inline-block"
            >
              How it works
            </a>
          </li>
          <li>
            <a 
              href="#features" 
              onClick={() => sound.click()} 
              className="hover:text-[#0B120D] transition-colors py-1 inline-block"
            >
              Features
            </a>
          </li>
          <li>
            <a 
              href="#debugger" 
              onClick={() => sound.click()} 
              className="hover:text-[#FF6B4A] transition-colors flex items-center gap-1.5 py-1"
            >
              <span>Debug Error</span>
              <span className="text-[10px] bg-[#FF6B4A]/15 text-[#FF6B4A] px-1.5 py-0.5 rounded-full font-bold">New</span>
            </a>
          </li>
          <li>
            <a 
              href="#showcase" 
              onClick={() => sound.click()} 
              className="hover:text-[#0B120D] transition-colors py-1 inline-block"
            >
              Showcase
            </a>
          </li>
          <li>
            <a 
              href="#pricing" 
              onClick={() => sound.click()} 
              className="hover:text-[#0B120D] transition-colors py-1 inline-block"
            >
              Pricing
            </a>
          </li>
          <li>
            <button 
              onClick={() => {
                sound.whoosh();
                onOpenStudioGuide();
              }} 
              className="hover:text-[#0B120D] transition-colors cursor-pointer bg-transparent border-0 font-semibold p-0 text-[13.5px] text-[#0B120D]/75 py-1 inline-block"
            >
              Studio Plugin
            </button>
          </li>
          <li>
            <a 
              href="#faq" 
              onClick={() => sound.click()} 
              className="hover:text-[#0B120D] transition-colors py-1 inline-block"
            >
              FAQ
            </a>
          </li>
        </ul>

        {/* User / CTA Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Audio Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className={`p-2 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
              isMuted 
                ? 'bg-black/5 border-black/10 text-[#0B120D]/40 hover:text-[#0B120D]' 
                : 'bg-[#FFC93C]/20 border-[#FFC93C]/50 text-[#0B120D] hover:scale-105 active:scale-95 shadow-xs'
            }`}
            title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#F0A500]" />}
          </button>

          {/* Daily Rewards Trigger */}
          <button
            id="navbar-daily-rewards-btn"
            onClick={() => {
              sound.pop();
              onOpenDailyRewards();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FFF8E7] to-[#FFEBB5] border border-[#FFC93C] hover:border-[#F0A500] hover:scale-105 active:scale-95 text-xs font-mono font-extrabold text-[#0B120D] transition-all cursor-pointer shadow-xs whitespace-nowrap"
            title="Open 7-Day Daily Login Rewards"
          >
            <span className="text-sm">🎁</span>
            <span className="hidden sm:inline">Daily Rewards</span>
            <span className="text-[9px] bg-[#FF6B4A] text-white px-1.5 py-0.2 rounded-full font-bold">7D</span>
          </button>

          {/* Quick Project Disk Trigger */}
          <button
            onClick={() => {
              sound.whoosh();
              onOpenProjectWorkspace();
            }}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF8E7] border border-[#0B120D]/10 hover:border-[#F0A500] hover:bg-[#FFF3D1] active:scale-95 text-xs font-mono font-bold text-[#0B120D] transition-all cursor-pointer shadow-xs whitespace-nowrap"
            title="Open Local Roblox Disk Workspace"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#F0A500]" />
            <span>Workspace</span>
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              {/* Quota Badge */}
              <div 
                onClick={() => {
                  sound.pop();
                  onOpenDashboard();
                }}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[#FFF8E7] border border-[#0B120D]/10 rounded-full cursor-pointer hover:border-[#F0A500] hover:scale-102 active:scale-95 transition-all text-xs font-mono whitespace-nowrap"
                title="Generations remaining"
              >
                <Zap className="w-3.5 h-3.5 text-[#F0A500] fill-[#F0A500]" />
                <span className="font-bold text-[#0B120D]">
                  {quota?.isUnlimited ? '∞ Unlimited' : `${quota?.remaining ?? 25} left`}
                </span>
                <span className="text-[#0B120D]/50 uppercase text-[9.5px] font-bold">({user.plan})</span>
              </div>

              {/* Dashboard Trigger */}
              <button
                onClick={() => {
                  sound.whoosh();
                  onOpenDashboard();
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-[#142019] text-[#FFFDF6] text-xs sm:text-sm font-semibold hover:bg-[#1D2E24] hover:scale-102 active:scale-95 transition-all cursor-pointer shadow-sm whitespace-nowrap"
              >
                <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FFC93C]" />
                <span>Dashboard</span>
              </button>

              {/* Logout Button */}
              <button
                onClick={() => {
                  sound.click();
                  onLogout();
                }}
                className="p-1.5 sm:p-2 text-[#0B120D]/60 hover:text-[#E85C4A] hover:bg-red-50 rounded-full transition-all cursor-pointer"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  sound.click();
                  onOpenAuth('login');
                }}
                className="text-xs sm:text-sm font-semibold text-[#0B120D]/80 hover:text-[#0B120D] hover:bg-black/5 active:scale-95 transition-all px-2.5 sm:px-3 py-1.5 rounded-full cursor-pointer whitespace-nowrap"
              >
                Log in
              </button>
              <button
                onClick={() => {
                  sound.pop();
                  onOpenAuth('register');
                }}
                className="btn-squeeze font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full cursor-pointer whitespace-nowrap"
              >
                Start building
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => {
              sound.pop();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            className="xl:hidden p-2 text-[#0B120D] hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile & Tablet Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#FFFDF6] border-b border-[#0B120D]/10 px-6 py-4 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-3 text-sm font-semibold text-[#0B120D]">
            <a 
              href="#how" 
              onClick={() => { sound.click(); setMobileMenuOpen(false); }}
              className="py-1.5 hover:text-[#F0A500] transition-colors"
            >
              How it works
            </a>
            <a 
              href="#features" 
              onClick={() => { sound.click(); setMobileMenuOpen(false); }}
              className="py-1.5 hover:text-[#F0A500] transition-colors"
            >
              Features
            </a>
            <a 
              href="#debugger" 
              onClick={() => { sound.click(); setMobileMenuOpen(false); }}
              className="py-1.5 text-[#FF6B4A] flex items-center justify-between"
            >
              <span>Debug Roblox Error</span>
              <span className="text-[10px] bg-[#FF6B4A]/15 px-2 py-0.5 rounded-full font-bold">New</span>
            </a>
            <a 
              href="#showcase" 
              onClick={() => { sound.click(); setMobileMenuOpen(false); }}
              className="py-1.5 hover:text-[#F0A500] transition-colors"
            >
              Showcase Examples
            </a>
            <a 
              href="#pricing" 
              onClick={() => { sound.click(); setMobileMenuOpen(false); }}
              className="py-1.5 hover:text-[#F0A500] transition-colors"
            >
              Pricing Plans
            </a>
            <button
              onClick={() => {
                sound.pop();
                setMobileMenuOpen(false);
                onOpenDailyRewards();
              }}
              className="py-1.5 text-left font-bold text-[#0B120D] hover:text-[#F0A500] transition-colors flex items-center justify-between cursor-pointer bg-[#FFF8E7] px-3 rounded-xl border border-[#FFC93C]"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🎁</span>
                <span>7-Day Daily Rewards</span>
              </div>
              <span className="text-[10px] bg-[#FF6B4A] text-white px-2 py-0.5 rounded-full font-bold">Claim</span>
            </button>
            <button
              onClick={() => {
                sound.whoosh();
                setMobileMenuOpen(false);
                onOpenStudioGuide();
              }}
              className="py-1.5 text-left font-semibold text-[#0B120D] hover:text-[#F0A500] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#F0A500]" />
              <span>Studio Plugin Guide</span>
            </button>
            <button
              onClick={() => {
                sound.whoosh();
                setMobileMenuOpen(false);
                onOpenProjectWorkspace();
              }}
              className="py-1.5 text-left font-semibold text-[#0B120D] hover:text-[#F0A500] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <HardDrive className="w-4 h-4 text-[#F0A500]" />
              <span>Local Roblox Disk Workspace</span>
            </button>
            <a 
              href="#faq" 
              onClick={() => { sound.click(); setMobileMenuOpen(false); }}
              className="py-1.5 hover:text-[#F0A500] transition-colors"
            >
              Frequently Asked Questions
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

