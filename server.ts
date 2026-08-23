import dotenv from 'dotenv';
dotenv.config({ override: true });

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
    
    // Serve static assets with long-term immutable caching to minimize Origin Transfer
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          // HTML shell must revalidate to pick up latest builds immediately
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (filePath.match(/\.(js|css|woff2?|png|jpe?g|gif|svg|ico|webp)$/i)) {
          // Fingerprinted static assets cache at edge and browser for 1 year
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));

    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
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
