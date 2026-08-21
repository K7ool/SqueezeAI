import React, { useState, useEffect, useCallback } from 'react';
import { 
  Gift, Sparkles, Flame, Trophy, Clock, CheckCircle2, Lock, 
  Coins, Diamond, Crown, Zap, AlertCircle, RefreshCw, Copy, Check,
  ChevronRight, Play, Terminal
} from 'lucide-react';
import { DailyRewardsStatusResponse, DailyRewardClaimResult } from '../types/dailyRewards';
import { sound } from '../utils/audio';
import { safeFetchJson } from '../utils/api';
import { LuauCodeViewer } from './LuauCodeViewer';

interface DailyRewardsWorkspaceProps {
  onShowToast: (msg: string) => void;
  onInsertToProject?: (filename: string, code: string) => void;
}

export const DailyRewardsWorkspace: React.FC<DailyRewardsWorkspaceProps> = ({
  onShowToast,
  onInsertToProject,
}) => {
  const [data, setData] = useState<DailyRewardsStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<DailyRewardClaimResult | null>(null);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(0);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [showDevSandbox, setShowDevSandbox] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const fetchStatus = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    const token = localStorage.getItem('squeeze_token') || '';

    try {
      const res = await safeFetchJson('/api/daily-rewards/status', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (res.ok && res.data?.success) {
        setData(res.data);
        setTimeRemainingSec(res.data.timeRemaining || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch rewards:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (timeRemainingSec <= 0) return;
    const interval = setInterval(() => {
      setTimeRemainingSec((prev) => {
        if (prev <= 1) {
          fetchStatus(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemainingSec, fetchStatus]);

  const formatCountdown = (sec: number) => {
    if (sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClaim = async () => {
    if (isClaiming || !data?.eligible) return;
    setIsClaiming(true);
    sound.pop();
    const token = localStorage.getItem('squeeze_token') || '';

    try {
      const res = await safeFetchJson('/api/daily-rewards/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (res.ok && res.data?.success) {
        sound.reward();
        setClaimResult(res.data);
        onShowToast(res.data.message || '🎉 Reward claimed!');
        fetchStatus(true);
      } else {
        sound.error();
        onShowToast(res.data?.error || 'Reward cannot be claimed yet.');
      }
    } catch (err: any) {
      sound.error();
      onShowToast(`Claim failed: ${err.message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleSimulateFastForward = async (hours = 24) => {
    setIsSimulating(true);
    sound.click();
    const token = localStorage.getItem('squeeze_token') || '';

    try {
      const res = await safeFetchJson('/api/daily-rewards/simulate-cooldown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ hours }),
      });

      if (res.ok && res.data?.success) {
        sound.pop();
        onShowToast(`Fast-forwarded by ${hours} hours!`);
        fetchStatus(true);
      }
    } catch (err: any) {
      onShowToast(`Error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetStreak = async () => {
    sound.click();
    const token = localStorage.getItem('squeeze_token') || '';

    try {
      const res = await safeFetchJson('/api/daily-rewards/reset-streak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (res.ok && res.data?.success) {
        sound.pop();
        onShowToast('Streak reset to Day 1.');
        fetchStatus(true);
      }
    } catch (err: any) {
      onShowToast(`Error: ${err.message}`);
    }
  };

  const currentStreak = data?.currentStreak || 0;
  const longestStreak = data?.longestStreak || 0;
  const currentMultiplier = data?.currentMultiplier || 1.0;
  const nextDay = data?.nextDay || 1;
  const isEligible = data?.eligible || false;
  const targetSlot = data?.slots.find((s) => s.day === nextDay) || data?.slots?.[0];

  const luauSnippet = `--!strict
-- [Squeeze Co-Pilot] Server-Authoritative Daily Rewards Service
-- Location: ServerScriptService.Services.DailyRewardService.luau

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")

local DailyRewardStore = DataStoreService:GetDataStore("DailyRewards_v1")

local REWARD_TABLE = {
\t[1] = { Gold = 100, Gems = 10, Multiplier = 1.00, IsVip = false },
\t[2] = { Gold = 150, Gems = 15, Multiplier = 1.25, IsVip = false },
\t[3] = { Gold = 250, Gems = 25, Multiplier = 1.50, IsVip = false },
\t[4] = { Gold = 400, Gems = 40, Multiplier = 1.75, IsVip = false },
\t[5] = { Gold = 600, Gems = 60, Multiplier = 2.00, IsVip = false },
\t[6] = { Gold = 900, Gems = 90, Multiplier = 2.50, IsVip = false },
\t[7] = { Gold = 1500, Gems = 120, Multiplier = 3.00, IsVip = true },
}

local COOLDOWN_SECONDS = 24 * 3600
local GRACE_PERIOD_SECONDS = 48 * 3600

local ClaimRemote = Instance.new("RemoteFunction")
ClaimRemote.Name = "ClaimDailyReward"
ClaimRemote.Parent = ReplicatedStorage

ClaimRemote.OnServerInvoke = function(player: Player)
\tlocal userId = player.UserId
\tlocal now = os.time()
\t
\tlocal key = "Player_" .. userId
\tlocal record = DailyRewardStore:GetAsync(key) or {
\t\tCurrentStreak = 0,
\t\tLongestStreak = 0,
\t\tLastClaimTimestamp = 0,
\t\tTotalClaimCount = 0,
\t}
\t
\tlocal elapsed = now - record.LastClaimTimestamp
\tif record.LastClaimTimestamp > 0 and elapsed < COOLDOWN_SECONDS then
\t\treturn { Success = false, Error = "Reward is on cooldown", TimeRemaining = COOLDOWN_SECONDS - elapsed }
\tend
\t
\t-- Check grace period
\tlocal newStreak = 1
\tif record.LastClaimTimestamp == 0 or elapsed <= GRACE_PERIOD_SECONDS then
\t\tnewStreak = (record.CurrentStreak % 7) + 1
\tend
\t
\tlocal config = REWARD_TABLE[newStreak]
\tlocal finalGold = math.floor(config.Gold * config.Multiplier)
\tlocal finalGems = math.floor(config.Gems * config.Multiplier)
\t
\trecord.CurrentStreak = newStreak
\trecord.LongestStreak = math.max(record.LongestStreak or 0, newStreak)
\trecord.LastClaimTimestamp = now
\trecord.TotalClaimCount = (record.TotalClaimCount or 0) + 1
\t
\tDailyRewardStore:SetAsync(key, record)
\t
\treturn {
\t\tSuccess = true,
\t\tClaimedDay = newStreak,
\t\tGrantedGold = finalGold,
\t\tGrantedGems = finalGems,
\t\tGrantedVIP = config.IsVip,
\t\tMultiplier = config.Multiplier,
\t}
end

print("[DailyRewardService] Server-Authoritative 7-Day Rewards online.")`;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      
      {/* Top Banner Card */}
      <div className="bg-[#161B22] p-5 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFC93C] to-[#F0A500] flex items-center justify-center text-2xl text-[#0B120D] shadow-md shrink-0">
            🎁
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold font-display text-white">
                Server-Authoritative Daily Rewards
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#A8E6B0]/15 text-[#A8E6B0] border border-[#A8E6B0]/30">
                Active Sync
              </span>
            </div>
            <p className="text-xs text-white/60 font-mono mt-0.5">
              7-Day Streak &bull; 48h Grace Window &bull; 3.0x Multiplier Scaling
            </p>
          </div>
        </div>

        {/* Live Stat Badges */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6B4A]/15 border border-[#FF6B4A]/30 text-[#FF6B4A] text-xs font-mono font-bold">
            <Flame className="w-4 h-4 fill-current" />
            <span>Streak: {currentStreak}D</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFC93C]/15 border border-[#FFC93C]/30 text-[#FFC93C] text-xs font-mono font-bold">
            <Zap className="w-4 h-4" />
            <span>x{currentMultiplier.toFixed(2)} Multiplier</span>
          </div>

          <button
            onClick={() => {
              sound.click();
              fetchStatus();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all cursor-pointer"
            title="Refresh state"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 7-Day Responsive Slots Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {data?.slots.map((slot) => {
          const isClaimed = slot.status === 'claimed';
          const isAvailable = slot.status === 'available';
          const isWaiting = slot.status === 'waiting';
          const isLocked = slot.status === 'locked';
          const isDay7 = slot.day === 7;

          return (
            <div
              key={slot.day}
              className={`relative rounded-2xl p-3.5 flex flex-col justify-between transition-all ${
                isDay7
                  ? 'sm:col-span-2 md:col-span-4 lg:col-span-1 bg-gradient-to-b from-[#2A1B45] to-[#150F24] border-2 border-[#A855F7]/50 shadow-md'
                  : isAvailable
                    ? 'bg-gradient-to-b from-[#2B2313] to-[#17140B] border-2 border-[#FFC93C] shadow-lg'
                    : isClaimed
                      ? 'bg-[#121922]/70 border border-white/10 opacity-75'
                      : 'bg-[#151D2A] border border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  isDay7 ? 'bg-[#A855F7]/30 text-[#E9D5FF]' : isAvailable ? 'bg-[#FFC93C] text-[#0B120D]' : 'bg-white/10 text-white/60'
                }`}>
                  DAY {slot.day}
                </span>

                {isClaimed ? (
                  <span className="text-[10px] font-mono font-bold text-[#A8E6B0] flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : isAvailable ? (
                  <span className="text-[10px] font-mono font-bold text-[#FFC93C] animate-pulse">
                    Ready
                  </span>
                ) : (
                  <Lock className="w-3 h-3 text-white/30" />
                )}
              </div>

              <div className="my-2 flex flex-col items-center justify-center text-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-1 ${
                  isDay7 ? 'bg-gradient-to-br from-[#FFD700] to-[#FF8C00]' : isAvailable ? 'bg-[#FFC93C]/20' : 'bg-white/5'
                }`}>
                  {slot.icon}
                </div>
                {isDay7 && (
                  <span className="text-[9px] font-mono font-black text-[#FFD700] uppercase">
                    👑 VIP Perk
                  </span>
                )}
              </div>

              <div className="space-y-1 pt-2 border-t border-white/10 text-center font-mono text-[11px]">
                <div className="font-bold text-[#FFC93C] flex items-center justify-center gap-1">
                  <Coins className="w-3 h-3" /> +{slot.finalGold}
                </div>
                <div className="font-bold text-[#60A5FA] flex items-center justify-center gap-1">
                  <Diamond className="w-3 h-3" /> +{slot.finalGems}
                </div>
                <div className="text-[9px] text-white/40 font-bold">
                  x{slot.multiplier.toFixed(2)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Claim Action Bar */}
      <div className="bg-[#161B22] p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white font-display">
            {isEligible ? `Ready to claim Day ${nextDay} rewards!` : `Day ${nextDay} reward unlocking`}
          </h4>
          <p className="text-xs text-white/60 mt-0.5">
            Claiming gives <strong className="text-[#FFC93C]">+{targetSlot?.finalGold} Coins</strong> and <strong className="text-[#60A5FA]">+{targetSlot?.finalGems} Gems</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isEligible ? (
            <button
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#FFC93C] hover:bg-[#FFD666] text-[#0B120D] font-display font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_3px_0_#D98E04] hover:translate-y-[1px] active:translate-y-[3px] transition-all cursor-pointer"
            >
              {isClaiming ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 fill-current" />}
              <span>CLAIM DAY {nextDay} REWARD</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white/70">
              <Clock className="w-4 h-4 text-[#60A5FA]" />
              <span>Unlocks in {formatCountdown(timeRemainingSec)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Dev Simulation & Luau Companion Code Section */}
      <div className="bg-[#161B22] p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-[#A8E6B0]">
            <Terminal className="w-4 h-4" />
            <span>Roblox Server-Side Luau Implementation</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDevSandbox(!showDevSandbox)}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-mono cursor-pointer"
            >
              <span>{showDevSandbox ? 'Hide Testing Sandbox' : 'Show Testing Sandbox'}</span>
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(luauSnippet);
                setIsCopiedCode(true);
                onShowToast('✓ Luau Service script copied to clipboard!');
                setTimeout(() => setIsCopiedCode(false), 3000);
              }}
              className="px-3 py-1 rounded-lg bg-[#FFC93C]/20 hover:bg-[#FFC93C]/30 text-[#FFC93C] border border-[#FFC93C]/40 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isCopiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Script</span>
            </button>
          </div>
        </div>

        {showDevSandbox && (
          <div className="p-3 bg-[#0D1117] rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-white/60 font-mono">Test cooldown expiry without waiting real 24 hours:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSimulateFastForward(24)}
                disabled={isSimulating}
                className="px-3 py-1 rounded bg-[#FFC93C] text-[#0B120D] font-mono font-bold cursor-pointer hover:bg-[#FFD666]"
              >
                Fast-Forward 24h
              </button>
              <button
                onClick={handleResetStreak}
                className="px-3 py-1 rounded bg-[#FF6B4A] text-white font-mono font-bold cursor-pointer hover:bg-[#ff856b]"
              >
                Reset Streak
              </button>
            </div>
          </div>
        )}

        <LuauCodeViewer
          code={luauSnippet}
          filename="DailyRewardService.server.luau"
          theme="dark"
          maxHeight="260px"
          onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to local project disk!`)}
        />
      </div>

    </div>
  );
};
