'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Key, 
  Save, 
  Trash2, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Shield,
  Cpu,
  Plug,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'zai' | 'groq' | 'deepseek';

interface UserCredential {
  provider: ProviderType;
  hasApiKey: boolean;
  maskedKey?: string;
}

interface MCPCredential {
  provider: string;
  displayName: string;
  description: string;
  hasApiKey: boolean;
  enabled: boolean;
}

interface CredentialsResponse {
  success: boolean;
  llmCredentials?: UserCredential[];
  mcpCredentials?: MCPCredential[];
  error?: string;
}

const LLM_PROVIDERS: { id: ProviderType; name: string; envKey: string }[] = [
  { id: 'gemini', name: 'Google Gemini', envKey: 'GEMINI_API_KEY' },
  { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic Claude', envKey: 'ANTHROPIC_API_KEY' },
  { id: 'zai', name: 'Z.ai GLM', envKey: 'ZAI_API_KEY' },
  { id: 'groq', name: 'Groq (FREE)', envKey: 'GROQ_API_KEY' },
  { id: 'deepseek', name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY' },
];

const MCP_PROVIDERS = [
  { id: 'exa-code', name: 'exa-code', description: 'Search code libraries and APIs' },
  { id: 'context7', name: 'context7', description: 'Query library documentation' },
];

type ViewMode = 'llm' | 'mcp';

export default function UserCredentialsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('llm');
  const [llmCredentials, setLlmCredentials] = useState<UserCredential[]>([]);
  const [mcpCredentials, setMcpCredentials] = useState<MCPCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // API key inputs
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const response = await fetch('/api/user/credentials');
      const data: CredentialsResponse = await response.json();
      
      if (data.success) {
        setLlmCredentials(data.llmCredentials || []);
        setMcpCredentials(data.mcpCredentials || []);
      } else {
        toast.error(data.error || 'Failed to load credentials');
      }
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
      toast.error('Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async (type: 'llm' | 'mcp', provider: string) => {
    const apiKey = apiKeys[provider];
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setSaving(true);
    try {
      const endpoint = type === 'llm' ? '/api/user/credentials/llm' : '/api/user/credentials/mcp';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        setApiKeys({ ...apiKeys, [provider]: '' });
        fetchCredentials();
      } else {
        toast.error(data.error || 'Failed to save API key');
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
      toast.error('Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (type: 'llm' | 'mcp', provider: string) => {
    const providerName = type === 'llm' 
      ? LLM_PROVIDERS.find(p => p.id === provider)?.name 
      : MCP_PROVIDERS.find(p => p.id === provider)?.name;
      
    if (!confirm(`Remove your ${providerName} API key?`)) return;

    try {
      const endpoint = type === 'llm' 
        ? `/api/user/credentials/llm?provider=${provider}`
        : `/api/user/credentials/mcp?provider=${encodeURIComponent(provider)}`;
        
      const response = await fetch(endpoint, { method: 'DELETE' });
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        fetchCredentials();
      } else {
        toast.error(data.error || 'Failed to remove API key');
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast.error('Failed to remove API key');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            My Credentials
          </h1>
          <p className="text-muted-foreground">
            Manage your personal API credentials for LLM and MCP services
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Cpu className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-600 dark:text-blue-400">LLM Credentials (Optional Override)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your credentials take priority over global settings. If not set, global credentials are used.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Plug className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-purple-600 dark:text-purple-400">MCP Credentials (Exclusive)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  MCP credentials are personal and exclusive. No global fallback.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LLM Section */}
      {viewMode === 'llm' && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              LLM API Credentials
            </CardTitle>
            <CardDescription>
              Your personal LLM credentials override global settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {LLM_PROVIDERS.map((provider) => {
              const credential = llmCredentials.find(c => c.provider === provider.id);
              const hasKey = credential?.hasApiKey;
              const keyId = `llm-${provider.id}`;
              const isVisible = showKey[keyId] ?? false;
              const inputValue = apiKeys[keyId] ?? '';

              return (
                <div key={provider.id} className="space-y-2 p-4 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">{provider.name}</Label>
                    <Badge variant={hasKey ? 'default' : 'secondary'}>
                      {hasKey ? 'Personal Key' : 'Not Set'}
                    </Badge>
                  </div>
                  
                  {credential?.maskedKey && (
                    <p className="text-xs text-muted-foreground font-mono">{credential.maskedKey}</p>
                  )}
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={isVisible ? 'text' : 'password'}
                        placeholder={`Enter ${provider.name} API key...`}
                        value={inputValue}
                        onChange={(e) => setApiKeys({ ...apiKeys, [keyId]: e.target.value })}
                        disabled={saving}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey({ ...showKey, [keyId]: !isVisible })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSaveKey('llm', provider.id)}
                      disabled={saving || !inputValue}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    {hasKey && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteKey('llm', provider.id)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* MCP Section */}
      {viewMode === 'mcp' && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              MCP Tool Credentials
            </CardTitle>
            <CardDescription>
              Your personal MCP credentials are required for code generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {MCP_PROVIDERS.map((provider) => {
              const credential = mcpCredentials.find(c => c.provider === provider.id);
              const hasKey = credential?.hasApiKey;
              const keyId = `mcp-${provider.id}`;
              const isVisible = showKey[keyId] ?? false;
              const inputValue = apiKeys[keyId] ?? '';

              return (
                <div key={provider.id} className="space-y-2 p-4 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">{provider.name}</Label>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                    </div>
                    <Badge variant={hasKey ? 'default' : 'destructive'}>
                      {hasKey ? 'Configured' : 'Not Set'}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={isVisible ? 'text' : 'password'}
                        placeholder={`Enter ${provider.name} API key...`}
                        value={inputValue}
                        onChange={(e) => setApiKeys({ ...apiKeys, [keyId]: e.target.value })}
                        disabled={saving}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey({ ...showKey, [keyId]: !isVisible })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSaveKey('mcp', provider.id)}
                      disabled={saving || !inputValue}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    {hasKey && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteKey('mcp', provider.id)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {!mcpCredentials.some(c => c.hasApiKey) && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    MCP credentials are required for accurate code generation. Enter your API keys to enable this feature.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={viewMode === 'llm' ? 'default' : 'ghost'}
          onClick={() => setViewMode('llm')}
          className="gap-2"
        >
          <Cpu className="h-4 w-4" />
          LLM Credentials
        </Button>
        <Button
          variant={viewMode === 'mcp' ? 'default' : 'ghost'}
          onClick={() => setViewMode('mcp')}
          className="gap-2"
        >
          <Plug className="h-4 w-4" />
          MCP Credentials
        </Button>
      </div>
    </div>
  );
}
