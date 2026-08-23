import { ProjectFileInfo } from './ai';

export interface SystemNode {
  id: string;
  name: string;
  category: 'Core' | 'Gameplay' | 'Data' | 'UI' | 'Security' | 'Monetization' | 'World' | 'Effects' | 'Networking';
  description: string;
  fileIds: string[];
  filePaths: string[];
  dependencies: string[];
  dependents: string[];
  status: 'healthy' | 'warning' | 'error';
  warnings: string[];
  errors: string[];
  x: number;
  y: number;
  isSuggested?: boolean;
  featureCount?: number;
}

export interface SystemConnection {
  id: string;
  fromId: string;
  toId: string;
  type: 'dependency' | 'related'; // dependency = solid, related = dashed
  health: 'healthy' | 'warning' | 'error';
  reason: string;
}

export interface SuggestedFeatureNode {
  id: string;
  name: string;
  category: 'Gameplay' | 'Monetization' | 'Social' | 'Progression' | 'VFX';
  description: string;
  recommendedScripts: {
    name: string;
    path: string;
    type: 'Server Script' | 'LocalScript' | 'ModuleScript';
    target: string;
  }[];
  rationale: string;
}

export interface ProjectHealthAudit {
  score: number;
  totalSystems: number;
  totalFiles: number;
  warningsCount: number;
  errorsCount: number;
  securityIssuesCount: number;
  optimizationOpportunitiesCount: number;
  missingSystemsCount: number;
  securityIssues: string[];
  optimizationNotes: string[];
  missingSystems: string[];
  lastAudited: number;
  nodes: SystemNode[];
  connections: SystemConnection[];
  suggestedFeatures: SuggestedFeatureNode[];
}

/**
 * Builds the complete dynamic interactive Game Map graph from the real loaded files
 */
export function buildDynamicGameMap(files: ProjectFileInfo[], projectName: string = "Roblox Game"): ProjectHealthAudit {
  const nodes: SystemNode[] = [];
  const connections: SystemConnection[] = [];
  const securityIssues: string[] = [];
  const optimizationNotes: string[] = [];
  const missingSystems: string[] = [];

  const fileMap = new Map<string, ProjectFileInfo>();
  for (const f of files) {
    fileMap.set(f.path, f);
  }

  // 1. Root Core Node
  const coreNodeId = 'system-core';
  nodes.push({
    id: coreNodeId,
    name: `Core: ${projectName}`,
    category: 'Core',
    description: `Central Game Engine & Roblox DataModel lifecycle root for ${files.length} active scripts.`,
    fileIds: files.map((_, i) => `f-${i}`),
    filePaths: files.map(f => f.path),
    dependencies: [],
    dependents: [],
    status: 'healthy',
    warnings: [],
    errors: [],
    x: 0,
    y: 0,
  });

  // Track discovered subsystems
  const discovered: {
    id: string;
    name: string;
    category: SystemNode['category'];
    description: string;
    files: ProjectFileInfo[];
    keywords: RegExp;
    warnings: string[];
    errors: string[];
    security: string[];
  }[] = [
    {
      id: 'system-data',
      name: 'Data Persistence & Profiles',
      category: 'Data',
      description: 'Player data store, session-locking, autosaves, and profile management.',
      files: [],
      keywords: /datastore|profile|profileservice|save|load|getasync|setasync|updateasync/i,
      warnings: [],
      errors: [],
      security: [],
    },
    {
      id: 'system-inventory-economy',
      name: 'Inventory & Currency',
      category: 'Gameplay',
      description: 'Backpack inventory, leaderstats currencies, equipment slots, and item data.',
      files: [],
      keywords: /inventory|item|backpack|coins|gems|currency|gold|leaderstats|equip/i,
      warnings: [],
      errors: [],
      security: [],
    },
    {
      id: 'system-combat',
      name: 'Combat & Damage Engine',
      category: 'Gameplay',
      description: 'Weapon raycasting, hitbox calculation, health damage, and cooldown validation.',
      files: [],
      keywords: /combat|damage|hitbox|sword|weapon|raycast|shapecast|health|attack/i,
      warnings: [],
      errors: [],
      security: [],
    },
    {
      id: 'system-monetization',
      name: 'Shop & Marketplace',
      category: 'Monetization',
      description: 'Developer products, gamepasses, ProcessReceipt handling, and donation booths.',
      files: [],
      keywords: /shop|store|marketplaceservice|gamepass|developerproduct|receipt|donation|robux/i,
      warnings: [],
      errors: [],
      security: [],
    },
    {
      id: 'system-network',
      name: 'Networking & Remotes',
      category: 'Networking',
      description: 'Client-server RemoteEvent and RemoteFunction communication channels.',
      files: [],
      keywords: /remote|remoteevent|remotefunction|network|replicatedstorage|dispatcher/i,
      warnings: [],
      errors: [],
      security: [],
    },
    {
      id: 'system-ui',
      name: 'Interface & HUD Controllers',
      category: 'UI',
      description: 'ScreenGui views, TweenService animations, mobile touch controls, and health bars.',
      files: [],
      keywords: /ui|gui|screengui|frame|button|hud|view|tween|canvasgroup/i,
      warnings: [],
      errors: [],
      security: [],
    },
    {
      id: 'system-world-npc',
      name: 'World, Zones & NPC AI',
      category: 'World',
      description: 'PathfindingService navigation, enemy spawners, world zones, and proximity interactions.',
      files: [],
      keywords: /npc|pathfinding|zone|spawner|proximityprompt|pet|ai|teleport/i,
      warnings: [],
      errors: [],
      security: [],
    },
    {
      id: 'system-security',
      name: 'Anti-Exploit & Rate Limiter',
      category: 'Security',
      description: 'Server authority enforcement, parameter sanity checking, and remote debounce buckets.',
      files: [],
      keywords: /antiexploit|security|ratelimit|validate|sanitize|sanity|debounce/i,
      warnings: [],
      errors: [],
      security: [],
    },
  ];

  // Classify files into subsystems
  for (const f of files) {
    const code = f.code || "";
    const combined = `${f.path} ${f.name} ${code}`;
    let matched = false;

    for (const sys of discovered) {
      if (sys.keywords.test(combined)) {
        sys.files.push(f);
        matched = true;

        // Security & Health checks per file
        if (f.scriptType === 'Server Script') {
          if (!code.includes('--!strict')) {
            sys.warnings.push(`${f.name} is missing '--!strict' type annotation.`);
          }
          if (/DataStoreService/i.test(code) && !/pcall/i.test(code)) {
            sys.errors.push(`${f.name} calls DataStoreService without 'pcall' error guarding.`);
          }
          if (/OnServerEvent/i.test(code) && !/debounce|rate|clock/i.test(code)) {
            sys.warnings.push(`${f.name} handles RemoteEvent without server-side debounce/rate limit.`);
          }
        }
      }
    }

    // Default fallback to Core if unmatched
    if (!matched) {
      // General scripts
    }
  }

  // Radial positioning layout around Core
  // Include both active systems and default architecture modules
  const displaySubsystems = discovered.map(sys => {
    return {
      ...sys,
      isActive: sys.files.length > 0
    };
  });

  const totalSystems = displaySubsystems.length;
  const radius = 320;

  displaySubsystems.forEach((sys, idx) => {
    const angle = (idx / totalSystems) * 2 * Math.PI - Math.PI / 2;
    const x = Math.round(Math.cos(angle) * radius);
    const y = Math.round(Math.sin(angle) * radius);

    let status: SystemNode['status'] = 'healthy';
    if (sys.errors.length > 0) status = 'error';
    else if (sys.warnings.length > 0) status = 'warning';

    const nodeId = sys.id;
    nodes.push({
      id: nodeId,
      name: sys.name,
      category: sys.category,
      description: sys.files.length > 0 
        ? `${sys.description} (${sys.files.length} script${sys.files.length === 1 ? '' : 's'})`
        : `${sys.description} (Ready for generation)`,
      fileIds: sys.files.map(f => f.path),
      filePaths: sys.files.map(f => f.path),
      dependencies: [coreNodeId],
      dependents: [],
      status,
      warnings: sys.warnings,
      errors: sys.errors,
      x,
      y,
      featureCount: sys.files.length > 0 ? sys.files.length + 3 : 2,
    });

    // Connect from Core to System (Solid line)
    connections.push({
      id: `conn-core-${sys.id}`,
      fromId: coreNodeId,
      toId: nodeId,
      type: 'dependency',
      health: status,
      reason: `${projectName} core lifecycle boots and coordinates ${sys.name}.`,
    });
  });

  // Cross-system dependencies (e.g. Combat -> Inventory, Shop -> Data, UI -> Network)
  const hasData = nodes.some(n => n.id === 'system-data');
  const hasInventory = nodes.some(n => n.id === 'system-inventory-economy');
  const hasCombat = nodes.some(n => n.id === 'system-combat');
  const hasShop = nodes.some(n => n.id === 'system-monetization');
  const hasUI = nodes.some(n => n.id === 'system-ui');
  const hasNetwork = nodes.some(n => n.id === 'system-network');

  if (hasInventory && hasData) {
    connections.push({
      id: 'conn-inv-data',
      fromId: 'system-inventory-economy',
      toId: 'system-data',
      type: 'dependency',
      health: 'healthy',
      reason: 'Inventory and coin balances are saved to and restored from DataStore profiles.',
    });
  }

  if (hasCombat && hasInventory) {
    connections.push({
      id: 'conn-combat-inv',
      fromId: 'system-combat',
      toId: 'system-inventory-economy',
      type: 'related',
      health: 'healthy',
      reason: 'Combat queries inventory for weapon damage stats, attack speeds, and ammo items.',
    });
  }

  if (hasShop && hasData) {
    connections.push({
      id: 'conn-shop-data',
      fromId: 'system-monetization',
      toId: 'system-data',
      type: 'dependency',
      health: 'healthy',
      reason: 'In-game shop purchases and gamepass unlocks update player DataStore currency and item inventories.',
    });
  }

  if (hasUI && hasNetwork) {
    connections.push({
      id: 'conn-ui-net',
      fromId: 'system-ui',
      toId: 'system-network',
      type: 'dependency',
      health: 'healthy',
      reason: 'UI controllers trigger client-side RemoteEvents to request actions on the server.',
    });
  }

  // Missing System Gap Analysis
  if (!hasData) {
    missingSystems.push('PlayerData Persistence (DataStoreService / ProfileService) is not yet implemented.');
  }
  if (!hasCombat && !hasInventory) {
    missingSystems.push('Primary Gameplay Loop (Combat / Inventory / Progression) needs definition.');
  }
  if (!hasShop) {
    missingSystems.push('Monetization & In-Game Shop (MarketplaceService / Gamepasses) not detected.');
  }
  if (!hasNetwork && files.length > 2) {
    missingSystems.push('Centralized Network Bridge for clean RemoteEvent handling is missing.');
  }

  // Aggregated Warnings & Errors
  let totalWarnings = 0;
  let totalErrors = 0;
  for (const n of nodes) {
    totalWarnings += n.warnings?.length || 0;
    totalErrors += n.errors?.length || 0;
  }

  // Calculate Health Score (100 base, -10 per error, -3 per warning, -5 per missing core system)
  let score = 100 - totalErrors * 10 - totalWarnings * 3 - missingSystems.length * 5;
  score = Math.max(25, Math.min(100, score));

  // Suggested Next Features for Roblox Game
  const suggestedFeatures: SuggestedFeatureNode[] = [
    {
      id: 'sug-daily-rewards',
      name: 'Daily Login Rewards & Streak Multiplier',
      category: 'Progression',
      description: 'Increases 7-day retention by awarding scaling gold, gems, and VIP badges every 24 hours.',
      recommendedScripts: [
        {
          name: 'DailyRewardService.server.luau',
          path: 'src/server/DailyRewardService.server.luau',
          type: 'Server Script',
          target: 'ServerScriptService.DailyRewards',
        },
        {
          name: 'DailyRewardUI.client.luau',
          path: 'src/client/DailyRewardUI.client.luau',
          type: 'LocalScript',
          target: 'StarterPlayer.StarterPlayerScripts.DailyRewardUI',
        },
      ],
      rationale: 'Daily rewards are the highest-ROI retention mechanic for Roblox adventure and simulator games.',
    },
    {
      id: 'sug-pet-gacha',
      name: 'Pet Egg Hatching & Follower System',
      category: 'Gameplay',
      description: 'Gacha egg opening with 3D spring open animations, weighted rarity probabilities, and pet follower physics.',
      recommendedScripts: [
        {
          name: 'EggHatchService.server.luau',
          path: 'src/server/EggHatchService.server.luau',
          type: 'Server Script',
          target: 'ServerScriptService.EggHatchService',
        },
        {
          name: 'PetController.client.luau',
          path: 'src/client/PetController.client.luau',
          type: 'LocalScript',
          target: 'StarterPlayer.StarterPlayerScripts.PetController',
        },
      ],
      rationale: 'Equipping multiple pets creates a powerful upgrade chase that drives monetization and playtime.',
    },
    {
      id: 'sug-trading-hub',
      name: 'Secure 2-Party Player Item Trading Hub',
      category: 'Social',
      description: 'Two-player trade verification window with dual countdown locks and anti-scam atomic swaps.',
      recommendedScripts: [
        {
          name: 'TradeService.server.luau',
          path: 'src/server/TradeService.server.luau',
          type: 'Server Script',
          target: 'ServerScriptService.TradeService',
        },
        {
          name: 'TradeUI.client.luau',
          path: 'src/client/TradeUI.client.luau',
          type: 'LocalScript',
          target: 'StarterPlayer.StarterPlayerScripts.TradeUI',
        },
      ],
      rationale: 'Trading transforms single-player progression into a vibrant player-to-player game economy.',
    },
    {
      id: 'sug-leaderboard-podium',
      name: 'Global High-Score Podium & Top 10 Display',
      category: 'Monetization',
      description: 'OrderedDataStore podium displaying top players with character avatars and live leaderboard banners.',
      recommendedScripts: [
        {
          name: 'LeaderboardPodium.server.luau',
          path: 'src/server/LeaderboardPodium.server.luau',
          type: 'Server Script',
          target: 'ServerScriptService.LeaderboardPodium',
        },
      ],
      rationale: 'Competitive social visibility significantly stimulates gameplay drive and player spending.',
    },
  ];

  return {
    score,
    totalSystems: nodes.length,
    totalFiles: files.length,
    warningsCount: totalWarnings,
    errorsCount: totalErrors,
    securityIssuesCount: securityIssues.length,
    optimizationOpportunitiesCount: optimizationNotes.length,
    missingSystemsCount: missingSystems.length,
    securityIssues,
    optimizationNotes,
    missingSystems,
    lastAudited: Date.now(),
    nodes,
    connections,
    suggestedFeatures,
  };
}
