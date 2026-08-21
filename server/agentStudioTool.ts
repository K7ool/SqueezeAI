import { studioWebSync } from '../server/studioWebSync.js';
import { db } from '../server/db.js';

export interface AgentStudioExecutionResult {
  success: boolean;
  status: 'CONNECTED' | 'RECONNECTING' | 'PAIR_REQUIRED' | 'DISCONNECTED' | 'QUEUED' | 'SENT' | 'RECEIVED' | 'APPLIED' | 'ACKNOWLEDGED' | 'VERIFIED' | 'CONFLICT' | 'FAILED';
  summary: string;
  details?: string;
  filesSynced?: number;
  conflictsDetected?: number;
  operationId?: string;
  data?: any;
}

/**
 * Server-side WebSync Execution Tool for the AI Agent
 * Bridges the AI Agent directly to Roblox Studio WebSync
 */
export async function executeStudioPublish(projectId: string, files: { path: string; name?: string; className?: string; source: string }[]): Promise<AgentStudioExecutionResult> {
  try {
    const session = studioWebSync.getSession(projectId);
    
    if (!session || session.status === 'disconnected' || session.status === 'offline') {
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
      
      const res = studioWebSync.saveFileChange(actualProjectId, {
        path: file.path,
        className: scriptType as any,
        source: file.source
      }, 'ai', currentSession?.sessionId);

      if (res.success) {
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

    db.addStudioAuditLog(actualProjectId, {
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

export async function executeStudioOperation(projectId: string, operation: any): Promise<AgentStudioExecutionResult> {
  try {
    const session = studioWebSync.getSession(projectId);
    const isOnline = session ? (session.status === 'connected' && Date.now() - session.lastHeartbeat < 45000) : false;

    if (!isOnline) {
      return {
        success: false,
        status: 'DISCONNECTED',
        summary: 'Roblox Studio session is offline or missing heartbeats.'
      };
    }

    const res = studioWebSync.enqueueStudioOperation(projectId, operation, session?.sessionId);

    if (res.success) {
      db.addStudioAuditLog(projectId, {
        sessionId: session?.sessionId,
        type: 'AI_PUBLISH',
        author: 'ai',
        details: `Pushed operation ${operation.operation} to Roblox Studio WebSync queue.`,
        metadata: { operationId: res.operationId }
      });

      let finalStatus: AgentStudioExecutionResult["status"] = 'QUEUED';
      let summary = `Successfully enqueued operation ${operation.operation}.`;
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 300));
        const status = studioWebSync.getOperationStatus(projectId, res.operationId);
        if (status === 'applied' || status === 'acknowledged') {
          finalStatus = 'VERIFIED';
          summary = `Operation ${operation.operation} was successfully verified by Studio.`;
          break;
        } else if (status === 'failed') {
          finalStatus = 'FAILED';
          summary = `Operation ${operation.operation} failed to apply in Studio.`;
          break;
        }
      }

      return {
        success: finalStatus === 'VERIFIED' || finalStatus === 'QUEUED',
        status: finalStatus,
        summary,
        operationId: res.operationId
      };
    } else {
      return {
        success: false,
        status: 'FAILED',
        summary: 'Failed to enqueue operation.'
      };
    }
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

/**
 * REAL STUDIO TOOL LAYER (studio.*)
 * Dedicated, callable Studio Tools matching the Studio Tool Layer Specification
 */
export const studio = {
  getStatus: async (projectId: string) => {
    const session = studioWebSync.getSession(projectId);
    const isOnline = session ? (session.status === 'connected' && Date.now() - session.lastHeartbeat < 45000) : false;
    return {
      success: true,
      status: isOnline ? 'CONNECTED' : 'DISCONNECTED',
      session,
      placeName: session?.placeName || 'Roblox Place',
      placeId: session?.placeId
    };
  },

  getProject: async (projectId: string) => {
    const syncState = studioWebSync.getProjectSyncState(projectId);
    return {
      success: true,
      projectId,
      filesCount: syncState.filesCount,
      files: syncState.files,
      session: syncState.session
    };
  },

  getExplorer: async (projectId: string) => {
    const tree = studioWebSync.getMemoryTree(projectId);
    return {
      success: true,
      tree
    };
  },

  search: async (projectId: string, query: string) => {
    const files = db.getStudioFiles(projectId);
    const matched = files.filter(f => f.path.toLowerCase().includes(query.toLowerCase()) || f.name.toLowerCase().includes(query.toLowerCase()));
    return {
      success: true,
      matched
    };
  },

  createInstance: async (projectId: string, params: { className: string; name: string; parentPath?: string; properties?: any }) => {
    return await executeStudioOperation(projectId, {
      operation: 'createInstance',
      className: params.className,
      name: params.name,
      parentPath: params.parentPath || 'Workspace',
      properties: params.properties || {}
    });
  },

  updateInstance: async (projectId: string, params: { path: string; properties?: any; attributes?: any }) => {
    return await executeStudioOperation(projectId, {
      operation: 'updateInstance',
      path: params.path,
      properties: params.properties,
      attributes: params.attributes
    });
  },

  deleteInstance: async (projectId: string, path: string) => {
    return await executeStudioOperation(projectId, {
      operation: 'deleteInstance',
      path
    });
  },

  renameInstance: async (projectId: string, params: { path: string; newName: string }) => {
    return await executeStudioOperation(projectId, {
      operation: 'renameInstance',
      path: params.path,
      newName: params.newName
    });
  },

  moveInstance: async (projectId: string, params: { path: string; newParentPath: string }) => {
    return await executeStudioOperation(projectId, {
      operation: 'moveInstance',
      path: params.path,
      newParentPath: params.newParentPath
    });
  },

  setProperty: async (projectId: string, params: { path: string; propertyName: string; propertyValue: any }) => {
    return await executeStudioOperation(projectId, {
      operation: 'setProperty',
      path: params.path,
      propertyName: params.propertyName,
      propertyValue: params.propertyValue,
      properties: {
        [params.propertyName]: params.propertyValue
      }
    });
  },

  setAttribute: async (projectId: string, params: { path: string; attributeName: string; attributeValue: any }) => {
    return await executeStudioOperation(projectId, {
      operation: 'setAttribute',
      path: params.path,
      attributeName: params.attributeName,
      attributeValue: params.attributeValue
    });
  },

  readScript: async (projectId: string, path: string) => {
    const file = studioWebSync.getFile(projectId, path);
    if (file) {
      return { success: true, file };
    }
    return { success: false, summary: `Script not found at path ${path}` };
  },

  createScript: async (projectId: string, params: { className: 'Script' | 'LocalScript' | 'ModuleScript'; name: string; parentPath?: string; source?: string }) => {
    const parent = params.parentPath || (params.className === 'LocalScript' ? 'StarterPlayer.StarterPlayerScripts' : params.className === 'ModuleScript' ? 'ReplicatedStorage' : 'ServerScriptService');
    const fullPath = `${parent}/${params.name}`;
    const source = params.source || (params.className === 'ModuleScript' ? `local ${params.name} = {}\n\nreturn ${params.name}` : `--!strict\n-- [Squeeze Luau] ${params.name}\nprint("${params.name} initialized.")`);

    return await executeStudioPublish(projectId, [{
      path: fullPath,
      name: params.name,
      className: params.className,
      source
    }]);
  },

  updateScript: async (projectId: string, params: { path: string; source: string }) => {
    return await executeStudioPublish(projectId, [{
      path: params.path,
      source: params.source
    }]);
  },

  deleteScript: async (projectId: string, path: string) => {
    return await executeStudioOperation(projectId, {
      operation: 'deleteScript',
      path
    });
  },

  verify: async (projectId: string, operationId: string) => {
    const status = studioWebSync.getOperationStatus(projectId, operationId);
    return {
      success: status === 'applied' || status === 'acknowledged',
      status
    };
  }
};
