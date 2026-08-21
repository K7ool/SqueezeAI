import { RobloxSkill, searchRobloxSkills } from "./robloxSkillsDb.js";
import { ProjectFileInfo, analyzeProjectCodebase } from "./ai.js";

export type AgentIntent = 
  | 'EXPLAIN'          // Explaining a snippet or script without generating replacement code
  | 'ANALYZE'          // Deep analysis of a script/system
  | 'REVIEW'           // Code review (security, memory, networking, quality)
  | 'DEBUG'            // Diagnose root cause of error/bug
  | 'FIX'              // Apply targeted bug fix to specific code
  | 'MODIFY'           // Modify/tweak existing implementation
  | 'BUILD'            // Build a requested system/feature from scratch
  | 'CREATE'           // Create a new file/module
  | 'REFACTOR'         // Refactor existing code structure
  | 'OPTIMIZE'         // Performance/memory optimization
  | 'READ_PROJECT'     // Comprehensive project audit
  | 'SEARCH_PROJECT'   // Locate where specific logic exists in project
  | 'GREETING';        // Friendly developer greeting

export interface DetectedIntentResult {
  intent: AgentIntent;
  confidence: number;
  reason: string;
  hasCodeInPrompt: boolean;
  requiresCodeGeneration: boolean;
  mode: 'EXPLAIN_MODE' | 'ANALYSIS_MODE' | 'REVIEW_MODE' | 'DEBUG_MODE' | 'BUILD_MODE' | 'PROJECT_MODE' | 'GREETING_MODE';
  skillsRequired: string[];
}

/**
 * Robust Intent Classifier based on the Squeeze Engineer Directive
 * Guarantees that "What does this code do?" NEVER triggers code generation or new system creation.
 */
export function classifyUserIntent(prompt: string, contextFiles?: ProjectFileInfo[]): DetectedIntentResult {
  const p = prompt.toLowerCase().trim();

  // 1. Detect if the prompt contains a raw code block or Lua/Luau script keywords
  const hasCodeBlock = /```(?:lua|luau)?[\s\S]*?```/i.test(prompt);
  const hasCodeSyntax = /(?:local\s+[a-zA-Z0-9_]+\s*=|game:GetService|Players\.PlayerAdded|RunService\.Heartbeat|function\s*\()/i.test(prompt);
  const hasCodeInPrompt = hasCodeBlock || hasCodeSyntax;

  // 2. Greetings
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

  // 3. Project-wide Read / Audit Requests
  if (/^(read my project|analyze my project|analyze codebase|audit my code|inspect project|review my code|what does my game do|summarize my game|project overview|game structure|audit project|what systems does my game have)/i.test(p) ||
      p.includes('read my project') || p.includes('analyze my project') || p.includes('audit my codebase')) {
    return {
      intent: 'READ_PROJECT',
      confidence: 0.95,
      reason: 'User requested a comprehensive codebase & architecture inspection.',
      hasCodeInPrompt,
      requiresCodeGeneration: false,
      mode: 'PROJECT_MODE',
      skillsRequired: ['Architecture', 'Data & Persistence', 'Security & Anti-Exploit', 'Optimization']
    };
  }

  // 4. Search within Project
  if (/^(find where|where is|locate|which file handles|search for|find the script that)/i.test(p)) {
    return {
      intent: 'SEARCH_PROJECT',
      confidence: 0.9,
      reason: 'User is searching for specific logic or files in the project.',
      hasCodeInPrompt,
      requiresCodeGeneration: false,
      mode: 'ANALYSIS_MODE',
      skillsRequired: ['Architecture', 'Roblox Core']
    };
  }

  // 5. EXPLAIN / WHAT DOES THIS CODE DO (CRITICAL PRIORITY OVER CODE PRESENCE)
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

  // 6. REVIEW (Code Quality / Production Readiness)
  if (/^(is this (code|script|system) (good|production ready|safe|performant|clean|optimal)|review this (code|script|system)|rate this (code|script)|audit this (code|script)|check this (code|script) for issues)/i.test(p) ||
      p.includes('is this code good') || p.includes('is this production ready') || p.includes('review this script')) {
    return {
      intent: 'REVIEW',
      confidence: 0.95,
      reason: 'User requested a qualitative architecture and security code review.',
      hasCodeInPrompt,
      requiresCodeGeneration: false,
      mode: 'REVIEW_MODE',
      skillsRequired: ['Security & Anti-Exploit', 'Optimization', 'Architecture', 'Roblox Core']
    };
  }

  // 7. DEBUG / ERROR DIAGNOSIS
  const isDebugQuery = /^(why am i getting this error|why does this (error|fail|crash|break)|why is this error happening|what is causing this (error|bug|issue)|why isn't this working|why is this nil|debug this|diagnose this)/i.test(p) ||
    p.includes('why am i getting this error') ||
    p.includes('why is this not working') ||
    p.includes('attempt to index nil');

  if (isDebugQuery && !/^(fix|repair|resolve|correct)\b/i.test(p)) {
    return {
      intent: 'DEBUG',
      confidence: 0.92,
      reason: 'User asked for root-cause diagnosis of an error or bug.',
      hasCodeInPrompt,
      requiresCodeGeneration: false,
      mode: 'DEBUG_MODE',
      skillsRequired: ['Debugging', 'Roblox Core']
    };
  }

  // 8. FIX (Targeted bug resolution)
  if (/^(fix this (code|script|error|bug|issue|nil)|fix it|repair this|resolve this error|make this error go away)/i.test(p) ||
      (p.startsWith('fix ') && (hasCodeInPrompt || p.includes('error') || p.includes('bug')))) {
    return {
      intent: 'FIX',
      confidence: 0.95,
      reason: 'User requested a direct fix for a broken script or error.',
      hasCodeInPrompt,
      requiresCodeGeneration: true,
      mode: 'DEBUG_MODE',
      skillsRequired: ['Debugging', 'Roblox Core', 'Security & Anti-Exploit']
    };
  }

  // 9. OPTIMIZE
  if (/^(optimize this|make this faster|reduce lag|improve performance of this|reduce memory usage)/i.test(p)) {
    return {
      intent: 'OPTIMIZE',
      confidence: 0.9,
      reason: 'User requested performance and memory optimization.',
      hasCodeInPrompt,
      requiresCodeGeneration: true,
      mode: 'BUILD_MODE',
      skillsRequired: ['Optimization', 'Roblox Core']
    };
  }

  // 10. REFACTOR / MODIFY
  if (/^(refactor this|improve this (system|script)|modify this to|change the speed|add permissions to this|change this so that|update this)/i.test(p)) {
    return {
      intent: 'MODIFY',
      confidence: 0.9,
      reason: 'User requested modification to an existing script or system.',
      hasCodeInPrompt,
      requiresCodeGeneration: true,
      mode: 'BUILD_MODE',
      skillsRequired: ['Architecture', 'Roblox Core']
    };
  }

  // 11. BUILD / CREATE (Explicit feature creation)
  const isBuildImperative = /(^(make|create|write|build|code|implement|generate|develop|add a system|add a mechanic|set up)\b)|(build (a|an|the)|create (a|an|the)|make (a|an|the))/i.test(p);
  if (isBuildImperative) {
    return {
      intent: 'BUILD',
      confidence: 0.95,
      reason: 'User explicitly requested building or implementing a new feature or system.',
      hasCodeInPrompt,
      requiresCodeGeneration: true,
      mode: 'BUILD_MODE',
      skillsRequired: ['Architecture', 'Gameplay', 'Data & Persistence', 'Security & Anti-Exploit']
    };
  }

  // 12. General Informational Question (Conceptual / Roblox Engine API)
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

  // Default: If code is provided with no other imperative, default to EXPLAIN
  if (hasCodeInPrompt) {
    return {
      intent: 'EXPLAIN',
      confidence: 0.8,
      reason: 'Code was provided without explicit build imperative; defaulting to safe EXPLAIN mode.',
      hasCodeInPrompt: true,
      requiresCodeGeneration: false,
      mode: 'EXPLAIN_MODE',
      skillsRequired: ['Roblox Core', 'Architecture']
    };
  }

  return {
    intent: 'EXPLAIN',
    confidence: 0.7,
    reason: 'General inquiry; maintaining minimal intervention.',
    hasCodeInPrompt: false,
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
