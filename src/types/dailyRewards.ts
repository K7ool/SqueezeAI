export interface DailyRewardSlot {
  day: number;
  gold: number;
  gems: number;
  isVip: boolean;
  vipBadgeTitle?: string;
  title: string;
  description: string;
  icon: string;
  multiplier: number;
  status: 'claimed' | 'available' | 'waiting' | 'locked';
  finalGold: number;
  finalGems: number;
}

export interface DailyRewardsUserData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalClaims: number;
  lastClaimTimestamp: number; // Unix epoch ms
  lastClaimedDay: number; // 0 to 7
  hasClaimedVIP: boolean;
  coins: number;
  gems: number;
}

export interface DailyRewardsStatusResponse {
  success: boolean;
  eligible: boolean;
  timeRemaining: number; // in seconds
  nextAvailableTimestamp: number; // Unix epoch ms
  cooldownSeconds: number;
  gracePeriodSeconds: number;
  currentStreak: number;
  longestStreak: number;
  totalClaims: number;
  lastClaimedDay: number;
  nextDay: number;
  currentMultiplier: number;
  streakWillReset: boolean;
  userBalances: {
    coins: number;
    gems: number;
  };
  slots: DailyRewardSlot[];
  serverTime: number;
}

export interface DailyRewardClaimResult {
  success: boolean;
  message: string;
  claimedDay: number;
  grantedGold: number;
  grantedGems: number;
  grantedVIP: boolean;
  newStreak: number;
  longestStreak: number;
  multiplier: number;
  nextAvailableTimestamp: number;
  userBalances: {
    coins: number;
    gems: number;
  };
  slots: DailyRewardSlot[];
}
