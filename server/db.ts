import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  avatar?: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro' | 'studio';
  planStatus: 'active' | 'past_due' | 'canceled';
  monthlyLimit: number; // Free: 25, Pro: 500, Studio: 2000
  usedGenerations: number;
  quotaResetDate: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedScriptRecord {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  code: string;
  explanation: string;
  scriptType: 'Server Script' | 'LocalScript' | 'ModuleScript';
  targetInstance: string;
  lineCount: number;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
}

export interface SubscriberRecord {
  id: string;
  email: string;
  status: 'active' | 'pending' | 'unsubscribed';
  confirmedAt: string;
  source: string;
  createdAt: string;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface DailyRewardsRecord {
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

export interface StudioSessionRecord {
  sessionId: string;
  userId?: string;
  projectId: string;
  projectName: string;
  placeId?: number;
  placeName?: string;
  universeId?: number;
  pairingCode: string;
  token: string;
  status: 'pending_pairing' | 'connected' | 'offline' | 'disconnected';
  connectedAt?: number;
  lastHeartbeat: number;
  pluginVersion: string;
  clientIp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioPairingCodeRecord {
  code: string;
  projectId: string;
  projectName: string;
  userId?: string;
  token: string;
  expiresAt: number;
  used: boolean;
  createdAt: string;
}

export interface StudioChangeEventRecord {
  changeId: string;
  projectId: string;
  sessionId?: string;
  fileId: string;
  path: string;
  className: 'Script' | 'LocalScript' | 'ModuleScript';
  action: 'create' | 'update' | 'delete' | 'rename' | 'move';
  source: string;
  version: number;
  hash: string;
  timestamp: number;
  author: 'website' | 'studio' | 'ai';
  status: 'pending' | 'applied' | 'acknowledged' | 'conflict' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

export interface StudioFileVersionRecord {
  id: string;
  projectId: string;
  path: string;
  name: string;
  className: 'Script' | 'LocalScript' | 'ModuleScript';
  parentPath: string;
  source: string;
  version: number;
  hash: string;
  updatedAt: number;
  updatedBy: 'website' | 'studio' | 'ai';
}

export interface StudioConflictRecord {
  conflictId: string;
  projectId: string;
  fileId: string;
  path: string;
  websiteVersion: number;
  websiteSource: string;
  websiteUpdatedAt: number;
  studioVersion: number;
  studioSource: string;
  studioUpdatedAt: number;
  detectedAt: number;
  status: 'open' | 'resolved';
  resolution?: 'keep_website' | 'keep_studio' | 'manual_merge';
  resolvedAt?: number;
}

export interface StudioAuditLogRecord {
  id: string;
  projectId: string;
  sessionId?: string;
  userId?: string;
  type: string;
  author: string;
  details: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

interface DatabaseSchema {
  users: UserRecord[];
  scripts: GeneratedScriptRecord[];
  subscribers: SubscriberRecord[];
  apiKeys: ApiKeyRecord[];
  dailyRewards: DailyRewardsRecord[];
  studioSessions: StudioSessionRecord[];
  studioPairingCodes: StudioPairingCodeRecord[];
  studioChanges: StudioChangeEventRecord[];
  studioFiles: StudioFileVersionRecord[];
  studioConflicts: StudioConflictRecord[];
  studioAuditLogs: StudioAuditLogRecord[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'squeeze_db.json');

let memoryDb: DatabaseSchema | null = null;

// Ensure data directory and file exist with resilient in-memory fallback
function ensureDb(): DatabaseSchema {
  if (memoryDb) {
    return memoryDb;
  }

  const initialDb: DatabaseSchema = {
    users: [
      {
        id: 'usr_demo_builder',
        email: 'builder@squeeze.gg',
        name: 'BloxDev Alex',
        passwordHash: '$2a$10$w8.oFk5e3M1Kj7uU8g5N9.eD2zZkQ3L1k7tW7m4G0Y1j6v7h9r3dK', // 'password123'
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        role: 'user',
        plan: 'pro',
        planStatus: 'active',
        monthlyLimit: 500,
        usedGenerations: 6,
        quotaResetDate: new Date(Date.now() + 24 * 3600 * 1000 * 25).toISOString(),
        createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 10).toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ],
    scripts: [
      {
        id: 'scr_001',
        userId: 'usr_demo_builder',
        title: 'DataStore Coins & Stats Saver',
        prompt: 'a leaderboard that saves coins and gems across sessions with pcall and error retries',
        code: `-- Leaderboard & DataStore Manager for Coins & Gems
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local PlayerDataStore = DataStoreService:GetDataStore("PlayerStats_v1")

local function createLeaderstats(player: Player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player

\tlocal coins = Instance.new("IntValue")
\tcoins.Name = "Coins"
\tcoins.Value = 0
\tcoins.Parent = leaderstats

\tlocal gems = Instance.new("IntValue")
\tgems.Name = "Gems"
\tgems.Value = 0
\tgems.Parent = leaderstats

\t-- Load DataStore with safe pcall
\tlocal dataKey = "User_" .. player.UserId
\tlocal success, savedData = pcall(function()
\t\treturn PlayerDataStore:GetAsync(dataKey)
\tend)

\tif success and savedData then
\t\tcoins.Value = savedData.Coins or 0
\t\tgems.Value = savedData.Gems or 0
\telse
\t\twarn("[Squeeze DataStore] Failed to load data for: " .. player.Name)
\tend
end

local function savePlayerData(player: Player)
\tlocal leaderstats = player:FindFirstChild("leaderstats")
\tif not leaderstats then return end

\tlocal coins = leaderstats:FindFirstChild("Coins")
\tlocal gems = leaderstats:FindFirstChild("Gems")

\tlocal data = {
\t\tCoins = coins and coins.Value or 0,
\t\tGems = gems and gems.Value or 0
\t}

\tlocal dataKey = "User_" .. player.UserId
\tlocal success, err = pcall(function()
\t\tPlayerDataStore:SetAsync(dataKey, data)
\tend)

\tif not success then
\t\twarn("[Squeeze DataStore] Failed to save for " .. player.Name .. ": " .. tostring(err))
\tend
end

Players.PlayerAdded:Connect(createLeaderstats)
Players.PlayerRemoving:Connect(savePlayerData)

game:BindToClose(function()
\tfor _, player in ipairs(Players:GetPlayers()) do
\t\tsavePlayerData(player)
\tend
end)`,
        explanation: 'Creates a leaderstats folder for each player with Coins and Gems IntValues, and safely loads and persists data using DataStoreService with error handling.',
        scriptType: 'Server Script',
        targetInstance: 'ServerScriptService',
        lineCount: 56,
        tags: ['DataStore', 'Leaderstats', 'Economy'],
        isFavorite: true,
        createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
      },
      {
        id: 'scr_002',
        userId: 'usr_demo_builder',
        title: 'Healing Fountain Pad',
        prompt: 'a part that heals you when you stand on it with cooldown and sound effect',
        code: `-- Healing Pad Script
local part = script.Parent
local HEAL_AMOUNT = 15
local HEAL_INTERVAL = 1.0
local activePlayers = {}

local function onTouch(hit: BasePart)
\tlocal character = hit.Parent
\tlocal humanoid = character and character:FindFirstChildOfClass("Humanoid")
\tif not humanoid or humanoid.Health <= 0 or humanoid.Health >= humanoid.MaxHealth then
\t\treturn
\tend

\tlocal player = game.Players:GetPlayerFromCharacter(character)
\tif not player or activePlayers[player.UserId] then return end

\tactivePlayers[player.UserId] = true
\thumanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + HEAL_AMOUNT)

\t-- Particle or sound trigger if exists
\tlocal healSound = part:FindFirstChild("HealSound")
\tif healSound then healSound:Play() end

\ttask.delay(HEAL_INTERVAL, function()
\t\tactivePlayers[player.UserId] = nil
\tend)
end

part.Touched:Connect(onTouch)`,
        explanation: 'Safely checks for valid humanoid touching the pad, applies healing with a cooldown table, and prevents spam.',
        scriptType: 'Server Script',
        targetInstance: 'Workspace.HealingPad',
        lineCount: 30,
        tags: ['Mechanic', 'Health', 'Touched'],
        isFavorite: false,
        createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
      }
    ],
    subscribers: [
      {
        id: 'sub_001',
        email: '5Kalar4134@gmail.com',
        status: 'active',
        confirmedAt: new Date().toISOString(),
        source: 'early_access',
        createdAt: new Date().toISOString(),
      }
    ],
    apiKeys: [
      {
        id: 'key_001',
        userId: 'usr_demo_builder',
        name: 'Studio Main Place Plugin',
        key: 'sqz_live_' + crypto.randomBytes(16).toString('hex'),
        createdAt: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
      }
    ],
    dailyRewards: [
      {
        userId: 'usr_demo_builder',
        currentStreak: 3,
        longestStreak: 5,
        totalClaims: 12,
        lastClaimTimestamp: Date.now() - 25 * 3600 * 1000, // 25 hours ago, so claimable right now!
        lastClaimedDay: 3,
        hasClaimedVIP: false,
        coins: 1450,
        gems: 85,
      }
    ],
    studioSessions: [],
    studioPairingCodes: [],
    studioChanges: [],
    studioFiles: [],
    studioConflicts: [],
    studioAuditLogs: [],
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
      memoryDb = initialDb;
      return memoryDb;
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    memoryDb = {
      ...initialDb,
      ...parsed,
      studioSessions: parsed.studioSessions || [],
      studioPairingCodes: parsed.studioPairingCodes || [],
      studioChanges: parsed.studioChanges || [],
      studioFiles: parsed.studioFiles || [],
      studioConflicts: parsed.studioConflicts || [],
      studioAuditLogs: parsed.studioAuditLogs || [],
    };
    return memoryDb;
  } catch (err) {
    console.warn('[Squeeze DB] In-memory database mode active:', err);
    memoryDb = initialDb;
    return memoryDb;
  }
}

function saveDb(data: DatabaseSchema) {
  memoryDb = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Squeeze DB] Saved in-memory cache:', err);
  }
}

export const db = {
  // Users
  getUserById(id: string): UserRecord | undefined {
    const data = ensureDb();
    return data.users.find(u => u.id === id);
  },

  getUserByEmail(email: string): UserRecord | undefined {
    const data = ensureDb();
    return data.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  },

  createUser(user: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt' | 'usedGenerations' | 'quotaResetDate'>): UserRecord {
    const data = ensureDb();
    const newUser: UserRecord = {
      ...user,
      id: 'usr_' + crypto.randomUUID().slice(0, 8),
      usedGenerations: 0,
      quotaResetDate: new Date(Date.now() + 24 * 3600 * 1000 * 30).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.users.push(newUser);
    saveDb(data);
    return newUser;
  },

  updateUser(id: string, updates: Partial<UserRecord>): UserRecord | undefined {
    const data = ensureDb();
    const index = data.users.findIndex(u => u.id === id);
    if (index === -1) return undefined;
    data.users[index] = {
      ...data.users[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveDb(data);
    return data.users[index];
  },

  incrementUserGenerations(id: string): { success: boolean; used: number; remaining: number } {
    const data = ensureDb();
    const user = data.users.find(u => u.id === id);
    if (!user) return { success: false, used: 0, remaining: 0 };

    // Check if unlimited
    const isUnlimited = user.plan === 'pro' || user.plan === 'studio';
    if (!isUnlimited && user.usedGenerations >= user.monthlyLimit) {
      return { success: false, used: user.usedGenerations, remaining: 0 };
    }

    user.usedGenerations += 1;
    user.updatedAt = new Date().toISOString();
    saveDb(data);

    const remaining = isUnlimited ? 9999 : Math.max(0, user.monthlyLimit - user.usedGenerations);
    return { success: true, used: user.usedGenerations, remaining };
  },

  // Scripts
  getScripts(userId?: string, search?: string): GeneratedScriptRecord[] {
    const data = ensureDb();
    let list = data.scripts;
    if (userId) {
      list = list.filter(s => s.userId === userId || s.userId === 'usr_demo_builder');
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.title.toLowerCase().includes(q) || s.prompt.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q)));
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getScriptById(id: string): GeneratedScriptRecord | undefined {
    const data = ensureDb();
    return data.scripts.find(s => s.id === id);
  },

  createScript(script: Omit<GeneratedScriptRecord, 'id' | 'createdAt'>): GeneratedScriptRecord {
    const data = ensureDb();
    const newScript: GeneratedScriptRecord = {
      ...script,
      id: 'scr_' + crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
    };
    data.scripts.unshift(newScript);
    saveDb(data);
    return newScript;
  },

  deleteScript(id: string, userId: string): boolean {
    const data = ensureDb();
    const prevLen = data.scripts.length;
    data.scripts = data.scripts.filter(s => !(s.id === id && (s.userId === userId || userId === 'usr_demo_builder')));
    if (data.scripts.length !== prevLen) {
      saveDb(data);
      return true;
    }
    return false;
  },

  toggleFavorite(id: string, userId: string): boolean {
    const data = ensureDb();
    const s = data.scripts.find(s => s.id === id && (s.userId === userId || userId === 'usr_demo_builder'));
    if (!s) return false;
    s.isFavorite = !s.isFavorite;
    saveDb(data);
    return s.isFavorite;
  },

  // Newsletter Subscribers
  addSubscriber(email: string, source = 'landing'): SubscriberRecord {
    const data = ensureDb();
    const normalized = email.toLowerCase().trim();
    const existing = data.subscribers.find(s => s.email === normalized);
    if (existing) {
      existing.status = 'active';
      existing.confirmedAt = new Date().toISOString();
      saveDb(data);
      return existing;
    }

    const sub: SubscriberRecord = {
      id: 'sub_' + crypto.randomUUID().slice(0, 8),
      email: normalized,
      status: 'active',
      confirmedAt: new Date().toISOString(),
      source,
      createdAt: new Date().toISOString(),
    };
    data.subscribers.push(sub);
    saveDb(data);
    return sub;
  },

  getSubscribers(): SubscriberRecord[] {
    const data = ensureDb();
    return data.subscribers;
  },

  // Api Keys
  getApiKeys(userId: string): ApiKeyRecord[] {
    const data = ensureDb();
    return data.apiKeys.filter(k => k.userId === userId);
  },

  createApiKey(userId: string, name: string): ApiKeyRecord {
    const data = ensureDb();
    const keyRecord: ApiKeyRecord = {
      id: 'key_' + crypto.randomUUID().slice(0, 8),
      userId,
      name: name || 'Studio Plugin Key',
      key: 'sqz_live_' + crypto.randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString(),
    };
    data.apiKeys.push(keyRecord);
    saveDb(data);
    return keyRecord;
  },

  // -----------------------------------------------------------
  // DAILY REWARDS SYSTEM (Server-Authoritative)
  // -----------------------------------------------------------
  
  getDailyRewards(userId: string): DailyRewardsRecord {
    const data = ensureDb();
    if (!data.dailyRewards) data.dailyRewards = [];
    
    let record = data.dailyRewards.find(r => r.userId === userId);
    if (!record) {
      record = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalClaims: 0,
        lastClaimTimestamp: 0,
        lastClaimedDay: 0,
        hasClaimedVIP: false,
        coins: 500,
        gems: 25,
      };
      data.dailyRewards.push(record);
      saveDb(data);
    }

    // Server-Authoritative Grace Period Check (48 Hours)
    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;
    const now = Date.now();

    if (record.lastClaimTimestamp > 0 && (now - record.lastClaimTimestamp) > GRACE_PERIOD_MS) {
      // Grace period expired, reset current streak & cycle
      record.currentStreak = 0;
      record.lastClaimedDay = 0;
      saveDb(data);
    }

    return record;
  },

  claimDailyReward(userId: string): {
    success: boolean;
    error?: string;
    claimedDay: number;
    grantedGold: number;
    grantedGems: number;
    grantedVIP: boolean;
    record: DailyRewardsRecord;
    multiplier: number;
  } {
    const data = ensureDb();
    if (!data.dailyRewards) data.dailyRewards = [];

    const record = this.getDailyRewards(userId);
    const now = Date.now();
    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

    // 1. Verify Cooldown
    if (record.lastClaimTimestamp > 0) {
      const elapsed = now - record.lastClaimTimestamp;
      if (elapsed < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return {
          success: false,
          error: `Reward not ready. Please wait ${Math.floor(remainingSeconds / 3600)}h ${Math.floor((remainingSeconds % 3600) / 60)}m.`,
          claimedDay: record.lastClaimedDay,
          grantedGold: 0,
          grantedGems: 0,
          grantedVIP: false,
          record,
          multiplier: 1.0,
        };
      }

      // Check if streak broke due to grace period
      if (elapsed > GRACE_PERIOD_MS) {
        record.currentStreak = 0;
        record.lastClaimedDay = 0;
      }
    }

    // 2. Determine target day in the 7-day cycle
    let nextDay = record.lastClaimedDay + 1;
    if (nextDay > 7 || record.currentStreak === 0) {
      nextDay = 1;
    }

    // 3. Multiplier scaling based on Day
    const MULTIPLIERS: { [day: number]: number } = {
      1: 1.0,
      2: 1.25,
      3: 1.5,
      4: 1.75,
      5: 2.0,
      6: 2.5,
      7: 3.0,
    };

    const BASE_REWARDS: { [day: number]: { gold: number; gems: number; isVip: boolean } } = {
      1: { gold: 100, gems: 10, isVip: false },
      2: { gold: 150, gems: 15, isVip: false },
      3: { gold: 250, gems: 25, isVip: false },
      4: { gold: 400, gems: 35, isVip: false },
      5: { gold: 600, gems: 50, isVip: false },
      6: { gold: 900, gems: 75, isVip: false },
      7: { gold: 1500, gems: 120, isVip: true },
    };

    const multiplier = MULTIPLIERS[nextDay] || 1.0;
    const base = BASE_REWARDS[nextDay] || { gold: 100, gems: 10, isVip: false };

    const grantedGold = Math.round(base.gold * multiplier);
    const grantedGems = Math.round(base.gems * multiplier);
    const grantedVIP = base.isVip;

    // 4. Update state atomically
    record.currentStreak += 1;
    if (record.currentStreak > record.longestStreak) {
      record.longestStreak = record.currentStreak;
    }
    record.totalClaims += 1;
    record.lastClaimedDay = nextDay;
    record.lastClaimTimestamp = now;
    record.coins += grantedGold;
    record.gems += grantedGems;
    if (grantedVIP) {
      record.hasClaimedVIP = true;
    }

    saveDb(data);

    return {
      success: true,
      claimedDay: nextDay,
      grantedGold,
      grantedGems,
      grantedVIP,
      record,
      multiplier,
    };
  },

  resetDailyRewardCooldown(userId: string, fastForwardHours: number = 24): DailyRewardsRecord {
    const data = ensureDb();
    const record = this.getDailyRewards(userId);
    // Shift lastClaimTimestamp backwards
    record.lastClaimTimestamp = Date.now() - (fastForwardHours * 3600 * 1000);
    saveDb(data);
    return record;
  },

  resetDailyRewardStreak(userId: string): DailyRewardsRecord {
    const data = ensureDb();
    const record = this.getDailyRewards(userId);
    record.currentStreak = 0;
    record.lastClaimedDay = 0;
    record.lastClaimTimestamp = 0;
    saveDb(data);
    return record;
  },

  // -----------------------------------------------------------
  // STUDIO WEBSYNC PERSISTENCE
  // -----------------------------------------------------------

  // Sessions
  getStudioSessionByToken(token: string): StudioSessionRecord | undefined {
    const data = ensureDb();
    return data.studioSessions.find(s => s.token === token);
  },

  getStudioSessionByProject(projectId: string): StudioSessionRecord | undefined {
    const data = ensureDb();
    return data.studioSessions.find(s => s.projectId === projectId && s.status !== 'disconnected');
  },

  getAllStudioSessions(projectId?: string): StudioSessionRecord[] {
    const data = ensureDb();
    if (projectId) {
      return data.studioSessions.filter(s => s.projectId === projectId);
    }
    return data.studioSessions;
  },

  saveStudioSession(session: StudioSessionRecord): StudioSessionRecord {
    const data = ensureDb();
    const index = data.studioSessions.findIndex(s => s.sessionId === session.sessionId || s.token === session.token);
    if (index >= 0) {
      data.studioSessions[index] = { ...data.studioSessions[index], ...session, updatedAt: new Date().toISOString() };
    } else {
      data.studioSessions.push(session);
    }
    saveDb(data);
    return session;
  },

  deleteStudioSession(token: string): boolean {
    const data = ensureDb();
    const prev = data.studioSessions.length;
    data.studioSessions = data.studioSessions.filter(s => s.token !== token);
    if (data.studioSessions.length !== prev) {
      saveDb(data);
      return true;
    }
    return false;
  },

  // Pairing Codes
  savePairingCode(record: StudioPairingCodeRecord): StudioPairingCodeRecord {
    const data = ensureDb();
    data.studioPairingCodes = data.studioPairingCodes.filter(p => p.code !== record.code && p.expiresAt > Date.now());
    data.studioPairingCodes.push(record);
    saveDb(data);
    return record;
  },

  getPairingCode(code: string): StudioPairingCodeRecord | undefined {
    const data = ensureDb();
    const clean = code.trim().toUpperCase();
    return data.studioPairingCodes.find(p => p.code === clean && !p.used && p.expiresAt > Date.now());
  },

  markPairingCodeUsed(code: string): void {
    const data = ensureDb();
    const clean = code.trim().toUpperCase();
    const rec = data.studioPairingCodes.find(p => p.code === clean);
    if (rec) {
      rec.used = true;
      saveDb(data);
    }
  },

  // Changes Queue
  saveStudioChange(change: StudioChangeEventRecord): StudioChangeEventRecord {
    const data = ensureDb();
    const idx = data.studioChanges.findIndex(c => c.changeId === change.changeId);
    if (idx >= 0) {
      data.studioChanges[idx] = change;
    } else {
      data.studioChanges.push(change);
    }
    // Retain only last 500 changes per project to prevent unbounded growth
    if (data.studioChanges.length > 1000) {
      data.studioChanges = data.studioChanges.slice(-500);
    }
    saveDb(data);
    return change;
  },

  getStudioPendingChanges(projectId: string, excludeAuthor?: string): StudioChangeEventRecord[] {
    const data = ensureDb();
    return data.studioChanges.filter(c => 
      c.projectId === projectId && 
      c.status === 'pending' && 
      (!excludeAuthor || c.author !== excludeAuthor)
    );
  },

  acknowledgeStudioChange(changeId: string, status: 'applied' | 'failed', errorMsg?: string): boolean {
    const data = ensureDb();
    const ch = data.studioChanges.find(c => c.changeId === changeId);
    if (ch) {
      ch.status = status === 'applied' ? 'acknowledged' : 'failed';
      if (errorMsg) ch.errorMessage = errorMsg;
      saveDb(data);
      return true;
    }
    return false;
  },

  // Files
  getStudioFiles(projectId: string): StudioFileVersionRecord[] {
    const data = ensureDb();
    return data.studioFiles.filter(f => f.projectId === projectId);
  },

  getStudioFile(projectId: string, pathOrId: string): StudioFileVersionRecord | undefined {
    const data = ensureDb();
    return data.studioFiles.find(f => f.projectId === projectId && (f.path === pathOrId || f.id === pathOrId));
  },

  saveStudioFile(file: StudioFileVersionRecord): StudioFileVersionRecord {
    const data = ensureDb();
    const idx = data.studioFiles.findIndex(f => f.projectId === file.projectId && (f.path === file.path || f.id === file.id));
    if (idx >= 0) {
      data.studioFiles[idx] = file;
    } else {
      data.studioFiles.push(file);
    }
    saveDb(data);
    return file;
  },

  // Conflicts
  saveStudioConflict(conflict: StudioConflictRecord): StudioConflictRecord {
    const data = ensureDb();
    const idx = data.studioConflicts.findIndex(c => c.conflictId === conflict.conflictId);
    if (idx >= 0) {
      data.studioConflicts[idx] = conflict;
    } else {
      data.studioConflicts.push(conflict);
    }
    saveDb(data);
    return conflict;
  },

  getStudioConflicts(projectId: string): StudioConflictRecord[] {
    const data = ensureDb();
    return data.studioConflicts.filter(c => c.projectId === projectId && c.status === 'open');
  },

  resolveStudioConflict(conflictId: string, resolution: 'keep_website' | 'keep_studio' | 'manual_merge'): StudioConflictRecord | undefined {
    const data = ensureDb();
    const conf = data.studioConflicts.find(c => c.conflictId === conflictId);
    if (conf) {
      conf.status = 'resolved';
      conf.resolution = resolution;
      conf.resolvedAt = Date.now();
      saveDb(data);
      return conf;
    }
    return undefined;
  },

  // Audit Logs
  addStudioAuditLog(projectId: string, entry: { type: string; author: string; details: string; sessionId?: string; userId?: string; metadata?: Record<string, any> }): StudioAuditLogRecord {
    const data = ensureDb();
    const log: StudioAuditLogRecord = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      projectId,
      timestamp: Date.now(),
      ...entry,
    };
    data.studioAuditLogs.unshift(log);
    if (data.studioAuditLogs.length > 500) {
      data.studioAuditLogs = data.studioAuditLogs.slice(0, 500);
    }
    saveDb(data);
    return log;
  },

  getStudioAuditLogs(projectId: string, limit: number = 50): StudioAuditLogRecord[] {
    const data = ensureDb();
    return data.studioAuditLogs
      .filter(l => l.projectId === projectId)
      .slice(0, limit);
  }
};
