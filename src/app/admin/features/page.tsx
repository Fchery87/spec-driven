'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SYSTEM_FEATURES = [
  { key: 'feature_email_verification', label: 'Email Verification', description: 'Require email verification for new accounts' },
  { key: 'feature_oauth_google', label: 'Google OAuth', description: 'Enable Google sign-in' },
  { key: 'feature_project_sharing', label: 'Project Sharing', description: 'Allow users to share projects with others' },
  { key: 'feature_handoff_export', label: 'Handoff Export', description: 'Enable ZIP export of project handoffs' },
  { key: 'feature_advanced_analytics', label: 'Advanced Analytics', description: 'Show detailed project analytics' },
];

export default function FeaturesPage() {
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newFlagDialog, setNewFlagDialog] = useState(false);
  const [newFlagKey, setNewFlagKey] = useState('');
  const [newFlagValue, setNewFlagValue] = useState('');

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const response = await fetch('/api/admin/settings?prefix=feature_');
      const data = await response.json();
      if (data.success) {
        setFeatures(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch features:', error);
      toast.error('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, enabled: boolean) => {
    setSaving(key);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: enabled ? 'true' : 'false' }),
      });
      setFeatures({ ...features, [key]: enabled ? 'true' : 'false' });
      toast.success(`Feature ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle feature:', error);
      toast.error('Failed to update feature');
    } finally {
      setSaving(null);
    }
  };

  const handleAddFlag = async () => {
    if (!newFlagKey) {
      toast.error('Flag key is required');
      return;
    }

    const key = newFlagKey.startsWith('feature_') ? newFlagKey : `feature_${newFlagKey}`;
    
    setSaving(key);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: newFlagValue || 'true' }),
      });
      setFeatures({ ...features, [key]: newFlagValue || 'true' });
      setNewFlagDialog(false);
      setNewFlagKey('');
      setNewFlagValue('');
      toast.success('Feature flag added');
    } catch (error) {
      console.error('Failed to add flag:', error);
      toast.error('Failed to add feature flag');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteFlag = async (key: string) => {
    setSaving(key);
    try {
      await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      const newFeatures = { ...features };
      delete newFeatures[key];
      setFeatures(newFeatures);
      toast.success('Feature flag deleted');
    } catch (error) {
      console.error('Failed to delete flag:', error);
      toast.error('Failed to delete feature flag');
    } finally {
      setSaving(null);
    }
  };

  const isEnabled = (key: string) => features[key] === 'true';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const customFlags = Object.keys(features).filter(
    (key) => !SYSTEM_FEATURES.some((f) => f.key === key)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Feature Flags
          </h1>
          <p className="text-muted-foreground">Toggle system features on or off</p>
        </div>
        <Button onClick={() => setNewFlagDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Flag
        </Button>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>System Features</CardTitle>
          <CardDescription>Core platform functionality toggles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {SYSTEM_FEATURES.map((feature) => (
            <div
              key={feature.key}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{feature.label}</p>
                  {isEnabled(feature.key) ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
              <Switch
                checked={isEnabled(feature.key)}
                onCheckedChange={(checked) => handleToggle(feature.key, checked)}
                disabled={saving === feature.key}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {customFlags.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Custom Flags</CardTitle>
            <CardDescription>User-defined feature flags</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {customFlags.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium font-mono text-sm">{key}</p>
                    <Badge variant="outline">{features[key]}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isEnabled(key)}
                    onCheckedChange={(checked) => handleToggle(key, checked)}
                    disabled={saving === key}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFlag(key)}
                    disabled={saving === key}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={newFlagDialog} onOpenChange={setNewFlagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Feature Flag</DialogTitle>
            <DialogDescription>
              Create a new feature flag to control application behavior
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Flag Key</Label>
              <Input
                placeholder="my_feature"
                value={newFlagKey}
                onChange={(e) => setNewFlagKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Will be prefixed with feature_ if not already
              </p>
            </div>
            <div className="space-y-2">
              <Label>Initial Value</Label>
              <Input
                placeholder="true"
                value={newFlagValue}
                onChange={(e) => setNewFlagValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFlagDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFlag} disabled={!!saving}>
              <Save className="h-4 w-4 mr-2" />
              Add Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
