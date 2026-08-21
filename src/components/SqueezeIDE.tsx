import React, { useState, useEffect, useRef } from 'react';
import { User, UserQuota } from '../types';
import { RobloxProject } from '../types/project';
import { Settings, Maximize2, Map, Code, Layers, Activity, ChevronRight, CheckCircle2, AlertTriangle, RefreshCw, X, Play, ShieldCheck, Power } from 'lucide-react';
import { ChatStudio } from './ChatStudio';
import { InteractiveGameMap } from './InteractiveGameMap';
import { fetchStudioSyncStatus, StudioSyncState, disconnectStudioSession } from '../utils/syncClient';

interface SqueezeIDEProps {
  user: User | null;
  quota: UserQuota | null;
  project: RobloxProject;
  onLogout: () => void;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
}

export const SqueezeIDE: React.FC<SqueezeIDEProps> = ({ user, quota, project, onLogout, onUpdateProject, onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'map' | 'settings'>('chats');
  const [syncState, setSyncState] = useState<StudioSyncState | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // Poll for studio status
  useEffect(() => {
    if (!isPolling) return;
    const fetchStatus = async () => {
      const state = await fetchStudioSyncStatus(project.id);
      if (state) setSyncState(state);
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [project.id, isPolling]);

  const isConnected = syncState?.session?.isOnline;
  
  const handleDisconnect = async () => {
    if (!syncState?.session?.token) {
      onShowToast('❌ No active session to disconnect');
      return;
    }
    const success = await disconnectStudioSession(syncState.session.token);
    if (success) {
      onShowToast('✓ Studio session disconnected');
      const state = await fetchStudioSyncStatus(project.id);
      if (state) setSyncState(state);
    } else {
      onShowToast('❌ Failed to disconnect session');
    }
  };

  return (
    <div className="w-full h-screen bg-[#0B120D] text-white flex flex-col font-mono overflow-hidden">
      {/* Top Header */}
      <div className="h-12 bg-[#11161D] border-b border-white/10 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-[#FFC93C] flex items-center justify-center text-[#0B120D] font-bold text-xs">🍋</div>
          <h1 className="text-sm font-bold tracking-tight">SQUEEZE IDE</h1>
          <div className="w-px h-4 bg-white/20 mx-2"></div>
          <span className="text-xs text-white/60 font-semibold">{project.name}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Studio Connection Status Widget */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-bold transition-all ${
            isConnected 
              ? 'bg-[#182618] border-[#3FB950]/30 text-[#3FB950]' 
              : 'bg-[#161B22] border-white/10 text-white/40'
          }`}>
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3FB950] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3FB950]"></span>
                </span>
                <span>Studio Connected</span>
                <span className="text-[10px] opacity-60 ml-2 font-normal border-l border-[#3FB950]/30 pl-2">
                  {syncState?.pendingChangesCount || 0} pending
                </span>
              </>
            ) : (
              <>
                <Power className="w-3.5 h-3.5 opacity-50" />
                <span>Studio Offline</span>
              </>
            )}
          </div>
          {isConnected && (
            <button onClick={handleDisconnect} className="text-xs text-white/40 hover:text-white transition-colors" title="Disconnect">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <div className="w-16 bg-[#0D1117] border-r border-white/10 flex flex-col items-center py-4 gap-4 shrink-0">
          <button 
            onClick={() => setActiveTab('chats')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'chats' ? 'bg-[#FFC93C] text-[#0B120D]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            title="Chats & AI Workspace"
          >
            <Activity className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'map' ? 'bg-[#FFC93C] text-[#0B120D]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            title="Game Map"
          >
            <Map className="w-5 h-5" />
          </button>
          <div className="flex-1"></div>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-[#FFC93C] text-[#0B120D]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative flex">
          {activeTab === 'chats' && (
            <div className="flex-1 relative">
              <ChatStudio 
                user={user}
                quota={quota}
                project={project}
                onSelectScript={() => {}}
                onUpdateProject={onUpdateProject}
                onOpenFileInEditor={() => {}}
                pendingAgentPrompt={undefined}
                onShowToast={onShowToast}
              />
            </div>
          )}
          {activeTab === 'map' && (
            <div className="flex-1 p-6 overflow-hidden">
               <InteractiveGameMap project={project} />
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="flex-1 p-8 text-sm">
              <h2 className="text-xl font-bold mb-4">Settings</h2>
              <p className="text-white/50 mb-8">Configure your AI Agent and execution environment.</p>
              
              <div className="space-y-6 max-w-lg">
                <div className="bg-[#11161D] border border-white/10 p-5 rounded-xl">
                  <h3 className="font-bold mb-2">Execution Mode</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3">
                      <input type="radio" name="exec_mode" defaultChecked className="accent-[#FFC93C]" />
                      <span>Auto Apply (Recommended when Studio is connected)</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="radio" name="exec_mode" className="accent-[#FFC93C]" />
                      <span>Preview Only</span>
                    </label>
                  </div>
                </div>
                
                <button onClick={onLogout} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-all">
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
