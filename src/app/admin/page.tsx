'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, FolderOpen, Cpu, Settings, Activity, Clock } from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  llmModel: string;
  llmProvider: string;
  featureFlags: number;
}

const PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  zai: 'Z.ai GLM',
  groq: 'Groq (FREE)',
  deepseek: 'DeepSeek',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        if (data.success) {
          setStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and quick actions</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold">{stats?.totalUsers ?? 0}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-3xl font-bold">{stats?.totalProjects ?? 0}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-3xl font-bold text-amber-600">{stats?.activeProjects ?? 0}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold text-emerald-600">{stats?.completedProjects ?? 0}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              LLM Configuration
            </CardTitle>
            <CardDescription>Current AI model settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Model</span>
                <Badge variant="secondary">{stats?.llmModel ?? 'gemini-2.5-flash'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Provider</span>
                <Badge variant="outline">{PROVIDER_NAMES[stats?.llmProvider ?? 'gemini'] ?? stats?.llmProvider}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Feature Flags
            </CardTitle>
            <CardDescription>System feature configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Flags</span>
                <Badge variant="secondary">{stats?.featureFlags ?? 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email Verification</span>
                <Badge variant="outline">Disabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">OAuth Providers</span>
                <Badge variant="outline">Google</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a href="/admin/users" className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <Users className="h-5 w-5 text-primary mb-2" />
              <p className="font-medium">Manage Users</p>
              <p className="text-xs text-muted-foreground">View and edit user accounts</p>
            </a>
            <a href="/admin/llm" className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <Cpu className="h-5 w-5 text-primary mb-2" />
              <p className="font-medium">LLM Settings</p>
              <p className="text-xs text-muted-foreground">Configure AI model settings</p>
            </a>
            <a href="/admin/features" className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <Settings className="h-5 w-5 text-primary mb-2" />
              <p className="font-medium">Feature Flags</p>
              <p className="text-xs text-muted-foreground">Toggle system features</p>
            </a>
            <a href="/admin/projects" className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <FolderOpen className="h-5 w-5 text-primary mb-2" />
              <p className="font-medium">All Projects</p>
              <p className="text-xs text-muted-foreground">View all user projects</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
