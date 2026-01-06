/**
 * Brainstorming Skill Adapter
 * 
 * Generates creative ideas and recommendations for project phases
 * using structured brainstorming techniques.
 */

import { SkillAdapter } from '../skill_adapter';
import { SkillContext, SkillResult, SuperpowersSkill } from '../types';

export class BrainstormingAdapter extends SkillAdapter {
  skill: SuperpowersSkill = 'brainstorming';
  
  canHandle(phase: string, context: Record<string, unknown>): boolean {
    return ['ANALYSIS', 'STACK_SELECTION'].includes(phase);
  }
  
  async execute(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<SkillResult> {
    const startTime = Date.now();
    
    const { valid, errors } = this.validateInput(input, ['topic', 'constraints']);
    if (!valid) {
      return this.createErrorResult(errors, Date.now() - startTime);
    }
    
    const prompt = this.buildBrainstormingPrompt(input);
    
    // In a real implementation, this would call an LLM
    // For now, we'll simulate the response
    const generatedIdeas = this.simulateBrainstorming(input);
    
    return this.createSuccessResult(
      {
        ideas: generatedIdeas.ideas,
        recommendations: generatedIdeas.recommendations,
        rankedOptions: generatedIdeas.rankedOptions,
        promptUsed: prompt,
      },
      Date.now() - startTime
    );
  }
  
  private buildBrainstormingPrompt(input: Record<string, unknown>): string {
    return `
# Brainstorming Session

## Topic
${input.topic}

## Constraints
${input.constraints}

## Additional Context
${input.additionalContext || 'No additional context provided'}

## Output Format
Generate 5-7 distinct ideas with:
- Title
- Description (2-3 sentences)
- Pros
- Cons
- Feasibility Score (1-10)

Rank ideas by feasibility and provide recommendations.
`.trim();
  }
  
  private simulateBrainstorming(input: Record<string, unknown>): {
    ideas: Array<{
      title: string;
      description: string;
      pros: string[];
      cons: string[];
      feasibilityScore: number;
    }>;
    recommendations: string[];
    rankedOptions: string[];
  } {
    const topic = String(input.topic || 'project');
    
    return {
      ideas: [
        {
          title: `Core ${topic} Features`,
          description: `Build the essential ${topic} features first to establish a solid foundation.`,
          pros: ['Clear MVP scope', 'Faster time to market', 'Focused development'],
          cons: ['Limited initial functionality', 'May miss edge cases'],
          feasibilityScore: 9,
        },
        {
          title: `Enhanced ${topic} Experience`,
          description: `Create a premium ${topic} experience with advanced features.`,
          pros: ['Differentiates from competitors', 'Higher user satisfaction'],
          cons: ['Longer development time', 'Higher complexity'],
          feasibilityScore: 7,
        },
        {
          title: `Modular ${topic} Architecture`,
          description: `Design ${topic} with modular components for easy extension.`,
          pros: ['Maintainable', 'Scalable', 'Reusable components'],
          cons: ['More upfront design work', 'Initial complexity'],
          feasibilityScore: 8,
        },
        {
          title: `Rapid ${topic} Prototype`,
          description: `Build a quick prototype to validate assumptions.`,
          pros: ['Fast validation', 'Low risk', 'Quick feedback'],
          cons: ['May need complete rewrite', 'Limited features'],
          feasibilityScore: 8,
        },
        {
          title: `Full-Featured ${topic} Platform`,
          description: `Build a comprehensive ${topic} platform from day one.`,
          pros: ['Complete solution', 'No technical debt'],
          cons: ['Very long development', 'Higher risk'],
          feasibilityScore: 5,
        },
      ],
      recommendations: [
        'Start with Core Features for fastest validation',
        'Consider Modular Architecture for long-term maintainability',
        'Prototype critical components before full implementation',
      ],
      rankedOptions: [
        'Core Features (Feasibility: 9)',
        'Modular Architecture (Feasibility: 8)',
        'Rapid Prototype (Feasibility: 8)',
        'Enhanced Experience (Feasibility: 7)',
        'Full-Featured Platform (Feasibility: 5)',
      ],
    };
  }
}
