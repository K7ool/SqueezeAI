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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  skillsFound?: RobloxSkillCitation[];
  actionPerformed?: {
    type: 'create_script' | 'update_script' | 'search_skills' | 'debug_fix' | 'explain_concept';
    summary: string;
    details?: string;
  };
  generatedScript?: {
    title: string;
    code: string;
    scriptType: 'Server Script' | 'LocalScript' | 'ModuleScript';
    targetInstance: string;
    explanation?: string;
    filePath?: string;
  };
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

