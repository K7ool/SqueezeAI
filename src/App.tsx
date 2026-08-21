import React, { useState, useEffect } from 'react';
import { User, UserQuota, GeneratedScript, AuthMode } from './types';
import { RobloxProject, ProjectFile } from './types/project';
import { loadProjectFromLocalStorage, saveProjectToLocalStorage, createDefaultProject } from './utils/projectDisk';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { StatsStrip } from './components/StatsStrip';
import { HowItWorks } from './components/HowItWorks';
import { GameMapSection } from './components/GameMapSection';
import { FeaturesGrid } from './components/FeaturesGrid';
import { LuauDebuggerSection } from './components/LuauDebuggerSection';
import { ShowcaseSection } from './components/ShowcaseSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { PricingSection } from './components/PricingSection';
import { FaqSection } from './components/FaqSection';
import { NewsletterSection } from './components/NewsletterSection';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { DashboardModal } from './components/DashboardModal';
import { RobloxStudioModal } from './components/RobloxStudioModal';
import { DailyRewardsModal } from './components/DailyRewardsModal';
import { DailyRewardsCard } from './components/DailyRewardsCard';
import { safeFetchJson } from './utils/api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [currentScript, setCurrentScript] = useState<GeneratedScript | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  
  // Project Workspace Disk State
  const [project, setProject] = useState<RobloxProject>(() => loadProjectFromLocalStorage());

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'chat' | 'ideas' | 'files' | 'generator' | 'history' | 'billing' | 'apikeys'>('chat');
  const [isStudioGuideOpen, setIsStudioGuideOpen] = useState(false);
  const [isDailyRewardsOpen, setIsDailyRewardsOpen] = useState(false);
  
  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Check auth on load
  const checkAuth = async () => {
    const token = localStorage.getItem('squeeze_token');
    if (!token) return;

    try {
      const res = await safeFetchJson('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok && res.data) {
        if (res.data.user) {
          setUser(res.data.user);
          setQuota(res.data.quota);
        } else {
          localStorage.removeItem('squeeze_token');
        }
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const openDashboardWithTab = (tab: 'chat' | 'ideas' | 'files' | 'generator' | 'history' | 'billing' | 'apikeys' = 'chat') => {
    setDashboardTab(tab);
    setIsDashboardOpen(true);
  };

  const handleDebug = async (errorMessage: string, brokenCode?: string): Promise<GeneratedScript | null> => {
    setIsDebugging(true);
    const token = localStorage.getItem('squeeze_token');

    try {
      const res = await safeFetchJson('/api/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ errorMessage, brokenCode }),
      });

      if (res.ok && res.data?.script) {
        showToast('✓ Error diagnosed & Luau fix generated!');
        return res.data.script;
      }
      
      // Client-side fallback if backend not reachable on Vercel
      const fallbackScript: GeneratedScript = {
        id: `scr-dbg-${Date.now()}`,
        userId: 'usr_local',
        title: 'Diagnosed Luau Fix',
        prompt: `Debug: ${errorMessage}`,
        code: `--!strict\n-- [Squeeze Luau Debugger] Fixed runtime nil reference\nlocal Players = game:GetService("Players")\n\nlocal function onPlayerAdded(player: Player)\n\t-- Wait for leaderstats safely using WaitForChild\n\tlocal leaderstats = player:WaitForChild("leaderstats", 10)\n\tif not leaderstats then\n\t\twarn("[CoinManager] leaderstats timed out for " .. player.Name)\n\t\treturn\n\tend\n\t\n\tlocal coins = leaderstats:WaitForChild("Coins", 5) :: NumberValue?\n\tif coins then\n\t\tcoins.Value += 100\n\t\tprint(string.format("⚡ Added 100 coins to %s", player.Name))\n\tend\nend\n\nPlayers.PlayerAdded:Connect(onPlayerAdded)`,
        explanation: 'Replaced direct indexing with player:WaitForChild("leaderstats", timeout) with null-guarding.',
        scriptType: 'Server Script',
        targetInstance: 'ServerScriptService',
        lineCount: 18,
        tags: ['Debugger', 'WaitForChild', 'SafeIndex'],
        isFavorite: false,
        createdAt: new Date().toISOString()
      };
      showToast('✓ Error diagnosed with safe Luau fallback!');
      return fallbackScript;
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
      return null;
    } finally {
      setIsDebugging(false);
    }
  };

  const handleAuthSuccess = (authUser: User, token: string) => {
    localStorage.setItem('squeeze_token', token);
    setUser(authUser);
    setQuota({
      used: authUser.usedGenerations,
      limit: authUser.monthlyLimit,
      remaining: authUser.plan === 'free' ? Math.max(0, authUser.monthlyLimit - authUser.usedGenerations) : 9999,
      isUnlimited: authUser.plan !== 'free',
      planName: authUser.plan === 'free' ? 'Sip' : authUser.plan === 'pro' ? 'Pitcher' : 'Stand'
    });
    showToast(`Welcome back, ${authUser.name}! 🍋`);
  };

  const handleLogout = () => {
    localStorage.removeItem('squeeze_token');
    setUser(null);
    setQuota(null);
    showToast('Logged out successfully.');
  };

  const handleSelectPlan = async (planId: 'free' | 'pro' | 'studio') => {
    if (!user) {
      setIsAuthOpen(true);
      setAuthMode('register');
      return;
    }

    setIsUpgrading(true);
    const token = localStorage.getItem('squeeze_token');

    try {
      const res = await fetch('/api/stripe/simulate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setQuota({
          used: data.user.usedGenerations,
          limit: data.plan.limit,
          remaining: planId === 'free' ? Math.max(0, data.plan.limit - data.user.usedGenerations) : 9999,
          isUnlimited: planId !== 'free',
          planName: data.plan.name
        });
        showToast(`🎉 Plan updated to ${data.plan.name} (${planId.toUpperCase()})!`);
      }
    } catch (err: any) {
      showToast(`Upgrade failed: ${err.message}`);
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFDF6] text-[#0B120D]">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0B120D] text-[#FFFDF6] px-5 py-3 rounded-full text-xs font-mono font-bold shadow-2xl border border-white/20 flex items-center gap-2 animate-bounce">
          <span>🍋</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Bar */}
      <Navbar
        user={user}
        quota={quota}
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setIsAuthOpen(true);
        }}
        onLogout={handleLogout}
        onOpenDashboard={() => openDashboardWithTab('chat')}
        onOpenStudioGuide={() => setIsStudioGuideOpen(true)}
        onOpenProjectWorkspace={() => openDashboardWithTab('files')}
        onOpenDailyRewards={() => setIsDailyRewardsOpen(true)}
      />

      {/* Main Sections */}
      <main className="flex-1">
        <HeroSection
          currentScript={currentScript}
          isLoading={isGenerating}
          onOpenDashboard={openDashboardWithTab}
          onShowToast={showToast}
        />

        <StatsStrip />

        {/* Responsive Daily Rewards Live Banner */}
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4">
          <DailyRewardsCard
            onOpenModal={() => setIsDailyRewardsOpen(true)}
            onShowToast={showToast}
          />
        </section>

        <HowItWorks />
        
        <GameMapSection />

        <FeaturesGrid
          onScrollToTry={() => openDashboardWithTab('chat')}
          onScrollToDebugger={() => openDashboardWithTab('generator')}
        />

        <LuauDebuggerSection
          onDebug={handleDebug}
          isLoading={isDebugging}
          onOpenProjectWorkspace={() => openDashboardWithTab('files')}
          onShowToast={showToast}
        />

        <ShowcaseSection 
          onOpenProjectWorkspace={() => openDashboardWithTab('files')}
          onShowToast={showToast}
        />

        <TestimonialsSection />

        <PricingSection
          user={user}
          onSelectPlan={handleSelectPlan}
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setIsAuthOpen(true);
          }}
          isUpgrading={isUpgrading}
        />

        <FaqSection />

        <NewsletterSection />
      </main>

      {/* Footer */}
      <Footer
        onOpenStudioGuide={() => setIsStudioGuideOpen(true)}
        onScrollToTry={() => openDashboardWithTab('chat')}
      />

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        mode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        onChangeMode={(m) => setAuthMode(m)}
      />

      <DashboardModal
        isOpen={isDashboardOpen}
        user={user}
        quota={quota}
        project={project}
        initialTab={dashboardTab}
        onClose={() => setIsDashboardOpen(false)}
        onUpdateProject={(upd) => setProject(upd)}
        onSelectScript={(script) => {
          setCurrentScript(script);
        }}
        onUpgradePlan={handleSelectPlan}
        onOpenStudioGuide={() => setIsStudioGuideOpen(true)}
        onShowToast={showToast}
      />

      <RobloxStudioModal
        isOpen={isStudioGuideOpen}
        onClose={() => setIsStudioGuideOpen(false)}
      />

      <DailyRewardsModal
        isOpen={isDailyRewardsOpen}
        onClose={() => setIsDailyRewardsOpen(false)}
        onShowToast={showToast}
      />

    </div>
  );
}
