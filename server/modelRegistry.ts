import { GoogleGenAI } from "@google/genai";

export type AITaskType = 'code' | 'planning' | 'semantic' | 'memory' | 'simple_chat' | 'debug';

export interface ModelStatusInfo {
  model: string;
  status: 'AVAILABLE' | 'RATE_LIMITED' | 'UNAVAILABLE';
  blockedUntil?: number;
  lastChecked: number;
  lastError?: string;
  supportedMethods?: string[];
}

// Current Gemini generation model candidates (GA & production targets)
const PRIMARY_DEFAULT_MODEL = 'gemini-3.5-flash';
const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
];

// Task-to-preferred-models prioritization with active, resilient fallbacks
const TASK_MODEL_PREFERENCES: Record<AITaskType, string[]> = {
  code: ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'],
  planning: ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'],
  semantic: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash'],
  memory: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash'],
  simple_chat: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash'],
  debug: ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']
};

class ModelRegistry {
  private modelMap = new Map<string, ModelStatusInfo>();
  private lastDiscoveryTime = 0;
  private discoveryPromise: Promise<void> | null = null;

  constructor() {
    for (const m of CANDIDATE_MODELS) {
      this.modelMap.set(m, {
        model: m,
        status: 'AVAILABLE',
        lastChecked: Date.now(),
        supportedMethods: ['generateContent']
      });
    }
  }

  /**
   * Discover and validate available models dynamically from GoogleGenAI API
   */
  async discoverModels(ai: GoogleGenAI, force = false): Promise<void> {
    const now = Date.now();
    // Cache discovery for 10 minutes unless forced
    if (!force && this.lastDiscoveryTime > 0 && now - this.lastDiscoveryTime < 10 * 60 * 1000) {
      return;
    }

    if (this.discoveryPromise) {
      return this.discoveryPromise;
    }

    this.discoveryPromise = (async () => {
      try {
        const list = await ai.models.list();
        const discovered = new Set<string>();

        for await (const m of list) {
          const rawName = m.name || '';
          const cleanName = rawName.replace(/^models\//, '');
          const rawModel = m as any;
          const methods = (rawModel.supportedActions as string[]) || (rawModel.supportedGenerationMethods as string[]) || ['generateContent'];

          if (methods.includes('generateContent') || methods.includes('bidiGenerateContent')) {
            discovered.add(cleanName);
            const existing = this.modelMap.get(cleanName);
            this.modelMap.set(cleanName, {
              model: cleanName,
              status: existing?.status === 'RATE_LIMITED' && (existing.blockedUntil || 0) > Date.now() ? 'RATE_LIMITED' : 'AVAILABLE',
              blockedUntil: existing?.blockedUntil,
              lastChecked: Date.now(),
              supportedMethods: methods
            });
          }
        }

        // Mark known candidates not discovered as UNAVAILABLE
        for (const [modelName, info] of this.modelMap.entries()) {
          if (!discovered.has(modelName) && discovered.size > 0) {
            info.status = 'UNAVAILABLE';
            info.lastError = 'Not returned in model discovery catalog';
          }
        }

        this.lastDiscoveryTime = Date.now();
        console.log(`[ModelRegistry] Discovery complete. ${discovered.size} models found.`);
      } catch (err: any) {
        console.warn(`[ModelRegistry] Discovery failed, using fallback candidate list:`, err.message || err);
      } finally {
        this.discoveryPromise = null;
      }
    })();

    return this.discoveryPromise;
  }

  /**
   * Get ordered candidates for a specific task
   */
  getModelsForTask(taskType: AITaskType): string[] {
    const preferred = TASK_MODEL_PREFERENCES[taskType] || TASK_MODEL_PREFERENCES.code;
    const now = Date.now();

    // Available models first
    const available = preferred.filter(m => {
      const info = this.modelMap.get(m);
      if (!info) return true;
      if (info.status === 'UNAVAILABLE') return false;
      if (info.status === 'RATE_LIMITED' && (info.blockedUntil || 0) > now) return false;
      return true;
    });

    if (available.length > 0) {
      return available;
    }

    // If all preferred are blocked/unavailable, return any available candidate
    const anyAvailable = CANDIDATE_MODELS.filter(m => {
      const info = this.modelMap.get(m);
      if (!info) return true;
      if (info.status === 'UNAVAILABLE') return false;
      if (info.status === 'RATE_LIMITED' && (info.blockedUntil || 0) > now) return false;
      return true;
    });

    return anyAvailable.length > 0 ? anyAvailable : preferred;
  }

  recordSuccess(model: string): void {
    const info = this.modelMap.get(model);
    if (info) {
      info.status = 'AVAILABLE';
      info.blockedUntil = undefined;
      info.lastChecked = Date.now();
    } else {
      this.modelMap.set(model, {
        model,
        status: 'AVAILABLE',
        lastChecked: Date.now()
      });
    }
  }

  recordFailure(model: string, error: any): { isQuota: boolean; isNotFound: boolean; isTransient: boolean } {
    const errMsg = String(error?.message || error || '');
    const errStatus = error?.status || error?.code;
    const isNotFound = errStatus === 404 || errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('no longer available') || errMsg.includes('is not found');
    const isQuota = errStatus === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded') || errMsg.includes('quota');
    const isTransient = errStatus === 503 || errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand');

    const info = this.modelMap.get(model) || {
      model,
      status: 'AVAILABLE' as const,
      lastChecked: Date.now()
    };

    if (isNotFound) {
      info.status = 'UNAVAILABLE';
      info.lastError = errMsg;
    } else if (isQuota) {
      // Try to parse retry delay
      let delayMs = 60000;
      const retryMatch = errMsg.match(/retry in\s+([0-9.]+)\s*s/i);
      if (retryMatch && retryMatch[1]) {
        delayMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000;
      }
      info.status = 'RATE_LIMITED';
      info.blockedUntil = Date.now() + Math.max(delayMs, 10000);
      info.lastError = errMsg;
    } else {
      info.lastError = errMsg;
    }

    this.modelMap.set(model, info);
    return { isQuota, isNotFound, isTransient };
  }

  getHealthReport() {
    const now = Date.now();
    const available: string[] = [];
    const blocked: { model: string; reason: string; retryInSec?: number }[] = [];
    const unavailable: string[] = [];

    for (const [m, info] of this.modelMap.entries()) {
      if (info.status === 'UNAVAILABLE') {
        unavailable.push(m);
      } else if (info.status === 'RATE_LIMITED' && (info.blockedUntil || 0) > now) {
        blocked.push({
          model: m,
          reason: info.lastError || 'Rate limited (429)',
          retryInSec: Math.ceil(((info.blockedUntil || 0) - now) / 1000)
        });
      } else {
        available.push(m);
      }
    }

    const primaryModel = available.includes(PRIMARY_DEFAULT_MODEL) ? PRIMARY_DEFAULT_MODEL : (available[0] || 'none');
    const status = available.length > 0 ? (blocked.length > 0 ? 'degraded' : 'healthy') : 'unavailable';

    return {
      status,
      primaryModel,
      availableModels: available,
      blockedModels: blocked,
      unavailableModels: unavailable,
      lastDiscovery: this.lastDiscoveryTime ? new Date(this.lastDiscoveryTime).toISOString() : 'pending'
    };
  }
}

export const modelRegistry = new ModelRegistry();

/**
 * Robust caller for all tasks with dynamic discovery, fallback, rate limit tracking, and structured logging.
 */
export async function executeWithModelFallback<T = any>(
  ai: GoogleGenAI,
  taskType: AITaskType,
  prompt: string,
  systemInstruction: string,
  options?: {
    responseSchema?: any;
    thinkingLevel?: 'low' | 'medium' | 'high';
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<T> {
  const startTime = Date.now();
  // Trigger background discovery non-blocking if needed
  modelRegistry.discoverModels(ai).catch(() => {});

  const candidateModels = modelRegistry.getModelsForTask(taskType);
  let lastError: any = null;

  for (const model of candidateModels) {
    const modelStart = Date.now();
    try {
      const config: any = {
        systemInstruction,
        responseMimeType: options?.responseSchema ? "application/json" : "text/plain",
        responseSchema: options?.responseSchema,
        temperature: options?.temperature ?? (taskType === 'code' ? 0.2 : 0.4),
        maxOutputTokens: options?.maxOutputTokens ?? 8192,
      };

      // Model execution
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config
      });

      const durationMs = Date.now() - modelStart;
      modelRegistry.recordSuccess(model);

      console.log(`[AI] task=${taskType} model=${model} status=success duration=${durationMs}ms`);

      const text = response.text || "{}";
      if (!options?.responseSchema) {
        return text as unknown as T;
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[1]) {
          return JSON.parse(jsonMatch[1]) as T;
        }
        throw new Error(`Failed to parse JSON response from model ${model}`);
      }
    } catch (err: any) {
      lastError = err;
      const durationMs = Date.now() - modelStart;
      const { isQuota, isNotFound, isTransient } = modelRegistry.recordFailure(model, err);

      console.warn(`[AI] task=${taskType} model=${model} status=failed code=${err.status || err.code || 'ERR'} duration=${durationMs}ms reason="${err.message?.slice(0, 100)}"`);

      // If 404 (model not found / deprecated), do NOT retry this model, try next candidate
      if (isNotFound) {
        continue;
      }

      // If 429 (quota rate-limit), continue to next fallback candidate immediately
      if (isQuota) {
        continue;
      }

      // If 503 (transient), short wait and continue to next candidate
      if (isTransient) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  console.error(`[AI] task=${taskType} all candidate models exhausted in ${totalDuration}ms.`);
  throw lastError || new Error(`AI_MODELS_UNAVAILABLE: No active Gemini models available for task ${taskType}`);
}
