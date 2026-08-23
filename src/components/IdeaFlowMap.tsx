import React, { useState } from 'react';
import { 
  Sparkles, ArrowRight, CheckCircle2, RefreshCw, Plus, 
  Folder, Play, FileCode, HardDrive, Download, ChevronRight, Zap, Lightbulb
} from 'lucide-react';
import { RobloxProject, IdeaNode, ProjectFile } from '../types/project';
import { LuauCodeViewer } from './LuauCodeViewer';
import { saveFileToDiskHandle, saveProjectToLocalStorage } from '../utils/projectDisk';
import { formatAndSanitizeLuau } from '../utils/luauFormatter';

interface IdeaFlowMapProps {
  project: RobloxProject;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
  onOpenCodeInEditor: (fileId: string) => void;
}

export const IdeaFlowMap: React.FC<IdeaFlowMapProps> = ({
  project,
  onUpdateProject,
  onShowToast,
  onOpenCodeInEditor,
}) => {
  const [nodes, setNodes] = useState<IdeaNode[]>(() => {
    return project.ideaNodes && project.ideaNodes.length > 0
      ? project.ideaNodes
      : [
          {
            id: 'idea-root-1',
            label: 'Treasure Chest',
            description: 'Interactive loot chest with proximity prompts and cooldowns.',
            category: 'mechanic',
            status: 'idle',
            scriptTitle: 'Treasure Chest Spawner',
            scriptType: 'Server Script',
            targetInstance: 'ServerScriptService.ChestHandler',
            filePath: 'src/server/TreasureChest.server.luau',
            childrenIds: ['idea-root-2']
          },
          {
            id: 'idea-root-2',
            label: 'Rare Items',
            description: 'Weighted probability drop tables with tiered rarities (Common, Rare, Legendary).',
            category: 'item',
            parentId: 'idea-root-1',
            status: 'idle',
            scriptTitle: 'Rare Items Drop Table',
            scriptType: 'ModuleScript',
            targetInstance: 'ReplicatedStorage.Common.LootTable',
            filePath: 'src/shared/LootTable.luau',
            childrenIds: ['idea-root-3']
          },
          {
            id: 'idea-root-3',
            label: 'VFX open for Chest',
            description: 'Particle bursts, spring lid physics, and sound effects on interaction.',
            category: 'vfx',
            parentId: 'idea-root-2',
            status: 'idle',
            scriptTitle: 'Chest Opening VFX & Tween',
            scriptType: 'LocalScript',
            targetInstance: 'StarterPlayer.StarterPlayerScripts.ChestVFX',
            filePath: 'src/client/ChestVFX.client.luau',
            childrenIds: []
          }
        ];
  });

  const [activeGeneratingId, setActiveGeneratingId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id || null);
  const [isScanningProject, setIsScanningProject] = useState(false);
  const [customNodeLabel, setCustomNodeLabel] = useState('');
  const [isAddingNode, setIsAddingNode] = useState(false);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

  // Generates Luau script for an idea node and automatically produces next child ideas
  const handleGenerateIdeaScript = async (node: IdeaNode) => {
    if (activeGeneratingId) return;
    setActiveGeneratingId(node.id);

    // Update node status to generating
    setNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: 'generating' } : n));

    try {
      const projectSummary = project.files.map(f => `${f.path}:\n${f.code.slice(0, 500)}`).join('\n\n');
      const prompt = `Create a complete production Luau script for the game mechanic: "${node.label}" - ${node.description}. Script type: ${node.scriptType || 'Server Script'}. Target: ${node.targetInstance || 'ServerScriptService'}.`;

      const token = localStorage.getItem('squeeze_token');
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          prompt,
          contextHierarchy: projectSummary
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate script for idea node.');
      }

      const script = data.script;
      const cleanCode = formatAndSanitizeLuau(script.code);
      const cleanFileName = `${(script.title || node.label).replace(/[^a-zA-Z0-9]/g, '')}.${script.scriptType === 'LocalScript' ? 'client' : script.scriptType === 'ModuleScript' ? 'luau' : 'server.luau'}`;
      const defaultPath = script.scriptType === 'LocalScript' ? `src/client/${cleanFileName}` : script.scriptType === 'ModuleScript' ? `src/shared/${cleanFileName}` : `src/server/${cleanFileName}`;

      // Save new file into project
      const newFile: ProjectFile = {
        id: `file-idea-${Date.now()}`,
        name: cleanFileName,
        path: defaultPath,
        code: cleanCode,
        scriptType: script.scriptType || node.scriptType || 'Server Script',
        targetInstance: script.targetInstance || node.targetInstance || 'ServerScriptService',
        lastModified: Date.now(),
        tags: [node.category, 'GeneratedFromIdeaMap']
      };

      // If native directory handle exists, write to disk
      if (project.dirHandle) {
        await saveFileToDiskHandle(newFile, cleanCode, project.dirHandle);
      }

      const updatedFiles = [...project.files.filter(f => f.path !== defaultPath), newFile];

      // Now automatically expand next downstream ideas from this node!
      let newChildNodes: IdeaNode[] = [];
      try {
        const expandRes = await fetch('/api/project/expand-idea', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            parentIdea: node.label,
            gameContext: `Genre: Roblox Game. Current Files: ${project.files.map(f => f.name).join(', ')}`,
            existingLabels: nodes.map(n => n.label)
          })
        });

        if (expandRes.ok) {
          const expandData = await expandRes.json();
          if (Array.isArray(expandData.children)) {
            newChildNodes = expandData.children.map((c: any, i: number) => ({
              id: `idea-child-${Date.now()}-${i}`,
              label: c.label,
              description: c.description,
              category: c.category || 'mechanic',
              parentId: node.id,
              status: 'idle' as const,
              scriptTitle: c.label,
              scriptType: c.suggestedScriptType || 'Server Script',
              targetInstance: c.suggestedTarget || 'ServerScriptService',
              filePath: `src/server/${c.label.replace(/[^a-zA-Z0-9]/g, '')}.server.luau`,
              childrenIds: []
            }));
          }
        }
      } catch (expandErr) {
        console.warn('Could not expand child ideas:', expandErr);
      }

      // Update node states
      const updatedNodes = nodes.map(n => {
        if (n.id === node.id) {
          const existingChildIds = n.childrenIds || [];
          const newIds = newChildNodes.map(c => c.id);
          return {
            ...n,
            status: 'completed' as const,
            scriptTitle: script.title,
            scriptCode: cleanCode,
            filePath: defaultPath,
            childrenIds: Array.from(new Set([...existingChildIds, ...newIds]))
          };
        }
        return n;
      });

      const finalNodes = [...updatedNodes, ...newChildNodes];
      setNodes(finalNodes);
      setSelectedNodeId(node.id);

      const updatedProject: RobloxProject = {
        ...project,
        files: updatedFiles,
        activeFileId: newFile.id,
        ideaNodes: finalNodes,
        updatedAt: Date.now()
      };

      onUpdateProject(updatedProject);
      saveProjectToLocalStorage(updatedProject);

      onShowToast(`✓ Generated & saved "${cleanFileName}" to local project! Next ideas branched.`);
    } catch (err: any) {
      console.error('Error generating idea script:', err);
      onShowToast(`❌ ${err.message || 'Generation failed'}`);
      setNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: 'idle' } : n));
    } finally {
      setActiveGeneratingId(null);
    }
  };

  // Auto Scan Project to generate custom ideas
  const handleAutoScanProject = async () => {
    setIsScanningProject(true);
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await fetch('/api/project/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          files: project.files.map(f => ({ path: f.path, code: f.code, name: f.name }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.analysis?.initialIdeaChain && data.analysis.initialIdeaChain.length > 0) {
          const freshNodes: IdeaNode[] = data.analysis.initialIdeaChain.map((chainItem: any, idx: number, arr: any[]) => ({
            id: `idea-scan-${Date.now()}-${idx}`,
            label: chainItem.label,
            description: chainItem.description,
            category: chainItem.category || 'mechanic',
            parentId: idx > 0 ? `idea-scan-${Date.now()}-${idx - 1}` : undefined,
            status: 'idle' as const,
            scriptTitle: chainItem.label,
            scriptType: chainItem.suggestedScriptType || 'Server Script',
            targetInstance: chainItem.suggestedTarget || 'ServerScriptService',
            filePath: `src/server/${chainItem.label.replace(/[^a-zA-Z0-9]/g, '')}.server.luau`,
            childrenIds: idx < arr.length - 1 ? [`idea-scan-${Date.now()}-${idx + 1}`] : []
          }));

          setNodes(freshNodes);
          setSelectedNodeId(freshNodes[0].id);

          const updatedProject: RobloxProject = {
            ...project,
            ideaNodes: freshNodes,
            updatedAt: Date.now()
          };
          onUpdateProject(updatedProject);
          saveProjectToLocalStorage(updatedProject);

          onShowToast(`⚡ Analyzed ${project.name} and mapped ${freshNodes.length} connected mechanic ideas!`);
        }
      }
    } catch (err) {
      console.error('Scan failed:', err);
      onShowToast('Could not analyze project.');
    } finally {
      setIsScanningProject(false);
    }
  };

  const handleAddCustomNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNodeLabel.trim()) return;

    const newNode: IdeaNode = {
      id: `idea-custom-${Date.now()}`,
      label: customNodeLabel.trim(),
      description: `Custom game mechanic for ${project.name}.`,
      category: 'mechanic',
      parentId: selectedNode?.id,
      status: 'idle',
      scriptTitle: customNodeLabel.trim(),
      scriptType: 'Server Script',
      targetInstance: 'ServerScriptService',
      filePath: `src/server/${customNodeLabel.replace(/[^a-zA-Z0-9]/g, '')}.server.luau`,
      childrenIds: []
    };

    let updatedNodes = [...nodes, newNode];
    if (selectedNode) {
      updatedNodes = updatedNodes.map(n => n.id === selectedNode.id ? {
        ...n,
        childrenIds: [...(n.childrenIds || []), newNode.id]
      } : n);
    }

    setNodes(updatedNodes);
    setSelectedNodeId(newNode.id);
    setCustomNodeLabel('');
    setIsAddingNode(false);

    const updatedProject = {
      ...project,
      ideaNodes: updatedNodes,
      updatedAt: Date.now()
    };
    onUpdateProject(updatedProject);
    saveProjectToLocalStorage(updatedProject);
    onShowToast(`Added "${newNode.label}" to Idea Map!`);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'item': return 'border-[#FFC93C]/40 bg-[#FFC93C]/10 text-[#FFC93C]';
      case 'vfx': return 'border-[#D2A8FF]/40 bg-[#D2A8FF]/10 text-[#D2A8FF]';
      case 'combat': return 'border-[#FF7B72]/40 bg-[#FF7B72]/10 text-[#FF7B72]';
      case 'monetization': return 'border-[#7EE787]/40 bg-[#7EE787]/10 text-[#7EE787]';
      default: return 'border-[#79C0FF]/40 bg-[#79C0FF]/10 text-[#79C0FF]';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1117] text-[#FFFDF6] overflow-hidden rounded-xl border border-white/10">
      
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#161B22]/80">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[#FFC93C]" />
            <h3 className="text-base sm:text-lg font-bold text-[#FFFDF6] font-display">
              Game Mechanic Flow &amp; Idea Map
            </h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#A8E6B0]/15 text-[#A8E6B0] font-bold border border-[#A8E6B0]/30">
              Interactive
            </span>
          </div>
          <p className="text-xs text-[#FFFDF6]/60 mt-1 font-body">
            Click any idea node to generate its full typed Luau script, save it to <strong className="text-[#FFFDF6]">{project.name}</strong>, and automatically branch into downstream ideas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoScanProject}
            disabled={isScanningProject}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-[#FFC93C] hover:text-[#0B120D] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/15 disabled:opacity-50"
          >
            {isScanningProject ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Reading Project…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Scan Project for Ideas</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsAddingNode(true)}
            className="px-3 py-1.5 rounded-lg bg-[#FFC93C] text-[#0B120D] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:bg-[#ffe082]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Node</span>
          </button>
        </div>
      </div>

      {/* Main Content: Flow Map Canvas + Node Detail Inspector */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] overflow-hidden min-h-[480px]">
        
        {/* Left: Visual Flow Nodes */}
        <div className="p-5 sm:p-6 overflow-y-auto bg-[#0B120D]/40 border-r border-white/10 flex flex-col gap-6">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#FFFDF6]/50 flex items-center justify-between">
            <span>Mechanic Progression Chain</span>
            <span>{nodes.length} Nodes in Flow</span>
          </div>

          {/* Interactive Flow Chain */}
          <div className="flex flex-col gap-4">
            {nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.id;
              const isGeneratingThis = activeGeneratingId === node.id;
              const isDone = node.status === 'completed';

              return (
                <div key={node.id} className="flex flex-col">
                  {/* The Node Card */}
                  <div
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`relative p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-[#FFC93C] bg-white/10 shadow-lg shadow-[#FFC93C]/5 ring-1 ring-[#FFC93C]/40'
                        : isDone
                        ? 'border-[#A8E6B0]/40 bg-[#161B22] hover:border-[#A8E6B0]'
                        : 'border-white/15 bg-[#161B22]/70 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold border ${getCategoryColor(node.category)}`}>
                          {node.category}
                        </span>
                        <h4 className="font-bold text-sm text-[#FFFDF6] flex items-center gap-1.5">
                          {node.label}
                        </h4>
                      </div>

                      {/* Status Action Badge */}
                      <div>
                        {isDone ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-[#A8E6B0] font-bold bg-[#A8E6B0]/15 px-2 py-0.5 rounded border border-[#A8E6B0]/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Saved to Disk
                          </span>
                        ) : isGeneratingThis ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-[#FFC93C] font-bold bg-[#FFC93C]/15 px-2 py-0.5 rounded border border-[#FFC93C]/30 animate-pulse">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Generating…
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateIdeaScript(node);
                            }}
                            className="flex items-center gap-1 text-[11px] font-mono text-[#0B120D] bg-[#FFC93C] hover:bg-[#FFE082] px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer shadow-sm"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Generate Luau
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[#FFFDF6]/70 mt-2 line-clamp-2 leading-relaxed">
                      {node.description}
                    </p>

                    {/* Metadata strip */}
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-[#FFFDF6]/50">
                      <span className="flex items-center gap-1">
                        <FileCode className="w-3 h-3 text-[#79C0FF]" />
                        {node.filePath || `${node.label}.server.luau`}
                      </span>
                      <span className="text-[#7EE787] text-[10px]">
                        {node.targetInstance || 'ServerScriptService'}
                      </span>
                    </div>
                  </div>

                  {/* Flow Arrow to Next Node */}
                  {index < nodes.length - 1 && (
                    <div className="py-2 flex items-center justify-center text-white/30">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-[#FFC93C]/70">
                        <div className="w-0.5 h-4 bg-gradient-to-b from-[#FFC93C]/40 to-transparent" />
                        <span className="tracking-widest font-bold">--- &gt;</span>
                        <div className="w-0.5 h-4 bg-gradient-to-t from-[#FFC93C]/40 to-transparent" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add custom node form */}
          {isAddingNode && (
            <form onSubmit={handleAddCustomNode} className="p-3.5 bg-white/5 rounded-xl border border-white/15 flex gap-2">
              <input
                type="text"
                value={customNodeLabel}
                onChange={(e) => setCustomNodeLabel(e.target.value)}
                placeholder="e.g. Chest Mimic Monster Trap"
                autoFocus
                className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-[#FFFDF6] placeholder:text-white/40 focus:outline-none focus:border-[#FFC93C]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-[#FFC93C] text-[#0B120D] text-xs font-bold font-mono cursor-pointer"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsAddingNode(false)}
                className="px-2 py-1.5 text-xs text-white/60 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        {/* Right: Selected Node Details & Code Preview */}
        <div className="p-5 sm:p-6 overflow-y-auto flex flex-col bg-[#161B22]/40">
          {selectedNode ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold border ${getCategoryColor(selectedNode.category)}`}>
                    {selectedNode.category} Node
                  </span>
                  <h3 className="text-base font-bold text-[#FFFDF6] mt-1.5">
                    {selectedNode.label}
                  </h3>
                </div>

                {selectedNode.status !== 'completed' && (
                  <button
                    onClick={() => handleGenerateIdeaScript(selectedNode)}
                    disabled={activeGeneratingId === selectedNode.id}
                    className="btn-squeeze px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {activeGeneratingId === selectedNode.id ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate &amp; Save File</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="mt-4 text-xs text-[#FFFDF6]/80 leading-relaxed font-body">
                {selectedNode.description}
              </div>

              {/* Placement & Target Info */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono p-3 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <span className="text-white/40 block text-[10px]">TARGET INSTANCE</span>
                  <span className="text-[#A8E6B0] font-semibold">{selectedNode.targetInstance || 'ServerScriptService'}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">FILE PATH</span>
                  <span className="text-[#79C0FF] truncate block">{selectedNode.filePath || 'src/server/Script.server.luau'}</span>
                </div>
              </div>

              {/* Code viewer if generated */}
              <div className="mt-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between text-xs font-mono text-[#FFFDF6]/60 mb-2">
                  <span>Luau Implementation</span>
                  {selectedNode.scriptCode && (
                    <span className="text-[#A8E6B0] font-bold">✓ Production Ready</span>
                  )}
                </div>

                {selectedNode.scriptCode ? (
                  <div className="flex-1 flex flex-col">
                    <LuauCodeViewer
                      code={selectedNode.scriptCode}
                      filename={selectedNode.filePath ? selectedNode.filePath.split('/').pop() : `${selectedNode.label}.server.luau`}
                      theme="dark"
                      maxHeight="360px"
                      onOpenInProject={() => {
                        const fileMatch = project.files.find(f => f.path === selectedNode.filePath);
                        if (fileMatch) {
                          onOpenCodeInEditor(fileMatch.id);
                        }
                      }}
                      onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to disk!`)}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-white/15 bg-white/[0.02]">
                    <Sparkles className="w-8 h-8 text-[#FFC93C]/40 mb-2" />
                    <p className="text-xs text-[#FFFDF6]/50 max-w-[260px] font-mono">
                      Click <strong className="text-[#FFC93C]">"Generate Luau"</strong> to write this mechanic, save it directly to your game folder, and branch more ideas!
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 text-xs font-mono">
              Select a node from the map to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
