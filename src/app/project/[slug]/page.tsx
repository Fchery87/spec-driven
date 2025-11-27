'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StackSelection } from '@/components/orchestration/StackSelection';
import { ArtifactViewer } from '@/components/orchestration/ArtifactViewer';
import { DependenciesReview } from '@/components/orchestration/DependenciesReview';
import { ProjectHeader } from '@/components/orchestration/ProjectHeader';
import { PhaseTimeline } from '@/components/orchestration/PhaseTimeline';
import { ArtifactSidebar } from '@/components/orchestration/ArtifactSidebar';
import { ActionBar } from '@/components/orchestration/ActionBar';
import { calculatePhaseStatuses, canAdvanceFromPhase } from '@/utils/phase-status';
import { CheckCircle, Trash2, Download, FileText, AlertCircle } from 'lucide-react';

interface Artifact {
  name: string;
  [key: string]: unknown;
}

interface Project {
  slug: string;
  name: string;
  description?: string | null;
  current_phase: string;
  phases_completed: string[];
  stack_choice?: string;
  stack_approved: boolean;
  dependencies_approved: boolean;
  created_at: string;
  stats?: Record<string, unknown>;
}

const PHASES = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'DONE'];

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStackSelection, setShowStackSelection] = useState(false);
  const [artifacts, setArtifacts] = useState<Record<string, Artifact[]>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<{ filename: string; content: string; phase: string } | null>(null);
  const [generatingHandoff, setGeneratingHandoff] = useState(false);
  const [showDependencySelector, setShowDependencySelector] = useState(false);
  const [approvingDependencies, setApprovingDependencies] = useState(false);
  const [regeneratingDependencies, setRegeneratingDependencies] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  const dependencySelectorRef = useRef<HTMLDivElement | null>(null);

  const recordAction = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') {
      toast.error(message);
    } else {
      toast.success(message);
    }
  };

  const fetchProject = useCallback(async (skipGateChecks: boolean = false) => {
    try {
      const response = await fetch(`/api/projects/${slug}`, { cache: 'no-store' });
      const result = await response.json();

      if (result.success) {
        setProject(result.data);

        if (!skipGateChecks) {
          if (result.data.current_phase === 'STACK_SELECTION' && !result.data.stack_approved) {
            setShowStackSelection(true);
          } else {
            setShowStackSelection(false);
          }
          if (result.data.current_phase === 'DEPENDENCIES' && !result.data.dependencies_approved) {
            setShowDependencySelector(true);
          } else {
            setShowDependencySelector(false);
          }
        }
      } else {
        setError(result.error || 'Failed to fetch project');
      }
    } catch (err) {
      setError('Failed to fetch project');
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchArtifacts = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/artifacts`, { cache: 'no-store' });
      const result = await response.json();

      if (result.success) {
        const allArtifacts = result.data.artifacts;
        setArtifacts(allArtifacts || {});
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to fetch artifacts:', error);
    }
  }, [slug]);

  useEffect(() => {
    fetchProject();
    fetchArtifacts();
  }, [fetchProject, fetchArtifacts]);

  useEffect(() => {
    if (project?.description !== undefined && !editingDescription) {
      setDescriptionInput(project.description || '');
    }
  }, [project?.description, editingDescription]);

  useEffect(() => {
    if (showDependencySelector) {
      dependencySelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showDependencySelector]);

  const handleExecutePhase = useCallback(async () => {
    setExecuting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/execute-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      const result = await response.json();

      if (result.success) {
        await fetchProject();
        await fetchArtifacts();
        recordAction(`Generated artifacts for ${project?.current_phase ?? 'current'} phase.`);
      } else {
        setError(result.error || 'Failed to execute phase');
        recordAction(result.error || 'Failed to execute phase', 'error');
      }
    } catch (err) {
      setError('Failed to execute phase');
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to execute phase:', error);
      recordAction('Failed to execute phase', 'error');
    } finally {
      setExecuting(false);
    }
  }, [slug, project?.current_phase, fetchProject, fetchArtifacts]);

  useEffect(() => {
    if (project?.current_phase === 'DEPENDENCIES' && !project.dependencies_approved && !executing) {
      const dependenciesArtifacts = artifacts['DEPENDENCIES'];
      if (!dependenciesArtifacts || dependenciesArtifacts.length === 0) {
        handleExecutePhase();
      }
    }
  }, [project?.current_phase, project?.dependencies_approved, executing, artifacts, handleExecutePhase]);

  const handlePhaseAdvance = async () => {
    setAdvancing(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance' }),
        cache: 'no-store'
      });

      const result = await response.json();

      if (result.success) {
        await fetchProject();
        await fetchArtifacts();
        recordAction('Advanced to the next phase.');
      } else {
        setError(result.error || 'Failed to advance phase');
        recordAction(result.error || 'Failed to advance phase', 'error');
      }
    } catch (err) {
      setError('Failed to advance phase');
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to advance phase:', error);
      recordAction('Failed to advance phase', 'error');
    } finally {
      setAdvancing(false);
    }
  };

  const handleStackApprove = async (stackChoice: string, reasoning?: string, platform?: string) => {
    try {
      const response = await fetch(`/api/projects/${slug}/approve-stack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stack_choice: stackChoice, reasoning, platform }),
        cache: 'no-store'
      });

      const result = await response.json();

      if (result.success) {
        setShowStackSelection(false);
        fetchProject(true);
        fetchArtifacts();
        recordAction('Stack selection approved.');
      } else {
        setError(result.error || 'Failed to approve stack');
        recordAction(result.error || 'Failed to approve stack', 'error');
      }
    } catch (err) {
      setError('Failed to approve stack');
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to approve stack:', error);
      recordAction('Failed to approve stack', 'error');
    }
  };

  const handleDependenciesApprove = async (approvalNotes?: string) => {
    setApprovingDependencies(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/approve-dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNotes }),
        cache: 'no-store'
      })

      const result = await response.json()

      if (result.success) {
        setShowDependencySelector(false)
        await fetchProject(true)
        await fetchArtifacts()
        recordAction('Dependencies approved. Click "Next Phase" to continue.')
      } else {
        setError(result.error || 'Failed to approve dependencies')
        recordAction(result.error || 'Failed to approve dependencies', 'error')
      }
    } catch (err) {
      setError('Failed to approve dependencies')
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to approve dependencies:', error);
      recordAction('Failed to approve dependencies', 'error')
    } finally {
      setApprovingDependencies(false)
    }
  };

  const handleRegenerateDependencies = async (feedback?: string) => {
    setRegeneratingDependencies(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/regenerate-dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
        cache: 'no-store'
      })

      const result = await response.json()

      if (result.success) {
        await fetchProject(true)
        await fetchArtifacts()
        recordAction('Dependencies regenerated based on your feedback.')
      } else {
        setError(result.error || 'Failed to regenerate dependencies')
        recordAction(result.error || 'Failed to regenerate dependencies', 'error')
      }
    } catch (err) {
      setError('Failed to regenerate dependencies')
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to regenerate dependencies:', error);
      recordAction('Failed to regenerate dependencies', 'error')
    } finally {
      setRegeneratingDependencies(false)
    }
  };

  const handleViewArtifact = async (artifact: Artifact, phase: string) => {
    try {
      const response = await fetch(`/api/projects/${slug}/artifacts/${phase}/${artifact.name}`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Failed to fetch artifact content');
      }

      const content = await response.text();

      setSelectedArtifact({
        filename: artifact.name,
        content: content,
        phase: phase
      });
      setViewerOpen(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to fetch artifact:', error);
      recordAction('Failed to load artifact', 'error');
    }
  };

  const handleArtifactDownload = async (artifact: Artifact, phase: string) => {
    try {
      const response = await fetch(`/api/projects/${slug}/artifacts/${phase}/${artifact.name}`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Failed to fetch artifact content');
      }

      const content = await response.text();

      const element = document.createElement('a');
      const file = new Blob([content], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = artifact.name;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
      recordAction(`Downloaded ${artifact.name}.`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to download artifact:', error);
      recordAction('Failed to download artifact', 'error');
    }
  };

  const handleGenerateHandoff = async () => {
    setGeneratingHandoff(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/generate-handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        await fetchProject();
        await fetchArtifacts();
        recordAction('Generated HANDOFF.md bundle.');
      } else {
        setError(result.error || 'Failed to generate handoff');
        recordAction(result.error || 'Failed to generate handoff', 'error');
      }
    } catch (err) {
      setError('Failed to generate handoff');
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to generate handoff:', error);
      recordAction('Failed to generate handoff', 'error');
    } finally {
      setGeneratingHandoff(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!project) return;
    setSavingDescription(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descriptionInput }),
      });

      const result = await response.json();

      if (result.success) {
        setProject(result.data);
        setEditingDescription(false);
        recordAction('Project description updated.');
      } else {
        const message = result.error || 'Failed to update description';
        setError(message);
        recordAction(message, 'error');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to update description:', error);
      setError('Failed to update description');
      recordAction('Failed to update description', 'error');
    } finally {
      setSavingDescription(false);
    }
  };

  const handleDownloadSpecs = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/download`);
      if (!response.ok) {
        const result = await response.json();
        setError(result.error || 'Failed to download specifications');
        recordAction(result.error || 'Failed to download specifications', 'error');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug}-specs-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      recordAction('Specifications downloaded.');
    } catch (err) {
      setError('Failed to download specifications');
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to download specifications:', error);
      recordAction('Failed to download specifications', 'error');
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${slug}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        setShowDeleteDialog(false);
        router.push('/dashboard');
      } else {
        setError(result.error || 'Failed to delete project');
        setShowDeleteDialog(false);
      }
    } catch (err) {
      setError('Failed to delete project');
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to delete project:', error);
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  const handlePhaseClick = (phase: string) => {
    const phaseArtifacts = artifacts[phase];
    if (phaseArtifacts && phaseArtifacts.length > 0) {
      handleViewArtifact(phaseArtifacts[0], phase);
    } else {
      recordAction('No artifacts available for this phase yet.', 'error');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProject();
    await fetchArtifacts();
    setRefreshing(false);
    recordAction('Refreshed project and artifacts.');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent" />
          <p>Loading project...</p>
        </div>
      </main>
    );
  }

  if (error && !project) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border border-destructive/30 bg-destructive/10">
            <CardHeader>
              <CardTitle className="text-destructive">Project unavailable</CardTitle>
              <CardDescription className="text-destructive/80">
                {error || 'Project not found'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!project) return null;

  const completedCount = project.phases_completed.length;
  const calculatedPhases = calculatePhaseStatuses({
    current_phase: project.current_phase,
    phases_completed: project.phases_completed || [],
    stack_approved: project.stack_approved,
    dependencies_approved: project.dependencies_approved,
    artifacts: artifacts
  });

  const canAdvance = canAdvanceFromPhase(
    project.current_phase,
    project.phases_completed || [],
    project.stack_approved,
    project.dependencies_approved
  );

  const canExecutePhase = shouldShowExecuteButton(project.current_phase);
  const hasCurrentArtifacts = hasArtifactsForPhase(project.current_phase, artifacts);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-24">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <ProjectHeader
          name={project.name}
          slug={project.slug}
          description={project.description}
          currentPhase={project.current_phase}
          completedCount={completedCount}
          totalPhases={PHASES.length}
          stackChoice={project.stack_choice}
          createdAt={project.created_at}
          onBack={() => router.push('/dashboard')}
          onEditDescription={() => setEditingDescription(true)}
        />

        <PhaseTimeline
          phases={calculatedPhases.map(p => ({
            name: p.name,
            status: p.status,
            blockedReason: p.blockedReason
          }))}
          currentPhase={project.current_phase}
          onPhaseClick={handlePhaseClick}
        />

        {error && (
          <Card className="mb-6 border border-destructive/30 bg-destructive/10">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {showStackSelection && (
          <Card className="mb-6 border border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle>Select Technology Stack</CardTitle>
              <CardDescription>
                Choose a platform type and technology stack for this project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StackSelection
                selectedStack={project.stack_choice || undefined}
                onStackSelect={handleStackApprove}
              />
            </CardContent>
          </Card>
        )}

        {showDependencySelector && (
          <Card
            ref={dependencySelectorRef}
            className="mb-6 border border-amber-500/30 bg-amber-500/5"
          >
            <CardHeader>
              <CardTitle>Review Dependencies</CardTitle>
              <CardDescription>
                Review and approve the generated dependency plan for your architecture.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DependenciesReview
                architecture={project.stack_choice || 'unknown'}
                dependenciesSummary={{
                  total_packages: 18,
                  production_deps: 12,
                  dev_deps: 6,
                  vulnerabilities: 0,
                  license_types: ['MIT', 'Apache-2.0']
                }}
                onApprove={() => handleDependenciesApprove()}
                onRegenerate={() => handleRegenerateDependencies()}
                onViewDetails={() => {
                  const artifact = artifacts['DEPENDENCIES']?.[0];
                  if (artifact) {
                    handleViewArtifact(artifact, 'DEPENDENCIES');
                  }
                }}
                submitting={approvingDependencies}
                regenerating={regeneratingDependencies}
              />
            </CardContent>
          </Card>
        )}

        {editingDescription && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Edit Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                rows={3}
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Describe the goal, audience, and constraints for this project."
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveDescription}
                  disabled={savingDescription}
                >
                  {savingDescription ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingDescription(false);
                    setDescriptionInput(project.description || '');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            {project.current_phase === 'DONE' ? (
              <Card className="bg-emerald-500/10 border border-emerald-500/30">
                <CardContent className="pt-6">
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <CheckCircle className="h-6 w-6 text-emerald-500" />
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-lg">
                        Project Complete!
                      </p>
                    </div>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      All specifications are ready. Generate the HANDOFF.md document for LLM-based code generation.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {artifacts['DONE']?.some((a: Artifact) => a.name === 'HANDOFF.md') ? (
                      <div className="space-y-3">
                        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-4 text-center">
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            HANDOFF.md Generated
                          </p>
                        </div>
                        <Button
                          onClick={handleDownloadSpecs}
                          className="w-full flex items-center justify-center gap-2 h-12"
                        >
                          <Download className="h-4 w-4" />
                          Download All Specifications (ZIP)
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleGenerateHandoff}
                        disabled={generatingHandoff}
                        className="w-full flex items-center justify-center gap-2 h-12"
                      >
                        {generatingHandoff ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" />
                            Generate HANDOFF.md
                          </>
                        )}
                      </Button>
                    )}

                    <div className="flex gap-3 justify-center pt-4 border-t border-emerald-500/30">
                      <Button
                        onClick={() => router.push('/dashboard')}
                        variant="outline"
                        className="flex-1"
                      >
                        Back to Dashboard
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setShowDeleteDialog(true)}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-primary">Current Phase:</span> {project.current_phase}
                  </CardTitle>
                  <CardDescription>
                    {getPhaseDescription(project.current_phase)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Expected Outputs</h4>
                    <div className="space-y-2">
                      {getPhaseOutputs(project.current_phase).map((output) => {
                        const complete = isOutputComplete(project.current_phase, output, artifacts);
                        return (
                          <div
                            key={output}
                            className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{output}</span>
                            </div>
                            {complete ? (
                              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm">
                                <CheckCircle className="h-4 w-4" />
                                Ready
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                Pending
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {getPhaseGates(project.current_phase).length > 0 && (
                    <div className="pt-4 border-t border-border">
                      <h4 className="text-sm font-medium mb-3">Approval Gates</h4>
                      {getPhaseGates(project.current_phase).map((gate) => {
                        const approved =
                          (gate === 'stack_approved' && project.stack_approved) ||
                          (gate === 'dependencies_approved' && project.dependencies_approved);
                        return (
                          <div
                            key={gate}
                            className={`rounded-lg border p-3 ${
                              approved
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-amber-500/30 bg-amber-500/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  approved ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                              />
                              <span className="text-sm font-medium capitalize">
                                {gate.replace(/_/g, ' ')}
                              </span>
                              <span
                                className={`text-xs ml-auto ${
                                  approved ? 'text-emerald-600' : 'text-amber-600'
                                }`}
                              >
                                {approved ? 'Approved' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2">
            <ArtifactSidebar
              artifacts={artifacts}
              phases={PHASES}
              currentPhase={project.current_phase}
              onViewArtifact={handleViewArtifact}
              onDownloadArtifact={handleArtifactDownload}
            />
          </div>
        </div>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{project?.name}&quot;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProject}
                disabled={deleting}
                className="flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-transparent" />
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

        {selectedArtifact && (
          <ArtifactViewer
            open={viewerOpen}
            onOpenChange={setViewerOpen}
            filename={selectedArtifact.filename}
            content={selectedArtifact.content}
            phase={selectedArtifact.phase}
          />
        )}
      </div>

      {project.current_phase !== 'DONE' && (
        <ActionBar
          currentPhase={project.current_phase}
          canAdvance={canAdvance}
          canExecute={canExecutePhase}
          hasArtifacts={hasCurrentArtifacts}
          executing={executing}
          advancing={advancing}
          refreshing={refreshing}
          onExecute={handleExecutePhase}
          onAdvance={handlePhaseAdvance}
          onRefresh={handleRefresh}
          onDownload={handleDownloadSpecs}
          onDelete={() => setShowDeleteDialog(true)}
          executeLabel={hasCurrentArtifacts ? `Rebuild ${project.current_phase}` : undefined}
        />
      )}
    </main>
  );
}

function shouldShowExecuteButton(phase: string): boolean {
  if (phase === 'STACK_SELECTION' || phase === 'DONE') {
    return false;
  }
  return true;
}

function hasArtifactsForPhase(phase: string, artifacts: Record<string, Artifact[]>): boolean {
  if (phase === 'STACK_SELECTION' || phase === 'DONE') {
    return false;
  }
  const phaseArtifacts = artifacts[phase] || [];
  return phaseArtifacts.length > 0;
}

function getPhaseDescription(phase: string): string {
  const descriptions: Record<string, string> = {
    ANALYSIS: 'Analyze and clarify project requirements. AI agents will generate your project constitution, brief, and user personas.',
    STACK_SELECTION: 'Select and approve the technology stack for your project.',
    SPEC: 'Generate detailed product and technical specifications including PRD, data model, and API specifications.',
    DEPENDENCIES: 'Define and approve all project dependencies including npm packages and system requirements.',
    SOLUTIONING: 'Create architecture diagrams, break down work into epics and tasks, and plan implementation.',
    DONE: 'Generate final handoff document for LLM-based code generation.'
  };
  return descriptions[phase] || 'Project phase';
}

function getPhaseOutputs(phase: string): string[] {
  const outputs: Record<string, string[]> = {
    ANALYSIS: ['constitution.md', 'project-brief.md', 'personas.md'],
    STACK_SELECTION: ['stack-decision.md'],
    SPEC: ['PRD.md', 'data-model.md', 'api-spec.json'],
    DEPENDENCIES: ['DEPENDENCIES.md', 'dependency-proposal.md', 'approval.md'],
    SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md', 'plan.md'],
    DONE: ['README.md', 'HANDOFF.md']
  };
  return outputs[phase] || [];
}

function getPhaseGates(phase: string): string[] {
  const gates: Record<string, string[]> = {
    STACK_SELECTION: ['stack_approved'],
    DEPENDENCIES: ['dependencies_approved']
  };
  return gates[phase] || [];
}

function isOutputComplete(phase: string, output: string, artifacts: Record<string, Artifact[]> = {}): boolean {
  const phaseArtifacts = artifacts[phase] || [];
  return phaseArtifacts.some((artifact: Artifact) => artifact.name?.toLowerCase() === output.toLowerCase());
}
