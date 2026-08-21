export interface RobloxSkill {
  id: string;
  title: string;
  category: 
    | 'Roblox Core' 
    | 'Architecture' 
    | 'Gameplay' 
    | 'Roblox Monetization' 
    | 'Data & Persistence' 
    | 'UI & UX' 
    | 'World & NPC' 
    | 'Effects & Audio' 
    | 'Security & Anti-Exploit' 
    | 'Optimization' 
    | 'Debugging' 
    | 'Advanced & Plugins';
  summary: string;
  keyServices: string[];
  apiDocsUrl: string;
  luauSnippet: string;
  bestPractices: string[];
  tags: string[];
}

export const ROBLOX_SKILLS_DATABASE: RobloxSkill[] = [
  // 1. ROBLOX CORE & STRICT LUAU
  {
    id: 'luau-strict-typing-signals',
    title: 'Strict Luau Types, Attributes & Custom Signals',
    category: 'Roblox Core',
    summary: 'Mastering --!strict type annotations, typed custom Event/Signal classes, and Instance Attributes for robust type safety.',
    keyServices: ['RunService', 'HttpService'],
    apiDocsUrl: 'https://luau-lang.org/typechecking',
    luauSnippet: `--!strict
export type Signal<T...> = {
\tConnect: (self: Signal<T...>, callback: (T...) -> ()) -> { Disconnect: () => () },
\tFire: (self: Signal<T...>, T...) -> (),
\tDestroy: (self: Signal<T...>) -> (),
}

local function createSignal<T...>(): Signal<T...>
\tlocal listeners: { [(T...) -> ()]: boolean } = {}
\tlocal self = {} :: Signal<T...>

\tfunction self:Connect(callback)
\t\tlisteners[callback] = true
\t\treturn {
\t\t\tDisconnect = function()
\t\t\t\tlisteners[callback] = nil
\t\t\tend
\t\t}
\tend

\tfunction self:Fire(...)
\t\tfor callback in pairs(listeners) do
\t\t\ttask.spawn(callback, ...)
\t\tend
\tend

\tfunction self:Destroy()
\t\ttable.clear(listeners)
\tend

\treturn self
end`,
    bestPractices: [
      'Always prepend --!strict at the top of every production Luau script.',
      'Declare explicit type definitions for PlayerState, InventoryItem, and NetworkPayloads.',
      'Use task.spawn inside signal firing to prevent one failing listener from halting execution.'
    ],
    tags: ['Luau', 'Strict', 'Signals', 'Types', 'Typechecking', 'Attributes']
  },

  // 2. ARCHITECTURE (CLIENT/SERVER & SERVICE/CONTROLLER)
  {
    id: 'service-controller-architecture',
    title: 'Service & Controller Singletons (Knit-Style)',
    category: 'Architecture',
    summary: 'Decoupled Client/Server architecture using Service singletons on the server and Controller singletons on the client with unified lifecycle initialization.',
    keyServices: ['ReplicatedStorage', 'ServerScriptService', 'Players'],
    apiDocsUrl: 'https://create.roblox.com/docs/scripting/modules',
    luauSnippet: `--!strict
-- Placed inside: ReplicatedStorage.Common.ServiceFramework (ModuleScript)
export type ServiceDef = {
\tName: string,
\tClient: { [string]: any },
\tInit: (self: any) -> (),
\tStart: (self: any) -> (),
\t[string]: any,
}

local Services: { [string]: ServiceDef } = {}

local Framework = {}

function Framework.CreateService(def: ServiceDef): ServiceDef
\tassert(not Services[def.Name], "Service already registered: " .. def.Name)
\tServices[def.Name] = def
\treturn def
end

function Framework.Start()
\t-- Phase 1: Initialize all services
\tfor name, svc in pairs(Services) do
\t\tif typeof(svc.Init) == "function" then
\t\t\tsvc:Init()
\t\tend
\tend
\t-- Phase 2: Start listeners and gameplay loops
\tfor name, svc in pairs(Services) do
\t\tif typeof(svc.Start) == "function" then
\t\t\ttask.spawn(svc.Start, svc)
\t\tend
\tend
\tprint("[Framework] All Services successfully booted!")
end

return Framework`,
    bestPractices: [
      'Separate lifecycle into Init (wiring remotes & listeners) and Start (running loops & state).',
      'Never cross-require services during initialization; access them only inside Start or methods.',
      'Expose client-safe endpoints under a dedicated .Client table.'
    ],
    tags: ['Architecture', 'Knit', 'Services', 'Controllers', 'ClientServer', 'Framework']
  },

  // 3. GAMEPLAY (INVENTORY, COMBAT, SHOPS)
  {
    id: 'server-authoritative-inventory',
    title: 'Server-Authoritative Inventory & Item Management',
    category: 'Gameplay',
    summary: 'Strict server-validated inventory system supporting item stacking, equipment slots, weight limits, and anti-duplication guards.',
    keyServices: ['ReplicatedStorage', 'HttpService', 'Players'],
    apiDocsUrl: 'https://create.roblox.com/docs/scripting/modules',
    luauSnippet: `--!strict
export type Item = {
\tUUID: string,
\tItemId: string,
\tAmount: number,
\tMaxStack: number,
\tEquipped: boolean,
\tMetadata: { [string]: any }?,
}

export type Inventory = {
\tOwnerId: number,
\tCapacity: number,
\tSlots: { [string]: Item },
}

local InventoryService = {}
local inventories: { [number]: Inventory } = {}

function InventoryService.AddItem(player: Player, itemId: string, amount: number): boolean
\tlocal inv = inventories[player.UserId]
\tif not inv then return false end
\t
\t-- Stacking check
\tfor uuid, item in pairs(inv.Slots) do
\t\tif item.ItemId == itemId and item.Amount < item.MaxStack then
\t\t\tlocal spaceLeft = item.MaxStack - item.Amount
\t\t\tlocal toAdd = math.min(spaceLeft, amount)
\t\t\titem.Amount += toAdd
\t\t\tamount -= toAdd
\t\t\tif amount <= 0 then return true end
\t\tend
\tend
\t
\t-- New slot allocation
\tlocal newUUID = game:GetService("HttpService"):GenerateGUID(false)
\tinv.Slots[newUUID] = {
\t\tUUID = newUUID,
\t\tItemId = itemId,
\t\tAmount = amount,
\t\tMaxStack = 99,
\t\tEquipped = false
\t}
\treturn true
end

return InventoryService`,
    bestPractices: [
      'Generate unique UUIDs per item instance using HttpService:GenerateGUID(false).',
      'Never allow the client to specify item quantities or grant items; only pass item interaction requests.',
      'Fire RemoteEvents to synchronize inventory differential deltas rather than replicating the entire table every change.'
    ],
    tags: ['Inventory', 'Items', 'Stacking', 'Equip', 'Economy', 'ServerValidation']
  },

  {
    id: 'raycast-combat-hitbox-v2',
    title: 'High-Speed Raycast & Shapecast Combat Hitbox',
    category: 'Gameplay',
    summary: 'Accurate melee, weapon, and projectile collision detection with server-side sanity distance bounds and lag compensation.',
    keyServices: ['Workspace', 'Players', 'Debris'],
    apiDocsUrl: 'https://create.roblox.com/docs/physics/raycasting',
    luauSnippet: `--!strict
local Workspace = game:GetService("Workspace")
local Players = game:GetService("Players")

export type HitResult = {
\tVictim: Model,
\tHumanoid: Humanoid,
\tHitPart: BasePart,
\tPosition: Vector3,
}

local function checkHitbox(attacker: Player, origin: Vector3, direction: Vector3, maxDistance: number): HitResult?
\tlocal char = attacker.Character
\tif not char or not char.PrimaryPart then return nil end
\t
\t-- Sanity distance check from attacker root part
\tif (origin - char.PrimaryPart.Position).Magnitude > 25 then
\t\twarn("[AntiExploit] Suspicious attack origin from " .. attacker.Name)
\t\treturn nil
\tend
\t
\tlocal params = RaycastParams.new()
\tparams.FilterType = Enum.RaycastFilterType.Exclude
\tparams.FilterDescendantsInstances = { char }
\tparams.IgnoreWater = true
\t
\tlocal result = Workspace:Raycast(origin, direction.Unit * maxDistance, params)
\tif result and result.Instance then
\t\tlocal hitModel = result.Instance:FindFirstAncestorOfClass("Model")
\t\tlocal hum = hitModel and hitModel:FindFirstChildOfClass("Humanoid")
\t\tif hum and hum.Health > 0 and hitModel ~= char then
\t\t\treturn {
\t\t\t\tVictim = hitModel,
\t\t\t\tHumanoid = hum,
\t\t\t\tHitPart = result.Instance,
\t\t\t\tPosition = result.Position,
\t\t\t}
\t\tend
\tend
\treturn nil
end`,
    bestPractices: [
      'Sanity check attacker distance and line of sight on the server before dealing damage.',
      'Use Shapecasts (Workspace:SphereCast / BlockCast) for sweeping heavy weapons or magic spells.',
      'Apply cooldown debounces on the server keyed to player UserId.'
    ],
    tags: ['Combat', 'Hitbox', 'Raycasting', 'Shapecast', 'Damage', 'Weapons', 'AntiExploit']
  },

  // 4. MONETIZATION (GAMEPASSES, DEVELOPER PRODUCTS & DONATION BOOTHS)
  {
    id: 'marketplace-process-receipt',
    title: 'MarketplaceService & Robust ProcessReceipt Handler',
    category: 'Roblox Monetization',
    summary: 'Enterprise Developer Product purchase fulfillment with idempotency, purchase history caching, and DataStore error resilience.',
    keyServices: ['MarketplaceService', 'DataStoreService', 'Players'],
    apiDocsUrl: 'https://create.roblox.com/docs/production/monetization/developer-products',
    luauSnippet: `--!strict
local MarketplaceService = game:GetService("MarketplaceService")
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local PurchaseHistoryStore = DataStoreService:GetDataStore("PurchaseHistory_v1")

local PRODUCT_HANDLERS: { [number]: (player: Player) -> boolean } = {
\t[12345678] = function(player)
\t\t-- Example: 100 Gems product
\t\tprint("💎 Granted 100 gems to " .. player.Name)
\t\treturn true
\tend,
}

local function processReceipt(receiptInfo: { [string]: any }): Enum.ProductPurchaseDecision
\tlocal player = Players:GetPlayerByUserId(receiptInfo.PlayerId)
\tif not player then
\t\treturn Enum.ProductPurchaseDecision.NotProcessedYet
\tend
\t
\tlocal purchaseKey = "Purchase_" .. receiptInfo.PurchaseId
\tlocal alreadyGranted = false
\t
\t-- Check idempotency
\tpcall(function()
\t\talreadyGranted = PurchaseHistoryStore:GetAsync(purchaseKey) == true
\tend)
\t
\tif alreadyGranted then
\t\treturn Enum.ProductPurchaseDecision.PurchaseGranted
\tend
\t
\tlocal handler = PRODUCT_HANDLERS[receiptInfo.ProductId]
\tif handler and handler(player) then
\t\tpcall(function()
\t\t\tPurchaseHistoryStore:SetAsync(purchaseKey, true)
\t\tend)
\t\treturn Enum.ProductPurchaseDecision.PurchaseGranted
\tend
\t
\treturn Enum.ProductPurchaseDecision.NotProcessedYet
end

MarketplaceService.ProcessReceipt = processReceipt`,
    bestPractices: [
      'Always return NotProcessedYet if player is offline or DataStore update fails so Roblox retries automatically.',
      'Record receipt.PurchaseId to ensure a product is never granted twice.',
      'Never award items on the client; grant currency and inventory on the server.'
    ],
    tags: ['MarketplaceService', 'DeveloperProducts', 'ProcessReceipt', 'Monetization', 'GamePasses', 'Donation']
  },

  // 5. DATA & PERSISTENCE (DATASTORE & PROFILESERVICE)
  {
    id: 'profileservice-session-locking',
    title: 'ProfileService & Session-Locking DataStore Engine',
    category: 'Data & Persistence',
    summary: 'Industry-standard player data persistence preventing data duplication, rollback exploits, and race condition corruption.',
    keyServices: ['DataStoreService', 'Players', 'RunService'],
    apiDocsUrl: 'https://madstudioroblox.github.io/ProfileService/',
    luauSnippet: `--!strict
--!strict
local ProfileTemplate = {
\tCoins = 100,
\tGems = 0,
\tLevel = 1,
\tExperience = 0,
\tInventory = {} :: { string },
\tEquippedItems = {} :: { string },
\tLoginTimes = 0,
}

export type ProfileData = typeof(ProfileTemplate)

local PlayerDataService = {}
local Profiles: { [Player]: any } = {}

function PlayerDataService.GetProfileData(player: Player): ProfileData?
\tlocal profile = Profiles[player]
\tif profile then
\t\treturn profile.Data
\tend
\treturn nil
end

function PlayerDataService.AdjustCoins(player: Player, delta: number): boolean
\tlocal data = PlayerDataService.GetProfileData(player)
\tif data then
\t\tif data.Coins + delta >= 0 then
\t\t\tdata.Coins += delta
\t\t\treturn true
\t\tend
\tend
\treturn false
end

return PlayerDataService`,
    bestPractices: [
      'Enforce session-locking so player data is accessible by only one server instance at a time.',
      'Always include game:BindToClose to release and save all profiles on server termination.',
      'Use schema migrations to safely introduce new keys to existing player profiles without resetting.'
    ],
    tags: ['ProfileService', 'DataStore', 'SessionLocking', 'Persistence', 'AntiCorruption', 'PlayerData']
  },

  // 6. UI & UX (TWEENSERVICE, RESPONSIVE & CONTROLLER)
  {
    id: 'responsive-ui-animations',
    title: 'TweenService UI Systems & Controller Navigation',
    category: 'UI & UX',
    summary: 'Polished responsive interface animations, spring physics popups, and cross-platform Gamepad/Mobile touch layout scaling.',
    keyServices: ['TweenService', 'GuiService', 'UserInputService'],
    apiDocsUrl: 'https://create.roblox.com/docs/ui',
    luauSnippet: `--!strict
local TweenService = game:GetService("TweenService")
local GuiService = game:GetService("GuiService")

local function openModalSpring(frame: Frame)
\tframe.Visible = true
\tframe.Position = UDim2.fromScale(0.5, 0.6)
\tframe.Size = UDim2.fromScale(0.35, 0.35)
\tframe.GroupTransparency = 1
\t
\tlocal tween = TweenService:Create(frame, TweenInfo.new(0.4, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
\t\tPosition = UDim2.fromScale(0.5, 0.5),
\t\tSize = UDim2.fromScale(0.4, 0.4),
\t\tGroupTransparency = 0
\t})
\ttween:Play()
end`,
    bestPractices: [
      'Use CanvasGroup or GroupTransparency for smooth whole-panel fade transitions.',
      'Set GuiObject.NextSelectionUp/Down/Left/Right for full Gamepad UI navigation support.',
      'Scale UI with Scale + UIAspectRatioConstraint rather than static Offset pixels.'
    ],
    tags: ['UI', 'ScreenGui', 'TweenService', 'Responsive', 'Gamepad', 'Modal', 'CanvasGroup']
  },

  // 7. SECURITY & ANTI-EXPLOIT
  {
    id: 'anti-exploit-server-authority',
    title: 'Anti-Exploit Server Authority & Rate Limiting',
    category: 'Security & Anti-Exploit',
    summary: 'Defensive server-authoritative netcode with token-bucket rate limiting, parameter type assertion, and speed/teleport validation.',
    keyServices: ['RunService', 'Players'],
    apiDocsUrl: 'https://create.roblox.com/docs/scripting/security',
    luauSnippet: `--!strict
local rateLimits: { [number]: { count: number, resetTime: number } } = {}

local function validateRemoteCall(player: Player, maxCallsPerSec: number): boolean
\tlocal now = os.clock()
\tlocal bucket = rateLimits[player.UserId]
\t
\tif not bucket or now > bucket.resetTime then
\t\trateLimits[player.UserId] = { count = 1, resetTime = now + 1.0 }
\t\treturn true
\tend
\t
\tbucket.count += 1
\tif bucket.count > maxCallsPerSec then
\t\twarn(string.format("⚠️ [Security] Rate limit exceeded by %s (%d calls/sec)", player.Name, bucket.count))
\t\treturn false
\tend
\treturn true
end

local function validatePositionDistance(player: Player, targetPos: Vector3, maxAllowedRange: number): boolean
\tlocal char = player.Character
\tlocal root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
\tif not root then return false end
\t
\tlocal distance = (root.Position - targetPos).Magnitude
\treturn distance <= maxAllowedRange
end`,
    bestPractices: [
      'Never trust arguments received from the client; always assert and re-validate on the server.',
      'Check player character distance to interactive objects before granting chests or purchases.',
      'Set NetworkOwnership explicitly to the server for critical physics objects to prevent flinging.'
    ],
    tags: ['Security', 'AntiExploit', 'RateLimit', 'RemoteEvents', 'SanityCheck', 'ServerAuthority']
  },

  // 8. OPTIMIZATION & PERFORMANCE
  {
    id: 'streaming-enabled-connection-cleanup',
    title: 'StreamingEnabled & Memory Leak Prevention (Trove/Maid)',
    category: 'Optimization',
    summary: 'High-performance instance streaming architecture, automatic connection disconnects, and thread recycling with task.defer/task.spawn.',
    keyServices: ['RunService', 'CollectionService', 'Workspace'],
    apiDocsUrl: 'https://create.roblox.com/docs/workspace/streaming',
    luauSnippet: `--!strict
export type Maid = {
\tGiveTask: (self: Maid, task: RBXScriptConnection | () -> () | Instance) -> (),
\tClean: (self: Maid) -> (),
}

local function createMaid(): Maid
\tlocal tasks: { any } = {}
\tlocal self = {} :: Maid
\t
\tfunction self:GiveTask(item)
\t\ttable.insert(tasks, item)
\tend
\t
\tfunction self:Clean()
\t\tfor _, item in ipairs(tasks) do
\t\t\tif typeof(item) == "RBXScriptConnection" then
\t\t\t\titem:Disconnect()
\t\t\telseif typeof(item) == "function" then
\t\t\t\tpcall(item)
\t\t\telseif typeof(item) == "Instance" then
\t\t\t\titem:Destroy()
\t\t\tend
\t\tend
\t\ttable.clear(tasks)
\tend
\t
\treturn self
end`,
    bestPractices: [
      'Always disconnect event listeners when characters respawn or UI unmounts to prevent memory leaks.',
      'Use CollectionService:GetInstanceAddedSignal / RemovedSignal for StreamingEnabled-safe object loading.',
      'Use task.wait() or RunService.Heartbeat rather than deprecated wait() or spawn().'
    ],
    tags: ['Optimization', 'Memory', 'Maid', 'Trove', 'StreamingEnabled', 'Performance', 'GarbageCollection']
  }
];

export function searchRobloxSkills(query: string): RobloxSkill[] {
  const q = query.toLowerCase().trim();
  if (!q) return ROBLOX_SKILLS_DATABASE.slice(0, 8);

  const words = q.split(/\s+/).filter(w => w.length > 1);

  return ROBLOX_SKILLS_DATABASE.filter(skill => {
    const haystack = `${skill.title} ${skill.summary} ${skill.category} ${skill.keyServices.join(' ')} ${skill.tags.join(' ')} ${skill.bestPractices.join(' ')}`.toLowerCase();
    return words.some(w => haystack.includes(w));
  });
}
