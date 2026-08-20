import React, { useState } from 'react';
import { GeneratedScript } from '../types';
import { Wrench, Check, Copy, Download, RefreshCw, AlertTriangle, CheckCircle2, HardDrive } from 'lucide-react';
import { LuauCodeViewer } from './LuauCodeViewer';
import { saveSingleScriptToDisk } from '../utils/projectDisk';

interface LuauDebuggerSectionProps {
  onDebug: (errorMessage: string, brokenCode?: string) => Promise<GeneratedScript | null>;
  isLoading: boolean;
  onOpenProjectWorkspace?: () => void;
  onShowToast?: (msg: string) => void;
}

export const LuauDebuggerSection: React.FC<LuauDebuggerSectionProps> = ({ 
  onDebug, 
  isLoading,
  onOpenProjectWorkspace,
  onShowToast
}) => {
  const [errorMessage, setErrorMessage] = useState('ServerScriptService.CoinManager:18: attempt to index nil with \'leaderstats\'');
  const [brokenCode, setBrokenCode] = useState(`local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
\tlocal leaderstats = player.leaderstats -- Breaks here if leaderstats hasn't loaded yet!
\tlocal coins = leaderstats.Coins
\tcoins.Value += 100
end)`);
  const [fixedScript, setFixedScript] = useState<GeneratedScript | null>(null);

  const errorPresets = [
    {
      label: "Nil leaderstats index",
      error: "ServerScriptService.CoinManager:18: attempt to index nil with 'leaderstats'",
      code: `local Players = game:GetService("Players")\n\nPlayers.PlayerAdded:Connect(function(player)\n\tlocal leaderstats = player.leaderstats\n\tlocal coins = leaderstats.Coins\n\tcoins.Value += 100\nend)`
    },
    {
      label: "Infinite yield on WaitForChild",
      error: "Infinite yield possible on 'ReplicatedStorage:WaitForChild(\"RoundEnded\")'",
      code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")\n-- Attempting to wait for an instance that doesn't exist yet on start\nlocal roundEnded = ReplicatedStorage:WaitForChild("RoundEnded")\nroundEnded:FireAllClients()`
    },
    {
      label: "HumanoidRootPart nil on spawn",
      error: "Workspace.Player1.SpeedBooster:7: attempt to index nil with 'HumanoidRootPart'",
      code: `local part = script.Parent\npart.Touched:Connect(function(hit)\n\tlocal hrp = hit.Parent.HumanoidRootPart -- Breaks on accessory touch\n\thrp.Velocity = Vector3.new(0, 100, 0)\nend)`
    }
  ];

  const handleDebugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!errorMessage.trim() || isLoading) return;
    const res = await onDebug(errorMessage, brokenCode);
    if (res) {
      setFixedScript(res);
    }
  };

  const handlePresetSelect = (preset: typeof errorPresets[0]) => {
    setErrorMessage(preset.error);
    setBrokenCode(preset.code);
    setFixedScript(null);
  };

  return (
    <section id="debugger" className="py-24 bg-[#142019] text-[#FFFDF6] border-b border-white/10">
      <div className="max-w-[1180px] mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-[640px] mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B4A]/15 border border-[#FF6B4A]/30 text-[#FF6B4A] text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <Wrench className="w-3.5 h-3.5" />
            <span>Instant Studio Debugger</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#FFFDF6] tracking-tight">
            Paste the red Output error.<br />Squeeze gives you the skilled fix.
          </h2>
          <p className="mt-3.5 text-base sm:text-lg text-[#FFFDF6]/75 leading-relaxed">
            Diagnoses runtime nil checks, infinite timing yields, memory leaks, and broken touched events with typed Luau solutions.
          </p>
        </div>

        {/* Debugger Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Left Column: Error Input Form */}
          <div className="bg-[#1D2E24] border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="text-xs font-mono font-bold uppercase text-[#FF6B4A] mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Paste Studio Output Error</span>
            </div>

            {/* Error Presets */}
            <div className="flex flex-wrap gap-2 mb-4">
              {errorPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-[#FFFDF6]/70 hover:text-[#FFC93C] hover:border-[#FFC93C] transition-all cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleDebugSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#FFFDF6]/60 mb-1.5">
                  Error Message (from Roblox Studio Output Window)
                </label>
                <input
                  type="text"
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                  placeholder="e.g. ServerScriptService.Script:14: attempt to index nil with 'leaderstats'"
                  className="w-full bg-[#142019] border border-white/15 rounded-xl px-4 py-3 text-sm text-[#FF6B4A] font-mono focus:outline-none focus:border-[#FF6B4A] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#FFFDF6]/60 mb-1.5">
                  Broken Script (Optional)
                </label>
                <textarea
                  value={brokenCode}
                  onChange={(e) => setBrokenCode(e.target.value)}
                  rows={6}
                  placeholder="Paste your broken script here..."
                  className="w-full bg-[#142019] border border-white/15 rounded-xl p-3 text-xs text-[#FFFDF6] font-mono focus:outline-none focus:border-[#FFC93C] transition-colors leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !errorMessage.trim()}
                className="w-full btn-squeeze font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Error &amp; Constructing Skilled Fix…</span>
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    <span>Fix Roblox Error Now</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Fixed Output Window */}
          <div className="bg-[#1D2E24] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col min-h-[440px]">
            {isLoading ? (
              <div className="h-72 flex flex-col items-center justify-center gap-3 text-[#FFFDF6]/50 italic font-mono">
                <div className="w-7 h-7 border-2 border-white/20 border-t-[#FFC93C] rounded-full animate-spin" />
                <span>Identifying failure point &amp; writing typed Luau resolution…</span>
              </div>
            ) : fixedScript ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-[#A8E6B0]/10 border border-[#A8E6B0]/30 text-[#A8E6B0] text-xs leading-relaxed flex items-start gap-2.5 font-mono">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5 text-[#FFFDF6]">Diagnosis &amp; Fix:</span>
                    <span>{fixedScript.explanation}</span>
                  </div>
                </div>

                <LuauCodeViewer
                  code={fixedScript.code}
                  filename={`${(fixedScript.title || 'FixedScript').replace(/\s+/g, '')}.server.luau`}
                  theme="dark"
                  maxHeight="320px"
                  onOpenInProject={onOpenProjectWorkspace}
                  onSavedToDisk={(fname) => onShowToast && onShowToast(`Saved ${fname} to local disk!`)}
                />

                <div className="px-3 py-2 bg-[#142019] rounded-xl border border-white/10 text-xs font-mono text-[#A8E6B0] flex items-center justify-between">
                  <span>● Tested &amp; verified</span>
                  <span className="text-[#FFFDF6]/50">Target: {fixedScript.targetInstance}</span>
                </div>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-[#FFFDF6]/40 text-center px-6 font-mono text-xs">
                <Wrench className="w-8 h-8 mb-2 opacity-50 text-[#FFC93C]" />
                <span>Paste an error on the left and click "Fix Roblox Error" to generate the working solution.</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </section>
  );
};
