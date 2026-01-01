import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDesignExecutor } from './agent_executors';

describe('Design Agent Executor', () => {
  let mockLLMClient;
  let mockConfigLoader;

  beforeEach(() => {
    // Mock LLM provider
    mockLLMClient = {
      generateCompletion: vi.fn().mockResolvedValue({
        content: '# Design Tokens\n\n## Colors\n- primary: #3b82f6\n...'
      })
    };

    // Mock ConfigLoader
    mockConfigLoader = {
      getLLMProvider: vi.fn().mockReturnValue(mockLLMClient),
      getSection: vi.fn().mockReturnValue({
        designer: {
          prompt_template: 'Design prompt template'
        }
      })
    };
  });

  it('should generate design artifacts for DESIGN phase', async () => {
    const prd = '# PRD\n\n## Features\nFeature A';
    const brief = '# Project Brief\n\nStyle: Modern minimalist';
    const personas = '# Personas\n\n## User\nAlice';

    const result = await getDesignExecutor(
      mockLLMClient,
      'test-project',
      {
        'SPEC/PRD.md': prd,
        'ANALYSIS/project-brief.md': brief,
        'ANALYSIS/personas.md': personas
      },
      'Test Project'
    );

    expect(result).toHaveProperty('design-system.md');
    expect(result).toHaveProperty('component-inventory.md');
    expect(result).toHaveProperty('user-flows.md');
    expect(result['design-system.md']).toBeDefined();
  });

  it('should call LLM with design context', async () => {
    const prd = '# PRD';
    const brief = '# Brief';
    const personas = '# Personas';

    await getDesignExecutor(
      mockLLMClient,
      'test-project',
      {
        'SPEC/PRD.md': prd,
        'ANALYSIS/project-brief.md': brief,
        'ANALYSIS/personas.md': personas
      },
      'Test Project'
    );

    expect(mockLLMClient.generateCompletion).toHaveBeenCalled();
    const callArgs = mockLLMClient.generateCompletion.mock.calls[0];
    expect(callArgs[0]).toContain('Design');
    expect(callArgs[0]).toContain('Test Project');
  });
});
