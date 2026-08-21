import React, { useState, useEffect } from 'react';
import { User, UserQuota } from '../types';
import { RobloxProject } from '../types/project';
import { 
  Settings, Map, Folder, Activity, Power, X, RefreshCw, LogIn, LogOut, CheckCircle2
} from 'lucide-react';
import { ChatStudio } from './ChatStudio';
import { ProjectFolderInspector } from './ProjectFolderInspector';
import { InteractiveGameMap } from './InteractiveGameMap';
import { fetchStudioSyncStatus, disconnectStudioSession, syncAllToStudio, ProjectSyncState } from '../utils/syncClient';

interface SqueezeIDEProps {
  user: User | null;
  quota: UserQuota | null;
  project: RobloxProject;
  onLogout: () => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
}

export const SqueezeIDE: React.FC<SqueezeIDEProps> = ({ 
  user, 
  quota, 
  project, 
  onLogout, 
  onOpenAuth,
  onUpdateProject, 
  onShowToast 
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'project' | 'map' | 'settings'>('chats');
  const [syncState, setSyncState] = useState<ProjectSyncState | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [showStatusPopover, setShowStatusPopover] = useState(false);

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

  const handleSyncAll = async () => {
    onShowToast('⏳ Syncing all to Studio...');
    const res = await syncAllToStudio(project.id);
    if (res.success) {
      onShowToast('✓ Sync triggered successfully');
      const state = await fetchStudioSyncStatus(project.id);
      if (state) setSyncState(state);
    } else {
      onShowToast(`❌ Sync error: ${res.error || 'Failed'}`);
    }
  };

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
    <div className="w-full h-screen bg-[#0B120D] text-white flex flex-col font-mono overflow-hidden select-none">
      {/* Top IDE Header Bar */}
      <div className="h-12 bg-[#11161D] border-b border-white/10 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-[#FFC93C] flex items-center justify-center text-[#0B120D] font-bold text-xs shadow-sm">🍋</div>
          <h1 className="text-sm font-bold tracking-wider text-white">SQUEEZE <span className="text-[#FFC93C] font-normal text-xs">IDE</span></h1>
          <div className="w-px h-4 bg-white/20 mx-2"></div>
          <span className="text-xs text-white/70 font-semibold truncate max-w-[180px]">{project.name}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Studio Connection Status Widget */}
          <div className="relative">
            <button 
              onClick={() => setShowStatusPopover(!showStatusPopover)}
              className={`flex items-center gap-2 px-3 py-1 rounded border text-xs font-bold transition-all cursor-pointer ${
                isConnected 
                  ? 'bg-[#182618] border-[#3FB950]/40 text-[#3FB950] hover:border-[#3FB950]' 
                  : 'bg-[#161B22] border-white/15 text-white/50 hover:text-white'
              }`}
            >
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3FB950] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3FB950]"></span>
                  </span>
                  <span>Studio Connected</span>
                  <span className="text-[10px] opacity-70 ml-1 font-normal border-l border-[#3FB950]/30 pl-2">
                    {syncState?.pendingChangesCount || 0} pending
                  </span>
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5 opacity-50" />
                  <span>Studio Offline</span>
                </>
              )}
            </button>

            {/* Studio Status Popover */}
            {showStatusPopover && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-[#0D1117] border border-white/15 rounded-xl shadow-2xl p-4 z-50 animate-fadeIn font-mono text-xs text-white">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                  <span className="font-bold flex items-center gap-2">
                    {isConnected ? <CheckCircle2 className="w-4 h-4 text-[#3FB950]" /> : <Power className="w-4 h-4 text-white/40" />}
                    <span>{isConnected ? 'Studio Online' : 'Studio Offline'}</span>
                  </span>
                  <button onClick={() => setShowStatusPopover(false)} className="text-white/40 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 mb-4 text-[11px] text-white/70">
                  <div className="flex justify-between">
                    <span className="text-white/40">Project:</span>
                    <span className="font-bold text-white truncate max-w-[120px]">{project.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Plugin:</span>
                    <span>v5.0.0 WebSync</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Pending Queue:</span>
                    <span className="text-[#FFC93C] font-bold">{syncState?.pendingChangesCount || 0} changes</span>
                  </div>
                </div>

                <button 
                  onClick={handleSyncAll}
                  className="w-full py-1.5 mb-2 bg-[#FFC93C]/10 text-[#FFC93C] border border-[#FFC93C]/30 rounded-lg text-xs font-bold hover:bg-[#FFC93C]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync All to Studio</span>
                </button>

                {isConnected && (
                  <button 
                    onClick={handleDisconnect}
                    className="w-full py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Disconnect Studio</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* User Auth Info or Sign In Button */}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right text-xs hidden sm:block">
                <span className="text-white/90 font-bold block leading-none">{user.name}</span>
                <span className="text-[10px] text-[#FFC93C] uppercase tracking-wider font-semibold">Pro Creator</span>
              </div>
              <button 
                onClick={onLogout}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenAuth('login')}
              className="px-3 py-1.5 bg-[#FFC93C] text-[#0B120D] font-bold rounded-lg text-xs flex items-center gap-1.5 hover:bg-[#ffe082] transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Main IDE Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Icon Navigation Sidebar */}
        <div className="w-16 bg-[#0D1117] border-r border-white/10 flex flex-col items-center py-4 gap-4 shrink-0">
          <button 
            onClick={() => setActiveTab('chats')}
            className={`p-3 rounded-xl transition-all cursor-pointer ${activeTab === 'chats' ? 'bg-[#FFC93C] text-[#0B120D]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            title="AI Workspace Chat"
          >
            <Activity className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('project')}
            className={`p-3 rounded-xl transition-all cursor-pointer ${activeTab === 'project' ? 'bg-[#FFC93C] text-[#0B120D]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            title="Project Files & Explorer"
          >
            <Folder className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`p-3 rounded-xl transition-all cursor-pointer ${activeTab === 'map' ? 'bg-[#FFC93C] text-[#0B120D]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            title="Game Systems Map"
          >
            <Map className="w-5 h-5" />
          </button>
          <div className="flex-1"></div>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-3 rounded-xl transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-[#FFC93C] text-[#0B120D]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Content View */}
        <div className="flex-1 relative flex overflow-hidden">
          {activeTab === 'chats' && (
            <div className="flex-1 relative">
              <ChatStudio 
                user={user}
                quota={quota}
                project={project}
                onSelectScript={() => {}}
                onUpdateProject={onUpdateProject}
                onOpenFileInEditor={() => setActiveTab('project')}
                pendingAgentPrompt={undefined}
                onShowToast={onShowToast}
              />
            </div>
          )}

          {activeTab === 'project' && (
            <div className="flex-1 p-3 overflow-hidden">
              <ProjectFolderInspector 
                project={project}
                onUpdateProject={onUpdateProject}
                onShowToast={onShowToast}
              />
            </div>
          )}

          {activeTab === 'map' && (
            <div className="flex-1 p-4 overflow-hidden">
               <InteractiveGameMap 
                 project={project} 
                 onUpdateProject={onUpdateProject}
                 onShowToast={onShowToast}
                 onOpenCodeInEditor={() => setActiveTab('project')}
                 onSendPromptToAgent={() => setActiveTab('chats')}
               />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 p-8 text-sm max-w-xl overflow-y-auto">
              <h2 className="text-xl font-bold mb-2 text-white">IDE Settings</h2>
              <p className="text-white/50 mb-6">Configure execution mode and environment parameters.</p>
              
              <div className="space-y-6">
                <div className="bg-[#11161D] border border-white/10 p-5 rounded-xl space-y-3">
                  <h3 className="font-bold text-white">Execution Mode</h3>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="exec_mode" defaultChecked className="accent-[#FFC93C]" />
                      <span>Auto Apply (Recommended when WebSync Plugin is active)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer text-white/60">
                      <input type="radio" name="exec_mode" className="accent-[#FFC93C]" />
                      <span>Preview Only</span>
                    </label>
                  </div>
                </div>

                <div className="bg-[#11161D] border border-white/10 p-5 rounded-xl space-y-3">
                  <h3 className="font-bold text-white">WebSync Connection</h3>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Connect your Roblox Studio DataModel directly using the Squeeze Studio Companion plugin.
                  </p>
                  <div className="text-xs font-mono bg-[#0D1117] p-3 rounded-lg text-[#FFC93C] border border-white/10">
                    Endpoint: /api/studio
                  </div>
                </div>

                {user && (
                  <button 
                    onClick={onLogout} 
                    className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all font-mono text-xs cursor-pointer"
                  >
                    Sign Out Account
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
