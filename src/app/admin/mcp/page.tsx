'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Key, 
  Save, 
  Trash2, 
  Eye, 
  EyeOff,
  RefreshCw,
  ExternalLink,
  Plug,
  Database,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';

interface MCPProvider {
  provider: string;
  displayName: string;
  description: string;
  docsUrl?: string;
  hasApiKey: boolean;
  enabled: boolean;
  connected?: boolean;
  lastCheckedAt?: string;
}

interface MCPConfigResponse {
  success: boolean;
  data?: MCPProvider[];
  encryptionConfigured?: boolean;
  error?: string;
}

interface MCPConfigRequest {
  provider: string;
  apiKey?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

const PROVIDER_INFO: Record<string, { name: string; docsUrl: string; envVar?: string }> = {
  'exa-code': {
    name: 'exa-code',
    docsUrl: 'https://exa.ai/docs/code',
    envVar: 'EXA_CODE_API_KEY',
  },
  'context7': {
    name: 'context7',
    docsUrl: 'https://context7.com',
    envVar: 'CONTEXT7_API_KEY',
  },
  'web-search': {
    name: 'Web Search',
    docsUrl: '',
    envVar: '',
  },
};

export default function MCPConfigPage() {
  const [providers, setProviders] = useState<MCPProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [encryptionConfigured, setEncryptionConfigured] = useState(false);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchMCPConfig();
  }, []);

  const fetchMCPConfig = async () => {
    try {
      const response = await fetch('/api/admin/mcp');
      const data: MCPConfigResponse = await response.json();

      if (data.success && data.data) {
        setProviders(data.data);
        setEncryptionConfigured(data.encryptionConfigured || false);
      } else {
        toast.error(data.error || 'Failed to load MCP configuration');
      }
    } catch (error) {
      console.error('Failed to fetch MCP config:', error);
      toast.error('Failed to load MCP configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async (provider: string) => {
    const apiKey = apiKeyInputs[provider];
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    if (!encryptionConfigured) {
      toast.error('Encryption not configured. Add ENCRYPTION_KEY to your environment.');
      return;
    }

    setSavingKey(provider);
    try {
      const response = await fetch('/api/admin/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          enabled: true,
        } as MCPConfigRequest),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setApiKeyInputs({ ...apiKeyInputs, [provider]: '' });
        fetchMCPConfig();
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

  const handleDeleteApiKey = async (provider: string) => {
    if (!confirm(`Are you sure you want to remove the ${PROVIDER_INFO[provider]?.name || provider} API key?`)) {
      return;
    }

    setDeleting(provider);
    try {
      const response = await fetch(`/api/admin/mcp?provider=${encodeURIComponent(provider)}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchMCPConfig();
      } else {
        toast.error(data.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast.error('Failed to delete API key');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleEnabled = async (provider: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/admin/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          enabled,
        } as MCPConfigRequest),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(`${PROVIDER_INFO[provider]?.name || provider} ${enabled ? 'enabled' : 'disabled'}`);
        fetchMCPConfig();
      } else {
        toast.error(data.error || 'Failed to update configuration');
      }
    } catch (error) {
      console.error('Failed to update configuration:', error);
      toast.error('Failed to update configuration');
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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="h-6 w-6 text-primary" />
          MCP Configuration
        </h1>
        <p className="text-muted-foreground">
          Configure Model Context Protocol tools for accurate code generation
        </p>
      </div>

      {/* Encryption Warning */}
      {!encryptionConfigured && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-500">Encryption Not Configured</p>
              <p className="text-sm text-muted-foreground">
                Add <code className="bg-muted px-1 rounded">ENCRYPTION_KEY</code> to your environment variables to enable secure API key storage.
                Without encryption, API keys cannot be stored in the database.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-600 dark:text-blue-400">About MCP Configuration</p>
              <p className="text-sm text-muted-foreground mt-1">
                MCP (Model Context Protocol) tools help the AI generate accurate, production-ready code by 
                searching real code patterns from libraries. API keys are stored encrypted in the database 
                (AES-256-GCM) and take precedence over environment variables.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Configure MCP tools in your Claude/AI assistant settings for full functionality.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => {
          const info = PROVIDER_INFO[provider.provider];
          
          return (
            <Card key={provider.provider} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {provider.provider}
                    {provider.connected ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : provider.hasApiKey ? (
                      <RefreshCw className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardTitle>
                  <Badge 
                    variant={provider.enabled ? 'default' : 'secondary'}
                    className={provider.enabled ? '' : 'opacity-50'}
                  >
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <CardDescription>{provider.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Docs Link */}
                {info?.docsUrl && (
                  <a 
                    href={info.docsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View documentation <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {/* Status */}
                <div className="flex items-center gap-2 flex-wrap">
                  {provider.hasApiKey ? (
                    <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/30">
                      <Database className="h-3 w-3 mr-1" />
                      DB Key
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      No Key
                    </Badge>
                  )}
                  {provider.lastCheckedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last checked: {new Date(provider.lastCheckedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Enable Provider</Label>
                  <Button
                    variant={provider.enabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleEnabled(provider.provider, !provider.enabled)}
                  >
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* API Key Input */}
                <div className="space-y-2">
                  <Label className="text-sm">
                    {provider.hasApiKey ? 'Update API Key' : 'Enter API Key'}
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showApiKey[provider.provider] ? 'text' : 'password'}
                        placeholder={`Enter ${info?.name || provider.provider} API key...`}
                        value={apiKeyInputs[provider.provider] || ''}
                        onChange={(e) => setApiKeyInputs({ 
                          ...apiKeyInputs, 
                          [provider.provider]: e.target.value 
                        })}
                        disabled={!encryptionConfigured || provider.hasApiKey}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey({ 
                          ...showApiKey, 
                          [provider.provider]: !showApiKey[provider.provider] 
                        })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey[provider.provider] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSaveApiKey(provider.provider)}
                      disabled={
                        !encryptionConfigured || 
                        savingKey === provider.provider || 
                        !apiKeyInputs[provider.provider]
                      }
                    >
                      {savingKey === provider.provider ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    {provider.hasApiKey && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteApiKey(provider.provider)}
                        disabled={deleting === provider.provider}
                      >
                        {deleting === provider.provider ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  {provider.hasApiKey && (
                    <p className="text-xs text-muted-foreground">
                      API key stored in database (encrypted). Environment variable will override.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help Section */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">How to Configure MCP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                Step 1: Get API Keys
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>
                  <a 
                    href="https://exa.ai" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    exa-code
                  </a>
                  {' '}- Get your API key from exa.ai dashboard
                </li>
                <li>
                  <a 
                    href="https://context7.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    context7
                  </a>
                  {' '}- Get your API key from context7.com
                </li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Plug className="h-4 w-4" />
                Step 2: Configure in Your AI Assistant
              </h4>
              <p className="text-sm text-muted-foreground">
                Add the following to your MCP configuration file:
              </p>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "exa-code": {
      "command": "uvx",
      "args": ["exa-code-mcp", "--api-key", "YOUR_KEY"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server", "--api-key", "YOUR_KEY"]
    }
  }
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
