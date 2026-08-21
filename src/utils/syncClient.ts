import { safeFetchJson } from './api';
import { ProjectFile } from '../types/project';

export interface StudioSessionState {
  sessionId: string;
  projectId: string;
  projectName: string;
  placeId?: number;
  placeName?: string;
  universeId?: number;
  pairingCode: string;
  token: string;
  status: 'pending_pairing' | 'connected' | 'offline' | 'disconnected';
  connectedAt?: number;
  lastHeartbeat: number;
  pluginVersion: string;
  isOnline: boolean;
  secondsSinceHeartbeat: number;
}

export interface SyncChangeEvent {
  changeId: string;
  eventId: string;
  projectId: string;
  fileId: string;
  path: string;
  className: 'Script' | 'LocalScript' | 'ModuleScript';
  action: 'create' | 'update' | 'delete' | 'rename' | 'move';
  source: string;
  version: number;
  hash: string;
  timestamp: number;
  author: 'website' | 'studio' | 'ai';
  status: 'pending' | 'applied' | 'acknowledged' | 'conflict' | 'failed';
  errorMessage?: string;
}

export interface SyncConflict {
  conflictId: string;
  projectId: string;
  fileId: string;
  path: string;
  websiteVersion: number;
  websiteSource: string;
  websiteUpdatedAt: number;
  studioVersion: number;
  studioSource: string;
  studioUpdatedAt: number;
  detectedAt: number;
  status: 'open' | 'resolved';
  resolution?: 'keep_website' | 'keep_studio' | 'manual_merge';
}

export interface StudioAuditLog {
  id: string;
  projectId: string;
  sessionId?: string;
  userId?: string;
  type: string;
  author: string;
  details: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface ProjectSyncState {
  session: StudioSessionState | null;
  filesCount: number;
  files: any[];
  pendingChangesCount: number;
  recentChanges: SyncChangeEvent[];
  conflicts: SyncConflict[];
  tree: any[];
  auditLogs: StudioAuditLog[];
}

/**
 * Client API methods for Studio WebSync
 */
export async function createStudioPairingSession(projectId: string, projectName: string = "Roblox Game"): Promise<{
  success: boolean;
  pairingCode: string;
  token: string;
  session: StudioSessionState;
  error?: string;
}> {
  const res = await safeFetchJson('/api/studio/session/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, projectName })
  });

  if (!res.ok || !res.data?.success) {
    // Fallback to legacy sync route
    const fallbackRes = await safeFetchJson('/api/sync/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, projectName })
    });
    if (!fallbackRes.ok || !fallbackRes.data?.success) {
      return {
        success: false,
        pairingCode: '',
        token: '',
        session: null as any,
        error: fallbackRes.error || 'Failed to create studio session'
      };
    }
    return fallbackRes.data;
  }

  return res.data;
}

export async function fetchStudioSyncStatus(projectId: string): Promise<ProjectSyncState | null> {
  const res = await safeFetchJson<ProjectSyncState & { success: boolean }>(`/api/studio/session/status?projectId=${encodeURIComponent(projectId)}`);
  if (!res.ok || !res.data?.success) {
    const fallbackRes = await safeFetchJson<ProjectSyncState & { success: boolean }>(`/api/sync/status?projectId=${encodeURIComponent(projectId)}`);
    if (!fallbackRes.ok || !fallbackRes.data?.success) {
      return null;
    }
    return fallbackRes.data;
  }
  return res.data;
}

export async function syncFileToStudio(projectId: string, file: { path: string; name?: string; className?: any; source: string; expectedVersion?: number }, author: 'website' | 'ai' = 'website'): Promise<{
  success: boolean;
  changeEvent?: SyncChangeEvent;
  conflict?: SyncConflict;
  error?: string;
}> {
  const res = await safeFetchJson('/api/studio/files/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, file, author })
  });

  if (!res.ok || !res.data?.success) {
    const fallbackRes = await safeFetchJson('/api/sync/save-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, file, author })
    });
    if (!fallbackRes.ok || !fallbackRes.data?.success) {
      return { success: false, error: fallbackRes.error || 'Failed to sync file to studio' };
    }
    return fallbackRes.data;
  }
  return res.data;
}

export async function disconnectStudioSession(token: string): Promise<boolean> {
  const res = await safeFetchJson('/api/studio/disconnect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ reason: 'Disconnected from Web IDE' })
  });
  return res.ok && res.data?.success;
}

export async function resolveStudioConflict(projectId: string, conflictId: string, resolution: 'keep_website' | 'keep_studio' | 'manual_merge', mergedSource?: string): Promise<boolean> {
  const res = await safeFetchJson('/api/studio/conflicts/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, conflictId, resolution, mergedSource })
  });
  if (res.ok && res.data?.success) return true;

  const fallback = await safeFetchJson('/api/sync/resolve-conflict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, conflictId, resolution, mergedSource })
  });
  return fallback.ok && fallback.data?.success;
}

export async function getStudioPluginSource(): Promise<string> {
  try {
    const res = await fetch('/api/studio/plugin-source');
    if (res.ok) {
      return await res.text();
    }
    const fallbackRes = await fetch('/api/sync/plugin-source');
    if (fallbackRes.ok) {
      return await fallbackRes.text();
    }
  } catch (err) {
    console.error('Failed to get plugin source:', err);
  }
  return '';
}

