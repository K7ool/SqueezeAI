import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, Sparkles, Flame, Trophy, Clock, CheckCircle2, Lock, Gift, 
  Coins, Diamond, Crown, Zap, AlertCircle, RefreshCw, Copy, Check,
  ChevronRight, Award, ShieldCheck, Play, ArrowUpRight
} from 'lucide-react';
import { 
  DailyRewardSlot, 
  DailyRewardsStatusResponse, 
  DailyRewardClaimResult 
} from '../types/dailyRewards';
import { sound } from '../utils/audio';
import { safeFetchJson } from '../utils/api';

interface DailyRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
  onInsertScriptToProject?: (name: string, code: string) => void;
}

export const DailyRewardsModal: React.FC<DailyRewardsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onInsertScriptToProject,
}) => {
  const [data, setData] = useState<DailyRewardsStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<DailyRewardClaimResult | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(0);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [showDevControls, setShowDevControls] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);

  // Fetch Server-Authoritative Daily Rewards Status
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
      } else {
        onShowToast(res.data?.error || 'Could not fetch daily rewards status.');
      }
    } catch (err: any) {
      console.error('Error fetching daily rewards:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  // Real-time Countdown Timer Loop
  useEffect(() => {
    if (!isOpen || timeRemainingSec <= 0) return;

    const interval = setInterval(() => {
      setTimeRemainingSec((prev) => {
        if (prev <= 1) {
          // Timer finished, refresh server status automatically to unlock claim button
          fetchStatus(true);
          sound.reward();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, timeRemainingSec, fetchStatus]);

  // Format HH:MM:SS
  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Claim Daily Reward (Server-Authoritative POST)
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
        setShowCelebration(true);
        onShowToast(res.data.message || '🎉 Daily Reward Claimed!');
        
        // Refresh local data state from server response
        fetchStatus(true);
      } else {
        sound.error();
        onShowToast(res.data?.error || 'Reward is not ready to claim yet.');
      }
    } catch (err: any) {
      sound.error();
      onShowToast(`Claim failed: ${err.message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  // Fast-Forward Cooldown for Live Testing/Simulation
  const handleFastForward = async (hours: number = 24) => {
    setIsFastForwarding(true);
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
        onShowToast(`⚡ Cooldown fast-forwarded by ${hours} hours!`);
        fetchStatus(true);
      }
    } catch (err: any) {
      onShowToast(`Simulation failed: ${err.message}`);
    } finally {
      setIsFastForwarding(false);
    }
  };

  // Reset Streak for Testing
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
      onShowToast(`Reset failed: ${err.message}`);
    }
  };

  // Copy Luau Integration Code
  const handleCopyLuau = () => {
    sound.success();
    const luauSnippet = `--!strict
-- [Squeeze Co-Pilot] Client-Side Daily Reward Claim Remote Caller
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local ClaimDailyRewardRemote = ReplicatedStorage:WaitForChild("ClaimDailyReward") :: RemoteFunction
local localPlayer = Players.LocalPlayer

local function requestDailyClaim()
\tlocal success, result = pcall(function()
\t\treturn ClaimDailyRewardRemote:InvokeServer()
\tend)
\t
\tif success and result and result.Success then
\t\tprint(string.format("🎁 [DailyReward] Claimed Day %d! +%d Coins, +%d Gems", result.ClaimedDay, result.GrantedGold, result.GrantedGems))
\telse
\t\twarn("[DailyReward] Claim rejected or on cooldown:", result and result.Error or "Unknown error")
\tend
end

return { RequestClaim = requestDailyClaim }`;

    navigator.clipboard.writeText(luauSnippet);
    setIsCopiedCode(true);
    onShowToast('✓ Luau Remote Client snippet copied!');
    setTimeout(() => setIsCopiedCode(false), 3000);
  };

  if (!isOpen) return null;

  const currentStreak = data?.currentStreak || 0;
  const longestStreak = data?.longestStreak || 0;
  const currentMultiplier = data?.currentMultiplier || 1.0;
  const nextDay = data?.nextDay || 1;
  const isEligible = data?.eligible || false;
  const coinsBalance = data?.userBalances?.coins ?? 0;
  const gemsBalance = data?.userBalances?.gems ?? 0;

  // Next slot details for claim banner
  const currentTargetSlot = data?.slots.find((s) => s.day === nextDay) || data?.slots[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#0B120D]/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn">
      
      {/* Modal Card */}
      <div 
        id="daily-rewards-modal-container"
        className="relative w-full max-w-5xl bg-[#121820] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-[#FFFDF6] my-auto"
      >
        
        {/* Glow ambient background orbs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#FFC93C]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#A8E6B0]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 bg-[#9D4EDD]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Bar */}
        <div className="relative px-6 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-[#161F2C]/80 backdrop-blur-md">
          
          {/* Left Title & Badge */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FFC93C] to-[#F0A500] flex items-center justify-center text-[#0B120D] text-xl shadow-[0_4px_12px_rgba(255,201,60,0.35)] shrink-0 animate-pulse">
              🎁
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
                  Daily Login Rewards
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-[#FFC93C]/15 text-[#FFC93C] border border-[#FFC93C]/30">
                  7-Day Cycle
                </span>
              </div>
              <p className="text-xs text-white/60 font-sans mt-0.5">
                Log in every 24 hours to scale your streak multiplier up to <strong className="text-[#FFC93C]">3.0x bonus</strong> and unlock the Day 7 VIP Crown!
              </p>
            </div>
          </div>

          {/* Right Wallet & Actions */}
          <div className="flex items-center gap-3">
            {/* Live Wallet Balance Chips */}
            <div className="flex items-center gap-2 bg-[#0B0F15]/90 border border-white/10 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold shadow-inner">
              <div className="flex items-center gap-1.5 text-[#FFC93C]">
                <Coins className="w-4 h-4" />
                <span>{coinsBalance.toLocaleString()}</span>
              </div>
              <div className="w-px h-3.5 bg-white/20" />
              <div className="flex items-center gap-1.5 text-[#60A5FA]">
                <Diamond className="w-3.5 h-3.5" />
                <span>{gemsBalance.toLocaleString()}</span>
              </div>
            </div>

            {/* Refresh / Close */}
            <button
              id="refresh-daily-rewards-btn"
              onClick={() => {
                sound.click();
                fetchStatus();
              }}
              disabled={isLoading}
              title="Refresh server status"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              id="close-daily-rewards-btn"
              onClick={() => {
                sound.click();
                onClose();
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Streak & Multiplier Status Strip */}
        <div className="relative px-6 py-3.5 bg-[#0F1622]/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Streak Pills */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FF6B4A]/15 border border-[#FF6B4A]/30 text-[#FF6B4A] font-mono font-bold">
              <Flame className="w-4 h-4 fill-current animate-bounce" />
              <span>Current Streak: {currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 font-mono">
              <Trophy className="w-3.5 h-3.5 text-[#FFC93C]" />
              <span>Best Streak: <strong>{longestStreak} Days</strong></span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#A8E6B0]/15 border border-[#A8E6B0]/30 text-[#A8E6B0] font-mono font-bold">
              <Zap className="w-3.5 h-3.5" />
              <span>Active Boost: x{currentMultiplier.toFixed(2)}</span>
            </div>
          </div>

          {/* Countdown Clock / Ready Status */}
          <div className="flex items-center gap-2">
            {isEligible ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#A8E6B0]/20 border border-[#A8E6B0]/40 text-[#A8E6B0] font-mono font-bold animate-pulse">
                <CheckCircle2 className="w-4 h-4" />
                <span>REWARD READY TO CLAIM</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 font-mono text-white/80 bg-black/40 px-3 py-1 rounded-lg border border-white/10">
                <Clock className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span className="text-white/50 text-[11px]">Next claim in:</span>
                <span className="font-bold text-[#60A5FA] tracking-wider">{formatCountdown(timeRemainingSec)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 7-Day Slot Grid Section */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          
          {/* Main 7-Day Slot Responsive Container */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-3.5">
            {data?.slots.map((slot) => {
              const isClaimed = slot.status === 'claimed';
              const isAvailable = slot.status === 'available';
              const isWaiting = slot.status === 'waiting';
              const isLocked = slot.status === 'locked';
              const isDay7 = slot.day === 7;

              return (
                <div
                  key={slot.day}
                  id={`daily-reward-slot-day-${slot.day}`}
                  className={`relative rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-300 ${
                    isDay7 
                      ? 'sm:col-span-2 md:col-span-4 lg:col-span-1 bg-gradient-to-b from-[#2B1B4D] to-[#171026] border-2 border-[#A855F7]/50 shadow-[0_8px_24px_rgba(168,85,247,0.25)]' 
                      : isAvailable 
                        ? 'bg-gradient-to-b from-[#2A2415] to-[#18150F] border-2 border-[#FFC93C] shadow-[0_0_20px_rgba(255,201,60,0.3)] scale-[1.02]' 
                        : isClaimed 
                          ? 'bg-[#121922]/60 border border-white/10 opacity-75' 
                          : 'bg-[#151D2A] border border-white/10'
                  }`}
                >
                  
                  {/* Top Day Header & Status Badge */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className={`text-[11px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-md ${
                      isDay7
                        ? 'bg-[#A855F7]/30 text-[#E9D5FF] border border-[#A855F7]/40'
                        : isAvailable
                          ? 'bg-[#FFC93C] text-[#0B120D]'
                          : isClaimed
                            ? 'bg-white/10 text-white/60'
                            : 'bg-white/5 text-white/50'
                    }`}>
                      DAY {slot.day}
                    </span>

                    {/* Status Pill */}
                    {isClaimed && (
                      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#A8E6B0] bg-[#A8E6B0]/15 px-1.5 py-0.5 rounded">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Done</span>
                      </span>
                    )}

                    {isAvailable && (
                      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#FFC93C] bg-[#FFC93C]/20 px-1.5 py-0.5 rounded animate-pulse">
                        <Sparkles className="w-3 h-3" />
                        <span>Ready</span>
                      </span>
                    )}

                    {isWaiting && (
                      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#60A5FA] bg-[#60A5FA]/15 px-1.5 py-0.5 rounded">
                        <Clock className="w-3 h-3" />
                        <span>Next</span>
                      </span>
                    )}

                    {isLocked && (
                      <span className="text-white/30 text-xs">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  {/* Icon & VIP Banner */}
                  <div className="my-2.5 flex flex-col items-center justify-center text-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-1.5 transition-transform ${
                      isAvailable ? 'scale-110 rotate-3 animate-bounce' : 'scale-100'
                    } ${
                      isDay7 
                        ? 'bg-gradient-to-br from-[#FFD700] to-[#FF8C00] shadow-[0_4px_16px_rgba(255,215,0,0.4)]' 
                        : isAvailable 
                          ? 'bg-[#FFC93C]/20 border border-[#FFC93C]/50' 
                          : 'bg-white/5 border border-white/5'
                    }`}>
                      {slot.icon}
                    </div>

                    {isDay7 && (
                      <div className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/40 text-[#FFD700] text-[10px] font-mono font-black uppercase tracking-wider">
                        <Crown className="w-3 h-3" />
                        <span>VIP Crown</span>
                      </div>
                    )}
                  </div>

                  {/* Rewards Breakdown */}
                  <div className="space-y-1.5 pt-2 border-t border-white/10 text-center font-mono">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#FFC93C]">
                      <Coins className="w-3.5 h-3.5" />
                      <span>+{slot.finalGold.toLocaleString()}</span>
                      {slot.multiplier > 1 && (
                        <span className="text-[10px] text-white/40 font-normal line-through">
                          ({slot.gold})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#60A5FA]">
                      <Diamond className="w-3.5 h-3.5" />
                      <span>+{slot.finalGems.toLocaleString()}</span>
                    </div>

                    <div className="text-[10px] font-bold text-white/50 tracking-tight">
                      Streak x{slot.multiplier.toFixed(2)}
                    </div>
                  </div>

                  {/* Claimed overlay indicator */}
                  {isClaimed && (
                    <div className="absolute inset-0 rounded-2xl bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-2">
                      <div className="w-8 h-8 rounded-full bg-[#A8E6B0]/20 border border-[#A8E6B0] flex items-center justify-center text-[#A8E6B0] mb-1">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-[#A8E6B0]">CLAIMED</span>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Primary Action Box */}
          <div className="mt-6 bg-[#161F2C] border border-white/15 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-5">
            
            {/* Left prompt info */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFC93C]/10 border border-[#FFC93C]/30 flex items-center justify-center text-2xl text-[#FFC93C] shrink-0">
                {currentTargetSlot?.icon || '🎁'}
              </div>
              <div>
                <h4 className="text-base font-bold text-white font-display">
                  {isEligible ? `Claim Day ${nextDay} Rewards!` : `Day ${nextDay} unlocks soon`}
                </h4>
                <p className="text-xs text-white/60 mt-0.5">
                  Rewards: <strong className="text-[#FFC93C]">+{currentTargetSlot?.finalGold.toLocaleString()} Coins</strong> &middot; <strong className="text-[#60A5FA]">+{currentTargetSlot?.finalGems} Gems</strong>
                  {currentTargetSlot?.isVip && <strong className="text-[#E9D5FF]"> &middot; VIP Crown Status!</strong>}
                </p>
              </div>
            </div>

            {/* Right Action Claim Button */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                id="claim-daily-reward-action-btn"
                onClick={handleClaim}
                disabled={!isEligible || isClaiming}
                className={`w-full md:w-auto px-8 py-3.5 rounded-xl font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                  isEligible
                    ? 'bg-[#FFC93C] hover:bg-[#FFD666] text-[#0B120D] shadow-[0_4px_0_#D98E04] hover:shadow-[0_2px_0_#D98E04] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none animate-pulse'
                    : 'bg-white/10 text-white/40 cursor-not-allowed border border-white/10'
                }`}
              >
                {isClaiming ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Verifying with Server...</span>
                  </>
                ) : isEligible ? (
                  <>
                    <Sparkles className="w-5 h-5 fill-current" />
                    <span>CLAIM REWARD (DAY {nextDay})</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Next Claim in {formatCountdown(timeRemainingSec)}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Dev Simulation & Roblox Integration Footer */}
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Developer Simulation Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  sound.click();
                  setShowDevControls(!showDevControls);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors font-mono cursor-pointer"
              >
                <span>🛠️ Developer Sandbox</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDevControls ? 'rotate-90' : ''}`} />
              </button>

              <button
                onClick={handleCopyLuau}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#A8E6B0]/15 hover:bg-[#A8E6B0]/25 text-[#A8E6B0] border border-[#A8E6B0]/30 transition-colors font-mono cursor-pointer"
              >
                {isCopiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Luau Remote</span>
              </button>
            </div>

            <div className="text-white/40 font-mono text-[11px]">
              Server-Authoritative Anti-Cheat &middot; Session-Locked
            </div>
          </div>

          {/* Collapsible Developer Sandbox Bar */}
          {showDevControls && (
            <div className="mt-3 p-3.5 bg-[#0B0F15] border border-white/15 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
              <div className="flex items-center gap-2 text-white/70 font-mono">
                <AlertCircle className="w-4 h-4 text-[#FFC93C]" />
                <span>Simulation tools for testing multi-day claiming without waiting 24 hours:</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFastForward(24)}
                  disabled={isFastForwarding}
                  className="px-3 py-1 rounded bg-[#FFC93C]/20 hover:bg-[#FFC93C]/30 text-[#FFC93C] font-mono font-bold border border-[#FFC93C]/40 transition-colors cursor-pointer disabled:opacity-50"
                >
                  ⚡ Fast-Forward 24 Hours
                </button>

                <button
                  onClick={handleResetStreak}
                  className="px-3 py-1 rounded bg-[#FF6B4A]/20 hover:bg-[#FF6B4A]/30 text-[#FF6B4A] font-mono font-bold border border-[#FF6B4A]/40 transition-colors cursor-pointer"
                >
                  🔄 Reset Streak
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Claim Celebration Modal Overlay */}
        {showCelebration && claimResult && (
          <div className="absolute inset-0 z-50 bg-[#0B120D]/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="w-full max-w-md bg-[#161F2C] border-2 border-[#FFC93C] rounded-3xl p-6 text-center shadow-[0_0_40px_rgba(255,201,60,0.4)] flex flex-col items-center">
              
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFC93C] to-[#F0A500] flex items-center justify-center text-4xl shadow-xl animate-bounce mb-3">
                🎉
              </div>

              <span className="px-3 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-[#FFC93C]/20 text-[#FFC93C] border border-[#FFC93C]/40 mb-2">
                DAY {claimResult.claimedDay} REWARD UNLOCKED
              </span>

              <h3 className="text-2xl font-black font-display text-white mb-1">
                Reward Claimed!
              </h3>
              <p className="text-xs text-white/70 max-w-xs mb-5">
                {claimResult.message}
              </p>

              {/* Granted Items Card */}
              <div className="w-full bg-[#0B0F15] border border-white/10 rounded-2xl p-4 mb-5 space-y-2 font-mono">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Coins Received:</span>
                  <span className="font-bold text-[#FFC93C] flex items-center gap-1">
                    <Coins className="w-4 h-4" /> +{claimResult.grantedGold.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Gems Received:</span>
                  <span className="font-bold text-[#60A5FA] flex items-center gap-1">
                    <Diamond className="w-4 h-4" /> +{claimResult.grantedGems.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Streak Multiplier:</span>
                  <span className="font-bold text-[#A8E6B0]">
                    x{claimResult.multiplier.toFixed(2)}
                  </span>
                </div>
                {claimResult.grantedVIP && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10 text-[#E9D5FF]">
                    <span className="flex items-center gap-1 font-bold">
                      <Crown className="w-4 h-4 text-[#FFD700]" /> VIP Crown Badge:
                    </span>
                    <span className="font-bold text-[#FFD700]">UNLOCKED!</span>
                  </div>
                )}
              </div>

              <button
                id="close-celebration-btn"
                onClick={() => {
                  sound.pop();
                  setShowCelebration(false);
                }}
                className="w-full py-3 rounded-xl bg-[#FFC93C] hover:bg-[#FFD666] text-[#0B120D] font-display font-extrabold text-sm shadow-[0_4px_0_#D98E04] hover:translate-y-[2px] transition-all cursor-pointer"
              >
                AWESOME!
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
