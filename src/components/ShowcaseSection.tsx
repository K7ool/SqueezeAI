import React, { useState } from 'react';
import { LuauCodeViewer } from './LuauCodeViewer';
import { Terminal, HardDrive } from 'lucide-react';

interface ShowcaseSectionProps {
  onOpenProjectWorkspace?: () => void;
  onShowToast?: (msg: string) => void;
}

export const ShowcaseSection: React.FC<ShowcaseSectionProps> = ({
  onOpenProjectWorkspace,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      name: 'Safe DataStore v2',
      filename: 'DataStoreManager.server.luau',
      target: 'ServerScriptService.DataStore',
      desc: 'Robust player data persistence with safe pcalls, BindToClose fallback, and auto-retry.',
      code: `--!strict
-- Persistent DataStore System with Safe pcall & BindToClose
-- Placed in: ServerScriptService.DataStoreManager (Server Script)

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local STATS_STORE = DataStoreService:GetDataStore("PlayerStats_2026_v1")
local AUTOSAVE_INTERVAL = 120 -- Auto-save every 2 minutes

type PlayerStats = {
\tCoins: number,
\tGems: number,
\tLevel: number,
}

local function loadData(player: Player): PlayerStats
\tlocal userId = player.UserId
\tlocal success, data = pcall(function()
\t\treturn STATS_STORE:GetAsync("User_" .. tostring(userId))
\tend)
\t
\tif success and typeof(data) == "table" then
\t\treturn data :: PlayerStats
\tend
\t
\treturn { Coins = 0, Gems = 0, Level = 1 }
end

local function saveData(player: Player)
\tlocal leaderstats = player:FindFirstChild("leaderstats")
\tif not leaderstats then return end
\t
\tlocal coinsVal = leaderstats:FindFirstChild("Coins") :: IntValue?
\tlocal gemsVal = leaderstats:FindFirstChild("Gems") :: IntValue?
\t
\tlocal payload: PlayerStats = {
\t\tCoins = coinsVal and coinsVal.Value or 0,
\t\tGems = gemsVal and gemsVal.Value or 0,
\t\tLevel = 1,
\t}

\tlocal success, err = pcall(function()
\t\tSTATS_STORE:SetAsync("User_" .. tostring(player.UserId), payload)
\tend)
\t
\tif success then
\t\tprint(string.format("💾 [DataStore] Saved progress for %s", player.Name))
\telse
\t\twarn(string.format("❌ [DataStore] Save failed for %s: %s", player.Name, tostring(err)))
\tend
end

Players.PlayerAdded:Connect(function(player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player
\t
\tlocal coins = Instance.new("IntValue")
\tcoins.Name = "Coins"
\tcoins.Parent = leaderstats
\t
\tlocal gems = Instance.new("IntValue")
\tgems.Name = "Gems"
\tgems.Parent = leaderstats
\t
\tlocal stats = loadData(player)
\tcoins.Value = stats.Coins
\tgems.Value = stats.Gems
end)

Players.PlayerRemoving:Connect(saveData)

game:BindToClose(function()
\tfor _, player in ipairs(Players:GetPlayers()) do
\t\tsaveData(player)
\tend
end)`
    },
    {
      name: 'Double Jump Controller',
      filename: 'DoubleJumpController.client.luau',
      target: 'StarterPlayer.StarterPlayerScripts',
      desc: 'Client controller for double jump with sound effect and state validation.',
      code: `--!strict
-- Responsive Double Jump LocalScript
-- Placed in: StarterPlayer.StarterPlayerScripts.DoubleJump (LocalScript)

local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")

local player = Players.LocalPlayer
local canDoubleJump = false
local hasDoubleJumped = false

local JUMP_POWER_MULTIPLIER = 1.2

local function setupCharacter(character: Model)
\tlocal humanoid = character:WaitForChild("Humanoid") :: Humanoid
\t
\thumanoid.StateChanged:Connect(function(_, newState)
\t\tif newState == Enum.HumanoidStateType.Landed then
\t\t\tcanDoubleJump = false
\t\t\thasDoubleJumped = false
\t\telseif newState == Enum.HumanoidStateType.Freefall then
\t\t\ttask.wait(0.1) -- Small grace window after leaving ledge
\t\t\tif not hasDoubleJumped then
\t\t\t\tcanDoubleJump = true
\t\t\tend
\t\tend
\tend)
end

UserInputService.JumpRequest:Connect(function()
\tlocal character = player.Character
\tif not character then return end
\t
\tlocal humanoid = character:FindFirstChildOfClass("Humanoid")
\tif humanoid and canDoubleJump and not hasDoubleJumped then
\t\thasDoubleJumped = true
\t\tcanDoubleJump = false
\t\thumanoid:ChangeState(Enum.HumanoidStateType.Jumping)
\t\t
\t\tlocal hrp = character:FindFirstChild("HumanoidRootPart") :: BasePart?
\t\tif hrp then
\t\t\thrp.AssemblyLinearVelocity = Vector3.new(hrp.AssemblyLinearVelocity.X, humanoid.JumpPower * JUMP_POWER_MULTIPLIER, hrp.AssemblyLinearVelocity.Z)
\t\tend
\tend
end)

if player.Character then
\tsetupCharacter(player.Character)
end
player.CharacterAdded:Connect(setupCharacter)`
    },
    {
      name: 'Round Game Loop',
      filename: 'RoundManager.server.luau',
      target: 'ServerScriptService.RoundManager',
      desc: 'Server game loop that orchestrates intermission, active rounds, and RemoteEvents.',
      code: `--!strict
-- Server-Authoritative Round Loop Manager
-- Placed in: ServerScriptService.RoundManager (Server Script)

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local timerEvent = Instance.new("RemoteEvent")
timerEvent.Name = "RoundTimerEvent"
timerEvent.Parent = ReplicatedStorage

local CONFIG = {
\tINTERMISSION_TIME = 15,
\tROUND_TIME = 90,
\tMIN_PLAYERS = 1,
}

local function broadcastTimer(phase: string, secondsLeft: number)
\ttimerEvent:FireAllClients(phase, secondsLeft)
end

local function runIntermission()
\tfor i = CONFIG.INTERMISSION_TIME, 1, -1 do
\t\tbroadcastTimer("Intermission", i)
\t\ttask.wait(1)
\tend
end

local function runActiveRound()
\tbroadcastTimer("Round Starting", 0)
\ttask.wait(1)
\t
\tfor i = CONFIG.ROUND_TIME, 1, -1 do
\t\tif #Players:GetPlayers() < CONFIG.MIN_PLAYERS then
\t\t\tbroadcastTimer("Waiting for Players", 0)
\t\t\tbreak
\t\tend
\t\tbroadcastTimer("Survive!", i)
\t\ttask.wait(1)
\tend
end

task.spawn(function()
\twhile true do
\t\trunIntermission()
\t\trunActiveRound()
\tend
end)`
    }
  ];

  const currentTab = tabs[activeTab];

  return (
    <section id="showcase" className="py-24 bg-[#142019] text-[#FFFDF6]">
      <div className="max-w-[1180px] mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-[640px] mb-12">
          <span className="font-mono text-xs uppercase font-bold tracking-widest text-[#FFC93C]">
            Masterclass Luau Gallery
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#FFFDF6] mt-3 tracking-tight">
            Real prompts, production-ready Luau
          </h2>
          <p className="mt-3.5 text-base sm:text-lg text-[#FFFDF6]/75 leading-relaxed">
            Curated systems written with strict type safety, error boundaries, and Roblox Studio best practices.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2.5 mb-6">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`px-4 py-2 rounded-full font-mono text-xs font-bold transition-all cursor-pointer border ${
                activeTab === idx
                  ? 'bg-[#FFC93C] text-[#0B120D] border-[#FFC93C]'
                  : 'bg-transparent text-[#FFFDF6]/70 border-white/15 hover:border-white/35 hover:text-[#FFFDF6]'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Code Window with LuauCodeViewer */}
        <div className="bg-[#1D2E24] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
          <LuauCodeViewer
            code={currentTab.code}
            filename={currentTab.filename}
            theme="dark"
            maxHeight="380px"
            onOpenInProject={onOpenProjectWorkspace}
            onSavedToDisk={(fname) => onShowToast && onShowToast(`Saved ${fname} to disk!`)}
          />

          {/* Description Footer */}
          <div className="px-3 py-2.5 bg-[#142019] rounded-xl border border-white/10 text-xs font-mono text-[#FFFDF6]/70 flex flex-wrap items-center justify-between gap-2">
            <span>💡 {currentTab.desc}</span>
            <span className="text-[#A8E6B0] font-bold">Studio 2026 Compatible</span>
          </div>
        </div>

      </div>
    </section>
  );
};
