import { createExpressApp } from '../server/app.js';

const app = createExpressApp();

app.get('/debug/env', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || 'MISSING',
    serviceRoleKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY 
      ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 7) + '...' 
      : 'MISSING',
    anonKeyPrefix: process.env.SUPABASE_ANON_KEY 
      ? process.env.SUPABASE_ANON_KEY.substring(0, 7) + '...' 
      : 'MISSING',
  });
});

export default app;
