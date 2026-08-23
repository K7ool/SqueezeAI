import { Request, Response, NextFunction } from 'express';
import { trafficMonitor } from './trafficMonitor.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Known aggressive bots and scrapers that trigger unnecessary heavy origin requests
const AGGRESSIVE_SCRAPER_PATTERNS = [
  /bytespider/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /dotbot/i,
  /mj12bot/i,
  /megaindex/i,
  /blexbot/i,
  /zoominfobot/i,
  /dataforseobot/i,
  /seekport/i,
  /turnitinbot/i,
  /petalbot/i,
  /censysinspect/i,
  /screaming frog/i,
  /python-requests/i,
  /go-http-client/i,
  /aiohttp/i,
  /scrapy/i
];

/**
 * In-memory sliding rate limiter store with automatic garbage collection
 */
class InMemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();

  constructor() {
    // Run cleanup every 2 minutes
    setInterval(() => this.cleanup(), 120000);
  }

  public check(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetMs: windowMs };
    }

    if (record.count >= limit) {
      return { allowed: false, remaining: 0, resetMs: record.resetTime - now };
    }

    record.count++;
    return { allowed: true, remaining: limit - record.count, resetMs: record.resetTime - now };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimiterStore = new InMemoryRateLimiter();

/**
 * Factory for creating express rate limit middlewares
 */
export function createRateLimiter(options: {
  windowMs: number; // e.g. 60,000 (1 min)
  maxRequests: number; // max requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please slow down.',
    keyGenerator = (req: Request) => {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      return token ? `auth:${token.slice(0, 16)}` : `ip:${ip}`;
    },
    skip = () => false
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip(req)) return next();

    const key = `${req.baseUrl || ''}${req.path}:${keyGenerator(req)}`;
    const result = rateLimiterStore.check(key, maxRequests, windowMs);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetMs / 1000));

    if (!result.allowed) {
      trafficMonitor.recordRateLimit();
      res.setHeader('Retry-After', Math.ceil(result.resetMs / 1000));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfterSeconds: Math.ceil(result.resetMs / 1000)
        }
      });
    }

    next();
  };
}

/**
 * Bot protection middleware:
 * - Detects abusive scraping bots and rejects non-essential origin endpoints
 * - Protects high-compute and heavy routes from automated scrapers
 */
export function botProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  const userAgent = (req.headers['user-agent'] || '').trim();

  // Allow empty or browser user agents for normal users
  if (!userAgent) {
    // Missing user-agent on POST /api/chat or heavy endpoints is suspicious
    if (req.method === 'POST' && req.path.startsWith('/api/')) {
      trafficMonitor.recordBotBlock();
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CLIENT', message: 'User-Agent header required.' }
      });
    }
    return next();
  }

  // Check against aggressive scraper patterns on heavy API routes
  const isScraper = AGGRESSIVE_SCRAPER_PATTERNS.some((pattern) => pattern.test(userAgent));
  if (isScraper) {
    // Only allow robots.txt or public health
    if (req.path === '/api/health' || req.path === '/robots.txt') {
      return next();
    }

    trafficMonitor.recordBotBlock();
    return res.status(403).json({
      success: false,
      error: {
        code: 'BOT_ACCESS_RESTRICTED',
        message: 'Automated scraping on dynamic Squeeze origin endpoints is restricted to preserve service stability.'
      }
    });
  }

  next();
}

/**
 * Predefined Rate Limiters for Squeeze AI API
 */
export const aiGenerationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 AI generations/chats per minute per user/IP
  message: 'AI request limit reached. Please wait a moment before sending another message or generating code.'
});

export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 20, // 20 attempts per 5 minutes per IP
  message: 'Too many authentication attempts. Please wait 5 minutes before retrying.'
});

export const studioSyncRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 180, // Allow up to 3 req/sec polling from Studio plugin
  message: 'Roblox Studio sync frequency exceeded.'
});

export const generalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 120, // 120 general requests per minute
  message: 'General API request limit reached. Please slow down.'
});
