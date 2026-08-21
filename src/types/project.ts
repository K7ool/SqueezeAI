export interface SystemNode {
  id: string;
  name: string;
  category: 'Core' | 'Gameplay' | 'Data' | 'UI' | 'Security' | 'Monetization' | 'World' | 'Effects' | 'Networking';
  description: string;
  fileIds: string[];
  filePaths: string[];
  dependencies: string[]; // IDs of nodes this system depends on
  dependents: string[]; // IDs of nodes that depend on this system
  status: 'healthy' | 'warning' | 'error';
  warnings?: string[];
  errors?: string[];
  x?: number;
  y?: number;
  isSuggested?: boolean;
}

export interface SystemConnection {
  id: string;
  fromId: string;
  toId: string;
  type: 'dependency' | 'related'; // dependency = solid, related = dashed
  health: 'healthy' | 'warning' | 'error';
  reason: string; // Detailed architectural reason for connection
}

export interface ProjectHealthAudit {
  score: number; // 0 to 100
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
  nodes?: SystemNode[];
  connections?: SystemConnection[];
  suggestedFeatures?: SuggestedFeatureNode[];
  lastAudited: number;
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

export interface ProjectMemoryState {
  gameTitle: string;
  gameGenre: string;
  coreLoop: string;
  knownSystems: string[];
  knownRemotes: string[];
  knownDataStores: string[];
  securityConcerns: string[];
  recentChanges: {
    timestamp: number;
    summary: string;
    filesAffected: string[];
  }[];
}

export interface ProjectFile {
  id: string;
  name: string;
  path: string; // e.g. "src/server/MainHandler.server.luau"
  code: string;
  scriptType: 'Server Script' | 'LocalScript' | 'ModuleScript' | 'Json' | 'Markdown';
  targetInstance: string;
  lastModified: number;
  tags?: string[];
  fileHandle?: any; // FileSystemFileHandle if loaded via Native Directory Picker
}

export interface IdeaNode {
  id: string;
  label: string;
  description: string;
  category: 'mechanic' | 'item' | 'vfx' | 'ui' | 'system' | 'monetization' | 'combat';
  parentId?: string;
  status: 'idle' | 'generating' | 'completed';
  scriptTitle?: string;
  scriptCode?: string;
  targetInstance?: string;
  scriptType?: 'Server Script' | 'LocalScript' | 'ModuleScript';
  filePath?: string;
  childrenIds?: string[];
}

export interface RobloxProject {
  id: string;
  name: string;
  description: string;
  version: string;
  folderName?: string;
  isNativeDirectoryMounted?: boolean;
  dirHandle?: any; // FileSystemDirectoryHandle
  files: ProjectFile[];
  activeFileId: string;
  ideaNodes?: IdeaNode[];
  systemNodes?: SystemNode[];
  connections?: SystemConnection[];
  healthAudit?: ProjectHealthAudit;
  suggestedNodes?: SuggestedFeatureNode[];
  projectMemory?: ProjectMemoryState;
  createdAt: number;
  updatedAt: number;
}

export interface RobloxSkillCitation {
  id: string;
  title: string;
  category: string;
  summary: string;
  keyServices?: string[];
  apiDocsUrl?: string;
  luauSnippet?: string;
  bestPractices?: string[];
  tags?: string[];
}

export interface ThinkingStep {
  stage: string;
  details?: string;
  completed: boolean;
  durationMs?: number;
}

export interface ChangePlan {
  filesToCreate: string[];
  filesToModify: string[];
  systemsAffected: string[];
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
}

export interface GeneratedFilePayload {
  title: string;
  code: string;
  scriptType: 'Server Script' | 'LocalScript' | 'ModuleScript';
  targetInstance: string;
  explanation?: string;
  filePath: string;
}

export interface CodeReviewPayload {
  passed: boolean;
  securityRating: string;
  memoryAndLifecycle: string;
  antiExploitGuards: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinkingSteps?: ThinkingStep[];
  changePlan?: ChangePlan;
  codeReview?: CodeReviewPayload;
  skillsFound?: RobloxSkillCitation[];
  actionPerformed?: {
    type: 'create_script' | 'update_script' | 'search_skills' | 'debug_fix' | 'explain_concept' | 'analyze_project' | 'multi_file_create';
    summary: string;
    details?: string;
  };
  generatedScript?: GeneratedFilePayload;
  filesGenerated?: GeneratedFilePayload[];
  modifiedFiles?: {
    path: string;
    name: string;
    action: 'created' | 'updated' | 'analyzed';
  }[];
  suggestedPrompts?: string[];
}

export interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  projectId?: string;
}

