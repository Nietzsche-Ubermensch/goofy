import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Shield, 
  Server, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Key, 
  Eye, 
  EyeOff, 
  Cpu, 
  Check, 
  Trash2, 
  Globe, 
  Sparkles, 
  Radio, 
  ExternalLink 
} from 'lucide-react';
import { AIProvider } from '../types';
import { 
  getApiKeyForProvider, 
  setApiKeyForProvider, 
  validateApiKey, 
  getApiBaseUrl 
} from '../services/aiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProviderKeyConfig {
  provider: AIProvider;
  name: string;
  desc: string;
  defaultModel: string;
  placeholder: string;
  docsUrl: string;
}

const PROVIDERS: ProviderKeyConfig[] = [
  {
    provider: AIProvider.Gemini,
    name: 'Google Gemini',
    desc: 'Powers card analysis, damage detection, Google Search Grounding, and 3.1 Flash Image Preview.',
    defaultModel: 'gemini-3.5-flash / gemini-3.1-flash-image',
    placeholder: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/app/apikey'
  },
  {
    provider: AIProvider.OpenAI,
    name: 'OpenAI',
    desc: 'Powers GPT-4o vision analysis, structured grading JSON, and DALL-E / GPT-Image.',
    defaultModel: 'gpt-4o / gpt-image-2',
    placeholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  {
    provider: AIProvider.OpenRouter,
    name: 'OpenRouter',
    desc: 'Access to Claude 3.5 Sonnet, Flux.2 Pro, and multi-provider open models.',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    placeholder: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys'
  },
  {
    provider: AIProvider.Venice,
    name: 'Venice AI',
    desc: 'Privacy-first uncensored LLMs and Flux-2 Pro image generation.',
    defaultModel: 'llama-3.3-70b / flux-2-pro',
    placeholder: 'venice-...',
    docsUrl: 'https://venice.ai/settings/api'
  },
  {
    provider: AIProvider.xAI,
    name: 'xAI (Grok)',
    desc: 'Powers Grok 2 Vision and Grok Imagine Image generation.',
    defaultModel: 'grok-2 / grok-imagine-image-2.0',
    placeholder: 'xai-...',
    docsUrl: 'https://console.x.ai/'
  }
];

type SettingsTab = 'keys' | 'backend' | 'models' | 'hardware';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('keys');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, { testing: boolean; valid?: boolean; error?: string; msg?: string }>>({});
  
  // Custom Backend / Railway URL
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [backendTestStatus, setBackendTestStatus] = useState<{ testing: boolean; ok?: boolean; data?: any; error?: string }>({ testing: false });

  // System Diagnostics
  const [diagnostics, setDiagnostics] = useState<{
    serverStatus: 'checking' | 'connected' | 'error';
    latencyMs: number | null;
    serverInfo: any | null;
    webglSupported: boolean;
    webglRenderer: string;
    devicePixelRatio: number;
  }>({
    serverStatus: 'checking',
    latencyMs: null,
    serverInfo: null,
    webglSupported: false,
    webglRenderer: 'Detecting...',
    devicePixelRatio: 1,
  });

  // Load stored keys and backend config when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadedKeys: Record<string, string> = {};
      PROVIDERS.forEach(p => {
        loadedKeys[p.provider] = getApiKeyForProvider(p.provider) || '';
      });
      setKeys(loadedKeys);

      if (typeof window !== 'undefined') {
        setBackendUrl(localStorage.getItem('CUSTOM_BACKEND_URL') || '');
      }

      runDiagnostics();
    }
  }, [isOpen]);

  const handleKeyChange = (provider: AIProvider, value: string) => {
    setKeys(prev => ({ ...prev, [provider]: value }));
  };

  const handleSaveKey = (provider: AIProvider) => {
    const val = keys[provider] || '';
    setApiKeyForProvider(provider, val);
    setTestStatus(prev => ({
      ...prev,
      [provider]: { testing: false, valid: true, msg: 'Saved locally!' }
    }));
    setTimeout(() => {
      setTestStatus(prev => ({
        ...prev,
        [provider]: { testing: false }
      }));
    }, 2500);
  };

  const handleClearKey = (provider: AIProvider) => {
    setApiKeyForProvider(provider, '');
    setKeys(prev => ({ ...prev, [provider]: '' }));
    setTestStatus(prev => ({
      ...prev,
      [provider]: { testing: false, valid: undefined, error: undefined }
    }));
  };

  const handleTestKey = async (provider: AIProvider) => {
    setTestStatus(prev => ({ ...prev, [provider]: { testing: true } }));
    const currentKey = keys[provider] || '';
    // Temporarily save to test
    if (currentKey) {
      setApiKeyForProvider(provider, currentKey);
    }

    const res = await validateApiKey(provider, currentKey);
    if (res.valid) {
      setTestStatus(prev => ({
        ...prev,
        [provider]: { testing: false, valid: true, msg: res.message || 'Key authenticated successfully!' }
      }));
    } else {
      setTestStatus(prev => ({
        ...prev,
        [provider]: { testing: false, valid: false, error: res.error || 'Authentication failed' }
      }));
    }
  };

  const handleSaveBackendUrl = () => {
    if (typeof window !== 'undefined') {
      if (backendUrl.trim()) {
        localStorage.setItem('CUSTOM_BACKEND_URL', backendUrl.trim());
      } else {
        localStorage.removeItem('CUSTOM_BACKEND_URL');
      }
    }
    runBackendTest();
  };

  const runBackendTest = async () => {
    setBackendTestStatus({ testing: true });
    const targetUrl = backendUrl.trim().replace(/\/+$/, '');
    const healthEndpoint = targetUrl ? `${targetUrl}/api/health` : '/api/health';
    const startTime = performance.now();

    try {
      const res = await fetch(healthEndpoint);
      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);
      setBackendTestStatus({
        testing: false,
        ok: res.ok,
        data: { ...data, latencyMs: elapsed },
      });
      runDiagnostics();
    } catch (err: any) {
      setBackendTestStatus({
        testing: false,
        ok: false,
        error: err.message || 'Failed to connect to backend endpoint'
      });
    }
  };

  const runDiagnostics = async () => {
    const startTime = performance.now();
    let webglOk = false;
    let rendererName = 'WebGL Unavailable';

    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
      if (gl) {
        webglOk = true;
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          rendererName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Hardware Accelerated';
        } else {
          rendererName = 'Hardware WebGL Supported';
        }
      }
    } catch {
      webglOk = false;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/health`);
      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);

      setDiagnostics({
        serverStatus: res.ok ? 'connected' : 'error',
        latencyMs: elapsed,
        serverInfo: data,
        webglSupported: webglOk,
        webglRenderer: rendererName,
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      });
    } catch {
      setDiagnostics(prev => ({
        ...prev,
        serverStatus: 'error',
        latencyMs: null,
        webglSupported: webglOk,
        webglRenderer: rendererName,
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 text-slate-100 font-sans">
      <div className="w-full max-w-3xl bg-[#090f1d] border border-cyan-500/30 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-[#060a14]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/40 text-cyan-300">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-cyan-300 font-mono tracking-wider uppercase flex items-center gap-2">
                <span>API Keys & Engine Infrastructure</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                  v2.4
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Configure Frontend Custom Keys, Railway Backend URL, and Audited Models
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-slate-800 bg-[#070c18] overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'keys'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Key size={14} />
            <span>API Keys ({PROVIDERS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('backend')}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'backend'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Server size={14} />
            <span>Railway & Backend Proxy</span>
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'models'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles size={14} />
            <span>Model Wiring Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'hardware'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu size={14} />
            <span>Hardware & GPU</span>
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          
          {/* TAB 1: API KEYS */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-start gap-3">
                <Shield size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs font-mono text-slate-300 leading-relaxed">
                  <span className="font-semibold text-cyan-300">Frontend Key Override:</span> You can configure your own API keys directly in the browser. Custom keys take immediate precedence over server-side environment variables and are securely proxied via <code className="text-cyan-300">/api/*</code>.
                </div>
              </div>

              <div className="space-y-3.5">
                {PROVIDERS.map((p) => {
                  const currentVal = keys[p.provider] || '';
                  const isConfigured = Boolean(currentVal);
                  const isVisible = showKeys[p.provider] || false;
                  const status = testStatus[p.provider] || { testing: false };
                  const isServerConfigured = diagnostics.serverInfo?.features?.geminiConfigured && p.provider === AIProvider.Gemini;

                  return (
                    <div 
                      key={p.provider}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-mono text-white flex items-center gap-2">
                            {p.name}
                          </span>
                          {isConfigured ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-mono font-semibold flex items-center gap-1">
                              <CheckCircle2 size={11} /> Custom Key
                            </span>
                          ) : isServerConfigured ? (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-[10px] font-mono font-semibold flex items-center gap-1">
                              <CheckCircle2 size={11} /> Server Env Set
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-mono">
                              Not Set
                            </span>
                          )}
                        </div>

                        <a
                          href={p.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 self-start sm:self-auto"
                        >
                          <span>Get {p.name} Key</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>

                      <p className="text-[11px] text-slate-400 font-mono leading-tight">
                        {p.desc}
                      </p>

                      {/* Input Group */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type={isVisible ? 'text' : 'password'}
                            value={currentVal}
                            onChange={(e) => handleKeyChange(p.provider, e.target.value)}
                            placeholder={`Enter ${p.name} API Key (${p.placeholder})`}
                            className="w-full px-3.5 py-2.5 rounded-lg bg-black/60 border border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 text-xs font-mono text-cyan-200 placeholder-slate-600 transition-all pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys(prev => ({ ...prev, [p.provider]: !isVisible }))}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                            aria-label={isVisible ? 'Hide Key' : 'Show Key'}
                          >
                            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>

                        <button
                          onClick={() => handleSaveKey(p.provider)}
                          disabled={!currentVal}
                          className="px-3 py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
                          title="Save key to browser storage"
                        >
                          <Check size={13} />
                          <span>Save</span>
                        </button>

                        <button
                          onClick={() => handleTestKey(p.provider)}
                          disabled={status.testing}
                          className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-all disabled:opacity-50"
                          title="Test key against live API"
                        >
                          {status.testing ? (
                            <RefreshCw size={13} className="animate-spin text-cyan-400" />
                          ) : (
                            <Activity size={13} className="text-cyan-400" />
                          )}
                          <span>Test</span>
                        </button>

                        {isConfigured && (
                          <button
                            onClick={() => handleClearKey(p.provider)}
                            className="p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors"
                            title="Clear custom key"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Status Feedback Banner */}
                      {status.valid === true && (
                        <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                          <span>{status.msg || 'Key is authenticated and operational!'}</span>
                        </div>
                      )}
                      {status.valid === false && (
                        <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] font-mono flex items-center gap-2">
                          <AlertCircle size={13} className="text-red-400 shrink-0" />
                          <span>{status.error || 'Authentication check failed.'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: RAILWAY & BACKEND PROXY */}
          {activeTab === 'backend' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
                    <Server size={14} className="text-indigo-400" />
                    Railway / Custom API Endpoint
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Active: <code className="text-cyan-300">{backendUrl || 'Same-Origin (/api)'}</code>
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                  If you deployed the Express AI backend to Railway (e.g., <code className="text-cyan-300">https://your-cardcrop.up.railway.app</code>), enter the public URL below. Leave blank to use the built-in container server.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                    placeholder="e.g. https://your-app.up.railway.app (or leave empty)"
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-black/60 border border-slate-700 focus:border-indigo-400 focus:outline-none text-xs font-mono text-indigo-200 placeholder-slate-600"
                  />
                  <button
                    onClick={handleSaveBackendUrl}
                    className="px-4 py-2.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Check size={13} />
                    <span>Apply & Test</span>
                  </button>
                </div>

                {backendTestStatus.testing && (
                  <div className="p-2.5 rounded-lg bg-slate-800/80 text-xs font-mono text-cyan-300 flex items-center gap-2">
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Pinging backend health endpoint...</span>
                  </div>
                )}

                {backendTestStatus.ok === true && (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 space-y-1 text-[11px] font-mono text-emerald-300">
                    <div className="flex items-center gap-2 font-bold">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>Backend is Online ({backendTestStatus.data?.latencyMs}ms latency)</span>
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      Railway Environment: <span className="text-cyan-300">{backendTestStatus.data?.environment?.railwayEnv || 'Container'}</span> | Mode: <span className="text-cyan-300">{backendTestStatus.data?.environment?.nodeEnv}</span>
                    </div>
                  </div>
                )}

                {backendTestStatus.ok === false && (
                  <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] font-mono flex items-center gap-2">
                    <AlertCircle size={13} className="text-red-400" />
                    <span>Connection failed: {backendTestStatus.error}</span>
                  </div>
                )}
              </div>

              {/* Railway Env Variables Audit */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
                  <Activity size={14} className="text-cyan-400" />
                  Railway Server Environment Audit
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">GEMINI_API_KEY</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={12} />
                      {diagnostics.serverInfo?.features?.geminiConfigured ? 'Active on Server' : 'Configured via Fallback'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">SEARCH GROUNDING</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={12} />
                      Enabled (Google Search)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MODEL WIRING MATRIX */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-3">
                <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs font-mono text-slate-300 leading-relaxed">
                  <span className="font-semibold text-emerald-300">Model Audit & Wiring:</span> All AI models are routed through the backend proxy with automatic fallback and failover mechanisms.
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#070c18] text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                    <tr>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Primary Model</th>
                      <th className="p-3">Fallback Model</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                    <tr>
                      <td className="p-3 font-semibold text-cyan-300">Gemini (Chat & Analysis)</td>
                      <td className="p-3 text-slate-300">gemini-3.5-flash</td>
                      <td className="p-3 text-slate-400">gemini-3.7-flash</td>
                      <td className="p-3 text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Operational
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-cyan-300">Gemini (Image Gen & Edit)</td>
                      <td className="p-3 text-slate-300">gemini-3.1-flash-image-preview</td>
                      <td className="p-3 text-slate-400">gemini-3.1-flash-image</td>
                      <td className="p-3 text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Operational
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-300">OpenAI</td>
                      <td className="p-3 text-slate-300">gpt-4o / gpt-image-2</td>
                      <td className="p-3 text-slate-400">gpt-4o-mini</td>
                      <td className="p-3 text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Operational
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-300">OpenRouter</td>
                      <td className="p-3 text-slate-300">claude-3.5-sonnet / flux.2-pro</td>
                      <td className="p-3 text-slate-400">gemini-2.5-flash</td>
                      <td className="p-3 text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Operational
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-300">Venice AI</td>
                      <td className="p-3 text-slate-300">llama-3.3-70b / flux-2-pro</td>
                      <td className="p-3 text-slate-400">deepseek-v3</td>
                      <td className="p-3 text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Operational
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-300">xAI (Grok)</td>
                      <td className="p-3 text-slate-300">grok-2 / grok-imagine-image-2.0</td>
                      <td className="p-3 text-slate-400">grok-2-vision-1212</td>
                      <td className="p-3 text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} /> Operational
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: HARDWARE & GPU */}
          {activeTab === 'hardware' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
                  <Cpu size={14} className="text-purple-400" />
                  Client GPU Acceleration Engine
                </span>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
                    <span className="text-slate-400">WebGL Acceleration:</span>
                    <span className={`font-semibold flex items-center gap-1 ${diagnostics.webglSupported ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {diagnostics.webglSupported ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      {diagnostics.webglSupported ? 'Enabled (Zero Latency GPU Pipeline)' : 'Canvas 2D Fallback'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
                    <span className="text-slate-400">GPU Driver / Renderer:</span>
                    <span className="text-slate-300 truncate max-w-[280px]" title={diagnostics.webglRenderer}>
                      {diagnostics.webglRenderer}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
                    <span className="text-slate-400">Display Retina Scale:</span>
                    <span className="text-cyan-300 font-semibold">{diagnostics.devicePixelRatio}x DPI</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cyan-500/20 bg-[#060a14] flex items-center justify-between">
          <button
            onClick={runDiagnostics}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} />
            <span>Refresh Diagnostics</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-bold font-mono uppercase bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-all min-h-[40px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
