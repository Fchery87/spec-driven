/**
 * Validation Schemas
 *
 * Zod schemas for all API request validation
 * Provides type safety and runtime validation
 */

import { z } from 'zod';
 
import { logger } from '@/lib/logger';

// ============================================================================
// Authentication Schemas
// ============================================================================

export const RegisterSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
});

export const LoginSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(1, 'Password is required')
});

export const ChangePasswordSchema = z.object({
  oldPassword: z.string()
    .min(1, 'Old password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
});

// ============================================================================
// Project Schemas
// ============================================================================

export const CreateProjectSchema = z.object({
  name: z.string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name must be less than 100 characters')
    .trim(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional(),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional()
});

export const UpdateProjectSchema = z.object({
  name: z.string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name must be less than 100 characters')
    .trim()
    .optional(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional()
});

export const ApproveStackSchema = z.object({
  stack_choice: z.string()
    .min(1, 'Stack choice is required'),
  reasoning: z.string()
    .min(10, 'Reasoning must be at least 10 characters')
    .max(1000, 'Reasoning must be less than 1000 characters')
    .optional()
});

export const ApproveDependenciesSchema = z.object({
  approved: z.boolean(),
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
});

// ============================================================================
// Phase Schemas
// ============================================================================

export const PhaseActionSchema = z.object({
  action: z.enum(['validate', 'advance']),
  reasoning: z.string()
    .max(500, 'Reasoning must be less than 500 characters')
    .optional()
});

// ============================================================================
// Artifact Schemas
// ============================================================================

export const SaveArtifactSchema = z.object({
  phase: z.string()
    .min(1, 'Phase is required'),
  filename: z.string()
    .min(1, 'Filename is required')
    .max(255, 'Filename must be less than 255 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Filename contains invalid characters'),
  content: z.string()
    .max(10000000, 'Content must be less than 10MB')
});

// ============================================================================
// Pagination Schemas
// ============================================================================

export const PaginationSchema = z.object({
  page: z.string()
    .transform(val => parseInt(val))
    .refine(val => val >= 1, 'Page must be >= 1')
    .optional()
    .default('1'),
  limit: z.string()
    .transform(val => parseInt(val))
    .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('20')
});

// ============================================================================
// Type Exports
// ============================================================================

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ApproveStackInput = z.infer<typeof ApproveStackSchema>;
export type ApproveDependenciesInput = z.infer<typeof ApproveDependenciesSchema>;
export type PhaseActionInput = z.infer<typeof PhaseActionSchema>;
export type SaveArtifactInput = z.infer<typeof SaveArtifactSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate request data against a schema
 * Returns validated data or throws AppError
 */
export function validateInput<T>(
  schema: z.ZodSchema,
  data: unknown,
  context?: string
): T {
  try {
    return schema.parse(data) as T;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.errors.reduce(
        (acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );

      // Import here to avoid circular dependency
       
      const { Errors } = require('./error_handler');
      throw Errors.validationError(
        `Invalid ${context || 'input'}: ${Object.values(details).join(', ')}`,
        details
      );
    }
    throw error;
  }
}

/**
 * Safely parse JSON with error handling
 */
 
export function safeParseJSON(jsonString: string): Record<string, any> {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    // Import here to avoid circular dependency
     
    const { Errors } = require('./error_handler');
    throw Errors.invalidInput(
      'Invalid JSON format',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}
