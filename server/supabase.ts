import { createClient, SupabaseClient } from '@supabase/supabase-js';

let anonClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;
let lastAdminUrl: string | null = null;
let lastAdminKey: string | null = null;
let lastAnonUrl: string | null = null;
let lastAnonKey: string | null = null;

// Simple concurrency limiter
const MAX_CONCURRENT_WRITES = 5;
let activeWrites = 0;
const writeQueue: (() => Promise<void>)[] = [];

async function processQueue() {
  if (activeWrites >= MAX_CONCURRENT_WRITES || writeQueue.length === 0) return;
  
  const task = writeQueue.shift();
  if (task) {
    activeWrites++;
    try {
      await task();
    } finally {
      activeWrites--;
      processQueue();
    }
  }
}

export async function queueSupabaseWrite(fn: () => Promise<any>) {
  return new Promise((resolve, reject) => {
    writeQueue.push(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
    processQueue();
  });
}

/**
 * Sanitizes the Supabase URL to ensure it contains only the protocol and host.
 * This prevents malformed paths (e.g. trailing slashes, appended /rest/v1 paths, etc.)
 * which trigger "Invalid path specified in request URL" errors.
 */
export function sanitizeSupabaseUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.trim().replace(/\/+$/, '');
  }
}

/**
 * Lazy-loads and retrieves the appropriate Supabase client.
 * Rebuilds the client if the configured URL or keys change.
 * 
 * @param useServiceRole If true, attempts to load the client using the secure service_role key (server-only).
 *                      If false, loads the client using the public anon key.
 */
export function getSupabaseClient(useServiceRole = true): SupabaseClient {
  const rawUrl = process.env.SUPABASE_URL || 'https://kubltllfolwajfkacsam.supabase.co';
  const supabaseUrl = sanitizeSupabaseUrl(rawUrl);
  
  if (useServiceRole) {
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    if (!serviceKey) {
      throw new Error('Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is set in environment variables.');
    }
    
    if (adminClient && lastAdminUrl === supabaseUrl && lastAdminKey === serviceKey) {
      return adminClient;
    }
    
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    lastAdminUrl = supabaseUrl;
    lastAdminKey = serviceKey;
    return adminClient;
  } else {
    const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
    if (!anonKey) {
      throw new Error('SUPABASE_ANON_KEY environment variable is required but not set.');
    }
    
    if (anonClient && lastAnonUrl === supabaseUrl && lastAnonKey === anonKey) {
      return anonClient;
    }
    
    anonClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    lastAnonUrl = supabaseUrl;
    lastAnonKey = anonKey;
    return anonClient;
  }
}
