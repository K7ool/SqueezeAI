import { db, UserMemoryRecord, ProjectMemoryRecord, ConversationMemoryRecord, ExecutionMemoryRecord } from './db.js';

export interface MemoryContext {
  userPreferences: Record<string, any>;
  projectFacts: Partial<ProjectMemoryRecord>;
  conversationContext: Partial<ConversationMemoryRecord>;
  recentErrors: Array<{ error: string; file?: string; resolution?: string; timestamp?: string }>;
  recentExecutions: Array<{ request: string; intent: string; filesChanged?: string[]; timestamp: string }>;
  learnedConventions: Record<string, string>;
  formattedContextPrompt: string;
}

/**
 * Intelligent Agent Context Builder
 * Assembles minimal, targeted memory context for the LLM prompt.
 */
export function buildAgentContext(
  userId: string,
  projectId: string,
  conversationId: string,
  currentRequest: string,
  projectFiles?: Array<{ path: string; source?: string }>
): MemoryContext {
  // 1. Fetch User Memories
  const userMems = db.getUserMemories(userId);
  const userPreferences: Record<string, any> = {};
  userMems.forEach(m => {
    userPreferences[m.key] = { value: m.value, confidence: m.confidence, source: m.source };
  });

  // 2. Fetch Project Memory
  let prjMem = db.getProjectMemory(userId, projectId);
  if (!prjMem && projectFiles && projectFiles.length > 0) {
    // Auto-initialize Project Memory from file scan if not existing
    prjMem = autoUpdateProjectMemoryFromFiles(userId, projectId, projectFiles);
  }

  // 3. Fetch Conversation Memory
  const convMem = db.getConversationMemory(conversationId) || {
    id: '',
    conversationId,
    userId,
    projectId,
    importantDecisions: [],
    relevantFiles: [],
    recentOperations: [],
    openIssues: [],
    updatedAt: new Date().toISOString()
  };

  // 4. Fetch Recent Errors and Executions
  const recentErrors = db.getRecentErrors(userId, projectId, 5);
  const recentExecs = db.getRecentExecutions(userId, projectId, 5);

  // 5. Build Formatted Context Prompt String
  const promptLines: string[] = [];

  promptLines.push("=== AGENT PERSISTENT MEMORY CONTEXT ===");

  // User Preferences
  if (Object.keys(userPreferences).length > 0) {
    promptLines.push("👤 User Preferences & Rules:");
    for (const [key, val] of Object.entries(userPreferences)) {
      promptLines.push(`  • ${key}: ${JSON.stringify(val.value)} (Confidence: ${val.confidence})`);
    }
  }

  // Project Architecture & Facts
  if (prjMem) {
    promptLines.push(`📦 Project Knowledge [${prjMem.projectName || projectId}]:`);
    if (prjMem.gameType) promptLines.push(`  • Game Type: ${prjMem.gameType}`);
    if (prjMem.architecture) promptLines.push(`  • Architecture: ${prjMem.architecture}`);
    if (prjMem.dataSystem) promptLines.push(`  • Data System: ${prjMem.dataSystem}`);
    if (prjMem.commandSystem && prjMem.commandSystem !== 'None') promptLines.push(`  • Command System: ${prjMem.commandSystem}`);
    if (prjMem.majorSystems && prjMem.majorSystems.length > 0) promptLines.push(`  • Active Systems: ${prjMem.majorSystems.join(', ')}`);
    if (prjMem.learnedConventions && Object.keys(prjMem.learnedConventions).length > 0) {
      promptLines.push("  • Learned Conventions:");
      for (const [k, v] of Object.entries(prjMem.learnedConventions)) {
        promptLines.push(`    - ${k}: ${v}`);
      }
    }
  }

  // Active Conversation Intent
  if (convMem.currentFeature) {
    promptLines.push(`🎯 Active Conversation Focus:`);
    promptLines.push(`  • Current Feature: ${convMem.currentFeature}`);
    if (convMem.userIntent) promptLines.push(`  • Intent: ${convMem.userIntent}`);
    if (convMem.relevantFiles && convMem.relevantFiles.length > 0) {
      promptLines.push(`  • Relevant Files: ${convMem.relevantFiles.join(', ')}`);
    }
  }

  // Recent Execution History / Operations
  if (recentExecs.length > 0) {
    promptLines.push(`🕒 Recent Operations in this Project:`);
    recentExecs.slice(0, 3).forEach(e => {
      const filesStr = e.filesChanged && e.filesChanged.length > 0 ? ` (${e.filesChanged.slice(0, 3).join(', ')})` : '';
      promptLines.push(`  • [${e.intent}] "${e.request.slice(0, 50)}"${filesStr}`);
    });
  }

  // Recent Errors & Resolutions
  if (recentErrors.length > 0) {
    promptLines.push(`⚠️ Recent Recorded Issues & Resolutions:`);
    recentErrors.slice(0, 3).forEach(err => {
      const statusStr = err.resolved ? `✓ Resolved (${err.resolution || 'Fixed'})` : '❌ Unresolved';
      promptLines.push(`  • Error: "${err.error}" in ${err.file || 'unknown'} -> ${statusStr}`);
    });
  }

  promptLines.push("=======================================\n");

  return {
    userPreferences,
    projectFacts: prjMem || {},
    conversationContext: convMem,
    recentErrors,
    recentExecutions: recentExecs.map(e => ({ request: e.request, intent: e.intent, filesChanged: e.filesChanged, timestamp: e.timestamp })),
    learnedConventions: prjMem?.learnedConventions || {},
    formattedContextPrompt: promptLines.join('\n')
  };
}

/**
 * Automatically extracts long-term semantic facts and preferences from incoming text
 */
export function extractAndStoreMemories(
  userId: string,
  projectId: string,
  conversationId: string,
  userText: string,
  assistantResponse?: string
): void {
  const text = userText.trim();
  const textLower = text.toLowerCase();

  // 1. Explicit User Preferences Extraction
  if (/prefer\s+(strict\s+luau|strict\s+typing)/i.test(textLower) || /always\s+use\s+strict\s+luau/i.test(textLower)) {
    db.saveUserMemory({
      userId,
      type: 'luau_style',
      key: 'luau.typing',
      value: 'strict',
      confidence: 'high',
      source: 'explicit_user_statement'
    });
    db.logMemoryEvent({ userId, projectId, memoryType: 'user', action: 'created', key: 'luau.typing', details: 'User set strict Luau typing preference' });
  }

  if (/prefer\s+(camelcase|pascalcase)/i.test(textLower)) {
    const style = textLower.includes('camelcase') ? 'camelCase' : 'PascalCase';
    db.saveUserMemory({
      userId,
      type: 'coding_style',
      key: 'naming.style',
      value: style,
      confidence: 'high',
      source: 'explicit_user_statement'
    });
  }

  // 2. Project Architecture & Fact Extraction
  if (textLower.includes('profileservice') || textLower.includes('uses profileservice')) {
    updateProjectFact(userId, projectId, 'dataSystem', 'ProfileService');
  } else if (textLower.includes('datastoreservice') || textLower.includes('uses datastore')) {
    updateProjectFact(userId, projectId, 'dataSystem', 'DataStoreService');
  }

  if (textLower.includes('fusion') || textLower.includes('roact')) {
    const uiFramework = textLower.includes('fusion') ? 'Fusion' : 'Roact';
    updateProjectFact(userId, projectId, 'UIFramework', uiFramework);
  }

  if (/don't create new command systems|use my existing commandservice|use commandservice/i.test(textLower)) {
    updateProjectFact(userId, projectId, 'commandSystem', 'CommandService');
    updateProjectConvention(userId, projectId, 'command_architecture', 'reuse_existing_command_service');
  }

  // 3. Project Structure / Folder Convention Extraction
  if (textLower.includes('services live in')) {
    const match = text.match(/services live in\s+([A-Za-z0-9_.]+)/i);
    if (match && match[1]) {
      updateProjectConvention(userId, projectId, 'service_location', match[1]);
    }
  }

  if (textLower.includes('controllers live in')) {
    const match = text.match(/controllers live in\s+([A-Za-z0-9_.]+)/i);
    if (match && match[1]) {
      updateProjectConvention(userId, projectId, 'controller_location', match[1]);
    }
  }

  if (textLower.includes('remotes live in')) {
    const match = text.match(/remotes live in\s+([A-Za-z0-9_.]+)/i);
    if (match && match[1]) {
      updateProjectConvention(userId, projectId, 'remote_location', match[1]);
    }
  }

  // 4. Conversation Focus Extraction
  let detectedFeature: string | undefined;
  if (/(flying bird|bird system|flying system)/i.test(textLower)) {
    detectedFeature = 'Flying Bird System';
  } else if (/(leaderboard|leaderstats|economy)/i.test(textLower)) {
    detectedFeature = 'Leaderboard & Economy';
  } else if (/(admin|commands|permission)/i.test(textLower)) {
    detectedFeature = 'Admin & Commands';
  } else if (/(inventory|trade|booth)/i.test(textLower)) {
    detectedFeature = 'Inventory & Trading';
  }

  if (detectedFeature) {
    const convMem = db.getConversationMemory(conversationId) || {
      id: '',
      conversationId,
      userId,
      projectId,
      importantDecisions: [],
      relevantFiles: [],
      recentOperations: [],
      openIssues: [],
      updatedAt: new Date().toISOString()
    };

    db.saveConversationMemory({
      conversationId,
      userId,
      projectId,
      currentFeature: detectedFeature,
      userIntent: text.slice(0, 100),
      importantDecisions: [...(convMem.importantDecisions || []), text.slice(0, 120)].slice(-10)
    });

    // Also update Project Memory majorSystems list
    const prjMem = db.getProjectMemory(userId, projectId);
    const existingSystems = prjMem?.majorSystems || [];
    if (!existingSystems.includes(detectedFeature)) {
      db.saveProjectMemory({
        userId,
        projectId,
        majorSystems: [...existingSystems, detectedFeature]
      });
    }
  }
}

function updateProjectFact(userId: string, projectId: string, field: string, value: string): void {
  const prjMem = db.getProjectMemory(userId, projectId) || {
    userId,
    projectId,
    id: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };

  db.saveProjectMemory({
    ...prjMem,
    userId,
    projectId,
    [field]: value
  });

  db.logMemoryEvent({
    userId,
    projectId,
    memoryType: 'project',
    action: 'updated',
    key: field,
    details: `Updated ${field} to ${value}`
  });
}

function updateProjectConvention(userId: string, projectId: string, conventionKey: string, value: string): void {
  const prjMem = db.getProjectMemory(userId, projectId) || {
    userId,
    projectId,
    id: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };

  const conventions = prjMem.learnedConventions || {};
  conventions[conventionKey] = value;

  db.saveProjectMemory({
    ...prjMem,
    userId,
    projectId,
    learnedConventions: conventions
  });

  db.logMemoryEvent({
    userId,
    projectId,
    memoryType: 'project',
    action: 'updated',
    key: `convention.${conventionKey}`,
    details: `Learned convention: ${conventionKey} -> ${value}`
  });
}

/**
 * Scans project file tree to initialize / update Project Memory facts automatically
 */
export function autoUpdateProjectMemoryFromFiles(
  userId: string,
  projectId: string,
  files: Array<{ path: string; source?: string }>
): ProjectMemoryRecord {
  const majorSystems = new Set<string>();
  const services = new Set<string>();
  let dataSystem = 'DataStoreService';
  let commandSystem = 'None';
  let framework = 'Standard Luau';
  const importantFiles: string[] = [];

  for (const f of files) {
    const pathLower = f.path.toLowerCase();
    const source = f.source || '';
    const sourceLower = source.toLowerCase();

    if (pathLower.includes('bird') || sourceLower.includes('flying bird')) majorSystems.add('Flying Bird System');
    if (pathLower.includes('leaderstat') || pathLower.includes('coins')) majorSystems.add('Economy & Stats');
    if (pathLower.includes('admin') || pathLower.includes('command')) majorSystems.add('Admin Commands');
    if (pathLower.includes('inventory')) majorSystems.add('Inventory');

    if (sourceLower.includes('profileservice')) dataSystem = 'ProfileService';
    if (sourceLower.includes('knit')) framework = 'Knit Framework';
    if (sourceLower.includes('fusion')) framework = 'Fusion UI';
    if (sourceLower.includes('commandservice')) commandSystem = 'CommandService';

    if (f.path.endsWith('.server.luau') || f.path.endsWith('.server.lua') || f.path.includes('Service')) {
      services.add(f.path.split('/').pop() || f.path);
    }

    if (importantFiles.length < 15) {
      importantFiles.push(f.path);
    }
  }

  const updated = db.saveProjectMemory({
    userId,
    projectId,
    majorSystems: Array.from(majorSystems),
    services: Array.from(services),
    dataSystem,
    commandSystem,
    frameworks: [framework],
    importantFiles
  });

  db.logMemoryEvent({
    userId,
    projectId,
    memoryType: 'project',
    action: 'verified',
    details: `Project memory auto-synced from ${files.length} project files`
  });

  return updated;
}

/**
 * Memory Search Engine across all tiers
 */
export function searchMemories(userId: string, query: string, projectId?: string): {
  userPreferences: UserMemoryRecord[];
  projectFacts: Partial<ProjectMemoryRecord> | null;
  conversationMemories: ConversationMemoryRecord[];
  executionHistory: ExecutionMemoryRecord[];
} {
  const q = query.toLowerCase().trim();

  // Search User Memories
  const userMems = db.getUserMemories(userId).filter(m => 
    m.key.toLowerCase().includes(q) || JSON.stringify(m.value).toLowerCase().includes(q)
  );

  // Search Project Memory
  const prjMem = projectId ? db.getProjectMemory(userId, projectId) : null;

  // Search Executions
  const execs = db.getRecentExecutions(userId, projectId, 20).filter(e => 
    e.request.toLowerCase().includes(q) || e.intent.toLowerCase().includes(q) || (e.filesChanged && e.filesChanged.some(f => f.toLowerCase().includes(q)))
  );

  return {
    userPreferences: userMems,
    projectFacts: prjMem || null,
    conversationMemories: [],
    executionHistory: execs
  };
}

export interface RobloxObjectRef {
  path: string;
  className: string;
  name: string;
  createdInTask?: string;
  lastVerified?: boolean;
}

/**
 * Gets recent objects state for a conversation
 */
export function getRecentObjects(conversationId: string) {
  const convMem = db.getConversationMemory(conversationId);
  return convMem?.recentObjects || {
    lastCreated: undefined,
    objects: {},
    history: []
  };
}

/**
 * Saves recent objects state for a conversation
 */
export function saveRecentObjects(
  conversationId: string,
  userId: string,
  projectId: string,
  recentObjects: any
): void {
  const convMem = db.getConversationMemory(conversationId) || {
    id: '',
    conversationId,
    userId,
    projectId,
    updatedAt: new Date().toISOString()
  };

  db.saveConversationMemory({
    ...convMem,
    conversationId,
    userId,
    projectId,
    recentObjects
  });
}

/**
 * Records a created or found instance to conversation memory
 */
export function recordInstanceCreatedOrFound(
  conversationId: string,
  userId: string,
  projectId: string,
  path: string,
  className: string,
  name: string,
  taskId?: string
): void {
  const recent = getRecentObjects(conversationId);
  
  const objRef: RobloxObjectRef = {
    path,
    className,
    name,
    createdInTask: taskId || 'task_' + Date.now(),
    lastVerified: true
  };

  recent.lastCreated = objRef;
  
  // Initialize map
  recent.objects = recent.objects || {};
  recent.objects[name.toLowerCase()] = path;
  recent.objects[`${className.toLowerCase()} ${name.toLowerCase()}`] = path;
  recent.objects[path.toLowerCase()] = path;
  
  // Generic "it" or "the part" keywords map to the last created path
  recent.objects['it'] = path;
  recent.objects['the part'] = path;
  recent.objects['this part'] = path;
  recent.objects['that part'] = path;
  recent.objects[`the ${className.toLowerCase()}`] = path;

  // Add to history
  recent.history = recent.history || [];
  recent.history.push({
    action: 'record',
    path,
    timestamp: new Date().toISOString()
  });

  saveRecentObjects(conversationId, userId, projectId, recent);
}

/**
 * Resolves natural language queries to an existing path or the last created object
 */
export function resolveInstancePath(
  conversationId: string,
  projectId: string,
  targetQuery: string,
  explorerTree?: any[]
): { path: string; className?: string; name?: string } | null {
  const query = targetQuery.toLowerCase().trim();
  const recent = getRecentObjects(conversationId);

  // Helper to recursively find in Explorer Tree
  function findInTree(items: any[], searchPath: string): any | null {
    for (const item of items) {
      if (item.path.toLowerCase() === searchPath.toLowerCase()) {
        return item;
      }
      if (item.children) {
        const found = findInTree(item.children, searchPath);
        if (found) return found;
      }
    }
    return null;
  }

  // 1. Direct path lookup in Explorer Tree (if available)
  if (explorerTree && explorerTree.length > 0) {
    const normalized = query.startsWith('workspace/') ? query : `workspace/${query}`;
    const foundInTree = findInTree(explorerTree, normalized) || findInTree(explorerTree, query);
    if (foundInTree) {
      return {
        path: foundInTree.path,
        className: foundInTree.className,
        name: foundInTree.name
      };
    }
  }

  // 2. Exact match in recent objects keys
  if (recent.objects && recent.objects[query]) {
    const matchedPath = recent.objects[query];
    if (recent.lastCreated && recent.lastCreated.path === matchedPath) {
      return recent.lastCreated;
    }
    return {
      path: matchedPath,
      name: matchedPath.split('/').pop() || ''
    };
  }

  // 3. Last created fallback if they say "it", "the part", "the folder", "the script"
  if (['it', 'the part', 'this part', 'that part', 'the thing', 'the object', 'the instance'].includes(query) && recent.lastCreated) {
    return recent.lastCreated;
  }

  // 4. Pattern matches for "part 1" or "folder a"
  if (recent.objects) {
    for (const [key, val] of Object.entries(recent.objects)) {
      if (key.includes(query) || query.includes(key)) {
        return {
          path: val,
          name: val.split('/').pop() || ''
        };
      }
    }
  }

  // 5. Fallback to lastCreated if any modification is requested but target is vague
  if (recent.lastCreated) {
    return recent.lastCreated;
  }

  return null;
}
