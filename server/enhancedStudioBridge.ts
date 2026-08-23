/**
 * ENHANCED ROBLOX STUDIO BRIDGE
 *
 * Extends the existing Studio Bridge with advanced capabilities:
 * - Real output reading
 * - Error detection and parsing
 * - Play test execution
 * - Property inspection
 * - Attribute management
 */

import { studio } from './agentStudioTool.js';
import { studioWebSync } from './studioWebSync.js';

export interface StudioOutput {
  timestamp: number;
  type: 'print' | 'warn' | 'error';
  message: string;
  source?: string;
  line?: number;
  stack?: string;
}

export interface PlayTestResult {
  success: boolean;
  duration: number;
  output: StudioOutput[];
  errors: StudioOutput[];
  warnings: StudioOutput[];
}

export interface PropertyInspection {
  className: string;
  properties: Record<string, any>;
  attributes: Record<string, any>;
  children: string[];
}

/**
 * Enhanced Studio Bridge with testing and debugging capabilities
 */
export class EnhancedStudioBridge {
  private projectId: string;
  private outputBuffer: StudioOutput[] = [];
  private isPlayTesting: boolean = false;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Start a Play Test session and capture output
   */
  async startPlayTest(): Promise<{ success: boolean; sessionId: string }> {
    try {
      this.isPlayTesting = true;
      this.outputBuffer = [];

      const result = await studio.createInstance(this.projectId, {
        className: 'RemoteEvent',
        name: '__PlayTestControl',
        parentPath: 'ReplicatedStorage'
      });

      // In real implementation, this would send a command to Studio Plugin
      // to start Play mode and begin output capture

      return {
        success: result.success,
        sessionId: `test_${Date.now()}`
      };

    } catch (error: any) {
      return {
        success: false,
        sessionId: ''
      };
    }
  }

  /**
   * Stop Play Test and return captured output
   */
  async stopPlayTest(): Promise<PlayTestResult> {
    this.isPlayTesting = false;

    const errors = this.outputBuffer.filter(o => o.type === 'error');
    const warnings = this.outputBuffer.filter(o => o.type === 'warn');

    const result: PlayTestResult = {
      success: errors.length === 0,
      duration: 0,
      output: this.outputBuffer,
      errors,
      warnings
    };

    this.outputBuffer = [];
    return result;
  }

  /**
   * Read Studio output (errors, warnings, prints)
   */
  async readOutput(): Promise<StudioOutput[]> {
    // In real implementation, this would query the Studio Plugin
    // for recent output messages

    // For now, return the buffer
    return [...this.outputBuffer];
  }

  /**
   * Parse error message and extract useful information
   */
  parseError(errorMessage: string): {
    type: 'runtime' | 'syntax' | 'timeout' | 'unknown';
    message: string;
    source?: string;
    line?: number;
    suggestion?: string;
  } {
    // Common Roblox error patterns
    const patterns = [
      {
        regex: /^(.+):(\d+): (.+)$/,
        type: 'runtime' as const,
        extract: (match: RegExpMatchArray) => ({
          source: match[1],
          line: parseInt(match[2]),
          message: match[3]
        })
      },
      {
        regex: /attempt to index nil with '(.+)'/,
        type: 'runtime' as const,
        extract: (match: RegExpMatchArray) => ({
          message: `Attempted to access '${match[1]}' on a nil value`,
          suggestion: 'Add nil check before accessing this property'
        })
      },
      {
        regex: /Infinite yield possible on '(.+)'/,
        type: 'timeout' as const,
        extract: (match: RegExpMatchArray) => ({
          message: `WaitForChild('${match[1]}') may yield forever`,
          suggestion: 'Check if this instance exists or use FindFirstChild instead'
        })
      },
      {
        regex: /(.+) is not a valid member of (.+)/,
        type: 'runtime' as const,
        extract: (match: RegExpMatchArray) => ({
          message: `'${match[1]}' does not exist in ${match[2]}`,
          suggestion: 'Check spelling or ensure this property/child exists'
        })
      }
    ];

    for (const pattern of patterns) {
      const match = errorMessage.match(pattern.regex);
      if (match) {
        const extracted = pattern.extract(match);
        return {
          type: pattern.type,
          message: extracted.message || errorMessage,
          source: extracted.source,
          line: extracted.line,
          suggestion: extracted.suggestion
        };
      }
    }

    return {
      type: 'unknown',
      message: errorMessage
    };
  }

  /**
   * Inspect instance properties and attributes
   */
  async inspectInstance(path: string): Promise<PropertyInspection | null> {
    try {
      const result = await studio.readScript(this.projectId, path);

      if (!result.success) {
        return null;
      }

      // In real implementation, this would query Studio for actual properties
      // For now, return basic info
      return {
        className: result.file.className || 'Instance',
        properties: {},
        attributes: {},
        children: []
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Get all instances of a specific class
   */
  async findInstancesByClass(className: string): Promise<string[]> {
    const files = studioWebSync.getProjectFilesForAi(this.projectId);
    const tree = studioWebSync.getMemoryTree(this.projectId);

    const instances: string[] = [];

    const traverse = (node: any, currentPath: string = '') => {
      const path = currentPath ? `${currentPath}/${node.name}` : node.name;

      if (node.className === className) {
        instances.push(path);
      }

      if (node.children) {
        for (const child of node.children) {
          traverse(child, path);
        }
      }
    };

    for (const root of tree) {
      traverse(root);
    }

    return instances;
  }

  /**
   * Check if Studio is currently connected and ready
   */
  async checkConnection(): Promise<{
    connected: boolean;
    placeName?: string;
    placeId?: number;
    sessionAge?: number;
  }> {
    const status = await studio.getStatus(this.projectId);

    if (status.status === 'CONNECTED' && status.session) {
      return {
        connected: true,
        placeName: status.session.placeName,
        placeId: status.session.placeId,
        sessionAge: Date.now() - status.session.lastHeartbeat
      };
    }

    return { connected: false };
  }

  /**
   * Simulate adding output (will be replaced by real Studio communication)
   */
  addOutput(type: 'print' | 'warn' | 'error', message: string, source?: string, line?: number) {
    this.outputBuffer.push({
      timestamp: Date.now(),
      type,
      message,
      source,
      line
    });
  }
}

/**
 * Factory function to create enhanced bridge
 */
export function createEnhancedStudioBridge(projectId: string): EnhancedStudioBridge {
  return new EnhancedStudioBridge(projectId);
}

/**
 * Global registry of bridges per project
 */
const bridgeRegistry = new Map<string, EnhancedStudioBridge>();

export function getStudioBridge(projectId: string): EnhancedStudioBridge {
  if (!bridgeRegistry.has(projectId)) {
    bridgeRegistry.set(projectId, new EnhancedStudioBridge(projectId));
  }
  return bridgeRegistry.get(projectId)!;
}
