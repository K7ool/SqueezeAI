import React, { useState, useEffect } from 'react';
import { User, UserQuota, GeneratedScript, ApiKey } from '../types';
import { RobloxProject, ProjectFile } from '../types/project';
import { 
  X, Search, Star, Trash2, Copy, Check, Download, 
  Key, CreditCard, History, Zap, Shield, Sparkles, ExternalLink, 
  Plus, RefreshCw, MessageSquare, Lightbulb, Folder, Code2, AlertTriangle
} from 'lucide-react';
import { ChatStudio } from './ChatStudio';
import { IdeaFlowMap } from './IdeaFlowMap';
import { ProjectFolderInspector } from './ProjectFolderInspector';
import { LuauCodeViewer } from './LuauCodeViewer';
import { formatAndSanitizeLuau } from '../utils/luauFormatter';
import { saveSingleScriptToDisk } from '../utils/projectDisk';
import { safeFetchJson } from '../utils/api';

interface DashboardModalProps {
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
  initialTab?: 'chat' | 'ideas' | 'files' | 'generator' | 'history' | 'billing' | 'apikeys';
}

export const DashboardModal: React.FC<DashboardModalProps> = ({
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
  initialTab = 'chat',
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'ideas' | 'files' | 'generator' | 'history' | 'billing' | 'apikeys'>(initialTab);
  const [scripts, setScripts] = useState<GeneratedScript[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<GeneratedScript | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedFileForEditor, setSelectedFileForEditor] = useState<string | undefined>(undefined);

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

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Fetch scripts and API keys
  const fetchDashboardData = async () => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDashboardData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleFavorite = async (scriptId: string) => {
    try {
      const res = await safeFetchJson(`/api/scripts/${scriptId}/favorite`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, isFavorite: !s.isFavorite } : s));
        if (selectedScript?.id === scriptId) {
          setSelectedScript(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm('Are you sure you want to delete this script from your history?')) return;
    try {
      const res = await safeFetchJson(`/api/scripts/${scriptId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setScripts(prev => prev.filter(s => s.id !== scriptId));
        if (selectedScript?.id === scriptId) {
          setSelectedScript(null);
        }
        onShowToast('Script deleted from history.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const res = await safeFetchJson('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (res.ok && res.data?.key) {
        setApiKeys(prev => [res.data.key, ...prev]);
        setNewKeyName('');
        onShowToast('API Key generated successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    onShowToast('API Key copied to clipboard!');
  };

  const handleDashboardGenerate = async (e: React.FormEvent) => {
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
        body: JSON.stringify({
          prompt: genPrompt.trim(),
          contextHierarchy: projectSummary
        })
      });

      if (!res.ok || !res.data?.script) {
        throw new Error(res.error || 'Failed to generate script.');
      }

      setDashGeneratedScript(res.data.script);
      setScripts(prev => [res.data.script, ...prev]);
      onShowToast(`✓ Generated "${res.data.script.title}"!`);
    } catch (err: any) {
      onShowToast(`❌ ${err.message || 'Generation failed'}`);
    } finally {
      setIsGeneratingInDash(false);
    }
  };

  const handleDashboardDebug = async (e: React.FormEvent) => {
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
        body: JSON.stringify({
          errorMessage: debugError.trim(),
          brokenCode: debugBrokenCode.trim() || undefined
        })
      });

      if (!res.ok || !res.data?.script) {
        throw new Error(res.error || 'Failed to debug error.');
      }

      setDebugFixedScript(res.data.script);
      setScripts(prev => [res.data.script, ...prev]);
      onShowToast('✓ Analyzed and resolved Roblox runtime error!');
    } catch (err: any) {
      onShowToast(`❌ ${err.message || 'Debugging failed'}`);
    } finally {
      setIsDebuggingInDash(false);
    }
  };

  const handleOpenFileInEditor = (fileId: string) => {
    setSelectedFileForEditor(fileId);
    setActiveTab('files');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B120D]/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn">
      
      {/* Modal Container */}
      <div className="w-full max-w-[1240px] h-[92vh] max-h-[900px] bg-[#0D1117] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#FFFDF6]">
        
        {/* Modal Top Header Bar */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#161B22] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFC93C] flex items-center justify-center text-[#0B120D] font-extrabold text-sm shadow-sm">
              🍋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#FFFDF6] font-display">
                  Squeeze Studio Dashboard
                </h2>
                <span className="text-[10px] font-mono uppercase bg-[#A8E6B0]/15 text-[#A8E6B0] border border-[#A8E6B0]/30 px-2 py-0.5 rounded font-bold">
                  {user?.plan ? `${user.plan.toUpperCase()} PLAN` : 'FREE TIER'}
                </span>
              </div>
              <p className="text-xs text-[#FFFDF6]/60 font-mono">
                Roblox AI Co-Pilot &middot; Active Project: <strong className="text-[#FFC93C]">{project.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {quota && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/70">
                <Zap className="w-3.5 h-3.5 text-[#FFC93C]" />
                <span>{quota.isUnlimited ? '∞ Unlimited' : `${quota.remaining} left`}</span>
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

        {/* Tab Navigation Strip */}
        <div className="px-4 border-b border-white/10 bg-[#161B22]/70 flex items-center gap-1 overflow-x-auto select-none shrink-0">
          {[
            { id: 'chat', label: '💬 AI Co-Pilot Chat', icon: MessageSquare },
            { id: 'ideas', label: '🗺️ Idea Flow Map', icon: Lightbulb },
            { id: 'files', label: '📂 Project Files & Editor', icon: Folder },
            { id: 'generator', label: '⚡ Direct Generator & Debugger', icon: Sparkles },
            { id: 'history', label: '📜 Script History', icon: History },
            { id: 'apikeys', label: '🔑 Plugin & API Keys', icon: Key },
            { id: 'billing', label: '💳 Plan & Quota', icon: CreditCard },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3.5 text-xs font-mono font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-[#FFC93C] text-[#FFC93C] bg-white/5'
                    : 'border-transparent text-white/60 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body View */}
        <div className="flex-1 overflow-hidden p-3 sm:p-4 bg-[#090D11]">
          
          {/* TAB 1: AI Chat & Co-Pilot (With Chat History & Project Reading) */}
          {activeTab === 'chat' && (
            <ChatStudio
              project={project}
              onUpdateProject={onUpdateProject}
              onShowToast={onShowToast}
              onOpenCodeInEditor={handleOpenFileInEditor}
            />
          )}

          {/* TAB 2: Interactive Idea Flow Map */}
          {activeTab === 'ideas' && (
            <IdeaFlowMap
              project={project}
              onUpdateProject={onUpdateProject}
              onShowToast={onShowToast}
              onOpenCodeInEditor={handleOpenFileInEditor}
            />
          )}

          {/* TAB 3: Project Files & In-Place Code Editor */}
          {activeTab === 'files' && (
            <ProjectFolderInspector
              project={project}
              onUpdateProject={onUpdateProject}
              onShowToast={onShowToast}
              selectedFileId={selectedFileForEditor}
            />
          )}

          {/* TAB 4: Direct Script Generator & Debugger */}
          {activeTab === 'generator' && (
            <div className="h-full overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-4 p-2">
              
              {/* Left Column: Direct Generator */}
              <div className="bg-[#161B22] p-4 sm:p-5 rounded-xl border border-white/10 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#FFC93C]">
                  <Sparkles className="w-4 h-4" />
                  <span>Instant Luau Script Generator</span>
                </div>
                <p className="text-xs text-white/60 font-mono">
                  Describe what mechanic you need. Squeeze generates complete, typed Luau scripts.
                </p>

                <form onSubmit={handleDashboardGenerate} className="flex flex-col gap-2">
                  <textarea
                    value={genPrompt}
                    onChange={(e) => setGenPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleDashboardGenerate(e as any);
                      }
                    }}
                    rows={3}
                    placeholder="e.g. dynamic shift to sprint with stamina and regeneration"
                    className="w-full bg-[#0D1117] border border-white/15 rounded-xl p-3 text-xs text-[#FFFDF6] placeholder:text-white/30 focus:outline-none focus:border-[#FFC93C]"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-white/40 px-1">
                    <span>Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/70">Ctrl + Enter</kbd> to generate</span>
                  </div>
                  <button
                    type="submit"
                    disabled={isGeneratingInDash || !genPrompt.trim()}
                    className="btn-squeeze py-2.5 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingInDash ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Engineering Script…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Luau Script</span>
                      </>
                    )}
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

              {/* Right Column: Luau Error Debugger */}
              <div className="bg-[#161B22] p-4 sm:p-5 rounded-xl border border-white/10 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#FF7B72]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Roblox Output Error Fixer</span>
                </div>
                <p className="text-xs text-white/60 font-mono">
                  Paste the red error trace from Roblox Studio Output window. Squeeze repairs it.
                </p>

                <form onSubmit={handleDashboardDebug} className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={debugError}
                    onChange={(e) => setDebugError(e.target.value)}
                    placeholder="e.g. ServerScriptService.CoinHandler:14: attempt to index nil with 'leaderstats'"
                    className="w-full bg-[#0D1117] border border-white/15 rounded-xl p-3 text-xs text-[#FFFDF6] placeholder:text-white/30 focus:outline-none focus:border-[#FF7B72]"
                  />
                  <textarea
                    value={debugBrokenCode}
                    onChange={(e) => setDebugBrokenCode(e.target.value)}
                    rows={2}
                    placeholder="Optional: Paste the broken script snippet here..."
                    className="w-full bg-[#0D1117] border border-white/15 rounded-xl p-3 text-xs text-[#FFFDF6] placeholder:text-white/30 focus:outline-none focus:border-[#FF7B72]"
                  />
                  <button
                    type="submit"
                    disabled={isDebuggingInDash || !debugError.trim()}
                    className="bg-[#FF7B72] text-[#0B120D] hover:bg-[#ff948d] py-2.5 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {isDebuggingInDash ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing Error Root Cause…</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Fix &amp; Repair Script</span>
                      </>
                    )}
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

          {/* TAB 5: Script History */}
          {activeTab === 'history' && (
            <div className="h-full grid grid-cols-1 md:grid-cols-[300px_1fr] gap-3 overflow-hidden">
              
              {/* Scripts List */}
              <div className="bg-[#161B22] border border-white/10 rounded-xl flex flex-col overflow-hidden">
                <div className="p-3 border-b border-white/10">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search history…"
                      className="w-full bg-[#0D1117] border border-white/15 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#FFFDF6] placeholder:text-white/35 focus:outline-none focus:border-[#FFC93C]"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {scripts
                    .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.prompt.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(script => {
                      const isSelected = selectedScript?.id === script.id;
                      return (
                        <div
                          key={script.id}
                          onClick={() => setSelectedScript(script)}
                          className={`group p-2.5 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-white/15 text-[#FFC93C] font-bold border border-white/10'
                              : 'text-[#FFFDF6]/80 hover:bg-white/5 hover:text-[#FFFDF6]'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="truncate block font-semibold">{script.title}</span>
                            <span className="text-[10px] text-white/40 block truncate">{script.targetInstance}</span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(script.id);
                              }}
                              className={`p-1 hover:text-[#FFC93C] cursor-pointer ${script.isFavorite ? 'text-[#FFC93C]' : 'text-white/40'}`}
                            >
                              <Star className="w-3 h-3 fill-current" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteScript(script.id);
                              }}
                              className="p-1 hover:text-[#FF7B72] cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Script Inspector */}
              <div className="bg-[#161B22] border border-white/10 rounded-xl p-4 flex flex-col overflow-hidden">
                {selectedScript ? (
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div>
                        <h3 className="font-bold text-sm text-[#FFFDF6]">{selectedScript.title}</h3>
                        <p className="text-xs text-white/50 font-mono mt-0.5">Prompt: “{selectedScript.prompt}”</p>
                      </div>

                      <button
                        onClick={() => {
                          const cleanCode = formatAndSanitizeLuau(selectedScript.code);
                          saveSingleScriptToDisk(`${selectedScript.title.replace(/\s+/g, '')}.server.luau`, cleanCode);
                          onShowToast(`Saved ${selectedScript.title} to disk!`);
                        }}
                        className="btn-squeeze px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Save to Disk</span>
                      </button>
                    </div>

                    <div className="flex-1 overflow-hidden mt-3 flex flex-col">
                      <LuauCodeViewer
                        code={selectedScript.code}
                        filename={`${selectedScript.title.replace(/\s+/g, '')}.server.luau`}
                        theme="dark"
                        maxHeight="440px"
                        onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to disk!`)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/40 text-xs font-mono">
                    Select a script from your history
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: API Keys & Roblox Studio Plugin Connector */}
          {activeTab === 'apikeys' && (
            <div className="h-full overflow-y-auto p-4 flex flex-col gap-6 max-w-3xl mx-auto">
              
              <div className="bg-[#161B22] p-5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#FFC93C]">
                    <Key className="w-4 h-4" />
                    <span>Roblox Studio Companion API Token</span>
                  </div>
                </div>
                <p className="text-xs text-white/70 leading-relaxed font-body">
                  Use your secret API token inside the Roblox Studio Companion Plugin to sync generated scripts and remote events directly into your game Explorer.
                </p>

                <form onSubmit={handleCreateApiKey} className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. My Studio Plugin Token"
                    className="flex-1 bg-[#0D1117] border border-white/15 rounded-xl px-3 py-2 text-xs text-[#FFFDF6] placeholder:text-white/35 focus:outline-none focus:border-[#FFC93C]"
                  />
                  <button
                    type="submit"
                    className="btn-squeeze px-4 py-2 rounded-xl text-xs font-bold font-mono cursor-pointer"
                  >
                    Generate Token
                  </button>
                </form>

                <div className="mt-4 space-y-2">
                  {apiKeys.map(k => (
                    <div key={k.id} className="p-3 bg-[#0D1117] rounded-lg border border-white/10 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="font-bold text-[#FFFDF6] block">{k.name}</span>
                        <span className="text-white/40 text-[11px]">{k.key.slice(0, 12)}••••••••••••</span>
                      </div>
                      <button
                        onClick={() => handleCopyKey(k.key)}
                        className="px-2.5 py-1 rounded bg-white/10 hover:bg-[#FFC93C] hover:text-[#0B120D] text-xs font-bold transition-all cursor-pointer"
                      >
                        {copiedKey === k.key ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plugin Installation Guide */}
              <div className="bg-[#161B22] p-5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-[#A8E6B0]">Direct Studio Injection Script</h4>
                  <button
                    onClick={onOpenStudioGuide}
                    className="text-xs text-[#FFC93C] hover:underline flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <span>Full Plugin Guide</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-white/70 mb-3 font-body">
                  Paste this snippet inside a ModuleScript in <strong>ServerScriptService</strong> to automatically poll and sync scripts:
                </p>

                <div className="bg-[#090D11] p-3 rounded-lg border border-white/10 font-mono text-[11px] text-[#A5D6FF] overflow-x-auto">
                  <code>{`-- Squeeze Live Studio Sync Hook
local HttpService = game:GetService("HttpService")
local SQUEEZE_TOKEN = "${apiKeys[0]?.key || 'sqz_live_your_token_here'}"

print("🍋 [Squeeze Studio] Live sync hook active!")`}</code>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: Billing & Plans */}
          {activeTab === 'billing' && (
            <div className="h-full overflow-y-auto p-4 max-w-3xl mx-auto flex flex-col gap-6">
              <div className="bg-[#161B22] p-5 rounded-xl border border-white/10">
                <h3 className="text-base font-bold text-[#FFFDF6] mb-1">Your Squeeze Subscription</h3>
                <p className="text-xs text-white/60 font-mono mb-4">
                  Current plan: <strong className="text-[#FFC93C] uppercase">{user?.plan || 'Free'}</strong> &middot; Status: {user?.planStatus || 'Active'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'free', name: 'Sip (Free)', limit: '25 scripts/mo', price: '$0' },
                    { id: 'pro', name: 'Pitcher (Pro)', limit: 'Unlimited scripts', price: '$12/mo' },
                    { id: 'studio', name: 'Juice Bar (Studio)', limit: 'Unlimited + Team Sync', price: '$29/mo' },
                  ].map(p => (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between ${
                        user?.plan === p.id 
                          ? 'border-[#FFC93C] bg-[#FFC93C]/10 ring-1 ring-[#FFC93C]' 
                          : 'border-white/15 bg-white/5'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-sm block">{p.name}</span>
                        <span className="text-lg font-bold text-[#FFC93C] block my-1">{p.price}</span>
                        <span className="text-[11px] text-white/60 font-mono block">{p.limit}</span>
                      </div>

                      <button
                        onClick={() => onUpgradePlan(p.id as any)}
                        disabled={user?.plan === p.id}
                        className={`mt-4 w-full py-2 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                          user?.plan === p.id
                            ? 'bg-white/20 text-white/50 cursor-default'
                            : 'btn-squeeze text-[#0B120D]'
                        }`}
                      >
                        {user?.plan === p.id ? 'Current Plan' : 'Select Plan'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
