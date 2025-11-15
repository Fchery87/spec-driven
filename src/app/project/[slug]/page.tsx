'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { PhaseStepper } from '@/components/orchestration/PhaseStepper';
import { StackSelection } from '@/components/orchestration/StackSelection';
import { ArrowLeft, FileText, CheckCircle, Trash2 } from 'lucide-react';

interface Project {
  slug: string;
  name: string;
  current_phase: string;
  phases_completed: string[];
  stack_choice?: string;
  stack_approved: boolean;
  dependencies_approved: boolean;
  created_at: string;
  stats?: Record<string, any>;
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
  const [artifacts, setArtifacts] = useState<Record<string, any>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProject();
    fetchArtifacts();
  }, [slug]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}`);
      const result = await response.json();

      if (result.success) {
        setProject(result.data);
        // Show stack selection if current phase is STACK_SELECTION and not approved
        if (result.data.current_phase === 'STACK_SELECTION' && !result.data.stack_approved) {
          setShowStackSelection(true);
        }
      } else {
        setError(result.error || 'Failed to fetch project');
      }
    } catch (err) {
      setError('Failed to fetch project');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArtifacts = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/artifacts`);
      const result = await response.json();

      if (result.success) {
        setArtifacts(result.data.artifacts);
      }
    } catch (err) {
      console.error('Failed to fetch artifacts:', err);
    }
  };

  const handlePhaseAdvance = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance' })
      });

      const result = await response.json();

      if (result.success) {
        fetchProject();
        fetchArtifacts();
      } else {
        setError(result.error || 'Failed to advance phase');
      }
    } catch (err) {
      setError('Failed to advance phase');
      console.error(err);
    }
  };

  const handleStackApprove = async (stackChoice: string, reasoning: string) => {
    try {
      const response = await fetch(`/api/projects/${slug}/approve-stack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stack_choice: stackChoice, reasoning })
      });

      const result = await response.json();

      if (result.success) {
        setShowStackSelection(false);
        fetchProject();
        fetchArtifacts();
      } else {
        setError(result.error || 'Failed to approve stack');
      }
    } catch (err) {
      setError('Failed to approve stack');
      console.error(err);
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
      console.error(err);
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Loading project...</p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="mb-8">
            ← Back
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{error || 'Project not found'}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mb-4 flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
            <h1 className="text-4xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-slate-600 mt-2">Project slug: {project.slug}</p>
          </div>
          <div className="text-right">
            <Badge className="mb-2">{project.current_phase}</Badge>
            <p className="text-sm text-slate-600">
              {project.phases_completed.length} of {PHASES.length} phases completed
            </p>
          </div>
        </div>

        {/* Error alert */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{error}</p>
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
            <PhaseStepper
              currentPhase={project.current_phase}
              completedPhases={project.phases_completed}
              phases={PHASES}
            />
          </CardContent>
        </Card>

        {/* Stack selection modal/section */}
        {showStackSelection && (
          <Card className="mb-8 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle>Select Technology Stack</CardTitle>
              <CardDescription>
                Choose a technology stack for this project. This decision will guide all future specifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StackSelection
                onApprove={handleStackApprove}
                disabled={false}
              />
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
                  <h3 className="font-semibold text-slate-900 mb-2">Phase Description</h3>
                  <p className="text-slate-600">{getPhaseDescription(project.current_phase)}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Expected Outputs</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    {getPhaseOutputs(project.current_phase).map((output) => (
                      <li key={output}>{output}</li>
                    ))}
                  </ul>
                </div>

                {/* Gate information */}
                {getPhaseGates(project.current_phase).length > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-2">Approval Gates</h3>
                    <div className="space-y-2">
                      {getPhaseGates(project.current_phase).map((gate) => (
                        <div key={gate} className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            (gate === 'stack_approved' && project.stack_approved) ||
                            (gate === 'dependencies_approved' && project.dependencies_approved)
                              ? 'bg-green-500'
                              : 'bg-red-500'
                          }`}></span>
                          <span className="text-sm text-slate-600 capitalize">
                            {gate.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
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
                      <h4 className="font-medium text-sm text-slate-900 mb-2">{phase}</h4>
                      {artifacts[phase] && artifacts[phase].length > 0 ? (
                        <ul className="space-y-1">
                          {artifacts[phase].map((artifact: any) => (
                            <li
                              key={artifact.name}
                              className="text-xs text-slate-600 truncate hover:text-slate-900 cursor-pointer flex items-center gap-1"
                              title={artifact.name}
                            >
                              <FileText className="h-3 w-3 flex-shrink-0" />
                              {artifact.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">No artifacts yet</p>
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
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <Button
                  onClick={handlePhaseAdvance}
                  className="flex-1"
                >
                  Advance to Next Phase
                </Button>
                <Button variant="outline" onClick={() => fetchProject()}>
                  Refresh
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
            </CardContent>
          </Card>
        )}

        {project.current_phase === 'DONE' && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-green-700 font-semibold">
                  Project specification complete! Ready for code generation.
                </p>
              </div>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => router.push('/dashboard')}>
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
            </CardContent>
          </Card>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{project?.name}"? This action cannot be undone and will permanently remove all project data and specifications.
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

// Helper functions
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
