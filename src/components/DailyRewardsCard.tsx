import React, { useState, useEffect, useCallback } from 'react';
import { 
  Gift, Sparkles, Flame, Clock, Check, Lock, Coins, 
  Diamond, Crown, ArrowRight, RefreshCw, Trophy, Zap 
} from 'lucide-react';
import { 
  DailyRewardSlot, 
  DailyRewardsStatusResponse, 
  DailyRewardClaimResult 
} from '../types/dailyRewards';
import { sound } from '../utils/audio';
import { safeFetchJson } from '../utils/api';

interface DailyRewardsCardProps {
  onOpenModal: () => void;
  onShowToast: (msg: string) => void;
}

export const DailyRewardsCard: React.FC<DailyRewardsCardProps> = ({
  onOpenModal,
  onShowToast,
}) => {
  const [data, setData] = useState<DailyRewardsStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [timeRemainingSec, setTimeRemainingSec] = useState(0);

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
    } catch (e) {
      console.error('Error fetching quick daily rewards:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (timeRemainingSec <= 0) return;
    const timer = setInterval(() => {
      setTimeRemainingSec((prev) => {
        if (prev <= 1) {
          fetchStatus(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemainingSec, fetchStatus]);

  const formatCountdown = (sec: number) => {
    if (sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleQuickClaim = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isClaiming || !data?.eligible) {
      onOpenModal();
      return;
    }

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
        onShowToast(res.data.message || '🎉 Daily Reward Claimed!');
        fetchStatus(true);
      } else {
        sound.error();
        onShowToast(res.data?.error || 'Reward not ready.');
      }
    } catch (err: any) {
      onShowToast(`Claim error: ${err.message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  const currentStreak = data?.currentStreak || 0;
  const nextDay = data?.nextDay || 1;
  const isEligible = data?.eligible || false;
  const targetSlot = data?.slots.find((s) => s.day === nextDay) || data?.slots?.[0];

  return (
    <div 
      id="daily-rewards-banner-card"
      onClick={() => {
        sound.click();
        onOpenModal();
      }}
      className="relative rounded-2xl bg-gradient-to-r from-[#1E293B] via-[#161F2C] to-[#0F172A] border border-white/15 p-4 sm:p-5 shadow-xl hover:border-[#FFC93C]/50 transition-all duration-300 cursor-pointer group text-[#FFFDF6]"
    >
      
      {/* Decorative Glow */}
      <div className="absolute top-0 right-1/4 w-36 h-36 bg-[#FFC93C]/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Left Info */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFC93C] to-[#F0A500] flex items-center justify-center text-2xl text-[#0B120D] shadow-[0_4px_12px_rgba(255,201,60,0.3)] shrink-0 group-hover:scale-105 transition-transform">
            🎁
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold font-display text-white group-hover:text-[#FFC93C] transition-colors">
                7-Day Daily Rewards
              </h3>
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-[#FF6B4A]/15 text-[#FF6B4A] border border-[#FF6B4A]/30 px-2 py-0.5 rounded-full">
                <Flame className="w-3 h-3 fill-current" />
                <span>{currentStreak} Day Streak</span>
              </span>
            </div>
            <p className="text-xs text-white/60 mt-0.5">
              Day {nextDay} Reward: <strong className="text-[#FFC93C]">+{targetSlot?.finalGold || 100} Coins</strong> &middot; <strong className="text-[#60A5FA]">+{targetSlot?.finalGems || 10} Gems</strong>
              {targetSlot?.isVip && <strong className="text-[#E9D5FF]"> + VIP Crown!</strong>}
            </p>
          </div>
        </div>

        {/* 7 Mini Day Indicator Pills */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#0B0F15]/60 p-1.5 rounded-xl border border-white/10">
          {data?.slots?.map((s) => {
            const isClaimed = s.status === 'claimed';
            const isAvailable = s.status === 'available';
            const isDay7 = s.day === 7;

            return (
              <div
                key={s.day}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  isClaimed
                    ? 'bg-[#A8E6B0]/20 text-[#A8E6B0] border border-[#A8E6B0]/40'
                    : isAvailable
                      ? 'bg-[#FFC93C] text-[#0B120D] shadow-sm animate-pulse scale-105'
                      : isDay7
                        ? 'bg-[#A855F7]/20 text-[#E9D5FF] border border-[#A855F7]/30'
                        : 'bg-white/5 text-white/40'
                }`}
                title={`Day ${s.day}: ${s.finalGold} Coins, ${s.finalGems} Gems`}
              >
                {isClaimed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : isDay7 ? <Crown className="w-3 h-3" /> : `D${s.day}`}
              </div>
            );
          })}
        </div>

        {/* Right Claim / Timer Button */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          {isEligible ? (
            <button
              onClick={handleQuickClaim}
              disabled={isClaiming}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FFC93C] hover:bg-[#FFD666] text-[#0B120D] font-display font-extrabold text-xs shadow-[0_3px_0_#D98E04] hover:translate-y-[1px] active:translate-y-[3px] active:shadow-none flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isClaiming ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 fill-current" />}
              <span>CLAIM DAY {nextDay}</span>
            </button>
          ) : (
            <div className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/70">
              <Clock className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Next in {formatCountdown(timeRemainingSec)}</span>
            </div>
          )}

          <div className="hidden sm:flex p-2 rounded-xl bg-white/5 group-hover:bg-white/10 text-white/60 group-hover:text-white transition-colors">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

      </div>
    </div>
  );
};
