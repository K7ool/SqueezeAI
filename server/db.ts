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

interface DatabaseSchema {
  users: UserRecord[];
  scripts: GeneratedScriptRecord[];
  subscribers: SubscriberRecord[];
  apiKeys: ApiKeyRecord[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'squeeze_db.json');

// Ensure data directory and file exist
function ensureDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
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
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { users: [], scripts: [], subscribers: [], apiKeys: [] };
  }
}

function saveDb(db: DatabaseSchema) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
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
  }
};
