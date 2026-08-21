import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './server/app.js';
import { initializeSupabaseCache } from './server/db.js';

async function startServer() {
  const app = createExpressApp();
  const PORT = 3000;

  // -------------------------------------------------------------
  // VITE MIDDLEWARE (DEV) & STATIC FALLBACK (PROD)
  // -------------------------------------------------------------

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍋 Squeeze Server listening on http://0.0.0.0:${PORT}`);
    
    // Initialize and hydrate our server-side memory cache with Supabase persistent data in the background
    initializeSupabaseCache().catch(err => {
      console.warn('⚠️ Error during background Supabase cache initialization:', err);
    });
  });
}

startServer();
