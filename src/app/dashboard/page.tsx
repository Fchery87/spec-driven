'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Filter, Search, Sparkles, MoreHorizontal, ArrowUpRight } from 'lucide-react';

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

const PHASES = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'DONE'];

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

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase())
        || project.slug.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPhase = phaseFilter === 'ALL' || project.current_phase === phaseFilter;
      return matchesSearch && matchesPhase;
    });
  }, [projects, searchTerm, phaseFilter]);

  const totalProjects = projects.length;
  const awaitingStack = projects.filter((p) => !p.stack_approved).length;
  const awaitingDependencies = projects.filter((p) => !p.dependencies_approved).length;
  const averageProgress = totalProjects
    ? Math.round(
        projects.reduce((sum, project) => sum + getPhaseProgress(project.current_phase), 0) /
          totalProjects
      )
    : 0;

  const insights = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4)
      .map((project) => ({
        title: `${project.name} advanced to ${project.current_phase}`,
        subtitle: formatRelativeTime(project.created_at),
      }));
  }, [projects]);

  const getPhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      ANALYSIS: 'bg-[hsl(var(--chart-1))]/20 text-[hsl(var(--chart-1))]',
      STACK_SELECTION: 'bg-[hsl(var(--chart-2))]/20 text-[hsl(var(--chart-2))]',
      SPEC: 'bg-[hsl(var(--chart-3))]/20 text-[hsl(var(--chart-3))]',
      DEPENDENCIES: 'bg-[hsl(var(--chart-4))]/20 text-[hsl(var(--chart-4))]',
      SOLUTIONING: 'bg-[hsl(var(--chart-5))]/20 text-[hsl(var(--chart-5))]',
      DONE: 'bg-primary text-primary-foreground'
    };
    return `${colors[phase] || 'bg-muted text-foreground'} border-transparent`;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero */}
        <Card className="overflow-hidden border border-border/70 bg-card/80">
          <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Workspace overview
              </div>
              <h1 className="text-3xl font-bold text-foreground">Projects</h1>
              <p className="text-muted-foreground">
                Monitor progress, approvals, and artifacts across every spec-driven initiative.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{totalProjects} active</span>
                <span>{awaitingStack} awaiting stack approval</span>
                <span>{awaitingDependencies} dependency reviews pending</span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-4 md:w-auto">
              <div className="rounded-2xl border border-border/60 bg-muted/40 px-6 py-4 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg. completion</p>
                <p className="text-3xl font-semibold text-foreground">{averageProgress}%</p>
              </div>
              <Button size="lg" onClick={handleNewProject} className="w-full md:w-56">
                + New Project
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border border-border/70">
            <CardHeader>
              <CardDescription>Total projects</CardDescription>
              <CardTitle className="text-3xl">{totalProjects}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border border-border/70">
            <CardHeader>
              <CardDescription>Awaiting stack approvals</CardDescription>
              <CardTitle className="text-2xl">{awaitingStack}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border border-border/70">
            <CardHeader>
              <CardDescription>Dependency reviews pending</CardDescription>
              <CardTitle className="text-2xl">{awaitingDependencies}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 md:flex-row md:items-center">
          <div className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or slug"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground md:w-64"
            >
              <option value="ALL">All phases</option>
              {PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {phase.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <Card className="border border-border/70">
            <CardHeader>
              <CardDescription>Recent activity</CardDescription>
              <CardTitle>What changed lately</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.map((insight) => (
                <div key={insight.title} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{insight.title}</p>
                    <p className="text-xs text-muted-foreground">{insight.subtitle}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Error message */}
        {error && (
          <Card className="mb-8 border border-destructive/30 bg-destructive/10">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && !error && (
          <Card>
            <CardContent className="pt-12 text-center">
              <p className="text-muted-foreground mb-6">
                No projects yet. Create one to get started!
              </p>
              <Button onClick={handleNewProject}>Create First Project</Button>
            </CardContent>
          </Card>
        )}

        {/* Projects grid */}
        {!loading && filteredProjects.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {filteredProjects.map((project) => {
              const progress = getPhaseProgress(project.current_phase);
              return (
              <Card
                key={project.slug}
                className="cursor-pointer border border-border/70 hover:shadow-lg"
                onClick={() => handleOpenProject(project.slug)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <CardTitle className="text-xl text-foreground">{project.name}</CardTitle>
                      <CardDescription>Slug: {project.slug}</CardDescription>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getPhaseColor(project.current_phase)}>
                          {project.current_phase}
                        </Badge>
                        {project.stack_choice && (
                          <Badge variant="outline" className="text-xs">
                            {project.stack_choice.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="relative h-20 w-20 flex-shrink-0">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `conic-gradient(hsl(var(--chart-1)) ${progress}%, hsl(var(--muted-foreground)) ${progress}% 100%)`,
                        }}
                      />
                      <div className="absolute inset-2 rounded-full border border-border bg-card flex flex-col items-center justify-center text-xs">
                        <span className="text-sm font-semibold text-foreground">{progress}%</span>
                        <span className="text-[10px] text-muted-foreground">complete</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${project.stack_approved ? 'bg-[hsl(var(--chart-4))]' : 'bg-muted'}`} />
                        Stack {project.stack_approved ? 'approved' : 'pending'}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${project.dependencies_approved ? 'bg-[hsl(var(--chart-4))]' : 'bg-muted'}`} />
                        Dependencies {project.dependencies_approved ? 'approved' : 'pending'}
                      </div>
                      {project.stats && (
                        <div>{project.stats.total_artifacts} artifacts generated</div>
                      )}
                      <div>Created {new Date(project.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        size="sm"
                        className="flex-1 min-w-[120px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProject(project.slug);
                        }}
                      >
                        Resume
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[120px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/project/${project.slug}`);
                        }}
                      >
                        View details
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={(e) => handleDeleteClick(e, project)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )})}
          </div>
        )}

        {!loading && filteredProjects.length === 0 && projects.length > 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No projects match your filters.</p>
              <Button variant="outline" className="mt-4" onClick={() => setPhaseFilter('ALL')}>
                Reset filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{selectedProjectToDelete?.name}&quot;? This action cannot be undone and will permanently remove all project data and specifications.
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
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-transparent"></div>
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
