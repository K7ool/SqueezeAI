import express from 'express';
import { db } from './db.js';
import { 
  generateLuauScript, 
  debugLuauError, 
  analyzeRobloxProject, 
  expandIdeaNode, 
  chatWithProjectAssistant,
  generateTaskPlan,
  executeTaskPlan,
  verifyTaskPlan
} from './ai.js';
import { buildDynamicGameMap } from './projectGraph.js';
import { ROBLOX_SKILLS_DATABASE, searchRobloxSkills } from './robloxSkillsDb.js';
import { 
  hashPassword, 
  comparePassword, 
  createToken, 
  optionalAuthMiddleware, 
  requireAuthMiddleware, 
  AuthenticatedRequest 
} from './auth.js';
import { createCheckoutSession, handleStripeWebhook, PLANS } from './stripe.js';
import { studioWebSync } from './studioWebSync.js';
import { OFFICIAL_ROBLOX_STUDIO_PLUGIN_SOURCE } from './robloxStudioPluginSource.js';
import { executeStudioPublish, executeStudioOperation } from './agentStudioTool.js';
import { searchMemories, buildAgentContext } from './memoryService.js';
import { executionEventBus, getExecutionHistory, emitExecutionEvent } from './executionService.js';

export function createExpressApp() {
  const app = express();

  // JSON Body Parser with increased payload size limit (50mb) for handling full Roblox project files
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'Squeeze AI Platform', 
      version: '1.4.0',
      timestamp: new Date().toISOString() 
    });
  });

  // -------------------------------------------------------------
  // AUTH ROUTES
  // -------------------------------------------------------------
  
  // Register
  app.post('/api/auth/register', (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const existing = db.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }

      const user = db.createUser({
        email: email.trim(),
        name: name?.trim() || email.split('@')[0],
        passwordHash: hashPassword(password),
        role: 'user',
        plan: 'free',
        planStatus: 'active',
        monthlyLimit: 25,
      });

      const token = createToken(user.id);
      const { passwordHash: _, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Registration failed.' });
    }
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const user = db.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      const valid = comparePassword(password, user.passwordHash);
      if (!valid) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      const token = createToken(user.id);
      const { passwordHash: _, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Login failed.' });
    }
  });

  // Google OAuth Demo Simulation (Instant 1-Click Login)
  app.post('/api/auth/google-sim', (req, res) => {
    try {
      const email = req.body.email || 'builder@squeeze.gg';
      let user = db.getUserByEmail(email);
      
      if (!user) {
        user = db.createUser({
          email,
          name: 'Roblox Creator',
          passwordHash: hashPassword('oauth_guest_pass'),
          role: 'user',
          plan: 'pro',
          planStatus: 'active',
          monthlyLimit: 500,
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        });
      }

      const token = createToken(user.id);
      const { passwordHash: _, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Google Auth failed.' });
    }
  });

  // Current User (Me)
  app.get('/api/auth/me', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.json({ user: null, isAuthenticated: false });
    }
    const { passwordHash: _, ...safeUser } = req.user;
    const isUnlimited = safeUser.plan === 'pro' || safeUser.plan === 'studio';
    const remaining = isUnlimited ? 9999 : Math.max(0, safeUser.monthlyLimit - safeUser.usedGenerations);

    res.json({
      user: safeUser,
      isAuthenticated: true,
      quota: {
        used: safeUser.usedGenerations,
        limit: safeUser.monthlyLimit,
        remaining,
        isUnlimited,
        planName: PLANS[safeUser.plan]?.name || 'Sip',
      }
    });
  });

  // User Quota Endpoint
  app.get('/api/user/quota', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const isUnlimited = req.user.plan === 'pro' || req.user.plan === 'studio';
    const remaining = isUnlimited ? 9999 : Math.max(0, req.user.monthlyLimit - req.user.usedGenerations);

    res.json({
      success: true,
      quota: {
        used: req.user.usedGenerations,
        limit: req.user.monthlyLimit,
        remaining,
        isUnlimited,
        planName: PLANS[req.user.plan]?.name || 'Sip',
      }
    });
  });

  // Forgot Password
  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    res.json({
      success: true,
      message: `Password reset link has been dispatched to ${email}. Check your inbox or use password123.`,
    });
  });

  // -------------------------------------------------------------
  // AI GENERATOR & DEBUGGER ROUTES
  // -------------------------------------------------------------

  // Generate Luau Script
  app.post('/api/generate', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { prompt, contextHierarchy } = req.body;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required.' });
      }

      const user = req.user;
      let remainingQuota = 25;

      if (user) {
        const usageCheck = db.incrementUserGenerations(user.id);
        if (!usageCheck.success) {
          return res.status(429).json({ 
            error: 'You have reached your monthly generation limit for the ' + user.plan + ' plan. Upgrade to Pitcher for unlimited scripts!',
            upgradeRequired: true 
          });
        }
        remainingQuota = usageCheck.remaining;
      }

      const result = await generateLuauScript(prompt.trim(), contextHierarchy);

      const savedScript = db.createScript({
        userId: user ? user.id : 'usr_demo_builder',
        title: result.title,
        prompt: prompt.trim(),
        code: result.code,
        explanation: result.explanation,
        scriptType: result.scriptType,
        targetInstance: result.targetInstance,
        lineCount: result.lineCount,
        tags: result.tags,
        isFavorite: false,
      });

      res.json({
        success: true,
        script: savedScript,
        quota: {
          remaining: user ? remainingQuota : 24,
          isUnlimited: user ? (user.plan === 'pro' || user.plan === 'studio') : false,
        }
      });
    } catch (err: any) {
      console.error('Error in /api/generate:', err);
      res.status(500).json({ error: err.message || 'Failed to generate script.' });
    }
  });

  // Debug Roblox Error
  app.post('/api/debug', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { errorMessage, brokenCode } = req.body;
      if (!errorMessage || !errorMessage.trim()) {
        return res.status(400).json({ error: 'Roblox error message is required.' });
      }

      const user = req.user;
      if (user) {
        db.incrementUserGenerations(user.id);
      }

      const result = await debugLuauError(errorMessage.trim(), brokenCode);

      const savedScript = db.createScript({
        userId: user ? user.id : 'usr_demo_builder',
        title: result.title,
        prompt: `Debug: ${errorMessage.trim()}`,
        code: result.code,
        explanation: result.explanation,
        scriptType: result.scriptType,
        targetInstance: result.targetInstance,
        lineCount: result.lineCount,
        tags: result.tags,
        isFavorite: false,
      });

      res.json({
        success: true,
        script: savedScript,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to debug error.' });
    }
  });

  // Analyze Loaded Project Codebase & Return Ideation Chain
  app.post('/api/project/analyze', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { files, mode, customQuery, sessionMemory } = req.body;
      if (!files || !Array.isArray(files)) {
        return res.status(400).json({ error: 'Files array is required for project analysis.' });
      }

      const analysis = await analyzeRobloxProject(files, mode || 'missing', customQuery, sessionMemory);
      res.json({ success: true, analysis });
    } catch (err: any) {
      console.error('Error analyzing project:', err);
      res.status(500).json({ error: err.message || 'Failed to analyze project.' });
    }
  });

  // Expand Idea Node in the Map
  app.post('/api/project/expand-idea', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { parentIdea, gameContext, existingLabels } = req.body;
      if (!parentIdea) {
        return res.status(400).json({ error: 'Parent idea is required.' });
      }

      const children = await expandIdeaNode(
        parentIdea, 
        gameContext || 'Roblox Game', 
        Array.isArray(existingLabels) ? existingLabels : []
      );
      res.json({ success: true, children });
    } catch (err: any) {
      console.error('Error expanding idea node:', err);
      res.status(500).json({ error: err.message || 'Failed to expand idea.' });
    }
  });

  // Dynamic Game Map & Project Architecture Audit
  app.post('/api/project/health-audit', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { files, projectName } = req.body;
      if (!files || !Array.isArray(files)) {
        return res.status(400).json({ error: 'Files array is required for health audit.' });
      }

      const audit = buildDynamicGameMap(files, projectName || 'Roblox Game');
      res.json({ success: true, audit });
    } catch (err: any) {
      console.error('Error auditing project health:', err);
      res.status(500).json({ error: err.message || 'Failed to audit project health.' });
    }
  });

  // -------------------------------------------------------------
  // PERSISTENT CONVERSATIONS API
  // -------------------------------------------------------------

  app.get('/api/conversations', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'usr_demo_builder';
      const projectId = (req.query.projectId as string) || 'prj_default_roblox';
      const search = req.query.search as string;

      const conversations = db.getConversations(userId, projectId, search);
      res.json({ success: true, conversations });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list conversations' });
    }
  });

  app.post('/api/conversations', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'usr_demo_builder';
      const { title, projectId } = req.body;

      const conv = db.createConversation({
        userId,
        projectId: projectId || 'prj_default_roblox',
        title: title || 'New Roblox System'
      });

      res.json({ success: true, conversation: conv });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create conversation' });
    }
  });

  app.get('/api/conversations/:id', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const conversation = db.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const messages = db.getMessages(id, limit, offset);

      res.json({ success: true, conversation, messages });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch conversation' });
    }
  });

  app.patch('/api/conversations/:id', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { title, archived } = req.body;

      const updated = db.updateConversation(id, { title, archived });
      if (!updated) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json({ success: true, conversation: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update conversation' });
    }
  });

  app.delete('/api/conversations/:id', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'usr_demo_builder';
      const deleted = db.deleteConversation(id, userId);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete conversation' });
    }
  });

  app.get('/api/conversations/:id/messages', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const messages = db.getMessages(id);
      res.json({ success: true, messages });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch messages' });
    }
  });

  // -------------------------------------------------------------
  // PERSISTENT MEMORY ARCHITECTURE ENDPOINTS
  // -------------------------------------------------------------

  app.get('/api/memory', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'usr_demo_builder';
      const projectId = (req.query.projectId as string) || 'prj_default_roblox';

      const userMems = db.getUserMemories(userId);
      const prjMem = db.getProjectMemory(userId, projectId);
      const recentExecs = db.getRecentExecutions(userId, projectId, 10);
      const recentErrs = db.getRecentErrors(userId, projectId, 10);
      const memoryEvents = db.getMemoryEvents(userId, 20);

      res.json({
        success: true,
        memory: {
          userPreferences: userMems,
          projectMemory: prjMem,
          recentExecutions: recentExecs,
          recentErrors: recentErrs,
          memoryEvents
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch memory overview' });
    }
  });

  app.get('/api/memory/search', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'usr_demo_builder';
      const query = (req.query.q as string) || '';
      const projectId = (req.query.projectId as string) || 'prj_default_roblox';

      const results = searchMemories(userId, query, projectId);
      res.json({ success: true, ...results });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to search memory' });
    }
  });

  app.post('/api/memory/user', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'usr_demo_builder';
      const { key, value, type, confidence, source } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({ error: 'key and value are required' });
      }

      const mem = db.saveUserMemory({
        userId,
        type: type || 'custom_preference',
        key,
        value,
        confidence: confidence || 'high',
        source: source || 'user_explicit'
      });

      db.logMemoryEvent({
        userId,
        projectId: 'prj_default_roblox',
        memoryType: 'user',
        action: 'created',
        key,
        details: `Set user preference: ${key} = ${JSON.stringify(value)}`
      });

      res.json({ success: true, memory: mem });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save user memory' });
    }
  });

  app.delete('/api/memory/user/:key', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'usr_demo_builder';
      const { key } = req.params;

      const deleted = db.deleteUserMemory(userId, key);
      db.logMemoryEvent({
        userId,
        projectId: 'prj_default_roblox',
        memoryType: 'user',
        action: 'deleted',
        key,
        details: `Deleted user preference: ${key}`
      });

      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete user memory' });
    }
  });

  app.post('/api/memory/project', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'usr_demo_builder';
      const projectId = req.body.projectId || 'prj_default_roblox';

      const updated = db.saveProjectMemory({
        userId,
        projectId,
        ...req.body
      });

      db.logMemoryEvent({
        userId,
        projectId,
        memoryType: 'project',
        action: 'updated',
        details: 'Updated project memory parameters'
      });

      res.json({ success: true, projectMemory: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save project memory' });
    }
  });

  app.post('/api/memory/clear', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'usr_demo_builder';
      const projectId = req.body.projectId || 'prj_default_roblox';
      const scope = req.body.scope || 'all';

      if (scope === 'user' || scope === 'all') {
        const userMems = db.getUserMemories(userId);
        userMems.forEach(m => db.deleteUserMemory(userId, m.key));
      }

      db.logMemoryEvent({
        userId,
        projectId,
        memoryType: 'system',
        action: 'deleted',
        details: `Cleared memory scope: ${scope}`
      });

      res.json({ success: true, scopeCleared: scope });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to clear memory' });
    }
  });

  app.get('/api/memory/export', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || 'usr_demo_builder';
      const projectId = (req.query.projectId as string) || 'prj_default_roblox';

      const exportData = {
        exportedAt: new Date().toISOString(),
        userId,
        projectId,
        userMemories: db.getUserMemories(userId),
        projectMemory: db.getProjectMemory(userId, projectId),
        conversations: db.getConversations(userId, projectId),
        recentExecutions: db.getRecentExecutions(userId, projectId, 50),
        recentErrors: db.getRecentErrors(userId, projectId, 50)
      };

      res.json({ success: true, export: exportData });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to export memory' });
    }
  });

  // AI Chat with Project Assistant (Studio-First Execution Engine & Persistent Memory Integrated)
  app.post('/api/chat', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { messages, projectContext, projectFiles, conversationId: inputConvId, projectId: inputProjectId, executionId: inputExecId } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required.' });
      }

      const userId = req.user?.id || 'usr_demo_builder';
      const projectId = inputProjectId || 'prj_default_roblox';
      const lastMsg = messages[messages.length - 1]?.content || '';
      const lastMsgLower = lastMsg.toLowerCase();
      const executionId = inputExecId || `exec_${Date.now()}`;

      // Ensure conversation exists in DB
      let conversationId = inputConvId;
      let convRecord = conversationId ? db.getConversation(conversationId) : null;
      if (!convRecord) {
        convRecord = db.createConversation({
          userId,
          projectId,
          title: lastMsg.slice(0, 35) || 'Roblox Chat Session'
        });
        conversationId = convRecord.id;
      }

      // Persist incoming User Message in DB
      db.createMessage({
        conversationId,
        userId,
        projectId,
        role: 'user',
        content: lastMsg,
        executionId
      });

      // Emit starting events to the execution trace
      emitExecutionEvent(executionId, {
        type: 'Plan',
        message: 'Parsing conversation goal and classifying user intent...',
        status: 'running'
      });

      const isExplanationQuery = /^(what does|explain|how does|tell me about|what is|how do|show an example of)/i.test(lastMsgLower);
      const isExplicitPreview = /^(show me the code before applying|preview code only)/i.test(lastMsgLower);
      const isExecutionRequest = /(create|build|make|add|implement|modify|edit|fix|delete|remove|rename|move|sync|publish|install|apply|command|part|system|script|folder|model|remotetevent)/i.test(lastMsgLower) && !isExplanationQuery;

      if (isExecutionRequest && !isExplicitPreview) {
        // Studio-First check
        const syncState = studioWebSync.getProjectSyncState(projectId);
        const isConnected = syncState.session && syncState.session.isOnline && syncState.session.status === 'connected';

        if (!isConnected) {
          const offlineMsg = '❌ ROBLOX STUDIO OFFLINE\n\nThe WebSync Plugin is not currently connected.\n\nNo changes were made.\n\nOpen Roblox Studio and connect the Squeeze WebSync Plugin, then try again.';
          db.createMessage({
            conversationId,
            userId,
            projectId,
            role: 'assistant',
            content: offlineMsg,
            executionId
          });

          emitExecutionEvent(executionId, {
            type: 'Error',
            message: 'Roblox Studio offline. Cannot execute operation.',
            status: 'failed'
          });

          return res.json({
            success: false,
            conversationId,
            executionId,
            error: {
              code: 'STUDIO_OFFLINE',
              message: offlineMsg
            },
            studioConnectionStatus: 'DISCONNECTED',
            summary: 'Studio is offline. No changes were made.'
          });
        }
      }

      if (req.user) {
        db.incrementUserGenerations(req.user.id);
      }

      // Invoke Agent with Elite Workflow
      let response;
      if (isExecutionRequest && !isExplicitPreview) {
        emitExecutionEvent(executionId, { type: 'Plan', message: 'Generating engineering plan...', status: 'running' });
        const plan = await generateTaskPlan(new GoogleGenAI(process.env.GEMINI_API_KEY!), lastMsg, projectContext || '');
        emitExecutionEvent(executionId, { type: 'Plan', message: `Plan generated: ${plan.feature}`, status: 'completed' });
        
        // Execute
        await executeTaskPlan(projectId, plan, executionId);
        
        // Verify
        await verifyTaskPlan(projectId, plan, executionId);
        
        response = {
          message: `Successfully implemented ${plan.feature}.`,
          changePlan: plan
        };
      } else {
        response = await chatWithProjectAssistant(messages, projectContext || '', projectFiles, {
          userId,
          projectId,
          conversationId,
          executionId
        });
      } // Close the if/else for the agent workflow

      // Process files for syncing from the assistant response
      const filesToSync: { path: string; name?: string; className?: string; source: string }[] = [];
      if (response && (response.filesGenerated || response.generatedScript)) {
        if (Array.isArray(response.filesGenerated)) {
          for (const f of response.filesGenerated) {
            if (f.filePath && f.code) {
              filesToSync.push({
                path: f.filePath,
                name: f.title,
                className: f.scriptType === 'LocalScript' ? 'LocalScript' : f.scriptType === 'ModuleScript' ? 'ModuleScript' : 'Script',
                source: f.code
              });
            }
          }
        }
        if (response.generatedScript && response.generatedScript.code) {
          filesToSync.push({
            path: response.generatedScript.filePath || `src/server/${response.generatedScript.title.replace(/\s+/g, '')}.server.luau`,
            name: response.generatedScript.title,
            className: response.generatedScript.scriptType === 'LocalScript' ? 'LocalScript' : response.generatedScript.scriptType === 'ModuleScript' ? 'ModuleScript' : 'Script',
            source: response.generatedScript.code
          });
        }
      }

      // Sync if files exist
      if (filesToSync.length > 0) {
        emitExecutionEvent(executionId, { type: 'Research', message: `Syncing ${filesToSync.length} file(s) to Studio...`, status: 'running' });
        const studioSyncResult = await executeStudioPublish(projectId, filesToSync);
        
        if (studioSyncResult.success) {
          emitExecutionEvent(executionId, {
            type: 'Success',
            message: `Successfully synced ${studioSyncResult.filesSynced} file(s) to Roblox Studio.`,
            status: 'completed'
          });
        } else {
          emitExecutionEvent(executionId, {
            type: 'Warning',
            message: `Sync partially failed or warning returned from Roblox Studio: ${studioSyncResult.summary || 'Unknown warning'}`,
            status: 'completed'
          });
        }
      }

      // Also enqueue any raw operations if they exist
      const operationResults: any[] = [];
      if (response.studioOperations && Array.isArray(response.studioOperations)) {
        for (const op of response.studioOperations) {
          const typeMap: Record<string, string> = {
            createInstance: 'Create',
            deleteInstance: 'Delete',
            renameInstance: 'Rename',
            moveInstance: 'Move',
            setProperty: 'Edit',
            setAttribute: 'Edit'
          };
          emitExecutionEvent(executionId, {
            type: typeMap[op.operation] || 'Tool',
            message: `${op.operation === 'createInstance' ? 'Creating' : 'Modifying'} Instance: "${op.parentPath || 'Workspace'}/${op.name || 'Instance'}" (ClassName: ${op.className || 'Part'})`,
            status: 'running',
            metadata: {
              className: op.className,
              parentPath: op.parentPath,
              properties: op.properties
            }
          });

          const resOp = await executeStudioOperation(projectId, op);
          operationResults.push({ operation: op.operation, result: resOp });

          if (resOp && resOp.success) {
            emitExecutionEvent(executionId, {
              type: 'Success',
              message: `✓ Verified Studio operation: ${op.operation} on "${op.name || 'Instance'}"`,
              status: 'completed'
            });
          } else {
            emitExecutionEvent(executionId, {
              type: 'Error',
              message: `❌ Studio operation failed: ${op.operation} on "${op.name || 'Instance'}"`,
              status: 'failed'
            });
          }
        }
      }

      // Concluding Success event
      emitExecutionEvent(executionId, {
        type: 'Success',
        message: 'Completed code generation and verified environment integrity.',
        status: 'completed'
      });

      // Persist Assistant Message in DB
      const assistantMsg = db.createMessage({
        conversationId,
        userId,
        projectId,
        role: 'assistant',
        content: response.message || 'Execution complete.',
        thinkingSteps: response.thinkingSteps,
        changePlan: response.changePlan,
        codeReview: response.codeReview,
        actionPerformed: response.actionPerformed,
        filesGenerated: response.filesGenerated,
        suggestedPrompts: response.suggestedPrompts,
        executionId,
        executionDetails: {
          studioSyncResult,
          operationResults
        }
      });

      res.json({ success: true, conversationId, messageRecord: assistantMsg, ...response, studioSyncResult, operationResults });
    } catch (err: any) {
      console.error('Error in /api/chat:', err);
      res.status(500).json({ error: err.message || 'Chat assistant encountered an error.' });
    }
  });

  // -------------------------------------------------------------
  // REAL-TIME AGENT EXECUTION EVENT STREAM (SSE)
  // -------------------------------------------------------------
  app.get('/api/agent/executions/:id/stream', (req, res) => {
    const executionId = req.params.id;
    if (!executionId) {
      return res.status(400).json({ error: 'Execution ID is required.' });
    }

    // Establish Server-Sent Events connection
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now(), executionId })}\n\n`);

    // Flush any existing logs for late-joining or reconnecting streams
    const existingHistory = getExecutionHistory(executionId);
    for (const event of existingHistory) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Subscribe to the global Event Bus
    const eventName = `event:${executionId}`;
    const handleEvent = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    executionEventBus.on(eventName, handleEvent);

    // Keep connection alive with heartbeat interval
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      executionEventBus.off(eventName, handleEvent);
    });
  });

  app.get('/api/agent/executions/:id/history', (req, res) => {
    const executionId = req.params.id;
    if (!executionId) {
      return res.status(400).json({ error: 'Execution ID is required.' });
    }
    res.json({ success: true, history: getExecutionHistory(executionId) });
  });

  // -------------------------------------------------------------
  // ROBLOX SKILLS & ENGINE KNOWLEDGE SEARCH
  // -------------------------------------------------------------

  app.get('/api/roblox-skills', (req, res) => {
    const query = req.query.q as string;
    if (query) {
      const results = searchRobloxSkills(query);
      return res.json({ success: true, skills: results });
    }
    res.json({ success: true, skills: ROBLOX_SKILLS_DATABASE });
  });

  app.post('/api/roblox-skills/search', (req, res) => {
    const { query } = req.body;
    const results = searchRobloxSkills(query || '');
    res.json({ success: true, skills: results });
  });

  // -------------------------------------------------------------
  // SCRIPTS MANAGEMENT
  // -------------------------------------------------------------

  app.get('/api/scripts', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    const search = req.query.search as string;
    const userId = req.user ? req.user.id : undefined;
    const scripts = db.getScripts(userId, search);
    res.json({ scripts });
  });

  app.get('/api/scripts/:id', (req, res) => {
    const script = db.getScriptById(req.params.id);
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }
    res.json({ script });
  });

  app.delete('/api/scripts/:id', requireAuthMiddleware, (req: AuthenticatedRequest, res) => {
    const success = db.deleteScript(req.params.id, req.user!.id);
    res.json({ success });
  });

  app.post('/api/scripts/:id/favorite', requireAuthMiddleware, (req: AuthenticatedRequest, res) => {
    const isFavorite = db.toggleFavorite(req.params.id, req.user!.id);
    res.json({ success: true, isFavorite });
  });

  // -------------------------------------------------------------
  // NEWSLETTER / EMAIL CAPTURE
  // -------------------------------------------------------------

  app.post('/api/newsletter/subscribe', (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      const subscriber = db.addSubscriber(email, 'landing_form');
      
      res.json({
        success: true,
        message: `✓ You're in! We've registered ${subscriber.email} for Squeeze beta announcements and Luau tips.`,
        subscriber: { id: subscriber.id, email: subscriber.email },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Subscription failed.' });
    }
  });

  // -------------------------------------------------------------
  // STRIPE & BILLING
  // -------------------------------------------------------------

  app.post('/api/stripe/checkout', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { planId, returnUrl } = req.body;
      if (planId !== 'pro' && planId !== 'studio' && planId !== 'free') {
        return res.status(400).json({ error: 'Invalid plan selected.' });
      }

      const user = req.user!;
      if (planId === 'free') {
        db.updateUser(user.id, { plan: 'free', monthlyLimit: 25 });
        return res.json({ success: true, plan: PLANS.free, message: 'Switched to free plan.' });
      }

      const result = await createCheckoutSession(user, planId, returnUrl || '/');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Checkout creation failed.' });
    }
  });

  app.post('/api/stripe/simulate-plan', requireAuthMiddleware, (req: AuthenticatedRequest, res) => {
    const { planId } = req.body;
    const targetPlan = PLANS[planId as keyof typeof PLANS] || PLANS.pro;
    const user = db.updateUser(req.user!.id, {
      plan: planId as any,
      monthlyLimit: targetPlan.limit,
      planStatus: 'active',
    });
    res.json({ success: true, user, plan: targetPlan });
  });

  app.post('/api/stripe/webhook', (req, res) => {
    const signature = req.headers['stripe-signature'] as string;
    const result = handleStripeWebhook(req.body, signature);
    res.json(result);
  });

  // -------------------------------------------------------------
  // API KEYS & ROBLOX STUDIO PLUGIN CONNECTOR
  // -------------------------------------------------------------

  app.get('/api/api-keys', requireAuthMiddleware, (req: AuthenticatedRequest, res) => {
    const keys = db.getApiKeys(req.user!.id);
    res.json({ keys });
  });

  app.post('/api/api-keys', requireAuthMiddleware, (req: AuthenticatedRequest, res) => {
    const { name } = req.body;
    const key = db.createApiKey(req.user!.id, name);
    res.json({ key });
  });

  // -------------------------------------------------------------
  // REAL-TIME ROBLOX STUDIO WEBSYNC API (CANONICAL /api/studio & /api/sync)
  // -------------------------------------------------------------

  // 0. Studio Auto-Connect Endpoint (Zero-Pairing Instant Handshake)
  const handleAutoConnect = (req: AuthenticatedRequest, res: any) => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const existingToken = authHeader.replace(/^Bearer\s+/i, '') || req.body.token || req.body.userToken;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;

      const { placeId, universeId, placeName, pluginVersion, projectId } = req.body;

      const result = studioWebSync.autoConnectPlugin({
        placeId: placeId ? Number(placeId) : undefined,
        universeId: universeId ? Number(universeId) : undefined,
        placeName: placeName || 'Roblox Studio Place',
        pluginVersion: pluginVersion || '5.0.0',
        projectId: projectId || 'prj_default_roblox',
        userId: req.user?.id,
        existingToken,
        clientIp
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'AUTO_CONNECT_FAILED', message: err.message || 'Auto connect failed.' }
      });
    }
  };

  app.post('/api/studio/auto-connect', optionalAuthMiddleware, handleAutoConnect);
  app.post('/api/sync/auto-connect', optionalAuthMiddleware, handleAutoConnect);

  // Health Check
  app.get(['/api/studio/health', '/api/sync/health'], (req, res) => {
    res.json({
      success: true,
      service: 'studio-websync',
      version: '5.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Live Studio Status Endpoint (Real-Time Detection)
  app.get(['/api/studio/status', '/api/studio/status/live'], optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const projectId = (req.query.projectId as string) || 'prj_default_roblox';
      const state = studioWebSync.getProjectSyncState(projectId);
      const isConnected = state.session && state.session.isOnline;

      res.json({
        success: true,
        connected: isConnected,
        status: isConnected ? 'Connected' : (state.session ? state.session.status : 'Offline'),
        projectId: state.session?.projectId || projectId,
        projectName: state.session?.projectName || 'Roblox Project',
        placeId: state.session?.placeId,
        universeId: state.session?.universeId,
        pluginVersion: state.session?.pluginVersion || '5.0.0',
        lastHeartbeat: state.session?.lastHeartbeat ? new Date(state.session.lastHeartbeat).toISOString() : null,
        pendingChangesCount: state.pendingChangesCount,
        filesCount: state.filesCount
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'STATUS_FAILED', message: err.message } });
    }
  });

  // Sync-All Endpoint (Force poll/flush all changes)
  const handleSyncAll = (req: any, res: any) => {
    try {
      const projectId = (req.body.projectId as string) || (req.query.projectId as string) || 'prj_default_roblox';
      const pendingChanges = db.getStudioPendingChanges(projectId, 'studio');
      res.json({
        success: true,
        appliedCount: 0,
        pendingCount: pendingChanges.length,
        changes: pendingChanges
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SYNC_ALL_FAILED', message: err.message } });
    }
  };

  app.post(['/api/studio/sync-all', '/api/sync/sync-all'], handleSyncAll);
  app.get(['/api/studio/sync-all', '/api/sync/sync-all'], handleSyncAll);

  // 1. Session Initialization (from Website UI)
  const handleCreateSession = (req: AuthenticatedRequest, res: any) => {
    try {
      const { projectId, projectName } = req.body;
      const pid = projectId || 'prj_default_roblox';
      const userId = req.user?.id;
      const result = studioWebSync.createPairingSession(pid, projectName || 'Roblox Project', userId);
      res.json({
        success: true,
        pairingCode: result.pairingCode,
        token: result.token,
        session: result.session
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SESSION_CREATE_FAILED', message: err.message || 'Failed to create pairing session.' } });
    }
  };

  app.post('/api/studio/session/create', optionalAuthMiddleware, handleCreateSession);
  app.post('/api/sync/create-session', optionalAuthMiddleware, handleCreateSession);

  // 2. Query Project Sync Status (Session, connected status, conflicts, changes, files, tree)
  const handleGetStatus = (req: AuthenticatedRequest, res: any) => {
    try {
      const projectId = (req.query.projectId as string) || 'prj_default_roblox';
      const state = studioWebSync.getProjectSyncState(projectId);
      res.json({ success: true, ...state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'GET_STATUS_FAILED', message: err.message || 'Failed to retrieve sync state.' } });
    }
  };

  app.get('/api/studio/session/status', optionalAuthMiddleware, handleGetStatus);
  app.get('/api/sync/status', optionalAuthMiddleware, handleGetStatus);

  // 3. Studio Plugin Pairing Endpoint (Studio Plugin -> Backend)
  const handlePair = (req: any, res: any) => {
    try {
      const { pairingCode, placeId, placeName, universeId, pluginVersion } = req.body;
      if (!pairingCode) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_PAIRING_CODE', message: 'Pairing code is required.' } });
      }
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
      const result = studioWebSync.pairPlugin(pairingCode, { placeId, placeName, universeId, pluginVersion }, clientIp);
      if (!result.success) {
        return res.status(401).json({ success: false, error: { code: 'PAIRING_REJECTED', message: result.error || 'Pairing failed' } });
      }
      res.json({
        success: true,
        token: result.token,
        sessionId: result.sessionId,
        projectId: result.projectId,
        projectName: result.projectName,
        session: result.session
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'PAIR_ERROR', message: err.message || 'Plugin pairing failed.' } });
    }
  };

  app.post('/api/studio/pair', handlePair);
  app.post('/api/sync/pair', handlePair);

  // 4. Studio Direct Connect Endpoint
  app.post('/api/studio/connect', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const { projectId, projectName, placeId, universeId, placeName, pluginVersion, token } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
      const result = studioWebSync.connectPluginDirect({
        projectId: projectId || 'prj_default_roblox',
        projectName: projectName || 'Roblox Game',
        placeId,
        universeId,
        placeName,
        pluginVersion,
        token,
        userId: req.user?.id,
        clientIp
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'CONNECT_FAILED', message: err.message || 'Direct connect failed.' } });
    }
  });

  // 5. Studio Disconnect Endpoint
  const handleDisconnect = (req: any, res: any) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || (req.body.token as string);
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authorization token required.' } });
    }
    const { reason } = req.body;
    const result = studioWebSync.disconnectSession(token, reason || 'Plugin closed');
    res.json(result);
  };

  app.post('/api/studio/disconnect', handleDisconnect);
  app.post('/api/sync/disconnect', handleDisconnect);

  // 6. Studio Heartbeat Endpoint
  const handleHeartbeat = (req: any, res: any) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || (req.body.token as string);
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authorization token required.' } });
    }
    const { placeId, placeName, universeId, pluginVersion } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
    const result = studioWebSync.processHeartbeat(token, { placeId, placeName, universeId, pluginVersion, clientIp });
    if (!result.success) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: result.error || 'Invalid session token' } });
    }
    res.json(result);
  };

  app.post('/api/studio/heartbeat', handleHeartbeat);
  app.post('/api/sync/heartbeat', handleHeartbeat);

  // 7. Save / Push File Change (Bidirectional Website / AI / Studio)
  const handlePushFile = (req: AuthenticatedRequest, res: any) => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '') || (req.body.token as string);
      
      let author = req.body.author || 'website';
      let projectId = req.body.projectId || 'prj_default_roblox';
      let sessionId: string | undefined;

      if (token) {
        const session = studioWebSync.getSession(token);
        if (session) {
          projectId = session.projectId;
          sessionId = session.sessionId;
          if (!req.body.author) author = 'studio';
        }
      }

      const fileData = req.body.file || req.body;
      if (!fileData || !fileData.path || fileData.source === undefined) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_FILE_FIELDS', message: 'File path and source are required.' } });
      }

      const result = studioWebSync.saveFileChange(
        projectId, 
        {
          id: fileData.id,
          path: fileData.path,
          name: fileData.name,
          className: fileData.className,
          source: fileData.source,
          expectedVersion: fileData.expectedVersion
        }, 
        author,
        sessionId
      );

      if (result.status === 'conflict') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'VERSION_CONFLICT',
            message: result.error || 'Studio contains a newer version.',
            expectedVersion: result.expectedVersion,
            currentVersion: result.currentVersion
          },
          conflict: result.conflict
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'FILE_PUSH_FAILED', message: err.message || 'Failed to push file sync.' } });
    }
  };

  app.post('/api/studio/files/push', optionalAuthMiddleware, handlePushFile);
  app.post('/api/sync/save-file', optionalAuthMiddleware, handlePushFile);
  app.post('/api/sync/studio-change', optionalAuthMiddleware, handlePushFile);

  // 8. Pull Pending Changes (Studio Plugin -> Pull)
  const handlePullChanges = (req: any, res: any) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || (req.query.token as string);
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authorization token required.' } });
    }
    const result = studioWebSync.getPendingChangesForStudio(token);
    if (!result.success) {
      return res.status(401).json({ success: false, error: { code: 'PULL_UNAUTHORIZED', message: result.error || 'Unauthorized' } });
    }
    res.json(result);
  };

  app.get('/api/studio/files/pull', handlePullChanges);
  app.get('/api/sync/pull', handlePullChanges);

  // 9. Acknowledge Change Event (Studio confirms applied or error)
  const handleAck = (req: any, res: any) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || (req.body.token as string);
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authorization token required.' } });
    }
    const changeId = req.body.operationId || req.body.changeId || req.body.eventId;
    const { status, errorMessage } = req.body;
    if (!changeId) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_CHANGE_ID', message: 'changeId or eventId required.' } });
    }
    const result = studioWebSync.acknowledgeChange(token, changeId, status || 'applied', errorMessage);
    res.json(result);
  };

  app.post('/api/studio/ack', handleAck);
  app.post('/api/sync/ack', handleAck);
  app.post('/api/studio/operations/ack', handleAck);

  const handlePullOperations = (req: any, res: any) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || (req.query.token as string);
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authorization token required.' } });
    }
    const result = studioWebSync.getPendingChangesForStudio(token);
    res.json(result);
  };

  app.get('/api/studio/operations/pending', handlePullOperations);

  // 10. Project Snapshot & DataModel Dump
  const handleSnapshot = (req: any, res: any) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || (req.body.token as string);
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authorization token required.' } });
    }
    const { tree, instances, scriptFiles } = req.body;
    const result = studioWebSync.receiveStudioSnapshot(token, { tree, instances, scriptFiles });
    res.json(result);
  };

  app.post('/api/studio/project/snapshot', handleSnapshot);
  app.post('/api/sync/tree-sync', handleSnapshot);

  // 11. Resolve Sync Conflicts
  const handleResolveConflict = (req: AuthenticatedRequest, res: any) => {
    try {
      const { projectId, conflictId, resolution, mergedSource } = req.body;
      if (!conflictId || !resolution) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_CONFLICT_PARAMS', message: 'conflictId and resolution strategy are required.' } });
      }
      const pid = projectId || 'prj_default_roblox';
      const result = studioWebSync.resolveConflict(pid, conflictId, resolution, mergedSource, req.user?.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'CONFLICT_RESOLVE_FAILED', message: err.message || 'Failed to resolve conflict.' } });
    }
  };

  app.post('/api/studio/conflicts/resolve', optionalAuthMiddleware, handleResolveConflict);
  app.post('/api/sync/resolve-conflict', optionalAuthMiddleware, handleResolveConflict);

  // 12. Audit Logs API
  app.get('/api/studio/audit-logs', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const projectId = (req.query.projectId as string) || 'prj_default_roblox';
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const logs = db.getStudioAuditLogs(projectId, limit);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'AUDIT_LOG_FAILED', message: err.message } });
    }
  });

  // 13. Studio Plugin Source Code download
  const handlePluginSource = (req: any, res: any) => {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const origin = `${proto}://${host}`;
    
    // Replace the default localhost backend URL with the actual deployment URL
    const customizedSource = OFFICIAL_ROBLOX_STUDIO_PLUGIN_SOURCE.replace(
      /local DEFAULT_BACKEND_URL = ".*"/,
      `local DEFAULT_BACKEND_URL = "${origin}/api/studio"`
    );

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(customizedSource);
  };

  app.get('/api/studio/plugin-source', handlePluginSource);
  app.get('/api/sync/plugin-source', handlePluginSource);

  // 14. Studio Info & Specs
  app.get(['/api/studio/info', '/api/studio-plugin/info'], (req, res) => {
    res.json({
      name: "Squeeze Studio Companion",
      version: "2.5.0",
      description: "Roblox Studio companion plugin connecting your Studio DataModel directly to Squeeze AI Agent and Web IDE.",
      protocolVersion: "2.0",
      capabilities: [
        "Bidirectional script syncing",
        "Explorer DataModel tree hierarchy snapshot",
        "Optimistic concurrency & conflict resolution",
        "Monotonic version hashing (SHA-256)",
        "ChangeHistoryService automatic undo/redo waypoints",
        "Server-authoritative heartbeat health checks"
      ],
      endpoints: {
        pair: "/api/studio/pair",
        connect: "/api/studio/connect",
        disconnect: "/api/studio/disconnect",
        heartbeat: "/api/studio/heartbeat",
        pushFile: "/api/studio/files/push",
        pullFiles: "/api/studio/files/pull",
        snapshot: "/api/studio/project/snapshot",
        ack: "/api/studio/ack",
        pluginSource: "/api/studio/plugin-source"
      }
    });
  });

  // -------------------------------------------------------------
  // DAILY REWARDS (Server-Authoritative API)
  // -------------------------------------------------------------

  const BASE_SLOT_DEFS = [
    { day: 1, gold: 100, gems: 10, isVip: false, title: "Day 1 Supply Crate", description: "Starter coin stash and crystal gems.", icon: "🪙", multiplier: 1.0 },
    { day: 2, gold: 150, gems: 15, isVip: false, title: "Day 2 Explorer Pouch", description: "Expanded explorer supplies and bonus gems.", icon: "💰", multiplier: 1.25 },
    { day: 3, gold: 250, gems: 25, isVip: false, title: "Day 3 Silver Chest", description: "Silver cache with boosted tier multiplier.", icon: "💎", multiplier: 1.5 },
    { day: 4, gold: 400, gems: 35, isVip: false, title: "Day 4 Golden Cache", description: "High-tier builder tokens and gold reserve.", icon: "🏆", multiplier: 1.75 },
    { day: 5, gold: 600, gems: 50, isVip: false, title: "Day 5 Diamond Safe", description: "Rare crystal cache for advanced place assets.", icon: "🔷", multiplier: 2.0 },
    { day: 6, gold: 900, gems: 75, isVip: false, title: "Day 6 Grand Treasury", description: "Heavy coin hoard with 2.5x streak scaling.", icon: "👑", multiplier: 2.5 },
    { day: 7, gold: 1500, gems: 120, isVip: true, vipBadgeTitle: "VIP Crown Badge", title: "Day 7 Grand VIP Vault", description: "Ultimate reward with VIP Crown status & 3.0x multiplier!", icon: "🌟", multiplier: 3.0 },
  ];

  const buildSlotsWithStatus = (record: any, isEligible: boolean) => {
    const nextDay = (record.lastClaimedDay >= 7 || record.currentStreak === 0) ? 1 : (record.lastClaimedDay + 1);

    return BASE_SLOT_DEFS.map((slot) => {
      let status: 'claimed' | 'available' | 'waiting' | 'locked' = 'locked';

      if (record.currentStreak > 0 && slot.day <= record.lastClaimedDay) {
        status = 'claimed';
      } else if (slot.day === nextDay) {
        status = isEligible ? 'available' : 'waiting';
      } else {
        status = 'locked';
      }

      const finalGold = Math.round(slot.gold * slot.multiplier);
      const finalGems = Math.round(slot.gems * slot.multiplier);

      return {
        ...slot,
        status,
        finalGold,
        finalGems,
      };
    });
  };

  app.get('/api/daily-rewards/status', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user ? req.user.id : 'usr_demo_builder';
      const record = db.getDailyRewards(userId);
      const now = Date.now();
      const COOLDOWN_MS = 24 * 60 * 60 * 1000;
      const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

      let eligible = true;
      let timeRemaining = 0;
      let nextAvailableTimestamp = now;

      if (record.lastClaimTimestamp > 0) {
        const elapsed = now - record.lastClaimTimestamp;
        if (elapsed < COOLDOWN_MS) {
          eligible = false;
          timeRemaining = Math.max(0, Math.ceil((COOLDOWN_MS - elapsed) / 1000));
          nextAvailableTimestamp = record.lastClaimTimestamp + COOLDOWN_MS;
        }
      }

      const streakWillReset = record.lastClaimTimestamp > 0 && (now - record.lastClaimTimestamp) > (GRACE_PERIOD_MS - 2 * 3600 * 1000);
      const nextDay = (record.lastClaimedDay >= 7 || record.currentStreak === 0) ? 1 : (record.lastClaimedDay + 1);
      const targetSlot = BASE_SLOT_DEFS.find(s => s.day === nextDay);
      const currentMultiplier = targetSlot ? targetSlot.multiplier : 1.0;

      const slots = buildSlotsWithStatus(record, eligible);

      res.json({
        success: true,
        eligible,
        timeRemaining,
        nextAvailableTimestamp,
        cooldownSeconds: 24 * 60 * 60,
        gracePeriodSeconds: 48 * 60 * 60,
        currentStreak: record.currentStreak,
        longestStreak: record.longestStreak,
        totalClaims: record.totalClaims,
        lastClaimedDay: record.lastClaimedDay,
        nextDay,
        currentMultiplier,
        streakWillReset,
        userBalances: {
          coins: record.coins,
          gems: record.gems,
        },
        hasClaimedVIP: record.hasClaimedVIP,
        slots,
        serverTime: now,
      });
    } catch (err: any) {
      console.error('Error fetching daily rewards status:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch daily rewards.' });
    }
  });

  app.post('/api/daily-rewards/claim', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user ? req.user.id : 'usr_demo_builder';
      const claimResult = db.claimDailyReward(userId);

      if (!claimResult.success) {
        return res.status(400).json({
          success: false,
          error: claimResult.error || 'Daily reward is currently on cooldown.',
        });
      }

      const COOLDOWN_MS = 24 * 60 * 60 * 1000;
      const nextAvailableTimestamp = claimResult.record.lastClaimTimestamp + COOLDOWN_MS;
      const slots = buildSlotsWithStatus(claimResult.record, false);

      res.json({
        success: true,
        message: `Claimed Day ${claimResult.claimedDay} Reward! +${claimResult.grantedGold} Gold, +${claimResult.grantedGems} Gems${claimResult.grantedVIP ? ', and VIP Crown Badge unlocked!' : '!' }`,
        claimedDay: claimResult.claimedDay,
        grantedGold: claimResult.grantedGold,
        grantedGems: claimResult.grantedGems,
        grantedVIP: claimResult.grantedVIP,
        newStreak: claimResult.record.currentStreak,
        longestStreak: claimResult.record.longestStreak,
        multiplier: claimResult.multiplier,
        nextAvailableTimestamp,
        userBalances: {
          coins: claimResult.record.coins,
          gems: claimResult.record.gems,
        },
        slots,
      });
    } catch (err: any) {
      console.error('Error claiming daily reward:', err);
      res.status(500).json({ error: err.message || 'Failed to claim daily reward.' });
    }
  });

  // Developer Simulation & Fast-Forward Tool for Testing
  app.post('/api/daily-rewards/simulate-cooldown', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user ? req.user.id : 'usr_demo_builder';
      const { hours = 24 } = req.body;
      const record = db.resetDailyRewardCooldown(userId, Number(hours) || 24);
      const slots = buildSlotsWithStatus(record, true);

      res.json({
        success: true,
        message: `Fast-forwarded cooldown by ${hours} hours. Rewards are now claimable!`,
        record,
        slots,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to simulate cooldown.' });
    }
  });

  app.post('/api/daily-rewards/reset-streak', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user ? req.user.id : 'usr_demo_builder';
      const record = db.resetDailyRewardStreak(userId);
      const slots = buildSlotsWithStatus(record, true);

      res.json({
        success: true,
        message: 'Daily rewards streak reset to Day 1.',
        record,
        slots,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reset streak.' });
    }
  });

  // 404 Catch-All for /api/* routes (Ensures API requests NEVER return HTML pages)
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API endpoint ${req.method} ${req.path} not found.`
      }
    });
  });

  // Global Express JSON Error Handler (Prevents HTML 500 pages)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express global error caught:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      success: false
    });
  });

  return app;
}
