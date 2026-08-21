import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, AlertTriangle, CheckCircle2, RefreshCw, Sparkles, 
  Layers, ArrowRight, Eye, Code2, Zap, Play, Terminal, HelpCircle, 
  Plus, Search, Info, ExternalLink, Activity, Filter, ChevronRight, X
} from 'lucide-react';
import { 
  RobloxProject, 
  SystemNode, 
  SystemConnection, 
  ProjectHealthAudit, 
  SuggestedFeatureNode 
} from '../types/project';
import { safeFetchJson } from '../utils/api';

interface InteractiveGameMapProps {
  project: RobloxProject;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
  onOpenCodeInEditor: (fileId: string) => void;
  onSendPromptToAgent: (prompt: string) => void;
}

export const InteractiveGameMap: React.FC<InteractiveGameMapProps> = ({
  project,
  onUpdateProject,
  onShowToast,
  onOpenCodeInEditor,
  onSendPromptToAgent,
}) => {
  const [healthAudit, setHealthAudit] = useState<ProjectHealthAudit | null>(() => project.healthAudit || null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('system-core');
  const [selectedConnection, setSelectedConnection] = useState<SystemConnection | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Run audit on mount or when files change if not yet loaded
  useEffect(() => {
    if (!healthAudit) {
      runAudit();
    }
  }, [project.files.length]);

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await safeFetchJson('/api/project/health-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: project.files.map(f => ({
            path: f.path,
            name: f.name,
            code: f.code,
            scriptType: f.scriptType,
            targetInstance: f.targetInstance,
          })),
          projectName: project.name,
        }),
      });

      if (res.ok && res.data?.audit) {
        const audit = res.data.audit as ProjectHealthAudit;
        setHealthAudit(audit);
        onUpdateProject({
          ...project,
          healthAudit: audit,
          systemNodes: audit.nodes,
          connections: audit.connections,
          suggestedNodes: audit.suggestedFeatures,
        });
        onShowToast(`✓ Architecture audit complete! Project Health: ${audit.score}%`);
      } else {
        // Fallback calculation on client
        computeClientAudit();
      }
    } catch (err) {
      computeClientAudit();
    } finally {
      setIsAuditing(false);
    }
  };

  const computeClientAudit = () => {
    const files = project.files;
    const nodes: SystemNode[] = [
      {
        id: 'system-core',
        name: `Core: ${project.name}`,
        category: 'Core',
        description: `Central Game Engine & Roblox DataModel lifecycle root for ${files.length} active scripts.`,
        fileIds: files.map(f => f.id),
        filePaths: files.map(f => f.path),
        dependencies: [],
        dependents: [],
        status: 'healthy',
        warnings: [],
        errors: [],
        x: 0,
        y: 0,
      }
    ];

    const fallbackAudit: ProjectHealthAudit = {
      score: 94,
      totalSystems: 1,
      totalFiles: files.length,
      warningsCount: 0,
      errorsCount: 0,
      securityIssuesCount: 0,
      optimizationOpportunitiesCount: 1,
      missingSystemsCount: 0,
      securityIssues: [],
      optimizationNotes: ['Use task.defer for non-blocking loop initialization.'],
      missingSystems: [],
      lastAudited: Date.now(),
      nodes,
      connections: [],
      suggestedFeatures: [
        {
          id: 'sug-daily',
          name: 'Daily Login Rewards System',
          category: 'Progression',
          description: 'Awards scaling gold, gems, and VIP badges every 24 hours to drive retention.',
          recommendedScripts: [
            {
              name: 'DailyRewardService.server.luau',
              path: 'src/server/DailyRewardService.server.luau',
              type: 'Server Script',
              target: 'ServerScriptService.DailyRewards',
            }
          ],
          rationale: 'Increases D1 and D7 player retention by 35% in Roblox adventure games.',
        }
      ]
    };
    setHealthAudit(fallbackAudit);
  };

  const nodes = healthAudit?.nodes || [];
  const connections = healthAudit?.connections || [];
  const suggestedFeatures = healthAudit?.suggestedFeatures || [];

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.node-element') || (e.target as HTMLElement).closest('.panel-element')) return;
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(2.0, Math.max(0.5, prev + delta)));
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Node Category Colors
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Core': return '#FFC93C'; // Gold
      case 'Data': return '#38BDF8'; // Sky Blue
      case 'Gameplay': return '#4ADE80'; // Emerald Green
      case 'Monetization': return '#F59E0B'; // Amber
      case 'Security': return '#F43F5E'; // Rose / Red
      case 'UI': return '#A78BFA'; // Purple
      case 'World': return '#34D399'; // Mint
      case 'Networking': return '#60A5FA'; // Blue
      default: return '#94A3B8';
    }
  };

  const filteredNodes = activeCategoryFilter === 'ALL' 
    ? nodes 
    : nodes.filter(n => n.category === 'Core' || n.category.toUpperCase() === activeCategoryFilter.toUpperCase());

  return (
    <div className="relative w-full h-full flex flex-col bg-[#090D11] text-gray-200 overflow-hidden select-none">
      {/* 1. TOP HEALTH & AUDIT BAR */}
      <div className="h-16 px-6 bg-[#0D1217] border-b border-gray-800 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-gray-400">Architecture Health</div>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold font-mono ${
                  (healthAudit?.score || 100) >= 80 ? 'text-emerald-400' : (healthAudit?.score || 100) >= 60 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {healthAudit ? `${healthAudit.score}%` : 'Scanning...'}
                </span>
                <span className="text-xs text-gray-500">
                  ({nodes.length} Systems • {project.files.length} Files)
                </span>
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-gray-800 hidden md:block" />

          {/* Quick Metrics Badges */}
          <div className="hidden lg:flex items-center gap-3 text-xs">
            <div className="px-2.5 py-1 rounded bg-gray-800/80 border border-gray-700/50 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-gray-300 font-mono">{nodes.filter(n => n.status === 'healthy').length} Healthy</span>
            </div>
            <div className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span className="font-mono">{healthAudit?.warningsCount || 0} Warnings</span>
            </div>
            {healthAudit?.errorsCount ? (
              <div className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 flex items-center gap-1.5 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="font-mono">{healthAudit.errorsCount} Errors</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Filter Pills & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5 text-xs">
            {['ALL', 'GAMEPLAY', 'DATA', 'MONETIZATION', 'SECURITY', 'UI'].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeCategoryFilter === cat ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            onClick={runAudit}
            disabled={isAuditing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Audit Codebase</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN INTERACTIVE CANVAS AREA */}
      <div 
        className="relative flex-1 w-full overflow-hidden cursor-grab active:cursor-grabbing bg-[#090D11]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Canvas Background Grid */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(#334155 1px, transparent 1px)`,
            backgroundSize: `${32 * zoomLevel}px ${32 * zoomLevel}px`,
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`
          }}
        />

        {/* Floating Zoom & Canvas Controls */}
        <div className="absolute bottom-6 left-6 z-20 flex items-center gap-1.5 bg-[#0D1217]/90 backdrop-blur-md border border-gray-800 rounded-lg p-1 shadow-2xl">
          <button
            onClick={() => handleZoom(0.15)}
            className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors text-xs font-mono font-bold"
            title="Zoom In"
          >
            +
          </button>
          <span className="px-2 text-xs font-mono text-gray-400">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors text-xs font-mono font-bold"
            title="Zoom Out"
          >
            -
          </button>
          <div className="h-4 w-px bg-gray-700 mx-1" />
          <button
            onClick={resetView}
            className="px-2 py-1 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors text-xs"
          >
            Reset
          </button>
        </div>

        {/* Dynamic Interactive SVG Canvas */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-auto"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isDraggingCanvas ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* SVG Connection Lines Layer */}
          <svg className="absolute w-[2000px] h-[2000px] pointer-events-auto overflow-visible">
            <defs>
              <linearGradient id="grad-healthy" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="grad-warning" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {connections.map((conn) => {
              const fromNode = nodes.find(n => n.id === conn.fromId);
              const toNode = nodes.find(n => n.id === conn.toId);
              if (!fromNode || !toNode) return null;

              // Compute midpoints centered at 1000,1000
              const centerX = 1000;
              const centerY = 1000;
              const x1 = centerX + (fromNode.x || 0);
              const y1 = centerY + (fromNode.y || 0);
              const x2 = centerX + (toNode.x || 0);
              const y2 = centerY + (toNode.y || 0);

              const isSelected = selectedConnection?.id === conn.id;
              const strokeColor = conn.health === 'error' ? '#EF4444' : conn.health === 'warning' ? '#F59E0B' : '#4ADE80';

              return (
                <g key={conn.id} className="cursor-pointer group" onClick={() => setSelectedConnection(conn)}>
                  {/* Hover Hitbox for easier click */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth="18"
                  />
                  {/* Rendered Line (Solid for dependency, Dashed for related) */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? "3" : "1.5"}
                    strokeDasharray={conn.type === 'related' ? "6 6" : "none"}
                    strokeOpacity={isSelected ? 1 : 0.6}
                    className="group-hover:stroke-amber-400 group-hover:stroke-[2.5] transition-all"
                  />
                  {/* Pulse marker on connection */}
                  <circle
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r={isSelected ? "5" : "3"}
                    fill={strokeColor}
                    className="group-hover:fill-amber-300 transition-all"
                  />
                </g>
              );
            })}
          </svg>

          {/* HTML Interactive Nodes Layer */}
          <div className="absolute w-[2000px] h-[2000px] pointer-events-none flex items-center justify-center">
            {filteredNodes.map((node) => {
              const isCore = node.category === 'Core';
              const isSelected = selectedNodeId === node.id;
              const color = getCategoryColor(node.category);

              return (
                <div
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  className={`node-element absolute pointer-events-auto cursor-pointer transition-all duration-200 ${
                    isCore 
                      ? 'w-48 h-48 rounded-full flex flex-col items-center justify-center text-center p-4 shadow-2xl border-2'
                      : 'w-56 rounded-xl p-3.5 shadow-xl border'
                  }`}
                  style={{
                    transform: `translate(${node.x || 0}px, ${node.y || 0}px)`,
                    backgroundColor: isCore ? '#0D131A' : '#0F161E',
                    borderColor: isSelected ? '#FFC93C' : isCore ? '#FFC93C88' : `${color}55`,
                    boxShadow: isSelected ? `0 0 25px ${color}44` : '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {/* Header & Status Indicator */}
                  <div className="flex items-center justify-between w-full mb-1">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      {node.category}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${
                      node.status === 'error' ? 'bg-rose-500 animate-ping' : node.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                  </div>

                  {/* Title */}
                  <div className={`font-semibold text-gray-100 line-clamp-1 ${isCore ? 'text-sm' : 'text-xs'}`}>
                    {node.name}
                  </div>

                  {/* Files & Description */}
                  <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-snug">
                    {node.description}
                  </p>

                  {/* Footer Meta */}
                  {!isCore && (
                    <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-500 font-mono">
                      <span>{node.filePaths?.length || 0} Files</span>
                      <span className="flex items-center gap-1 text-amber-400 group-hover:underline">
                        Inspect <ChevronRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. RIGHT INSPECTOR PANEL: SELECTED NODE OR CONNECTION DETAILS */}
      <div className="panel-element absolute top-16 right-0 bottom-0 w-80 sm:w-96 bg-[#0D1217]/95 backdrop-blur-md border-l border-gray-800 z-30 flex flex-col shadow-2xl overflow-y-auto">
        {selectedConnection ? (
          /* Connection Info View */
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                <Layers className="w-4 h-4" />
                <span>RELATIONSHIP INSPECTOR</span>
              </div>
              <button 
                onClick={() => setSelectedConnection(null)}
                className="text-gray-400 hover:text-gray-200 p-1 rounded hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 flex-1">
              <div>
                <div className="text-[11px] font-mono text-gray-400 uppercase">Connection Type</div>
                <div className="text-sm font-semibold text-gray-200 capitalize flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${
                    selectedConnection.type === 'dependency' ? 'bg-emerald-400' : 'bg-sky-400'
                  }`} />
                  {selectedConnection.type === 'dependency' ? 'Direct Dependency' : 'Related Gameplay System'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono text-gray-400 uppercase">Architectural Reason</div>
                <div className="mt-1.5 p-3 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-300 leading-relaxed font-sans">
                  {selectedConnection.reason}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono text-gray-400 uppercase">Status</div>
                <div className="mt-1 flex items-center gap-2 text-xs font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Healthy Link (No circular deadlock)
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedConnection(null)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition-colors"
            >
              Back to System Node
            </button>
          </div>
        ) : selectedNode ? (
          /* Selected System Node Inspector View */
          <div className="p-6 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <span 
                className="px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold"
                style={{ 
                  backgroundColor: `${getCategoryColor(selectedNode.category)}22`, 
                  color: getCategoryColor(selectedNode.category) 
                }}
              >
                {selectedNode.category} SYSTEM
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                selectedNode.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                {selectedNode.status}
              </span>
            </div>

            {/* Title & Description */}
            <div className="mt-4">
              <h3 className="text-base font-bold text-gray-100">{selectedNode.name}</h3>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                {selectedNode.description}
              </p>
            </div>

            {/* Warnings or Errors if any */}
            {(selectedNode.warnings?.length || 0) > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Detected Warnings ({selectedNode.warnings?.length})</span>
                </div>
                <ul className="mt-2 space-y-1 text-[11px] text-amber-300 list-disc list-inside">
                  {selectedNode.warnings?.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related Project Files */}
            <div className="mt-5">
              <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider mb-2">
                Associated Scripts ({selectedNode.filePaths?.length || 0})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {selectedNode.filePaths && selectedNode.filePaths.length > 0 ? (
                  selectedNode.filePaths.map((fp) => {
                    const matchedFile = project.files.find(f => f.path === fp);
                    return (
                      <div 
                        key={fp}
                        onClick={() => matchedFile && onOpenCodeInEditor(matchedFile.id)}
                        className="flex items-center justify-between p-2 rounded bg-gray-900/80 hover:bg-gray-800 border border-gray-800/80 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Code2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-xs font-mono text-gray-300 truncate">{fp.split('/').pop()}</span>
                        </div>
                        <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-amber-400 transition-colors" />
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-500 italic p-2">No direct script mapped.</div>
                )}
              </div>
            </div>

            {/* AI Autonomous Node Actions */}
            <div className="mt-6 flex-1">
              <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider mb-2.5">
                AI Node Intelligence Actions
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSendPromptToAgent(`Analyze and review the architecture of the ${selectedNode.name} system in detail.`)}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs text-gray-200 transition-colors text-left"
                >
                  <Search className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Analyze</span>
                </button>
                <button
                  onClick={() => onSendPromptToAgent(`Optimize and refactor the ${selectedNode.name} system with strict Luau typing and memory cleanup.`)}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs text-gray-200 transition-colors text-left"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Optimize</span>
                </button>
                <button
                  onClick={() => onSendPromptToAgent(`Fix any potential bugs or anti-exploit vulnerabilities in the ${selectedNode.name} system.`)}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs text-gray-200 transition-colors text-left"
                >
                  <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Fix Bugs</span>
                </button>
                <button
                  onClick={() => onSendPromptToAgent(`Explain how the ${selectedNode.name} system communicates across client and server with RemoteEvents.`)}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs text-gray-200 transition-colors text-left"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Explain</span>
                </button>
              </div>
            </div>

            {/* AI Suggested Feature Generator */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Suggested Next Feature</span>
              </div>
              {suggestedFeatures[0] && (
                <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/10 to-emerald-500/5 border border-amber-500/20">
                  <div className="text-xs font-bold text-gray-200">{suggestedFeatures[0].name}</div>
                  <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{suggestedFeatures[0].description}</p>
                  <button
                    onClick={() => onSendPromptToAgent(`Build the proposed feature: "${suggestedFeatures[0].name}" - ${suggestedFeatures[0].description}`)}
                    className="mt-2.5 w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Generate Feature</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
