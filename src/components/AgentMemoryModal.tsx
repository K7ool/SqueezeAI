import React, { useState, useEffect } from 'react';
import { 
  Brain, User, Layers, History, ShieldAlert, Search, RefreshCw, Trash2, 
  Download, Plus, Check, Info, Settings, Database, Code, Key
} from 'lucide-react';
import { safeFetchJson } from '../utils/api';

interface AgentMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onShowToast: (msg: string) => void;
}

export const AgentMemoryModal: React.FC<AgentMemoryModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'user' | 'project' | 'history' | 'events'>('user');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [memoryData, setMemoryData] = useState<any>(null);

  // New preference input
  const [newPrefKey, setNewPrefKey] = useState('');
  const [newPrefValue, setNewPrefValue] = useState('');
  const [newPrefType, setNewPrefType] = useState('coding_style');

  useEffect(() => {
    if (isOpen) {
      fetchMemoryOverview();
    }
  }, [isOpen, projectId]);

  const fetchMemoryOverview = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson(`/api/memory?projectId=${projectId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok && res.data?.success) {
        setMemoryData(res.data.memory);
      }
    } catch (err) {
      console.error("Failed to fetch memory:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUserPreference = async () => {
    if (!newPrefKey.trim() || !newPrefValue.trim()) return;
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson('/api/memory/user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          key: newPrefKey.trim(),
          value: newPrefValue.trim(),
          type: newPrefType,
          confidence: 'high',
          source: 'user_explicit'
        })
      });
      if (res.ok && res.data?.success) {
        onShowToast(`Preference '${newPrefKey}' saved.`);
        setNewPrefKey('');
        setNewPrefValue('');
        fetchMemoryOverview();
      }
    } catch (err) {
      onShowToast('Failed to save preference.');
    }
  };

  const handleDeleteUserPreference = async (key: string) => {
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson(`/api/memory/user/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok && res.data?.success) {
        onShowToast(`Forgot '${key}'.`);
        fetchMemoryOverview();
      }
    } catch (err) {
      onShowToast('Failed to delete preference.');
    }
  };

  const handleClearMemory = async (scope: string) => {
    if (!confirm(`Are you sure you want to clear memory for scope: ${scope}?`)) return;
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson('/api/memory/clear', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ projectId, scope })
      });
      if (res.ok && res.data?.success) {
        onShowToast(`Memory scope '${scope}' cleared.`);
        fetchMemoryOverview();
      }
    } catch (err) {
      onShowToast('Failed to clear memory.');
    }
  };

  const handleExportMemory = async () => {
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson(`/api/memory/export?projectId=${projectId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok && res.data?.export) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data.export, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `squeeze_agent_memory_${projectId}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        onShowToast('Memory backup downloaded.');
      }
    } catch (err) {
      onShowToast('Failed to export memory.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1e293b]/80 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Agent Persistent Memory Engine
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active DB Persistence
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Project: <span className="text-cyan-300 font-mono">{projectName} ({projectId})</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportMemory}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg flex items-center gap-1.5 transition"
              title="Download memory JSON backup"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Export JSON
            </button>
            <button
              onClick={fetchMemoryOverview}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition"
              title="Refresh Memory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl font-bold px-3 py-1 rounded-lg hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-[#0b1329] px-6 gap-2">
          <button
            onClick={() => setActiveTab('user')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'user'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            User Preferences ({memoryData?.userPreferences?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'project'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Project Knowledge
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'history'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            Recent Executions ({memoryData?.recentExecutions?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'events'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="w-4 h-4" />
            Audit Log ({memoryData?.memoryEvents?.length || 0})
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#090d16]">
          
          {/* USER PREFERENCES TAB */}
          {activeTab === 'user' && (
            <div className="space-y-6">
              
              {/* Add New Preference */}
              <div className="bg-[#131d33] border border-cyan-500/20 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  Teach Agent a New Rule or Preference
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Preference Key (e.g. luau.typing)"
                    value={newPrefKey}
                    onChange={(e) => setNewPrefKey(e.target.value)}
                    className="bg-[#0b1329] border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:border-cyan-400 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. strict)"
                    value={newPrefValue}
                    onChange={(e) => setNewPrefValue(e.target.value)}
                    className="bg-[#0b1329] border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:border-cyan-400 outline-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newPrefType}
                      onChange={(e) => setNewPrefType(e.target.value)}
                      className="bg-[#0b1329] border border-slate-700 text-xs text-slate-300 rounded-lg px-3 py-2 outline-none flex-1"
                    >
                      <option value="coding_style">Coding Style</option>
                      <option value="luau_style">Luau Style</option>
                      <option value="architecture">Architecture</option>
                      <option value="response_style">Response Style</option>
                    </select>
                    <button
                      onClick={handleSaveUserPreference}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-lg transition"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              {/* Memory List */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Remembered User Preferences
                </h4>
                {memoryData?.userPreferences?.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs bg-[#0e1626] rounded-xl border border-slate-800">
                    No custom user preferences stored yet. As you talk to Squeeze, it will automatically learn your coding preferences!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {memoryData?.userPreferences?.map((m: any) => (
                      <div key={m.id || m.key} className="bg-[#0e1626] border border-slate-800 hover:border-cyan-500/30 rounded-xl p-3 flex justify-between items-start transition group">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-cyan-300">{m.key}</span>
                            <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-400">
                              {m.confidence} confidence
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 font-mono bg-[#070b14] px-2 py-1 rounded">
                            {JSON.stringify(m.value)}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Source: {m.source} • Updated: {new Date(m.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteUserPreference(m.key)}
                          className="text-slate-600 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                          title="Forget this preference"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* PROJECT KNOWLEDGE TAB */}
          {activeTab === 'project' && (
            <div className="space-y-6">
              <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Project Architecture Facts
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">Game Type</span>
                    <span className="text-slate-200 font-semibold">{memoryData?.projectMemory?.gameType || 'Standard Roblox Experience'}</span>
                  </div>
                  <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">Data persistence</span>
                    <span className="text-emerald-400 font-semibold">{memoryData?.projectMemory?.dataSystem || 'ProfileService'}</span>
                  </div>
                  <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">Framework</span>
                    <span className="text-cyan-400 font-semibold">{memoryData?.projectMemory?.frameworks?.join(', ') || 'Standard Luau'}</span>
                  </div>
                  <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">Command system</span>
                    <span className="text-slate-200 font-semibold">{memoryData?.projectMemory?.commandSystem || 'None'}</span>
                  </div>
                  <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">WebSync status</span>
                    <span className="text-cyan-300 font-semibold">{memoryData?.projectMemory?.websync || 'WebSync Connected'}</span>
                  </div>
                  <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">UI framework</span>
                    <span className="text-slate-200 font-semibold">{memoryData?.projectMemory?.UIFramework || 'Roact / Fusion / ScreenGui'}</span>
                  </div>
                </div>

                {/* Learned Conventions */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Learned Conventions
                  </h4>
                  {memoryData?.projectMemory?.learnedConventions && Object.keys(memoryData.projectMemory.learnedConventions).length > 0 ? (
                    <div className="bg-[#080d1a] p-3 rounded-lg border border-slate-800 space-y-1 font-mono text-xs">
                      {Object.entries(memoryData.projectMemory.learnedConventions).map(([k, v]: any) => (
                        <div key={k} className="flex justify-between py-0.5 border-b border-slate-800/50 last:border-0">
                          <span className="text-cyan-400">{k}:</span>
                          <span className="text-slate-300">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No custom project conventions learned yet.</p>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Execution Memory & Task History
              </h4>
              {memoryData?.recentExecutions?.length === 0 ? (
                <p className="text-xs text-slate-500 p-8 text-center bg-[#0e1626] rounded-xl border border-slate-800">
                  No execution history logged yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {memoryData?.recentExecutions?.map((exec: any) => (
                    <div key={exec.id} className="bg-[#0e1626] border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
                            {exec.intent}
                          </span>
                          "{exec.request}"
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(exec.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 bg-[#080d1a] p-2 rounded font-mono">
                        {exec.planSummary}
                      </p>
                      {exec.filesChanged && exec.filesChanged.length > 0 && (
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          <span className="text-slate-500">Files:</span>
                          {exec.filesChanged.map((f: string) => (
                            <span key={f} className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AUDIT LOG TAB */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Memory Audit Trail & Events
                </h4>
                <button
                  onClick={() => handleClearMemory('all')}
                  className="px-3 py-1 bg-red-900/30 border border-red-700/50 hover:bg-red-900/50 text-red-300 text-xs rounded-lg transition"
                >
                  Clear All Memory
                </button>
              </div>

              <div className="bg-[#0e1626] border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
                {memoryData?.memoryEvents?.map((evt: any) => (
                  <div key={evt.id} className="p-3 border-b border-slate-800/80 hover:bg-slate-800/30 flex justify-between items-center text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                        evt.action === 'created' ? 'bg-emerald-500/20 text-emerald-400' :
                        evt.action === 'updated' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {evt.action}
                      </span>
                      <span>{evt.details}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#1e293b]/80 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Persistent Storage: <strong className="text-cyan-400">data/squeeze_db.json</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
