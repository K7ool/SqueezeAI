export const OFFICIAL_ROBLOX_STUDIO_PLUGIN_SOURCE = `--!strict
-- Squeeze Roblox Studio WebSync Companion Plugin v3.0.0
-- Real-Time Bidirectional Synchronization for Roblox Studio & Squeeze AI Agent
-- Supports Live Pairing, Real Instance Operations, Script Sync, and Studio Toolbar UI.

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
local Selection = game:GetService("Selection")

-- Configuration
local DEFAULT_BACKEND_URL = "http://localhost:3000/api/studio"
local POLL_INTERVAL_SECONDS = 1.0
local HEARTBEAT_INTERVAL_SECONDS = 3.0
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
    if not path or path == "" then return game, "" end
    local parts = string.split(path, "/")
    local instanceName = parts[#parts]
    
    -- Extract clean instance name (remove .server.luau, .client.luau, .luau, .lua)
    instanceName = instanceName:gsub("%.server%.luau$", ""):gsub("%.client%.luau$", ""):gsub("%.luau$", ""):gsub("%.lua$", "")
    
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
    local startIdx = (parts[1] == "src" and 3 or (root == currentParent.Name and 2 or 1))
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

-- Find existing instance in game hierarchy
local function findInstanceByPath(path: string): (Instance?, Instance?)
    local parent, instanceName = resolveParentFromPath(path)
    if not parent then return nil, nil end
    
    local found = parent:FindFirstChild(instanceName)
    return found, parent
end

-- Apply incoming operation from Squeeze Website / AI Agent
local function applyOperation(op: any): (boolean, string?)
    local opType = op.operation or op.action or "updateScript"
    local path = op.path or op.parentPath or ""
    
    if opType == "createInstance" or opType == "createScript" or opType == "updateScript" or opType == "update" then
        local className = op.className or (opType:match("Script") and "Script" or "Folder")
        local existingInst, parent = findInstanceByPath(path)
        if op.name and parent then
            path = path .. "/" .. op.name
            existingInst, parent = findInstanceByPath(path)
        end
        if not parent then return false, "Invalid path" end
        
        ChangeHistoryService:SetWaypoint("Before Squeeze Create/Update: " .. path)
        
        local inst = existingInst
        if not inst then
            inst = Instance.new(className)
            local _, nm = resolveParentFromPath(path)
            inst.Name = op.name or nm
            inst.Parent = parent
        elseif inst.ClassName ~= className and className:match("Script") then
            -- Replace script if class mismatch
            local newInst = Instance.new(className)
            newInst.Name = inst.Name
            newInst.Parent = parent
            if inst:IsA("LuaSourceContainer") then
                newInst.Source = inst.Source
            end
            inst:Destroy()
            inst = newInst
        end
        
        if op.source and inst:IsA("LuaSourceContainer") then
            inst.Source = op.source
            pluginSession.fileHashes[path] = simpleHash(op.source)
        end
        
        if op.properties then
            for k, v in pairs(op.properties) do
                pcall(function() inst[k] = v end)
            end
        end
        
        if op.attributes then
            for k, v in pairs(op.attributes) do
                pcall(function() inst:SetAttribute(k, v) end)
            end
        end
        
        ChangeHistoryService:SetWaypoint("Squeeze Create/Update: " .. path)
        return true, nil
        
    elseif opType == "deleteInstance" or opType == "deleteScript" or opType == "delete" then
        local existingInst = findInstanceByPath(path)
        if existingInst then
            ChangeHistoryService:SetWaypoint("Before Squeeze Delete: " .. path)
            existingInst:Destroy()
            ChangeHistoryService:SetWaypoint("Squeeze Deleted: " .. path)
        end
        return true, nil
        
    elseif opType == "setProperty" then
        local existingInst = findInstanceByPath(path)
        if not existingInst then return false, "Instance not found" end
        ChangeHistoryService:SetWaypoint("Before Squeeze SetProperty: " .. path)
        for k, v in pairs(op.properties or {}) do
            pcall(function() existingInst[k] = v end)
        end
        ChangeHistoryService:SetWaypoint("Squeeze SetProperty: " .. path)
        return true, nil
        
    elseif opType == "setAttribute" then
        local existingInst = findInstanceByPath(path)
        if not existingInst then return false, "Instance not found" end
        ChangeHistoryService:SetWaypoint("Before Squeeze SetAttribute: " .. path)
        for k, v in pairs(op.attributes or {}) do
            pcall(function() existingInst:SetAttribute(k, v) end)
        end
        ChangeHistoryService:SetWaypoint("Squeeze SetAttribute: " .. path)
        return true, nil
        
    elseif opType == "renameInstance" then
        local existingInst = findInstanceByPath(path)
        if not existingInst then return false, "Instance not found" end
        ChangeHistoryService:SetWaypoint("Before Squeeze Rename: " .. path)
        existingInst.Name = op.newName or op.name
        ChangeHistoryService:SetWaypoint("Squeeze Rename: " .. path)
        return true, nil
        
    elseif opType == "moveInstance" then
        local existingInst = findInstanceByPath(path)
        local newParent = resolveParentFromPath(op.newParentPath)
        if not existingInst or not newParent then return false, "Instance or new parent not found" end
        ChangeHistoryService:SetWaypoint("Before Squeeze Move: " .. path)
        existingInst.Parent = newParent
        ChangeHistoryService:SetWaypoint("Squeeze Move: " .. path)
        return true, nil
    end
    
    return false, "Unknown operation: " .. tostring(opType)
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
    
    if not success then return false, tostring(response) end
    if not response.Success then return false, "HTTP " .. tostring(response.StatusCode) .. ": " .. tostring(response.Body) end
    
    local decodeSuccess, decoded = pcall(function() return HttpService:JSONDecode(response.Body) end)
    if not decodeSuccess then return false, "Invalid JSON from server" end
    
    return true, decoded
end

local SqueezePlugin = {}

function SqueezePlugin.PairWithCode(pairingCode: string, customUrl: string?): (boolean, string)
    if customUrl and customUrl ~= "" then
        pluginSession.backendUrl = customUrl:gsub("/+$", "")
    end
    
    pluginSession.status = "Pairing"
    
    local pairUrl = pluginSession.backendUrl .. "/pair"
    local success, data = httpRequest(
        pairUrl,
        "POST",
        {
            pairingCode = pairingCode:upper():gsub("%s+", ""),
            placeId = game.PlaceId,
            placeName = game.Name ~= "" and game.Name or "Roblox Studio Place",
            universeId = game.GameId,
            pluginVersion = "3.0.0"
        }
    )
    
    if not success or not data.success then
        pluginSession.status = "Error"
        pluginSession.consecutiveErrors = pluginSession.consecutiveErrors + 1
        return false, (data and (data.error and data.error.message or data.error)) or "Failed to pair with Squeeze."
    end
    
    pluginSession.token = data.token
    pluginSession.sessionId = data.sessionId or ""
    pluginSession.projectId = data.projectId or ""
    pluginSession.projectName = data.projectName or "Roblox Project"
    pluginSession.status = "Connected"
    pluginSession.consecutiveErrors = 0
    pluginSession.lastHeartbeatTime = os.clock()
    pluginSession.lastSyncTime = os.clock()
    
    task.spawn(function() SqueezePlugin.PushExplorerTree() end)
    SqueezePlugin.StartPolling()
    
    return true, "Successfully paired with Squeeze Web IDE."
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
            pluginVersion = "3.0.0"
        },
        pluginSession.token
    )
    
    if success and data.success then
        pluginSession.lastHeartbeatTime = os.clock()
        pluginSession.status = "Connected"
        pluginSession.consecutiveErrors = 0
    else
        pluginSession.consecutiveErrors = pluginSession.consecutiveErrors + 1
        if pluginSession.consecutiveErrors >= 3 then pluginSession.status = "Offline" end
    end
end

function SqueezePlugin.PollAndApplyChanges(): number
    if pluginSession.token == "" or pluginSession.status == "Disconnected" then return 0 end
    
    local pullUrl = pluginSession.backendUrl .. "/operations/pending"
    local success, data = httpRequest(pullUrl, "GET", nil, pluginSession.token)
    
    if not success and tostring(data):find("404") then
        pullUrl = pluginSession.backendUrl .. "/files/pull"
        success, data = httpRequest(pullUrl, "GET", nil, pluginSession.token)
    end
    
    if not success or not data.success or not (data.operations or data.changes) then return 0 end
    local ops = data.operations or data.changes
    
    local appliedCount = 0
    for _, op in ipairs(ops) do
        local ok, err = applyOperation(op)
        
        local ackUrl = pluginSession.backendUrl .. "/operations/ack"
        httpRequest(
            ackUrl,
            "POST",
            {
                operationId = op.operationId or op.changeId or op.eventId,
                status = ok and "applied" or "failed",
                errorMessage = err
            },
            pluginSession.token
        )
        if ok then appliedCount = appliedCount + 1 end
    end
    
    if appliedCount > 0 then pluginSession.lastSyncTime = os.clock() end
    return appliedCount
end

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
        for _, child in ipairs(inst:GetChildren()) do scan(child, nodePath) end
    end
    
    scan(ServerScriptService, "ServerScriptService")
    scan(ReplicatedStorage, "ReplicatedStorage")
    scan(StarterPlayer.StarterPlayerScripts, "StarterPlayer/StarterPlayerScripts")
    scan(StarterGui, "StarterGui")
    scan(Workspace, "Workspace")
    
    local snapshotUrl = pluginSession.backendUrl .. "/project/snapshot"
    local success = httpRequest(snapshotUrl, "POST", { tree = treeNodes, scriptFiles = scriptFiles }, pluginSession.token)
    return success, #scriptFiles
end

function SqueezePlugin.StartPolling()
    if pluginSession.isPolling then return end
    pluginSession.isPolling = true
    task.spawn(function()
        while pluginSession.isPolling and pluginSession.token ~= "" do
            SqueezePlugin.PollAndApplyChanges()
            if os.clock() - pluginSession.lastHeartbeatTime >= HEARTBEAT_INTERVAL_SECONDS then
                SqueezePlugin.SendHeartbeat()
            end
            task.wait(POLL_INTERVAL_SECONDS)
        end
        pluginSession.isPolling = false
    end)
end

function SqueezePlugin.Disconnect(reason: string?)
    if pluginSession.token ~= "" then pcall(function() httpRequest(pluginSession.backendUrl .. "/disconnect", "POST", { reason = reason or "Studio closed" }, pluginSession.token) end) end
    pluginSession.token = ""
    pluginSession.status = "Disconnected"
    pluginSession.isPolling = false
end

function SqueezePlugin.GetStatus() return pluginSession end

-- =========================================================================
-- PLUGIN UI INJECTION (FOR RUNNING AS A REAL STUDIO PLUGIN)
-- =========================================================================

local toolbar
local toggleButton
local widget

local function createPluginUI(plugin: Plugin)
    toolbar = plugin:CreateToolbar("Squeeze WebSync")
    toggleButton = toolbar:CreateButton("Toggle Squeeze", "Connect and sync your game with Squeeze AI", "rbxassetid://15079493155")
    
    local widgetInfo = DockWidgetPluginGuiInfo.new(
        Enum.InitialDockState.Right,
        true,
        false,
        250,
        300,
        250,
        300
    )
    
    widget = plugin:CreateDockWidgetPluginGui("SqueezeWebSyncPanel", widgetInfo)
    widget.Title = "Squeeze Studio Operator"
    
    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(1, 0, 1, 0)
    frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
    frame.Parent = widget
    
    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 40)
    title.Text = "Squeeze WebSync"
    title.TextColor3 = Color3.fromRGB(255, 255, 255)
    title.BackgroundTransparency = 1
    title.Font = Enum.Font.GothamBold
    title.TextSize = 18
    title.Parent = frame
    
    local statusLbl = Instance.new("TextLabel")
    statusLbl.Size = UDim2.new(1, 0, 0, 30)
    statusLbl.Position = UDim2.new(0, 0, 0, 45)
    statusLbl.Text = "Status: Disconnected"
    statusLbl.TextColor3 = Color3.fromRGB(200, 200, 200)
    statusLbl.BackgroundTransparency = 1
    statusLbl.Font = Enum.Font.Gotham
    statusLbl.TextSize = 14
    statusLbl.Parent = frame
    
    local codeInput = Instance.new("TextBox")
    codeInput.Size = UDim2.new(0.8, 0, 0, 40)
    codeInput.Position = UDim2.new(0.1, 0, 0, 80)
    codeInput.PlaceholderText = "Enter Pairing Code"
    codeInput.Text = ""
    codeInput.BackgroundColor3 = Color3.fromRGB(50, 50, 50)
    codeInput.TextColor3 = Color3.fromRGB(255, 255, 255)
    codeInput.Font = Enum.Font.Gotham
    codeInput.TextSize = 14
    codeInput.Parent = frame
    
    local connectBtn = Instance.new("TextButton")
    connectBtn.Size = UDim2.new(0.8, 0, 0, 40)
    connectBtn.Position = UDim2.new(0.1, 0, 0, 130)
    connectBtn.Text = "Connect"
    connectBtn.BackgroundColor3 = Color3.fromRGB(0, 120, 215)
    connectBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
    connectBtn.Font = Enum.Font.GothamBold
    connectBtn.TextSize = 14
    connectBtn.Parent = frame
    
    connectBtn.MouseButton1Click:Connect(function()
        if pluginSession.status == "Connected" then
            SqueezePlugin.Disconnect("User disconnected")
            connectBtn.Text = "Connect"
            statusLbl.Text = "Status: Disconnected"
            codeInput.Visible = true
        else
            local code = codeInput.Text
            if code ~= "" then
                connectBtn.Text = "Connecting..."
                local ok, msg = SqueezePlugin.PairWithCode(code)
                if ok then
                    connectBtn.Text = "Disconnect"
                    statusLbl.Text = "Status: Connected"
                    codeInput.Visible = false
                else
                    connectBtn.Text = "Connect"
                    statusLbl.Text = "Error: " .. msg
                end
            end
        end
    end)
    
    toggleButton.Click:Connect(function()
        widget.Enabled = not widget.Enabled
    end)
end

-- If ran as a Roblox plugin
if plugin then
    createPluginUI(plugin)
end

return SqueezePlugin
`;
