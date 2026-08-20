import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, ShieldCheck, Terminal, Download } from 'lucide-react';

interface RobloxStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RobloxStudioModal: React.FC<RobloxStudioModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const injectorCode = `-- Squeeze Roblox Studio Live Injector
-- Paste this ModuleScript into ServerScriptService -> SqueezeSync

local HttpService = game:GetService("HttpService")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterPlayer = game:GetService("StarterPlayer")

local SqueezeModule = {}
local API_ENDPOINT = "https://squeeze.gg/api"
local API_TOKEN = "sqz_live_YOUR_TOKEN_HERE" -- Replace with your token from Squeeze Dashboard

function SqueezeModule.SyncScript(scriptPayload)
    local targetService = ServerScriptService
    if scriptPayload.scriptType == "LocalScript" then
        targetService = StarterPlayer.StarterPlayerScripts
    elseif scriptPayload.scriptType == "ModuleScript" then
        targetService = ReplicatedStorage
    end

    local newScript = Instance.new(scriptPayload.scriptType == "LocalScript" and "LocalScript" or "Script")
    newScript.Name = scriptPayload.title or "SqueezeGenerated"
    newScript.Source = scriptPayload.code
    newScript.Parent = targetService
    print("[Squeeze] Inserted " .. newScript.Name .. " into " .. targetService.Name)
end

return SqueezeModule`;

  const handleCopy = () => {
    navigator.clipboard.writeText(injectorCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#FFFDF6] text-[#0B120D] w-full max-w-2xl rounded-3xl border border-[#0B120D]/15 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-5 bg-[#142019] text-[#FFFDF6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#FFC93C] text-[#0B120D] flex items-center justify-center font-bold text-base shadow-sm">
              🍋
            </span>
            <div>
              <h3 className="font-display font-bold text-lg leading-tight">Roblox Studio Setup Guide</h3>
              <p className="text-xs text-[#FFFDF6]/60 font-mono">How Squeeze integrates with Studio</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#FFFDF6]/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm leading-relaxed">
          
          {/* Important Transparency Notice */}
          <div className="p-4 rounded-2xl bg-[#FFF8E7] border border-[#F0A500]/30 text-xs">
            <div className="font-bold text-[#5C4A12] flex items-center gap-1.5 mb-1 text-sm font-display">
              <ShieldCheck className="w-4 h-4 text-[#F0A500]" />
              <span>Studio Architecture &amp; Integration Notice</span>
            </div>
            <p className="text-[#5C4A12]/90">
              Roblox Studio plugins run as isolated Luau environments directly on your computer inside Roblox Studio. You can install the companion plugin from the Creator Marketplace, or use the copyable Luau module below to sync generated scripts straight into your Explorer tree via <code className="bg-white/70 px-1 py-0.5 rounded font-mono">HttpService</code>.
            </p>
          </div>

          {/* Installation Methods */}
          <div className="space-y-4">
            <h4 className="font-display font-bold text-base text-[#0B120D]">Choose your preferred setup method:</h4>

            {/* Method A */}
            <div className="p-4 rounded-2xl border border-[#0B120D]/10 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#FF6B4A] uppercase">Method A (Recommended)</span>
                <span className="text-[10px] font-mono bg-[#A8E6B0]/20 text-[#2A6B47] px-2 py-0.5 rounded font-bold">1-Click</span>
              </div>
              <h5 className="font-bold text-sm text-[#0B120D]">Install from Roblox Creator Marketplace</h5>
              <p className="text-xs text-[#0B120D]/70">
                Search <strong className="text-[#0B120D]">"Squeeze Luau Assistant"</strong> in Roblox Studio's Plugins Marketplace tab. Click <strong>Install</strong> to add the Squeeze toolbar icon to your Studio window.
              </p>
              <div className="pt-2">
                <a
                  href="https://create.roblox.com/store/plugins"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#0B120D] hover:text-[#FF6B4A]"
                >
                  <span>Open Roblox Creator Marketplace</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Method B */}
            <div className="p-4 rounded-2xl border border-[#0B120D]/10 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#FF6B4A] uppercase">Method B (Direct Module)</span>
                <span className="text-[10px] font-mono bg-[#FFC93C]/20 text-[#0B120D] px-2 py-0.5 rounded font-bold">Custom Place</span>
              </div>
              <h5 className="font-bold text-sm text-[#0B120D]">Paste the Squeeze Luau Sync Module</h5>
              <p className="text-xs text-[#0B120D]/70">
                1. Enable <strong>"Allow HTTP Requests"</strong> in Game Settings &gt; Security.<br />
                2. Insert a new <strong>ModuleScript</strong> into <code className="bg-[#FFF8E7] px-1 py-0.5 rounded font-mono">ServerScriptService</code> named <strong>SqueezeSync</strong>.<br />
                3. Paste the code below and insert your Squeeze Dashboard API Token.
              </p>

              {/* Code Box */}
              <div className="relative bg-[#142019] text-[#FFFDF6] rounded-xl p-3.5 font-mono text-xs overflow-x-auto">
                <button
                  onClick={handleCopy}
                  className="absolute top-2.5 right-2.5 px-2 py-1 bg-white/10 hover:bg-[#FFC93C] hover:text-[#0B120D] text-[#FFFDF6] rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-[#A8E6B0]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <pre className="m-0 text-[11px] text-[#E7F5E5] leading-relaxed">
                  {injectorCode}
                </pre>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FFF8E7] border-t border-[#0B120D]/10 flex items-center justify-between text-xs font-mono">
          <span className="text-[#0B120D]/60">Squeeze Studio SDK v1.4</span>
          <button
            onClick={onClose}
            className="btn-squeeze font-bold text-xs px-5 py-2 rounded-full cursor-pointer"
          >
            Got it, thanks
          </button>
        </div>

      </div>
    </div>
  );
};
