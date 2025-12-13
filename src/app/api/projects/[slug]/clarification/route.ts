import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, persistProjectToDB, readArtifact, writeArtifact } from '@/app/api/lib/project-utils';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import type { ClarificationQuestion, ClarificationMode, ClarificationState } from '@/types/orchestrator';

export const runtime = 'nodejs';

/**
 * GET /api/projects/[slug]/clarification
 * Get clarification state and questions for the current phase
 */
const getClarificationHandler = withAuth(
  async (
    request: NextRequest,
    context: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await context.params;
      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      if (metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      // Only ANALYSIS phase has clarification
      if (metadata.current_phase !== 'ANALYSIS') {
        return NextResponse.json({
          success: true,
          data: {
            enabled: false,
            phase: metadata.current_phase,
            message: 'Clarification is only available in ANALYSIS phase'
          }
        });
      }

      // Get existing clarification state or initialize
      const clarificationState: ClarificationState = metadata.clarification_state || {
        mode: 'hybrid',
        questions: [],
        completed: false,
        skipped: false
      };

      // If no questions yet, try to extract from ANALYSIS artifacts
      if (clarificationState.questions.length === 0 && !clarificationState.completed && !clarificationState.skipped) {
        try {
          const questions = await extractClarificationQuestions(slug);
          clarificationState.questions = questions;
        } catch {
          // No artifacts yet or no questions found
          logger.debug('No clarification questions found', { slug });
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          enabled: true,
          phase: metadata.current_phase,
          state: clarificationState
        }
      });
    } catch (error) {
      logger.error('Error getting clarification state', error instanceof Error ? error : new Error(String(error)));
      return NextResponse.json(
        { success: false, error: 'Failed to get clarification state' },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/projects/[slug]/clarification
 * Submit clarification answers
 * Body: { questions: ClarificationQuestion[], mode: ClarificationMode, skip?: boolean }
 */
const submitClarificationHandler = withAuth(
  async (
    request: NextRequest,
    context: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await context.params;
      const body = await request.json();
      const { questions, mode, skip = false } = body as {
        questions?: ClarificationQuestion[];
        mode?: ClarificationMode;
        skip?: boolean;
      };

      const metadata = await getProjectMetadata(slug, session.user.id);

      if (!metadata) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      if (metadata.created_by_id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      if (metadata.current_phase !== 'ANALYSIS') {
        return NextResponse.json(
          { success: false, error: 'Clarification can only be submitted in ANALYSIS phase' },
          { status: 400 }
        );
      }

      // Update clarification state
      const clarificationState: ClarificationState = {
        mode: mode || metadata.clarification_state?.mode || 'hybrid',
        questions: questions || metadata.clarification_state?.questions || [],
        completed: !skip,
        skipped: skip
      };

      // Save updated metadata
      const updated = {
        ...metadata,
        clarification_state: clarificationState,
        updated_at: new Date().toISOString()
      };

      await saveProjectMetadata(slug, updated);
      await persistProjectToDB(slug, updated);

      // Update artifacts to replace [NEEDS CLARIFICATION] markers
      if (skip || clarificationState.questions.some(q => q.resolved)) {
        await updateArtifactsWithResolutions(slug, clarificationState.questions, skip);
      }

      logger.info('Clarification submitted', {
        project: slug,
        mode: clarificationState.mode,
        answeredCount: clarificationState.questions.filter(q => q.resolvedBy === 'user').length,
        aiResolvedCount: clarificationState.questions.filter(q => q.resolvedBy === 'ai').length,
        skipped: skip
      });

      return NextResponse.json({
        success: true,
        data: {
          state: clarificationState,
          message: skip 
            ? 'Clarification skipped - AI will make reasonable assumptions'
            : 'Clarification answers submitted successfully'
        }
      });
    } catch (error) {
      logger.error('Error submitting clarification', error instanceof Error ? error : new Error(String(error)));
      return NextResponse.json(
        { success: false, error: 'Failed to submit clarification' },
        { status: 500 }
      );
    }
  }
);

/**
 * Extract clarification questions from ANALYSIS phase artifacts
 * Looks for [NEEDS CLARIFICATION: question] markers
 */
async function extractClarificationQuestions(slug: string): Promise<ClarificationQuestion[]> {
  const questions: ClarificationQuestion[] = [];
  const artifacts = ['constitution.md', 'project-brief.md', 'personas.md'];
  const clarificationPattern = /\[NEEDS CLARIFICATION:\s*([^\]]+)\]/gi;

  for (const artifact of artifacts) {
    try {
      const content = await readArtifact(slug, 'ANALYSIS', artifact);
      let match;
      let index = 0;

      while ((match = clarificationPattern.exec(content)) !== null) {
        const questionText = match[1].trim();
        
        // Determine category based on source artifact
        let category = 'General';
        if (artifact === 'constitution.md') category = 'Principles';
        else if (artifact === 'project-brief.md') category = 'Requirements';
        else if (artifact === 'personas.md') category = 'Users';

        questions.push({
          id: `${artifact}-${index}`,
          category,
          question: questionText,
          context: `Found in ${artifact}`,
          resolved: false,
          resolvedBy: null
        });
        index++;
      }
    } catch {
      // Artifact not found, skip
    }
  }

  return questions;
}

/**
 * Update artifact files to replace [NEEDS CLARIFICATION] markers
 * with user answers or AI assumptions
 */
async function updateArtifactsWithResolutions(
  slug: string,
  questions: ClarificationQuestion[],
  skipped: boolean
): Promise<void> {
  const artifacts = ['constitution.md', 'project-brief.md', 'personas.md'];
  
  for (const artifactName of artifacts) {
    try {
      let content = await readArtifact(slug, 'ANALYSIS', artifactName);
      let modified = false;
      
      // Replace resolved questions with their answers/assumptions
      for (const question of questions) {
        if (question.resolved) {
          const questionText = question.question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = new RegExp(
            `\\[NEEDS CLARIFICATION:\\s*${questionText.substring(0, 50)}[^\\]]*\\]`,
            'gi'
          );
          
          let replacement: string;
          if (question.resolvedBy === 'user' && question.userAnswer) {
            replacement = `[RESOLVED: ${question.userAnswer}]`;
          } else if (question.aiAssumed) {
            replacement = `[AI ASSUMED: ${question.aiAssumed.assumption} - ${question.aiAssumed.rationale}]`;
          } else {
            replacement = '[AI ASSUMED: Standard practice will be followed - Auto-resolved]';
          }
          
          if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
            modified = true;
          }
        }
      }
      
      // If skipped, replace ALL remaining markers with generic assumption
      if (skipped) {
        const remainingPattern = /\[NEEDS CLARIFICATION:[^\]]+\]/gi;
        if (remainingPattern.test(content)) {
          content = content.replace(remainingPattern, '[AI ASSUMED: Standard industry practice will be followed - Skipped by user]');
          modified = true;
        }
      }
      
      if (modified) {
        await writeArtifact(slug, 'ANALYSIS', artifactName, content);
        logger.debug('Updated artifact with clarification resolutions', { slug, artifact: artifactName });
      }
    } catch {
      // Artifact might not exist, skip
    }
  }
}

export const GET = getClarificationHandler;
export const POST = submitClarificationHandler;
