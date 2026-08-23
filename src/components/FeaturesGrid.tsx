import React from 'react';
import { Code2, FolderTree, Layout, Wrench, Database, Users } from 'lucide-react';

interface FeaturesGridProps {
  onScrollToTry: () => void;
  onScrollToDebugger: () => void;
}

export const FeaturesGrid: React.FC<FeaturesGridProps> = ({ onScrollToTry, onScrollToDebugger }) => {
  const features = [
    {
      icon: Code2,
      title: 'Script generation',
      description: 'Movement, combat, shops, quests, inventories — described in plain English, returned as clean, commented Luau.',
      actionText: 'Try generator above ↑',
      onClick: onScrollToTry
    },
    {
      icon: FolderTree,
      title: 'Hierarchy-aware edits',
      description: 'Squeeze accounts for your Explorer tree, referencing existing parts, RemoteEvents, and Folders instead of hallucinating paths.',
      badge: 'Explorer Safe'
    },
    {
      icon: Layout,
      title: 'UI from a sketch',
      description: 'Describe a shop menu, inventory HUD, or round status bar and get a working ScreenGui with responsive layout and tweens.',
      badge: 'ScreenGui Ready'
    },
    {
      icon: Wrench,
      title: 'Debug on sight',
      description: 'Paste any red Output error text and Squeeze identifies the broken line, explains the root cause, and rewrites the fix.',
      actionText: 'Try Live Debugger ↓',
      onClick: onScrollToDebugger,
      highlight: true
    },
    {
      icon: Database,
      title: 'DataStore, done safely',
      description: 'Player saving with retries, pcall exception wrapping, and BindToClose handlers built in by default — no lost stats.',
      badge: 'DataStoreService'
    },
    {
      icon: Users,
      title: 'Team-ready & Studio Sync',
      description: 'Share a synchronized script history with your co-builders so everyone is aligned on what Squeeze generated.',
      badge: 'Multiplayer Dev'
    }
  ];

  return (
    <section id="features" className="py-24 bg-[#FFF8E7] border-t border-b border-[#0B120D]/10">
      <div className="max-w-[1180px] mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-[640px] mb-14">
          <span className="font-mono text-xs uppercase font-bold tracking-widest text-[#FF6B4A]">
            What's in the cup
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B120D] mt-3 tracking-tight">
            Built for the way Roblox games actually get made
          </h2>
          <p className="mt-3.5 text-base sm:text-lg text-[#0B120D]/65 leading-relaxed">
            Not a general chatbot with a Roblox skin — Squeeze is specialized in Luau syntax, DataStoreService limitations, and Studio execution contexts.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className={`p-7 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                  feat.highlight
                    ? 'bg-[#FFFDF6] border-[#FF6B4A]/40 shadow-[0_10px_30px_rgba(255,107,74,0.08)]'
                    : 'bg-[#FFFDF6] border-[#0B120D]/10 hover:shadow-lg hover:-translate-y-1'
                }`}
              >
                <div>
                  {/* Icon Box */}
                  <div className="w-12 h-12 rounded-xl bg-[#0B120D] text-[#FFC93C] flex items-center justify-center mb-5 shadow-sm">
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[#0B120D]">{feat.title}</h3>
                    {feat.badge && (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wide bg-[#FFF8E7] text-[#5C4A12] px-2 py-0.5 rounded border border-[#F0A500]/20">
                        {feat.badge}
                      </span>
                    )}
                  </div>

                  <p className="mt-2.5 text-sm text-[#0B120D]/70 leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                {feat.actionText && (
                  <div className="mt-5 pt-3 border-t border-[#0B120D]/10">
                    <button
                      onClick={feat.onClick}
                      className="text-xs font-mono font-bold text-[#FF6B4A] hover:text-[#E85C4A] flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                    >
                      {feat.actionText}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
