import { createClient, SupabaseClient } from '@supabase/supabase-js';

let anonClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/**
 * Lazy-loads and retrieves the appropriate Supabase client.
 * 
 * @param useServiceRole If true, attempts to load the client using the secure service_role key (server-only).
 *                      If false, loads the client using the public anon key.
 */
export function getSupabaseClient(useServiceRole = true): SupabaseClient {
  let supabaseUrl = process.env.SUPABASE_URL || 'https://kubltllfolwajfkacsam.supabase.co';
  // Strip trailing slashes to prevent malformed URL paths like "//rest/v1"
  supabaseUrl = supabaseUrl.replace(/\/+$/, '');
  
  if (useServiceRole) {
    if (adminClient) return adminClient;
    
    // Server-side privileged operations (e.g., bypassing RLS safely in our trusted backend environment)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!serviceKey) {
      throw new Error('Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is set in environment variables.');
    }
    
    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return adminClient;
  } else {
    if (anonClient) return anonClient;
    
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error('SUPABASE_ANON_KEY environment variable is required but not set.');
    }
    
    anonClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return anonClient;
  }
}
