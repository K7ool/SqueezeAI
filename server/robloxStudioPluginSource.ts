export const OFFICIAL_ROBLOX_STUDIO_PLUGIN_SOURCE = `--!strict
-- Squeeze Roblox Studio WebSync Companion Plugin v5.0.0
-- Real-Time Bidirectional Synchronization for Roblox Studio & Squeeze AI Agent
-- Supports Instant Auto-Connect (Zero-Pairing), ScriptEditorService Updates, and Studio Companion Panel.

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
local LogService = game:GetService("LogService")

-- Safely acquire ScriptEditorService if available in Studio
local ScriptEditorService: any = nil
pcall(function()
    ScriptEditorService = game:GetService("ScriptEditorService")
end)

-- Configuration
local DEFAULT_BACKEND_URL = "http://localhost:3000/api/studio"
local POLL_INTERVAL_SECONDS = 3.0
local HEARTBEAT_INTERVAL_SECONDS = 10.0
local MAX_RETRY_ATTEMPTS = 5

-- Log Buffer for capturing console and runtime errors
local logBuffer = {} :: {any}

pcall(function()
    LogService.MessageOut:Connect(function(message, messageType)
        table.insert(logBuffer, {
            message = message,
            messageType = messageType.Name,
            timestamp = os.time()
        })
        if #logBuffer > 150 then
            table.remove(logBuffer, 1)
        end
    end)
end)

-- Plugin State
local pluginSession = {
    backendUrl = DEFAULT_BACKEND_URL,
    token = "",
    pairingCode = "AUTO_CONNECT",
    sessionId = "",
    projectId = "",
    projectName = "",
    status = "Connecting", -- Connecting, Connected, Syncing, Offline, AuthenticationExpired, Error
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
    local s = str or ""
    for i = 1, #s do
        h = (h * 31 + string.byte(s, i)) % 2147483647
    end
    return string.format("%08x", h)
end

-- Resolve Container Instance from Virtual Path
local function resolveParentFromPath(path: string): (Instance?, string)
    if not path or path == "" then return game, "" end
    local parts = string.split(path, "/")
    local instanceName = parts[#parts] or "Script"
    
    instanceName = instanceName:gsub("%.server%.luau$", ""):gsub("%.client%.luau$", ""):gsub("%.luau$", ""):gsub("%.lua$", "")
    
    local currentParent: Instance = game
    local root = parts[1] or ""
    
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
    
    local startIdx = (parts[1] == "src" and 3 or (root == currentParent.Name and 2 or 1))
    for i = startIdx, #parts - 1 do
        local folderName = parts[i]
        if folderName and folderName ~= "" then
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
    end
    
    return currentParent, instanceName
end

local function findInstanceByPath(path: string): (Instance?, Instance?)
    local parent, instanceName = resolveParentFromPath(path)
    if not parent then return nil, nil end
    local found = parent:FindFirstChild(instanceName)
    return found, parent
end

-- Safely Update Script Source using ScriptEditorService or Direct Property
local function setScriptSourceSafely(inst: Instance, newSource: string): (boolean, string?)
    if not inst or not inst:IsA("LuaSourceContainer") then
        return false, "Target is not a LuaSourceContainer"
    end
    
    local sourceValue = newSource or ""
    local editorUpdated = false

    if ScriptEditorService then
        pcall(function()
            ScriptEditorService:UpdateSourceAsync(inst, function(oldSource)
                return sourceValue
            end)
            editorUpdated = true
        end)
    end

    if not editorUpdated then
        local ok, err = pcall(function()
            (inst :: any).Source = sourceValue
        end)
        if not ok then
            return false, "Script source update failed (check Script Injection Permissions): " .. tostring(err)
        end
    end

    return true, nil
end

-- Apply incoming operation from Squeeze Website / AI Agent
local function applyOperation(op: any): (boolean, string?)
    if not op or type(op) ~= "table" then
        return false, "Invalid operation payload"
    end

    local opType = op.operation or op.action or "updateScript"
    local path = op.path or op.parentPath or ""
    
    if opType == "createInstance" or opType == "createScript" or opType == "updateScript" or opType == "update" then
        local className = op.className or (tostring(opType):match("Script") and "Script" or "Folder")
        local existingInst, parent = findInstanceByPath(path)
        if op.name and parent then
            path = (path ~= "" and path .. "/" or "") .. tostring(op.name)
            existingInst, parent = findInstanceByPath(path)
        end
        if not parent then return false, "Invalid parent path: " .. tostring(path) end
        
        pcall(function() ChangeHistoryService:SetWaypoint("Before Squeeze Op: " .. tostring(path)) end)
        
        local inst = existingInst
        if not inst then
            inst = Instance.new(className)
            local _, nm = resolveParentFromPath(path)
            inst.Name = op.name or nm or "NewInstance"
            inst.Parent = parent
        elseif inst.ClassName ~= className and tostring(className):match("Script") then
            local newInst = Instance.new(className)
            newInst.Name = inst.Name
            newInst.Parent = parent
            if inst:IsA("LuaSourceContainer") then
                setScriptSourceSafely(newInst, (inst :: any).Source)
            end
            inst:Destroy()
            inst = newInst
        end
        
        if op.source and inst:IsA("LuaSourceContainer") then
            local okSource, errSource = setScriptSourceSafely(inst, op.source)
            if not okSource then
                return false, errSource
            end
            pluginSession.fileHashes[path] = simpleHash(op.source)
        end
        
        if op.properties and type(op.properties) == "table" then
            for k, v in pairs(op.properties) do
                pcall(function() (inst :: any)[k] = v end)
            end
        end
        
        if op.attributes and type(op.attributes) == "table" then
            for k, v in pairs(op.attributes) do
                pcall(function() inst:SetAttribute(k, v) end)
            end
        end
        
        pcall(function() ChangeHistoryService:SetWaypoint("Squeeze Op Complete: " .. tostring(path)) end)
        return true, nil
        
    elseif opType == "deleteInstance" or opType == "deleteScript" or opType == "delete" then
        local existingInst = findInstanceByPath(path)
        if existingInst then
            pcall(function() ChangeHistoryService:SetWaypoint("Before Squeeze Delete: " .. tostring(path)) end)
            existingInst:Destroy()
            pcall(function() ChangeHistoryService:SetWaypoint("Squeeze Deleted: " .. tostring(path)) end)
        end
        return true, nil
        
    elseif opType == "setProperty" then
        local existingInst = findInstanceByPath(path)
        if not existingInst then return false, "Instance not found for setProperty: " .. tostring(path) end
        pcall(function() ChangeHistoryService:SetWaypoint("Before Squeeze SetProperty: " .. tostring(path)) end)
        for k, v in pairs(op.properties or {}) do
            pcall(function() (existingInst :: any)[k] = v end)
        end
        pcall(function() ChangeHistoryService:SetWaypoint("Squeeze SetProperty: " .. tostring(path)) end)
        return true, nil
        
    elseif opType == "setAttribute" then
        local existingInst = findInstanceByPath(path)
        if not existingInst then return false, "Instance not found for setAttribute: " .. tostring(path) end
        pcall(function() ChangeHistoryService:SetWaypoint("Before Squeeze SetAttribute: " .. tostring(path)) end)
        for k, v in pairs(op.attributes or {}) do
            pcall(function() existingInst:SetAttribute(k, v) end)
        end
        pcall(function() ChangeHistoryService:SetWaypoint("Squeeze SetAttribute: " .. tostring(path)) end)
        return true, nil
        
    elseif opType == "renameInstance" then
        local existingInst = findInstanceByPath(path)
        if not existingInst then return false, "Instance not found for rename: " .. tostring(path) end
        pcall(function() ChangeHistoryService:SetWaypoint("Before Squeeze Rename: " .. tostring(path)) end)
        existingInst.Name = op.newName or op.name or existingInst.Name
        pcall(function() ChangeHistoryService:SetWaypoint("Squeeze Rename: " .. tostring(path)) end)
        return true, nil
        
    elseif opType == "moveInstance" then
        local existingInst = findInstanceByPath(path)
        local newParent = resolveParentFromPath(op.newParentPath or "")
        if not existingInst or not newParent then return false, "Instance or new parent not found" end
        pcall(function() ChangeHistoryService:SetWaypoint("Before Squeeze Move: " .. tostring(path)) end)
        existingInst.Parent = newParent
        pcall(function() ChangeHistoryService:SetWaypoint("Squeeze Move: " .. tostring(path)) end)
        return true, nil
    end
    
    return false, "Unknown operation type: " .. tostring(opType)
end

-- HTTP Request wrapper with safe pcall, non-JSON handling, and 401 detection
local function httpRequest(url: string, method: string, bodyData: any, token: string?): (boolean, any, number)
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
        return false, tostring(response), 0 
    end

    local statusCode = response.StatusCode or 0

    if statusCode == 401 then
        return false, "401 Unauthorized", 401
    end

    if not response.Success then 
        return false, "HTTP " .. tostring(statusCode) .. ": " .. tostring(response.Body), statusCode 
    end
    
    local decodeSuccess, decoded = pcall(function() 
        return HttpService:JSONDecode(response.Body) 
    end)

    if not decodeSuccess then 
        return false, "Invalid JSON response from server", statusCode 
    end
    
    return true, decoded, statusCode
end

-- Proactive Script Injection and Writing Permission Request
local function requestAllPermissions(): boolean
    -- Creating a temporary Script object and setting its parent to ServerScriptService.
    -- This instantly prompts the user with the Roblox Studio Script Injection permission dialog on startup/connection.
    local success, err = pcall(function()
        local testScript = Instance.new("Script")
        testScript.Name = "SqueezePermissionCheck"
        testScript.Source = "-- Squeeze Permission Check\n-- Thank you for granting permissions! Squeeze is now fully authorized."
        testScript.Parent = game:GetService("ServerScriptService")
        testScript:Destroy()
    end)
    return success
end

local SqueezePlugin = {}

function SqueezePlugin.AutoConnect(): (boolean, string)
    pluginSession.status = "Connecting"
    
    -- Request permissions proactively on connect
    requestAllPermissions()
    
    local autoUrl = pluginSession.backendUrl .. "/auto-connect"
    local success, data, statusCode = httpRequest(
        autoUrl,
        "POST",
        {
            placeId = game.PlaceId,
            placeName = game.Name ~= "" and game.Name or "Roblox Studio Place",
            universeId = game.GameId,
            pluginVersion = "5.0.0"
        },
        pluginSession.token ~= "" and pluginSession.token or nil
    )
    
    if not success or not data or not data.success then
        pluginSession.status = "Offline"
        pluginSession.consecutiveErrors = pluginSession.consecutiveErrors + 1
        local errStr = type(data) == "table" and (data.error and (data.error.message or data.error) or "Auto Connect failed") or tostring(data)
        return false, errStr
    end
    
    pluginSession.token = data.token or ""
    pluginSession.sessionId = data.sessionId or ""
    pluginSession.projectId = data.projectId or "prj_default_roblox"
    pluginSession.projectName = data.projectName or "Roblox Project"
    pluginSession.status = "Connected"
    pluginSession.consecutiveErrors = 0
    pluginSession.lastHeartbeatTime = os.clock()
    pluginSession.lastSyncTime = os.clock()
    
    task.spawn(function() 
        pcall(function() SqueezePlugin.PushExplorerTree() end) 
    end)

    SqueezePlugin.StartPolling()
    
    return true, "Connected automatically to Squeeze AI Platform."
end

function SqueezePlugin.PairWithCode(pairingCode: string, customUrl: string?): (boolean, string)
    if customUrl and customUrl ~= "" then
        pluginSession.backendUrl = customUrl:gsub("/+$", "")
    end
    
    return SqueezePlugin.AutoConnect()
end

function SqueezePlugin.SendHeartbeat()
    if pluginSession.token == "" then 
        SqueezePlugin.AutoConnect()
        return 
    end
    
    local heartbeatUrl = pluginSession.backendUrl .. "/heartbeat"
    local logsToSend = logBuffer
    logBuffer = {}
    
    local success, data, statusCode = httpRequest(
        heartbeatUrl,
        "POST",
        {
            placeId = game.PlaceId,
            placeName = game.Name ~= "" and game.Name or "Roblox Studio Place",
            universeId = game.GameId,
            pluginVersion = "5.0.0",
            logs = logsToSend
        },
        pluginSession.token
    )
    
    if statusCode == 401 then
        pluginSession.status = "AuthenticationExpired"
        pluginSession.token = ""
        SqueezePlugin.AutoConnect()
        return
    end

    if success and data and data.success then
        pluginSession.lastHeartbeatTime = os.clock()
        pluginSession.status = "Connected"
        pluginSession.consecutiveErrors = 0
        pluginSession.pendingChangesCount = data.pendingChangesCount or 0
    else
        pluginSession.consecutiveErrors = pluginSession.consecutiveErrors + 1
        if pluginSession.consecutiveErrors >= 3 then 
            pluginSession.status = "Offline" 
            task.spawn(function() SqueezePlugin.AutoConnect() end)
        end
    end
end

function SqueezePlugin.PollAndApplyChanges(): number
    if pluginSession.token == "" then return 0 end
    
    local pullUrl = pluginSession.backendUrl .. "/operations/pending"
    local success, data, statusCode = httpRequest(pullUrl, "GET", nil, pluginSession.token)
    
    if statusCode == 401 then
        pluginSession.status = "AuthenticationExpired"
        pluginSession.token = ""
        SqueezePlugin.AutoConnect()
        return 0
    end

    if not success and (statusCode == 404 or tostring(data):find("404")) then
        pullUrl = pluginSession.backendUrl .. "/files/pull"
        success, data, statusCode = httpRequest(pullUrl, "GET", nil, pluginSession.token)
    end
    
    if not success or not data or not data.success or not (data.operations or data.changes) then 
        return 0 
    end

    local ops = data.operations or data.changes
    if type(ops) ~= "table" then return 0 end

    local appliedCount = 0
    for _, op in ipairs(ops) do
        local ok, err = false, "Execution error"
        local pcallOk, pcallRes, pcallErr = pcall(function()
            return applyOperation(op)
        end)
        if pcallOk then
            ok = pcallRes
            err = pcallErr or "Operation failed"
        else
            err = tostring(pcallRes)
        end
        
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
        if not inst then return end
        local nodePath = currentPath .. "/" .. inst.Name
        table.insert(treeNodes, {
            name = inst.Name,
            className = inst.ClassName,
            path = nodePath
        })
        
        if inst:IsA("LuaSourceContainer") then
            local ext = inst:IsA("LocalScript") and ".client.luau" or inst:IsA("ModuleScript") and ".luau" or ".server.luau"
            local fullScriptPath = nodePath .. ext
            local src = (inst :: any).Source or ""
            table.insert(scriptFiles, {
                path = fullScriptPath,
                name = inst.Name .. ext,
                className = inst.ClassName,
                source = src
            })
            pluginSession.fileHashes[fullScriptPath] = simpleHash(src)
        end
        for _, child in ipairs(inst:GetChildren()) do scan(child, nodePath) end
    end
    
    pcall(function() scan(ServerScriptService, "ServerScriptService") end)
    pcall(function() scan(ReplicatedStorage, "ReplicatedStorage") end)
    pcall(function() scan(StarterPlayer.StarterPlayerScripts, "StarterPlayer/StarterPlayerScripts") end)
    pcall(function() scan(StarterGui, "StarterGui") end)
    pcall(function() scan(Workspace, "Workspace") end)
    
    local snapshotUrl = pluginSession.backendUrl .. "/project/snapshot"
    local success = httpRequest(snapshotUrl, "POST", { tree = treeNodes, scriptFiles = scriptFiles }, pluginSession.token)
    return success, #scriptFiles
end

function SqueezePlugin.StartPolling()
    if pluginSession.isPolling then return end
    pluginSession.isPolling = true
    task.spawn(function()
        while pluginSession.isPolling do
            if pluginSession.token == "" or pluginSession.status == "Offline" or pluginSession.status == "AuthenticationExpired" then
                SqueezePlugin.AutoConnect()
            else
                SqueezePlugin.PollAndApplyChanges()
                if os.clock() - pluginSession.lastHeartbeatTime >= HEARTBEAT_INTERVAL_SECONDS then
                    SqueezePlugin.SendHeartbeat()
                end
            end
            task.wait(POLL_INTERVAL_SECONDS)
        end
        pluginSession.isPolling = false
    end)
end

function SqueezePlugin.Disconnect(reason: string?)
    if pluginSession.token ~= "" then 
        pcall(function() 
            httpRequest(pluginSession.backendUrl .. "/disconnect", "POST", { reason = reason or "Studio closed" }, pluginSession.token) 
        end) 
    end
    pluginSession.token = ""
    pluginSession.status = "Disconnected"
    pluginSession.isPolling = false
end

function SqueezePlugin.GetStatus() return pluginSession end

-- =========================================================================
-- PLUGIN UI INJECTION (FOR ROBLOX STUDIO TOOLBAR & STATUS PANEL)
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
        280,
        250,
        280
    )
    
    widget = plugin:CreateDockWidgetPluginGui("SqueezeWebSyncPanel", widgetInfo)
    widget.Title = "Squeeze Studio Operator"
    
    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(1, 0, 1, 0)
    frame.BackgroundColor3 = Color3.fromRGB(17, 22, 29)
    frame.Parent = widget
    
    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 40)
    title.Text = "🍋 Squeeze WebSync v5.1"
    title.TextColor3 = Color3.fromRGB(255, 201, 60)
    title.BackgroundTransparency = 1
    title.Font = Enum.Font.GothamBold
    title.TextSize = 16
    title.Parent = frame
    
    local statusLbl = Instance.new("TextLabel")
    statusLbl.Size = UDim2.new(1, -20, 0, 25)
    statusLbl.Position = UDim2.new(0, 10, 0, 45)
    statusLbl.Text = "Status: Connecting..."
    statusLbl.TextColor3 = Color3.fromRGB(180, 180, 180)
    statusLbl.BackgroundTransparency = 1
    statusLbl.Font = Enum.Font.GothamMedium
    statusLbl.TextSize = 13
    statusLbl.Parent = frame

    local permLbl = Instance.new("TextLabel")
    permLbl.Size = UDim2.new(1, -20, 0, 25)
    permLbl.Position = UDim2.new(0, 10, 0, 70)
    permLbl.Text = "Script Access: Checking..."
    permLbl.TextColor3 = Color3.fromRGB(180, 180, 180)
    permLbl.BackgroundTransparency = 1
    permLbl.Font = Enum.Font.GothamMedium
    permLbl.TextSize = 12
    permLbl.Parent = frame

    local infoLbl = Instance.new("TextLabel")
    infoLbl.Size = UDim2.new(1, -20, 0, 50)
    infoLbl.Position = UDim2.new(0, 10, 0, 100)
    infoLbl.Text = "Grant the 'Allow Script Injection' permission in the popup so Squeeze can create and modify scripts automatically."
    infoLbl.TextColor3 = Color3.fromRGB(180, 180, 180)
    infoLbl.BackgroundTransparency = 1
    infoLbl.Font = Enum.Font.Gotham
    infoLbl.TextSize = 11
    infoLbl.TextWrapped = true
    infoLbl.Parent = frame

    local function updateStatus(isConnected, msg)
        if isConnected then
            statusLbl.Text = "Status: 🟢 Studio Connected"
            statusLbl.TextColor3 = Color3.fromRGB(63, 185, 80)
        else
            statusLbl.Text = "Status: 🔴 " .. (msg or "Offline")
            statusLbl.TextColor3 = Color3.fromRGB(255, 100, 100)
        end
        
        local hasPerm = requestAllPermissions()
        if hasPerm then
            permLbl.Text = "Script Access: 🟢 Authorized"
            permLbl.TextColor3 = Color3.fromRGB(63, 185, 80)
            infoLbl.Text = "Squeeze is fully authorized. AI scripts will be synchronized and inserted live into your game."
            infoLbl.TextColor3 = Color3.fromRGB(150, 150, 150)
        else
            permLbl.Text = "Script Access: ⚠️ Action Required"
            permLbl.TextColor3 = Color3.fromRGB(255, 160, 0)
            infoLbl.Text = "Permission Denied! Click 'Request Permission' below or open 'Manage Plugins' to toggle 'Allow Script Injection' on."
            infoLbl.TextColor3 = Color3.fromRGB(255, 140, 140)
        end
    end

    local reconnectBtn = Instance.new("TextButton")
    reconnectBtn.Size = UDim2.new(0.8, 0, 0, 32)
    reconnectBtn.Position = UDim2.new(0.1, 0, 0, 160)
    reconnectBtn.Text = "Reconnect WebSync"
    reconnectBtn.BackgroundColor3 = Color3.fromRGB(255, 201, 60)
    reconnectBtn.TextColor3 = Color3.fromRGB(11, 18, 13)
    reconnectBtn.Font = Enum.Font.GothamBold
    reconnectBtn.TextSize = 13
    reconnectBtn.BorderSizePixel = 0
    reconnectBtn.Parent = frame

    local permBtn = Instance.new("TextButton")
    permBtn.Size = UDim2.new(0.8, 0, 0, 32)
    permBtn.Position = UDim2.new(0.1, 0, 0, 200)
    permBtn.Text = "Request Permission"
    permBtn.BackgroundColor3 = Color3.fromRGB(40, 48, 59)
    permBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
    permBtn.Font = Enum.Font.GothamBold
    permBtn.TextSize = 13
    permBtn.BorderSizePixel = 0
    permBtn.Parent = frame
    
    reconnectBtn.MouseButton1Click:Connect(function()
        reconnectBtn.Text = "Connecting..."
        local ok, msg = SqueezePlugin.AutoConnect()
        updateStatus(ok, msg)
        reconnectBtn.Text = "Reconnect WebSync"
    end)

    permBtn.MouseButton1Click:Connect(function()
        local ok = requestAllPermissions()
        updateStatus(pluginSession.status == "Connected", (pluginSession.status == "Connected" and nil or "Offline"))
    end)

    -- Auto Connect on UI creation
    task.defer(function()
        local ok, msg = SqueezePlugin.AutoConnect()
        updateStatus(ok, msg)
    end)
    
    toggleButton.Click:Connect(function()
        widget.Enabled = not widget.Enabled
    end)
end

-- Auto Connect when script runs
task.spawn(function()
    SqueezePlugin.AutoConnect()
end)

-- If ran as a Roblox plugin
if plugin then
    createPluginUI(plugin)
end

return SqueezePlugin
`;
