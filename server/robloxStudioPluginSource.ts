export const OFFICIAL_ROBLOX_STUDIO_PLUGIN_SOURCE = `--!strict
-- Squeeze Roblox Studio WebSync Companion Plugin v2.5.0
-- Real-Time Bidirectional Synchronization for Roblox Studio & Squeeze AI Agent
-- Supports Live Pairing, Heartbeats, Remote File Push/Pull, Explorer Snapshots, and Auto-Recovery

local HttpService = game:GetService("HttpService")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterPlayer = game:GetService("StarterPlayer")
local StarterGui = game:GetService("StarterGui")
local Workspace = game:GetService("Workspace")
local ReplicatedFirst = game:GetService("ReplicatedFirst")
local ServerStorage = game:GetService("ServerStorage")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local RunService = game:GetService("RunService")
local StudioService = game:GetService("StudioService")

-- Configuration
local DEFAULT_BACKEND_URL = "http://localhost:3000/api/studio"
local POLL_INTERVAL_SECONDS = 1.2
local HEARTBEAT_INTERVAL_SECONDS = 5.0
local MAX_RETRY_ATTEMPTS = 5

-- Plugin State
local pluginSession = {
    backendUrl = DEFAULT_BACKEND_URL,
    token = "",
    pairingCode = "",
    sessionId = "",
    projectId = "",
    projectName = "",
    status = "Disconnected", -- Disconnected, Pairing, Connected, Syncing, Offline, Error
    lastSyncTime = 0,
    lastHeartbeatTime = 0,
    consecutiveErrors = 0,
    pendingChangesCount = 0,
    connectedPlaceName = game.Name ~= "" and game.Name or "Roblox Studio Place",
    connectedPlaceId = game.PlaceId,
    universeId = game.GameId,
    fileHashes = {} :: { [string]: string },
    fileVersions = {} :: { [string]: number },
    isPolling = false
}

-- Simple Hash helper
local function simpleHash(str: string): string
    local h = 0
    for i = 1, #str do
        h = (h * 31 + string.byte(str, i)) % 2147483647
    end
    return string.format("%08x", h)
end

-- Resolve Container Instance from Virtual Path
local function resolveParentFromPath(path: string): (Instance?, string)
    local parts = string.split(path, "/")
    local fileName = parts[#parts]
    
    -- Extract clean instance name (remove .server.luau, .client.luau, .luau, .lua)
    local instanceName = fileName:gsub("%.server%.luau$", ""):gsub("%.client%.luau$", ""):gsub("%.luau$", ""):gsub("%.lua$", "")
    
    local currentParent: Instance = game
    local root = parts[1]
    
    if root == "src" or root == "ServerScriptService" then
        if parts[2] == "server" or root == "ServerScriptService" then
            currentParent = ServerScriptService
        elseif parts[2] == "client" then
            currentParent = StarterPlayer.StarterPlayerScripts
        elseif parts[2] == "shared" then
            currentParent = ReplicatedStorage
        else
            currentParent = ServerScriptService
        end
    elseif root == "StarterPlayer" then
        currentParent = StarterPlayer.StarterPlayerScripts
    elseif root == "ReplicatedStorage" then
        currentParent = ReplicatedStorage
    elseif root == "StarterGui" then
        currentParent = StarterGui
    elseif root == "Workspace" then
        currentParent = Workspace
    elseif root == "ReplicatedFirst" then
        currentParent = ReplicatedFirst
    elseif root == "ServerStorage" then
        currentParent = ServerStorage
    else
        currentParent = ServerScriptService
    end
    
    -- Build intermediate folders if needed
    local startIdx = (parts[1] == "src" and 3 or 2)
    for i = startIdx, #parts - 1 do
        local folderName = parts[i]
        local existingFolder = currentParent:FindFirstChild(folderName)
        if not existingFolder then
            local newFolder = Instance.new("Folder")
            newFolder.Name = folderName
            newFolder.Parent = currentParent
            currentParent = newFolder
        else
            currentParent = existingFolder
        end
    end
    
    return currentParent, instanceName
end

-- Find existing script in game hierarchy
local function findScriptByPath(path: string): (LuaSourceContainer?, Instance?)
    local parent, instanceName = resolveParentFromPath(path)
    if not parent then return nil, nil end
    
    local found = parent:FindFirstChild(instanceName)
    if found and (found:IsA("Script") or found:IsA("LocalScript") or found:IsA("ModuleScript")) then
        return found :: any, parent
    end
    return nil, parent
end

-- Apply incoming change event from Squeeze Website / AI Agent
local function applyIncomingChange(event: any): (boolean, string?)
    local path = event.path or ""
    local source = event.source or ""
    local className = event.className or "Script"
    local action = event.action or "update"
    
    local existingScript, parent = findScriptByPath(path)
    
    if action == "delete" then
        if existingScript then
            ChangeHistoryService:SetWaypoint("Before Squeeze Delete: " .. path)
            existingScript:Destroy()
            ChangeHistoryService:SetWaypoint("Squeeze Deleted: " .. path)
            pluginSession.fileHashes[path] = nil
            pluginSession.fileVersions[path] = nil
            return true, nil
        end
        return true, nil
    end
    
    if not parent then
        return false, "Could not resolve parent container for path: " .. path
    end
    
    ChangeHistoryService:SetWaypoint("Before Squeeze Sync: " .. path)
    
    if existingScript then
        -- Validate class matches
        if (className == "LocalScript" and not existingScript:IsA("LocalScript")) or
           (className == "ModuleScript" and not existingScript:IsA("ModuleScript")) or
           (className == "Script" and not (existingScript:IsA("Script") and not existingScript:IsA("LocalScript") and not existingScript:IsA("ModuleScript"))) then
            -- Replace instance if type changed
            local newInst = Instance.new(className)
            newInst.Name = existingScript.Name
            newInst.Source = source
            newInst.Parent = parent
            existingScript:Destroy()
        else
            existingScript.Source = source
        end
    else
        -- Create new script instance
        local _, instanceName = resolveParentFromPath(path)
        local newInst = Instance.new(className)
        newInst.Name = instanceName
        newInst.Source = source
        newInst.Parent = parent
    end
    
    pluginSession.fileHashes[path] = simpleHash(source)
    if event.version then
        pluginSession.fileVersions[path] = event.version
    end
    ChangeHistoryService:SetWaypoint("Squeeze Synced: " .. path)
    return true, nil
end

-- HTTP Request wrapper with safe pcall and token handling
local function httpRequest(url: string, method: string, bodyData: any, token: string?): (boolean, any)
    local headers = {
        ["Content-Type"] = "application/json"
    }
    if token and token ~= "" then
        headers["Authorization"] = "Bearer " .. token
    end
    
    local payload = bodyData and HttpService:JSONEncode(bodyData) or nil
    
    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = url,
            Method = method,
            Headers = headers,
            Body = payload
        })
    end)
    
    if not success then
        return false, tostring(response)
    end
    
    if not response.Success then
        return false, "HTTP " .. tostring(response.StatusCode) .. ": " .. tostring(response.Body)
    end
    
    local decodeSuccess, decoded = pcall(function()
        return HttpService:JSONDecode(response.Body)
    end)
    
    if not decodeSuccess then
        return false, "Invalid JSON from server"
    end
    
    return true, decoded
end

-- Main Squeeze Studio Plugin Controller
local SqueezePlugin = {}

function SqueezePlugin.PairWithCode(pairingCode: string, customUrl: string?): (boolean, string)
    if customUrl and customUrl ~= "" then
        -- Normalize URL to strip trailing slash
        pluginSession.backendUrl = customUrl:gsub("/+$", "")
    end
    
    pluginSession.status = "Pairing"
    
    -- Pair endpoint URL
    local pairUrl = pluginSession.backendUrl .. "/pair"
    local success, data = httpRequest(
        pairUrl,
        "POST",
        {
            pairingCode = pairingCode:upper():gsub("%s+", ""),
            placeId = game.PlaceId,
            placeName = game.Name ~= "" and game.Name or "Roblox Studio Place",
            universeId = game.GameId,
            pluginVersion = "2.5.0"
        }
    )
    
    if not success or not data.success then
        pluginSession.status = "Error"
        pluginSession.consecutiveErrors = pluginSession.consecutiveErrors + 1
        return false, (data and (data.error and data.error.message or data.error)) or "Failed to pair with Squeeze. Ensure HttpService is enabled in Roblox Game Settings."
    end
    
    pluginSession.token = data.token
    pluginSession.sessionId = data.sessionId or ""
    pluginSession.projectId = data.projectId or ""
    pluginSession.projectName = data.projectName or "Roblox Project"
    pluginSession.status = "Connected"
    pluginSession.consecutiveErrors = 0
    pluginSession.lastHeartbeatTime = os.clock()
    pluginSession.lastSyncTime = os.clock()
    
    -- Immediately push current project hierarchy
    task.spawn(function()
        SqueezePlugin.PushExplorerTree()
    end)
    
    -- Start polling loop
    SqueezePlugin.StartPolling()
    
    return true, "Successfully paired with Squeeze Web IDE for project: " .. pluginSession.projectName
end

function SqueezePlugin.SendHeartbeat()
    if pluginSession.token == "" or pluginSession.status == "Disconnected" then return end
    
    local heartbeatUrl = pluginSession.backendUrl .. "/heartbeat"
    local success, data = httpRequest(
        heartbeatUrl,
        "POST",
        {
            placeId = game.PlaceId,
            placeName = game.Name ~= "" and game.Name or "Roblox Studio Place",
            universeId = game.GameId,
            pluginVersion = "2.5.0"
        },
        pluginSession.token
    )
    
    if success and data.success then
        pluginSession.lastHeartbeatTime = os.clock()
        pluginSession.status = "Connected"
        pluginSession.consecutiveErrors = 0
        if data.pendingChangesCount then
            pluginSession.pendingChangesCount = data.pendingChangesCount
        end
    else
        pluginSession.consecutiveErrors = pluginSession.consecutiveErrors + 1
        if pluginSession.consecutiveErrors >= 3 then
            pluginSession.status = "Offline"
        end
    end
end

function SqueezePlugin.PollAndApplyChanges(): number
    if pluginSession.token == "" or pluginSession.status == "Disconnected" then return 0 end
    
    local pullUrl = pluginSession.backendUrl .. "/files/pull"
    local success, data = httpRequest(
        pullUrl,
        "GET",
        nil,
        pluginSession.token
    )
    
    -- Fallback to /pull if 404
    if not success and tostring(data):find("404") then
        pullUrl = pluginSession.backendUrl .. "/pull"
        success, data = httpRequest(pullUrl, "GET", nil, pluginSession.token)
    end
    
    if not success or not data.success or not data.changes then
        return 0
    end
    
    local appliedCount = 0
    for _, change in ipairs(data.changes) do
        local ok, err = applyIncomingChange(change)
        
        -- Acknowledge event
        local ackUrl = pluginSession.backendUrl .. "/ack"
        httpRequest(
            ackUrl,
            "POST",
            {
                changeId = change.changeId or change.eventId,
                eventId = change.eventId or change.changeId,
                status = ok and "applied" or "failed",
                errorMessage = err
            },
            pluginSession.token
        )
        
        if ok then
            appliedCount = appliedCount + 1
        end
    end
    
    if appliedCount > 0 then
        pluginSession.lastSyncTime = os.clock()
        print(string.format("[Squeeze WebSync] Synced %d change(s) from Web IDE.", appliedCount))
    end
    
    return appliedCount
end

function SqueezePlugin.PushStudioScriptChange(scriptInstance: LuaSourceContainer, pathOverride: string?): (boolean, string?)
    if pluginSession.token == "" or pluginSession.status == "Disconnected" then 
        return false, "Studio is not connected to Squeeze Web IDE." 
    end
    
    local source = scriptInstance.Source
    local className = scriptInstance.ClassName
    local path = pathOverride or ("ServerScriptService/" .. scriptInstance.Name)
    local expectedVersion = pluginSession.fileVersions[path] or 1
    
    local pushUrl = pluginSession.backendUrl .. "/files/push"
    local success, data = httpRequest(
        pushUrl,
        "POST",
        {
            file = {
                path = path,
                name = scriptInstance.Name,
                className = className,
                source = source,
                expectedVersion = expectedVersion
            },
            author = "studio"
        },
        pluginSession.token
    )
    
    -- Fallback to /studio-change if needed
    if not success and tostring(data):find("404") then
        pushUrl = pluginSession.backendUrl .. "/studio-change"
        success, data = httpRequest(
            pushUrl,
            "POST",
            {
                path = path,
                name = scriptInstance.Name,
                className = className,
                source = source,
                expectedVersion = expectedVersion
            },
            pluginSession.token
        )
    end
    
    if success and data.success then
        pluginSession.fileHashes[path] = simpleHash(source)
        if data.file and data.file.version then
            pluginSession.fileVersions[path] = data.file.version
        end
        return true, nil
    else
        local errMsg = (data and (data.error and data.error.message or data.error)) or "Failed to push Studio change to Web IDE."
        return false, errMsg
    end
end

-- Export Full DataModel Tree to Squeeze Web IDE
function SqueezePlugin.PushExplorerTree(): (boolean, number)
    if pluginSession.token == "" then return false, 0 end
    
    local scriptFiles = {}
    local treeNodes = {}
    
    local function scan(inst: Instance, currentPath: string)
        local nodePath = currentPath .. "/" .. inst.Name
        table.insert(treeNodes, {
            name = inst.Name,
            className = inst.ClassName,
            path = nodePath
        })
        
        if inst:IsA("LuaSourceContainer") then
            local ext = inst:IsA("LocalScript") and ".client.luau" or inst:IsA("ModuleScript") and ".luau" or ".server.luau"
            local fullScriptPath = nodePath .. ext
            table.insert(scriptFiles, {
                path = fullScriptPath,
                name = inst.Name .. ext,
                className = inst.ClassName,
                source = inst.Source
            })
            pluginSession.fileHashes[fullScriptPath] = simpleHash(inst.Source)
        end
        
        for _, child in ipairs(inst:GetChildren()) do
            scan(child, nodePath)
        end
    end
    
    scan(ServerScriptService, "ServerScriptService")
    scan(ReplicatedStorage, "ReplicatedStorage")
    scan(StarterPlayer.StarterPlayerScripts, "StarterPlayer/StarterPlayerScripts")
    scan(StarterGui, "StarterGui")
    
    local snapshotUrl = pluginSession.backendUrl .. "/project/snapshot"
    local success, data = httpRequest(
        snapshotUrl,
        "POST",
        {
            tree = treeNodes,
            scriptFiles = scriptFiles
        },
        pluginSession.token
    )
    
    -- Fallback to tree-sync if needed
    if not success and tostring(data):find("404") then
        snapshotUrl = pluginSession.backendUrl .. "/tree-sync"
        success, data = httpRequest(
            snapshotUrl,
            "POST",
            {
                tree = treeNodes,
                scriptFiles = scriptFiles
            },
            pluginSession.token
        )
    end
    
    if success and data.success then
        print(string.format("[Squeeze WebSync] Uploaded %d place script(s) and %d nodes to Squeeze Web IDE.", #scriptFiles, #treeNodes))
        return true, #scriptFiles
    end
    return false, 0
end

function SqueezePlugin.StartPolling()
    if pluginSession.isPolling then return end
    pluginSession.isPolling = true
    
    task.spawn(function()
        while pluginSession.isPolling and pluginSession.token ~= "" do
            -- Poll for changes from website
            SqueezePlugin.PollAndApplyChanges()
            
            -- Heartbeat check
            if os.clock() - pluginSession.lastHeartbeatTime >= HEARTBEAT_INTERVAL_SECONDS then
                SqueezePlugin.SendHeartbeat()
            end
            
            task.wait(POLL_INTERVAL_SECONDS)
        end
        pluginSession.isPolling = false
    end)
end

function SqueezePlugin.Disconnect(reason: string?)
    if pluginSession.token ~= "" then
        pcall(function()
            httpRequest(
                pluginSession.backendUrl .. "/disconnect",
                "POST",
                { reason = reason or "Studio plugin closed" },
                pluginSession.token
            )
        end)
    end
    
    pluginSession.token = ""
    pluginSession.status = "Disconnected"
    pluginSession.isPolling = false
    print("[Squeeze WebSync] Disconnected.")
end

function SqueezePlugin.GetStatus()
    return pluginSession
end

return SqueezePlugin
`;
