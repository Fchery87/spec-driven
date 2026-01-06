/**
 * Superpowers Skill Invocation Framework - Base Adapter
 * 
 * This module provides the base SkillAdapter class that all skill adapters
 * must extend.
 */

import { SkillAdapter as ISkillAdapter, SkillContext, SkillResult, SuperpowersSkill } from './types';

/**
 * Abstract base class for skill adapters
 * Provides common functionality for input validation and error handling
 */
export abstract class SkillAdapter implements ISkillAdapter {
  abstract skill: SuperpowersSkill;
  
  /**
   * Determines if this adapter can handle the given phase and context
   * Override this in subclasses to define phase-specific handling
   */
  abstract canHandle(phase: string, context: Record<string, unknown>): boolean;
  
  /**
   * Executes the skill with the given input and context
   * Override this in subclasses to implement skill-specific logic
   */
  abstract execute(input: Record<string, unknown>, context: SkillContext): Promise<SkillResult>;
  
  /**
   * Validates that required fields are present in the input
   * Returns validation result with any errors found
   */
  protected validateInput(
    input: Record<string, unknown>,
    requiredFields: string[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const field of requiredFields) {
      if (input[field] === undefined || input[field] === null || input[field] === '') {
        errors.push(`Missing required field: ${field}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Safely executes a skill operation with error handling
   */
  protected async safeExecute<T>(
    operation: () => Promise<T>,
    context: SkillContext
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await operation();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Skill execution failed: ${message}`);
    } finally {
      const duration = Date.now() - startTime;
      context.output = {
        ...context.output,
        _executionMetadata: {
          durationMs: duration,
          completedAt: new Date().toISOString(),
        },
      };
    }
  }
  
  /**
   * Creates a standardized error result
   */
  protected createErrorResult(errors: string[], durationMs: number = 0): SkillResult {
    return {
      success: false,
      output: {},
      errors,
      durationMs,
    };
  }
  
  /**
   * Creates a standardized success result
   */
  protected createSuccessResult(
    output: Record<string, unknown>,
    durationMs: number
  ): SkillResult {
    return {
      success: true,
      output,
      errors: [],
      durationMs,
    };
  }
}
