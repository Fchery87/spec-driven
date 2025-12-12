import { NextRequest, NextResponse } from 'next/server';
import { getProjectMetadata, saveProjectMetadata, persistProjectToDB } from '@/app/api/lib/project-utils';
import { logger } from '@/lib/logger';
import { withAuth, type AuthSession } from '@/app/api/middleware/auth-guard';
import type { ClarificationQuestion, ClarificationState } from '@/types/orchestrator';
import { GeminiClient } from '@/backend/services/llm/llm_client';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/projects/[slug]/clarification/auto-resolve
 * Auto-resolve clarification questions using AI
 * Body: { questionIds?: string[] } - if empty/undefined, resolves all unresolved questions
 */
const autoResolveHandler = withAuth(
  async (
    request: NextRequest,
    context: { params: Promise<{ slug: string }> },
    session: AuthSession
  ) => {
    try {
      const { slug } = await context.params;
      const body = await request.json().catch(() => ({}));
      const { questionIds } = body as { questionIds?: string[] };

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
          { success: false, error: 'Auto-resolve only available in ANALYSIS phase' },
          { status: 400 }
        );
      }

      const clarificationState: ClarificationState = metadata.clarification_state || {
        mode: 'hybrid',
        questions: [],
        completed: false,
        skipped: false
      };

      if (clarificationState.questions.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            state: clarificationState,
            resolved: [],
            message: 'No questions to auto-resolve'
          }
        });
      }

      // Determine which questions to resolve
      const questionsToResolve = clarificationState.questions.filter(q => {
        if (q.resolved) return false;
        if (questionIds && questionIds.length > 0) {
          return questionIds.includes(q.id);
        }
        return true; // Resolve all unresolved if no specific IDs provided
      });

      if (questionsToResolve.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            state: clarificationState,
            resolved: [],
            message: 'No unresolved questions to process'
          }
        });
      }

      // Use LLM to generate assumptions for each question
      const resolvedQuestions = await resolveQuestionsWithAI(
        questionsToResolve,
        metadata.name,
        metadata.description || ''
      );

      // Update the questions in state
      const updatedQuestions = clarificationState.questions.map(q => {
        const resolved = resolvedQuestions.find(r => r.id === q.id);
        return resolved || q;
      });

      const updatedState: ClarificationState = {
        ...clarificationState,
        questions: updatedQuestions,
        completed: updatedQuestions.every(q => q.resolved)
      };

      // Save updated metadata
      const updated = {
        ...metadata,
        clarification_state: updatedState,
        updated_at: new Date().toISOString()
      };

      await saveProjectMetadata(slug, updated);
      await persistProjectToDB(slug, updated);

      logger.info('Auto-resolved clarification questions', {
        project: slug,
        resolvedCount: resolvedQuestions.length,
        totalQuestions: updatedQuestions.length
      });

      return NextResponse.json({
        success: true,
        data: {
          state: updatedState,
          resolved: resolvedQuestions.map(q => ({
            id: q.id,
            question: q.question,
            assumption: q.aiAssumed?.assumption,
            rationale: q.aiAssumed?.rationale
          })),
          message: `Auto-resolved ${resolvedQuestions.length} question(s)`
        }
      });
    } catch (error) {
      logger.error('Error auto-resolving clarifications', error instanceof Error ? error : new Error(String(error)));
      return NextResponse.json(
        { success: false, error: 'Failed to auto-resolve clarifications' },
        { status: 500 }
      );
    }
  }
);

/**
 * Load LLM config from orchestrator_spec.yml
 */
function loadLLMConfig() {
  const specPath = path.resolve(process.cwd(), 'orchestrator_spec.yml');
  const specContent = fs.readFileSync(specPath, 'utf-8');
  const spec = yaml.load(specContent) as { llm_config?: { model?: string; temperature?: number; max_tokens?: number; timeout_seconds?: number } };
  
  return {
    provider: 'gemini',
    model: spec.llm_config?.model || 'gemini-2.5-flash-preview-05-20',
    api_key: process.env.GEMINI_API_KEY || '',
    temperature: spec.llm_config?.temperature || 0.7,
    max_tokens: spec.llm_config?.max_tokens || 8192,
    timeout_seconds: spec.llm_config?.timeout_seconds || 120
  };
}

/**
 * Use LLM to generate reasonable assumptions for clarification questions
 */
async function resolveQuestionsWithAI(
  questions: ClarificationQuestion[],
  projectName: string,
  projectDescription: string
): Promise<ClarificationQuestion[]> {
  const prompt = `You are helping to clarify requirements for a software project.

Project: ${projectName}
Description: ${projectDescription}

For each question below, provide a reasonable assumption that a senior engineer would make, along with brief rationale.

Questions:
${questions.map((q, i) => `${i + 1}. [${q.category}] ${q.question}`).join('\n')}

Respond in JSON format:
{
  "assumptions": [
    {
      "questionIndex": 0,
      "assumption": "The reasonable assumption",
      "rationale": "Why this assumption is reasonable"
    }
  ]
}

Guidelines:
- Choose the most common, pragmatic option
- Favor simplicity and standard practices
- Consider the project context
- Keep assumptions brief but clear`;

  try {
    const llmConfig = loadLLMConfig();
    const client = new GeminiClient(llmConfig);
    const response = await client.generateCompletion(prompt);
    
    // Parse the JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      assumptions: Array<{
        questionIndex: number;
        assumption: string;
        rationale: string;
      }>;
    };

    // Map assumptions back to questions
    return questions.map((q, index) => {
      const assumption = parsed.assumptions.find(a => a.questionIndex === index);
      if (assumption) {
        return {
          ...q,
          resolved: true,
          resolvedBy: 'ai' as const,
          aiAssumed: {
            assumption: assumption.assumption,
            rationale: assumption.rationale
          }
        };
      }
      return q;
    });
  } catch (error) {
    logger.error('Failed to get AI assumptions', error instanceof Error ? error : new Error(String(error)));
    
    // Fallback: mark as resolved with generic assumption
    return questions.map(q => ({
      ...q,
      resolved: true,
      resolvedBy: 'ai' as const,
      aiAssumed: {
        assumption: 'Standard industry practice will be followed',
        rationale: 'Unable to generate specific assumption; defaulting to common patterns'
      }
    }));
  }
}

export const POST = autoResolveHandler;
