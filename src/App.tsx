import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { HeroSection } from './components/HeroSection';
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
import { StatsStrip } from './components/StatsStrip';
import { DailyRewardsCard } from './components/DailyRewardsCard';
import { SqueezeIDE } from './components/SqueezeIDE';
import { User, UserQuota, GeneratedScript } from './types';
import { RobloxProject } from './types/project';
import { safeFetchJson } from './utils/api';
import { createDefaultProject } from './utils/projectDisk';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [project, setProject] = useState<RobloxProject>(createDefaultProject());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load auth on mount
  useEffect(() => {
    const token = localStorage.getItem('squeeze_token');
    const storedUser = localStorage.getItem('squeeze_user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        safeFetchJson('/api/user/quota', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => {
          if (res.ok && res.data) setQuota(res.data.quota);
        });
      } catch (e) {
        console.error('Failed to restore session');
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAuthSuccess = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('squeeze_token', token);
    localStorage.setItem('squeeze_user', JSON.stringify(userData));
    setIsAuthOpen(false);
    showToast(`Welcome back, ${userData.username}!`);
  };

  const handleLogout = () => {
    setUser(null);
    setQuota(null);
    localStorage.removeItem('squeeze_token');
    localStorage.removeItem('squeeze_user');
    showToast('Signed out successfully');
  };

  // If logged in, ONLY show the Squeeze IDE interface
  if (user) {
    return (
      <>
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-[9999] bg-[#FFC93C] text-[#0B120D] px-5 py-3 rounded-xl text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-bounce">
            <span>{toastMessage}</span>
          </div>
        )}
        <SqueezeIDE 
          user={user}
          quota={quota}
          project={project}
          onLogout={handleLogout}
          onUpdateProject={setProject}
          onShowToast={showToast}
        />
      </>
    );
  }

  // Otherwise, show the landing page
  return (
    <div className="min-h-screen flex flex-col bg-[#FFFDF6] text-[#0B120D]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-[#0B120D] text-[#FFFDF6] px-5 py-3 rounded-full text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span>🍋</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Bar */}
      <Navbar
        user={null}
        quota={null}
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setIsAuthOpen(true);
        }}
        onLogout={handleLogout}
        onOpenDashboard={() => setIsAuthOpen(true)}
        onOpenStudioGuide={() => {}}
        onOpenProjectWorkspace={() => setIsAuthOpen(true)}
        onOpenDailyRewards={() => {}}
      />

      {/* Main Sections */}
      <main className="flex-1">
        <HeroSection
          currentScript={null}
          isLoading={false}
          onOpenDashboard={() => setIsAuthOpen(true)}
          onShowToast={showToast}
        />
        <StatsStrip />
        <HowItWorks />
        <GameMapSection />
        <FeaturesGrid
          onScrollToTry={() => setIsAuthOpen(true)}
          onScrollToDebugger={() => setIsAuthOpen(true)}
        />
        <LuauDebuggerSection
          onDebug={async () => { setIsAuthOpen(true); return null; }}
          isLoading={false}
          onOpenProjectWorkspace={() => setIsAuthOpen(true)}
          onShowToast={showToast}
        />
        <ShowcaseSection 
          onOpenProjectWorkspace={() => setIsAuthOpen(true)}
          onShowToast={showToast}
        />
        <TestimonialsSection />
        <PricingSection
          user={null}
          onSelectPlan={() => setIsAuthOpen(true)}
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setIsAuthOpen(true);
          }}
          isUpgrading={false}
        />
        <FaqSection />
        <NewsletterSection />
      </main>

      <Footer
        onOpenStudioGuide={() => {}}
        onScrollToTry={() => setIsAuthOpen(true)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        mode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        onChangeMode={(m) => setAuthMode(m)}
      />
    </div>
  );
}

export default App;
