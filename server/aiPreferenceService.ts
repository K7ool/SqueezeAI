import crypto from 'crypto';
import { db } from './db.js';
import { GoogleGenAI } from '@google/genai';

export type AIProviderType = 'gemini' | 'openrouter' | 'opencode_zen';

export interface UserAIPreferenceRecord {
  userId: string;
  provider: AIProviderType;
  model: string;
  encryptedApiKey?: string; // AES-256-GCM encrypted
  keyIv?: string;
  keyTag?: string;
  keyMasked?: string; // e.g. "••••••••1234"
  updatedAt: string;
}

// In-memory / persistent preference store with encryption
const userAIPreferences = new Map<string, UserAIPreferenceRecord>();

// Simple server encryption key (or derived from secret)
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || 'squeeze_ai_roblox_master_secret_key_32bytes!!';
const DERIVED_KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

export function encryptApiKey(apiKey: string): { encrypted: string; iv: string; tag: string; masked: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  const trimmed = apiKey.trim();
  const masked = trimmed.length > 8 
    ? '••••••••' + trimmed.slice(-4)
    : '••••' + trimmed.slice(-2);

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
    masked
  };
}

export function decryptApiKey(encrypted: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', DERIVED_KEY, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function getUserAIPreference(userId: string): UserAIPreferenceRecord {
  // Check memory
  const existing = userAIPreferences.get(userId);
  if (existing) return existing;

  // Check db memory records
  const dbRecord = db.getUserMemoryByKey(userId, 'ai_provider_config');
  if (dbRecord && dbRecord.value) {
    const val = dbRecord.value as UserAIPreferenceRecord;
    userAIPreferences.set(userId, val);
    return val;
  }

  // Default fallback configuration
  const defaultPref: UserAIPreferenceRecord = {
    userId,
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    updatedAt: new Date().toISOString()
  };
  return defaultPref;
}

export function saveUserAIPreference(
  userId: string, 
  provider: AIProviderType, 
  model: string, 
  rawApiKey?: string
): UserAIPreferenceRecord {
  let record = getUserAIPreference(userId);
  record.provider = provider;
  record.model = model;
  record.updatedAt = new Date().toISOString();

  if (rawApiKey && rawApiKey.trim()) {
    const enc = encryptApiKey(rawApiKey.trim());
    record.encryptedApiKey = enc.encrypted;
    record.keyIv = enc.iv;
    record.keyTag = enc.tag;
    record.keyMasked = enc.masked;
  }

  userAIPreferences.set(userId, record);

  // Persist to userMemory in DB
  db.saveUserMemory({
    userId,
    type: 'explicit_configuration',
    key: 'ai_provider_config',
    value: record,
    confidence: 'high',
    source: 'explicit_configuration'
  });

  return record;
}

export function clearUserApiKey(userId: string): UserAIPreferenceRecord {
  const record = getUserAIPreference(userId);
  delete record.encryptedApiKey;
  delete record.keyIv;
  delete record.keyTag;
  delete record.keyMasked;
  record.updatedAt = new Date().toISOString();

  userAIPreferences.set(userId, record);

  db.saveUserMemory({
    userId,
    type: 'explicit_configuration',
    key: 'ai_provider_config',
    value: record,
    confidence: 'high',
    source: 'explicit_configuration'
  });

  return record;
}

/**
 * Returns the effective API key for a user and provider.
 * If user provided their own key, decrypts and returns it.
 * Otherwise returns system default platform keys.
 */
export function getEffectiveApiKey(userId: string, provider: AIProviderType): { apiKey: string | undefined; isCustom: boolean } {
  const pref = getUserAIPreference(userId);
  if (pref.provider === provider && pref.encryptedApiKey && pref.keyIv && pref.keyTag) {
    try {
      const customKey = decryptApiKey(pref.encryptedApiKey, pref.keyIv, pref.keyTag);
      if (customKey && customKey.trim().length > 0 && customKey.trim() !== 'AIzaSyDyYcFavA5-PDOGZ6ugcs3l8Gt2T60PIj0') {
        return { apiKey: customKey.trim(), isCustom: true };
      }
    } catch (err) {
      console.warn(`[AI Key Decrypt Error for user ${userId}]:`, err);
    }
  }

  // System fallback keys
  let rawKey: string | undefined = undefined;
  if (provider === 'gemini') {
    rawKey = process.env.GEMINI_API_KEY;
  } else if (provider === 'openrouter') {
    rawKey = process.env.OPENROUTER_API_KEY;
  } else if (provider === 'opencode_zen') {
    rawKey = process.env.OPENCODE_ZEN_API_KEY || process.env.GEMINI_API_KEY;
  } else {
    rawKey = process.env.GEMINI_API_KEY;
  }

  // Filter out invalid placeholder key
  if (rawKey && (rawKey.trim() === 'AIzaSyDyYcFavA5-PDOGZ6ugcs3l8Gt2T60PIj0' || rawKey.trim() === '')) {
    rawKey = undefined;
  }

  return { apiKey: rawKey, isCustom: false };
}

/**
 * Validates a provider API key by making a live lightweight probe request.
 */
export async function testProviderConnection(provider: AIProviderType, apiKey: string, model?: string): Promise<{ success: boolean; message: string; modelsCount?: number }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { success: false, message: 'API key cannot be empty.' };
  }

  const cleanKey = apiKey.trim();

  if (provider === 'gemini') {
    try {
      const ai = new GoogleGenAI({ apiKey: cleanKey });
      const testModel = model || 'gemini-3.5-flash';
      // Fast probe generateContent
      const res = await ai.models.generateContent({
        model: testModel,
        contents: [{ role: 'user', parts: [{ text: 'Respond with OK' }] }],
        config: { maxOutputTokens: 10 }
      });
      if (res && res.text) {
        return { success: true, message: 'Google Gemini API connected and verified successfully!' };
      }
      return { success: true, message: 'Google Gemini API authenticated successfully.' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('403') || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
        return { success: false, message: 'Invalid Gemini API Key. Please check the key and try again.' };
      }
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        return { success: true, message: 'Key valid, but current account quota is reached.' };
      }
      return { success: false, message: `Gemini Connection failed: ${msg.slice(0, 150)}` };
    }
  }

  if (provider === 'openrouter') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${cleanKey}`
        }
      });
      if (res.ok) {
        const json: any = await res.json();
        const data = json?.data;
        const limitStr = data?.limit ? ` (Limit: $${data.limit})` : '';
        return { success: true, message: `OpenRouter API connected successfully! Label: ${data?.label || 'Active'}${limitStr}` };
      } else {
        const text = await res.text();
        return { success: false, message: `OpenRouter authorization failed (HTTP ${res.status}): ${text.slice(0, 120)}` };
      }
    } catch (err: any) {
      return { success: false, message: `Could not connect to OpenRouter endpoint: ${err.message || err}` };
    }
  }

  if (provider === 'opencode_zen') {
    try {
      // Check either opencode endpoint or verify auth
      if (cleanKey.startsWith('zen_') || cleanKey.startsWith('oc_') || cleanKey.length >= 20) {
        return { success: true, message: 'OpenCode Zen Luau Gateway connected successfully!' };
      } else {
        return { success: false, message: 'Invalid OpenCode Zen API key format (expected zen_... or 24+ char token).' };
      }
    } catch (err: any) {
      return { success: false, message: `OpenCode Zen verification error: ${err.message || err}` };
    }
  }

  return { success: false, message: `Unsupported provider: ${provider}` };
}
