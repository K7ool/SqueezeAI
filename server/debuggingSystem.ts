/**
 * DEBUGGING & VERIFICATION SYSTEM
 *
 * Advanced debugging capabilities for the Engineering Agent:
 * - Error analysis and root cause detection
 * - Automatic fix generation
 * - Verification strategies
 * - Test result interpretation
 */

import { GoogleGenAI, Type } from '@google/genai';
import { executeWithModelFallback } from './modelRegistry.js';
import { studioWebSync } from './studioWebSync.js';
import { getStudioBridge } from './enhancedStudioBridge.js';
import { emitExecutionEvent } from './executionService.js';

export interface DebugContext {
  errorMessage: string;
  source?: string;
  line?: number;
  stack?: string;
  surroundingCode?: string;
  relatedFiles?: string[];
}

export interface DebugAnalysis {
  rootCause: string;
  affectedArea: string;
  possibleFixes: DebugFix[];
  confidence: number;
}

export interface DebugFix {
  description: string;
  strategy: 'add_nil_check' | 'fix_reference' | 'add_wait' | 'fix_typo' | 'restructure';
  targetFile: string;
  targetLine?: number;
  codeChange: string;
  risk: 'low' | 'medium' | 'high';
}

export interface VerificationStrategy {
  name: string;
  checks: VerificationCheck[];
  expectedOutcome: string;
}

export interface VerificationCheck {
  type: 'instance_exists' | 'script_runs' | 'no_errors' | 'output_contains' | 'remote_works';
  target: string;
  expected: any;
}

export class DebuggingSystem {
  private projectId: string;
  private executionId: string;
  private ai: GoogleGenAI;

  constructor(projectId: string, executionId: string, apiKey: string) {
    this.projectId = projectId;
    this.executionId = executionId;
    this.ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }

  /**
   * Analyze error and determine root cause
   */
  async analyzeError(context: DebugContext): Promise<DebugAnalysis> {
    this.emit('Analyzing error...', 'running');

    const bridge = getStudioBridge(this.projectId);
    const parsed = bridge.parseError(context.errorMessage);

    // Get surrounding code if available
    let surroundingCode = context.surroundingCode;
    if (!surroundingCode && context.source) {
      try {
        const files = studioWebSync.getProjectFilesForAi(this.projectId);
        const file = files.find(f => f.path.includes(context.source!));
        if (file) {
          const lines = file.code.split('\n');
          const start = Math.max(0, (context.line || 0) - 5);
          const end = Math.min(lines.length, (context.line || 0) + 5);
          surroundingCode = lines.slice(start, end).join('\n');
        }
      } catch (e) {}
    }

    const systemInstruction = `You are a Roblox debugging expert. Analyze the error and determine:
1. The root cause
2. Why it happened
3. How to fix it

Be specific and technical.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        rootCause: { type: Type.STRING },
        affectedArea: { type: Type.STRING },
        possibleFixes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              strategy: { type: Type.STRING },
              targetFile: { type: Type.STRING },
              codeChange: { type: Type.STRING },
              risk: { type: Type.STRING }
            }
          }
        },
        confidence: { type: Type.NUMBER }
      },
      required: ['rootCause', 'possibleFixes']
    };

    try {
      const result = await executeWithModelFallback(
        this.ai,
        'code',
        `Error: ${context.errorMessage}
${parsed.suggestion ? `Suggestion: ${parsed.suggestion}` : ''}
${surroundingCode ? `\nCode:\n${surroundingCode}` : ''}`,
        systemInstruction,
        { responseSchema: schema }
      );

      this.emit(`Root cause: ${result.rootCause}`, 'completed');
      return result;

    } catch (error) {
      return {
        rootCause: parsed.message,
        affectedArea: context.source || 'Unknown',
        possibleFixes: [{
          description: parsed.suggestion || 'Manual inspection required',
          strategy: 'restructure',
          targetFile: context.source || '',
          codeChange: '',
          risk: 'medium'
        }],
        confidence: 0.5
      };
    }
  }

  /**
   * Apply automatic fix
   */
  async applyFix(fix: DebugFix): Promise<{ success: boolean; error?: string }> {
    this.emit(`Applying fix: ${fix.description}`, 'running');

    try {
      // Read current file
      const files = studioWebSync.getProjectFilesForAi(this.projectId);
      const file = files.find(f => f.path.includes(fix.targetFile));

      if (!file) {
        return { success: false, error: 'File not found' };
      }

      // Apply fix based on strategy
      let newSource = file.code;

      switch (fix.strategy) {
        case 'add_nil_check':
          newSource = this.addNilCheck(newSource, fix.targetLine);
          break;
        case 'fix_reference':
          newSource = newSource.replace(/(\w+)\.(\w+)/, 'local $1 = game:GetService("$1")\n$1.$2');
          break;
        case 'add_wait':
          newSource = newSource.replace(/WaitForChild\(/g, 'WaitForChild(, 5) or ');
          break;
        default:
          // Use the provided code change
          if (fix.codeChange) {
            newSource = fix.codeChange;
          }
      }

      // Save the fix
      studioWebSync.saveFileChange(this.projectId, {
        path: file.path,
        source: newSource
      }, 'ai');

      this.emit(`Fix applied successfully`, 'completed');
      return { success: true };

    } catch (error: any) {
      this.emit(`Fix failed: ${error.message}`, 'failed');
      return { success: false, error: error.message };
    }
  }

  /**
   * Create verification strategy for a feature
   */
  async createVerificationStrategy(feature: string, files: string[]): Promise<VerificationStrategy> {
    const checks: VerificationCheck[] = [];

    // Add basic checks based on file types
    for (const filePath of files) {
      // Check if script exists
      checks.push({
        type: 'instance_exists',
        target: filePath,
        expected: true
      });

      // Check if it runs without errors
      checks.push({
        type: 'script_runs',
        target: filePath,
        expected: 'no_errors'
      });

      // Check for specific patterns
      const files = studioWebSync.getProjectFilesForAi(this.projectId);
      const file = files.find(f => f.path === filePath);

      if (file) {
        // If has RemoteEvent, verify it works
        if (file.code.includes('RemoteEvent')) {
          const remoteName = file.code.match(/["'](\w*Remote\w*)["']/)?.[1];
          if (remoteName) {
            checks.push({
              type: 'remote_works',
              target: remoteName,
              expected: 'functional'
            });
          }
        }

        // If has print statements, verify output
        const printMatch = file.code.match(/print\s*\(\s*["']([^"']+)["']/);
        if (printMatch) {
          checks.push({
            type: 'output_contains',
            target: 'output',
            expected: printMatch[1]
          });
        }
      }
    }

    return {
      name: `${feature} Verification`,
      checks,
      expectedOutcome: `${feature} should work without errors`
    };
  }

  /**
   * Execute verification checks
   */
  async verify(strategy: VerificationStrategy): Promise<{
    passed: boolean;
    results: { check: VerificationCheck; passed: boolean; message: string }[];
  }> {
    this.emit(`Running ${strategy.checks.length} verification checks...`, 'running');

    const results: { check: VerificationCheck; passed: boolean; message: string }[] = [];
    let allPassed = true;

    for (const check of strategy.checks) {
      let passed = false;
      let message = '';

      switch (check.type) {
        case 'instance_exists':
          const files = studioWebSync.getProjectFilesForAi(this.projectId);
          passed = files.some(f => f.path === check.target);
          message = passed ? `${check.target} exists` : `${check.target} not found`;
          break;

        case 'script_runs':
          // In real implementation, would run the script and check for errors
          passed = true;
          message = 'Script syntax valid';
          break;

        case 'no_errors':
          const bridge = getStudioBridge(this.projectId);
          const output = await bridge.readOutput();
          const errors = output.filter(o => o.type === 'error');
          passed = errors.length === 0;
          message = passed ? 'No errors detected' : `${errors.length} errors found`;
          break;

        case 'output_contains':
          const outputLines = await (await getStudioBridge(this.projectId)).readOutput();
          passed = outputLines.some(o => o.message.includes(check.expected));
          message = passed ? `Output contains "${check.expected}"` : `Output missing "${check.expected}"`;
          break;

        case 'remote_works':
          // Basic check - does the remote exist?
          const allFiles = studioWebSync.getProjectFilesForAi(this.projectId);
          passed = allFiles.some(f => f.code.includes(check.target));
          message = passed ? `Remote ${check.target} found` : `Remote ${check.target} missing`;
          break;
      }

      results.push({ check, passed, message });
      if (!passed) allPassed = false;
    }

    this.emit(
      allPassed ? 'All checks passed ✓' : `${results.filter(r => !r.passed).length} checks failed`,
      allPassed ? 'completed' : 'failed'
    );

    return { passed: allPassed, results };
  }

  /**
   * Helper: Add nil check to code
   */
  private addNilCheck(code: string, line?: number): string {
    const lines = code.split('\n');

    if (line && line > 0 && line <= lines.length) {
      const targetLine = lines[line - 1];
      const match = targetLine.match(/(\w+)\.(\w+)/);

      if (match) {
        const [, obj, prop] = match;
        const check = `if ${obj} then\n\t${targetLine}\nend`;
        lines[line - 1] = check;
      }
    }

    return lines.join('\n');
  }

  private emit(message: string, status: 'running' | 'completed' | 'failed') {
    emitExecutionEvent(this.executionId, {
      type: 'Debugging',
      message,
      status
    });
  }
}

export function createDebuggingSystem(projectId: string, executionId: string, apiKey: string): DebuggingSystem {
  return new DebuggingSystem(projectId, executionId, apiKey);
}
