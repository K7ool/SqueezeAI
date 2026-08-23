/**
 * Health Check Endpoint with Real Database Status
 */

import { Router } from 'express';
import { getConfigStatus, testDatabaseConnection } from './lib/supabaseClient.js';
import { modelRegistry } from './modelRegistry.js';

const router = Router();

/**
 * Basic health check
 */
router.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Squeeze AI Platform',
    version: '1.5.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Detailed health check with database status
 */
router.get('/api/health/detailed', async (req, res) => {
  const supabaseConfig = getConfigStatus();
  const dbTest = supabaseConfig.configured
    ? await testDatabaseConnection()
    : { healthy: false, error: 'Supabase not configured' };

  const hasGeminiKey = !!process.env.GEMINI_API_KEY?.trim();

  const overall = supabaseConfig.configured && dbTest.healthy && hasGeminiKey
    ? 'healthy'
    : 'degraded';

  res.json({
    status: overall,
    service: 'Squeeze AI Platform',
    version: '1.5.0',
    timestamp: new Date().toISOString(),
    components: {
      database: {
        status: dbTest.healthy ? 'healthy' : 'unhealthy',
        configured: supabaseConfig.configured,
        url: supabaseConfig.url || 'not configured',
        latencyMs: dbTest.latencyMs,
        error: dbTest.error
      },
      ai: {
        status: hasGeminiKey ? 'healthy' : 'unavailable',
        provider: 'gemini',
        configured: hasGeminiKey
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        platform: process.env.VERCEL ? 'vercel' : 'standalone'
      }
    }
  });
});

/**
 * AI Model Registry Health
 */
router.get('/api/health/ai', (req, res) => {
  const report = modelRegistry.getHealthReport();
  res.json({
    service: 'Squeeze AI Model Registry',
    timestamp: new Date().toISOString(),
    ...report
  });
});

export default router;
