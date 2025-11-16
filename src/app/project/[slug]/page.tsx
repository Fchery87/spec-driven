'use client';

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
import { logger } from '@/lib/logger';
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PhaseStepper } from '@/components/orchestration/PhaseStepper';
import { StackSelection } from '@/components/orchestration/StackSelection';
import { ArtifactViewer } from '@/components/orchestration/ArtifactViewer';
import { DependencySelector, type DependencySelection } from '@/components/orchestration/DependencySelector';
import { calculatePhaseStatuses, canAdvanceFromPhase } from '@/utils/phase-status';
import { ArrowLeft, FileText, CheckCircle, Trash2, Download } from 'lucide-react';

interface Artifact {
  name: string;
  [key: string]: unknown;
}

interface Project {
  slug: string;
  name: string;
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
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastActionType, setLastActionType] = useState<'success' | 'error' | null>(null);
  const [showDependencySelector, setShowDependencySelector] = useState(false);
  const [approvingDependencies, setApprovingDependencies] = useState(false);

  const dependencySelectorRef = useRef<HTMLDivElement | null>(null);

  const recordAction = (message: string, type: 'success' | 'error' = 'success') => {
    setLastAction(message);
    setLastActionType(type);
    setTimeout(() => {
      setLastAction(null);
      setLastActionType(null);
    }, 5000);
  };

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${slug}`);
      const result = await response.json();

      if (result.success) {
        setProject(result.data);
        // Show stack selection if current phase is STACK_SELECTION and not approved
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
      } else {
        setError(result.error || 'Failed to fetch project');
      }
    } catch (err) {
      setError('Failed to fetch project');
      logger.error(err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchArtifacts = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/artifacts`);
      const result = await response.json();

      if (result.success) {
        // API returns: { artifacts: { ANALYSIS: [...], SPEC: [...], etc } }
        const allArtifacts = result.data.artifacts;
        setArtifacts(allArtifacts);
      }
    } catch (err) {
      logger.error('Failed to fetch artifacts:', err);
    }
  }, [slug]);

  useEffect(() => {
    fetchProject();
    fetchArtifacts();
  }, [fetchProject, fetchArtifacts]);

  useEffect(() => {
    if (showDependencySelector) {
      dependencySelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showDependencySelector]);

  const handleExecutePhase = async () => {
    setExecuting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/execute-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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
      logger.error(err);
      recordAction('Failed to execute phase', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handlePhaseAdvance = async () => {
    setAdvancing(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance' })
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
      logger.error(err);
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
        body: JSON.stringify({ stack_choice: stackChoice, reasoning, platform })
      });

      const result = await response.json();

      if (result.success) {
        setShowStackSelection(false);
        fetchProject();
        fetchArtifacts();
        recordAction('Stack selection approved.');
      } else {
        setError(result.error || 'Failed to approve stack');
        recordAction(result.error || 'Failed to approve stack', 'error');
      }
    } catch (err) {
      setError('Failed to approve stack');
      logger.error(err);
      recordAction('Failed to approve stack', 'error');
    }
  };

  const handleDependenciesApprove = async (selection: DependencySelection) => {
    setApprovingDependencies(true)
    try {
      let approvalNotes = ''

      if (selection.mode === 'preset') {
        const { platform, option, notes } = selection
        approvalNotes = `
Platform: ${platform.toUpperCase()}
Selection: ${option.title}

Frontend: ${option.frontend}
Backend: ${option.backend}
Database: ${option.database}
Deployment: ${option.deployment}

Dependencies:
${option.dependencies.map((dep) => `- ${dep}`).join('\n')}

Notes:
${notes || 'N/A'}
`.trim()
      } else {
        const { customStack, notes } = selection
        approvalNotes = `
Platform: CUSTOM TECH STACK

Frontend: ${customStack.frontend}
Backend: ${customStack.backend}
Database: ${customStack.database}
Deployment: ${customStack.deployment}

Dependencies:
${customStack.dependencies.length ? customStack.dependencies.map((dep) => `- ${dep}`).join('\n') : '- (none specified)'}

Additional Requests:
${customStack.requests || 'N/A'}

Notes:
${notes || 'N/A'}
`.trim()
      }

      const response = await fetch(`/api/projects/${slug}/approve-dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes }),
      })

      const result = await response.json()

      if (result.success) {
        setShowDependencySelector(false)
        await fetchProject()
        await fetchArtifacts()
        recordAction('Dependencies approved.')
      } else {
        setError(result.error || 'Failed to approve dependencies')
        recordAction(result.error || 'Failed to approve dependencies', 'error')
      }
    } catch (err) {
      setError('Failed to approve dependencies')
      logger.error(err)
      recordAction('Failed to approve dependencies', 'error')
    } finally {
      setApprovingDependencies(false)
    }
  };

  const handleViewArtifact = async (artifact: Artifact, phase: string) => {
    try {
      // Fetch the actual artifact content from the file system
      const response = await fetch(`/api/projects/${slug}/artifacts/${phase}/${artifact.name}`);

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
      logger.error('Failed to fetch artifact:', err);
      recordAction('Failed to load artifact', 'error');
    }
  };

  const handleArtifactDownload = async (artifact: Artifact, phase: string) => {
    try {
      // Fetch the actual artifact content from the file system
      const response = await fetch(`/api/projects/${slug}/artifacts/${phase}/${artifact.name}`);

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
      logger.error('Failed to download artifact:', err);
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
      logger.error(err);
      recordAction('Failed to generate handoff', 'error');
    } finally {
      setGeneratingHandoff(false);
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
      logger.error(err);
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
        // Redirect to dashboard after successful deletion
        router.push('/dashboard');
      } else {
        setError(result.error || 'Failed to delete project');
        setShowDeleteDialog(false);
      }
    } catch (err) {
      setError('Failed to delete project');
      logger.error(err);
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
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

  if (error || !project) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="mb-8 flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Card className="border border-destructive/30 bg-destructive/10">
            <CardHeader>
              <CardTitle className="text-destructive">Project unavailable</CardTitle>
              <CardDescription className="text-destructive/80">
                {error || 'Project not found'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Return to the dashboard and select another project or create a new one.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const completedCount = project.phases_completed.length;
  const progress = Math.round((completedCount / PHASES.length) * 100);
  const stackStatus = project.stack_choice
    ? project.stack_approved
      ? 'Approved'
      : 'Awaiting approval'
    : 'Not selected';
  const dependencyStatus = project.dependencies_approved ? 'Approved' : 'Pending review';

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mb-4 flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
            <h1 className="text-4xl font-bold text-foreground">{project.name}</h1>
            <p className="text-muted-foreground mt-2">Project slug: {project.slug}</p>
          </div>
          <div className="text-right">
            <Badge className="mb-2">{project.current_phase}</Badge>
            <p className="text-sm text-muted-foreground">
              {project.phases_completed.length} of {PHASES.length} phases completed
            </p>
          </div>
        </div>

        {lastAction && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              lastActionType === 'error'
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-[hsl(var(--chart-4))]/40 bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]'
            }`}
          >
            {lastAction}
          </div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="border border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardDescription>Progress</CardDescription>
              <CardTitle className="text-3xl">{progress}%</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {completedCount} of {PHASES.length} phases complete
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardDescription>Stack</CardDescription>
              <CardTitle className="text-lg">
                {project.stack_choice ? project.stack_choice.replace(/_/g, ' ') : 'Not selected'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{stackStatus}</p>
            </CardContent>
          </Card>
          <Card className="border border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardDescription>Dependencies</CardDescription>
              <CardTitle className="text-lg">{dependencyStatus}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Error alert */}
        {error && (
          <Card className="mb-8 border border-destructive/30 bg-destructive/10">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Phase stepper */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Project Workflow</CardTitle>
            <CardDescription>
              Follow the phases to generate your complete project specification
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
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

              const canExecutePhase = shouldShowExecuteButton(project.current_phase, artifacts);
              const hasCurrentArtifacts = hasArtifactsForPhase(project.current_phase, artifacts);
              const executeLabel = hasCurrentArtifacts
                ? `Rebuild ${project.current_phase} Phase`
                : `Execute ${project.current_phase} Phase`;

              return (
                <PhaseStepper
                  currentPhase={project.current_phase}
                  phases={calculatedPhases}
                  canAdvance={canAdvance}
                  onAdvance={handlePhaseAdvance}
                  canExecute={canExecutePhase}
                  onExecute={handleExecutePhase}
                  executing={executing}
                  executeLabel={executeLabel}
                />
              );
            })()}
          </CardContent>
        </Card>

        {/* Stack selection modal/section */}
        {showStackSelection && (
          <Card className="mb-8 border border-[hsl(var(--chart-2))]/30 bg-[hsl(var(--chart-2))]/10">
            <CardHeader>
              <CardTitle>Select Technology Stack</CardTitle>
              <CardDescription>
                Choose a platform type and technology stack for this project. This decision will guide all future specifications.
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
            className="mb-8 border border-[hsl(var(--chart-3))]/30 bg-[hsl(var(--chart-3))]/5"
          >
            <CardHeader>
              <CardTitle>Dependencies Blueprint</CardTitle>
              <CardDescription>
                Select the platform profile and dependency stack that DevOps should provision for this project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DependencySelector submitting={approvingDependencies} onApprove={handleDependenciesApprove} />
            </CardContent>
          </Card>
        )}

        {/* Current phase details */}
        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {/* Phase info */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Current Phase: {project.current_phase}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Phase Description</h3>
                  <p className="text-muted-foreground">{getPhaseDescription(project.current_phase)}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-2">Expected Outputs</h3>
                  <div className="space-y-2">
                    {getPhaseOutputs(project.current_phase).map((output) => {
                      const complete = isOutputComplete(project.current_phase, output, artifacts);
                      return (
                        <div
                          key={output}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                        >
                          <span>{output}</span>
                          {complete ? (
                            <span className="flex items-center gap-1 text-[hsl(var(--chart-4))]">
                              <CheckCircle className="h-4 w-4" />
                              Ready
                            </span>
                          ) : (
                            <span className="text-xs uppercase tracking-wide">Pending</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Gate information */}
                {getPhaseGates(project.current_phase).length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <h3 className="font-semibold text-foreground mb-2">Approval Gates</h3>
                    <div className="space-y-2">
                      {getPhaseGates(project.current_phase).map((gate) => {
                        const approved =
                          (gate === 'stack_approved' && project.stack_approved) ||
                          (gate === 'dependencies_approved' && project.dependencies_approved);
                        return (
                          <div key={gate} className="rounded-lg border border-border/70 bg-muted/40 p-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${approved ? 'bg-[hsl(var(--chart-4))]' : 'bg-destructive'}`}></span>
                              <span className="text-sm text-muted-foreground capitalize">
                                {gate.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {!approved && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Waiting for stakeholder approval before advancing.
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Artifacts summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Artifacts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {PHASES.map((phase) => (
                    <div key={phase}>
                      <h4 className="font-medium text-sm text-foreground mb-2">{phase}</h4>
                      {artifacts[phase] && artifacts[phase].length > 0 ? (
                        <div className="space-y-2">
                          {artifacts[phase].map((artifact: Artifact) => (
                            <div
                              key={artifact.name}
                              className="rounded-xl border border-border/80 bg-muted/50 p-3 text-xs text-muted-foreground"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 truncate">
                                  <FileText className="h-3.5 w-3.5 text-primary" />
                                  <span className="truncate text-foreground">{artifact.name}</span>
                                </div>
                                <span className="text-[10px] uppercase tracking-wide">Phase {phase}</span>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleViewArtifact(artifact, phase)}
                                >
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleArtifactDownload(artifact, phase)}
                                >
                                  Download
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No artifacts yet</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        {!showStackSelection && project.current_phase !== 'DONE' && (
          <Card className="border border-border/70">
            <CardHeader>
              <CardTitle>Phase Controls</CardTitle>
              <CardDescription>Advance once approvals are satisfied, refresh artifacts, or clean up this project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handlePhaseAdvance}
                  disabled={advancing || executing}
                  variant="outline"
                  className="flex-1 min-w-[180px]"
                >
                  {advancing ? 'Advancing...' : 'Advance to Next Phase'}
                </Button>
                {project.current_phase === 'DEPENDENCIES' && !project.dependencies_approved && (
                  <Button
                    variant="secondary"
                    className="flex-1 min-w-[180px]"
                    onClick={() => setShowDependencySelector(true)}
                    disabled={executing || advancing || showDependencySelector}
                  >
                    Select Dependencies
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 min-w-[140px]"
                  onClick={() => {
                    fetchProject();
                    fetchArtifacts();
                  }}
                  disabled={executing || advancing}
                >
                  Refresh
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2"
                  disabled={executing || advancing}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {project.current_phase === 'DONE' && (
          <Card className="bg-[hsl(var(--chart-4))]/10 border border-[hsl(var(--chart-4))]/30">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-[hsl(var(--chart-4))]" />
                  <p className="text-[hsl(var(--chart-4))] font-semibold">
                    Project specification complete! Ready for code generation.
                  </p>
                </div>
                <p className="text-muted-foreground text-sm">
                  Generate the HANDOFF.md document that contains all specifications compiled into a single prompt for LLM-based code generation.
                </p>
              </div>

              <div className="space-y-4">
                {/* Check if handoff already exists */}
                {artifacts['DONE'] && artifacts['DONE'].some((a: Artifact) => a.name === 'HANDOFF.md') ? (
                  <div className="space-y-3">
                    <div className="bg-[hsl(var(--chart-4))]/15 border border-[hsl(var(--chart-4))]/30 rounded-lg p-4 text-center">
                      <p className="text-[hsl(var(--chart-4))] font-semibold flex items-center justify-center gap-2">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                        HANDOFF.md has been generated
                      </p>
                    </div>
                    <Button
                      onClick={handleDownloadSpecs}
                      className="w-full flex items-center justify-center gap-2 h-12 bg-primary hover:bg-primary/80"
                    >
                      <Download className="h-4 w-4" />
                      Download All Specifications (ZIP)
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Share HANDOFF.md with engineering and attach ZIP to your build ticket.
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handleGenerateHandoff}
                    disabled={generatingHandoff}
                    className="w-full flex items-center justify-center gap-2 h-12"
                  >
                    {generatingHandoff ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Generating HANDOFF.md...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                        Generate HANDOFF.md
                      </>
                    )}
                  </Button>
                )}
                {!artifacts['DONE']?.some((a: Artifact) => a.name === 'HANDOFF.md') && (
                  <p className="text-center text-xs text-muted-foreground">
                    Compile all artifacts into a single prompt once your stakeholders sign off.
                  </p>
                )}

                <div className="flex gap-4 justify-center pt-2 border-t border-[hsl(var(--chart-4))]/30">
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
                    Delete Project
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{project?.name}&quot;? This action cannot be undone and will permanently remove all project data and specifications.
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

        {/* Artifact Viewer Modal */}
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
    </main>
  );
}

// Helper functions
function shouldShowExecuteButton(phase: string): boolean {
  // Don't show execute button for user-driven phases
  if (phase === 'STACK_SELECTION' || phase === 'DONE') {
    return false;
  }

  // All other phases can be executed (or rebuilt) at any time
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
    STACK_SELECTION: 'Select and approve the technology stack for your project. Choose between predefined stacks optimized for different scenarios.',
    SPEC: 'Generate detailed product and technical specifications including PRD, data model, and API specifications.',
    DEPENDENCIES: 'Define and approve all project dependencies including npm packages, Python libraries, and system requirements.',
    SOLUTIONING: 'Create architecture diagrams, break down work into epics and tasks, and plan implementation sequence.',
    DONE: 'Generate final handoff document with HANDOFF.md prompt for LLM-based code generation.'
  };
  return descriptions[phase] || 'Project phase';
}

function getPhaseOutputs(phase: string): string[] {
  const outputs: Record<string, string[]> = {
    ANALYSIS: ['constitution.md', 'project-brief.md', 'personas.md'],
    STACK_SELECTION: ['plan.md', 'README.md'],
    SPEC: ['PRD.md', 'data-model.md', 'api-spec.json'],
    DEPENDENCIES: ['DEPENDENCIES.md', 'dependency-proposal.md'],
    SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md'],
    DONE: ['HANDOFF.md']
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
