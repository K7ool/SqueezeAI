/**
 * Squeeze Startup Validation
 *
 * Validates critical configuration before server starts.
 * Fails fast if production requirements are not met.
 */

import { getConfigStatus, testDatabaseConnection } from './supabaseClient.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates all critical system requirements.
 * Call this during server startup.
 */
export async function validateSystemRequirements(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('🔍 [Startup Validation] Checking system requirements...');

  // 1. Check Supabase configuration
  const supabaseConfig = getConfigStatus();
  if (!supabaseConfig.configured) {
    errors.push('Supabase configuration invalid or missing');
  } else {
    console.log(`✅ [Startup Validation] Supabase configured: ${supabaseConfig.url}`);
  }

  // 2. Test database connectivity
  if (supabaseConfig.configured) {
    const dbTest = await testDatabaseConnection();
    if (!dbTest.healthy) {
      errors.push(`Database connectivity test failed: ${dbTest.error}`);
    } else {
      console.log(`✅ [Startup Validation] Database connection healthy (${dbTest.latencyMs}ms)`);
    }
  }

  // 3. Check AI provider configuration
  const hasGeminiKey = !!process.env.GEMINI_API_KEY?.trim();
  if (!hasGeminiKey) {
    warnings.push('GEMINI_API_KEY not set - AI generation will fail');
  } else {
    console.log('✅ [Startup Validation] Gemini API key configured');
  }

  // 4. Check JWT secret
  const hasJwtSecret = !!process.env.JWT_SECRET?.trim();
  if (!hasJwtSecret) {
    warnings.push('JWT_SECRET not set - authentication tokens may be insecure');
  } else {
    console.log('✅ [Startup Validation] JWT secret configured');
  }

  // 5. Environment check
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';

  console.log(`ℹ️  [Startup Validation] Environment: ${isProduction ? 'production' : 'development'}`);
  if (isVercel) {
    console.log('ℹ️  [Startup Validation] Platform: Vercel');
  }

  // Summary
  const valid = errors.length === 0;

  if (!valid) {
    console.error('\n❌ [Startup Validation] FAILED\n');
    errors.forEach(err => console.error(`   - ${err}`));
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  [Startup Validation] Warnings:\n');
    warnings.forEach(warn => console.warn(`   - ${warn}`));
  }

  if (valid && warnings.length === 0) {
    console.log('\n✅ [Startup Validation] All checks passed\n');
  }

  return { valid, errors, warnings };
}

/**
 * Validates system requirements and exits if critical errors found.
 * Use this in production to fail-fast on misconfiguration.
 */
export async function validateOrExit(): Promise<void> {
  const result = await validateSystemRequirements();

  if (!result.valid) {
    console.error('\n🛑 Server cannot start with invalid configuration.');
    console.error('Fix the errors above and restart.\n');
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Server starting with warnings. Some features may not work correctly.\n');
  }
}
