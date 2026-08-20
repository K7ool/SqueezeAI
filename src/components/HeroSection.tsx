import React, { useState } from 'react';
import { 
  Sparkles, RefreshCw, HardDrive, Download, Copy, Check, 
  MessageSquare, Lightbulb, Folder, ChevronRight, Terminal, Zap, Play, ArrowRight 
} from 'lucide-react';
import { LuauCodeViewer } from './LuauCodeViewer';
import { saveSingleScriptToDisk } from '../utils/projectDisk';
import { formatAndSanitizeLuau } from '../utils/luauFormatter';

interface CurrentScriptData {
  title?: string;
  code: string;
  scriptType?: string;
  targetInstance?: string;
  explanation?: string;
  tags?: string[];
  lineCount?: number;
  prompt?: string;
}

interface HeroSectionProps {
  currentScript: CurrentScriptData | null;
  isLoading: boolean;
  onOpenDashboard: (tab?: 'chat' | 'ideas' | 'files' | 'generator') => void;
  onShowToast: (msg: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  currentScript,
  isLoading,
  onOpenDashboard,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);

  const sampleIdeaChain = [
    { name: 'TreasureChest', type: 'ServerScript', color: 'text-[#79C0FF]' },
    { name: 'Rare Items', type: 'DropTable Module', color: 'text-[#FFC93C]' },
    { name: 'VFX open for Chest', type: 'LocalScript Tween', color: 'text-[#D2A8FF]' },
  ];

  const defaultDemoCode = `--!strict
-- Roblox Studio Server Script: Treasure Chest Spawner
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local ServerStorage = game:GetService("ServerStorage")

local CHEST_COOLDOWN = 15
local playerCooldowns: { [Player]: number } = {}

local function onChestInteracted(player: Player, chestModel: Model)
    local now = os.time()
    local lastOpened = playerCooldowns[player] or 0
    if (now - lastOpened) < CHEST_COOLDOWN then
        warn("[Chest] Cooldown active for", player.Name)
        return
    end
    playerCooldowns[player] = now

    -- Trigger VFX Event to all clients
    local vfxEvent = ReplicatedStorage:FindFirstChild("ChestOpenVFX") :: RemoteEvent?
    if vfxEvent then
        vfxEvent:FireAllClients(chestModel.PrimaryPart.Position)
    end
    print("✨ [Chest Opened] Rewarded player:", player.Name)
end

print("⚡ [Squeeze AI] Treasure Chest System Active")`;

  const displayCode = currentScript?.code ? formatAndSanitizeLuau(currentScript.code) : defaultDemoCode;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast('Copied Luau script to clipboard!');
  };

  const handleDownloadLua = async () => {
    const filename = `${(currentScript?.title || 'TreasureChest').replace(/\s+/g, '_')}.server.luau`;
    const res = await saveSingleScriptToDisk(filename, displayCode);
    if (res.success) {
      onShowToast(`Saved ${res.filename} to local disk!`);
    }
  };

  return (
    <section className="relative bg-[#142019] text-[#FFFDF6] pt-14 pb-20 overflow-hidden" id="try-it">
      {/* Subtle Grid Pattern Background */}
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 85%)'
        }}
      />

      <div className="relative max-w-[1240px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        
        {/* Left Column: Studio Headline & Direct Studio Entry Actions */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#A8E6B0]/15 border border-[#A8E6B0]/30 text-[#A8E6B0] text-xs font-mono font-bold uppercase tracking-wider mb-5">
            <span className="w-2 h-2 rounded-full bg-[#A8E6B0] animate-pulse"></span>
            Studio Dashboard 2.0 &middot; Luau Co-pilot
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-5 font-display text-balance">
            Fresh Luau Scripts, Project Folder Sync &amp; Interactive Idea Maps.
          </h1>

          <p className="text-base text-[#FFFDF6]/80 leading-relaxed mb-6 font-body text-pretty max-w-xl">
            Connect your local Roblox project folder. Ask your AI co-pilot to build admin commands or read your codebase to map out interconnected mechanics:
          </p>

          {/* Interactive Idea Map Flow Preview Bar */}
          <div 
            onClick={() => onOpenDashboard('ideas')}
            className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#FFC93C]/60 transition-all cursor-pointer mb-6 group"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-white/50 mb-2">
              <span className="flex items-center gap-1 text-[#FFC93C] font-bold">
                <Lightbulb className="w-3.5 h-3.5" />
                Idea Progression Chain
              </span>
              <span className="group-hover:text-white flex items-center gap-1 transition-colors">
                Launch Map <ChevronRight className="w-3 h-3" />
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              {sampleIdeaChain.map((node, i) => (
                <React.Fragment key={node.name}>
                  <div className="px-2.5 py-1 rounded-lg bg-[#161B22] border border-white/15 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFC93C]" />
                    <span className={`font-bold ${node.color}`}>{node.name}</span>
                  </div>
                  {i < sampleIdeaChain.length - 1 && (
                    <span className="text-[#FFC93C]/60 font-bold">--- &gt;</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Main Launch Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onOpenDashboard('chat')}
              className="btn-squeeze px-5 py-3.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#FFC93C]/10 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open AI Chat &amp; Co-Pilot</span>
            </button>

            <button
              onClick={() => onOpenDashboard('files')}
              className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold flex items-center gap-2 border border-white/15 transition-all cursor-pointer"
            >
              <Folder className="w-4 h-4 text-[#FFC93C]" />
              <span>Open Project Folder</span>
            </button>

            <button
              onClick={() => onOpenDashboard('ideas')}
              className="px-4 py-3.5 rounded-xl bg-[#161B22] hover:bg-white/10 text-white/90 font-mono text-xs font-bold flex items-center gap-2 border border-white/15 transition-all cursor-pointer"
            >
              <Lightbulb className="w-4 h-4 text-[#A8E6B0]" />
              <span>Idea Flow Map</span>
            </button>
          </div>

          {/* Highlights Checklist */}
          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono text-[#FFFDF6]/70">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#A8E6B0]" />
              <span>Reads Local Project Files</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#A8E6B0]" />
              <span>Strict Type-Checking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#A8E6B0]" />
              <span>Native Disk File Sync</span>
            </div>
          </div>
        </div>

        {/* Right Column: Code Receipt Preview & Quick Actions */}
        <div className="bg-[#0D1117] rounded-2xl border border-white/15 shadow-2xl overflow-hidden flex flex-col">
          
          {/* Header Strip */}
          <div className="px-4 py-3 bg-[#161B22] border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF7B72]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFC93C]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#7EE787]" />
              <span className="text-xs font-mono text-white/60 ml-2">
                {currentScript?.title || 'TreasureChest.server.luau'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyCode}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white/80 transition-all cursor-pointer"
                title="Copy Script"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#A8E6B0]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={handleDownloadLua}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white/80 transition-all cursor-pointer"
                title="Save to Disk"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onOpenDashboard('generator')}
                className="px-2.5 py-1 rounded-lg bg-[#FFC93C] text-[#0B120D] font-mono text-xs font-bold hover:bg-[#ffe082] transition-all cursor-pointer"
              >
                Open Studio
              </button>
            </div>
          </div>

          {/* Luau Code Viewer */}
          <div className="p-2">
            <LuauCodeViewer
              code={displayCode}
              filename="TreasureChest.server.luau"
              theme="dark"
              maxHeight="420px"
              onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to disk!`)}
            />
          </div>
        </div>

      </div>
    </section>
  );
};
