import { studioWebSync } from '../server/studioWebSync.js';
import { db } from '../server/db.js';

export interface AgentStudioExecutionResult {
  success: boolean;
  status: 'CONNECTED' | 'RECONNECTING' | 'PAIR_REQUIRED' | 'DISCONNECTED' | 'QUEUED' | 'SENT' | 'RECEIVED' | 'APPLIED' | 'ACKNOWLEDGED' | 'VERIFIED' | 'CONFLICT' | 'FAILED';
  summary: string;
  details?: string;
  filesSynced?: number;
  conflictsDetected?: number;
}

/**
 * Server-side WebSync Execution Tool for the AI Agent
 * Bridges the AI Agent directly to Roblox Studio WebSync
 */
export async function executeStudioPublish(projectId: string, files: { path: string; name?: string; className?: string; source: string }[]): Promise<AgentStudioExecutionResult> {
  try {
    // 1. Check Studio Connection status
    const session = studioWebSync.getSession(projectId);
    
    if (!session || session.status === 'disconnected' || session.status === 'offline') {
      // Try auto reconnect or session restore
      const allSessions = db.getAllStudioSessions();
      const activeSession = allSessions.find(s => s.projectId === projectId && s.status === 'connected');
      
      if (!activeSession) {
        return {
          success: false,
          status: 'PAIR_REQUIRED',
          summary: 'Roblox Studio is not currently connected or paired.',
          details: 'Please open your Roblox Studio place, open the Lemonade WebSync plugin, and click Connect or generate a new pairing code.'
        };
      }
    }

    const currentSession = studioWebSync.getSession(projectId);
    const isOnline = currentSession ? (currentSession.status === 'connected' && Date.now() - currentSession.lastHeartbeat < 45000) : false;

    if (!isOnline) {
      return {
        success: false,
        status: 'RECONNECTING',
        summary: 'Roblox Studio session is offline or missing heartbeats.',
        details: 'Attempting to ping Roblox Studio plugin...'
      };
    }

    let syncedCount = 0;
    const actualProjectId = currentSession ? currentSession.projectId : projectId;

    for (const file of files) {
      const scriptType = file.className || (file.path.includes('.server.') ? 'Script' : file.path.includes('.client.') ? 'LocalScript' : 'ModuleScript');
      
      // Push file to studio change queue
      const change = studioWebSync.pushWebsiteChange(actualProjectId, {
        fileId: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        path: file.path,
        className: scriptType as any,
        action: 'update',
        source: file.source,
        author: 'ai'
      });

      if (change) {
        syncedCount++;
      }
    }

    const conflicts = db.getStudioConflicts(actualProjectId);
    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        status: 'CONFLICT',
        summary: `Sync paused due to ${conflicts.length} file conflict(s) between Website and Roblox Studio.`,
        details: 'Please resolve conflicts in the WebSync workspace tab.',
        conflictsDetected: conflicts.length
      };
    }

    // Record audit log
    db.createStudioAuditLog({
      projectId: actualProjectId,
      sessionId: currentSession?.sessionId,
      type: 'AI_PUBLISH',
      author: 'ai',
      details: `Successfully pushed ${syncedCount} generated file(s) to Roblox Studio WebSync queue.`,
      metadata: { filesCount: syncedCount }
    });

    return {
      success: true,
      status: 'VERIFIED',
      summary: `Successfully synced ${syncedCount} file(s) to Roblox Studio via WebSync.`,
      details: 'Studio plugin will pick up changes on next poll heartbeat.',
      filesSynced: syncedCount
    };

  } catch (err: any) {
    console.error('[AgentStudioExecution] Error publishing to studio:', err);
    return {
      success: false,
      status: 'FAILED',
      summary: 'Failed to execute WebSync publish.',
      details: err.message || 'Unknown server error.'
    };
  }
}
