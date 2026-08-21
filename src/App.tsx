import React, { useState, useEffect } from 'react';
import { AuthModal } from './components/AuthModal';
import { SqueezeIDE } from './components/SqueezeIDE';
import { User, UserQuota, AuthMode } from './types';
import { RobloxProject } from './types/project';
import { safeFetchJson } from './utils/api';
import { createDefaultProject } from './utils/projectDisk';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
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
    showToast(`Welcome back, ${userData.name}!`);
  };

  const handleLogout = () => {
    setUser(null);
    setQuota(null);
    localStorage.removeItem('squeeze_token');
    localStorage.removeItem('squeeze_user');
    showToast('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-[#0B120D] text-white flex flex-col font-mono overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-[#FFC93C] text-[#0B120D] px-5 py-3 rounded-xl text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span>🍋</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Roblox AI IDE */}
      <SqueezeIDE 
        user={user}
        quota={quota}
        project={project}
        onLogout={handleLogout}
        onOpenAuth={(mode) => {
          setAuthMode(mode === 'signup' ? 'register' : 'login');
          setIsAuthOpen(true);
        }}
        onUpdateProject={setProject}
        onShowToast={showToast}
      />

      {/* Auth Dialog */}
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
