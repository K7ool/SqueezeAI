export interface RobloxSkill {
  id: string;
  title: string;
  category: 'Services' | 'Mechanics' | 'Combat' | 'Networking' | 'Physics' | 'Data & Monetization' | 'UI & VFX';
  summary: string;
  keyServices: string[];
  apiDocsUrl: string;
  luauSnippet: string;
  bestPractices: string[];
  tags: string[];
}

export const ROBLOX_SKILLS_DATABASE: RobloxSkill[] = [
  {
    id: 'pathfinding-npc-pet',
    title: 'PathfindingService & Pet/NPC AI Follower',
    category: 'Mechanics',
    summary: 'Calculates smooth navigation waypoints avoiding obstacles, jumping over gaps, and following players authoritatively.',
    keyServices: ['PathfindingService', 'Players', 'Workspace'],
    apiDocsUrl: 'https://create.roblox.com/docs/mechanics/pathfinding',
    luauSnippet: `--!strict
local PathfindingService = game:GetService("PathfindingService")

local path = PathfindingService:CreatePath({
\tAgentRadius = 2.0,
\tAgentHeight = 5.0,
\tAgentCanJump = true,
\tWaypointSpacing = 4.0,
})

local function computeAndMoveTo(humanoid: Humanoid, targetPosition: Vector3)
\tlocal rootPart = humanoid.RootPart
\tif not rootPart then return end
\t
\tlocal success, errorMessage = pcall(function()
\t\tpath:ComputeAsync(rootPart.Position, targetPosition)
\tend)
\t
\tif success and path.Status == Enum.PathStatus.Success then
\t\tlocal waypoints = path:GetWaypoints()
\t\tfor _, waypoint in ipairs(waypoints) do
\t\t\tif waypoint.Action == Enum.PathWaypointAction.Jump then
\t\t\t\thumanoid.Jump = true
\t\t\tend
\t\t\thumanoid:MoveTo(waypoint.Position)
\t\t\thumanoid.MoveToFinished:Wait()
\t\tend
\tend
end`,
    bestPractices: [
      'Compute paths on the server or give client network ownership for zero-lag pets.',
      'Check path.Blocked to re-compute dynamically when obstacles move.',
      'Use PathfindingModifiers to tag dangerous areas like lava or water with high pass costs.'
    ],
    tags: ['Pathfinding', 'Pet', 'NPC', 'AI', 'MoveTo', 'Waypoints']
  },
  {
    id: 'datastore-safe-saving',
    title: 'DataStoreService & Safe Player Data Persistence',
    category: 'Data & Monetization',
    summary: 'Production-grade data saving with UpdateAsync, session locking, retry pcalls, and BindToClose graceful shutdown.',
    keyServices: ['DataStoreService', 'Players', 'RunService'],
    apiDocsUrl: 'https://create.roblox.com/docs/cloud-services/datastores',
    luauSnippet: `--!strict
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local PlayerDataStore = DataStoreService:GetDataStore("PlayerData_v1.0")

export type PlayerData = {
\tCoins: number,
\tGems: number,
\tLevel: number,
\tInventory: { string },
}

local DEFAULT_DATA: PlayerData = {
\tCoins = 0,
\tGems = 0,
\tLevel = 1,
\tInventory = {},
}

local sessionCache: { [number]: PlayerData } = {}

local function loadData(player: Player)
\tlocal key = "Player_" .. player.UserId
\tlocal success, result = pcall(function()
\t\treturn PlayerDataStore:GetAsync(key)
\tend)
\t
\tif success and result then
\t\tsessionCache[player.UserId] = result :: PlayerData
\telse
\t\tsessionCache[player.UserId] = table.clone(DEFAULT_DATA)
\tend
end

local function saveData(player: Player)
\tlocal data = sessionCache[player.UserId]
\tif not data then return end
\t
\tlocal key = "Player_" .. player.UserId
\tlocal success, err = pcall(function()
\t\tPlayerDataStore:UpdateAsync(key, function(_oldValue)
\t\t\treturn data
\t\tend)
\tend)
\tif not success then
\t\twarn("[DataStore] Save failed for " .. player.Name .. ": " .. tostring(err))
\tend
\tsessionCache[player.UserId] = nil
end

Players.PlayerAdded:Connect(loadData)
Players.PlayerRemoving:Connect(saveData)

game:BindToClose(function()
\tfor _, player in ipairs(Players:GetPlayers()) do
\t\ttask.spawn(saveData, player)
\tend
\tif RunService:IsStudio() then
\t\ttask.wait(2)
\tend
end)`,
    bestPractices: [
      'Always use UpdateAsync instead of SetAsync to prevent data overwrite collisions.',
      'Always bind to game:BindToClose to ensure data persists during unexpected server shutdown.',
      'Handle DataStore request budget limits with debounced autosaving intervals (e.g. 5 minutes).'
    ],
    tags: ['DataStore', 'Persistence', 'SaveData', 'Coins', 'Inventory', 'BindToClose']
  },
  {
    id: 'tweenservice-animations',
    title: 'TweenService & Smooth Interpolations',
    category: 'UI & VFX',
    summary: 'Hardware-accelerated property tweening for doors, cameras, UI elements, lights, and floating collectibles.',
    keyServices: ['TweenService', 'RunService'],
    apiDocsUrl: 'https://create.roblox.com/docs/reference/engine/classes/TweenService',
    luauSnippet: `--!strict
local TweenService = game:GetService("TweenService")

local function createBounceTween(targetInstance: Instance, properties: { [string]: any }, duration: number?): Tween
\tlocal tweenInfo = TweenInfo.new(
\t\tduration or 0.6,
\t\tEnum.EasingStyle.Back,
\t\tEnum.EasingDirection.Out,
\t\t0,     -- RepeatCount
\t\tfalse, -- Reverses
\t\t0      -- DelayTime
\t)
\treturn TweenService:Create(targetInstance, tweenInfo, properties)
end

-- Example usage on a GUI frame or 3D Part
local doorPart = workspace:FindFirstChild("VaultDoor") :: BasePart?
if doorPart then
\tlocal openTween = createBounceTween(doorPart, {
\t\tCFrame = doorPart.CFrame * CFrame.Angles(0, math.rad(90), 0)
\t}, 0.8)
\topenTween:Play()
end`,
    bestPractices: [
      'Run visual-only tweens on the client to avoid server frame stutter.',
      'Cancel or overwrite active tweens using tween:Cancel() before starting a new one on the same property.',
      'Use EasingStyle.Quad, Back, or Exponential for satisfying game-feel juice.'
    ],
    tags: ['TweenService', 'Animation', 'UI', 'Door', 'Smooth', 'Easing']
  },
  {
    id: 'raycast-combat-hitbox',
    title: 'Raycasting & High-Accuracy Combat Hitbox System',
    category: 'Combat',
    summary: 'High-speed directional raycasting for swords, guns, magic projectiles, and anti-exploit hit verification.',
    keyServices: ['Workspace', 'Players', 'Debris'],
    apiDocsUrl: 'https://create.roblox.com/docs/physics/raycasting',
    luauSnippet: `--!strict
local Workspace = game:GetService("Workspace")
local Players = game:GetService("Players")

export type RaycastHitResult = {
\tHitInstance: BasePart,
\tPosition: Vector3,
\tNormal: Vector3,
\tHitCharacter: Model?,
}

local function castCombatRay(origin: Vector3, direction: Vector3, ignoreList: { Instance }): RaycastHitResult?
\tlocal raycastParams = RaycastParams.new()
\traycastParams.FilterType = Enum.RaycastFilterType.Exclude
\traycastParams.FilterDescendantsInstances = ignoreList
\traycastParams.IgnoreWater = true

\tlocal result = Workspace:Raycast(origin, direction, raycastParams)
\tif result and result.Instance then
\t\tlocal hitModel = result.Instance:FindFirstAncestorOfClass("Model")
\t\treturn {
\t\t\tHitInstance = result.Instance,
\t\t\tPosition = result.Position,
\t\t\tNormal = result.Normal,
\t\t\tHitCharacter = hitModel,
\t\t}
\tend
\treturn nil
end`,
    bestPractices: [
      'Always verify hits on the server by checking distance and line of sight.',
      'Reuse RaycastParams instances to reduce memory allocations in tight loop hitboxes.',
      'Use Shapecasts (BlockCast / SphereCast) when casting wider hit volumes like hammers or punches.'
    ],
    tags: ['Raycasting', 'Combat', 'Hitbox', 'Guns', 'Swords', 'RaycastParams']
  },
  {
    id: 'proximity-prompt-interactions',
    title: 'ProximityPrompt & Universal World Interactions',
    category: 'Mechanics',
    summary: 'Interactive world prompts for opening doors, picking up items, triggering dialogue, and opening custom shop UIs.',
    keyServices: ['ProximityPromptService', 'TweenService', 'Players'],
    apiDocsUrl: 'https://create.roblox.com/docs/interaction/proximity-prompts',
    luauSnippet: `--!strict
local ProximityPromptService = game:GetService("ProximityPromptService")
local Players = game:GetService("Players")

local function createInteractablePrompt(parent: Instance, actionText: string, objectText: string, holdDuration: number?): ProximityPrompt
\tlocal prompt = Instance.new("ProximityPrompt")
\tprompt.ActionText = actionText
\tprompt.ObjectText = objectText
\tprompt.HoldDuration = holdDuration or 0.5
\tprompt.MaxActivationDistance = 10
\tprompt.RequiresLineOfSight = true
\tprompt.Parent = parent
\treturn prompt
end

ProximityPromptService.PromptTriggered:Connect(function(prompt: ProximityPrompt, player: Player)
\tprint(string.format("⚡ [Interaction] %s triggered %s on %s", player.Name, prompt.ActionText, prompt.Parent and prompt.Parent.Name or "object"))
end)`,
    bestPractices: [
      'Set RequiresLineOfSight = true to prevent players from triggering prompts through solid walls.',
      'Use ProximityPromptService.PromptTriggered central listener rather than connecting to every individual prompt.',
      'Style prompts with custom GuiService or client-side BillboardGuis for stylized UI.'
    ],
    tags: ['ProximityPrompt', 'Interaction', 'Chests', 'Doors', 'Shop', 'NPC']
  },
  {
    id: 'collection-service-tagging',
    title: 'CollectionService & Tag-Based Architecture',
    category: 'Mechanics',
    summary: 'Decoupled game architecture using Tags to manage kill bricks, spinning coins, destructibles, and checkpoints seamlessly.',
    keyServices: ['CollectionService', 'Players', 'TweenService'],
    apiDocsUrl: 'https://create.roblox.com/docs/reference/engine/classes/CollectionService',
    luauSnippet: `--!strict
local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")

local KILL_TAG = "KillHazard"
local COIN_TAG = "CollectibleCoin"

-- Setup Kill Hazards
local function setupHazard(hazardPart: Instance)
\tif not hazardPart:IsA("BasePart") then return end
\t
\thazardPart.Touched:Connect(function(otherPart)
\t\tlocal char = otherPart.Parent
\t\tlocal hum = char and char:FindFirstChildOfClass("Humanoid")
\t\tif hum and hum.Health > 0 then
\t\t\thum.Health = 0
\t\tend
\tend)
end

-- Initialize existing and listen for newly streamed parts
for _, part in ipairs(CollectionService:GetTagged(KILL_TAG)) do
\ttask.spawn(setupHazard, part)
end
CollectionService:GetInstanceAddedSignal(KILL_TAG):Connect(setupHazard)`,
    bestPractices: [
      'Use CollectionService tags instead of hardcoding folder hierarchies in workspace.',
      'Always connect to GetInstanceAddedSignal to handle streaming or dynamically spawned tagged objects.',
      'Clean up events on GetInstanceRemovedSignal to prevent memory leaks.'
    ],
    tags: ['CollectionService', 'Tags', 'KillBricks', 'Checkpoints', 'Coins', 'Streaming']
  },
  {
    id: 'context-action-service-inputs',
    title: 'ContextActionService & Multi-Platform Keybinds',
    category: 'Mechanics',
    summary: 'Handles keyboard, gamepad controller, and on-screen mobile touch action buttons with a unified API.',
    keyServices: ['ContextActionService', 'UserInputService'],
    apiDocsUrl: 'https://create.roblox.com/docs/input/context-action-service',
    luauSnippet: `--!strict
local ContextActionService = game:GetService("ContextActionService")

local SPRINT_ACTION = "SprintAction"

local function handleSprint(actionName: string, inputState: Enum.UserInputState, _inputObject: InputObject)
\tif actionName == SPRINT_ACTION then
\t\tif inputState == Enum.UserInputState.Begin then
\t\t\tprint("⚡ Sprint engaged!")
\t\telseif inputState == Enum.UserInputState.End then
\t\t\tprint("⚡ Sprint released.")
\t\tend
\tend
\treturn Enum.ContextActionResult.Pass
end

-- Bind Shift key and Gamepad L3 button, with auto mobile button
ContextActionService:BindAction(
\tSPRINT_ACTION,
\thandleSprint,
\ttrue, -- Create mobile on-screen touch button
\tEnum.KeyCode.LeftShift,
\tEnum.KeyCode.ButtonL3
)
ContextActionService:SetTitle(SPRINT_ACTION, "Sprint")`,
    bestPractices: [
      'Set createTouchButton to true for automatic mobile button rendering with zero boilerplate.',
      'Return Enum.ContextActionResult.Pass if other scripts need to process the same key, or Sink to consume it.',
      'Always call UnbindAction when the character respawns or state ends.'
    ],
    tags: ['ContextActionService', 'Keybinds', 'Mobile', 'Sprint', 'Gamepad', 'Input']
  },
  {
    id: 'physics-collision-groups',
    title: 'PhysicsService & Non-Colliding Players',
    category: 'Physics',
    summary: 'Configures Collision Groups to disable player-to-player pushing and build custom team barrier physics.',
    keyServices: ['PhysicsService', 'Players'],
    apiDocsUrl: 'https://create.roblox.com/docs/physics/collision-filtering',
    luauSnippet: `--!strict
local PhysicsService = game:GetService("PhysicsService")
local Players = game:GetService("Players")

local PLAYERS_GROUP = "PlayersGroup"
local MONSTERS_GROUP = "MonstersGroup"

-- Register collision groups
pcall(function()
\tPhysicsService:RegisterCollisionGroup(PLAYERS_GROUP)
\tPhysicsService:RegisterCollisionGroup(MONSTERS_GROUP)
\t-- Disable collision between players
\tPhysicsService:CollisionGroupSetCollidable(PLAYERS_GROUP, PLAYERS_GROUP, false)
\t-- Enable collision between players and monsters
\tPhysicsService:CollisionGroupSetCollidable(PLAYERS_GROUP, MONSTERS_GROUP, true)
end)

local function setCharacterCollisionGroup(character: Model, groupName: string)
\tfor _, descendant in ipairs(character:GetDescendants()) do
\t\tif descendant:IsA("BasePart") then
\t\t\tdescendant.CollisionGroup = groupName
\t\tend
\tend
end`,
    bestPractices: [
      'Register collision groups once at server boot.',
      'Assign CollisionGroup to newly added character parts via Character.DescendantAdded.',
      'Use collision filtering rather than anchored parts to avoid physics desync.'
    ],
    tags: ['PhysicsService', 'CollisionGroups', 'NoCollide', 'AntiPush', 'Teams']
  },
  {
    id: 'memorystore-matchmaking',
    title: 'MemoryStoreService & Cross-Server Teleportation',
    category: 'Networking',
    summary: 'Low-latency in-memory data structures (Queues, Sorted Maps) for cross-server matchmaking, auctions, and live global feeds.',
    keyServices: ['MemoryStoreService', 'TeleportService', 'Players'],
    apiDocsUrl: 'https://create.roblox.com/docs/cloud-services/memory-stores',
    luauSnippet: `--!strict
local MemoryStoreService = game:GetService("MemoryStoreService")
local TeleportService = game:GetService("TeleportService")
local Players = game:GetService("Players")

local matchQueue = MemoryStoreService:GetQueue("MatchmakingQueue_1v1")

local function addPlayerToQueue(player: Player)
\tlocal success, err = pcall(function()
\t\tmatchQueue:AddAsync(player.UserId, 300, 1) -- 5 min expiration, priority 1
\tend)
\tif success then
\t\tprint("🎮 Queued player " .. player.Name .. " for matchmaking.")
\tend
end`,
    bestPractices: [
      'Set sensible expiration timeouts so disconnected players do not clog matchmaking queues.',
      'Use Sorted Maps for global high-score leaderboards that update in sub-second latency.',
      'Combine with TeleportService:ReserveServer for instanced dungeon arenas.'
    ],
    tags: ['MemoryStore', 'Matchmaking', 'TeleportService', 'CrossServer', 'Multiplayer']
  },
  {
    id: 'text-chat-service-tags',
    title: 'TextChatService & Custom Chat Formatting/Admin Badges',
    category: 'UI & VFX',
    summary: 'Customizes chat messages, VIP chat colors, owner rank prefixes, and bubble chat styling with TextChatService.',
    keyServices: ['TextChatService', 'Players'],
    apiDocsUrl: 'https://create.roblox.com/docs/chat/textchat-service',
    luauSnippet: `--!strict
local TextChatService = game:GetService("TextChatService")
local Players = game:GetService("Players")

TextChatService.OnIncomingMessage = function(message: TextChatMessage)
\tlocal properties = Instance.new("TextChatMessageProperties")
\tif not message.TextSource then return properties end
\t
\tlocal player = Players:GetPlayerByUserId(message.TextSource.UserId)
\tif not player then return properties end
\t
\t-- Check for Admin or VIP status
\tif player.UserId == 100 or player:GetAttribute("IsAdmin") then
\t\tproperties.PrefixText = string.format("<font color='#FFC93C'>[👑 OWNER]</font> %s", message.PrefixText)
\telseif player:GetAttribute("IsVIP") then
\t\tproperties.PrefixText = string.format("<font color='#A8E6B0'>[💎 VIP]</font> %s", message.PrefixText)
\tend
\t
\treturn properties
end`,
    bestPractices: [
      'Use RichText formatting tags (<font color="...">, <b>, <i>) inside PrefixText.',
      'Attach TextChatService.OnIncomingMessage in a LocalScript inside StarterPlayerScripts for instant rendering.',
      'Use TextChannels to create team-only or proximity proximity whisper channels.'
    ],
    tags: ['TextChatService', 'Chat', 'AdminTag', 'VIP', 'RichText', 'Prefix']
  }
];

export function searchRobloxSkills(query: string): RobloxSkill[] {
  const q = query.toLowerCase().trim();
  if (!q) return ROBLOX_SKILLS_DATABASE.slice(0, 6);

  const words = q.split(/\s+/).filter(w => w.length > 1);

  return ROBLOX_SKILLS_DATABASE.filter(skill => {
    const haystack = `${skill.title} ${skill.summary} ${skill.category} ${skill.keyServices.join(' ')} ${skill.tags.join(' ')} ${skill.bestPractices.join(' ')}`.toLowerCase();
    return words.some(w => haystack.includes(w));
  });
}
