'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';

interface Project {
  slug: string;
  name: string;
  current_phase: string;
  stack_choice?: string;
  stack_approved: boolean;
  dependencies_approved: boolean;
  created_at: string;
  stats?: {
    total_artifacts: number;
    total_size: number;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProjectToDelete, setSelectedProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      const result = await response.json();

      if (result.success) {
        setProjects(result.data);
      } else {
        setError(result.error || 'Failed to fetch projects');
      }
    } catch (err) {
      setError('Failed to fetch projects');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewProject = () => {
    router.push('/project/create');
  };

  const handleOpenProject = (slug: string) => {
    router.push(`/project/${slug}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setSelectedProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedProjectToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectToDelete.slug}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        setDeleteDialogOpen(false);
        setSelectedProjectToDelete(null);
        // Refresh the projects list
        fetchProjects();
      } else {
        setError(result.error || 'Failed to delete project');
      }
    } catch (err) {
      setError('Failed to delete project');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const getPhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      ANALYSIS: 'bg-blue-100 text-blue-800',
      STACK_SELECTION: 'bg-purple-100 text-purple-800',
      SPEC: 'bg-indigo-100 text-indigo-800',
      DEPENDENCIES: 'bg-cyan-100 text-cyan-800',
      SOLUTIONING: 'bg-teal-100 text-teal-800',
      DONE: 'bg-green-100 text-green-800'
    };
    return colors[phase] || 'bg-slate-100 text-slate-800';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Projects</h1>
            <p className="text-lg text-slate-600">
              Manage your spec-driven projects
            </p>
          </div>
          <Button size="lg" onClick={handleNewProject} className="px-8">
            + New Project
          </Button>
        </div>

        {/* Error message */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-slate-600">Loading projects...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && !error && (
          <Card>
            <CardContent className="pt-12 text-center">
              <p className="text-slate-600 mb-6">
                No projects yet. Create one to get started!
              </p>
              <Button onClick={handleNewProject}>Create First Project</Button>
            </CardContent>
          </Card>
        )}

        {/* Projects grid */}
        {!loading && projects.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.slug}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleOpenProject(project.slug)}
              >
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2">{project.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Badge className={getPhaseColor(project.current_phase)}>
                        {project.current_phase}
                      </Badge>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteClick(e, project)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Stack info */}
                    {project.stack_choice && (
                      <div className="text-sm">
                        <p className="text-slate-600">Stack:</p>
                        <p className="text-slate-900 font-medium">
                          {project.stack_choice.replace(/_/g, ' ')}
                        </p>
                      </div>
                    )}

                    {/* Approvals */}
                    <div className="text-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${project.stack_approved ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                        <span className="text-slate-600">Stack Approved</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${project.dependencies_approved ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                        <span className="text-slate-600">Dependencies Approved</span>
                      </div>
                    </div>

                    {/* Stats */}
                    {project.stats && (
                      <div className="text-sm text-slate-600">
                        {project.stats.total_artifacts} artifacts
                      </div>
                    )}

                    {/* Created date */}
                    <div className="text-xs text-slate-500">
                      {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedProjectToDelete?.name}"? This action cannot be undone and will permanently remove all project data and specifications.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-white"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Project
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
