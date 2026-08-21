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

export interface ConversationRecord {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messageCount: number;
  archived: boolean;
  tags?: string[];
}

export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  userId: string;
  projectId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  thinkingSteps?: any[];
  changePlan?: any;
  codeReview?: any;
  actionPerformed?: any;
  filesGenerated?: any[];
  suggestedPrompts?: string[];
  executionId?: string;
  executionDetails?: {
    status?: string;
    filesChanged?: string[];
    instancesChanged?: string[];
    studioStatus?: string;
    verificationStatus?: string;
    studioSyncResult?: any;
    operationResults?: any;
  };
}

export interface UserMemoryRecord {
  id: string;
  userId: string;
  type: 'preference' | 'coding_style' | 'luau_style' | 'architecture' | 'response_style' | 'tool_preference' | 'explicit_statement';
  key: string;
  value: any;
  confidence: 'high' | 'medium' | 'low';
  source: 'explicit_user_statement' | 'agent_observation' | 'explicit_configuration';
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ProjectMemoryRecord {
  id: string;
  userId: string;
  projectId: string;
  projectName?: string;
  gameType?: string;
  architecture?: string;
  majorSystems?: string[];
  services?: string[];
  frameworks?: string[];
  dataSystem?: string;
  UIFramework?: string;
  commandSystem?: string;
  permissionSystem?: string;
  knownProblems?: string[];
  importantFiles?: string[];
  learnedConventions?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;
  version: number;
}

export interface ConversationMemoryRecord {
  id: string;
  conversationId: string;
  userId: string;
  projectId: string;
  currentFeature?: string;
  currentProblem?: string;
  importantDecisions?: string[];
  relevantFiles?: string[];
  recentOperations?: string[];
  openIssues?: string[];
  userIntent?: string;
  recentObjects?: {
    lastCreated?: { path: string; className: string; name: string; createdInTask?: string; lastVerified?: boolean };
    objects?: Record<string, string>;
    history?: Array<{ action: string; path: string; timestamp: string }>;
  };
  updatedAt: string;
}

export interface ExecutionMemoryRecord {
  id: string;
  userId: string;
  projectId: string;
  conversationId: string;
  request: string;
  intent: string;
  planSummary?: string;
  toolsUsed?: string[];
  filesChanged?: string[];
  instancesChanged?: string[];
  errors?: Array<{
    error: string;
    file?: string;
    line?: number;
    resolved?: boolean;
    resolution?: string;
    timestamp?: string;
  }>;
  verificationStatus: string;
  finalStatus: string;
  timestamp: string;
}

export interface MemoryEventRecord {
  id: string;
  userId: string;
  projectId?: string;
  memoryType: 'user' | 'project' | 'conversation' | 'execution' | 'system';
  action: 'created' | 'updated' | 'verified' | 'invalidated' | 'deleted' | 'reset';
  key?: string;
  details: string;
  timestamp: string;
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
  conversations: ConversationRecord[];
  messages: ChatMessageRecord[];
  userMemories: UserMemoryRecord[];
  projectMemories: ProjectMemoryRecord[];
  conversationMemories: ConversationMemoryRecord[];
  executionMemories: ExecutionMemoryRecord[];
  memoryEvents: MemoryEventRecord[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'squeeze_db.json');

import { getSupabaseClient, queueSupabaseWrite } from './supabase.js';

const TABLE_MAP: Record<string, string> = {
  users: 'users',
  scripts: 'generated_scripts',
  subscribers: 'email_subscribers',
  apiKeys: 'api_keys',
  dailyRewards: 'daily_rewards',
  studioSessions: 'studio_sessions',
  studioPairingCodes: 'studio_pairing_codes',
  studioChanges: 'studio_change_events',
  studioFiles: 'studio_file_versions',
  studioConflicts: 'studio_conflicts',
  studioAuditLogs: 'studio_audit_logs',
  conversations: 'conversations',
  messages: 'chat_messages',
  userMemories: 'user_memories',
  projectMemories: 'project_memories',
  conversationMemories: 'conversation_memories',
  executionMemories: 'execution_memories',
  memoryEvents: 'memory_events'
};

const PK_MAP: Record<string, string> = {
  users: 'id',
  scripts: 'id',
  subscribers: 'id',
  apiKeys: 'id',
  dailyRewards: 'userId',
  studioSessions: 'sessionId',
  studioPairingCodes: 'code',
  studioChanges: 'changeId',
  studioFiles: 'id',
  studioConflicts: 'conflictId',
  studioAuditLogs: 'id',
  conversations: 'id',
  messages: 'id',
  userMemories: 'id',
  projectMemories: 'id',
  conversationMemories: 'id',
  executionMemories: 'id',
  memoryEvents: 'id'
};

async function syncUpsert(table: keyof DatabaseSchema, record: any) {
  try {
    await queueSupabaseWrite(async () => {
      const supabase = getSupabaseClient(true);
      const mappedTable = TABLE_MAP[table];
      const pk = PK_MAP[table];
      if (!mappedTable || !pk) return;
      
      const cleanRecord = { ...record };

      let { error } = await supabase
        .from(mappedTable)
        .upsert([cleanRecord], { onConflict: pk });

      // If foreign key violation (e.g. missing user), auto-upsert user first and retry
      if (error && error.message && error.message.includes('violates foreign key constraint') && cleanRecord.userId) {
        const data = ensureDb();
        const parentUser = data.users.find(u => u.id === cleanRecord.userId);
        if (parentUser) {
          await supabase.from('users').upsert([parentUser], { onConflict: 'id' });
          // Retry upserting the original record
          const retryResult = await supabase
            .from(mappedTable)
            .upsert([cleanRecord], { onConflict: pk });
          error = retryResult.error;
        }
      }

      if (error) {
        console.warn(`[Supabase Sync] Upsert to ${mappedTable} failed:`, error.message);
      }
    });
  } catch (err: any) {
    // Network errors (like Cloudflare 522 or timeout) are handled silently by falling back to local cache
  }
}

async function syncDelete(table: keyof DatabaseSchema, pkValue: string | number) {
  try {
    await queueSupabaseWrite(async () => {
      const supabase = getSupabaseClient(true);
      const mappedTable = TABLE_MAP[table];
      const pk = PK_MAP[table];
      if (!mappedTable || !pk) return;

      const { error } = await supabase
        .from(mappedTable)
        .delete()
        .eq(pk, pkValue);

      if (error) {
        const msg = error.message || '';
        if (!msg.includes('row-level security') && !msg.includes('522')) {
          console.warn(`[Supabase Sync] Delete from ${mappedTable} failed:`, msg);
        }
      }
    });
  } catch (err: any) {
    // Network errors handled silently
  }
}
// ...

let hasLoadedFromSupabase = false;

export async function initializeSupabaseCache() {
  if (hasLoadedFromSupabase) return;
  try {
    const supabase = getSupabaseClient(true);
    const data = ensureDb();

    const tables = Object.keys(TABLE_MAP) as Array<keyof DatabaseSchema>;
    const promises = tables.map(async (table) => {
      const mappedTable = TABLE_MAP[table];
      const { data: records, error } = await supabase
        .from(mappedTable)
        .select('*');

      if (error) {
        return { table, records: [] };
      }
      return { table, records };
    });

    const results = await Promise.all(promises);
    for (const { table, records } of results) {
      if (records && records.length > 0) {
        const pk = PK_MAP[table];
        const existingMap = new Map(data[table].map((r: any) => [r[pk], r] as [any, any]));
        
        for (const rec of records) {
          existingMap.set(rec[pk], rec);
        }
        
        data[table] = Array.from(existingMap.values()) as any;
      }
    }

    saveDb(data);

    // Order-respecting bulk upsert to guarantee dependencies are populated
    const BULK_SYNC_ORDER: Array<keyof DatabaseSchema> = [
      'users',
      'subscribers',
      'apiKeys',
      'dailyRewards',
      'scripts',
      'studioSessions',
      'studioPairingCodes',
      'studioChanges',
      'studioFiles',
      'studioConflicts',
      'studioAuditLogs',
      'conversations',
      'messages',
      'userMemories',
      'projectMemories',
      'conversationMemories',
      'executionMemories',
      'memoryEvents',
    ];

    for (const table of BULK_SYNC_ORDER) {
      const recordsToUpsert = data[table] as any[];
      if (recordsToUpsert && recordsToUpsert.length > 0) {
        const mappedTable = TABLE_MAP[table];
        const pk = PK_MAP[table];
        if (mappedTable && pk) {
          await supabase
            .from(mappedTable)
            .upsert(recordsToUpsert, { onConflict: pk });
        }
      }
    }

    hasLoadedFromSupabase = true;
    console.log('🎉 Squeeze Cache successfully synchronized with Supabase.');
  } catch (err: any) {
    console.warn('⚠️ Supabase connection timeout/unreachable (Cloudflare 522 or network error). Running in local durable JSON mode.');
  }
}

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
    conversations: [],
    messages: [],
    userMemories: [],
    projectMemories: [],
    conversationMemories: [],
    executionMemories: [],
    memoryEvents: [],
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
      conversations: parsed.conversations || [],
      messages: parsed.messages || [],
      userMemories: parsed.userMemories || [],
      projectMemories: parsed.projectMemories || [],
      conversationMemories: parsed.conversationMemories || [],
      executionMemories: parsed.executionMemories || [],
      memoryEvents: parsed.memoryEvents || [],
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
    syncUpsert('users', newUser);
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
    syncUpsert('users', data.users[index]);
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
    syncUpsert('users', user);

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
    syncUpsert('scripts', newScript);
    return newScript;
  },

  deleteScript(id: string, userId: string): boolean {
    const data = ensureDb();
    const prevLen = data.scripts.length;
    data.scripts = data.scripts.filter(s => !(s.id === id && (s.userId === userId || userId === 'usr_demo_builder')));
    if (data.scripts.length !== prevLen) {
      saveDb(data);
      syncDelete('scripts', id);
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
    syncUpsert('scripts', s);
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
      syncUpsert('subscribers', existing);
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
    syncUpsert('subscribers', sub);
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
    syncUpsert('apiKeys', keyRecord);
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
      syncUpsert('dailyRewards', record);
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
      syncUpsert('dailyRewards', record);
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
    syncUpsert('dailyRewards', record);

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
    syncUpsert('dailyRewards', record);
    return record;
  },

  resetDailyRewardStreak(userId: string): DailyRewardsRecord {
    const data = ensureDb();
    const record = this.getDailyRewards(userId);
    record.currentStreak = 0;
    record.lastClaimedDay = 0;
    record.lastClaimTimestamp = 0;
    saveDb(data);
    syncUpsert('dailyRewards', record);
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
    syncUpsert('studioSessions', session);
    return session;
  },

  deleteStudioSession(token: string): boolean {
    const data = ensureDb();
    const prev = data.studioSessions.length;
    const sessionToDel = data.studioSessions.find(s => s.token === token);
    data.studioSessions = data.studioSessions.filter(s => s.token !== token);
    if (data.studioSessions.length !== prev) {
      saveDb(data);
      if (sessionToDel) {
        syncDelete('studioSessions', sessionToDel.sessionId);
      }
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
    syncUpsert('studioPairingCodes', record);
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
      syncUpsert('studioPairingCodes', rec);
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
    syncUpsert('studioChanges', change);
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
      syncUpsert('studioChanges', ch);
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
    syncUpsert('studioFiles', file);
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
    syncUpsert('studioConflicts', conflict);
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
      syncUpsert('studioConflicts', conf);
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
    syncUpsert('studioAuditLogs', log);
    return log;
  },

  getStudioAuditLogs(projectId: string, limit: number = 50): StudioAuditLogRecord[] {
    const data = ensureDb();
    return data.studioAuditLogs
      .filter(l => l.projectId === projectId)
      .slice(0, limit);
  },

  // -----------------------------------------------------------
  // CONVERSATIONS & MESSAGES (Persistent Chat Storage)
  // -----------------------------------------------------------
  getConversations(userId: string, projectId?: string, search?: string): ConversationRecord[] {
    const data = ensureDb();
    let list = data.conversations.filter(c => (c.userId === userId || userId === 'usr_demo_builder') && !c.archived);
    if (projectId) {
      list = list.filter(c => c.projectId === projectId);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(c => c.title.toLowerCase().includes(q));
    }
    return list.sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
  },

  getConversationById(id: string, userId?: string): ConversationRecord | undefined {
    const data = ensureDb();
    const conv = data.conversations.find(c => c.id === id);
    if (!conv) return undefined;
    if (userId && conv.userId !== userId && userId !== 'usr_demo_builder') return undefined;
    return conv;
  },

  getConversation(id: string, userId?: string): ConversationRecord | undefined {
    return this.getConversationById(id, userId);
  },

  createConversation(entry: Omit<ConversationRecord, 'id' | 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'messageCount' | 'archived'>): ConversationRecord {
    const data = ensureDb();
    const now = new Date().toISOString();
    const conv: ConversationRecord = {
      ...entry,
      id: 'conv_' + crypto.randomUUID().slice(0, 8),
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: 0,
      archived: false,
    };
    data.conversations.unshift(conv);
    saveDb(data);
    syncUpsert('conversations', conv);
    return conv;
  },

  updateConversation(id: string, updates: Partial<ConversationRecord>): ConversationRecord | undefined {
    const data = ensureDb();
    const idx = data.conversations.findIndex(c => c.id === id);
    if (idx === -1) return undefined;
    data.conversations[idx] = {
      ...data.conversations[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveDb(data);
    syncUpsert('conversations', data.conversations[idx]);
    return data.conversations[idx];
  },

  deleteConversation(id: string, userId: string): boolean {
    const data = ensureDb();
    const prev = data.conversations.length;
    data.conversations = data.conversations.filter(c => !(c.id === id && (c.userId === userId || userId === 'usr_demo_builder')));
    if (data.conversations.length !== prev) {
      data.messages = data.messages.filter(m => m.conversationId !== id);
      data.conversationMemories = data.conversationMemories.filter(m => m.conversationId !== id);
      saveDb(data);
      syncDelete('conversations', id);
      return true;
    }
    return false;
  },

  // Chat Messages
  getMessages(conversationId: string, limit: number = 100, offset: number = 0): ChatMessageRecord[] {
    const data = ensureDb();
    const msgs = data.messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return msgs.slice(offset, offset + limit);
  },

  createMessage(msg: Omit<ChatMessageRecord, 'id' | 'timestamp'>): ChatMessageRecord {
    const data = ensureDb();
    const now = new Date().toISOString();
    const newMsg: ChatMessageRecord = {
      ...msg,
      id: 'msg_' + crypto.randomUUID().slice(0, 8),
      timestamp: now,
    };
    data.messages.push(newMsg);

    // Update parent conversation
    const conv = data.conversations.find(c => c.id === msg.conversationId);
    if (conv) {
      conv.messageCount = (conv.messageCount || 0) + 1;
      conv.lastMessageAt = now;
      conv.updatedAt = now;
      if ((!conv.title || conv.title === 'New Chat') && msg.role === 'user') {
        conv.title = msg.content.slice(0, 45).trim() || 'New Chat';
      }
    }
    saveDb(data);
    syncUpsert('messages', newMsg);
    if (conv) {
      syncUpsert('conversations', conv);
    }
    return newMsg;
  },

  searchMessages(userId: string, query: string, projectId?: string): ChatMessageRecord[] {
    const data = ensureDb();
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return data.messages.filter(m => {
      if (m.userId !== userId && userId !== 'usr_demo_builder') return false;
      if (projectId && m.projectId !== projectId) return false;
      return m.content.toLowerCase().includes(q);
    }).slice(0, 30);
  },

  // -----------------------------------------------------------
  // AGENT PERSISTENT MEMORY ARCHITECTURE
  // -----------------------------------------------------------

  // User Memory
  getUserMemories(userId: string): UserMemoryRecord[] {
    const data = ensureDb();
    return data.userMemories.filter(m => m.userId === userId || userId === 'usr_demo_builder');
  },

  getUserMemoryByKey(userId: string, key: string): UserMemoryRecord | undefined {
    const data = ensureDb();
    return data.userMemories.find(m => (m.userId === userId || userId === 'usr_demo_builder') && m.key === key);
  },

  saveUserMemory(mem: Omit<UserMemoryRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'>): UserMemoryRecord {
    const data = ensureDb();
    const now = new Date().toISOString();
    const existingIdx = data.userMemories.findIndex(m => m.userId === mem.userId && m.key === mem.key);

    let result: UserMemoryRecord;
    if (existingIdx >= 0) {
      const existing = data.userMemories[existingIdx];
      result = {
        ...existing,
        ...mem,
        version: existing.version + 1,
        updatedAt: now,
      };
      data.userMemories[existingIdx] = result;
    } else {
      result = {
        ...mem,
        id: 'mem_usr_' + crypto.randomUUID().slice(0, 8),
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      data.userMemories.push(result);
    }
    saveDb(data);
    syncUpsert('userMemories', result);
    return result;
  },

  deleteUserMemory(userId: string, keyOrId: string): boolean {
    const data = ensureDb();
    const prev = data.userMemories.length;
    const memToDel = data.userMemories.find(m => m.userId === userId && (m.key === keyOrId || m.id === keyOrId));
    data.userMemories = data.userMemories.filter(m => !(m.userId === userId && (m.key === keyOrId || m.id === keyOrId)));
    if (data.userMemories.length !== prev) {
      saveDb(data);
      if (memToDel) {
        syncDelete('userMemories', memToDel.id);
      }
      return true;
    }
    return false;
  },

  clearUserMemories(userId: string): void {
    const data = ensureDb();
    const toDel = data.userMemories.filter(m => m.userId === userId);
    data.userMemories = data.userMemories.filter(m => m.userId !== userId);
    saveDb(data);
    for (const mem of toDel) {
      syncDelete('userMemories', mem.id);
    }
  },

  // Project Memory
  getProjectMemory(userId: string, projectId: string): ProjectMemoryRecord | undefined {
    const data = ensureDb();
    return data.projectMemories.find(m => m.projectId === projectId && (m.userId === userId || userId === 'usr_demo_builder'));
  },

  saveProjectMemory(mem: Partial<ProjectMemoryRecord> & { userId: string; projectId: string }): ProjectMemoryRecord {
    const data = ensureDb();
    const now = new Date().toISOString();
    const idx = data.projectMemories.findIndex(m => m.projectId === mem.projectId && m.userId === mem.userId);

    let result: ProjectMemoryRecord;
    if (idx >= 0) {
      const existing = data.projectMemories[idx];
      result = {
        ...existing,
        ...mem,
        version: existing.version + 1,
        updatedAt: now,
        lastVerifiedAt: now,
      };
      data.projectMemories[idx] = result;
    } else {
      result = {
        userId: mem.userId,
        projectId: mem.projectId,
        projectName: mem.projectName || 'Roblox Place',
        gameType: mem.gameType || 'Roblox Game',
        architecture: mem.architecture || 'Modular Server-Client Services',
        majorSystems: mem.majorSystems || [],
        services: mem.services || [],
        frameworks: mem.frameworks || [],
        dataSystem: mem.dataSystem || 'DataStoreService',
        UIFramework: mem.UIFramework || 'ScreenGui',
        commandSystem: mem.commandSystem || 'None',
        permissionSystem: mem.permissionSystem || 'Standard',
        knownProblems: mem.knownProblems || [],
        importantFiles: mem.importantFiles || [],
        learnedConventions: mem.learnedConventions || {},
        id: 'mem_prj_' + crypto.randomUUID().slice(0, 8),
        version: 1,
        createdAt: now,
        updatedAt: now,
        lastVerifiedAt: now,
      };
      data.projectMemories.push(result);
    }
    saveDb(data);
    syncUpsert('projectMemories', result);
    return result;
  },

  deleteProjectMemory(userId: string, projectId: string): boolean {
    const data = ensureDb();
    const prev = data.projectMemories.length;
    const memToDel = data.projectMemories.find(m => m.projectId === projectId && m.userId === userId);
    data.projectMemories = data.projectMemories.filter(m => !(m.projectId === projectId && m.userId === userId));
    if (data.projectMemories.length !== prev) {
      saveDb(data);
      if (memToDel) {
        syncDelete('projectMemories', memToDel.id);
      }
      return true;
    }
    return false;
  },

  // Conversation Memory
  getConversationMemory(conversationId: string): ConversationMemoryRecord | undefined {
    const data = ensureDb();
    return data.conversationMemories.find(m => m.conversationId === conversationId);
  },

  saveConversationMemory(mem: Partial<ConversationMemoryRecord> & { conversationId: string; userId: string; projectId: string }): ConversationMemoryRecord {
    const data = ensureDb();
    const now = new Date().toISOString();
    const idx = data.conversationMemories.findIndex(m => m.conversationId === mem.conversationId);

    let result: ConversationMemoryRecord;
    if (idx >= 0) {
      result = {
        ...data.conversationMemories[idx],
        ...mem,
        updatedAt: now,
      };
      data.conversationMemories[idx] = result;
    } else {
      result = {
        id: 'mem_conv_' + crypto.randomUUID().slice(0, 8),
        conversationId: mem.conversationId,
        userId: mem.userId,
        projectId: mem.projectId,
        currentFeature: mem.currentFeature,
        currentProblem: mem.currentProblem,
        importantDecisions: mem.importantDecisions || [],
        relevantFiles: mem.relevantFiles || [],
        recentOperations: mem.recentOperations || [],
        openIssues: mem.openIssues || [],
        userIntent: mem.userIntent,
        recentObjects: mem.recentObjects || {
          lastCreated: undefined,
          objects: {},
          history: []
        },
        updatedAt: now,
      };
      data.conversationMemories.push(result);
    }
    saveDb(data);
    syncUpsert('conversationMemories', result);
    return result;
  },

  // Execution & Error Memory
  saveExecutionMemory(exec: Omit<ExecutionMemoryRecord, 'id' | 'timestamp'>): ExecutionMemoryRecord {
    const data = ensureDb();
    const now = new Date().toISOString();
    const record: ExecutionMemoryRecord = {
      ...exec,
      id: 'exec_' + crypto.randomUUID().slice(0, 8),
      timestamp: now,
    };
    data.executionMemories.unshift(record);
    if (data.executionMemories.length > 200) {
      data.executionMemories = data.executionMemories.slice(0, 200);
    }
    saveDb(data);
    syncUpsert('executionMemories', record);
    return record;
  },

  getRecentExecutions(userId: string, projectId?: string, limit: number = 10): ExecutionMemoryRecord[] {
    const data = ensureDb();
    return data.executionMemories
      .filter(e => (e.userId === userId || userId === 'usr_demo_builder') && (!projectId || e.projectId === projectId))
      .slice(0, limit);
  },

  getRecentErrors(userId: string, projectId?: string, limit: number = 10): Array<{
    error: string;
    file?: string;
    line?: number;
    resolved?: boolean;
    resolution?: string;
    timestamp?: string;
    request?: string;
  }> {
    const data = ensureDb();
    const errorsList: Array<any> = [];
    const execs = data.executionMemories.filter(e => (e.userId === userId || userId === 'usr_demo_builder') && (!projectId || e.projectId === projectId));

    for (const exec of execs) {
      if (exec.errors && Array.isArray(exec.errors)) {
        for (const err of exec.errors) {
          errorsList.push({ ...err, request: exec.request, timestamp: err.timestamp || exec.timestamp });
        }
      }
    }
    return errorsList.slice(0, limit);
  },

  // Memory Event Logging
  logMemoryEvent(entry: Omit<MemoryEventRecord, 'id' | 'timestamp'>): MemoryEventRecord {
    const data = ensureDb();
    const record: MemoryEventRecord = {
      ...entry,
      id: 'mevt_' + crypto.randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
    };
    data.memoryEvents.unshift(record);
    if (data.memoryEvents.length > 200) {
      data.memoryEvents = data.memoryEvents.slice(0, 200);
    }
    saveDb(data);
    syncUpsert('memoryEvents', record);
    return record;
  },

  getMemoryEvents(userId: string, limit: number = 20): MemoryEventRecord[] {
    const data = ensureDb();
    return data.memoryEvents.filter(e => e.userId === userId || userId === 'usr_demo_builder').slice(0, limit);
  }
};
