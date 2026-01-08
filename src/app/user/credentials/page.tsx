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
  ArrowLeft,
  Lock
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

  // Calculate credential stats for header
  const llmConfigured = llmCredentials.filter(c => c.hasApiKey).length;
  const mcpConfigured = mcpCredentials.filter(c => c.hasApiKey).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
          <div className="flex items-center justify-center h-64">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        {/* Header Section */}
        <section className="relative mb-8">
          <div className="gradient-header dark:gradient-header-dark rounded-3xl p-8 md:p-10 border border-border/50">
            {/* Back Button */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/dashboard')}
              className="mb-6 -ml-2 gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="space-y-4">
                <Badge className="bg-primary/15 text-primary border-primary/30 border px-3 py-1">
                  Personal Credentials
                </Badge>
                
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  My Credentials
                </h1>
                
                <p className="text-muted-foreground max-w-xl">
                  Manage your personal API credentials for LLM and MCP services. 
                  Your credentials are encrypted and stored securely.
                </p>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-background/60 border border-border/50 flex items-center justify-center">
                    <Cpu className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{llmConfigured}/{LLM_PROVIDERS.length}</p>
                    <p className="text-xs text-muted-foreground">LLM configured</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-background/60 border border-border/50 flex items-center justify-center">
                    <Plug className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{mcpConfigured}/{MCP_PROVIDERS.length}</p>
                    <p className="text-xs text-muted-foreground">MCP configured</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={viewMode === 'llm' ? 'default' : 'outline'}
            onClick={() => setViewMode('llm')}
            className="gap-2"
          >
            <Cpu className="h-4 w-4" />
            LLM Credentials
          </Button>
          <Button
            variant={viewMode === 'mcp' ? 'default' : 'outline'}
            onClick={() => setViewMode('mcp')}
            className="gap-2"
          >
            <Plug className="h-4 w-4" />
            MCP Credentials
          </Button>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className={`transition-all duration-300 ${viewMode === 'llm' ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20' : 'border-border/50 bg-card/50 opacity-60'}`}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Cpu className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-blue-600 dark:text-blue-400">LLM Credentials</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your credentials take priority over global settings. If not set, global credentials are used.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`transition-all duration-300 ${viewMode === 'mcp' ? 'border-purple-500/50 bg-purple-500/5 ring-1 ring-purple-500/20' : 'border-border/50 bg-card/50 opacity-60'}`}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Plug className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-semibold text-purple-600 dark:text-purple-400">MCP Credentials</p>
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
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Cpu className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">LLM API Credentials</CardTitle>
                  <CardDescription>
                    Your personal LLM credentials override global settings.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {LLM_PROVIDERS.map((provider) => {
                const credential = llmCredentials.find(c => c.provider === provider.id);
                const hasKey = credential?.hasApiKey;
                const keyId = `llm-${provider.id}`;
                const isVisible = showKey[keyId] ?? false;
                const inputValue = apiKeys[keyId] ?? '';

                return (
                  <div key={provider.id} className="space-y-3 p-4 rounded-xl border border-border/50 bg-muted/30 hover:border-border transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-background/80 border border-border/50 flex items-center justify-center">
                          <Key className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Label className="font-medium text-foreground">{provider.name}</Label>
                      </div>
                      <Badge 
                        variant={hasKey ? 'default' : 'secondary'}
                        className={hasKey ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 border' : ''}
                      >
                        {hasKey ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Personal Key</>
                        ) : (
                          'Not Set'
                        )}
                      </Badge>
                    </div>
                    
                    {credential?.maskedKey && (
                      <p className="text-xs text-muted-foreground font-mono pl-11">{credential.maskedKey}</p>
                    )}
                    
                    <div className="flex gap-2 pl-11">
                      <div className="relative flex-1">
                        <Input
                          type={isVisible ? 'text' : 'password'}
                          placeholder={`Enter ${provider.name} API key...`}
                          value={inputValue}
                          onChange={(e) => setApiKeys({ ...apiKeys, [keyId]: e.target.value })}
                          disabled={saving}
                          className="pr-10 bg-background/80"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey({ ...showKey, [keyId]: !isVisible })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSaveKey('llm', provider.id)}
                        disabled={saving || !inputValue}
                        className="gap-1"
                      >
                        <Save className="h-4 w-4" />
                        Save
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
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Plug className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">MCP Tool Credentials</CardTitle>
                  <CardDescription>
                    Your personal MCP credentials are required for code generation.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {MCP_PROVIDERS.map((provider) => {
                const credential = mcpCredentials.find(c => c.provider === provider.id);
                const hasKey = credential?.hasApiKey;
                const keyId = `mcp-${provider.id}`;
                const isVisible = showKey[keyId] ?? false;
                const inputValue = apiKeys[keyId] ?? '';

                return (
                  <div key={provider.id} className="space-y-3 p-4 rounded-xl border border-border/50 bg-muted/30 hover:border-border transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-background/80 border border-border/50 flex items-center justify-center">
                          <Key className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <Label className="font-medium text-foreground">{provider.name}</Label>
                          <p className="text-xs text-muted-foreground">{provider.description}</p>
                        </div>
                      </div>
                      <Badge 
                        variant={hasKey ? 'default' : 'destructive'}
                        className={hasKey ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 border' : ''}
                      >
                        {hasKey ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Configured</>
                        ) : (
                          'Required'
                        )}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2 pl-11">
                      <div className="relative flex-1">
                        <Input
                          type={isVisible ? 'text' : 'password'}
                          placeholder={`Enter ${provider.name} API key...`}
                          value={inputValue}
                          onChange={(e) => setApiKeys({ ...apiKeys, [keyId]: e.target.value })}
                          disabled={saving}
                          className="pr-10 bg-background/80"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey({ ...showKey, [keyId]: !isVisible })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSaveKey('mcp', provider.id)}
                        disabled={saving || !inputValue}
                        className="gap-1"
                      >
                        <Save className="h-4 w-4" />
                        Save
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
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium text-amber-600 dark:text-amber-400">MCP credentials required</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        MCP credentials are required for accurate code generation. Enter your API keys to enable this feature.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Security Note */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>All credentials are encrypted at rest and never exposed in logs</span>
        </div>
      </div>
    </main>
  );
}
