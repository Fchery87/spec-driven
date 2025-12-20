'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Cpu, Save, RefreshCw, CheckCircle, XCircle, AlertTriangle, Key, Eye, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'zai' | 'groq' | 'deepseek';

interface LLMConfig {
  llm_provider: ProviderType;
  llm_model: string;
  llm_temperature: string;
  llm_max_tokens: string;
  llm_timeout: string;
}

interface ProviderStatus {
  configured: boolean;
  connected?: boolean;
  error?: string;
}

interface SecretStatus {
  hasEnvKey: boolean;
  hasDbKey: boolean;
  maskedKey?: string;
  source?: 'env' | 'db';
}

const PROVIDER_INFO: Record<ProviderType, { name: string; envKey: string; docsUrl: string }> = {
  gemini: {
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    docsUrl: 'https://ai.google.dev/docs',
  },
  openai: {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/docs',
  },
  anthropic: {
    name: 'Anthropic Claude',
    envKey: 'ANTHROPIC_API_KEY',
    docsUrl: 'https://docs.anthropic.com',
  },
  zai: {
    name: 'Z.ai GLM',
    envKey: 'ZAI_API_KEY',
    docsUrl: 'https://docs.z.ai/api-reference/introduction',
  },
  groq: {
    name: 'Groq (FREE)',
    envKey: 'GROQ_API_KEY',
    docsUrl: 'https://console.groq.com/docs',
  },
  deepseek: {
    name: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    docsUrl: 'https://platform.deepseek.com/docs',
  },
};

const PROVIDER_MODELS: Record<ProviderType, { id: string; name: string; description: string }[]> = {
  gemini: [
    { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash', description: 'Latest, fastest, most efficient' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, efficient for most tasks' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable, higher quality' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous generation, stable' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, multimodal' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous flagship model' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and economical' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest balanced model' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Fast and capable' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest, most affordable' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful' },
  ],
  zai: [
    { id: 'glm-4.6', name: 'GLM-4.6', description: 'Latest flagship model' },
    { id: 'glm-4-plus', name: 'GLM-4 Plus', description: 'High performance model' },
    { id: 'glm-4-air', name: 'GLM-4 Air', description: 'Balanced performance' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash', description: 'Most economical' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Most capable, versatile (FREE)' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fast, efficient (FREE)' },
    { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision', description: 'Multimodal (FREE)' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'MoE model, 32k context (FREE)' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', description: 'Google Gemma (FREE)' },
  ],
  deepseek: [
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: '64K output, best for large docs ($0.12/proj)' },
    { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '8K output, fast & cheap ($0.06/proj)' },
  ],
};

const DEFAULT_CONFIG: LLMConfig = {
  llm_provider: 'gemini',
  llm_model: 'gemini-2.5-flash',
  llm_temperature: '0.7',
  llm_max_tokens: '8192',
  llm_timeout: '120',
};

// Provider-specific optimal settings - automatically applied when switching providers
const PROVIDER_DEFAULTS: Record<ProviderType, { model: string; max_tokens: string; timeout: string; description: string }> = {
  gemini: {
    model: 'gemini-2.5-flash',
    max_tokens: '8192',
    timeout: '120',
    description: 'Free tier available, 8K output limit',
  },
  openai: {
    model: 'gpt-4o-mini',
    max_tokens: '16384',
    timeout: '120',
    description: 'GPT-4o-mini has 16K output limit',
  },
  anthropic: {
    model: 'claude-3-5-haiku-20241022',
    max_tokens: '8192',
    timeout: '120',
    description: 'Claude 3.5 Haiku has 8K output limit',
  },
  zai: {
    model: 'glm-4.6',
    max_tokens: '8192',
    timeout: '300',
    description: 'Z.ai reasoning model, slower responses',
  },
  groq: {
    model: 'llama-3.3-70b-versatile',
    max_tokens: '32768',
    timeout: '120',
    description: 'FREE! Llama 3.3 has 32K output limit',
  },
  deepseek: {
    model: 'deepseek-reasoner',
    max_tokens: '65536',
    timeout: '300',
    description: 'Best value! 64K output, handles full templates',
  },
};

export default function LLMConfigPage() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerStatus, setProviderStatus] = useState<Record<ProviderType, ProviderStatus>>({
    gemini: { configured: false },
    openai: { configured: false },
    anthropic: { configured: false },
    zai: { configured: false },
    groq: { configured: false },
    deepseek: { configured: false },
  });
  const [secretsStatus, setSecretsStatus] = useState<Record<string, SecretStatus>>({});
  const [encryptionConfigured, setEncryptionConfigured] = useState(false);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<ProviderType, string>>({
    gemini: '',
    openai: '',
    anthropic: '',
    zai: '',
    groq: '',
    deepseek: '',
  });
  const [showApiKey, setShowApiKey] = useState<Record<ProviderType, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    zai: false,
    groq: false,
    deepseek: false,
  });
  const [savingKey, setSavingKey] = useState<ProviderType | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchProviderStatus();
    fetchSecretsStatus();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/settings?prefix=llm_');
      const data = await response.json();
      if (data.success) {
        setConfig({
          ...DEFAULT_CONFIG,
          ...data.data,
        });
      }
    } catch (error) {
      console.error('Failed to fetch LLM config:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderStatus = async () => {
    try {
      const response = await fetch('/api/admin/llm-providers');
      const data = await response.json();
      if (data.success) {
        setProviderStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch provider status:', error);
    }
  };

  const fetchSecretsStatus = async () => {
    try {
      const response = await fetch('/api/admin/secrets');
      const data = await response.json();
      if (data.success) {
        setSecretsStatus(data.data);
        setEncryptionConfigured(data.encryptionConfigured);
      }
    } catch (error) {
      console.error('Failed to fetch secrets status:', error);
    }
  };

  const handleProviderChange = (provider: ProviderType) => {
    const providerDefaults = PROVIDER_DEFAULTS[provider];
    setConfig({
      ...config,
      llm_provider: provider,
      llm_model: providerDefaults.model,
      llm_max_tokens: providerDefaults.max_tokens,
      llm_timeout: providerDefaults.timeout,
    });
    toast.info(`Switched to ${PROVIDER_INFO[provider].name} with optimal settings (${providerDefaults.description})`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(config)) {
        await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        });
      }
      toast.success('LLM configuration saved');
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = async (provider: ProviderType) => {
    const apiKey = apiKeyInputs[provider];
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setSavingKey(provider);
    try {
      const response = await fetch('/api/admin/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        setApiKeyInputs({ ...apiKeyInputs, [provider]: '' });
        fetchSecretsStatus();
        fetchProviderStatus();
      } else {
        toast.error(data.error || 'Failed to save API key');
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
      toast.error('Failed to save API key');
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteApiKey = async (provider: ProviderType) => {
    if (!confirm(`Are you sure you want to remove the ${PROVIDER_INFO[provider].name} API key from the database?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/secrets?provider=${provider}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        fetchSecretsStatus();
        fetchProviderStatus();
      } else {
        toast.error(data.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    toast.info('Configuration reset to defaults (not saved)');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const currentProvider = config.llm_provider || 'gemini';
  const availableModels = PROVIDER_MODELS[currentProvider] || [];
  const selectedModel = availableModels.find(m => m.id === config.llm_model);
  const currentProviderStatus = providerStatus[currentProvider];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cpu className="h-6 w-6 text-primary" />
          LLM Configuration
        </h1>
        <p className="text-muted-foreground">Configure AI model settings for the orchestrator</p>
      </div>

      {/* Provider Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {(Object.keys(PROVIDER_INFO) as ProviderType[]).map((provider) => {
          const info = PROVIDER_INFO[provider];
          const status = providerStatus[provider];
          const secret = secretsStatus[provider];
          const isActive = currentProvider === provider;
          
          return (
            <Card 
              key={provider}
              className={`border-border/50 cursor-pointer transition-all ${
                isActive ? 'ring-2 ring-primary bg-primary/5' : 'bg-card/50 hover:bg-card/80'
              }`}
              onClick={() => handleProviderChange(provider)}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{info.name}</span>
                  {(status?.configured || secret?.hasDbKey) ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {secret?.hasEnvKey && (
                    <Badge variant="secondary" className="text-xs">ENV</Badge>
                  )}
                  {secret?.hasDbKey && (
                    <Badge variant="outline" className="text-xs">DB</Badge>
                  )}
                  {isActive && <Badge className="text-xs">Active</Badge>}
                </div>
                {secret?.maskedKey && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">{secret.maskedKey}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Warning if provider not configured */}
      {!currentProviderStatus?.configured && !secretsStatus[currentProvider]?.hasDbKey && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-500">Provider Not Configured</p>
              <p className="text-sm text-muted-foreground">
                Add <code className="bg-muted px-1 rounded">{PROVIDER_INFO[currentProvider].envKey}</code> to your environment variables or enter an API key below.
                <a 
                  href={PROVIDER_INFO[currentProvider].docsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-primary hover:underline"
                >
                  View docs
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Key Management */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key Management
          </CardTitle>
          <CardDescription>
            Securely store API keys in the database (encrypted with AES-256-GCM).
            Environment variables always take priority.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!encryptionConfigured && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/50 text-sm">
              <p className="font-medium text-yellow-500">Encryption Not Configured</p>
              <p className="text-muted-foreground">
                Add <code className="bg-muted px-1 rounded">ENCRYPTION_KEY</code> to your environment to enable secure API key storage.
              </p>
            </div>
          )}
          
          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(PROVIDER_INFO) as ProviderType[]).map((provider) => {
              const info = PROVIDER_INFO[provider];
              const secret = secretsStatus[provider];
              
              return (
                <div key={provider} className="space-y-2 p-4 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">{info.name}</Label>
                    <div className="flex items-center gap-1">
                      {secret?.hasEnvKey && (
                        <Badge variant="secondary" className="text-xs">From ENV</Badge>
                      )}
                      {secret?.hasDbKey && !secret?.hasEnvKey && (
                        <Badge variant="outline" className="text-xs">From DB</Badge>
                      )}
                    </div>
                  </div>
                  
                  {secret?.maskedKey && (
                    <p className="text-xs text-muted-foreground font-mono">{secret.maskedKey}</p>
                  )}
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showApiKey[provider] ? 'text' : 'password'}
                        placeholder={`Enter ${info.name} API key...`}
                        value={apiKeyInputs[provider]}
                        onChange={(e) => setApiKeyInputs({ ...apiKeyInputs, [provider]: e.target.value })}
                        disabled={!encryptionConfigured || secret?.hasEnvKey}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey({ ...showApiKey, [provider]: !showApiKey[provider] })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey[provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSaveApiKey(provider)}
                      disabled={!encryptionConfigured || savingKey === provider || secret?.hasEnvKey || !apiKeyInputs[provider]}
                    >
                      {savingKey === provider ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    {secret?.hasDbKey && !secret?.hasEnvKey && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteApiKey(provider)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {secret?.hasEnvKey && (
                    <p className="text-xs text-muted-foreground">
                      Using environment variable. Database key disabled.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Model Selection</CardTitle>
            <CardDescription>Choose the AI model for {PROVIDER_INFO[currentProvider].name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={config.llm_model}
                onValueChange={(value) => setConfig({ ...config, llm_model: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div>
                        <p className="font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">{model.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedModel && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{selectedModel.name}</span>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Generation Parameters</CardTitle>
            <CardDescription>Fine-tune model behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Temperature</Label>
                <Badge variant="outline">{config.llm_temperature}</Badge>
              </div>
              <Slider
                value={[parseFloat(config.llm_temperature)]}
                min={0}
                max={1}
                step={0.1}
                onValueChange={([value]) => setConfig({ ...config, llm_temperature: value.toString() })}
              />
              <p className="text-xs text-muted-foreground">
                Lower values produce more focused output, higher values increase creativity
              </p>
            </div>

            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={config.llm_max_tokens}
                onChange={(e) => setConfig({ ...config, llm_max_tokens: e.target.value })}
                min={1024}
                max={65536}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of tokens in the response (1024-65536)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Timeout (seconds)</Label>
              <Input
                type="number"
                value={config.llm_timeout}
                onChange={(e) => setConfig({ ...config, llm_timeout: e.target.value })}
                min={30}
                max={600}
              />
              <p className="text-xs text-muted-foreground">
                Request timeout in seconds (30-600)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Configuration Changes</p>
              <p className="text-sm text-muted-foreground">
                Changes will apply to new generation requests
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} disabled={saving}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
