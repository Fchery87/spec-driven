import { z } from 'zod';

/**
 * Project creation schema with validation
 */
export const CreateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must not exceed 100 characters')
    .trim(),
  description: z
    .string()
    .max(5000, 'Description must not exceed 5000 characters')
    .trim()
    .optional()
    .default(''),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

/**
 * Stack approval schema with validation
 */
export const ApproveStackSchema = z.object({
  stack_choice: z
    .string()
    .min(1, 'Stack choice is required')
    .trim(),
  reasoning: z
    .string()
    .max(2000, 'Reasoning must not exceed 2000 characters')
    .trim()
    .optional()
    .default(''),
  platform: z
    .string()
    .optional(),
});

export type ApproveStackInput = z.infer<typeof ApproveStackSchema>;

/**
 * Dependencies approval schema with validation
 */
export const ApproveDependenciesSchema = z.object({
  notes: z
    .string()
    .max(1000, 'Notes must not exceed 1000 characters')
    .trim()
    .optional(),
});

export type ApproveDependenciesInput = z.infer<typeof ApproveDependenciesSchema>;
