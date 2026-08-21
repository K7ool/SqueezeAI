import { RobloxSkill, searchRobloxSkills } from "./robloxSkillsDb.js";
import { ProjectFileInfo, analyzeProjectCodebase } from "./ai.js";

export type AgentOperationIntent =
  | 'INSTANCE_OPERATION'
  | 'SCRIPT_CREATE'
  | 'SCRIPT_UPDATE'
  | 'SCRIPT_DELETE'
  | 'SCRIPT_MOVE'
  | 'SCRIPT_RENAME'
  | 'FEATURE_BUILD'
  | 'DEBUG'
  | 'EXPLAIN'
  | 'PROJECT_QUERY'
  | 'STUDIO_SYNC'
  | 'LOCAL_FILE_OPERATION'
  | 'GREETING';

export type AgentIntent = AgentOperationIntent;

export interface StructuredInstanceIntent {
  operation: 'createInstance' | 'renameInstance' | 'moveInstance' | 'deleteInstance' | 'setProperty' | 'setAttribute';
  className?: string;       // e.g. "Part", "Folder", "RemoteEvent", "RemoteFunction", "Model", "ScreenGui", "Frame"
  name?: string;            // e.g. "1", "Admin", "FlyRemote"
  parentPath?: string;      // Normalized path e.g. "Workspace", "ReplicatedStorage", "ReplicatedStorage/Remotes"
  newName?: string;         // for renameInstance
  newParentPath?: string;   // for moveInstance
  propertyName?: string;    // for setProperty
  propertyValue?: any;      // for setProperty
  attributeName?: string;   // for setAttribute
  attributeValue?: any;     // for setAttribute
  properties?: Record<string, any>;
}

export interface StructuredScriptIntent {
  operation: 'createScript' | 'updateScript' | 'deleteScript' | 'moveScript' | 'renameScript';
  className?: 'Script' | 'LocalScript' | 'ModuleScript';
  name?: string;
  parentPath?: string;
  path?: string;
  newName?: string;
  newParentPath?: string;
  source?: string;
}

export interface DetectedIntentResult {
  intent: AgentOperationIntent;
  confidence: number;
  reason: string;
  hasCodeInPrompt: boolean;
  requiresCodeGeneration: boolean;
  mode: 'INSTANCE_MODE' | 'SCRIPT_MODE' | 'FEATURE_MODE' | 'DEBUG_MODE' | 'EXPLAIN_MODE' | 'PROJECT_MODE' | 'SYNC_MODE' | 'GREETING_MODE';
  structuredInstanceIntent?: StructuredInstanceIntent;
  structuredScriptIntent?: StructuredScriptIntent;
  targetPathNormalized?: string;
  skillsRequired: string[];
}

/**
 * Normalizes Roblox path strings (e.g. "work space" -> "Workspace", "ReplicatedStorage.Remotes" -> "ReplicatedStorage/Remotes")
 */
export function normalizeRobloxPath(rawPath?: string): string {
  if (!rawPath || !rawPath.trim()) return 'Workspace';
  let clean = rawPath.trim();
  clean = clean.replace(/^(?:in|inside|under|at|on)\s+/i, '');

  clean = clean.replace(/work\s*space/i, 'Workspace');
  clean = clean.replace(/replicated\s*storage/i, 'ReplicatedStorage');
  clean = clean.replace(/server\s*script\s*service/i, 'ServerScriptService');
  clean = clean.replace(/server\s*storage/i, 'ServerStorage');
  clean = clean.replace(/starter\s*gui/i, 'StarterGui');
  clean = clean.replace(/starter\s*player\s*scripts/i, 'StarterPlayer.StarterPlayerScripts');
  clean = clean.replace(/starter\s*player/i, 'StarterPlayer');

  if (clean.includes('.') && !clean.endsWith('.luau') && !clean.endsWith('.lua')) {
    clean = clean.replace(/\./g, '/');
  }

  const parts = clean.split('/');
  const root = parts[0].toLowerCase();
  if (root === 'workspace') parts[0] = 'Workspace';
  else if (root === 'replicatedstorage') parts[0] = 'ReplicatedStorage';
  else if (root === 'serverscriptservice') parts[0] = 'ServerScriptService';
  else if (root === 'serverstorage') parts[0] = 'ServerStorage';
  else if (root === 'startergui') parts[0] = 'StarterGui';
  else if (root === 'starterplayer') parts[0] = 'StarterPlayer';

  return parts.join('/');
}

/**
 * Robust Intent Classifier based on the Squeeze Engineer Directive
 * Distinguishes INSTANCE_OPERATION, SCRIPT_CREATE, FEATURE_BUILD, DEBUG, EXPLAIN, etc.
 */
export function classifyUserIntent(prompt: string, contextFiles?: ProjectFileInfo[]): DetectedIntentResult {
  const p = prompt.toLowerCase().trim();

  const hasCodeBlock = /```(?:lua|luau)?[\s\S]*?```/i.test(prompt);
  const hasCodeSyntax = /(?:local\s+[a-zA-Z0-9_]+\s*=|game:GetService|Players\.PlayerAdded|RunService\.Heartbeat|function\s*\()/i.test(prompt);
  const hasCodeInPrompt = hasCodeBlock || hasCodeSyntax;

  // 1. Greetings
  if (/^(hi|hey|hello|yo|sup|greetings|howdy|what's up|whats up|good morning|good evening|good afternoon|who are you|what can you do|help me|what are you)(\s|!|\.|\?|$)/i.test(p)) {
    return {
      intent: 'GREETING',
      confidence: 0.99,
      reason: 'User sent a standard greeting.',
      hasCodeInPrompt,
      requiresCodeGeneration: false,
      mode: 'GREETING_MODE',
      skillsRequired: ['Roblox Core']
    };
  }

  // 2. Studio Sync / Connection Status
  if (/^(sync to studio|push to studio|check studio|studio status|get explorer|connect studio|websync status)/i.test(p) || p === 'sync') {
    return {
      intent: 'STUDIO_SYNC',
      confidence: 0.98,
      reason: 'User requested Studio synchronization or status check.',
      hasCodeInPrompt: false,
      requiresCodeGeneration: false,
      mode: 'SYNC_MODE',
      skillsRequired: ['Roblox Core']
    };
  }

  // 3. Project-wide Read / Audit Requests
  if (/^(read my project|analyze my project|analyze codebase|audit my code|inspect project|review my code|what does my game do|summarize my game|project overview|game structure|audit project|what systems does my game have)/i.test(p) ||
      p.includes('read my project') || p.includes('analyze my project') || p.includes('audit my codebase')) {
    return {
      intent: 'PROJECT_QUERY',
      confidence: 0.95,
      reason: 'User requested a comprehensive codebase & architecture inspection.',
      hasCodeInPrompt,
      requiresCodeGeneration: false,
      mode: 'PROJECT_MODE',
      skillsRequired: ['Architecture', 'Data & Persistence', 'Security & Anti-Exploit', 'Optimization']
    };
  }

  // 4. EXPLAIN / WHAT DOES THIS CODE DO (CRITICAL PRIORITY OVER CODE PRESENCE)
  const isExplainQuery = /^(what does this (code|script|system|function) do|what is this (code|script|system)|explain this (code|script|function|system|part)|explain it|how does this (code|script|system|function|math) work|walk me through this|what is happening here|what is the purpose of this (code|script)|analyze this (code|script)|why does this work|can you explain this|can you break down this)/i.test(p) ||
    /what does this code do/i.test(p) ||
    /what does this script do/i.test(p) ||
    /what does this do/i.test(p) ||
    /explain this script/i.test(p) ||
    /explain this code/i.test(p) ||
    /explain how this works/i.test(p) ||
    /how does this script work/i.test(p);

  if (isExplainQuery) {
    return {
      intent: 'EXPLAIN',
      confidence: 0.99,
      reason: 'User explicitly requested an explanation of code/script functionality without generating replacement code.',
      hasCodeInPrompt,
      requiresCodeGeneration: false,
      mode: 'EXPLAIN_MODE',
      skillsRequired: ['Roblox Core', 'Architecture', 'Debugging']
    };
  }

  // 5. DEBUG / ERROR DIAGNOSIS
  const isDebugQuery = /^(there is a bug|there's a bug|why am i getting this error|why does this (error|fail|crash|break)|why is this error happening|what is causing this (error|bug|issue)|why isn't this working|why is this nil|debug this|diagnose this)/i.test(p) ||
    p.includes('there is a bug') || p.includes('there\'s a bug') || p.includes('why am i getting this error') || p.includes('attempt to index nil');

  if (isDebugQuery) {
    return {
      intent: 'DEBUG',
      confidence: 0.95,
      reason: 'User asked for diagnosis or fix of a bug or error.',
      hasCodeInPrompt,
      requiresCodeGeneration: true,
      mode: 'DEBUG_MODE',
      skillsRequired: ['Debugging', 'Roblox Core']
    };
  }

  // 6. INSTANCE OPERATIONS (Parts, Folders, RemoteEvents, RemoteFunctions, Models, UI, Properties)
  // Check for explicit script creation first
  const isScriptTypeRequest = /(?:script|localscript|modulescript)\s+(?:named|called|with name)?\s*([a-zA-Z0-9_\-\.]+)/i.test(p);
  
  const instanceClassNames = [
    'part', 'folder', 'remoteevent', 'remotefunction', 'model', 'screengui', 
    'frame', 'textlabel', 'textbutton', 'imagebutton', 'decal', 'surfacegui', 
    'attachment', 'sound', 'meshpart', 'intvalue', 'stringvalue', 'boolvalue', 'objectvalue'
  ];

  const containsInstanceClass = instanceClassNames.some(cls => p.includes(cls));
  const isModificationRequest = p.includes('anchor') || p.includes('unanchor') || p.includes('color') || p.includes('size') || p.includes('bigger') || p.includes('smaller') || p.includes('resize') || p.includes('delete') || p.includes('destroy') || p.includes('remove') || p.includes('rename') || p.includes('move');
  const isInstanceOperation = (!isScriptTypeRequest && (containsInstanceClass || isModificationRequest));

  if (isInstanceOperation) {
    // 6a. Delete / Remove Instance
    const deleteMatch = p.match(/(?:delete|remove|destroy)\s+(?:the|a|an)?\s*([a-zA-Z0-9_]+)?\s*(?:named|called)?\s*([a-zA-Z0-9_\-\.\/]+)/i) || p.match(/(?:delete|remove|destroy)\s+(it)/i);
    if (deleteMatch) {
      const targetName = deleteMatch[2] || deleteMatch[1];
      const targetPath = normalizeRobloxPath(targetName);
      return {
        intent: 'INSTANCE_OPERATION',
        confidence: 0.98,
        reason: `User requested deletion of Instance '${targetPath}'`,
        hasCodeInPrompt: false,
        requiresCodeGeneration: false,
        mode: 'INSTANCE_MODE',
        targetPathNormalized: targetPath,
        structuredInstanceIntent: {
          operation: 'deleteInstance',
          name: targetName,
          parentPath: targetPath
        },
        skillsRequired: ['Roblox Core']
      };
    }

    // 6b. Rename Instance
    const renameMatch = p.match(/(?:rename)\s+(?:the|a|an)?\s*([a-zA-Z0-9_]+)?\s*([a-zA-Z0-9_\-\.\/]+)\s+to\s+([a-zA-Z0-9_\-\.]+)/i);
    if (renameMatch) {
      const oldName = renameMatch[2];
      const newName = renameMatch[3];
      return {
        intent: 'INSTANCE_OPERATION',
        confidence: 0.98,
        reason: `User requested rename of Instance '${oldName}' to '${newName}'`,
        hasCodeInPrompt: false,
        requiresCodeGeneration: false,
        mode: 'INSTANCE_MODE',
        structuredInstanceIntent: {
          operation: 'renameInstance',
          name: oldName,
          newName
        },
        skillsRequired: ['Roblox Core']
      };
    }

    // 6c. Move Instance
    const moveMatch = p.match(/(?:move)\s+(?:the|a|an)?\s*([a-zA-Z0-9_]+)?\s*([a-zA-Z0-9_\-\.]+)\s+to\s+([a-zA-Z0-9_\-\.\s\/]+)/i);
    if (moveMatch) {
      const targetName = moveMatch[2];
      const newParentPath = normalizeRobloxPath(moveMatch[3]);
      return {
        intent: 'INSTANCE_OPERATION',
        confidence: 0.98,
        reason: `User requested moving Instance '${targetName}' to '${newParentPath}'`,
        hasCodeInPrompt: false,
        requiresCodeGeneration: false,
        mode: 'INSTANCE_MODE',
        structuredInstanceIntent: {
          operation: 'moveInstance',
          name: targetName,
          newParentPath
        },
        skillsRequired: ['Roblox Core']
      };
    }

    // 6d. Set Property (Anchor, Color, Size, etc.) - CHECK THIS BEFORE CREATE
    let isPropertyChange = false;
    let targetName = 'it';
    let propName = '';
    let propValue: any = null;

    // (i) Anchor / Unanchor patterns
    if (p.includes('anchor') || p.includes('unanchor')) {
      isPropertyChange = true;
      propName = 'Anchored';
      propValue = p.includes('anchored') || (p.includes('anchor') && !p.includes('unanchor'));
      
      const anchorMatch = p.match(/(?:anchor|unanchor)\s+(?:the|a|an)?\s*(?:part|folder|instance|model)?\s*([a-zA-Z0-9_\-\.]+)/i);
      if (anchorMatch) {
        targetName = anchorMatch[1];
      } else {
        const anchorMatch2 = p.match(/([a-zA-Z0-9_\-\.]+)\s+should\s+be\s+(?:anchored|unanchored)/i);
        if (anchorMatch2 && anchorMatch2[1] !== 'it') {
          targetName = anchorMatch2[1];
        }
      }
    }
    // (ii) Color patterns
    else if (p.includes('color') || /(?:red|blue|green|yellow|black|white|orange|purple|pink|brown|grey|gray)/i.test(p)) {
      isPropertyChange = true;
      propName = 'Color';
      
      const colorMatch = p.match(/(red|blue|green|yellow|black|white|orange|purple|pink|brown|grey|gray)/i);
      propValue = colorMatch ? colorMatch[1] : 'Red';
      propValue = propValue.charAt(0).toUpperCase() + propValue.slice(1);

      // Extract target, e.g., "change its color to red", "make part 1 red"
      const targetMatch = p.match(/(?:make|color|change)\s+(?:the|its|a|an)?\s*(?:part|folder|instance|model)?\s*([a-zA-Z0-9_\-\.]+)?\s*(?:to\s+)?(?:red|blue|green|yellow|black|white|orange|purple|pink|brown|grey|gray)/i);
      if (targetMatch && targetMatch[1]) {
        targetName = targetMatch[1];
      }
    }
    // (iii) Size / Scale / Resize patterns
    else if (p.includes('size') || p.includes('scale') || p.includes('resize') || p.includes('bigger') || p.includes('smaller') || p.includes('wider') || p.includes('taller')) {
      isPropertyChange = true;
      propName = 'Size';
      
      const modifierMatch = p.match(/(x\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*x|bigger|smaller|double|half|twice|\d+(?:\.\d+)?)/i);
      propValue = modifierMatch ? modifierMatch[1].replace(/\s+/g, '') : 'bigger';

      const targetMatch = p.match(/(?:resize|make|scale|set)\s+(?:the|its|a|an)?\s*(?:part|folder|instance|model)?\s*([a-zA-Z0-9_\-\.]+)/i);
      if (targetMatch && targetMatch[1]) {
        targetName = targetMatch[1];
      }
    }

    if (isPropertyChange) {
      return {
        intent: 'INSTANCE_OPERATION',
        confidence: 0.98,
        reason: `User requested property change (${propName} = ${propValue}) on Instance '${targetName}'`,
        hasCodeInPrompt: false,
        requiresCodeGeneration: false,
        mode: 'INSTANCE_MODE',
        structuredInstanceIntent: {
          operation: 'setProperty',
          name: targetName,
          propertyName: propName,
          propertyValue: propValue,
          parentPath: 'Workspace'
        },
        skillsRequired: ['Roblox Core']
      };
    }

    // 6e. Create Instance (ONLY IF NOT A PROPERTY MODIFICATION)
    const createMatch = prompt.match(/(?:create|make|add|spawn|generate|build)\s+(?:a|an)?\s*([a-zA-Z0-9_]+)\s+(?:named|called|with name)?\s*([a-zA-Z0-9_\-\.]+)(?:\s+(?:in|inside|under|at|on)?\s*([a-zA-Z0-9_\-\.\s\/]+))?/i);
    if (createMatch) {
      const rawClass = createMatch[1];
      const name = createMatch[2];
      const rawParent = createMatch[3] || 'Workspace';

      let className = 'Part';
      const lowerClass = rawClass.toLowerCase();
      if (lowerClass.includes('folder')) className = 'Folder';
      else if (lowerClass.includes('remoteevent')) className = 'RemoteEvent';
      else if (lowerClass.includes('remotefunction')) className = 'RemoteFunction';
      else if (lowerClass.includes('model')) className = 'Model';
      else if (lowerClass.includes('screengui')) className = 'ScreenGui';
      else if (lowerClass.includes('frame')) className = 'Frame';
      else if (lowerClass.includes('part')) className = 'Part';
      else if (lowerClass.includes('attachment')) className = 'Attachment';
      else if (lowerClass.includes('sound')) className = 'Sound';

      const parentPath = normalizeRobloxPath(rawParent);

      return {
        intent: 'INSTANCE_OPERATION',
        confidence: 0.98,
        reason: `User requested direct Instance creation: ${className} named '${name}' in '${parentPath}'`,
        hasCodeInPrompt: false,
        requiresCodeGeneration: false,
        mode: 'INSTANCE_MODE',
        targetPathNormalized: `${parentPath}/${name}`,
        structuredInstanceIntent: {
          operation: 'createInstance',
          className,
          name,
          parentPath,
          properties: className === 'Part' ? { Anchored: true } : {}
        },
        skillsRequired: ['Roblox Core']
      };
    }
  }

  // 7. SCRIPT CREATE (Explicit Script, LocalScript, ModuleScript creation)
  const scriptMatch = p.match(/(?:create|make|add|write)\s+(?:a|an)?\s*(script|localscript|modulescript)\s+(?:named|called|with name)?\s*([a-zA-Z0-9_\-\.]+)(?:\s+(?:in|inside|under|at|on)?\s*([a-zA-Z0-9_\-\.\s\/]+))?/i);
  if (scriptMatch) {
    const rawType = scriptMatch[1].toLowerCase();
    const name = scriptMatch[2];
    const rawParent = scriptMatch[3] || (rawType === 'localscript' ? 'StarterPlayer.StarterPlayerScripts' : rawType === 'modulescript' ? 'ReplicatedStorage' : 'ServerScriptService');

    let className: 'Script' | 'LocalScript' | 'ModuleScript' = 'Script';
    if (rawType.includes('local')) className = 'LocalScript';
    else if (rawType.includes('module')) className = 'ModuleScript';

    const parentPath = normalizeRobloxPath(rawParent);

    return {
      intent: 'SCRIPT_CREATE',
      confidence: 0.96,
      reason: `User requested explicit script creation: ${className} named '${name}' in '${parentPath}'`,
      hasCodeInPrompt,
      requiresCodeGeneration: true,
      mode: 'SCRIPT_MODE',
      targetPathNormalized: `${parentPath}/${name}`,
      structuredScriptIntent: {
        operation: 'createScript',
        className,
        name,
        parentPath
      },
      skillsRequired: ['Roblox Core', 'Architecture']
    };
  }

  // 8. FEATURE BUILD (Multi-file / Multi-component gameplay system request)
  const isBuildFeature = /(^(make|create|write|build|code|implement|generate|develop|add a system|add a mechanic|set up)\b)|(build (a|an|the)|create (a|an|the)|make (a|an|the))/i.test(p);
  if (isBuildFeature) {
    return {
      intent: 'FEATURE_BUILD',
      confidence: 0.95,
      reason: 'User explicitly requested building a complete game feature or mechanics system.',
      hasCodeInPrompt,
      requiresCodeGeneration: true,
      mode: 'FEATURE_MODE',
      skillsRequired: ['Architecture', 'Gameplay', 'Data & Persistence', 'Security & Anti-Exploit']
    };
  }

  // 9. General Question or Explanation
  const isQuestion = /^(what is|what are|how do|how does|why is|why does|explain|can you explain|tell me about|difference between|when should i use|is it better to)\b/i.test(p);
  if (isQuestion) {
    return {
      intent: 'EXPLAIN',
      confidence: 0.88,
      reason: 'Conceptual or educational question regarding Roblox engine or Luau API.',
      hasCodeInPrompt,
      requiresCodeGeneration: false,
      mode: 'EXPLAIN_MODE',
      skillsRequired: ['Roblox Core', 'Architecture']
    };
  }

  // Default: Safe EXPLAIN mode if ambiguous
  return {
    intent: 'EXPLAIN',
    confidence: 0.7,
    reason: 'General inquiry; maintaining safe explanation mode.',
    hasCodeInPrompt,
    requiresCodeGeneration: false,
    mode: 'EXPLAIN_MODE',
    skillsRequired: ['Roblox Core']
  };
}

/**
 * Formats a pure, code-grounded explanation according to the required 7-section structure.
 */
export function formatCodeExplanationPrompt(codeToExplain: string, query: string, projectContext?: string): string {
  return `YOU ARE IN STRICT EXPLAIN MODE.
User Query: "${query}"

THE CODE TO ANALYZE (DO NOT REWRITE, DO NOT GENERATE REPLACEMENTS, DO NOT CREATE NEW SYSTEMS):
\`\`\`luau
${codeToExplain}
\`\`\`

${projectContext ? `PROJECT CONTEXT (Reference only if the code directly accesses it):\n${projectContext}\n` : ''}

MANDATORY RESPONSE FORMAT:
You MUST format your explanation strictly using these exact Markdown sections:

## What this script does
[Provide a clear, 1-2 sentence direct explanation of what the script does.]

## Roblox Services used
[List ONLY the services actually called in the code, e.g. Lighting, RunService, Players. If none, write "None".]

## Main components
[Explain the variables, objects, Folders, Attributes, or RemoteEvents the code actually relies on.]

## Configuration
[Explain any constants (e.g. DAY_LENGTH_MINUTES, START_TIME) and their exact mathematical impact.]

## How the system works
[Step-by-step sequential breakdown of the execution flow from initialization to loops or events.]

## Important logic
[Explain any calculations, modulo arithmetic (% 24), deltaTime step calculations, conditions, and client/server replication behavior.]

## Potential issues
[Point out any real bugs, lack of debounce, unvalidated RemoteEvents, or nil indexing risks present IN THIS SCRIPT. Do NOT fix them automatically. If no issues exist, state "None detected".]

## Summary
[A concise, 1-sentence final summary of the system.]

STRICT NEGATIVE CONSTRAINTS:
- DO NOT output code blocks with a replacement implementation.
- DO NOT invent ServerScriptService.GameSystem or session managers.
- DO NOT say "Here is a production-grade implementation".
- DO NOT create or modify files.
- ANALYZE ONLY THE GIVEN CODE.`;
}
