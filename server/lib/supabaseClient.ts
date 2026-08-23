/**
 * Squeeze Central Supabase Configuration Service
 *
 * Single source of truth for all Supabase database access.
 * Fails fast on invalid/missing configuration instead of silent fallbacks.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration state
interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  anonKey: string;
}

let config: SupabaseConfig | null = null;
let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;
let configValidated = false;

/**
 * Validates and loads Supabase configuration from environment.
 * Throws immediately if configuration is invalid or missing.
 */
function validateAndLoadConfig(): SupabaseConfig {
  if (config && configValidated) {
    return config;
  }

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  // Validation errors
  const errors: string[] = [];

  if (!url) {
    errors.push('SUPABASE_URL is not set');
  } else if (!url.startsWith('https://')) {
    errors.push(`SUPABASE_URL must start with https:// (got: ${url.slice(0, 20)}...)`);
  }

  if (!serviceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is not set');
  } else if (serviceRoleKey.length < 100) {
    errors.push(`SUPABASE_SERVICE_ROLE_KEY appears invalid (length: ${serviceRoleKey.length}, expected >100)`);
  }

  if (!anonKey) {
    errors.push('SUPABASE_ANON_KEY is not set');
  } else if (anonKey.length < 100) {
    errors.push(`SUPABASE_ANON_KEY appears invalid (length: ${anonKey.length}, expected >100)`);
  }

  if (errors.length > 0) {
    const errorMsg = [
      '❌ SUPABASE CONFIGURATION ERROR',
      '',
      'The following environment variables are missing or invalid:',
      ...errors.map(e => `  - ${e}`),
      '',
      'Production database persistence requires valid Supabase credentials.',
      'Set these in Vercel environment variables or local .env file.',
      '',
      'Refusing to start with invalid database configuration.'
    ].join('\n');

    throw new Error(errorMsg);
  }

  // Sanitize URL (remove trailing slashes, paths)
  const sanitizedUrl = sanitizeSupabaseUrl(url!);

  config = {
    url: sanitizedUrl,
    serviceRoleKey: serviceRoleKey!,
    anonKey: anonKey!
  };

  configValidated = true;

  console.log('✅ [Supabase Config] Validation passed');
  console.log(`   URL: ${sanitizedUrl}`);
  console.log(`   Service Role Key: ${serviceRoleKey!.slice(0, 20)}... (${serviceRoleKey!.length} chars)`);
  console.log(`   Anon Key: ${anonKey!.slice(0, 20)}... (${anonKey!.length} chars)`);

  return config;
}

/**
 * Sanitizes Supabase URL to protocol + host only.
 * Prevents "Invalid path specified in request URL" errors.
 */
function sanitizeSupabaseUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.trim().replace(/\/+$/, '');
  }
}

/**
 * Returns admin Supabase client (service_role key, bypasses RLS).
 * Use for server-side operations requiring full database access.
 */
export function getAdminClient(): SupabaseClient {
  const cfg = validateAndLoadConfig();

  if (!adminClient) {
    adminClient = createClient(cfg.url, cfg.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return adminClient;
}

/**
 * Returns anon Supabase client (anon key, respects RLS).
 * Use for user-facing operations.
 */
export function getAnonClient(): SupabaseClient {
  const cfg = validateAndLoadConfig();

  if (!anonClient) {
    anonClient = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return anonClient;
}

/**
 * Legacy compatibility: returns admin or anon client based on flag.
 * New code should use getAdminClient() or getAnonClient() directly.
 */
export function getSupabaseClient(useServiceRole = true): SupabaseClient {
  return useServiceRole ? getAdminClient() : getAnonClient();
}

/**
 * Tests database connectivity by attempting a simple query.
 * Returns { healthy: boolean, error?: string }
 */
export async function testDatabaseConnection(): Promise<{ healthy: boolean; error?: string; latencyMs?: number }> {
  try {
    const startTime = Date.now();
    const client = getAdminClient();

    // Simple connectivity test
    const { error } = await client.from('users').select('id').limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      return {
        healthy: false,
        error: `Database query failed: ${error.message}`,
        latencyMs
      };
    }

    return { healthy: true, latencyMs };
  } catch (err: any) {
    return {
      healthy: false,
      error: err.message || 'Unknown database error'
    };
  }
}

/**
 * Returns current configuration status for health checks.
 */
export function getConfigStatus(): {
  configured: boolean;
  url?: string;
  hasServiceRoleKey: boolean;
  hasAnonKey: boolean;
} {
  try {
    const cfg = validateAndLoadConfig();
    return {
      configured: true,
      url: cfg.url,
      hasServiceRoleKey: !!cfg.serviceRoleKey,
      hasAnonKey: !!cfg.anonKey
    };
  } catch {
    return {
      configured: false,
      hasServiceRoleKey: false,
      hasAnonKey: false
    };
  }
}

/**
 * Resets cached clients (for testing/hot-reload).
 */
export function resetClients(): void {
  adminClient = null;
  anonClient = null;
  config = null;
  configValidated = false;
}
