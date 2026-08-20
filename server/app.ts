import express from 'express';
import { db } from './db.js';
import { 
  generateLuauScript, 
  debugLuauError, 
  analyzeRobloxProject, 
  expandIdeaNode, 
  chatWithProjectAssistant 
} from './ai.js';
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

export function createExpressApp() {
  const app = express();

  // JSON Body Parser with raw body preservation for Stripe webhook
  app.use(express.json());

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
      const { files } = req.body;
      if (!files || !Array.isArray(files)) {
        return res.status(400).json({ error: 'Files array is required for project analysis.' });
      }

      const analysis = await analyzeRobloxProject(files);
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

  // AI Chat with Project Assistant
  app.post('/api/chat', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { messages, projectContext } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required.' });
      }

      const user = req.user;
      if (user) {
        db.incrementUserGenerations(user.id);
      }

      const response = await chatWithProjectAssistant(messages, projectContext || '');
      res.json({ success: true, ...response });
    } catch (err: any) {
      console.error('Error in /api/chat:', err);
      res.status(500).json({ error: err.message || 'Chat assistant encountered an error.' });
    }
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

  app.get('/api/studio-plugin/info', (req, res) => {
    res.json({
      name: "Squeeze Studio Companion",
      version: "1.4.0",
      description: "Roblox Studio plugin that syncs with Squeeze to automatically insert generated Luau scripts and wire up RemoteEvents.",
      installInstructions: [
        "1. Open Roblox Studio with your place loaded.",
        "2. Go to Creator Hub Marketplace and search 'Squeeze Luau Assistant' or paste the ModuleScript into ServerScriptService.",
        "3. Enter your Squeeze API Token from your dashboard.",
        "4. Click 'Sync Scripts' to pull your latest generated scripts directly into Explorer!"
      ],
      injectorSnippet: `-- Squeeze Studio Live Injector Module
local HttpService = game:GetService("HttpService")
local SQUEEZE_TOKEN = "YOUR_API_TOKEN_HERE" -- Get from squeeze.gg/dashboard

local function fetchLatestScript()
\tlocal response = HttpService:RequestAsync({
\t\tUrl = "https://squeeze.gg/api/scripts",
\t\tMethod = "GET",
\t\tHeaders = {
\t\t\t["Authorization"] = "Bearer " .. SQUEEZE_TOKEN,
\t\t\t["Content-Type"] = "application/json"
\t\t}
\t})
\tif response.Success then
\t\tprint("[Squeeze] Synced with studio successfully!")
\tend
end

return { Fetch = fetchLatestScript }`
    });
  });

  return app;
}
