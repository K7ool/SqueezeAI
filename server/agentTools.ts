/**
 * ADVANCED TOOL SYSTEM FOR ENGINEERING AGENT
 *
 * Provides real tools beyond code generation:
 * - Project inspection and analysis
 * - Script reading and searching
 * - Dependency tracing
 * - Reference finding
 * - Error detection
 * - Testing capabilities
 */

import { studio } from './agentStudioTool.js';
import { studioWebSync } from './studioWebSync.js';
import { analyzeProjectCodebase, ProjectFileInfo } from './ai.js';

// ============================================================
// TOOL DEFINITIONS
// ============================================================

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  summary: string;
}

export interface ProjectScanResult {
  totalFiles: number;
  totalLines: number;
  scriptTypes: Record<string, number>;
  services: string[];
  remotes: string[];
  modules: string[];
  structure: ProjectStructureNode[];
}

export interface ProjectStructureNode {
  name: string;
  type: 'folder' | 'script' | 'instance';
  path: string;
  children?: ProjectStructureNode[];
  scriptType?: string;
  lineCount?: number;
}

export interface SearchResult {
  file: string;
  line?: number;
  match: string;
  context?: string;
}

export interface DependencyInfo {
  file: string;
  requires: string[];
  requiredBy: string[];
  remotes: string[];
  services: string[];
}

export interface ReferenceInfo {
  file: string;
  line: number;
  type: 'definition' | 'usage' | 'modification';
  context: string;
}

// ============================================================
// TOOL IMPLEMENTATIONS
// ============================================================

export class AgentTools {
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * READ_PROJECT: Get comprehensive project overview
   */
  async readProject(): Promise<ToolResult<ProjectScanResult>> {
    try {
      const files = studioWebSync.getProjectFilesForAi(this.projectId);

      if (files.length === 0) {
        return {
          success: true,
          data: {
            totalFiles: 0,
            totalLines: 0,
            scriptTypes: {},
            services: [],
            remotes: [],
            modules: [],
            structure: []
          },
          summary: 'Project is empty or Studio is not connected'
        };
      }

      const analysisMap = analyzeProjectCodebase(files as ProjectFileInfo[]);

      // Count script types
      const scriptTypes: Record<string, number> = {};
      let totalLines = 0;

      for (const file of files) {
        const type = file.scriptType || 'Unknown';
        scriptTypes[type] = (scriptTypes[type] || 0) + 1;
        totalLines += file.code.split('\n').length;
      }

      // Extract services
      const services = new Set<string>();
      const remotes = new Set<string>();
      const modules: string[] = [];

      for (const [path, data] of analysisMap.entries()) {
        data.services.forEach((s: string) => services.add(s));
        data.remotes.forEach((r: string) => remotes.add(r));

        if (data.exportedTypes.length > 0) {
          modules.push(path);
        }
      }

      // Build structure tree
      const structure = this.buildStructureTree(files);

      return {
        success: true,
        data: {
          totalFiles: files.length,
          totalLines,
          scriptTypes,
          services: Array.from(services),
          remotes: Array.from(remotes),
          modules,
          structure
        },
        summary: `Project has ${files.length} files, ${totalLines} lines of code`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: 'Failed to read project'
      };
    }
  }

  /**
   * SCAN_PROJECT: Deep scan for specific patterns or issues
   */
  async scanProject(pattern: RegExp | string): Promise<ToolResult<SearchResult[]>> {
    try {
      const files = studioWebSync.getProjectFilesForAi(this.projectId);
      const results: SearchResult[] = [];

      const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;

      for (const file of files) {
        const lines = file.code.split('\n');

        lines.forEach((line, index) => {
          if (regex.test(line)) {
            results.push({
              file: file.path,
              line: index + 1,
              match: line.trim(),
              context: this.getContext(lines, index)
            });
          }
        });
      }

      return {
        success: true,
        data: results,
        summary: `Found ${results.length} matches`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: 'Scan failed'
      };
    }
  }

  /**
   * INSPECT_INSTANCE: Get details about a specific instance/script
   */
  async inspectInstance(path: string): Promise<ToolResult<any>> {
    try {
      const result = await studio.readScript(this.projectId, path);

      if (!result.success) {
        return {
          success: false,
          error: 'Instance not found',
          summary: `Could not find ${path}`
        };
      }

      const file = result.file;
      const lines = file.source.split('\n');

      // Analyze the script
      const analysis = {
        path: file.path,
        name: file.name,
        className: file.className,
        parentPath: file.parentPath,
        lineCount: lines.length,
        hasStrict: file.source.includes('--!strict'),
        functions: this.extractFunctions(file.source),
        services: this.extractServices(file.source),
        remotes: this.extractRemotes(file.source),
        requires: this.extractRequires(file.source),
        hasDataStore: /DataStoreService|GetAsync|SetAsync/i.test(file.source),
        hasRemoteHandlers: /OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke/i.test(file.source)
      };

      return {
        success: true,
        data: analysis,
        summary: `Inspected ${path}: ${analysis.lineCount} lines, ${analysis.functions.length} functions`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: 'Inspection failed'
      };
    }
  }

  /**
   * SEARCH_SCRIPTS: Find scripts matching criteria
   */
  async searchScripts(query: string): Promise<ToolResult<string[]>> {
    try {
      const result = await studio.search(this.projectId, query);

      if (!result.success) {
        return {
          success: false,
          error: 'Search failed',
          summary: 'Could not search project'
        };
      }

      const paths = result.matched.map((f: any) => f.path);

      return {
        success: true,
        data: paths,
        summary: `Found ${paths.length} matching scripts`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: 'Search failed'
      };
    }
  }

  /**
   * READ_SCRIPT: Read script content
   */
  async readScript(path: string): Promise<ToolResult<string>> {
    try {
      const result = await studio.readScript(this.projectId, path);

      if (!result.success) {
        return {
          success: false,
          error: 'Script not found',
          summary: `Could not read ${path}`
        };
      }

      return {
        success: true,
        data: result.file.source,
        summary: `Read ${path} (${result.file.source.split('\n').length} lines)`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: 'Read failed'
      };
    }
  }

  /**
   * FIND_REFERENCES: Find all references to a symbol
   */
  async findReferences(symbol: string): Promise<ToolResult<ReferenceInfo[]>> {
    try {
      const files = studioWebSync.getProjectFilesForAi(this.projectId);
      const references: ReferenceInfo[] = [];

      for (const file of files) {
        const lines = file.code.split('\n');

        lines.forEach((line, index) => {
          if (line.includes(symbol)) {
            let type: 'definition' | 'usage' | 'modification' = 'usage';

            if (line.match(new RegExp(`local\\s+${symbol}\\s*=|function\\s+${symbol}|type\\s+${symbol}`))) {
              type = 'definition';
            } else if (line.match(new RegExp(`${symbol}\\s*=`))) {
              type = 'modification';
            }

            references.push({
              file: file.path,
              line: index + 1,
              type,
              context: line.trim()
            });
          }
        });
      }

      return {
        success: true,
        data: references,
        summary: `Found ${references.length} references to '${symbol}'`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: 'Reference search failed'
      };
    }
  }

  /**
   * FIND_DEPENDENTS: Find what depends on a file/module
   */
  async findDependents(filePath: string): Promise<ToolResult<string[]>> {
    try {
      const files = studioWebSync.getProjectFilesForAi(this.projectId);
      const analysisMap = analyzeProjectCodebase(files as ProjectFileInfo[]);

      const dependents: string[] = [];

      for (const [path, data] of analysisMap.entries()) {
        if (data.requires.some((req: string) => req.includes(filePath) || filePath.includes(req))) {
          dependents.push(path);
        }
      }

      return {
        success: true,
        data: dependents,
        summary: `Found ${dependents.length} files that depend on ${filePath}`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: 'Dependency search failed'
      };
    }
  }

  /**
   * INSPECT_MODULE: Detailed module inspection
   */
  async inspectModule(path: string): Promise<ToolResult<any>> {
    try {
      const scriptResult = await this.readScript(path);

      if (!scriptResult.success || !scriptResult.data) {
        return {
          success: false,
          error: 'Module not found',
          summary: `Could not inspect ${path}`
        };
      }

      const source = scriptResult.data;

      const moduleInfo = {
        path,
        exports: this.extractExports(source),
        types: this.extractTypes(source),
        functions: this.extractFunctions(source),
        dependencies: this.extractRequires(source),
        isModuleScript: /return\s+\w+\s*$/.test(source)
      };

      return {
        success: true,
        data: moduleInfo,
        summary: `Module has ${moduleInfo.exports.length} exports, ${moduleInfo.functions.length} functions`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: 'Module inspection failed'
      };
    }
  }

  /**
   * GET_ERRORS: Check for syntax/runtime errors
   */
  async getErrors(): Promise<ToolResult<any[]>> {
    try {
      const files = studioWebSync.getProjectFilesForAi(this.projectId);
      const errors: any[] = [];

      for (const file of files) {
        // Basic syntax checks
        const lines = file.code.split('\n');

        lines.forEach((line, index) => {
          // Check for common issues
          if (line.includes('GetService') && !line.includes('game:GetService')) {
            errors.push({
              file: file.path,
              line: index + 1,
              severity: 'warning',
              message: 'GetService should be called on game',
              context: line.trim()
            });
          }

          if (line.match(/\bwait\s*\(/) && !line.includes('task.wait')) {
            errors.push({
              file: file.path,
              line: index + 1,
              severity: 'warning',
              message: 'Use task.wait() instead of deprecated wait()',
              context: line.trim()
            });
          }
        });
      }

      return {
        success: true,
        data: errors,
        summary: `Found ${errors.length} potential issues`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: 'Error check failed'
      };
    }
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private buildStructureTree(files: any[]): ProjectStructureNode[] {
    const tree: ProjectStructureNode[] = [];
    const pathMap = new Map<string, ProjectStructureNode>();

    for (const file of files) {
      const parts = file.path.split('/');
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!pathMap.has(currentPath)) {
          const node: ProjectStructureNode = {
            name: part,
            type: i === parts.length - 1 ? 'script' : 'folder',
            path: currentPath,
            children: []
          };

          if (node.type === 'script') {
            node.scriptType = file.scriptType;
            node.lineCount = file.code.split('\n').length;
          }

          pathMap.set(currentPath, node);

          if (parentPath) {
            const parent = pathMap.get(parentPath);
            if (parent) {
              parent.children = parent.children || [];
              parent.children.push(node);
            }
          } else {
            tree.push(node);
          }
        }
      }
    }

    return tree;
  }

  private getContext(lines: string[], index: number, radius: number = 2): string {
    const start = Math.max(0, index - radius);
    const end = Math.min(lines.length, index + radius + 1);
    return lines.slice(start, end).join('\n');
  }

  private extractFunctions(code: string): string[] {
    const functions: string[] = [];
    const regex = /(?:local\s+)?function\s+([a-zA-Z0-9_.:]+)\s*\(/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      functions.push(match[1]);
    }

    return functions;
  }

  private extractServices(code: string): string[] {
    const services: string[] = [];
    const regex = /game:GetService\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      services.push(match[1]);
    }

    return Array.from(new Set(services));
  }

  private extractRemotes(code: string): string[] {
    const remotes: string[] = [];
    const regex = /(?:FindFirstChild|WaitForChild)\s*\(\s*["']([^"']*(?:Remote|Event|Function)[^"']*)["']\s*\)/gi;
    let match;

    while ((match = regex.exec(code)) !== null) {
      remotes.push(match[1]);
    }

    return Array.from(new Set(remotes));
  }

  private extractRequires(code: string): string[] {
    const requires: string[] = [];
    const regex = /require\s*\(\s*([^)]+)\s*\)/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      requires.push(match[1].trim());
    }

    return requires;
  }

  private extractExports(code: string): string[] {
    const exports: string[] = [];
    const regex = /(?:Module|local\s+\w+)\s*\.\s*([a-zA-Z0-9_]+)\s*=/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      exports.push(match[1]);
    }

    return Array.from(new Set(exports));
  }

  private extractTypes(code: string): string[] {
    const types: string[] = [];
    const regex = /export\s+type\s+([a-zA-Z0-9_]+)/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      types.push(match[1]);
    }

    return types;
  }
}

// ============================================================
// EXPORTED FACTORY
// ============================================================

export function createAgentTools(projectId: string): AgentTools {
  return new AgentTools(projectId);
}
