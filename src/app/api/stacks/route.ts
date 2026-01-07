import { NextResponse } from 'next/server';
import { ConfigLoader } from '@/backend/services/orchestrator/config_loader';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/stacks
 * Returns available stack templates from orchestrator_spec.yml
 */
export async function GET() {
  try {
    const configLoader = new ConfigLoader();
    const spec = configLoader.loadSpec();

    // Get stack_templates from the spec (the 12+ templates)
     
    const rawSpec = spec as any;
    const stackTemplates = rawSpec.stack_templates || {};
    const stackSelectionMode = rawSpec.stack_selection_mode || 'hybrid';

    // Transform stack_templates into array format for the frontend
    const templates = Object.entries(stackTemplates).map(([id, template]) => {
       
      const t = template as any;
      return {
        id,
        name: t.name || id,
        description: t.description || '',
        composition: t.composition || {},
        best_for: t.best_for || [],
        strengths: t.strengths || [],
        tradeoffs: t.tradeoffs || [],
        scaling: t.scaling || '',
      };
    });

    // Also get the legacy stacks object for backwards compatibility
    const legacyStacks = spec.stacks || {};
    const legacyTemplates = Object.entries(legacyStacks).map(([id, stack]) => ({
      id,
      name: stack.name || id,
      description: stack.description || '',
      composition: stack.composition || {},
      best_for: stack.best_for || [],
      strengths: stack.strengths || [],
      tradeoffs: stack.tradeoffs || [],
      scaling: stack.scaling || '',
    }));

    return NextResponse.json({
      success: true,
      data: {
        mode: stackSelectionMode,
        templates: templates.length > 0 ? templates : legacyTemplates,
        // Composition system for the new modular stack builder
        composition_system: configLoader.getCompositionSystem(),
        // Legacy template migration mappings for backward compatibility
        legacy_template_migration: configLoader.getLegacyMappings(),
        // Technical preferences options for custom mode
        technical_preferences: {
          state_management: ['zustand', 'redux', 'jotai', 'recoil', 'mobx', 'valtio', 'none'],
          data_fetching: ['tanstack-query', 'swr', 'rtk-query', 'apollo', 'urql', 'fetch'],
          forms: ['react-hook-form', 'formik', 'react-final-form', 'native'],
          validation: ['zod', 'yup', 'joi', 'valibot', 'arktype'],
          http_client: ['fetch', 'axios', 'ky', 'got'],
          testing: ['vitest', 'jest', 'mocha'],
          e2e_testing: ['playwright', 'cypress', 'none'],
          animation: ['framer-motion', 'react-spring', 'gsap', 'none'],
        },
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error fetching stack templates:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stack templates' },
      { status: 500 }
    );
  }
}
