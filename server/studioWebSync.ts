import crypto from 'crypto';
import { 
  db, 
  StudioSessionRecord, 
  StudioPairingCodeRecord, 
  StudioChangeEventRecord, 
  StudioFileVersionRecord, 
  StudioConflictRecord, 
  StudioAuditLogRecord 
} from './db.js';

export interface StudioSession {
  sessionId: string;
  userId?: string;
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
  clientIp?: string;
  metadata?: Record<string, any>;
}

export interface SyncFilePayload {
  id: string; // stable identifier or path
  path: string; // e.g. "ServerScriptService/Systems/DonationService"
  name: string;
  className: 'Script' | 'LocalScript' | 'ModuleScript';
  parentPath: string;
  source: string;
  version: number;
  hash: string;
  updatedAt: number;
  updatedBy: 'website' | 'studio' | 'ai';
}

export interface SyncChangeEvent {
  changeId: string;
  eventId: string; // Alias for backward compatibility
  projectId: string;
  sessionId?: string;
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
  resolvedAt?: number;
}

export interface StudioProjectTreeItem {
  name: string;
  className: string;
  path: string;
  parent?: string;
  hasSource?: boolean;
  attributes?: Record<string, any>;
  children?: StudioProjectTreeItem[];
}

export interface StudioAuditLogEntry {
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

// -------------------------------------------------------------
// SANITIZATION & SECURITY HELPERS
// -------------------------------------------------------------

export function calculateSha256(content: string): string {
  return crypto.createHash('sha256').update(content || '').digest('hex');
}

export function sanitizeRobloxPath(rawPath: string): { valid: boolean; path: string; error?: string } {
  if (!rawPath || typeof rawPath !== 'string') {
    return { valid: false, path: '', error: 'Path is required.' };
  }

  // Normalize slashes and trim whitespace
  let clean = rawPath.replace(/\\+/g, '/').trim();

  // Strip null bytes and control chars
  clean = clean.replace(/[\x00-\x1f\x7f]/g, '');

  // Prevent directory traversal
  if (clean.includes('..') || clean.startsWith('/') || clean.includes('://')) {
    return { valid: false, path: '', error: 'Directory traversal and absolute protocols are forbidden.' };
  }

  // Standardize root container prefix
  // Allowed containers: ServerScriptService, ReplicatedStorage, StarterPlayer, StarterGui, Workspace, ReplicatedFirst, ServerStorage, src
  const allowedRoots = [
    'ServerScriptService',
    'ReplicatedStorage',
    'StarterPlayer',
    'StarterGui',
    'Workspace',
    'ReplicatedFirst',
    'ServerStorage',
    'src'
  ];

  const firstSegment = clean.split('/')[0];
  const isRecognizedRoot = allowedRoots.some(r => firstSegment.toLowerCase() === r.toLowerCase());

  if (!isRecognizedRoot) {
    // Prefix with ServerScriptService default if plain name
    clean = `ServerScriptService/${clean}`;
  }

  return { valid: true, path: clean };
}

export function validateSourceSize(source: string, maxBytes: number = 5 * 1024 * 1024): boolean {
  if (typeof source !== 'string') return false;
  const size = Buffer.byteLength(source, 'utf8');
  return size <= maxBytes;
}

// -------------------------------------------------------------
// STUDIO WEBSYNC CORE MANAGER
// -------------------------------------------------------------

class StudioWebSyncManager {
  private memorySessions: Map<string, StudioSession> = new Map(); // token -> session
  private memoryPairingCodes: Map<string, StudioPairingCodeRecord> = new Map(); // code -> record
  private memoryFiles: Map<string, Map<string, SyncFilePayload>> = new Map(); // projectId -> (path/id -> file)
  private memoryTrees: Map<string, StudioProjectTreeItem[]> = new Map(); // projectId -> tree
  private memoryOperationsQueue: Map<string, any[]> = new Map(); // projectId -> array of ops

  constructor() {
    this.hydrateFromDatabase();

    // Stale session reaper interval (every 10s): Heartbeat > 35s => offline
    setInterval(() => {
      this.reapStaleSessions();
    }, 10000);
  }

  private hydrateFromDatabase() {
    try {
      // Hydrate sessions
      const allSessions = db.getAllStudioSessions();
      for (const s of allSessions) {
        this.memorySessions.set(s.token, {
          sessionId: s.sessionId,
          userId: s.userId,
          projectId: s.projectId,
          projectName: s.projectName,
          placeId: s.placeId,
          placeName: s.placeName,
          universeId: s.universeId,
          pairingCode: s.pairingCode,
          token: s.token,
          status: s.status,
          connectedAt: s.connectedAt,
          lastHeartbeat: s.lastHeartbeat,
          pluginVersion: s.pluginVersion,
          clientIp: s.clientIp,
        });
      }
    } catch (e) {
      console.warn('[StudioWebSync] Hydration warning:', e);
    }
  }

  private reapStaleSessions() {
    const now = Date.now();
    for (const session of this.memorySessions.values()) {
      if (session.status === 'connected' && now - session.lastHeartbeat > 35000) {
        session.status = 'offline';
        db.saveStudioSession({
          ...session,
          createdAt: new Date(session.connectedAt || now).toISOString(),
          updatedAt: new Date().toISOString()
        });

        this.logAudit(session.projectId, {
          type: 'session_offline',
          author: 'system',
          sessionId: session.sessionId,
          details: `Studio instance timed out for project "${session.projectName}" (ID: ${session.placeId || 'Local'})`
        });
      }
    }
  }

  // -----------------------------------------------------------
  // 1. CREATE PAIRING SESSION (from Website UI)
  // -----------------------------------------------------------
  public createPairingSession(
    projectId: string, 
    projectName: string = "Roblox Game",
    userId?: string
  ): { pairingCode: string; token: string; session: StudioSession } {
    // Generate human-friendly 8-character pairing code: e.g. "AB7K-29QF"
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const token = 'sqz_sync_' + crypto.randomBytes(16).toString('hex');
    const sessionId = 'ses_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes TTL

    const session: StudioSession = {
      sessionId,
      userId,
      projectId,
      projectName,
      pairingCode: code,
      token,
      status: 'pending_pairing',
      lastHeartbeat: Date.now(),
      pluginVersion: '2.0.0'
    };

    const pairingRecord: StudioPairingCodeRecord = {
      code,
      projectId,
      projectName,
      userId,
      token,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString()
    };

    // Store in memory & persistent DB
    this.memorySessions.set(token, session);
    this.memoryPairingCodes.set(code, pairingRecord);

    db.saveStudioSession({
      ...session,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    db.savePairingCode(pairingRecord);

    this.logAudit(projectId, {
      type: 'pairing_created',
      author: 'website',
      userId,
      sessionId,
      details: `Generated single-use pairing code ${code} for project "${projectName}" (expires in 10m)`
    });

    return { pairingCode: code, token, session };
  }

  // -----------------------------------------------------------
  // 2. PAIR PLUGIN WITH CODE (Studio Plugin -> Backend)
  // -----------------------------------------------------------
  public pairPlugin(
    pairingCode: string, 
    placeInfo?: { placeId?: number; placeName?: string; universeId?: number; pluginVersion?: string },
    clientIp?: string
  ): { success: boolean; token?: string; sessionId?: string; projectId?: string; projectName?: string; session?: StudioSession; error?: string } {
    const cleanCode = (pairingCode || '').trim().toUpperCase();
    
    // Check memory or DB for active pairing code
    let pairRecord = this.memoryPairingCodes.get(cleanCode) || db.getPairingCode(cleanCode);

    if (!pairRecord || pairRecord.used || pairRecord.expiresAt < Date.now()) {
      return { 
        success: false, 
        error: 'Invalid, used, or expired pairing code. Please generate a new code from the Squeeze web dashboard.' 
      };
    }

    // Invalidate code (single-use constraint)
    pairRecord.used = true;
    this.memoryPairingCodes.set(cleanCode, pairRecord);
    db.markPairingCodeUsed(cleanCode);

    // Retrieve or create session
    let session = this.memorySessions.get(pairRecord.token) || db.getStudioSessionByToken(pairRecord.token);
    if (!session) {
      session = {
        sessionId: 'ses_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        userId: pairRecord.userId,
        projectId: pairRecord.projectId,
        projectName: pairRecord.projectName,
        pairingCode: cleanCode,
        token: pairRecord.token,
        status: 'connected',
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
        pluginVersion: placeInfo?.pluginVersion || '2.0.0',
        placeId: placeInfo?.placeId,
        placeName: placeInfo?.placeName,
        universeId: placeInfo?.universeId,
        clientIp
      };
    } else {
      session.status = 'connected';
      session.connectedAt = Date.now();
      session.lastHeartbeat = Date.now();
      if (placeInfo?.placeId) session.placeId = placeInfo.placeId;
      if (placeInfo?.placeName) session.placeName = placeInfo.placeName;
      if (placeInfo?.universeId) session.universeId = placeInfo.universeId;
      if (placeInfo?.pluginVersion) session.pluginVersion = placeInfo.pluginVersion;
      if (clientIp) session.clientIp = clientIp;
    }

    this.memorySessions.set(session.token, session);
    db.saveStudioSession({
      ...session,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.logAudit(session.projectId, {
      type: 'studio_paired_and_connected',
      author: 'studio',
      sessionId: session.sessionId,
      details: `Roblox Studio paired & connected for "${session.placeName || 'Main Place'}" (Place ID: ${session.placeId || 'Local'}, Universe ID: ${session.universeId || 'N/A'})`
    });

    return { 
      success: true, 
      token: session.token, 
      sessionId: session.sessionId,
      projectId: session.projectId,
      projectName: session.projectName,
      session 
    };
  }

  // -----------------------------------------------------------
  // 2b. AUTO CONNECT (Zero-Pairing Instant Plugin Handshake)
  // -----------------------------------------------------------
  public autoConnectPlugin(payload: {
    placeId?: number;
    universeId?: number;
    placeName?: string;
    pluginVersion?: string;
    projectId?: string;
    userId?: string;
    existingToken?: string;
    clientIp?: string;
  }): {
    success: boolean;
    sessionId: string;
    projectId: string;
    projectName: string;
    token: string;
    expiresAt: number;
    placeId?: number;
    universeId?: number;
    status: string;
    session: StudioSession;
  } {
    let session: StudioSession | undefined;

    if (payload.existingToken) {
      session = this.memorySessions.get(payload.existingToken) || db.getStudioSessionByToken(payload.existingToken);
    }

    const targetProjectId = payload.projectId || (session ? session.projectId : 'prj_default_roblox');

    if (!session) {
      for (const s of this.memorySessions.values()) {
        if (
          (payload.placeId && s.placeId === payload.placeId) ||
          (payload.universeId && s.universeId === payload.universeId) ||
          (s.projectId === targetProjectId && s.status !== 'disconnected')
        ) {
          session = s;
          break;
        }
      }
    }

    const token = session ? session.token : ('sqz_sync_' + crypto.randomBytes(16).toString('hex'));
    const sessionId = session ? session.sessionId : ('ses_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
    const projectName = payload.placeName || (session ? session.projectName : 'Roblox Game');

    const updatedSession: StudioSession = {
      sessionId,
      userId: payload.userId || (session ? session.userId : undefined),
      projectId: targetProjectId,
      projectName,
      placeId: payload.placeId || (session ? session.placeId : undefined),
      universeId: payload.universeId || (session ? session.universeId : undefined),
      placeName: payload.placeName || (session ? session.placeName : 'Roblox Studio Place'),
      pairingCode: session ? session.pairingCode : 'AUTO_CONNECT',
      token,
      status: 'connected',
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      pluginVersion: payload.pluginVersion || (session ? session.pluginVersion : '5.0.0'),
      clientIp: payload.clientIp
    };

    this.memorySessions.set(token, updatedSession);
    db.saveStudioSession({
      ...updatedSession,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.logAudit(targetProjectId, {
      type: 'studio_auto_connected',
      author: 'studio',
      sessionId,
      details: `Auto-connected Studio instance for "${projectName}" (Place ID: ${payload.placeId || 'Local'}, Universe ID: ${payload.universeId || 'N/A'})`
    });

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    return {
      success: true,
      sessionId,
      projectId: targetProjectId,
      projectName,
      token,
      expiresAt,
      placeId: payload.placeId,
      universeId: payload.universeId,
      status: 'connected',
      session: updatedSession
    };
  }

  // -----------------------------------------------------------
  // 3. DIRECT CONNECT (Connect endpoint for Studio or Token)
  // -----------------------------------------------------------
  public connectPluginDirect(payload: {
    projectId?: string;
    projectName?: string;
    placeId?: number;
    universeId?: number;
    placeName?: string;
    pluginVersion?: string;
    token?: string;
    userId?: string;
    clientIp?: string;
  }): { success: boolean; sessionId?: string; projectId?: string; token?: string; projectName?: string; status: string; session?: StudioSession; error?: string } {
    let session: StudioSession | undefined;

    if (payload.token) {
      session = this.memorySessions.get(payload.token) || db.getStudioSessionByToken(payload.token);
    }

    const projectId = payload.projectId || (session ? session.projectId : 'prj_default_roblox');
    const projectName = payload.projectName || (session ? session.projectName : 'Roblox Game');
    const token = payload.token || (session ? session.token : ('sqz_sync_' + crypto.randomBytes(16).toString('hex')));
    const sessionId = session ? session.sessionId : ('ses_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

    const updatedSession: StudioSession = {
      sessionId,
      userId: payload.userId || (session ? session.userId : undefined),
      projectId,
      projectName,
      placeId: payload.placeId || (session ? session.placeId : undefined),
      universeId: payload.universeId || (session ? session.universeId : undefined),
      placeName: payload.placeName || (session ? session.placeName : 'Roblox Studio Place'),
      pairingCode: session ? session.pairingCode : 'DIRECT',
      token,
      status: 'connected',
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      pluginVersion: payload.pluginVersion || (session ? session.pluginVersion : '2.0.0'),
      clientIp: payload.clientIp
    };

    this.memorySessions.set(token, updatedSession);
    db.saveStudioSession({
      ...updatedSession,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.logAudit(projectId, {
      type: 'studio_connected',
      author: 'studio',
      sessionId,
      details: `Connected Studio session for project "${projectName}" (Place ID: ${payload.placeId || 'Local'})`
    });

    return {
      success: true,
      sessionId,
      projectId,
      token,
      projectName,
      status: 'connected',
      session: updatedSession
    };
  }

  // -----------------------------------------------------------
  // 4. DISCONNECT (Terminate Studio Session)
  // -----------------------------------------------------------
  public disconnectSession(token: string, reason: string = 'User initiated disconnect'): { success: boolean; error?: string } {
    const session = this.memorySessions.get(token) || db.getStudioSessionByToken(token);
    if (!session) {
      return { success: false, error: 'Session not found or already disconnected.' };
    }

    session.status = 'disconnected';
    this.memorySessions.delete(token);

    db.saveStudioSession({
      ...session,
      createdAt: new Date(session.connectedAt || Date.now()).toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.logAudit(session.projectId, {
      type: 'studio_disconnected',
      author: 'studio',
      sessionId: session.sessionId,
      details: `Studio session disconnected: ${reason}`
    });

    return { success: true };
  }

  // -----------------------------------------------------------
  // 5. HEARTBEAT (Keep-Alive & Health Ping)
  // -----------------------------------------------------------
  public processHeartbeat(
    token: string, 
    details?: { placeId?: number; placeName?: string; universeId?: number; pluginVersion?: string; clientIp?: string }
  ): { success: boolean; session?: StudioSession; pendingChangesCount: number; status?: string; error?: string } {
    const session = this.memorySessions.get(token) || db.getStudioSessionByToken(token);
    if (!session || session.status === 'disconnected') {
      return { success: false, pendingChangesCount: 0, error: 'Invalid or terminated session token.' };
    }

    session.lastHeartbeat = Date.now();
    session.status = 'connected';
    if (details?.placeId) session.placeId = details.placeId;
    if (details?.placeName) session.placeName = details.placeName;
    if (details?.universeId) session.universeId = details.universeId;
    if (details?.pluginVersion) session.pluginVersion = details.pluginVersion;
    if (details?.clientIp) session.clientIp = details.clientIp;

    this.memorySessions.set(token, session);
    db.saveStudioSession({
      ...session,
      createdAt: new Date(session.connectedAt || Date.now()).toISOString(),
      updatedAt: new Date().toISOString()
    });

    const pending = db.getStudioPendingChanges(session.projectId, 'studio');

    return { 
      success: true, 
      session, 
      status: 'connected', 
      pendingChangesCount: pending.length 
    };
  }

  // -----------------------------------------------------------
  // 6. SAVE / PUSH FILE CHANGE (From Website, AI Agent, or Studio)
  // -----------------------------------------------------------
  public saveFileChange(
    projectId: string, 
    file: { 
      id?: string; 
      path: string; 
      name?: string; 
      className?: 'Script' | 'LocalScript' | 'ModuleScript'; 
      source: string;
      expectedVersion?: number;
    }, 
    author: 'website' | 'studio' | 'ai' = 'website',
    sessionId?: string
  ): { 
    success: boolean; 
    file?: SyncFilePayload; 
    changeEvent?: SyncChangeEvent; 
    conflict?: SyncConflict; 
    error?: string;
    status?: 'synced' | 'conflict' | 'error';
    expectedVersion?: number;
    currentVersion?: number;
  } {
    // 1. Sanitize Path
    const sanitized = sanitizeRobloxPath(file.path);
    if (!sanitized.valid) {
      return { success: false, status: 'error', error: sanitized.error || 'Invalid file path.' };
    }
    const cleanPath = sanitized.path;

    // 2. Validate Source Payload
    if (!validateSourceSize(file.source)) {
      return { success: false, status: 'error', error: 'File source exceeds maximum allowed size (5MB).' };
    }

    const fileId = file.id || cleanPath;
    const existing = db.getStudioFile(projectId, cleanPath) || db.getStudioFile(projectId, fileId);
    const hash = calculateSha256(file.source);

    // 3. Optimistic Versioning & Concurrency Conflict Detection:
    // If expectedVersion is specified, check against current stored version
    if (existing && file.expectedVersion !== undefined && existing.version > file.expectedVersion && existing.hash !== hash) {
      const conflictRecord: StudioConflictRecord = {
        conflictId: 'conf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        projectId,
        fileId,
        path: cleanPath,
        websiteVersion: author === 'website' || author === 'ai' ? existing.version + 1 : existing.version,
        websiteSource: author === 'website' || author === 'ai' ? file.source : existing.source,
        websiteUpdatedAt: author === 'website' || author === 'ai' ? Date.now() : existing.updatedAt,
        studioVersion: author === 'studio' ? (file.expectedVersion + 1) : existing.version,
        studioSource: author === 'studio' ? file.source : existing.source,
        studioUpdatedAt: author === 'studio' ? Date.now() : existing.updatedAt,
        detectedAt: Date.now(),
        status: 'open'
      };

      db.saveStudioConflict(conflictRecord);

      this.logAudit(projectId, {
        type: 'conflict_detected',
        author,
        sessionId,
        details: `Version collision on ${cleanPath}: Expected v${file.expectedVersion}, but server has v${existing.version}.`
      });

      return {
        success: false,
        status: 'conflict',
        error: `Conflict on ${cleanPath}: File version mismatch. Expected v${file.expectedVersion}, but current is v${existing.version}.`,
        expectedVersion: file.expectedVersion,
        currentVersion: existing.version,
        conflict: conflictRecord
      };
    }

    // 4. Calculate new version monotonically
    const newVersion = existing ? existing.version + 1 : 1;
    const inferredClass = file.className || (
      cleanPath.includes('.client.') ? 'LocalScript' : 
      cleanPath.includes('.server.') ? 'Script' : 
      'ModuleScript'
    );
    const parentPath = cleanPath.includes('/') ? cleanPath.substring(0, cleanPath.lastIndexOf('/')) : 'ServerScriptService';
    const fileName = file.name || cleanPath.split('/').pop() || 'Script';

    const syncedFileRecord: StudioFileVersionRecord = {
      id: fileId,
      projectId,
      path: cleanPath,
      name: fileName,
      className: inferredClass,
      parentPath,
      source: file.source,
      version: newVersion,
      hash,
      updatedAt: Date.now(),
      updatedBy: author
    };

    // Save to Database
    db.saveStudioFile(syncedFileRecord);

    // Save to Memory Map
    let projectFilesMap = this.memoryFiles.get(projectId);
    if (!projectFilesMap) {
      projectFilesMap = new Map();
      this.memoryFiles.set(projectId, projectFilesMap);
    }
    projectFilesMap.set(cleanPath, {
      id: fileId,
      path: cleanPath,
      name: fileName,
      className: inferredClass,
      parentPath,
      source: file.source,
      version: newVersion,
      hash,
      updatedAt: Date.now(),
      updatedBy: author
    });

    // 5. Create Change Event in Queue for connected endpoints
    const changeId = 'chg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const changeEvent: StudioChangeEventRecord = {
      changeId,
      projectId,
      sessionId,
      fileId,
      path: cleanPath,
      className: inferredClass,
      action: existing ? 'update' : 'create',
      source: file.source,
      version: newVersion,
      hash,
      timestamp: Date.now(),
      author,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    db.saveStudioChange(changeEvent);

    this.logAudit(projectId, {
      type: 'file_saved',
      author,
      sessionId,
      details: `Saved ${cleanPath} (v${newVersion}) by ${author}. Enqueued for Studio live sync.`
    });

    return { 
      success: true, 
      status: 'synced',
      file: {
        id: fileId,
        path: cleanPath,
        name: fileName,
        className: inferredClass,
        parentPath,
        source: file.source,
        version: newVersion,
        hash,
        updatedAt: Date.now(),
        updatedBy: author
      }, 
      changeEvent: {
        ...changeEvent,
        eventId: changeEvent.changeId
      } 
    };
  }

  // Alias for saveFileChange to maintain 100% backward compatibility
  public saveWebsiteFile(
    projectId: string, 
    file: { id?: string; path: string; name?: string; className?: 'Script' | 'LocalScript' | 'ModuleScript'; source: string }, 
    author: 'website' | 'ai' | 'studio' = 'website'
  ) {
    const res = this.saveFileChange(projectId, file, author);
    return {
      success: res.success,
      file: res.file!,
      changeEvent: res.changeEvent!,
      conflict: res.conflict
    };
  }

  // -----------------------------------------------------------
  // 7. PULL PENDING CHANGES (For Studio Plugin)
  // -----------------------------------------------------------
  public getPendingChangesForStudio(token: string): { success: boolean; changes: SyncChangeEvent[]; operations?: any[]; error?: string } {
    const session = this.memorySessions.get(token) || db.getStudioSessionByToken(token);
    if (!session || session.status === 'disconnected') {
      return { success: false, changes: [], error: 'Session not authenticated, expired, or disconnected.' };
    }

    session.lastHeartbeat = Date.now();
    this.memorySessions.set(token, session);

    // Get changes where author != 'studio'
    const pending = db.getStudioPendingChanges(session.projectId, 'studio');

    const formatted: SyncChangeEvent[] = pending.map(p => ({
      changeId: p.changeId,
      eventId: p.changeId, // backward compat alias
      projectId: p.projectId,
      sessionId: p.sessionId,
      fileId: p.fileId,
      path: p.path,
      className: p.className,
      action: p.action,
      source: p.source,
      version: p.version,
      hash: p.hash,
      timestamp: p.timestamp,
      author: p.author,
      status: p.status,
      errorMessage: p.errorMessage
    }));

    // Get pure operations queue
    const projectOpsQueue = this.memoryOperationsQueue.get(session.projectId) || [];
    const pendingOps = projectOpsQueue.filter((op: any) => op.status === 'pending');
    
    // Convert changes into operations for unified processing in the new plugin
    const legacyChangesAsOps = formatted.map(c => ({
      operationId: c.changeId,
      operation: c.action === 'create' ? 'createScript' : c.action === 'update' ? 'updateScript' : 'deleteScript',
      path: c.path,
      className: c.className,
      source: c.source,
      status: 'pending'
    }));

    const combinedOps = [...legacyChangesAsOps, ...pendingOps];

    return { success: true, changes: formatted, operations: combinedOps };
  }

  // -----------------------------------------------------------
  // 7.5. ENQUEUE PURE STUDIO OPERATION (Agent Tool Support)
  // -----------------------------------------------------------
  public enqueueStudioOperation(
    projectId: string,
    operation: {
      operation: string;
      className?: string;
      parentPath?: string;
      path?: string;
      name?: string;
      newName?: string;
      newParentPath?: string;
      properties?: any;
      attributes?: any;
      source?: string;
    },
    sessionId?: string
  ): { success: boolean; operationId: string } {
    const opId = 'op_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const opRecord = {
      operationId: opId,
      projectId,
      sessionId,
      ...operation,
      status: 'pending',
      timestamp: Date.now()
    };

    let queue = this.memoryOperationsQueue.get(projectId);
    if (!queue) {
      queue = [];
      this.memoryOperationsQueue.set(projectId, queue);
    }
    queue.push(opRecord);

    this.logAudit(projectId, {
      type: 'studio_operation_queued',
      author: 'ai',
      sessionId,
      details: "Enqueued studio operation: " + operation.operation + " on " + (operation.path || operation.name || "target")
    });

    return { success: true, operationId: opId };
  }

  // -----------------------------------------------------------
  // 8. ACKNOWLEDGE CHANGE (Studio confirms apply or error)
  // -----------------------------------------------------------
  public acknowledgeChange(
    token: string, 
    changeIdOrEventId: string, 
    status: 'applied' | 'failed' | 'acknowledged' = 'applied', 
    errorMsg?: string
  ): { success: boolean; error?: string } {
    const session = this.memorySessions.get(token) || db.getStudioSessionByToken(token);
    if (!session) {
      return { success: false, error: 'Session token invalid or expired.' };
    }

    session.lastHeartbeat = Date.now();
    this.memorySessions.set(token, session);

    const actualStatus = status === 'failed' ? 'failed' : 'applied';
    let updated = false;

    if (changeIdOrEventId.startsWith('op_')) {
        const queue = this.memoryOperationsQueue.get(session.projectId) || [];
        const op = queue.find((o: any) => o.operationId === changeIdOrEventId);
        if (op) {
            op.status = actualStatus;
            op.errorMessage = errorMsg;
            updated = true;
        }
    } else {
        updated = db.acknowledgeStudioChange(changeIdOrEventId, actualStatus, errorMsg);
    }

    this.logAudit(session.projectId, {
      type: actualStatus === 'applied' ? 'studio_acknowledged' : 'studio_apply_failed',
      author: 'studio',
      sessionId: session.sessionId,
      details: "Studio " + actualStatus + " change (ID: " + changeIdOrEventId + ")" + (errorMsg ? " - Error: " + errorMsg : "")
    });

    return { success: updated };
  }

  // -----------------------------------------------------------
  // 9. RECEIVE STUDIO CHANGE (Studio -> Web bidirectional)
  // -----------------------------------------------------------
  public receiveStudioChange(
    token: string, 
    change: { path: string; name?: string; className?: 'Script' | 'LocalScript' | 'ModuleScript'; source: string; expectedVersion?: number }
  ): { success: boolean; file?: SyncFilePayload; conflict?: SyncConflict; error?: string; status?: string } {
    const session = this.memorySessions.get(token) || db.getStudioSessionByToken(token);
    if (!session || session.status === 'disconnected') {
      return { success: false, error: 'Unauthorized or disconnected Studio session.' };
    }

    session.lastHeartbeat = Date.now();
    this.memorySessions.set(token, session);

    const result = this.saveFileChange(
      session.projectId, 
      change, 
      'studio', 
      session.sessionId
    );

    return result;
  }

  // -----------------------------------------------------------
  // 10. PROJECT SNAPSHOT & EXPLORER TREE DUMP
  // -----------------------------------------------------------
  public receiveStudioSnapshot(
    token: string, 
    snapshot: { 
      tree?: StudioProjectTreeItem[]; 
      instances?: StudioProjectTreeItem[]; 
      scriptFiles?: { path: string; name: string; className: 'Script' | 'LocalScript' | 'ModuleScript'; source: string }[] 
    }
  ): { success: boolean; importedCount: number; error?: string } {
    const session = this.memorySessions.get(token) || db.getStudioSessionByToken(token);
    if (!session || session.status === 'disconnected') {
      return { success: false, importedCount: 0, error: 'Unauthorized or disconnected Studio session.' };
    }

    session.lastHeartbeat = Date.now();
    this.memorySessions.set(token, session);

    const projectId = session.projectId;
    const treeItems = snapshot.instances || snapshot.tree || [];
    this.memoryTrees.set(projectId, treeItems);

    let importedCount = 0;
    if (snapshot.scriptFiles && Array.isArray(snapshot.scriptFiles)) {
      for (const s of snapshot.scriptFiles) {
        this.saveFileChange(projectId, s, 'studio', session.sessionId);
        importedCount++;
      }
    }

    this.logAudit(projectId, {
      type: 'studio_snapshot_imported',
      author: 'studio',
      sessionId: session.sessionId,
      details: `Imported full place snapshot with ${treeItems.length} Explorer nodes and ${importedCount} active Luau scripts.`
    });

    return { success: true, importedCount };
  }

  // Alias for backward compat
  public receiveStudioTree(
    token: string, 
    tree: StudioProjectTreeItem[], 
    scriptFiles?: { path: string; name: string; className: 'Script' | 'LocalScript' | 'ModuleScript'; source: string }[]
  ) {
    return this.receiveStudioSnapshot(token, { tree, scriptFiles });
  }

  // -----------------------------------------------------------
  // 11. CONFLICT RESOLUTION
  // -----------------------------------------------------------
  public resolveConflict(
    projectId: string, 
    conflictId: string, 
    resolution: 'keep_website' | 'keep_studio' | 'manual_merge', 
    mergedSource?: string,
    userId?: string
  ): { success: boolean; file?: SyncFilePayload; error?: string } {
    const conflict = db.resolveStudioConflict(conflictId, resolution);
    if (!conflict) {
      return { success: false, error: 'Conflict record not found.' };
    }

    let finalSource = conflict.websiteSource;
    let author: 'website' | 'studio' = 'website';

    if (resolution === 'keep_studio') {
      finalSource = conflict.studioSource;
      author = 'studio';
    } else if (resolution === 'manual_merge' && mergedSource !== undefined) {
      finalSource = mergedSource;
      author = 'website';
    }

    const saved = this.saveFileChange(projectId, {
      id: conflict.fileId,
      path: conflict.path,
      source: finalSource
    }, author);

    this.logAudit(projectId, {
      type: 'conflict_resolved',
      author: 'website',
      userId,
      details: `Resolved conflict on ${conflict.path} with strategy "${resolution}". Version v${saved.file?.version || 1} promoted.`
    });

    return { success: true, file: saved.file };
  }

  // -----------------------------------------------------------
  // 12. AUDIT LOGGING & STATUS QUERY
  // -----------------------------------------------------------
  public logAudit(projectId: string, entry: { type: string; author: string; details: string; sessionId?: string; userId?: string; metadata?: Record<string, any> }) {
    db.addStudioAuditLog(projectId, entry);
  }

  public getSession(tokenOrProjectId: string): StudioSession | null {
    if (this.memorySessions.has(tokenOrProjectId)) {
      return this.memorySessions.get(tokenOrProjectId)!;
    }
    const session = db.getStudioSessionByToken(tokenOrProjectId) || db.getStudioSessionByProject(tokenOrProjectId);
    if (session) {
      return {
        sessionId: session.sessionId,
        userId: session.userId,
        projectId: session.projectId,
        projectName: session.projectName,
        placeId: session.placeId,
        placeName: session.placeName,
        universeId: session.universeId,
        pairingCode: session.pairingCode,
        token: session.token,
        status: session.status,
        connectedAt: session.connectedAt,
        lastHeartbeat: session.lastHeartbeat,
        pluginVersion: session.pluginVersion,
        clientIp: session.clientIp,
      };
    }

    // Global fallback: return any active connected session if specific ID not found
    for (const [_, s] of this.memorySessions.entries()) {
      if (s.status === 'connected' && Date.now() - s.lastHeartbeat < 45000) {
        return s;
      }
    }
    const allSessions = db.getAllStudioSessions();
    const activeDbSession = allSessions.find(s => s.status === 'connected' && Date.now() - new Date(s.lastHeartbeat).getTime() < 45000);
    if (activeDbSession) {
      return {
        sessionId: activeDbSession.sessionId,
        userId: activeDbSession.userId,
        projectId: activeDbSession.projectId,
        projectName: activeDbSession.projectName,
        placeId: activeDbSession.placeId,
        placeName: activeDbSession.placeName,
        universeId: activeDbSession.universeId,
        pairingCode: activeDbSession.pairingCode,
        token: activeDbSession.token,
        status: activeDbSession.status,
        connectedAt: activeDbSession.connectedAt ? new Date(activeDbSession.connectedAt).getTime() : Date.now(),
        lastHeartbeat: new Date(activeDbSession.lastHeartbeat).getTime(),
        pluginVersion: activeDbSession.pluginVersion,
        clientIp: activeDbSession.clientIp,
      };
    }

    return null;
  }

  public getProjectSyncState(projectId: string) {
    let session = this.getSession(projectId);
    const actualProjectId = session ? session.projectId : projectId;

    const files = db.getStudioFiles(actualProjectId);
    const pendingChanges = db.getStudioPendingChanges(actualProjectId);
    const conflicts = db.getStudioConflicts(actualProjectId);
    const auditLogs = db.getStudioAuditLogs(actualProjectId, 40);
    const tree = this.memoryTrees.get(actualProjectId) || [];

    const isOnline = session ? (session.status === 'connected' && Date.now() - session.lastHeartbeat < 45000) : false;

    return {
      session: session ? {
        ...session,
        isOnline,
        secondsSinceHeartbeat: Math.floor((Date.now() - session.lastHeartbeat) / 1000)
      } : null,
      filesCount: files.length,
      files,
      pendingChangesCount: pendingChanges.length,
      recentChanges: pendingChanges.slice(-20).reverse(),
      conflicts,
      tree,
      auditLogs
    };
  }

  // -----------------------------------------------------------
  // 13. AI CONTEXT PROVIDER (Synchronizes AI with Studio state)
  // -----------------------------------------------------------
  public getProjectFilesForAi(projectId: string): { name: string; path: string; code: string; scriptType: string }[] {
    const files = db.getStudioFiles(projectId);
    return files.map(f => ({
      name: f.name,
      path: f.path,
      code: f.source,
      scriptType: f.className === 'Script' ? 'Server Script' : f.className
    }));
  }

  public getOperationStatus(projectId: string, operationId: string): string | null {
    const queue = this.memoryOperationsQueue.get(projectId) || [];
    const op = queue.find((o: any) => o.operationId === operationId);
    return op ? op.status : null;
  }
}

export const studioWebSync = new StudioWebSyncManager();
