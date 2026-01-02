'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Trash2, Search, Plus, MoreHorizontal, ArrowUpRight, 
  ChevronDown, ChevronUp, Layers, Clock, CheckCircle2,
  AlertCircle, FolderOpen, TrendingUp,
  Settings, Shield, Cog
} from 'lucide-react';

interface Project {
  slug: string;
  name: string;
  current_phase: string;
  stack_choice?: string;
  stack_approved: boolean;
  created_at: string;
  stats?: {
    total_artifacts: number;
    total_size: number;
  };
}

const PHASES = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'VALIDATE', 'DONE'];

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProjectToDelete, setSelectedProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [activityOpen, setActivityOpen] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects', { cache: 'no-store' });
      const result = await response.json();

      if (result.success) {
        setProjects(result.data);
      } else {
        setError(result.error || 'Failed to fetch projects');
      }
    } catch (err) {
      setError('Failed to fetch projects');
      logger.error('Failed to fetch projects', err instanceof Error ? err : new Error(String(err)));
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
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      const result = await response.json();

      if (result.success) {
        setDeleteDialogOpen(false);
        setSelectedProjectToDelete(null);
        fetchProjects();
      } else {
        setError(result.error || 'Failed to delete project');
      }
    } catch (err) {
      setError('Failed to delete project');
      logger.error('Failed to delete project', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setDeleting(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase())
        || project.slug.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPhase = phaseFilter === 'ALL' || project.current_phase === phaseFilter;
      return matchesSearch && matchesPhase;
    });
  }, [projects, searchTerm, phaseFilter]);

  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.current_phase === 'DONE').length;
  const inProgressProjects = projects.filter(p => p.current_phase !== 'DONE').length;
  const awaitingApprovals = projects.filter(p => !p.stack_approved).length;
  const averageProgress = totalProjects
    ? Math.round(
        projects.reduce((sum, project) => sum + getPhaseProgress(project.current_phase), 0) /
          totalProjects
      )
    : 0;

  const recentActivity = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4)
      .map((project) => ({
        project,
        message: `${project.name} advanced to ${project.current_phase}`,
        time: formatRelativeTime(project.created_at),
      }));
  }, [projects]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Hero Header with Gradient */}
        <div className="gradient-header dark:gradient-header-dark rounded-2xl p-6 border border-border/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Workspace
                </span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Projects Dashboard</h1>
              <p className="text-muted-foreground max-w-xl">
                Monitor progress, manage stack approvals, and track artifacts across all your spec-driven initiatives.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-6 px-5 py-3 rounded-xl bg-background/60 border border-border/50">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{averageProgress}%</p>
                  <p className="text-xs text-muted-foreground">Avg. Progress</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedProjects}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
              <Button size="lg" onClick={handleNewProject} className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Projects</p>
                  <p className="text-3xl font-bold text-foreground">{totalProjects}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-3xl font-bold text-foreground">{inProgressProjects}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{completedProjects}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Awaiting Approval</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{awaitingApprovals}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search projects by name or slug..."
                  className="pl-10 bg-background"
                />
              </div>
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground min-w-[180px]"
              >
                <option value="ALL">All phases</option>
                {PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {phase.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription className="text-xs uppercase tracking-wider">Recent Activity</CardDescription>
                  <CardTitle className="text-lg">What changed lately</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActivityOpen((prev) => !prev)}
                  className="gap-1"
                >
                  {activityOpen ? (
                    <>Hide <ChevronUp className="h-4 w-4" /></>
                  ) : (
                    <>Show <ChevronDown className="h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </CardHeader>
            {activityOpen && (
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {recentActivity.map((activity, i) => (
                    <button
                      key={i}
                      onClick={() => handleOpenProject(activity.project.slug)}
                      className="w-full flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3 hover:bg-muted/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${
                          activity.project.current_phase === 'DONE' 
                            ? 'bg-emerald-500' 
                            : 'bg-primary'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{activity.message}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Error message */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/10">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-muted-foreground">Loading projects...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && !error && (
          <Card className="border-dashed border-2 border-border">
            <CardContent className="py-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Create your first project to start generating specs, PRDs, and handoff documents.
              </p>
              <Button onClick={handleNewProject} className="gap-2">
                <Plus className="h-4 w-4" />
                Create First Project
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Projects grid */}
        {!loading && filteredProjects.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => {
              const progress = getPhaseProgress(project.current_phase);
              const isComplete = project.current_phase === 'DONE';
              
              return (
                <Card
                  key={project.slug}
                  className="group cursor-pointer border-border/50 bg-card/50 hover:border-primary/30 hover:shadow-lg transition-all duration-200"
                  onClick={() => handleOpenProject(project.slug)}
                >
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">{project.slug}</p>
                      </div>
                      <div className="relative h-14 w-14 flex-shrink-0">
                        <svg className="h-14 w-14 -rotate-90 transform">
                          <circle
                            cx="28"
                            cy="28"
                            r="24"
                            className="fill-none stroke-muted stroke-[4]"
                          />
                          <circle
                            cx="28"
                            cy="28"
                            r="24"
                            className={`fill-none stroke-[4] transition-all duration-500 ${
                              isComplete ? 'stroke-emerald-500' : 'stroke-primary'
                            }`}
                            strokeDasharray={`${progress * 1.5} 150`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-sm font-bold">{progress}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <Badge className={`${
                        isComplete 
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                          : 'bg-primary/10 text-primary border-primary/20'
                      } border`}>
                        {project.current_phase.replace(/_/g, ' ')}
                      </Badge>
                      {project.stack_choice && (
                        <Badge variant="outline" className="text-xs">
                          {project.stack_choice.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className={`h-2 w-2 rounded-full ${
                          project.stack_approved ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                        Stack {project.stack_approved ? 'approved' : 'pending'}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(project.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProject(project.slug);
                        }}
                      >
                        {isComplete ? 'View' : 'Resume'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleDeleteClick(e, project)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* No results */}
        {!loading && filteredProjects.length === 0 && projects.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No projects match your search.</p>
              <Button variant="outline" onClick={() => { setSearchTerm(''); setPhaseFilter('ALL'); }}>
                Clear filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Settings Section */}
        <Card className="border-border/50 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Settings & Credentials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <Button 
                variant="outline" 
                className="h-auto py-4 justify-start gap-3"
                onClick={() => router.push('/user/credentials')}
              >
                <Shield className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">My Credentials</p>
                  <p className="text-xs text-muted-foreground">Manage LLM and MCP API keys</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-4 justify-start gap-3"
                onClick={() => router.push('/admin')}
              >
                <Cog className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">Admin Settings</p>
                  <p className="text-xs text-muted-foreground">Global configuration (admin only)</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{selectedProjectToDelete?.name}&quot;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="gap-2"
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete
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

function getPhaseProgress(currentPhase: string) {
  const index = PHASES.indexOf(currentPhase);
  if (index === -1) return 0;
  return Math.round(((index + 1) / PHASES.length) * 100);
}

function formatRelativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
