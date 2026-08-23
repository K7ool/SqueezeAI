import React, { useState, useEffect } from 'react';
import { 
  Key, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Trash2, Cpu, ExternalLink, Sparkles, Check
} from 'lucide-react';
import { AIProviderType, AVAILABLE_AI_MODELS, UserAIConfig, AIProviderModelOption } from '../types/aiConfig';
import { safeFetchJson } from '../utils/api';

interface AISettingsPanelProps {
  onShowToast: (msg: string) => void;
  selectedProvider?: AIProviderType;
  selectedModel?: string;
  onModelConfigChange?: (provider: AIProviderType, model: string) => void;
}

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({
  onShowToast,
  selectedProvider: initialProvider,
  selectedModel: initialModel,
  onModelConfigChange
}) => {
  const [provider, setProvider] = useState<AIProviderType>(initialProvider || 'gemini');
  const [model, setModel] = useState<string>(initialModel || 'gemini-3.5-flash');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [hasCustomKey, setHasCustomKey] = useState<boolean>(false);
  const [maskedKey, setMaskedKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Dynamic OpenRouter models state
  const [openRouterDynamicModels, setOpenRouterDynamicModels] = useState<AIProviderModelOption[]>([]);
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] = useState<boolean>(false);

  // Fetch current user preference on load
  useEffect(() => {
    fetchCurrentConfig();
  }, []);

  // Fetch OpenRouter models dynamically when provider changes to OpenRouter
  useEffect(() => {
    if (provider === 'openrouter' && openRouterDynamicModels.length === 0) {
      fetchOpenRouterModels();
    }
  }, [provider]);

  const fetchOpenRouterModels = async () => {
    setIsLoadingOpenRouterModels(true);
    try {
      const res = await safeFetchJson('/api/ai/openrouter-models');
      if (res.ok && res.data?.success && Array.isArray(res.data.models)) {
        setOpenRouterDynamicModels(res.data.models);
      }
    } catch (err) {
      console.warn('Failed to fetch OpenRouter models:', err);
    } finally {
      setIsLoadingOpenRouterModels(false);
    }
  };

  const fetchCurrentConfig = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson('/api/ai/config', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (res.ok && res.data?.success && res.data.config) {
        const cfg: UserAIConfig = res.data.config;
        setProvider(cfg.provider || 'gemini');
        setModel(cfg.model || 'gemini-3.5-flash');
        setHasCustomKey(cfg.hasCustomKey || false);
        setMaskedKey(cfg.keyMasked || '');
        if (onModelConfigChange) {
          onModelConfigChange(cfg.provider || 'gemini', cfg.model || 'gemini-3.5-flash');
        }
      }
    } catch (err) {
      console.warn('Failed to load user AI configuration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (newProvider: AIProviderType) => {
    setProvider(newProvider);
    const defaultModel = AVAILABLE_AI_MODELS[newProvider]?.[0]?.id || 'gemini-3.5-flash';
    setModel(defaultModel);
    setTestResult(null);
    setApiKeyInput('');
    if (onModelConfigChange) {
      onModelConfigChange(newProvider, defaultModel);
    }
    // Auto save preference model change
    savePreferenceToServer(newProvider, defaultModel);
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    if (onModelConfigChange) {
      onModelConfigChange(provider, newModel);
    }
    savePreferenceToServer(provider, newModel);
  };

  const savePreferenceToServer = async (targetProvider: AIProviderType, targetModel: string, keyToSave?: string) => {
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson('/api/ai/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          provider: targetProvider,
          model: targetModel,
          apiKey: keyToSave
        })
      });

      if (res.ok && res.data?.success) {
        if (keyToSave) {
          setHasCustomKey(true);
          setMaskedKey(res.data.config?.keyMasked || '••••••••' + keyToSave.slice(-4));
          setApiKeyInput('');
        }
      }
    } catch (err) {
      console.warn('Failed to save AI configuration:', err);
    }
  };

  const handleTestAndSave = async () => {
    if (!apiKeyInput.trim() && !hasCustomKey) {
      onShowToast('⚠️ Please enter an API key to test and connect.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson('/api/ai/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          provider,
          model,
          apiKey: apiKeyInput.trim() || undefined
        })
      });

      if (res.ok && res.data) {
        setTestResult({
          success: res.data.success,
          message: res.data.message
        });

        if (res.data.success) {
          onShowToast('✅ Connection verified and saved successfully!');
          if (apiKeyInput.trim()) {
            await savePreferenceToServer(provider, model, apiKeyInput.trim());
          }
        } else {
          onShowToast('❌ Connection test failed.');
        }
      } else {
        setTestResult({
          success: false,
          message: res.data?.message || 'Server connection failed.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to communicate with authentication endpoint.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearKey = async () => {
    try {
      const token = localStorage.getItem('squeeze_token');
      await safeFetchJson('/api/ai/key', {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      setHasCustomKey(false);
      setMaskedKey('');
      setApiKeyInput('');
      setTestResult(null);
      onShowToast('✓ Custom API key removed. Using default platform model.');
    } catch (err) {
      onShowToast('Failed to remove API key.');
    }
  };

  let currentModels = AVAILABLE_AI_MODELS[provider] || [];

  if (provider === 'openrouter' && openRouterDynamicModels.length > 0) {
    const paidBase = AVAILABLE_AI_MODELS.openrouter.filter(m => !m.isFree);
    const fetchedFree = openRouterDynamicModels.filter(m => m.isFree);
    const fetchedPaid = openRouterDynamicModels.filter(m => !m.isFree);

    const map = new Map<string, AIProviderModelOption>();
    paidBase.forEach(m => map.set(m.id, m));
    fetchedPaid.forEach(m => {
      if (!map.has(m.id)) map.set(m.id, m);
    });
    fetchedFree.forEach(m => {
      map.set(m.id, {
        ...m,
        isFree: true,
        name: m.name.includes('(free)') ? m.name : `${m.name} (free)`
      });
    });

    currentModels = Array.from(map.values());
  }

  const selectedModelObj = currentModels.find(m => m.id === model) || currentModels[0];
  const isSelectedModelFree = Boolean(selectedModelObj?.isFree || model.includes(':free') || model.includes('(free)'));

  const paidModelsGroup = currentModels.filter(m => !m.isFree);
  const freeModelsGroup = currentModels.filter(m => m.isFree);

  return (
    <div className="space-y-6 text-white font-mono" id="ai-model-connection-section">
      {/* Header card */}
      <div className="bg-[#11161D] border border-white/10 p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-[#FFC93C]" />
            <div>
              <h3 className="font-bold text-white text-sm">AI Model Connection & Provider</h3>
              <p className="text-xs text-white/50">Select your AI engine and configure Bring Your Own Key (BYOK)</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-[#FFC93C]/10 text-[#FFC93C] border border-[#FFC93C]/20">
            Multi-Provider Ready
          </span>
        </div>

        {/* Provider Switcher Tabs */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/70">AI Provider:</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleProviderChange('gemini')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                provider === 'gemini'
                  ? 'bg-[#FFC93C]/10 border-[#FFC93C] text-white shadow-sm'
                  : 'bg-[#0D1117] border-white/10 text-white/60 hover:text-white hover:border-white/20'
              }`}
            >
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>Google Gemini</span>
                {provider === 'gemini' && <Check className="w-3 h-3 text-[#FFC93C]" />}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">Flash 3.5 / Flash-Lite / 3.7</div>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('openrouter')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                provider === 'openrouter'
                  ? 'bg-[#FFC93C]/10 border-[#FFC93C] text-white shadow-sm'
                  : 'bg-[#0D1117] border-white/10 text-white/60 hover:text-white hover:border-white/20'
              }`}
            >
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>OpenRouter</span>
                {provider === 'openrouter' && <Check className="w-3 h-3 text-[#FFC93C]" />}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">Claude 3.7 / GPT-4o / Free Models</div>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('opencode_zen')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                provider === 'opencode_zen'
                  ? 'bg-[#FFC93C]/10 border-[#FFC93C] text-white shadow-sm'
                  : 'bg-[#0D1117] border-white/10 text-white/60 hover:text-white hover:border-white/20'
              }`}
            >
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>OpenCode Zen</span>
                {provider === 'opencode_zen' && <Check className="w-3 h-3 text-[#FFC93C]" />}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">Luau & Wally Architect</div>
            </button>
          </div>
        </div>

        {/* Model Picker Dropdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white/70">Selected Model:</label>
            {provider === 'openrouter' && isLoadingOpenRouterModels && (
              <span className="text-[10px] text-[#FFC93C] flex items-center gap-1 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Fetching live free models...
              </span>
            )}
          </div>

          <div className="relative">
            <select
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full bg-[#0D1117] border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFC93C] appearance-none cursor-pointer"
            >
              {provider === 'openrouter' ? (
                <>
                  <optgroup label="★ Paid & Flagship Models (OpenRouter)">
                    {paidModelsGroup.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#0D1117] text-white py-1">
                        {m.name} {m.supportsThinking ? '★ Real-time Thinking' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🎁 Free Models (OpenRouter API)">
                    {freeModelsGroup.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#0D1117] text-emerald-300 font-semibold py-1">
                        🟢 [FREE] {m.name.replace(/\(free\)/gi, '').trim()} {m.contextWindow ? `(${m.contextWindow} ctx)` : ''}
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : (
                currentModels.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0D1117] text-white py-1">
                    {m.name} {m.supportsThinking ? '★ Real-time Thinking' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedModelObj && (
            <div className="space-y-1.5 mt-1">
              <div className="flex items-center gap-2 flex-wrap">
                {isSelectedModelFree && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> FREE MODEL
                  </span>
                )}
                <span className="text-[11px] text-white/60 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#FFC93C]" />
                  <span>{selectedModelObj.description}</span>
                </span>
              </div>
            </div>
          )}

          {/* OpenRouter Free Models Explanatory Notice */}
          {provider === 'openrouter' && (
            <div className="mt-3 bg-[#0A130D] border border-emerald-500/30 p-3.5 rounded-lg space-y-2 text-xs text-emerald-100/90 leading-relaxed shadow-sm">
              <div className="font-bold flex items-center justify-between text-emerald-400 border-b border-emerald-500/20 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-500/40 text-[10px] font-extrabold text-emerald-300">
                    FREE
                  </span>
                  <span>معلومات الموديلات المجانية (OpenRouter Free Models)</span>
                </span>
                <span className="text-[10px] text-emerald-400/70 font-mono">
                  {freeModelsGroup.length} models available
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-emerald-200/90">
                <p className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0 mt-0.5">💡</span>
                  <span><strong>ملاحظة السرعة وحدود الاستخدام:</strong> الموديلات المجانية قد تكون أبطأ أو محدودة الاستخدام (rate limits) حسب سياسة OpenRouter، وقد تتغير أو تُزال دون إشعار مسبق.</span>
                </p>
                <p className="flex items-start gap-1.5">
                  <span className="text-emerald-400 shrink-0 mt-0.5">🔑</span>
                  <span><strong>شرط مفتاح الـ API (BYOK):</strong> تعمل الموديلات المجانية فقط إذا كنت قد أدخلت مفتاح OpenRouter API الخاص بك في الحقل أدناه (التسجيل والحصول على المفتاح مجاني تماماً من موقع OpenRouter).</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bring Your Own Key (BYOK) Input Section */}
        <div className="space-y-3 pt-3 border-t border-white/10">
          {isSelectedModelFree && !hasCustomKey && !apiKeyInput.trim() && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>OpenRouter Key Required:</strong> الموديلات المجانية على OpenRouter تتطلب مفتاح API خاص بك للاستخدام. يرجى إدخال مفتاح OpenRouter الخاص بك أدناه.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#FFC93C]" />
              <span>
                {provider === 'gemini' && 'Google Gemini API Key'}
                {provider === 'openrouter' && 'OpenRouter API Key'}
                {provider === 'opencode_zen' && 'OpenCode Zen API Key'}
              </span>
            </label>
            {hasCustomKey ? (
              <span className="text-[10px] text-[#3FB950] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Custom Key Active ({maskedKey})
              </span>
            ) : (
              <span className="text-[10px] text-white/40">Using platform default quota</span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              placeholder={hasCustomKey ? `Saved: ${maskedKey} (enter new key to replace)` : `Paste your ${provider.toUpperCase()} API key here...`}
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setTestResult(null);
              }}
              className="flex-1 bg-[#0D1117] border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FFC93C]"
            />

            <button
              type="button"
              onClick={handleTestAndSave}
              disabled={isTesting || (!apiKeyInput.trim() && !hasCustomKey)}
              className="px-3 py-2 bg-[#FFC93C] text-[#0B120D] font-bold rounded-lg text-xs hover:bg-[#ffe082] transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save & Test Connection</span>
                </>
              )}
            </button>

            {hasCustomKey && (
              <button
                type="button"
                onClick={handleClearKey}
                className="p-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all text-xs"
                title="Remove custom key"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Test connection results banner */}
          {testResult && (
            <div className={`p-3 rounded-lg text-xs border flex items-start gap-2 animate-fadeIn ${
              testResult.success 
                ? 'bg-[#182618] border-[#3FB950]/40 text-[#3FB950]' 
                : 'bg-[#291717] border-red-500/30 text-red-400'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#3FB950]" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              )}
              <div className="flex-1">
                <div className="font-bold">{testResult.success ? '✅ Connected Successfully' : '❌ Connection Failed'}</div>
                <div className="text-[11px] opacity-90 mt-0.5">{testResult.message}</div>
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="text-[11px] text-white/40 leading-relaxed bg-[#0D1117] p-2.5 rounded-lg border border-white/5 space-y-1">
            <p>🔒 <strong>Encryption Guarantee:</strong> All BYOK keys are encrypted with AES-256-GCM before database storage and tied solely to your user account.</p>
            <p>💡 If no custom key is specified, Squeeze automatically routes your prompts through the managed platform cluster.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
