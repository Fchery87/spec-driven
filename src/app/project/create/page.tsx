'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Lightbulb, Settings, Zap } from 'lucide-react';

export default function CreateProject() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to project workflow page
        router.push(`/project/${result.data.slug}`);
      } else {
        setError(result.error || 'Failed to create project');
      }
    } catch (err) {
      setError('Failed to create project');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>
              Start a new spec-driven project by providing basic information
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-900">
                  Project Name *
                </label>
                <Input
                  type="text"
                  placeholder="e.g., AI-powered Customer Support Platform"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="w-full"
                />
                <p className="text-xs text-slate-600">
                  A clear, descriptive name for your project
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-900">
                  Brief Description
                </label>
                <textarea
                  placeholder="Describe what this project does in a few sentences..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                />
                <p className="text-xs text-slate-600">
                  Optional: Helps provide context during spec generation
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex-1"
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg">ANALYSIS</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Your initial project will start in the ANALYSIS phase where AI agents generate:
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Project Constitution</li>
                <li>Project Brief</li>
                <li>User Personas</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-5 w-5 text-slate-600" />
                <CardTitle className="text-lg">Workflow</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Projects progress through 6 phases:
              <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
                <li>Analysis → Stack Selection</li>
                <li>Specs → Dependencies</li>
                <li>Solutioning → Done</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-lg">Output</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              At the end, you'll get:
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Complete specifications</li>
                <li>Technology decisions</li>
                <li>Ready-to-use prompts</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
