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

let hasLoggedEnvDiagnosis = false;

function logEnvDiagnosisOnce(supabaseUrl: string, serviceKey: string, anonKey: string) {
  if (hasLoggedEnvDiagnosis) return;
  hasLoggedEnvDiagnosis = true;

  const maskedUrl = supabaseUrl ? `${supabaseUrl.slice(0, 20)}...` : 'MISSING';
  
  const fromEnvService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fromEnvAnon = !!process.env.SUPABASE_ANON_KEY;
  
  const maskedServiceKey = serviceKey ? `${serviceKey.slice(0, 6)}... (length: ${serviceKey.length})` : 'MISSING';
  const maskedAnonKey = anonKey ? `${anonKey.slice(0, 6)}... (length: ${anonKey.length})` : 'MISSING';

  console.log(`[Supabase Initialization Diagnosis]`);
  console.log(`  - SUPABASE_URL (sanitized): ${maskedUrl}`);
  console.log(`  - SUPABASE_SERVICE_ROLE_KEY (Found in Env: ${fromEnvService}): ${maskedServiceKey}`);
  console.log(`  - SUPABASE_ANON_KEY (Found in Env: ${fromEnvAnon}): ${maskedAnonKey}`);
}

/**
 * Lazy-loads and retrieves the appropriate Supabase client.
 * Rebuilds the client if the configured URL or keys change.
 * 
 * @param useServiceRole If true, attempts to load the client using the secure service_role key (server-only).
 *                      If false, loads the client using the public anon key.
 */
export function getSupabaseClient(useServiceRole = true): SupabaseClient {
  const rawUrl = process.env.SUPABASE_URL || 'https://ihqanbsxdfkvxtchwqmc.supabase.co';
  const supabaseUrl = sanitizeSupabaseUrl(rawUrl);
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlocWFuYnN4ZGZrdnh0Y2h3cW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM5ODE1OCwiZXhwIjoyMDk0OTc0MTU4fQ.cop-NJ1xgY3MYP2iwFSmbrgJvIWqWlVT4STTz7hll8w').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlocWFuYnN4ZGZrdnh0Y2h3cW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTgxNTgsImV4cCI6MjA5NDk3NDE1OH0.0nrnnxCkthnFJsFhczB7ZhI7WguT9Wy8AwIQ9mY8uzg').trim();

  logEnvDiagnosisOnce(supabaseUrl, serviceKey, anonKey);
  
  if (useServiceRole) {
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
