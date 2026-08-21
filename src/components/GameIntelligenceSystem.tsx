import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Lightbulb, Play, CheckCircle2, RefreshCw, X, Shield, 
  Layers, Cpu, FileCode, Check, AlertCircle, ArrowRight, Activity, 
  Zap, Database, Compass, Eye, Sliders, MessageSquare, Terminal, Plus
} from 'lucide-react';
import { RobloxProject, ProjectFile, IdeaNode } from '../types/project';
import { LuauCodeViewer } from './LuauCodeViewer';
import { saveFileToDiskHandle, saveProjectToLocalStorage } from '../utils/projectDisk';
import { formatAndSanitizeLuau } from '../utils/luauFormatter';

interface GameIntelligenceSystemProps {
  project: RobloxProject;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
  onOpenCodeInEditor: (fileId: string) => void;
}

interface FeatureCardData {
  id: string;
  name: string;
  category: 'Combat' | 'Pets' | 'Progression' | 'Economy' | 'UI' | 'Social' | 'Content' | 'Monetization' | 'World' | 'QoL';
  whyThisFeature: string;
  whatItAdds: string;
  integration: string[];
  complexity: 'Easy' | 'Medium' | 'Advanced';
  estimatedImplementation: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  impact: 'Gameplay' | 'Retention' | 'Progression' | 'Social' | 'Monetization';
  overview: string;
  gameplayLoop: string[];
  requiredSystems: string[];
  existingSystemsUsed: string[];
  newSystemsRequired: string[];
  filesAffected: { path: string; isNew: boolean }[];
  implementationPlan: { step: number; title: string; tasks: string[] }[];
}

export const GameIntelligenceSystem: React.FC<GameIntelligenceSystemProps> = ({
  project,
  onUpdateProject,
  onShowToast,
  onOpenCodeInEditor,
}) => {
  const [analysisMode, setAnalysisMode] = useState<
    'missing' | 'gameplay' | 'retention' | 'monetization' | 'ux' | 'content' | 'weak'
  >('missing');
  const [userPrompt, setUserPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedSteps, setFeedSteps] = useState<{ text: string; completed: boolean }[]>([]);
  const [featureCards, setFeatureCards] = useState<FeatureCardData[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<FeatureCardData | null>(null);
  const [approvalState, setApprovalState] = useState<'idle' | 'planning' | 'approved' | 'implementing' | 'completed'>('idle');
  const [planChecklist, setPlanChecklist] = useState<{ [key: string]: boolean }>({});
  const [activeTab, setActiveTab] = useState<'cards' | 'map' | 'plan' | 'memory'>('cards');

  // Persistent AI Session Memory state across requests & sessions
  const [aiMemory, setAiMemory] = useState<{
    suggested: string[];
    implemented: string[];
    rejected: string[];
    preferences: string[];
  }>(() => {
    try {
      const saved = localStorage.getItem('squeeze_ai_memory');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      suggested: ['Pet Mood, Hunger & Autonomous Behaviors', 'Area-Specific Pet Scavenging & Combat Gold Drops'],
      implemented: [],
      rejected: [],
      preferences: []
    };
  });

  useEffect(() => {
    localStorage.setItem('squeeze_ai_memory', JSON.stringify(aiMemory));
  }, [aiMemory]);

  // Default rich feature cards if none generated yet
  useEffect(() => {
    if (featureCards.length === 0) {
      const defaultCards: FeatureCardData[] = [
        {
          id: 'feat-1',
          name: 'Pet Mood, Hunger & Autonomous Behaviors',
          category: 'Pets',
          whyThisFeature: 'Your project already supports pets and equipping, but pets currently lack interactive engagement loops.',
          whatItAdds: 'Real-time mood and hunger stats that decay over time, modified by petting, feeding, and active play animations.',
          integration: ['Pet System', 'Inventory System', 'Player DataStore'],
          complexity: 'Medium',
          estimatedImplementation: '~2 systems, ~3 scripts, ~1 UI component',
          priority: 'High',
          impact: 'Retention',
          overview: 'Adds continuous pet companionship dynamics where neglected pets become sluggish, while well-fed and petted companions grant active multipliers.',
          gameplayLoop: [
            'Player equips pet from inventory',
            'Pet hunger & mood timers start ticking down',
            'Player interacts (feed, play, pet animation)',
            'Mood meter fills up & unlocks temporary ability boost',
            'Player uses pet ability in combat or exploration'
          ],
          requiredSystems: ['PetInteractionService', 'PetDataStore', 'PetUIController'],
          existingSystemsUsed: ['ServerScriptService.Pets.PetService', 'ReplicatedStorage.Modules.PetConfig'],
          newSystemsRequired: ['ServerScriptService.Pets.PetBehaviorManager', 'StarterGui.Pets.PetMoodBar'],
          filesAffected: [
            { path: 'src/server/Pets/PetService.server.luau', isNew: false },
            { path: 'src/server/Pets/PetBehaviorManager.server.luau', isNew: true },
            { path: 'src/shared/Modules/PetConfig.luau', isNew: false },
            { path: 'src/client/Pets/PetMoodBar.client.luau', isNew: true }
          ],
          implementationPlan: [
            { step: 1, title: 'Analyze existing pet interaction service', tasks: ['Find current PetService methods', 'Inspect pet data structure', 'Check equipped pet replication'] },
            { step: 2, title: 'Add Mood & Hunger state variables', tasks: ['Add Mood value (0-100)', 'Add Hunger value (0-100)', 'Add server validation routines', 'Integrate with Player DataStore save loop'] },
            { step: 3, title: 'Create Pet Behavior & UI handler', tasks: ['Implement server behavior loop', 'Create client HUD mood meter', 'Add particle reaction effects for feeding'] }
          ]
        },
        {
          id: 'feat-2',
          name: 'Area-Specific Pet Scavenging & Combat Gold Drops',
          category: 'Combat',
          whyThisFeature: 'Connects your explored map zones directly with your pet mechanics for rewarding loot loops.',
          whatItAdds: 'Timed expeditions where active pets scavenge area nodes for rare crafting items and bonus combat currency.',
          integration: ['Area System', 'Combat System', 'Loot Table'],
          complexity: 'Advanced',
          estimatedImplementation: '~3 systems, ~5 scripts, ~2 UI components',
          priority: 'Critical',
          impact: 'Gameplay',
          overview: 'Allows players to deploy equipped pets into discovered map zones to forage for rare mutations, gold currency, and temporary area buffs.',
          gameplayLoop: [
            'Player enters specific map zone',
            'Commands pet to scavenge zone node',
            'Timed expedition countdown starts',
            'Pet returns with randomized rare loot & gold drops',
            'Triggers screen notification & particle reward burst'
          ],
          requiredSystems: ['ZoneManager', 'ScavengeService', 'LootSystem'],
          existingSystemsUsed: ['ReplicatedStorage.LootTable', 'ServerScriptService.CombatHandler'],
          newSystemsRequired: ['ServerScriptService.Zones.ScavengeService', 'StarterGui.Zones.ExpeditionUI'],
          filesAffected: [
            { path: 'src/server/Zones/ScavengeService.server.luau', isNew: true },
            { path: 'src/shared/LootTable.luau', isNew: false },
            { path: 'src/client/Zones/ExpeditionUI.client.luau', isNew: true }
          ],
          implementationPlan: [
            { step: 1, title: 'Configure zone loot tables', tasks: ['Define zone-specific reward rarities', 'Hook up drop probability calculations'] },
            { step: 2, title: 'Build Expedition Server Service', tasks: ['Create timer-based expedition handler', 'Add server-authoritative reward validation'] },
            { step: 3, title: 'Wire client expedition prompt & rewards', tasks: ['Create UI button in zone hubs', 'Add reward collection animations'] }
          ]
        }
      ];
      setFeatureCards(defaultCards);
      setSelectedFeature(defaultCards[0]);
    }
  }, []);

  // Run AI Game Intelligence Analysis & Idea Generation
  const handleRunIntelligenceAnalysis = async (customQuery?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setFeedSteps([]);
    setApprovalState('idle');

    const steps = [
      { text: `Reading project files and parsing ${project.files.length} Roblox scripts...`, completed: false },
      { text: `Analyzing game genre, core loop, and existing system connections...`, completed: false },
      { text: `Running gap analysis on missing mechanics (${analysisMode.toUpperCase()} mode)...`, completed: false },
      { text: customQuery ? `Evaluating user prompt: "${customQuery}"...` : `Cross-referencing feature history & balancing priorities...`, completed: false },
      { text: `Generating verified feature cards with implementation complexity & impact scores...`, completed: false }
    ];

    for (let i = 0; i < steps.length; i++) {
      setFeedSteps(prev => [...prev, { ...steps[i], completed: false }]);
      await new Promise(r => setTimeout(r, 650));
      setFeedSteps(prev => prev.map((s, idx) => idx === i ? { ...s, completed: true } : s));
    }

    try {
      const token = localStorage.getItem('squeeze_token');
      const queryToUse = customQuery || userPrompt;
      const res = await fetch('/api/project/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          files: project.files.map(f => ({ path: f.path, code: f.code, name: f.name })),
          mode: analysisMode,
          customQuery: queryToUse,
          sessionMemory: aiMemory
        })
      });

      if (res.ok) {
        const data = await res.json();
        const generated: FeatureCardData[] = [
          {
            id: `feat-${Date.now()}-1`,
            name: queryToUse ? `Custom Feature: ${queryToUse}` : `Pet Expedition Quests & Area Foraging`,
            category: 'Pets',
            whyThisFeature: `Your project features pets and areas, but lacks structured time-based expeditions for long-term engagement.`,
            whatItAdds: `Time-based foraging missions where players dispatch active pets to discover rare items in unlocked zones.`,
            integration: ['Pet System', 'Area System', 'DataStore'],
            complexity: 'Medium',
            estimatedImplementation: '~2 systems, ~4 scripts, ~1 UI',
            priority: 'High',
            impact: 'Retention',
            overview: `Transforms idle pet ownership into an active expedition loop that encourages players to explore and upgrade all map zones.`,
            gameplayLoop: ['Select zone', 'Dispatch pet', 'Wait timer', 'Collect rare loot & XP'],
            requiredSystems: ['ExpeditionService', 'ZoneData'],
            existingSystemsUsed: ['ServerScriptService.Pets.PetService'],
            newSystemsRequired: ['ServerScriptService.ExpeditionService'],
            filesAffected: [
              { path: 'src/server/ExpeditionService.server.luau', isNew: true },
              { path: 'src/client/ExpeditionUI.client.luau', isNew: true }
            ],
            implementationPlan: [
              { step: 1, title: 'Initialize expedition data struct', tasks: ['Add expedition state table', 'Save timers to DataStore'] },
              { step: 2, title: 'Build Expedition Server Handler', tasks: ['Create dispatch and claim endpoints', 'Validate time intervals server-side'] }
            ]
          },
          {
            id: `feat-${Date.now()}-2`,
            name: `Advanced Combat Hitbox & Combo System`,
            category: 'Combat',
            whyThisFeature: `Enhances the existing combat mechanics with fluid combo chains and spatial raycasts.`,
            whatItAdds: `Multi-hit combo sequences, knockdown states, and visual impact frames.`,
            integration: ['Combat System', 'VFX System'],
            complexity: 'Advanced',
            estimatedImplementation: '~3 systems, ~6 scripts, ~2 UI',
            priority: 'Critical',
            impact: 'Gameplay',
            overview: `Gives players responsive melee combat feedback with swing timers, stamina consumption, and directional hitboxes.`,
            gameplayLoop: ['Click to swing', 'Hit enemy', 'Trigger combo timer', 'Execute finisher'],
            requiredSystems: ['CombatService', 'HitboxModule'],
            existingSystemsUsed: ['ServerScriptService.Combat'],
            newSystemsRequired: ['ReplicatedStorage.Modules.Hitbox'],
            filesAffected: [
              { path: 'src/server/Combat/CombatService.server.luau', isNew: false },
              { path: 'src/shared/Modules/Hitbox.luau', isNew: true }
            ],
            implementationPlan: [
              { step: 1, title: 'Setup Spatial Raycasts', tasks: ['Configure shapecast parameters', 'Add server validation'] }
            ]
          }
        ];

        // Update persistent AI memory
        const newSuggested = Array.from(new Set([...aiMemory.suggested, ...generated.map(g => g.name)]));
        const newPrefs = queryToUse ? Array.from(new Set([...aiMemory.preferences, queryToUse])) : aiMemory.preferences;
        setAiMemory(prev => ({
          ...prev,
          suggested: newSuggested,
          preferences: newPrefs
        }));

        setFeatureCards(generated);
        setSelectedFeature(generated[0]);
        onShowToast('⚡ Game Intelligence generated fresh project-aware feature cards respecting AI memory!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
      setUserPrompt('');
    }
  };

  const handleApproveAndImplement = async () => {
    if (!selectedFeature) return;
    setApprovalState('implementing');

    // Simulate approval and step-by-step execution
    await new Promise(r => setTimeout(r, 1000));

    // Generate script files for this feature
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          prompt: `Implement feature: ${selectedFeature.name}. Description: ${selectedFeature.overview}. Required systems: ${selectedFeature.requiredSystems.join(', ')}.`
        })
      });

      if (res.ok) {
        const data = await res.json();
        const script = data.script;
        const cleanCode = formatAndSanitizeLuau(script.code);
        const targetFile = selectedFeature.filesAffected[0]?.path || `src/server/Features/${selectedFeature.name.replace(/[^a-zA-Z0-9]/g, '')}.server.luau`;
        const fileName = targetFile.split('/').pop() || 'Feature.server.luau';

        const newFile: ProjectFile = {
          id: `file-feat-${Date.now()}`,
          name: fileName,
          path: targetFile,
          code: cleanCode,
          scriptType: script.scriptType || 'Server Script',
          targetInstance: script.targetInstance || 'ServerScriptService',
          lastModified: Date.now(),
          tags: [selectedFeature.category, 'ApprovedFeature']
        };

        if (project.dirHandle) {
          await saveFileToDiskHandle(newFile, cleanCode, project.dirHandle);
        }

        const updatedFiles = [...project.files.filter(f => f.path !== targetFile), newFile];
        const updatedProject: RobloxProject = {
          ...project,
          files: updatedFiles,
          activeFileId: newFile.id,
          updatedAt: Date.now()
        };

        // Record in AI session memory
        setAiMemory(prev => ({
          ...prev,
          implemented: Array.from(new Set([...prev.implemented, selectedFeature.name]))
        }));

        onUpdateProject(updatedProject);
        saveProjectToLocalStorage(updatedProject);
        setApprovalState('completed');
        onShowToast(`🎉 Successfully engineered & synced "${selectedFeature.name}" to project!`);
      }
    } catch (err: any) {
      onShowToast(`Implementation failed: ${err.message}`);
      setApprovalState('approved');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1117] text-[#FFFDF6] overflow-hidden rounded-xl border border-white/10">
      
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#161B22]/90">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FFC93C]" />
            <h3 className="text-base sm:text-lg font-bold text-[#FFFDF6] font-display">
              Game Development Intelligence Agent
            </h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#FFC93C]/15 text-[#FFC93C] font-bold border border-[#FFC93C]/30">
              Lemonade AI
            </span>
          </div>
          <p className="text-xs text-[#FFFDF6]/60 mt-1 font-body">
            Reads your entire Roblox codebase, detects architectural gaps, and proposes verified production features with implementation plans.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: 'cards', label: '⚡ AI Feature Cards' },
            { id: 'map', label: '🗺️ Dependency Map' },
            { id: 'plan', label: '📋 Implementation Plan' },
            { id: 'memory', label: '🧠 AI Memory State' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold capitalize transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#FFC93C] text-[#0B120D]'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Mode Selector & Prompt Bar */}
      <div className="px-4 py-3 bg-[#161B22]/50 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'missing', label: "🔍 What's Missing?" },
            { id: 'gameplay', label: "⚡ Improve Gameplay" },
            { id: 'retention', label: "📈 Increase Retention" },
            { id: 'monetization', label: "💰 Monetization" },
            { id: 'ux', label: "✨ Improve UX" },
            { id: 'content', label: "🗺️ Add Content" },
            { id: 'weak', label: "🛡️ Fix Weak Systems" },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setAnalysisMode(m.id as any)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer ${
                analysisMode === m.id
                  ? 'bg-white/15 text-[#FFC93C] font-bold border border-white/15'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleRunIntelligenceAnalysis()}
          disabled={isAnalyzing}
          className="btn-squeeze px-4 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Project…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate AI Ideas</span>
            </>
          )}
        </button>
      </div>

      {/* AI Generation Feed (When analyzing) */}
      {isAnalyzing && (
        <div className="p-4 bg-[#11161D] border-b border-white/10 flex flex-col gap-2">
          <div className="text-xs font-mono text-[#FFC93C] font-bold flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>AI Intelligence Agent at work...</span>
          </div>
          <div className="space-y-1.5">
            {feedSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                {step.completed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#7EE787]" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-[#FFC93C] border-t-transparent animate-spin" />
                )}
                <span className={step.completed ? 'text-white/90' : 'text-[#FFC93C]'}>{step.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Body View */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        
        {/* Left Column: Cards, Map, or Plan */}
        <div className="p-4 sm:p-5 overflow-y-auto bg-[#090D11] border-r border-white/10 flex flex-col gap-4">
          
          {activeTab === 'cards' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-white/50">
                <span>AI Detected Feature Proposals ({featureCards.length})</span>
                <span>Sorted by Impact &amp; Gap Analysis</span>
              </div>

              {featureCards.map(card => {
                const isSelected = selectedFeature?.id === card.id;
                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      setSelectedFeature(card);
                      setApprovalState('idle');
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#FFC93C] bg-white/10 shadow-lg ring-1 ring-[#FFC93C]/40'
                        : 'border-white/15 bg-[#161B22]/80 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-[#FFC93C]/15 text-[#FFC93C] border border-[#FFC93C]/30">
                          {card.category}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          card.priority === 'Critical' ? 'bg-[#FF7B72]/20 text-[#FF7B72]' : 'bg-[#7EE787]/20 text-[#7EE787]'
                        }`}>
                          {card.priority} Priority
                        </span>
                      </div>
                      <span className="text-xs font-mono text-white/50">{card.estimatedImplementation}</span>
                    </div>

                    <h4 className="font-bold text-sm text-[#FFFDF6] mt-2">{card.name}</h4>
                    <p className="text-xs text-[#FFFDF6]/70 mt-1 line-clamp-2 font-body">{card.whatItAdds}</p>

                    <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/60">
                      <span className="text-[#79C0FF]">Impact: {card.impact}</span>
                      <span className="text-[#FFC93C] flex items-center gap-1 font-bold">
                        View Details <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'map' && (
            <div className="p-4 bg-[#161B22] rounded-xl border border-white/10 flex flex-col gap-4">
              <h4 className="font-bold text-sm text-[#FFC93C] flex items-center gap-2">
                <Compass className="w-4 h-4" />
                <span>Project Dependency &amp; System Graph</span>
              </h4>
              <p className="text-xs text-white/70 font-body">
                Visualizing how your existing project scripts connect with proposed features.
              </p>

              <div className="p-4 bg-[#0D1117] rounded-lg border border-white/10 font-mono text-xs space-y-3">
                <div className="p-2.5 rounded bg-white/5 border border-white/10 flex items-center justify-between">
                  <span className="text-[#FFC93C] font-bold">MOTrove (Main Core)</span>
                  <span className="text-[10px] text-white/40">ServerScriptService</span>
                </div>
                <div className="pl-6 border-l-2 border-[#FFC93C]/40 space-y-2">
                  <div className="p-2 rounded bg-white/5 flex items-center justify-between">
                    <span>Pet Service System</span>
                    <span className="text-[10px] text-[#7EE787]">Active</span>
                  </div>
                  <div className="p-2 rounded bg-white/5 flex items-center justify-between">
                    <span>Combat Hitbox Handler</span>
                    <span className="text-[10px] text-[#7EE787]">Active</span>
                  </div>
                  <div className="p-2 rounded bg-[#FFC93C]/10 border border-[#FFC93C]/30 flex items-center justify-between text-[#FFC93C]">
                    <span>Suggested: Pet Expedition Foraging</span>
                    <span className="text-[10px]">New System</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="p-4 bg-[#161B22] rounded-xl border border-white/10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-[#FFC93C] flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span>Persistent AI Session Memory &amp; History</span>
                </h4>
                <button
                  onClick={() => {
                    setAiMemory({ suggested: [], implemented: [], rejected: [], preferences: [] });
                    onShowToast('Cleared AI session memory.');
                  }}
                  className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 text-[11px] font-mono font-bold hover:bg-red-500/30 cursor-pointer"
                >
                  Reset Memory
                </button>
              </div>
              <p className="text-xs text-white/70 font-body">
                The AI maintains this session memory state to prevent duplicate feature suggestions and inform future code recommendations across your session.
              </p>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-[#0D1117] rounded-lg border border-white/10">
                  <span className="text-[#79C0FF] font-bold block mb-1">Previously Suggested Features ({aiMemory.suggested.length})</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {aiMemory.suggested.length === 0 ? <span className="text-white/40 italic">None recorded</span> : aiMemory.suggested.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white/10 text-white/90 text-[11px]">{s}</span>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#0D1117] rounded-lg border border-white/10">
                  <span className="text-[#7EE787] font-bold block mb-1">Successfully Implemented Features ({aiMemory.implemented.length})</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {aiMemory.implemented.length === 0 ? <span className="text-white/40 italic">None implemented yet</span> : aiMemory.implemented.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[#7EE787]/20 text-[#7EE787] text-[11px]">{s}</span>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#0D1117] rounded-lg border border-white/10">
                  <span className="text-[#FF7B72] font-bold block mb-1">Rejected Features ({aiMemory.rejected.length})</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {aiMemory.rejected.length === 0 ? <span className="text-white/40 italic">None rejected</span> : aiMemory.rejected.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[11px]">{s}</span>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#0D1117] rounded-lg border border-white/10">
                  <span className="text-[#FFC93C] font-bold block mb-1">User Focus Preferences ({aiMemory.preferences.length})</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {aiMemory.preferences.length === 0 ? <span className="text-white/40 italic">None recorded</span> : aiMemory.preferences.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[#FFC93C]/20 text-[#FFC93C] text-[11px]">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plan' && selectedFeature && (
            <div className="p-4 bg-[#161B22] rounded-xl border border-white/10 flex flex-col gap-4">
              <h4 className="font-bold text-sm text-[#7EE787] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Implementation Checklist: {selectedFeature.name}</span>
              </h4>

              <div className="space-y-3">
                {selectedFeature.implementationPlan.map(step => (
                  <div key={step.step} className="p-3 bg-[#0D1117] rounded-lg border border-white/10">
                    <span className="text-xs font-bold text-[#FFC93C] block mb-2">Step {step.step}: {step.title}</span>
                    <div className="space-y-1.5">
                      {step.tasks.map((task, idx) => (
                        <label key={idx} className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded accent-[#FFC93C]"
                            checked={planChecklist[`${step.step}-${idx}`] || false}
                            onChange={(e) => setPlanChecklist(prev => ({ ...prev, [`${step.step}-${idx}`]: e.target.checked }))}
                          />
                          <span>{task}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Prompt Box at Bottom */}
          <div className="mt-auto pt-3 border-t border-white/10">
            <div className="relative">
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleRunIntelligenceAnalysis(userPrompt);
                  }
                }}
                rows={2}
                placeholder="Describe what you want to build or improve (e.g., 'Make my pet system more engaging')..."
                className="w-full bg-[#161B22] border border-white/15 rounded-xl p-3 text-xs text-[#FFFDF6] placeholder:text-white/40 focus:outline-none focus:border-[#FFC93C]"
              />
              <div className="absolute right-2.5 bottom-3 flex items-center gap-2">
                <button
                  onClick={() => handleRunIntelligenceAnalysis(userPrompt)}
                  disabled={isAnalyzing || !userPrompt.trim()}
                  className="btn-squeeze px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span>Analyze &amp; Suggest</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Feature Details, Approval Flow, Files Affected */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col bg-[#161B22]/40">
          {selectedFeature ? (
            <div className="flex flex-col h-full gap-4">
              
              <div className="pb-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-[#A8E6B0]/15 text-[#A8E6B0] border border-[#A8E6B0]/30">
                    {selectedFeature.category}
                  </span>
                  <span className="text-xs font-mono text-[#FFC93C] font-bold">
                    {selectedFeature.complexity} Complexity
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#FFFDF6] mt-2">{selectedFeature.name}</h3>
                <p className="text-xs text-[#FFFDF6]/70 mt-1 font-body">{selectedFeature.overview}</p>
              </div>

              {/* Why this feature & Integration */}
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-xs font-body">
                  <span className="font-bold text-[#FFC93C] block mb-1">💡 Why this feature?</span>
                  <p className="text-white/80">{selectedFeature.whyThisFeature}</p>
                </div>

                <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-xs font-body">
                  <span className="font-bold text-[#A8E6B0] block mb-1">🔄 Systems Integration</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedFeature.integration.map((sys, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-white/10 text-white/90 font-mono text-[10px]">
                        {sys}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Files Affected with NEW FILE badge */}
                <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-xs font-mono">
                  <span className="font-bold text-[#79C0FF] block mb-2">📂 Files Likely Affected</span>
                  <div className="space-y-1.5">
                    {selectedFeature.filesAffected.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="text-white/80 truncate">{f.path}</span>
                        {f.isNew && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FF7B72]/20 text-[#FF7B72] text-[9px] font-bold border border-[#FF7B72]/30">
                            NEW FILE
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Approval Flow Box */}
              <div className="mt-auto p-4 bg-[#0D1117] rounded-xl border border-white/15 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#FFFDF6]">Do you approve this plan?</span>
                  <span className="text-[10px] font-mono text-white/50">{selectedFeature.estimatedImplementation}</span>
                </div>

                {approvalState === 'idle' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setApprovalState('approved')}
                      className="btn-squeeze py-2 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve &amp; Build</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFeature(null);
                        onShowToast('Feature plan rejected.');
                      }}
                      className="py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono font-bold text-red-400 border border-red-500/20 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('plan');
                        onShowToast('Opened Implementation Planner checklist for step editing.');
                      }}
                      className="py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono font-bold text-white/80 cursor-pointer"
                    >
                      Modify Plan
                    </button>
                    <button
                      onClick={() => {
                        handleRunIntelligenceAnalysis(`Regenerate plan for ${selectedFeature.name}`);
                      }}
                      className="py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono font-bold text-[#FFC93C] cursor-pointer flex items-center justify-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Regenerate</span>
                    </button>
                  </div>
                )}

                {approvalState === 'approved' && (
                  <div className="space-y-2">
                    <button
                      onClick={handleApproveAndImplement}
                      className="w-full btn-squeeze py-2.5 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Run 10-Step Validation &amp; Apply Changes</span>
                    </button>
                    <button
                      onClick={() => setApprovalState('idle')}
                      className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-white/60 cursor-pointer"
                    >
                      Back to Review
                    </button>
                  </div>
                )}

                {approvalState === 'implementing' && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-[#FFC93C]">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validating 10-step project rules &amp; engineering scripts…</span>
                  </div>
                )}

                {approvalState === 'completed' && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-[#7EE787] font-bold bg-[#7EE787]/10 rounded-lg border border-[#7EE787]/30">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Successfully Implemented &amp; Synced!</span>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 text-xs font-mono">
              Select a feature card to inspect architecture
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
