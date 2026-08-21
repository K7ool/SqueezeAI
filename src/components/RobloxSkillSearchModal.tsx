import React, { useState, useEffect } from 'react';
import { 
  Search, BookOpen, ExternalLink, Zap, Code2, Sparkles, Check, 
  Layers, Filter, ChevronRight, X, Terminal, Cpu, ShieldCheck
} from 'lucide-react';
import { RobloxSkillCitation } from '../types/project';
import { sound } from '../utils/audio';

interface RobloxSkillSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkillForPrompt: (prompt: string) => void;
  onExecuteSkillAction: (skillTitle: string, userInstruction: string) => void;
}

export const RobloxSkillSearchModal: React.FC<RobloxSkillSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSkillForPrompt,
  onExecuteSkillAction
}) => {
  const [skills, setSkills] = useState<RobloxSkillCitation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSkill, setSelectedSkill] = useState<RobloxSkillCitation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  // Fetch all skills on load
  useEffect(() => {
    if (!isOpen) return;

    const fetchSkills = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/roblox-skills');
        const data = await res.json();
        if (data.skills) {
          setSkills(data.skills);
          if (!selectedSkill && data.skills.length > 0) {
            setSelectedSkill(data.skills[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load Roblox skills:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkills();
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = ['All', 'Services', 'Mechanics', 'Combat', 'Networking', 'Physics', 'Data & Monetization', 'UI & VFX'];

  const filteredSkills = skills.filter(skill => {
    const matchesCat = selectedCategory === 'All' || skill.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCat;

    const haystack = `${skill.title} ${skill.summary} ${skill.keyServices?.join(' ')} ${skill.tags?.join(' ')}`.toLowerCase();
    return matchesCat && haystack.includes(q);
  });

  const handleCopyCode = (code: string, id: string) => {
    sound.success();
    navigator.clipboard.writeText(code);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0D1117] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#FFFDF6]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#161B22] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FFC93C]/15 border border-[#FFC93C]/30 text-[#FFC93C]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-[#FFFDF6] flex items-center gap-2">
                Roblox Skills &amp; Engine Knowledge Hub
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#A8E6B0]/15 text-[#A8E6B0] border border-[#A8E6B0]/30">
                  Creator Hub Grounded
                </span>
              </h2>
              <p className="text-xs text-white/50 font-body">
                Search official Roblox APIs, Luau best practices, and ask Copilot to build any system directly for you.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.click();
              onClose();
            }}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="p-4 border-b border-white/10 bg-[#0D1117] space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Roblox skills (e.g. 'Pathfinding', 'DataStore', 'Raycasting', 'ContextAction', 'TweenService')..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#161B22] border border-white/15 rounded-xl text-xs sm:text-sm text-[#FFFDF6] placeholder:text-white/35 focus:outline-none focus:border-[#FFC93C] transition-all font-body"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs font-mono">
            <span className="text-white/40 text-[11px] flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  sound.pop();
                  setSelectedCategory(cat);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap active:scale-95 transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#FFC93C] text-[#0B120D]'
                    : 'bg-[#161B22] text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Two-Column Explorer Layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          
          {/* Left Column: Skill Results List */}
          <div className="md:col-span-5 border-r border-white/10 overflow-y-auto p-3 space-y-2 max-h-[220px] md:max-h-none bg-[#0D1117]/80">
            {isLoading ? (
              <div className="text-center py-8 text-white/40 text-xs font-mono">
                Loading Roblox Skills Database...
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="text-center py-8 text-white/40 text-xs font-mono space-y-2">
                <p>No matching skills found for "{searchQuery}".</p>
                <button
                  onClick={() => {
                    sound.zap();
                    onSelectSkillForPrompt(`Explain how to implement ${searchQuery} in Roblox Luau`);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#FFC93C]/20 text-[#FFC93C] text-xs font-bold font-mono hover:bg-[#FFC93C]/30 active:scale-95 transition-all cursor-pointer"
                >
                  ⚡ Ask Copilot to Search &amp; Build "{searchQuery}"
                </button>
              </div>
            ) : (
              filteredSkills.map(skill => {
                const isSelected = selectedSkill?.id === skill.id;
                return (
                  <div
                    key={skill.id}
                    onClick={() => {
                      sound.pop();
                      setSelectedSkill(skill);
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white/10 border-[#FFC93C] shadow-sm shadow-[#FFC93C]/10'
                        : 'bg-[#161B22]/70 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                        {skill.category}
                      </span>
                      <span className="text-[10px] font-mono text-[#A8E6B0]">
                        {skill.keyServices?.[0] || 'Engine'}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs sm:text-sm text-[#FFFDF6] font-display line-clamp-1 mb-1">
                      {skill.title}
                    </h4>

                    <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed font-body">
                      {skill.summary}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Skill Detail & Action Execution */}
          <div className="md:col-span-7 overflow-y-auto p-4 sm:p-6 bg-[#161B22]/50 flex flex-col justify-between">
            {selectedSkill ? (
              <div className="space-y-4">
                
                {/* Skill Header */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#FFC93C]/20 text-[#FFC93C] border border-[#FFC93C]/30">
                      {selectedSkill.category}
                    </span>
                    {selectedSkill.keyServices?.map(svc => (
                      <span key={svc} className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/80">
                        {svc}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-base sm:text-xl font-bold font-display text-[#FFFDF6]">
                    {selectedSkill.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-body">
                    {selectedSkill.summary}
                  </p>
                </div>

                {/* Best Practices */}
                {selectedSkill.bestPractices && selectedSkill.bestPractices.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#0D1117] border border-white/10 space-y-1.5">
                    <div className="text-[11px] font-mono font-bold text-[#A8E6B0] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Roblox Engineering Best Practices
                    </div>
                    <ul className="space-y-1 text-xs text-white/70 list-disc list-inside font-body">
                      {selectedSkill.bestPractices.map((bp, i) => (
                        <li key={i} className="leading-relaxed">{bp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Luau Code Recipe Snippet */}
                {selectedSkill.luauSnippet && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono text-white/60">
                      <span className="flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-[#FFC93C]" />
                        Official Pattern Recipe
                      </span>
                      <button
                        onClick={() => handleCopyCode(selectedSkill.luauSnippet!, selectedSkill.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[11px] transition-colors cursor-pointer"
                      >
                        {copiedSnippetId === selectedSkill.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#A8E6B0]" />
                            <span className="text-[#A8E6B0]">Copied</span>
                          </>
                        ) : (
                          'Copy Recipe'
                        )}
                      </button>
                    </div>

                    <pre className="p-3 bg-[#0D1117] border border-white/10 rounded-xl font-mono text-[11px] sm:text-xs text-white/90 overflow-x-auto max-h-[160px] custom-scrollbar leading-relaxed">
                      <code>{selectedSkill.luauSnippet}</code>
                    </pre>
                  </div>
                )}

                {/* External Docs Link */}
                {selectedSkill.apiDocsUrl && (
                  <a
                    href={selectedSkill.apiDocsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#79C0FF] hover:underline font-mono"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>View Roblox Creator Hub Documentation</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-white/40 font-mono text-xs">
                Select a Roblox skill to inspect details and execute actions.
              </div>
            )}

            {/* Bottom Action Buttons: Do It For Me / Ask Copilot */}
            {selectedSkill && (
              <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  onClick={() => {
                    sound.whoosh();
                    onSelectSkillForPrompt(`Explain in detail how to use ${selectedSkill.title} in my Roblox game`);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-bold font-mono transition-all cursor-pointer"
                >
                  💬 Ask Question
                </button>

                <button
                  onClick={() => {
                    sound.zap();
                    onExecuteSkillAction(
                      selectedSkill.title, 
                      `Build and implement the ${selectedSkill.title} system for my game with --!strict typing, complete logic, and write it to my project files.`
                    );
                    onClose();
                  }}
                  className="btn-squeeze px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FFC93C]/20 active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>⚡ Do It For Me (Build System)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

