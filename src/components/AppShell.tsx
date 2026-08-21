import React, { useState, useMemo, useCallback } from 'react';
import { User, UserQuota, GeneratedScript, ApiKey } from '../types';
import { RobloxProject } from '../types/project';
import { 
  X, Search, Star, Trash2, Copy, Check, Download, 
  Key, CreditCard, History, Zap, Shield, Sparkles, ExternalLink, 
  Plus, RefreshCw, MessageSquare, Lightbulb, Folder, Code2, AlertTriangle,
  LayoutDashboard, Cpu, Compass, Layers, Activity, Terminal, ArrowRight, CheckCircle2,
  Boxes, Server, Wrench, Clock, FileCode, Gift, Flame
} from 'lucide-react';
import { ChatStudio } from './ChatStudio';
import { InteractiveGameMap } from './InteractiveGameMap';
import { GameIntelligenceSystem } from './GameIntelligenceSystem';
import { ProjectFolderInspector } from './ProjectFolderInspector';
import { LuauCodeViewer } from './LuauCodeViewer';
import { DailyRewardsWorkspace } from './DailyRewardsWorkspace';
import { RobloxStudioWorkspace } from './RobloxStudioWorkspace';
import { formatAndSanitizeLuau } from '../utils/luauFormatter';
import { saveSingleScriptToDisk } from '../utils/projectDisk';
import { safeFetchJson } from '../utils/api';

interface AppShellProps {
  isOpen: boolean;
  user: User | null;
  quota: UserQuota | null;
  project: RobloxProject;
  onClose: () => void;
  onUpdateProject: (updated: RobloxProject) => void;
  onSelectScript: (script: GeneratedScript) => void;
  onUpgradePlan: (planId: 'free' | 'pro' | 'studio') => void;
  onOpenStudioGuide: () => void;
  onShowToast: (msg: string) => void;
  initialWorkspace?: 'ai' | 'development' | 'roblox' | 'history' | 'project';
  initialTab?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  isOpen,
  user,
  quota,
  project,
  onClose,
  onUpdateProject,
  onSelectScript,
  onUpgradePlan,
  onOpenStudioGuide,
  onShowToast,
  initialWorkspace = 'project',
  initialTab = 'overview',
}) => {
  const [activeWorkspace, setActiveWorkspace] = useState<'ai' | 'development' | 'roblox' | 'history' | 'project'>(initialWorkspace);
  const [activeSubTab, setActiveSubTab] = useState<string>(initialTab);

  const [scripts, setScripts] = useState<GeneratedScript[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScript, setSelectedScript] = useState<GeneratedScript | null>(null);
  const [selectedFileForEditor, setSelectedFileForEditor] = useState<string | undefined>(undefined);
  const [pendingAgentPrompt, setPendingAgentPrompt] = useState<string | undefined>(undefined);

  // Standalone Generator State in Dashboard
  const [genPrompt, setGenPrompt] = useState('a shift to sprint system with dynamic stamina bar and regeneration');
  const [isGeneratingInDash, setIsGeneratingInDash] = useState(false);
  const [dashGeneratedScript, setDashGeneratedScript] = useState<GeneratedScript | null>(null);

  // Debugger State in Dashboard
  const [debugError, setDebugError] = useState('');
  const [debugBrokenCode, setDebugBrokenCode] = useState('');
  const [isDebuggingInDash, setIsDebuggingInDash] = useState(false);
  const [debugFixedScript, setDebugFixedScript] = useState<GeneratedScript | null>(null);

  const token = localStorage.getItem('squeeze_token') || '';

  // Fetch scripts and API keys on open
  const fetchDashboardData = useCallback(async () => {
    try {
      const [scriptsRes, keysRes] = await Promise.all([
        safeFetchJson('/api/scripts', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }),
        safeFetchJson('/api/api-keys', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
      ]);

      if (scriptsRes.ok && scriptsRes.data?.scripts) {
        setScripts(scriptsRes.data.scripts);
        if (scriptsRes.data.scripts.length > 0 && !selectedScript) {
          setSelectedScript(scriptsRes.data.scripts[0]);
        }
      }

      if (keysRes.ok && keysRes.data?.keys) {
        setApiKeys(keysRes.data.keys);
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  }, [token, selectedScript]);

  React.useEffect(() => {
    if (isOpen) {
      fetchDashboardData();
    }
  }, [isOpen, fetchDashboardData]);

  if (!isOpen) return null;

  const handleOpenFileInEditor = (fileId: string) => {
    setSelectedFileForEditor(fileId);
    setActiveWorkspace('development');
    setActiveSubTab('files');
  };

  const handleSendPromptToAgent = (prompt: string) => {
    setPendingAgentPrompt(prompt);
    setActiveWorkspace('ai');
    setActiveSubTab('chat');
  };

  // Compute stats for Project Overview
  const totalFiles = project.files.length;
  const serverScripts = project.files.filter(f => f.scriptType === 'Server Script').length;
  const clientScripts = project.files.filter(f => f.scriptType === 'LocalScript').length;
  const moduleScripts = project.files.filter(f => f.scriptType === 'ModuleScript').length;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B120D]/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn">
      
      {/* Modal Container */}
      <div className="w-full max-w-[1400px] h-[95vh] max-h-[940px] bg-[#0D1117] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#FFFDF6]">
        
        {/* Top Persistent Header Bar */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-[#161B22] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFC93C] flex items-center justify-center text-[#0B120D] font-extrabold text-sm shadow-sm">
              🍋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#FFFDF6] font-display">
                  Squeeze Studio Pro
                </h2>
                <span className="text-[10px] font-mono uppercase bg-[#A8E6B0]/15 text-[#A8E6B0] border border-[#A8E6B0]/30 px-2 py-0.5 rounded font-bold">
                  {user?.plan ? `${user.plan.toUpperCase()} PLAN` : 'FREE TIER'}
                </span>
              </div>
              <p className="text-xs text-[#FFFDF6]/60 font-mono">
                Project: <strong className="text-[#FFC93C]">{project.name}</strong> &middot; {totalFiles} scripts &middot; Studio Connected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {quota && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/70">
                <Zap className="w-3.5 h-3.5 text-[#FFC93C]" />
                <span>{quota.isUnlimited ? '∞ Unlimited' : `${quota.remaining} AI credits`}</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unified AppShell Workspace Shell: Persistent Sidebar + Isolated Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Persistent Sidebar Navigation for 5 Workspaces */}
          <div className="w-64 bg-[#11161D] border-r border-white/15 flex flex-col shrink-0 select-none overflow-y-auto">
            <div className="p-4 space-y-6">
              
              {/* 1. PROJECT WORKSPACE */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-bold px-2 block mb-2">
                  Project
                </span>
                <div className="space-y-1">
                  <button
                    onClick={() => { setActiveWorkspace('project'); setActiveSubTab('map'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'project' && activeSubTab === 'map'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Dynamic Game Map</span>
                  </button>
                  <button
                    onClick={() => { setActiveWorkspace('project'); setActiveSubTab('overview'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'project' && activeSubTab === 'overview'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Project Overview</span>
                  </button>
                  <button
                    onClick={() => { setActiveWorkspace('project'); setActiveSubTab('health'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'project' && activeSubTab === 'health'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    <span>Systems &amp; Health</span>
                  </button>
                </div>
              </div>

              {/* 2. AI WORKSPACE */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-bold px-2 block mb-2">
                  AI Intelligence
                </span>
                <div className="space-y-1">
                  <button
                    onClick={() => { setActiveWorkspace('ai'); setActiveSubTab('chat'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'ai' && activeSubTab === 'chat'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>AI Co-Pilot Chat</span>
                  </button>
                  <button
                    onClick={() => { setActiveWorkspace('ai'); setActiveSubTab('intelligence'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'ai' && activeSubTab === 'intelligence'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Lightbulb className="w-4 h-4" />
                    <span>Game Intelligence &amp; Gaps</span>
                  </button>
                </div>
              </div>

              {/* 3. DEVELOPMENT WORKSPACE */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-bold px-2 block mb-2">
                  Development
                </span>
                <div className="space-y-1">
                  <button
                    onClick={() => { setActiveWorkspace('development'); setActiveSubTab('files'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'development' && activeSubTab === 'files'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Folder className="w-4 h-4" />
                    <span>Files &amp; Code Editor</span>
                  </button>
                  <button
                    onClick={() => { setActiveWorkspace('development'); setActiveSubTab('generator'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'development' && activeSubTab === 'generator'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Direct Generator &amp; Debugger</span>
                  </button>
                </div>
              </div>

              {/* 4. ROBLOX WORKSPACE */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-bold px-2 block mb-2">
                  Roblox
                </span>
                <div className="space-y-1">
                  <button
                    onClick={() => { setActiveWorkspace('roblox'); setActiveSubTab('plugin'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'roblox' && activeSubTab === 'plugin'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Terminal className="w-4 h-4" />
                    <span>Studio Connection &amp; API</span>
                  </button>
                  <button
                    onClick={() => { setActiveWorkspace('roblox'); setActiveSubTab('dailyrewards'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'roblox' && activeSubTab === 'dailyrewards'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Gift className="w-4 h-4" />
                    <span className="flex items-center gap-1.5">
                      <span>Daily Rewards</span>
                      <span className="text-[9px] bg-[#FF6B4A] text-white px-1.5 py-0.2 rounded font-bold">7D</span>
                    </span>
                  </button>
                </div>
              </div>

              {/* 5. HISTORY WORKSPACE */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-bold px-2 block mb-2">
                  History
                </span>
                <div className="space-y-1">
                  <button
                    onClick={() => { setActiveWorkspace('history'); setActiveSubTab('scripts'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'history' && activeSubTab === 'scripts'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <History className="w-4 h-4" />
                    <span>Script Generation History</span>
                  </button>
                  <button
                    onClick={() => { setActiveWorkspace('history'); setActiveSubTab('billing'); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      activeWorkspace === 'history' && activeSubTab === 'billing'
                        ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Plan &amp; Quota</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Sidebar Footer Status */}
            <div className="mt-auto p-4 border-t border-white/10 bg-[#0D1117] text-xs font-mono text-white/60">
              <div className="flex items-center justify-between mb-1">
                <span>Roblox Sync</span>
                <span className="w-2 h-2 rounded-full bg-[#7EE787] animate-pulse" />
              </div>
              <span className="text-[10px] text-white/40">CLI Polling Active</span>
            </div>
          </div>

          {/* Main Workspace Area (Isolated re-render on navigation) */}
          <div className="flex-1 overflow-hidden bg-[#090D11] flex flex-col">
            
            {/* Context Bar */}
            <div className="px-5 py-2.5 bg-[#161B22]/60 border-b border-white/10 flex items-center justify-between text-xs font-mono text-white/70 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[#FFC93C] font-bold uppercase tracking-wide">{activeWorkspace} Workspace</span>
                <span>/</span>
                <span className="capitalize text-white/95 font-semibold">
                  {activeSubTab === 'overview' ? 'Home & Project Overview' :
                   activeSubTab === 'health' ? 'Systems & Health' :
                   activeSubTab === 'chat' ? 'AI Co-Pilot Chat' :
                   activeSubTab === 'intelligence' ? 'Game Intelligence & Gaps' :
                   activeSubTab === 'files' ? 'Project Files & Editor' :
                   activeSubTab === 'generator' ? 'Direct Generator & Debugger' :
                   activeSubTab === 'plugin' ? 'Roblox Studio & API Keys' :
                   activeSubTab === 'scripts' ? 'Generation History' : 'Plan & Billing'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/50">
                <span>{totalFiles} Scripts</span>
                <span>&bull;</span>
                <span>{serverScripts} Server &middot; {moduleScripts} Modules</span>
              </div>
            </div>

            {/* Workspace Content Area */}
            <div className="flex-1 overflow-hidden p-4 sm:p-5">
              
              {/* ---------------- PROJECT WORKSPACE ---------------- */}
              {activeWorkspace === 'project' && activeSubTab === 'map' && (
                <div className="h-full w-full">
                  <InteractiveGameMap
                    project={project}
                    onUpdateProject={onUpdateProject}
                    onShowToast={onShowToast}
                    onOpenCodeInEditor={handleOpenFileInEditor}
                    onSendPromptToAgent={handleSendPromptToAgent}
                  />
                </div>
              )}

              {activeWorkspace === 'project' && activeSubTab === 'overview' && (
                <div className="h-full overflow-y-auto space-y-6 pr-2">
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-[#161B22] to-[#1F2937] border border-white/15 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-[#FFC93C]/10 blur-3xl pointer-events-none" />
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-[#FFC93C]/20 text-[#FFC93C] font-mono text-[10px] font-bold border border-[#FFC93C]/30">
                          Roblox Studio Project
                        </span>
                        <span className="text-xs font-mono text-white/50">v2.4 Studio Pro</span>
                      </div>
                      <h1 className="text-2xl font-extrabold text-[#FFFDF6] font-display">
                        {project.name}
                      </h1>
                      <p className="text-sm text-white/70 mt-1 max-w-xl font-body">
                        Centralized Squeeze Studio workspace. All Luau scripts, modules, and game intelligence systems are synced and ready.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setActiveWorkspace('project'); setActiveSubTab('map'); }}
                        className="btn-squeeze px-4 py-2.5 rounded-xl text-xs font-bold font-mono flex items-center gap-2 cursor-pointer"
                      >
                        <Layers className="w-4 h-4" />
                        <span>Interactive Game Map</span>
                      </button>
                      <button
                        onClick={() => { setActiveWorkspace('ai'); setActiveSubTab('chat'); }}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold font-mono text-white flex items-center gap-2 cursor-pointer border border-white/10"
                      >
                        <MessageSquare className="w-4 h-4 text-[#FFC93C]" />
                        <span>Open AI Chat</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-[#161B22] border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-white/50 block">Total Files</span>
                        <span className="text-2xl font-bold font-display text-[#FFFDF6] mt-1 block">{totalFiles}</span>
                        <span className="text-[10px] font-mono text-[#7EE787] mt-1 block">✓ Synced</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#FFC93C]">
                        <Folder className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#161B22] border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-white/50 block">Server Scripts</span>
                        <span className="text-2xl font-bold font-display text-[#FFFDF6] mt-1 block">{serverScripts}</span>
                        <span className="text-[10px] font-mono text-[#79C0FF] mt-1 block">ServerScriptService</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#79C0FF]">
                        <Cpu className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#161B22] border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-white/50 block">ModuleScripts</span>
                        <span className="text-2xl font-bold font-display text-[#FFFDF6] mt-1 block">{moduleScripts}</span>
                        <span className="text-[10px] font-mono text-[#A8E6B0] mt-1 block">ReplicatedStorage</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#A8E6B0]">
                        <Layers className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#161B22] border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-white/50 block">Studio Status</span>
                        <span className="text-sm font-bold font-mono text-[#7EE787] mt-2 block flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#7EE787] animate-ping" />
                          <span>Polling active</span>
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#7EE787]">
                        <Terminal className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeWorkspace === 'project' && activeSubTab === 'health' && (
                <div className="h-full overflow-y-auto space-y-4">
                  <div className="p-5 rounded-xl bg-[#161B22] border border-white/10 space-y-3">
                    <h3 className="font-bold text-sm text-[#FFFDF6] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#7EE787]" />
                      <span>Project Health &amp; Systems Analysis</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                        <span className="text-white/80">DataStore Persistence</span>
                        <span className="text-[#7EE787] font-bold">Configured</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                        <span className="text-white/80">Combat &amp; Hitbox System</span>
                        <span className="text-[#7EE787] font-bold">Active</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                        <span className="text-white/80">Leaderstats Currency</span>
                        <span className="text-[#7EE787] font-bold">Active</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                        <span className="text-white/80">Pet Mechanics Loop</span>
                        <span className="text-[#FFC93C] font-bold">Expandable</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- AI WORKSPACE ---------------- */}
              {activeWorkspace === 'ai' && activeSubTab === 'chat' && (
                <ChatStudio
                  project={project}
                  onUpdateProject={onUpdateProject}
                  onShowToast={onShowToast}
                  onOpenCodeInEditor={handleOpenFileInEditor}
                  initialPrompt={pendingAgentPrompt}
                />
              )}

              {activeWorkspace === 'ai' && activeSubTab === 'intelligence' && (
                <GameIntelligenceSystem
                  project={project}
                  onUpdateProject={onUpdateProject}
                  onShowToast={onShowToast}
                  onOpenCodeInEditor={handleOpenFileInEditor}
                />
              )}

              {/* ---------------- DEVELOPMENT WORKSPACE ---------------- */}
              {activeWorkspace === 'development' && activeSubTab === 'files' && (
                <ProjectFolderInspector
                  project={project}
                  onUpdateProject={onUpdateProject}
                  onShowToast={onShowToast}
                  selectedFileId={selectedFileForEditor}
                />
              )}

              {activeWorkspace === 'development' && activeSubTab === 'generator' && (
                <div className="h-full overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-[#161B22] p-5 rounded-xl border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#FFC93C]">
                      <Sparkles className="w-4 h-4" />
                      <span>Instant Luau Script Generator</span>
                    </div>
                    <p className="text-xs text-white/60 font-mono">
                      Describe what mechanic you need. Squeeze generates complete, typed Luau scripts.
                    </p>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!genPrompt.trim() || isGeneratingInDash) return;
                      setIsGeneratingInDash(true);
                      try {
                        const projectSummary = project.files.map(f => `${f.path}:\n${f.code.slice(0, 400)}`).join('\n\n');
                        const res = await safeFetchJson('/api/generate', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                          },
                          body: JSON.stringify({ prompt: genPrompt.trim(), contextHierarchy: projectSummary })
                        });
                        if (res.ok && res.data?.script) {
                          setDashGeneratedScript(res.data.script);
                          setScripts(prev => [res.data.script, ...prev]);
                          onShowToast(`✓ Generated "${res.data.script.title}"!`);
                        }
                      } catch (err: any) {
                        onShowToast(`❌ ${err.message || 'Generation failed'}`);
                      } finally {
                        setIsGeneratingInDash(false);
                      }
                    }} className="flex flex-col gap-2">
                      <textarea
                        value={genPrompt}
                        onChange={(e) => setGenPrompt(e.target.value)}
                        rows={3}
                        className="w-full bg-[#0D1117] border border-white/15 rounded-xl p-3 text-xs text-[#FFFDF6]"
                      />
                      <button
                        type="submit"
                        disabled={isGeneratingInDash || !genPrompt.trim()}
                        className="btn-squeeze py-2.5 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isGeneratingInDash ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Generate Luau Script</span>
                      </button>
                    </form>

                    {dashGeneratedScript && (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-mono text-[#A8E6B0]">
                          <span className="font-bold">{dashGeneratedScript.title}</span>
                          <span>{dashGeneratedScript.targetInstance}</span>
                        </div>
                        <LuauCodeViewer
                          code={dashGeneratedScript.code}
                          filename={`${dashGeneratedScript.title.replace(/\s+/g, '')}.server.luau`}
                          theme="dark"
                          maxHeight="220px"
                          onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to disk!`)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-[#161B22] p-5 rounded-xl border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#FF7B72]">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Roblox Output Error Fixer</span>
                    </div>
                    <p className="text-xs text-white/60 font-mono">
                      Paste the red error trace from Roblox Studio Output window. Squeeze repairs it.
                    </p>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!debugError.trim() || isDebuggingInDash) return;
                      setIsDebuggingInDash(true);
                      try {
                        const res = await safeFetchJson('/api/debug', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                          },
                          body: JSON.stringify({ errorMessage: debugError.trim(), brokenCode: debugBrokenCode.trim() || undefined })
                        });
                        if (res.ok && res.data?.script) {
                          setDebugFixedScript(res.data.script);
                          setScripts(prev => [res.data.script, ...prev]);
                          onShowToast('✓ Analyzed and resolved Roblox runtime error!');
                        }
                      } catch (err: any) {
                        onShowToast(`❌ ${err.message || 'Debugging failed'}`);
                      } finally {
                        setIsDebuggingInDash(false);
                      }
                    }} className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={debugError}
                        onChange={(e) => setDebugError(e.target.value)}
                        placeholder="e.g. ServerScriptService.CoinHandler:14: attempt to index nil"
                        className="w-full bg-[#0D1117] border border-white/15 rounded-xl p-3 text-xs text-[#FFFDF6]"
                      />
                      <button
                        type="submit"
                        disabled={isDebuggingInDash || !debugError.trim()}
                        className="bg-[#FF7B72] text-[#0B120D] hover:bg-[#ff948d] py-2.5 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isDebuggingInDash ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        <span>Fix &amp; Repair Script</span>
                      </button>
                    </form>

                    {debugFixedScript && (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-mono text-[#7EE787]">
                          <span className="font-bold">{debugFixedScript.title}</span>
                          <span>Fixed</span>
                        </div>
                        <LuauCodeViewer
                          code={debugFixedScript.code}
                          filename="FixedScript.server.luau"
                          theme="dark"
                          maxHeight="220px"
                          onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to disk!`)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---------------- ROBLOX WORKSPACE ---------------- */}
              {activeWorkspace === 'roblox' && activeSubTab === 'plugin' && (
                <RobloxStudioWorkspace
                  project={project}
                  onUpdateProject={onUpdateProject}
                  onShowToast={onShowToast}
                  onOpenCodeInEditor={handleOpenFileInEditor}
                />
              )}

              {activeWorkspace === 'roblox' && activeSubTab === 'dailyrewards' && (
                <DailyRewardsWorkspace 
                  onShowToast={onShowToast}
                  onInsertToProject={(fname, code) => {
                    saveSingleScriptToDisk(fname, code);
                    onShowToast(`Saved ${fname} to project!`);
                  }}
                />
              )}

              {/* ---------------- HISTORY WORKSPACE ---------------- */}
              {activeWorkspace === 'history' && activeSubTab === 'scripts' && (
                <div className="h-full grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 overflow-hidden">
                  <div className="bg-[#161B22] border border-white/10 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-white/10">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search history…"
                        className="w-full bg-[#0D1117] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-[#FFFDF6]"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {scripts
                        .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(script => (
                          <div
                            key={script.id}
                            onClick={() => setSelectedScript(script)}
                            className={`p-2.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                              selectedScript?.id === script.id ? 'bg-white/15 text-[#FFC93C] font-bold' : 'text-white/80 hover:bg-white/5'
                            }`}
                          >
                            <span className="block truncate font-semibold">{script.title}</span>
                            <span className="text-[10px] text-white/40">{script.targetInstance}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-[#161B22] border border-white/10 rounded-xl p-4 flex flex-col overflow-hidden">
                    {selectedScript ? (
                      <div className="flex flex-col h-full overflow-hidden">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                          <h3 className="font-bold text-sm text-[#FFFDF6]">{selectedScript.title}</h3>
                          <button
                            onClick={() => {
                              const cleanCode = formatAndSanitizeLuau(selectedScript.code);
                              saveSingleScriptToDisk(`${selectedScript.title.replace(/\s+/g, '')}.server.luau`, cleanCode);
                              onShowToast('Saved script to disk!');
                            }}
                            className="btn-squeeze px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Save to Disk</span>
                          </button>
                        </div>
                        <div className="flex-1 overflow-hidden mt-3">
                          <LuauCodeViewer
                            code={selectedScript.code}
                            filename={`${selectedScript.title}.server.luau`}
                            theme="dark"
                            maxHeight="440px"
                            onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to disk!`)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-white/40 text-xs font-mono">
                        Select a script from history
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeWorkspace === 'history' && activeSubTab === 'billing' && (
                <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto space-y-6">
                  <div className="bg-[#161B22] p-6 rounded-xl border border-white/10 space-y-4">
                    <h3 className="font-bold text-sm text-[#FFFDF6] flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#FFC93C]" />
                      <span>Subscription Plan &amp; Quota</span>
                    </h3>
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-white/50 block">Current Plan</span>
                        <span className="text-lg font-bold font-display text-[#FFC93C] uppercase">{user?.plan || 'Free'} Plan</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono text-white/50 block">Generations</span>
                        <span className="text-sm font-bold font-mono text-[#7EE787]">
                          {quota?.isUnlimited ? 'Unlimited' : `${quota?.remaining || 0} remaining`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
