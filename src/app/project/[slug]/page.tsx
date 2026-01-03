'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { ProjectHeader } from '@/components/orchestration/ProjectHeader';
import { PhaseTimeline } from '@/components/orchestration/PhaseTimeline';
import { ArtifactSidebar } from '@/components/orchestration/ArtifactSidebar';
import { ActionBar } from '@/components/orchestration/ActionBar';
import { ClarificationPanel, type ClarificationQuestion, type ClarificationMode } from '@/components/orchestration/ClarificationPanel';
import { ValidationResultsPanel, type ValidationCheck, type ValidationSummary } from '@/components/orchestration/ValidationResultsPanel';
import { calculatePhaseStatuses, canAdvanceFromPhase } from '@/utils/phase-status';
import { CheckCircle, Trash2, Download, FileText, AlertCircle, RotateCcw, History } from 'lucide-react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

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
  created_at: string;
  stats?: Record<string, unknown>;
}

const PHASES = [
  'ANALYSIS',
  'STACK_SELECTION',
  'SPEC_PM',
  'SPEC_ARCHITECT',
  'SPEC_DESIGN_TOKENS',
  'SPEC_DESIGN_COMPONENTS',
  'FRONTEND_BUILD',
  'DEPENDENCIES',
  'SOLUTIONING',
  'VALIDATE',
  'AUTO_REMEDY',
  'DONE'
];

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
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertTargetPhase, setRevertTargetPhase] = useState<string>('');
  const [executing, setExecuting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<{ filename: string; content: string; phase: string } | null>(null);
  const [generatingHandoff, setGeneratingHandoff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [stackAnalysisContent, setStackAnalysisContent] = useState<string | undefined>(undefined);
  const [classificationContent, setClassificationContent] = useState<string | undefined>(undefined);
  
  // Clarification state (ANALYSIS phase)
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([]);
  const [clarificationMode, setClarificationMode] = useState<ClarificationMode>('hybrid');
  const [showClarification, setShowClarification] = useState(false);
  const [submittingClarification, setSubmittingClarification] = useState(false);
  const [autoResolvingClarification, setAutoResolvingClarification] = useState(false);

  // Validation state (VALIDATE phase)
  const [validationChecks, setValidationChecks] = useState<ValidationCheck[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary>({
    totalChecks: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    pending: 0,
    overallStatus: 'pending'
  });
  const [isValidating, setIsValidating] = useState(false);

  const recordAction = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') {
      toast.error(message);
    } else {
      toast.success(message);
    }
  };

  const fetchProject = useCallback(async (skipGateChecks: boolean = false) => {
    try {
      // Add timestamp to bust any browser/CDN cache
      const response = await fetch(`/api/projects/${slug}?_t=${Date.now()}`, { cache: 'no-store' });
      const result = await response.json();

      if (result.success) {
        setProject(result.data);

        if (!skipGateChecks) {
          if (result.data.current_phase === 'STACK_SELECTION' && !result.data.stack_approved) {
            setShowStackSelection(true);
          } else {
            setShowStackSelection(false);
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
      // Add timestamp to bust any browser/CDN cache
      const response = await fetch(`/api/projects/${slug}/artifacts?_t=${Date.now()}`, { cache: 'no-store' });
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

  // Fetch clarification state for ANALYSIS phase
  const fetchClarification = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/clarification`, { cache: 'no-store' });
      const result = await response.json();

      if (result.success && result.data.enabled) {
        const state = result.data.state;
        setClarificationQuestions(state.questions || []);
        setClarificationMode(state.mode || 'hybrid');
        setShowClarification(!state.completed && !state.skipped && state.questions.length > 0);
      } else {
        setShowClarification(false);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to fetch clarification:', error);
    }
  }, [slug]);

  // Handle clarification answer
  const handleClarificationAnswer = (questionId: string, answer: string) => {
    setClarificationQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        if (answer === '') {
          // Reset answer
          return { ...q, resolved: false, resolvedBy: null, userAnswer: undefined, aiAssumed: undefined };
        }
        return { ...q, resolved: true, resolvedBy: 'user', userAnswer: answer };
      }
      return q;
    }));
  };

  // Handle auto-resolve single question
  const handleAutoResolveSingle = async (questionId: string) => {
    setAutoResolvingClarification(true);
    try {
      const response = await fetch(`/api/projects/${slug}/clarification/auto-resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: [questionId] })
      });
      const result = await response.json();

      if (result.success) {
        // Merge resolved questions with current state, preserving existing questions
        if (result.data.state?.questions && result.data.state.questions.length > 0) {
          setClarificationQuestions(result.data.state.questions);
        } else if (result.data.resolved?.length > 0) {
          // Fallback: update only the resolved question in local state
          setClarificationQuestions(prev => prev.map(q => {
            const resolved = result.data.resolved.find((r: { id: string; assumption?: string; rationale?: string }) => r.id === q.id);
            if (resolved) {
              return {
                ...q,
                resolved: true,
                resolvedBy: 'ai' as const,
                aiAssumed: { assumption: resolved.assumption || '', rationale: resolved.rationale || '' }
              };
            }
            return q;
          }));
        }
        const resolvedCount = result.data.resolved?.length || 0;
        recordAction(resolvedCount > 0 
          ? 'Question auto-resolved by AI.'
          : result.data.message || 'Question already resolved.');
      } else {
        recordAction(result.error || 'Failed to auto-resolve', 'error');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to auto-resolve:', error);
      recordAction('Failed to auto-resolve', 'error');
    } finally {
      setAutoResolvingClarification(false);
    }
  };

  // Handle auto-resolve all questions
  const handleAutoResolveAll = async () => {
    setAutoResolvingClarification(true);
    try {
      const response = await fetch(`/api/projects/${slug}/clarification/auto-resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const result = await response.json();

      if (result.success) {
        // Merge resolved questions with current state, preserving existing questions
        if (result.data.state?.questions && result.data.state.questions.length > 0) {
          setClarificationQuestions(result.data.state.questions);
        } else if (result.data.resolved?.length > 0) {
          // Fallback: update only the resolved questions in local state
          setClarificationQuestions(prev => prev.map(q => {
            const resolved = result.data.resolved.find((r: { id: string; assumption?: string; rationale?: string }) => r.id === q.id);
            if (resolved) {
              return {
                ...q,
                resolved: true,
                resolvedBy: 'ai' as const,
                aiAssumed: { assumption: resolved.assumption || '', rationale: resolved.rationale || '' }
              };
            }
            return q;
          }));
        }
        const resolvedCount = result.data.resolved?.length || 0;
        recordAction(resolvedCount > 0 
          ? `Auto-resolved ${resolvedCount} question(s).`
          : result.data.message || 'No questions to resolve.');
      } else {
        recordAction(result.error || 'Failed to auto-resolve all', 'error');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to auto-resolve all:', error);
      recordAction('Failed to auto-resolve all', 'error');
    } finally {
      setAutoResolvingClarification(false);
    }
  };

  // Handle clarification submit
  const handleClarificationSubmit = async () => {
    setSubmittingClarification(true);
    try {
      const response = await fetch(`/api/projects/${slug}/clarification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: clarificationQuestions,
          mode: clarificationMode,
          skip: false
        })
      });
      const result = await response.json();

      if (result.success) {
        setShowClarification(false);
        recordAction('Clarification answers saved.');
        await fetchProject();
      } else {
        recordAction(result.error || 'Failed to submit clarification', 'error');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to submit clarification:', error);
      recordAction('Failed to submit clarification', 'error');
    } finally {
      setSubmittingClarification(false);
    }
  };

  // Handle clarification skip
  const handleClarificationSkip = async () => {
    setSubmittingClarification(true);
    try {
      const response = await fetch(`/api/projects/${slug}/clarification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: clarificationQuestions,
          mode: clarificationMode,
          skip: true
        })
      });
      const result = await response.json();

      if (result.success) {
        setShowClarification(false);
        recordAction('Clarification skipped - AI will make assumptions.');
      } else {
        recordAction(result.error || 'Failed to skip clarification', 'error');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to skip clarification:', error);
      recordAction('Failed to skip clarification', 'error');
    } finally {
      setSubmittingClarification(false);
    }
  };

  // Run validation checks (VALIDATE phase)
  const handleRunValidation = async () => {
    setIsValidating(true);
    try {
      const response = await fetch(`/api/projects/${slug}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();

      if (result.success) {
        setValidationChecks(result.data.checks);
        setValidationSummary(result.data.summary);
        await fetchArtifacts(); // Refresh to get validation artifacts
        recordAction(`Validation complete: ${result.data.summary.passed}/${result.data.summary.totalChecks} checks passed`);
      } else {
        recordAction(result.error || 'Failed to run validation', 'error');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to run validation:', error);
      recordAction('Failed to run validation', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // Download validation report
  const handleDownloadValidationReport = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/artifacts/VALIDATE/validation-report.md`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Validation report not found');
      }
      const content = await response.text();

      const element = document.createElement('a');
      const file = new Blob([content], { type: 'text/markdown' });
      element.href = URL.createObjectURL(file);
      element.download = `${slug}-validation-report.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
      recordAction('Downloaded validation report.');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to download validation report:', error);
      recordAction('Failed to download validation report', 'error');
    }
  };

  useEffect(() => {
    fetchProject();
    fetchArtifacts();
  }, [fetchProject, fetchArtifacts]);

  // Fetch clarification when in ANALYSIS phase with artifacts
  useEffect(() => {
    if (project?.current_phase === 'ANALYSIS' && artifacts['ANALYSIS']?.length > 0) {
      fetchClarification();
    }
  }, [project?.current_phase, artifacts, fetchClarification]);

  useEffect(() => {
    if (project?.description !== undefined && !editingDescription) {
      setDescriptionInput(project.description || '');
    }
  }, [project?.description, editingDescription]);

  // Fetch stack analysis and project classification when in STACK_SELECTION phase (or generally if artifacts exist)
  useEffect(() => {
    async function loadStackContext() {
       // Reset if not relevant
       if (!project) return;
       
       // Try to load classification from ANALYSIS phase
       const classificationArtifact = artifacts['ANALYSIS']?.find(a => a.name === 'project-classification.json');
       if (classificationArtifact) {
         try {
           const response = await fetch(`/api/projects/${slug}/artifacts/ANALYSIS/${classificationArtifact.name}`);
           if (response.ok) {
             const text = await response.text();
             setClassificationContent(text);
           }
         } catch (err) {
           console.error('Failed to load project classification', err);
         }
       }

       // Try to load stack analysis from STACK_SELECTION phase
       const analysisArtifact = artifacts['STACK_SELECTION']?.find(a => a.name === 'stack-analysis.md');
       if (analysisArtifact) {
         try {
           const response = await fetch(`/api/projects/${slug}/artifacts/STACK_SELECTION/${analysisArtifact.name}`);
           if (response.ok) {
             const text = await response.text();
             setStackAnalysisContent(text);
           }
         } catch (err) {
           console.error('Failed to load stack analysis', err);
         }
       }
    }
    
    if (project && artifacts) {
      loadStackContext();
    }
  }, [project, artifacts, slug]);

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
    if (project?.current_phase === 'DEPENDENCIES' && !executing) {
      const dependenciesArtifacts = artifacts['DEPENDENCIES'];
      if (!dependenciesArtifacts || dependenciesArtifacts.length === 0) {
        handleExecutePhase();
      }
    }
  }, [project?.current_phase, executing, artifacts, handleExecutePhase]);

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

  const handleStackApprove = async (
    stackChoice: string,
    reasoning?: string,
    technicalPreferences?: {
      state_management?: string;
      data_fetching?: string;
      forms?: string;
      validation?: string;
      http_client?: string;
      testing?: string;
      e2e_testing?: string;
      animation?: string;
    }
  ) => {
    try {
      // Determine mode based on stack choice
      const mode = stackChoice === 'custom' ? 'custom' : 'template';
      
      const response = await fetch(`/api/projects/${slug}/approve-stack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          stack_choice: stackChoice,
          reasoning,
          technical_preferences: technicalPreferences,
        }),
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

  const handleResetProject = async () => {
    setResetting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        setShowResetDialog(false);
        // Clear all local state
        setArtifacts({});
        setProject(null);
        setShowStackSelection(false);
        setShowClarification(false);
        recordAction('Project reset to ANALYSIS phase', 'success');
        // Force a hard refresh to clear any cached data
        router.refresh();
        // Re-fetch fresh data
        await fetchProject();
        await fetchArtifacts();
      } else {
        setError(result.error || 'Failed to reset project');
        setShowResetDialog(false);
      }
    } catch (err) {
      setError('Failed to reset project');
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to reset project:', error);
      setShowResetDialog(false);
    } finally {
      setResetting(false);
    }
  };

  const handleRevertPhase = async () => {
    if (!revertTargetPhase) return;
    
    setReverting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/revert-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPhase: revertTargetPhase })
      });

      const result = await response.json();

      if (result.success) {
        setShowRevertDialog(false);
        setRevertTargetPhase('');
        setArtifacts({});
        setProject(null);
        recordAction(`Project reverted to ${revertTargetPhase} phase`, 'success');
        router.refresh();
        await fetchProject();
        await fetchArtifacts();
      } else {
        setError(result.error || 'Failed to revert phase');
        setShowRevertDialog(false);
      }
    } catch (err) {
      setError('Failed to revert phase');
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to revert phase:', error);
      setShowRevertDialog(false);
    } finally {
      setReverting(false);
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
    artifacts: artifacts
  });

  const canAdvance = canAdvanceFromPhase(
    project.current_phase,
    project.phases_completed || [],
    project.stack_approved
  );

  const canExecutePhase = shouldShowExecuteButton(project.current_phase);
  const hasCurrentArtifacts = hasArtifactsForPhase(project.current_phase, artifacts);

  return (
    <ErrorBoundary>
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

        {/* Clarification Panel for ANALYSIS phase */}
        {showClarification && project.current_phase === 'ANALYSIS' && clarificationQuestions.length > 0 && (
          <div className="mb-6">
            <ClarificationPanel
              projectSlug={slug}
              questions={clarificationQuestions}
              mode={clarificationMode}
              onModeChange={setClarificationMode}
              onAnswerQuestion={handleClarificationAnswer}
              onAutoResolve={handleAutoResolveSingle}
              onAutoResolveAll={handleAutoResolveAll}
              onSubmit={handleClarificationSubmit}
              onSkip={handleClarificationSkip}
              isSubmitting={submittingClarification}
              isAutoResolving={autoResolvingClarification}
            />
          </div>
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
                analysisContent={stackAnalysisContent}
                classificationContent={classificationContent}
              />
            </CardContent>
          </Card>
        )}

        {/* Validation Results Panel for VALIDATE phase */}
        {project.current_phase === 'VALIDATE' && (
          <div className="mb-6">
            <ValidationResultsPanel
              checks={validationChecks}
              summary={validationSummary}
              onRunValidation={handleRunValidation}
              onDownloadReport={handleDownloadValidationReport}
              isValidating={isValidating}
              canProceed={validationSummary.overallStatus === 'pass' || validationSummary.overallStatus === 'warning'}
              onProceed={handlePhaseAdvance}
            />
          </div>
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
                        variant="outline"
                        onClick={() => setShowRevertDialog(true)}
                        className="flex items-center gap-2 text-blue-600 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                      >
                        <History className="h-4 w-4" />
                        Revert
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowResetDialog(true)}
                        className="flex items-center gap-2 text-amber-600 border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset
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
                        const approved = gate === 'stack_approved' && project.stack_approved;
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

        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-amber-600">Reset Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to reset &quot;{project?.name}&quot;? This will delete all generated artifacts and return the project to the ANALYSIS phase.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(false)}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleResetProject}
                disabled={resetting}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700"
              >
                {resetting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-transparent" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Reset Project
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-blue-600">Revert to Previous Phase</DialogTitle>
              <DialogDescription>
                Select a phase to revert to. All artifacts from the selected phase onwards will be deleted and you can re-run those phases.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">Target Phase</label>
              <select
                value={revertTargetPhase}
                onChange={(e) => setRevertTargetPhase(e.target.value)}
                className="w-full p-2 border border-border rounded-md bg-background"
              >
                <option value="">Select a phase...</option>
                {PHASES.filter((p) => p !== 'DONE').map((phase) => {
                  const phaseIndex = PHASES.indexOf(phase);
                  const currentIndex = PHASES.indexOf(project.current_phase);
                  const isAvailable = phaseIndex <= currentIndex;
                  return (
                    <option key={phase} value={phase} disabled={!isAvailable}>
                      {phase} {!isAvailable ? '(not reached)' : ''}
                    </option>
                  );
                })}
              </select>
              {revertTargetPhase && (
                <p className="text-sm text-muted-foreground mt-2">
                  This will delete all artifacts from <strong>{revertTargetPhase}</strong> onwards and allow you to re-run those phases.
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRevertDialog(false);
                  setRevertTargetPhase('');
                }}
                disabled={reverting}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleRevertPhase}
                disabled={reverting || !revertTargetPhase}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {reverting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-transparent" />
                    Reverting...
                  </>
                ) : (
                  <>
                    <History className="h-4 w-4" />
                    Revert to {revertTargetPhase || 'Phase'}
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
          onReset={() => setShowResetDialog(true)}
          onRevert={() => setShowRevertDialog(true)}
          executeLabel={hasCurrentArtifacts ? `Rebuild ${project.current_phase}` : undefined}
        />
      )}
    </main>
    </ErrorBoundary>
  );
}

function shouldShowExecuteButton(phase: string): boolean {
  // STACK_SELECTION: Uses approval flow, not execute
  // VALIDATE: Uses /validate endpoint via ValidationResultsPanel
  // AUTO_REMEDY: Automated, no manual execution
  // DONE: Uses /generate-handoff endpoint
  if (phase === 'STACK_SELECTION' || phase === 'VALIDATE' || phase === 'AUTO_REMEDY' || phase === 'DONE') {
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
    ANALYSIS: 'Analyze and clarify project requirements. AI agents will generate your project constitution, brief, classification, and user personas.',
    STACK_SELECTION: 'Select and approve the technology stack for your project.',
    SPEC_PM: 'Generate Product Requirements Document (PRD) with functional requirements and acceptance criteria.',
    SPEC_ARCHITECT: 'Generate data model and API specifications based on the PRD.',
    SPEC_DESIGN_TOKENS: 'Generate stack-agnostic design tokens (colors, typography, spacing, animation).',
    SPEC_DESIGN_COMPONENTS: 'Map design tokens to stack-specific components and generate interaction patterns.',
    FRONTEND_BUILD: 'Generate production-ready frontend components from design tokens.',
    DEPENDENCIES: 'Auto-generate all project dependencies based on the approved stack and PRD requirements.',
    SOLUTIONING: 'Create architecture diagrams, break down work into epics and tasks with test-first approach.',
    VALIDATE: 'Cross-artifact consistency analysis. Verify all requirements map to tasks, personas are consistent, and Constitutional Articles are followed.',
    AUTO_REMEDY: 'Automated remediation of validation failures through targeted agent re-runs.',
    DONE: 'Generate final handoff document for LLM-based code generation.'
  };
  return descriptions[phase] || 'Project phase';
}

function getPhaseOutputs(phase: string): string[] {
  const outputs: Record<string, string[]> = {
    ANALYSIS: ['constitution.md', 'project-brief.md', 'project-classification.json', 'personas.md'],
    STACK_SELECTION: ['stack-analysis.md', 'stack-decision.md', 'stack-rationale.md', 'stack.json'],
    SPEC_PM: ['PRD.md'],
    SPEC_ARCHITECT: ['data-model.md', 'api-spec.json'],
    SPEC_DESIGN_TOKENS: ['design-tokens.md'],
    SPEC_DESIGN_COMPONENTS: ['component-mapping.md', 'journey-maps.md'],
    FRONTEND_BUILD: ['components/ui/button.tsx', 'components/ui/card.tsx', 'components/ui/input.tsx'],
    DEPENDENCIES: ['DEPENDENCIES.md', 'dependencies.json'],
    SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md', 'plan.md'],
    VALIDATE: ['validation-report.md', 'coverage-matrix.md'],
    AUTO_REMEDY: ['updated_artifacts'],
    DONE: ['README.md', 'HANDOFF.md']
  };
  return outputs[phase] || [];
}

function getPhaseGates(phase: string): string[] {
  const gates: Record<string, string[]> = {
    STACK_SELECTION: ['stack_approved'],
    DEPENDENCIES: []
  };
  return gates[phase] || [];
}

function isOutputComplete(phase: string, output: string, artifacts: Record<string, Artifact[]> = {}): boolean {
  const phaseArtifacts = artifacts[phase] || [];
  return phaseArtifacts.some((artifact: Artifact) => artifact.name?.toLowerCase() === output.toLowerCase());
}
