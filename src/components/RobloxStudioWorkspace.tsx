import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Download, 
  Layers, 
  FileCode, 
  ArrowRightLeft, 
  ShieldCheck, 
  Activity, 
  Check, 
  ExternalLink,
  ChevronRight,
  Split,
  Eye,
  X
} from 'lucide-react';
import { RobloxProject, ProjectFile } from '../types/project';
import { 
  createStudioPairingSession, 
  fetchStudioSyncStatus, 
  syncFileToStudio, 
  resolveStudioConflict, 
  getStudioPluginSource,
  ProjectSyncState,
  SyncConflict 
} from '../utils/syncClient';
import { LuauCodeViewer } from './LuauCodeViewer';

interface RobloxStudioWorkspaceProps {
  project: RobloxProject;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
  onOpenCodeInEditor: (fileId: string) => void;
}

export const RobloxStudioWorkspace: React.FC<RobloxStudioWorkspaceProps> = ({
  project,
  onUpdateProject,
  onShowToast,
  onOpenCodeInEditor
}) => {
  const [syncState, setSyncState] = useState<ProjectSyncState | null>(null);
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isGeneratingPair, setIsGeneratingPair] = useState(false);
  const [pluginSource, setPluginSource] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'status' | 'conflicts' | 'activity' | 'pluginSource'>('status');
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);
  const [mergedDraft, setMergedDraft] = useState<string>('');
  const [isResolving, setIsResolving] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Poll sync status every 3 seconds
  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      const state = await fetchStudioSyncStatus(project.id);
      if (isMounted && state) {
        setSyncState(state);
        if (state.session?.pairingCode) {
          setPairingCode(state.session.pairingCode);
        }
        if (state.conflicts?.length > 0 && !selectedConflict) {
          setSelectedConflict(state.conflicts[0]);
          setMergedDraft(state.conflicts[0].websiteSource);
        }
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    getStudioPluginSource().then(src => {
      if (isMounted && src) setPluginSource(src);
    });

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [project.id]);

  const handleGeneratePairingCode = async () => {
    setIsGeneratingPair(true);
    try {
      const res = await createStudioPairingSession(project.id, project.name);
      if (res.success && res.pairingCode) {
        setPairingCode(res.pairingCode);
        onShowToast(`✓ New Pairing Code Generated: ${res.pairingCode}`);
        const state = await fetchStudioSyncStatus(project.id);
        if (state) setSyncState(state);
      } else {
        onShowToast(`❌ ${res.error || 'Failed to generate code'}`);
      }
    } catch (err: any) {
      onShowToast(`❌ ${err.message || 'Error creating session'}`);
    } finally {
      setIsGeneratingPair(false);
    }
  };

  const handlePushAllFilesToStudio = async () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);
    let count = 0;
    try {
      for (const f of project.files) {
        await syncFileToStudio(project.id, {
          path: f.path,
          name: f.name,
          source: f.code
        }, 'website');
        count++;
      }
      onShowToast(`✓ Synced ${count} scripts to Roblox Studio queue!`);
      const state = await fetchStudioSyncStatus(project.id);
      if (state) setSyncState(state);
    } catch (err: any) {
      onShowToast(`❌ Error syncing files: ${err.message}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleDisconnect = async () => {
    if (!syncState?.session?.token) {
      onShowToast('❌ No active session token found to disconnect');
      return;
    }
    const { disconnectStudioSession } = await import('../utils/syncClient');
    const success = await disconnectStudioSession(syncState.session.token);
    if (success) {
      onShowToast('✓ Studio session disconnected');
      const state = await fetchStudioSyncStatus(project.id);
      if (state) setSyncState(state);
    } else {
      onShowToast('❌ Failed to disconnect session');
    }
  };

  const handleResolve = async (strategy: 'keep_website' | 'keep_studio' | 'manual_merge') => {
    if (!selectedConflict || isResolving) return;
    setIsResolving(true);
    try {
      const ok = await resolveStudioConflict(
        project.id, 
        selectedConflict.conflictId, 
        strategy, 
        strategy === 'manual_merge' ? mergedDraft : undefined
      );

      if (ok) {
        onShowToast(`✓ Conflict resolved: [${strategy.replace('_', ' ').toUpperCase()}] applied`);
        
        // Update local project file if keep_studio or manual_merge
        if (strategy === 'keep_studio' || strategy === 'manual_merge') {
          const newCode = strategy === 'keep_studio' ? selectedConflict.studioSource : mergedDraft;
          const updatedFiles = project.files.map(f => 
            f.path === selectedConflict.path ? { ...f, code: newCode } : f
          );
          onUpdateProject({ ...project, files: updatedFiles });
        }

        const state = await fetchStudioSyncStatus(project.id);
        if (state) {
          setSyncState(state);
          setSelectedConflict(state.conflicts?.[0] || null);
        }
      } else {
        onShowToast(`❌ Failed to resolve conflict.`);
      }
    } catch (err: any) {
      onShowToast(`❌ ${err.message}`);
    } finally {
      setIsResolving(false);
    }
  };

  const isConnected = syncState?.session?.isOnline;

  return (
    <div className="h-full flex flex-col bg-[#0B0F14] text-[#E6EDF3] overflow-hidden">
      
      {/* Top Header Bar */}
      <div className="p-4 bg-[#11161D] border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border flex items-center justify-center ${
            isConnected 
              ? 'bg-[#7EE787]/15 border-[#7EE787]/30 text-[#7EE787]' 
              : 'bg-white/5 border-white/10 text-white/40'
          }`}>
            <Radio className={`w-5 h-5 ${isConnected ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white font-mono">Roblox Studio WebSync</h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isConnected 
                  ? 'bg-[#7EE787]/20 border-[#7EE787]/40 text-[#7EE787]' 
                  : 'bg-[#FF7B72]/20 border-[#FF7B72]/40 text-[#FF7B72]'
              }`}>
                {isConnected ? 'LIVE CONNECTED' : 'OFFLINE / WAITING'}
              </span>
            </div>
            <p className="text-xs text-white/50 font-mono mt-0.5">
              Bidirectional real-time sync between Squeeze AI and open Studio Place
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleGeneratePairingCode}
            disabled={isGeneratingPair}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isGeneratingPair ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{pairingCode ? 'Regenerate Code' : 'Generate Code'}</span>
          </button>

          <button
            onClick={handlePushAllFilesToStudio}
            disabled={isSyncingAll}
            className="px-3.5 py-1.5 rounded-lg bg-[#FFC93C] hover:bg-[#ffe082] text-xs font-mono font-bold text-[#0B120D] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isSyncingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
            <span>Sync All to Studio</span>
          </button>
          
          <button
            onClick={handleDisconnect}
            className="px-3.5 py-1.5 rounded-lg bg-[#FF7B72] hover:bg-[#ff8f88] text-xs font-mono font-bold text-[#0B120D] flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <X className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {/* Workspace Navigation Subtabs */}
      <div className="px-4 bg-[#11161D] border-b border-white/10 flex items-center gap-2 text-xs font-mono">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-3 py-2 border-b-2 font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'status'
              ? 'border-[#FFC93C] text-[#FFC93C]'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Live Status &amp; Pairing</span>
        </button>

        <button
          onClick={() => setActiveTab('conflicts')}
          className={`px-3 py-2 border-b-2 font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'conflicts'
              ? 'border-[#FFC93C] text-[#FFC93C]'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Split className="w-3.5 h-3.5" />
          <span>Conflicts &amp; Diffs</span>
          {syncState?.conflicts && syncState.conflicts.length > 0 && (
            <span className="bg-[#FF7B72] text-[#0B120D] text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {syncState.conflicts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`px-3 py-2 border-b-2 font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'activity'
              ? 'border-[#FFC93C] text-[#FFC93C]'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Audit Log &amp; Queue</span>
          {syncState?.pendingChangesCount ? (
            <span className="bg-[#FFC93C] text-[#0B120D] text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {syncState.pendingChangesCount}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('pluginSource')}
          className={`px-3 py-2 border-b-2 font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'pluginSource'
              ? 'border-[#FFC93C] text-[#FFC93C]'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Studio Plugin Code</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

        {/* TAB 1: STATUS & PAIRING */}
        {activeTab === 'status' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: 8-char Pairing Code Panel */}
            <div className="lg:col-span-1 bg-[#161B22] border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-white/50 font-bold">
                    Studio Pairing Code
                  </span>
                  <span className="text-[10px] font-mono text-[#7EE787] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Secure Token
                  </span>
                </div>

                <div className="p-4 bg-[#0D1117] border border-white/15 rounded-xl flex flex-col items-center justify-center text-center gap-2">
                  <span className="text-[11px] font-mono text-white/50">Enter in Roblox Studio Plugin:</span>
                  <div className="text-2xl font-mono font-bold tracking-widest text-[#FFC93C] bg-white/5 px-4 py-2 rounded-lg border border-[#FFC93C]/30 select-all">
                    {pairingCode || 'CLICK GENERATE'}
                  </div>
                  {pairingCode && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(pairingCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                        onShowToast('Pairing code copied to clipboard!');
                      }}
                      className="mt-1 text-xs font-mono text-white/70 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-[#7EE787]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs text-white/70 font-mono">
                  <div className="flex items-center justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">Place Name:</span>
                    <span className="text-white font-bold">{syncState?.session?.placeName || 'Roblox Place'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">Place ID:</span>
                    <span className="text-white font-bold">{syncState?.session?.placeId || 'Local Studio'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">Plugin Version:</span>
                    <span className="text-white font-bold">{syncState?.session?.pluginVersion || 'v2.0.0'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-white/40">Last Heartbeat:</span>
                    <span className="text-white font-bold">
                      {syncState?.session?.secondsSinceHeartbeat !== undefined 
                        ? `${syncState.session.secondsSinceHeartbeat}s ago` 
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={handleGeneratePairingCode}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate New Pairing Code</span>
                </button>
              </div>
            </div>

            {/* Right Col: Setup Instructions & Step-by-Step */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-[#161B22] border border-white/10 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <span>How to connect Roblox Studio in 3 steps</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#0D1117] border border-white/10 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-[#FFC93C]/20 text-[#FFC93C] font-mono font-bold text-xs flex items-center justify-center">
                      1
                    </div>
                    <span className="text-xs font-bold text-white block">Enable HttpService</span>
                    <p className="text-[11px] text-white/50 leading-relaxed font-body">
                      In Studio: <b>Game Settings &gt; Security &gt; Allow HTTP Requests</b> (Toggle ON).
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0D1117] border border-white/10 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-[#FFC93C]/20 text-[#FFC93C] font-mono font-bold text-xs flex items-center justify-center">
                      2
                    </div>
                    <span className="text-xs font-bold text-white block">Paste Companion Plugin</span>
                    <p className="text-[11px] text-white/50 leading-relaxed font-body">
                      Copy the Luau plugin module from the <b>Studio Plugin Code</b> tab into a ModuleScript.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0D1117] border border-white/10 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-[#FFC93C]/20 text-[#FFC93C] font-mono font-bold text-xs flex items-center justify-center">
                      3
                    </div>
                    <span className="text-xs font-bold text-white block">Pair &amp; Auto-Sync</span>
                    <p className="text-[11px] text-white/50 leading-relaxed font-body">
                      Call <code className="text-[#FFC93C]">PairWithCode("{pairingCode || 'CODE'}")</code> to start live two-way sync.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Synced Files Summary */}
              <div className="bg-[#161B22] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white/60">
                    Active Project Scripts ({project.files.length})
                  </h3>
                  <button
                    onClick={handlePushAllFilesToStudio}
                    className="text-xs font-mono text-[#FFC93C] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Force Push All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-white/5 max-h-56 overflow-y-auto">
                  {project.files.map((file, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-3.5 h-3.5 text-[#FFC93C]" />
                        <span className="text-white/80">{file.path}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-white/40">{file.code.length} bytes</span>
                        <button
                          onClick={async () => {
                            await syncFileToStudio(project.id, {
                              path: file.path,
                              name: file.name,
                              source: file.code
                            });
                            onShowToast(`✓ Queued ${file.path} for sync!`);
                          }}
                          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-[10px] text-white cursor-pointer"
                        >
                          Sync Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: CONFLICTS & DIFF MERGER */}
        {activeTab === 'conflicts' && (
          <div className="space-y-6">
            {(!syncState?.conflicts || syncState.conflicts.length === 0) ? (
              <div className="bg-[#161B22] border border-white/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#7EE787]/15 text-[#7EE787] flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">No Version Conflicts</h3>
                <p className="text-xs text-white/50 max-w-md font-body">
                  All scripts between Squeeze Web IDE and Roblox Studio are perfectly synchronized with optimistic version hashes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Conflict List */}
                <div className="bg-[#161B22] border border-white/10 rounded-2xl p-4 space-y-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/50 block">
                    Detected Conflicts ({syncState.conflicts.length})
                  </span>
                  <div className="space-y-2">
                    {syncState.conflicts.map(c => (
                      <button
                        key={c.conflictId}
                        onClick={() => {
                          setSelectedConflict(c);
                          setMergedDraft(c.websiteSource);
                        }}
                        className={`w-full p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          selectedConflict?.conflictId === c.conflictId
                            ? 'bg-[#FFC93C]/10 border-[#FFC93C] text-white'
                            : 'bg-[#0D1117] border-white/10 text-white/70 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-xs font-bold font-mono">{c.path}</span>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                          <span>Web: v{c.websiteVersion}</span>
                          <span>•</span>
                          <span>Studio: v{c.studioVersion}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conflict Resolution Side-by-Side View */}
                {selectedConflict && (
                  <div className="lg:col-span-2 bg-[#161B22] border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white font-mono">{selectedConflict.path}</h4>
                        <span className="text-[11px] text-[#FF7B72] font-mono">
                          Simultaneous edits detected in Web IDE and Studio
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResolve('keep_website')}
                          disabled={isResolving}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono text-white font-bold cursor-pointer disabled:opacity-50"
                        >
                          Keep Website Version
                        </button>
                        <button
                          onClick={() => handleResolve('keep_studio')}
                          disabled={isResolving}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono text-white font-bold cursor-pointer disabled:opacity-50"
                        >
                          Keep Studio Version
                        </button>
                        <button
                          onClick={() => handleResolve('manual_merge')}
                          disabled={isResolving}
                          className="px-3 py-1.5 rounded-lg bg-[#FFC93C] hover:bg-[#ffe082] text-xs font-mono text-[#0B120D] font-bold cursor-pointer disabled:opacity-50"
                        >
                          Apply Merged Draft
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-[#0D1117] rounded-xl border border-white/10 flex flex-col gap-2">
                        <span className="text-[11px] font-mono font-bold text-[#FFC93C]">Website Version (v{selectedConflict.websiteVersion})</span>
                        <pre className="text-[11px] font-mono text-white/80 bg-black/40 p-2.5 rounded-lg max-h-60 overflow-y-auto">
                          {selectedConflict.websiteSource}
                        </pre>
                      </div>
                      <div className="p-3 bg-[#0D1117] rounded-xl border border-white/10 flex flex-col gap-2">
                        <span className="text-[11px] font-mono font-bold text-[#7EE787]">Studio Version (v{selectedConflict.studioVersion})</span>
                        <pre className="text-[11px] font-mono text-white/80 bg-black/40 p-2.5 rounded-lg max-h-60 overflow-y-auto">
                          {selectedConflict.studioSource}
                        </pre>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <span className="text-xs font-mono font-bold text-white/70">Manual Merge Editor:</span>
                      <textarea
                        value={mergedDraft}
                        onChange={(e) => setMergedDraft(e.target.value)}
                        rows={6}
                        className="w-full bg-[#0D1117] border border-white/15 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-[#FFC93C]"
                      />
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* TAB 3: AUDIT LOG & CHANGE QUEUE */}
        {activeTab === 'activity' && (
          <div className="bg-[#161B22] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-mono">Sync Activity &amp; Change Queue</h3>
              <span className="text-xs font-mono text-white/40">Last 30 events recorded</span>
            </div>

            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
              {syncState?.auditLogs && syncState.auditLogs.length > 0 ? (
                syncState.auditLogs.map(log => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.author === 'studio' 
                          ? 'bg-[#7EE787]/20 text-[#7EE787]' 
                          : log.author === 'ai' 
                          ? 'bg-[#FFC93C]/20 text-[#FFC93C]' 
                          : 'bg-white/10 text-white/80'
                      }`}>
                        {log.author.toUpperCase()}
                      </span>
                      <span className="text-white/80">{log.details}</span>
                    </div>
                    <span className="text-[10px] text-white/40">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs font-mono text-white/40">
                  No sync events logged yet. Connect Studio to begin.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PLUGIN SOURCE CODE */}
        {activeTab === 'pluginSource' && (
          <div className="bg-[#161B22] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">Official Roblox Studio Plugin Source</h3>
                <p className="text-xs text-white/50 font-mono">
                  Squeeze Roblox Studio WebSync Companion v2.0.0 (--!strict typed)
                </p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(pluginSource);
                  onShowToast('✓ Studio Plugin Source copied to clipboard!');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#FFC93C] text-[#0B120D] text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#ffe082]"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Full Plugin Source</span>
              </button>
            </div>

            <LuauCodeViewer
              code={pluginSource}
              filename="SqueezeWebSyncPlugin.luau"
              theme="dark"
              maxHeight="500px"
              onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to disk!`)}
            />
          </div>
        )}

      </div>
    </div>
  );
};
