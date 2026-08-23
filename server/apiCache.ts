import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface CacheEntry {
  body: any;
  contentType: string;
  etag: string;
  expiresAt: number;
}

class MemoryApiCache {
  private cache = new Map<string, CacheEntry>();

  public get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry;
  }

  public set(key: string, body: any, contentType: string, ttlSeconds: number): string {
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    const etag = `"${crypto.createHash('md5').update(serialized).digest('hex')}"`;
    const expiresAt = Date.now() + (ttlSeconds * 1000);

    this.cache.set(key, {
      body,
      contentType,
      etag,
      expiresAt
    });

    return etag;
  }

  public invalidate(pattern?: string | RegExp) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const apiMemoryCache = new MemoryApiCache();

/**
 * Helper to apply standardized Edge/CDN and Browser Cache-Control headers
 */
export function setCacheHeaders(
  res: Response,
  options: {
    browserMaxAge?: number; // seconds
    sMaxAge?: number; // Edge CDN seconds
    staleWhileRevalidate?: number; // SWR seconds
    isPublic?: boolean;
    immutable?: boolean;
  }
) {
  const {
    browserMaxAge = 0,
    sMaxAge = 3600,
    staleWhileRevalidate = 86400,
    isPublic = true,
    immutable = false
  } = options;

  const parts: string[] = [];
  if (isPublic) {
    parts.push('public');
  } else {
    parts.push('private');
  }

  if (browserMaxAge > 0) {
    parts.push(`max-age=${browserMaxAge}`);
  } else {
    parts.push('max-age=0');
  }

  if (sMaxAge > 0) {
    parts.push(`s-maxage=${sMaxAge}`);
  }

  if (staleWhileRevalidate > 0) {
    parts.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  if (immutable) {
    parts.push('immutable');
  }

  res.setHeader('Cache-Control', parts.join(', '));
}

/**
 * In-memory caching middleware for static or semi-static read-heavy API routes
 */
export function createCachedEndpointMiddleware(options: {
  memoryTtlSeconds: number; // in-memory server TTL
  cdnSMaxAgeSeconds?: number; // CDN / Vercel Edge s-maxage
  staleWhileRevalidateSeconds?: number;
  keyGenerator?: (req: Request) => string;
}) {
  const {
    memoryTtlSeconds,
    cdnSMaxAgeSeconds = 3600,
    staleWhileRevalidateSeconds = 86400,
    keyGenerator = (req: Request) => `${req.method}:${req.originalUrl || req.url}`
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET or HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const key = keyGenerator(req);
    const cached = apiMemoryCache.get(key);

    // Apply CDN headers
    setCacheHeaders(res, {
      browserMaxAge: 300, // 5 min browser cache
      sMaxAge: cdnSMaxAgeSeconds,
      staleWhileRevalidate: staleWhileRevalidateSeconds,
      isPublic: true
    });

    if (cached) {
      res.setHeader('ETag', cached.etag);
      res.setHeader('X-Cache-Status', 'HIT-MEMORY');

      // Check conditional ETag match
      const clientIfNoneMatch = req.headers['if-none-match'];
      if (clientIfNoneMatch === cached.etag) {
        return res.status(304).end();
      }

      res.setHeader('Content-Type', cached.contentType);
      return res.send(cached.body);
    }

    res.setHeader('X-Cache-Status', 'MISS');

    // Intercept res.send / res.json to cache response
    const originalSend = res.send.bind(res);
    res.send = (body: any): Response => {
      // Only cache successful 200 responses
      if (res.statusCode === 200) {
        const contentType = res.getHeader('Content-Type') as string || 'application/json; charset=utf-8';
        const etag = apiMemoryCache.set(key, body, contentType, memoryTtlSeconds);
        res.setHeader('ETag', etag);
      }
      return originalSend(body);
    };

    next();
  };
}
