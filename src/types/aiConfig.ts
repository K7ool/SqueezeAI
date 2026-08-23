export type AIProviderType = 'gemini' | 'openrouter' | 'opencode_zen';

export interface UserAIConfig {
  provider: AIProviderType;
  model: string;
  hasCustomKey: boolean;
  keyMasked?: string; // e.g. "••••••••1234"
}

export interface AIProviderModelOption {
  id: string;
  name: string;
  provider: AIProviderType;
  description: string;
  contextWindow?: string;
  supportsThinking?: boolean;
  isFree?: boolean;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export const AVAILABLE_AI_MODELS: Record<AIProviderType, AIProviderModelOption[]> = {
  gemini: [
    {
      id: 'gemini-3.5-flash',
      name: 'Gemini 3.5 Flash (Recommended Default)',
      provider: 'gemini',
      description: 'High-speed, highly capable flagship model with real-time reasoning',
      supportsThinking: true,
      isFree: false
    },
    {
      id: 'gemini-3.5-flash-lite',
      name: 'Gemini 3.5 Flash Lite',
      provider: 'gemini',
      description: 'Ultra-low latency lightweight model for rapid code tasks',
      supportsThinking: false,
      isFree: false
    },
    {
      id: 'gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash Lite',
      provider: 'gemini',
      description: 'Reliable fast fallback model',
      supportsThinking: false,
      isFree: false
    },
    {
      id: 'gemini-3.7-flash',
      name: 'Gemini 3.7 Flash',
      provider: 'gemini',
      description: 'Advanced reasoning and Luau architecture specialist',
      supportsThinking: true,
      isFree: false
    },
    {
      id: 'gemini-3.6-flash',
      name: 'Gemini 3.6 Flash',
      provider: 'gemini',
      description: 'Enhanced coding model with deep analysis capabilities',
      supportsThinking: true,
      isFree: false
    }
  ],
  openrouter: [
    // Paid / Flagship OpenRouter models
    {
      id: 'anthropic/claude-3.7-sonnet',
      name: 'Claude 3.7 Sonnet',
      provider: 'openrouter',
      description: 'Hybrid reasoning and top-tier code architecture generation',
      supportsThinking: true,
      isFree: false
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      provider: 'openrouter',
      description: 'Omni multi-modal model with comprehensive general knowledge',
      supportsThinking: false,
      isFree: false
    },
    {
      id: 'deepseek/deepseek-r1',
      name: 'DeepSeek R1',
      provider: 'openrouter',
      description: 'Open reasoning powerhouse with step-by-step thinking chain',
      supportsThinking: true,
      isFree: false
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      provider: 'openrouter',
      description: 'High-performance open weights model with fast execution',
      supportsThinking: false,
      isFree: false
    },
    // Default OpenRouter Free models (dynamically updated from API)
    {
      id: 'google/gemini-2.0-flash-exp:free',
      name: 'Google: Gemini 2.0 Flash Experimental',
      provider: 'openrouter',
      description: 'High-speed experimental reasoning model from Google via OpenRouter',
      supportsThinking: true,
      isFree: true
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Meta: Llama 3.3 70B Instruct',
      provider: 'openrouter',
      description: 'Fast 70B parameter open weights model with zero cost',
      supportsThinking: false,
      isFree: true
    },
    {
      id: 'deepseek/deepseek-r1:free',
      name: 'DeepSeek: DeepSeek R1',
      provider: 'openrouter',
      description: 'Reasoning model with chain-of-thought outputs at no cost',
      supportsThinking: true,
      isFree: true
    },
    {
      id: 'qwen/qwen-2.5-coder-32b-instruct:free',
      name: 'Qwen: Qwen 2.5 Coder 32B',
      provider: 'openrouter',
      description: 'Coding specialized open model from Qwen via OpenRouter',
      supportsThinking: false,
      isFree: true
    }
  ],
  opencode_zen: [
    {
      id: 'opencode/zen-luau-v1',
      name: 'OpenCode Zen Luau Architect',
      provider: 'opencode_zen',
      description: 'Specialized model fine-tuned for Roblox DataModel & Wally ecosystem',
      supportsThinking: true
    },
    {
      id: 'opencode/zen-fast-coder',
      name: 'OpenCode Zen Fast Coder',
      provider: 'opencode_zen',
      description: 'Speed-optimized model for rapid script iteration and error fixing',
      supportsThinking: false
    },
    {
      id: 'opencode/zen-general-pro',
      name: 'OpenCode Zen General Pro',
      provider: 'opencode_zen',
      description: 'Full stack game architecture and multi-file project organizer',
      supportsThinking: true
    }
  ]
};
