import JSZip from 'jszip';
import { RobloxProject, ProjectFile, IdeaNode, ChatSession } from '../types/project';

const PROJECT_STORAGE_KEY = 'squeeze_roblox_local_project_v2';
const CHAT_SESSIONS_STORAGE_KEY = 'squeeze_roblox_chat_sessions_v1';

export function createDefaultProject(initialScript?: {
  title?: string;
  code?: string;
  scriptType?: string;
  targetInstance?: string;
}): RobloxProject {
  const timestamp = Date.now();
  const scriptCode = initialScript?.code || `-- Roblox Studio Luau Server Script
--!strict
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

print("⚡ [Squeeze Studio] Server initialized successfully!")

Players.PlayerAdded:Connect(function(player: Player)
\tprint("Player joined:", player.Name)
end)`;

  const mainFile: ProjectFile = {
    id: 'file-main-server',
    name: initialScript?.title ? `${initialScript.title.replace(/\s+/g, '')}.server.luau` : 'MainHandler.server.luau',
    path: 'src/server/MainHandler.server.luau',
    code: scriptCode,
    scriptType: (initialScript?.scriptType as any) || 'Server Script',
    targetInstance: initialScript?.targetInstance || 'ServerScriptService',
    lastModified: timestamp,
    tags: ['Server', 'Core']
  };

  const clientFile: ProjectFile = {
    id: 'file-client-controller',
    name: 'ClientController.client.luau',
    path: 'src/client/ClientController.client.luau',
    code: `-- Roblox Studio Luau Client Controller
--!strict
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local localPlayer = Players.LocalPlayer
local character = localPlayer.Character or localPlayer.CharacterAdded:Wait()
local humanoid = character:WaitForChild("Humanoid") :: Humanoid

print("Client Controller loaded for", localPlayer.Name)`,
    scriptType: 'LocalScript',
    targetInstance: 'StarterPlayer.StarterPlayerScripts',
    lastModified: timestamp,
    tags: ['Client', 'Input']
  };

  const typesFile: ProjectFile = {
    id: 'file-types-module',
    name: 'Types.luau',
    path: 'src/shared/Types.luau',
    code: `-- Shared Type Definitions
--!strict
export type PlayerStats = {
\tCoins: number,
\tGems: number,
\tLevel: number,
\tLastLogin: number,
}

export type ItemData = {
\tId: string,
\tDisplayName: string,
\tPrice: number,
\tRarity: "Common" | "Rare" | "Epic" | "Legendary",
}

return {}`,
    scriptType: 'ModuleScript',
    targetInstance: 'ReplicatedStorage.Common.Types',
    lastModified: timestamp,
    tags: ['Shared', 'Types']
  };

  const defaultIdeas: IdeaNode[] = [
    {
      id: 'idea-root-1',
      label: 'Treasure Chest',
      description: 'Interactive loot chest with proximity prompts and cooldowns.',
      category: 'mechanic',
      status: 'idle',
      scriptTitle: 'Treasure Chest Spawner',
      scriptType: 'Server Script',
      targetInstance: 'ServerScriptService.ChestHandler',
      filePath: 'src/server/TreasureChest.server.luau',
      childrenIds: ['idea-root-2']
    },
    {
      id: 'idea-root-2',
      label: 'Rare Items',
      description: 'Weighted probability drop tables with tiered rarities.',
      category: 'item',
      parentId: 'idea-root-1',
      status: 'idle',
      scriptTitle: 'Rare Items Drop Table',
      scriptType: 'ModuleScript',
      targetInstance: 'ReplicatedStorage.Common.LootTable',
      filePath: 'src/shared/LootTable.luau',
      childrenIds: ['idea-root-3']
    },
    {
      id: 'idea-root-3',
      label: 'VFX open for Chest',
      description: 'Particle bursts, spring lid physics, and sound effects on interaction.',
      category: 'vfx',
      parentId: 'idea-root-2',
      status: 'idle',
      scriptTitle: 'Chest Opening VFX & Tween',
      scriptType: 'LocalScript',
      targetInstance: 'StarterPlayer.StarterPlayerScripts.ChestVFX',
      filePath: 'src/client/ChestVFX.client.luau',
      childrenIds: []
    }
  ];

  return {
    id: `proj-${Date.now()}`,
    name: initialScript?.title ? `${initialScript.title} Game Project` : 'Roblox Luau Studio Project',
    description: 'Production-ready Roblox Luau modular project synced to disk.',
    version: '1.0.0',
    folderName: 'RobloxProject',
    files: [mainFile, clientFile, typesFile],
    activeFileId: mainFile.id,
    ideaNodes: defaultIdeas,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function loadProjectFromLocalStorage(): RobloxProject {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load local project:', err);
  }
  return createDefaultProject();
}

export function saveProjectToLocalStorage(project: RobloxProject): void {
  try {
    project.updatedAt = Date.now();
    // Strip non-serializable directory handles before storing to localStorage
    const safeProject = {
      ...project,
      dirHandle: undefined,
      files: project.files.map(f => ({ ...f, fileHandle: undefined }))
    };
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(safeProject));
  } catch (err) {
    console.error('Failed to save local project:', err);
  }
}

// -------------------------------------------------------------
// NATIVE FOLDER ACCESS & DISK I/O (File System Access API)
// -------------------------------------------------------------

/**
 * Prompts user to pick a folder on their computer and loads all Luau, Lua, JSON, MD files.
 */
export async function openProjectDirectoryNative(): Promise<{
  success: boolean;
  project?: RobloxProject;
  error?: string;
}> {
  if (typeof (window as any).showDirectoryPicker !== 'function') {
    return { 
      success: false, 
      error: 'Your browser does not support the native File System Access API. Please use folder upload.' 
    };
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite'
    });

    const folderName = dirHandle.name;
    const loadedFiles: ProjectFile[] = [];

    // Recursively iterate over files
    async function scanDirectory(handle: any, currentPath = '') {
      for await (const entry of handle.values()) {
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        
        // Skip node_modules or .git
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.vscode') {
          continue;
        }

        if (entry.kind === 'file') {
          const lower = entry.name.toLowerCase();
          if (
            lower.endsWith('.luau') || 
            lower.endsWith('.lua') || 
            lower.endsWith('.json') || 
            lower.endsWith('.md') ||
            lower.endsWith('.txt') ||
            lower.endsWith('.rbxmx')
          ) {
            try {
              const file = await entry.getFile();
              const text = await file.text();
              
              let scriptType: ProjectFile['scriptType'] = 'Server Script';
              let targetInstance = 'ServerScriptService';

              if (lower.includes('.client.') || lower.includes('client')) {
                scriptType = 'LocalScript';
                targetInstance = 'StarterPlayer.StarterPlayerScripts';
              } else if (lower.includes('module') || lower.endsWith('.luau') && !lower.includes('server')) {
                scriptType = 'ModuleScript';
                targetInstance = 'ReplicatedStorage.Common';
              } else if (lower.endsWith('.json')) {
                scriptType = 'Json';
                targetInstance = 'Config';
              } else if (lower.endsWith('.md')) {
                scriptType = 'Markdown';
                targetInstance = 'Documentation';
              }

              loadedFiles.push({
                id: `file-disk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name: entry.name,
                path: entryPath,
                code: text,
                scriptType,
                targetInstance,
                lastModified: file.lastModified || Date.now(),
                fileHandle: entry
              });
            } catch (err) {
              console.warn(`Could not read file ${entryPath}:`, err);
            }
          }
        } else if (entry.kind === 'directory') {
          await scanDirectory(entry, entryPath);
        }
      }
    }

    await scanDirectory(dirHandle);

    if (loadedFiles.length === 0) {
      // Create starter file if folder was empty
      loadedFiles.push({
        id: `file-${Date.now()}`,
        name: 'MainHandler.server.luau',
        path: 'src/server/MainHandler.server.luau',
        code: `--!strict\nprint("⚡ [${folderName}] Initialized via Squeeze!")`,
        scriptType: 'Server Script',
        targetInstance: 'ServerScriptService',
        lastModified: Date.now()
      });
    }

    const newProject: RobloxProject = {
      id: `proj-${Date.now()}`,
      name: folderName,
      folderName: folderName,
      description: `Locally connected Roblox project: ${folderName}`,
      version: '1.0.0',
      isNativeDirectoryMounted: true,
      dirHandle,
      files: loadedFiles,
      activeFileId: loadedFiles[0].id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ideaNodes: [
        {
          id: 'idea-root-1',
          label: 'Treasure Chest',
          description: 'Interactive loot chest with proximity prompts.',
          category: 'mechanic',
          status: 'idle',
          scriptTitle: 'Treasure Chest Spawner',
          scriptType: 'Server Script',
          targetInstance: 'ServerScriptService.ChestHandler',
          filePath: 'src/server/TreasureChest.server.luau',
          childrenIds: ['idea-root-2']
        },
        {
          id: 'idea-root-2',
          label: 'Rare Items',
          description: 'Weighted probability drop tables with tiered rarities.',
          category: 'item',
          parentId: 'idea-root-1',
          status: 'idle',
          scriptTitle: 'Rare Items Drop Table',
          scriptType: 'ModuleScript',
          targetInstance: 'ReplicatedStorage.Common.LootTable',
          filePath: 'src/shared/LootTable.luau',
          childrenIds: ['idea-root-3']
        },
        {
          id: 'idea-root-3',
          label: 'VFX open for Chest',
          description: 'Particle bursts, spring lid physics, and audio.',
          category: 'vfx',
          parentId: 'idea-root-2',
          status: 'idle',
          scriptTitle: 'Chest Opening VFX & Tween',
          scriptType: 'LocalScript',
          targetInstance: 'StarterPlayer.StarterPlayerScripts.ChestVFX',
          filePath: 'src/client/ChestVFX.client.luau',
          childrenIds: []
        }
      ]
    };

    saveProjectToLocalStorage(newProject);

    return {
      success: true,
      project: newProject
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Directory selection was cancelled.' };
    }
    return { success: false, error: err.message || 'Failed to open directory.' };
  }
}

/**
 * Verifies or requests read/write permission for a FileSystemHandle.
 */
export async function verifyHandlePermission(handle: any, readWrite = true): Promise<boolean> {
  if (!handle || typeof handle.queryPermission !== 'function') return true;
  const options: any = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch (err) {
    console.warn('Permission query/request error:', err);
  }
  return false;
}

/**
 * Saves a file's code directly back to the native file handle or project folder on disk using File System Access API.
 */
export async function saveFileToDiskHandle(
  file: ProjectFile, 
  newCode: string,
  dirHandle?: any,
  options?: { forcePicker?: boolean; promptIfNoDir?: boolean }
): Promise<{ success: boolean; method: 'native-folder' | 'native-file' | 'native-picker' | 'download'; filename: string; path?: string; handle?: any; error?: string }> {
  const cleanName = file.name.endsWith('.luau') || file.name.endsWith('.lua') || file.name.endsWith('.json') || file.name.endsWith('.md')
    ? file.name
    : `${file.name.replace(/\s+/g, '_')}.luau`;

  // 1. If explicit picker is requested
  if (options?.forcePicker && typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: cleanName,
        types: [
          {
            description: 'Luau Script (*.luau, *.lua)',
            accept: {
              'text/plain': ['.luau', '.lua', '.txt', '.json', '.md']
            }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(newCode);
      await writable.close();
      file.fileHandle = handle;
      return { success: true, method: 'native-picker', filename: handle.name || cleanName, handle };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'native-picker', filename: cleanName, error: 'Save was cancelled.' };
      }
      console.warn('showSaveFilePicker failed:', err);
    }
  }

  // 2. Direct write to existing fileHandle
  if (file.fileHandle && typeof file.fileHandle.createWritable === 'function') {
    try {
      const hasPerm = await verifyHandlePermission(file.fileHandle, true);
      if (hasPerm) {
        const writable = await file.fileHandle.createWritable();
        await writable.write(newCode);
        await writable.close();
        return { success: true, method: 'native-file', filename: file.name, path: file.path, handle: file.fileHandle };
      }
    } catch (err) {
      console.warn('Direct file handle write failed:', err);
    }
  }

  // 3. Write through mounted project dirHandle (navigating nested folder hierarchy)
  if (dirHandle && typeof dirHandle.getFileHandle === 'function') {
    try {
      const hasPerm = await verifyHandlePermission(dirHandle, true);
      if (hasPerm) {
        const normalizedPath = (file.path || file.name).replace(/^\/+/, '');
        const parts = normalizedPath.split('/').filter(Boolean);
        let currentDir = dirHandle;
        
        for (let i = 0; i < parts.length - 1; i++) {
          currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
        }

        const fileName = parts.length > 0 ? parts[parts.length - 1] : cleanName;
        const targetFileHandle = await currentDir.getFileHandle(fileName, { create: true });
        const writable = await targetFileHandle.createWritable();
        await writable.write(newCode);
        await writable.close();
        
        file.fileHandle = targetFileHandle;
        return { 
          success: true, 
          method: 'native-folder', 
          filename: fileName, 
          path: file.path, 
          handle: targetFileHandle 
        };
      }
    } catch (err: any) {
      console.warn('Mounted dirHandle write failed:', err);
    }
  }

  // 4. If no dirHandle is mounted, use showSaveFilePicker if available
  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: cleanName,
        types: [
          {
            description: 'Luau Script (*.luau, *.lua)',
            accept: {
              'text/plain': ['.luau', '.lua', '.txt', '.json', '.md']
            }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(newCode);
      await writable.close();
      file.fileHandle = handle;
      return { success: true, method: 'native-picker', filename: handle.name || cleanName, handle };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'native-picker', filename: cleanName, error: 'Save was cancelled.' };
      }
      console.warn('showSaveFilePicker failed or cancelled, falling back to download:', err);
    }
  }

  // 5. Fallback to browser blob download
  const blob = new Blob([newCode], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { success: true, method: 'download', filename: cleanName };
}

/**
 * Reloads the newest content of a file from disk if a native fileHandle exists.
 */
export async function reloadFileFromDisk(file: ProjectFile): Promise<{ success: boolean; code?: string; error?: string }> {
  if (!file.fileHandle || typeof file.fileHandle.getFile !== 'function') {
    return { success: false, error: 'No native file handle linked to this file.' };
  }
  try {
    const hasPerm = await verifyHandlePermission(file.fileHandle, false);
    if (!hasPerm) {
      return { success: false, error: 'Permission denied to read local file.' };
    }
    const diskFile = await file.fileHandle.getFile();
    const text = await diskFile.text();
    return { success: true, code: text };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reload file from disk.' };
  }
}

/**
 * Saves all files in the project to disk if directory handle exists.
 */
export async function saveAllProjectFilesToDisk(
  project: RobloxProject
): Promise<{ total: number; savedCount: number; failedCount: number }> {
  let savedCount = 0;
  let failedCount = 0;

  for (const file of project.files) {
    try {
      const res = await saveFileToDiskHandle(file, file.code, project.dirHandle);
      if (res.success) {
        savedCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return { total: project.files.length, savedCount, failedCount };
}

/**
 * Saves a single script to disk using File System Access API or browser download.
 */
export async function saveSingleScriptToDisk(
  filename: string,
  code: string,
  suggestedExtension = '.luau'
): Promise<{ success: boolean; method: 'native' | 'download'; filename: string }> {
  const cleanName = filename.endsWith('.luau') || filename.endsWith('.lua') || filename.endsWith('.json') || filename.endsWith('.md')
    ? filename
    : `${filename.replace(/\s+/g, '_')}${suggestedExtension}`;

  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: cleanName,
        types: [
          {
            description: 'Luau Script (*.luau, *.lua)',
            accept: {
              'text/plain': ['.luau', '.lua', '.txt', '.json', '.md']
            }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(code);
      await writable.close();
      return { success: true, method: 'native', filename: cleanName };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'native', filename: cleanName };
      }
      console.warn('showSaveFilePicker failed or cancelled, falling back to download:', err);
    }
  }

  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { success: true, method: 'download', filename: cleanName };
}

/**
 * Exports entire project as a complete ZIP file.
 */
export async function exportProjectToZip(project: RobloxProject): Promise<void> {
  const zip = new JSZip();
  const folderName = (project.folderName || project.name).replace(/[^a-zA-Z0-9_-]/g, '_');

  for (const file of project.files) {
    zip.file(file.path, file.code);
  }

  const manifest = {
    name: project.name,
    description: project.description,
    version: project.version,
    exportedAt: new Date().toISOString(),
    filesCount: project.files.length,
    engine: "Squeeze Roblox Luau Studio Engine 2026"
  };
  zip.file('project.squeeze.json', JSON.stringify(manifest, null, 2));

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}_Roblox_Project.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Parses files uploaded via <input type="file" webkitdirectory directory multiple />
 */
export async function parseUploadedFolderList(fileList: FileList): Promise<RobloxProject> {
  const filesArray: File[] = Array.from(fileList);
  const loadedFiles: ProjectFile[] = [];
  let rootFolderName = 'UploadedRobloxProject';

  for (const file of filesArray) {
    const relPath = file.webkitRelativePath || file.name;
    const parts = relPath.split('/');
    if (parts.length > 1) {
      rootFolderName = parts[0];
    }

    const lower = file.name.toLowerCase();
    if (
      lower.endsWith('.luau') || 
      lower.endsWith('.lua') || 
      lower.endsWith('.json') || 
      lower.endsWith('.md') ||
      lower.endsWith('.txt')
    ) {
      const text = await file.text();
      let scriptType: ProjectFile['scriptType'] = 'Server Script';
      let targetInstance = 'ServerScriptService';

      if (lower.includes('.client.') || lower.includes('client')) {
        scriptType = 'LocalScript';
        targetInstance = 'StarterPlayer.StarterPlayerScripts';
      } else if (lower.includes('module') || lower.endsWith('.luau') && !lower.includes('server')) {
        scriptType = 'ModuleScript';
        targetInstance = 'ReplicatedStorage.Common';
      }

      loadedFiles.push({
        id: `file-upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        path: relPath.replace(`${rootFolderName}/`, ''),
        code: text,
        scriptType,
        targetInstance,
        lastModified: file.lastModified || Date.now()
      });
    }
  }

  const project: RobloxProject = {
    id: `proj-${Date.now()}`,
    name: rootFolderName,
    folderName: rootFolderName,
    description: `Loaded Roblox Folder: ${rootFolderName}`,
    version: '1.0.0',
    files: loadedFiles.length > 0 ? loadedFiles : createDefaultProject().files,
    activeFileId: loadedFiles[0]?.id || 'file-main-server',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ideaNodes: createDefaultProject().ideaNodes
  };

  saveProjectToLocalStorage(project);
  return project;
}

// -------------------------------------------------------------
// CHAT SESSIONS & RANDOM NAME GENERATOR
// -------------------------------------------------------------

const RANDOM_CHAT_ADJECTIVES = [
  '⚡ Neon', '⚔️ Rogue', '🏰 Fortress', '🪙 Gold Tycoon', '🌪️ Vortex',
  '🛡️ Paladin', '🏃 Speedrun', '💎 Diamond', '📦 Loot Vault', '🎯 Sniper',
  '🚗 Turbo', '🌊 Tidal', '🌋 Magma', '🐉 Dragon', '🚀 Cosmic'
];

const RANDOM_CHAT_NOUNS = [
  'Admin Commands', 'Inventory Matrix', 'Combat Engine', 'Drop Tables',
  'Dungeon Spawner', 'VFX Burst Core', 'Pet Trade Hub', 'Wave Defense',
  'Leaderstats Vault', 'Vehicle Suspension', 'Parkour Stamina', 'Skill Tree'
];

export function generateRandomChatName(): string {
  const adj = RANDOM_CHAT_ADJECTIVES[Math.floor(Math.random() * RANDOM_CHAT_ADJECTIVES.length)];
  const noun = RANDOM_CHAT_NOUNS[Math.floor(Math.random() * RANDOM_CHAT_NOUNS.length)];
  return `${adj} ${noun}`;
}

export function loadChatSessionsFromStorage(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load chat sessions:', err);
  }

  // Default initial session
  const defaultSession: ChatSession = {
    id: `chat-${Date.now()}`,
    name: '⚡ Admin Commands & Mechanics',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        id: `msg-welcome`,
        role: 'assistant',
        content: `Hey! I'm your Squeeze AI Luau Co-pilot. I can read your entire Roblox project folder, inspect your scripts, generate new systems, brainstorm mechanics, or build anything you need. What are we making next?`,
        timestamp: Date.now(),
        suggestedPrompts: [
          "Make admin commands for my game",
          "Read my project and give me ideas",
          "Create a shift to sprint with stamina bar",
          "Make a treasure chest with rare drops"
        ]
      }
    ]
  };

  saveChatSessionsToStorage([defaultSession]);
  return [defaultSession];
}

export function saveChatSessionsToStorage(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to save chat sessions:', err);
  }
}

/**
 * Exports project as a portable JSON file.
 */
export function exportProjectJsonToDisk(project: RobloxProject): void {
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(project.name || 'RobloxProject').replace(/\s+/g, '_')}.squeeze.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Loads project from an uploaded JSON file.
 */
export async function loadProjectFromJsonFile(file: File): Promise<RobloxProject> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.files)) {
    throw new Error('Invalid Squeeze project JSON structure.');
  }
  return {
    ...parsed,
    id: parsed.id || `proj-${Date.now()}`,
    updatedAt: Date.now()
  };
}

