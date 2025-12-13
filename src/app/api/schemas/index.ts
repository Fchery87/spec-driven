import { z } from 'zod';

/**
 * Project creation schema with validation
 */
export const CreateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Project name is required')
    .max(100, 'Project name must not exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(5000, 'Description must not exceed 5000 characters')
    .optional()
    .default(''),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

/**
 * Custom stack composition schema for fully custom stack definitions
 */
const CustomStackCompositionSchema = z.object({
  frontend: z.object({
    framework: z.string(),
    meta_framework: z.string().nullable().optional(),
    styling: z.string().default('Tailwind CSS'),
    ui_library: z.string().default('shadcn/ui'),
  }),
  mobile: z.object({
    platform: z.enum(['none', 'expo', 'react-native-bare', 'flutter', 'native-ios', 'native-android', 'capacitor', 'ionic']).default('none'),
  }),
  backend: z.object({
    language: z.string(),
    framework: z.string(),
  }),
  database: z.object({
    type: z.enum(['sql', 'nosql', 'edge', 'graph', 'none']),
    provider: z.string(),
    orm: z.string().optional(),
  }),
  deployment: z.object({
    platform: z.string(),
    architecture: z.enum(['monolith', 'modular-monolith', 'microservices', 'serverless', 'edge']).default('monolith'),
  }),
});

/**
 * Technical preferences schema for library selections
 */
const TechnicalPreferencesSchema = z.object({
  state_management: z.enum(['zustand', 'redux', 'jotai', 'recoil', 'mobx', 'valtio', 'none']).optional(),
  data_fetching: z.enum(['tanstack-query', 'swr', 'rtk-query', 'apollo', 'urql', 'fetch']).optional(),
  forms: z.enum(['react-hook-form', 'formik', 'react-final-form', 'native']).optional(),
  validation: z.enum(['zod', 'yup', 'joi', 'valibot', 'arktype']).optional(),
  http_client: z.enum(['fetch', 'axios', 'ky', 'got']).optional(),
  testing: z.enum(['vitest', 'jest', 'mocha']).optional(),
  e2e_testing: z.enum(['playwright', 'cypress', 'none']).optional(),
  animation: z.enum(['framer-motion', 'react-spring', 'gsap', 'none']).optional(),
});

/**
 * Stack approval schema with validation - supports hybrid mode
 * Users can either select a template OR define a fully custom stack
 */
export const ApproveStackSchema = z.object({
  // Selection mode: 'template' for predefined stacks, 'custom' for fully custom
  mode: z.enum(['template', 'custom']).default('template'),
  
  // For template mode: the template ID (e.g., 'nextjs_fullstack_expo', 'vue_nuxt', etc.)
  stack_choice: z
    .string()
    .min(1, 'Stack choice is required')
    .trim(),
  
  // For custom mode: full stack composition
  custom_composition: CustomStackCompositionSchema.optional(),
  
  // Technical preferences (applies to both modes)
  technical_preferences: TechnicalPreferencesSchema.optional(),
  
  // Reasoning for the selection (from architect proposal or user)
  reasoning: z
    .string()
    .max(5000, 'Reasoning must not exceed 5000 characters')
    .trim()
    .optional()
    .default(''),
  
  // Alternatives considered (for audit trail)
  alternatives_considered: z.array(z.object({
    stack: z.string(),
    reason_not_chosen: z.string(),
  })).optional(),
  
  // Legacy field for backwards compatibility
  platform: z
    .string()
    .optional(),
});

export type ApproveStackInput = z.infer<typeof ApproveStackSchema>;
export type CustomStackComposition = z.infer<typeof CustomStackCompositionSchema>;
export type TechnicalPreferences = z.infer<typeof TechnicalPreferencesSchema>;

/**
 * Dependency package schema
 */
const DependencyPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  size: z.string().optional(),
  category: z.enum(['core', 'ui', 'data', 'auth', 'utils', 'dev']),
});

/**
 * Dependency option schema (preset selection)
 */
const DependencyOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  frontend: z.string(),
  backend: z.string(),
  database: z.string(),
  deployment: z.string(),
  packages: z.array(DependencyPackageSchema),
  highlights: z.array(z.string()),
});

/**
 * Custom stack schema
 */
const CustomStackSchema = z.object({
  frontend: z.string(),
  backend: z.string(),
  database: z.string(),
  deployment: z.string(),
  dependencies: z.array(z.string()),
  requests: z.string().optional(),
});

/**
 * Dependencies approval schema with validation
 */
export const ApproveDependenciesSchema = z.object({
  notes: z
    .string()
    .max(2000, 'Notes must not exceed 2000 characters')
    .trim()
    .optional(),
  // New fields for dependency selection
  mode: z.enum(['preset', 'custom']).optional(),
  architecture: z.string().optional(),
  option: DependencyOptionSchema.optional(),
  customStack: CustomStackSchema.optional(),
});

export type ApproveDependenciesInput = z.infer<typeof ApproveDependenciesSchema>;
export type DependencyPackage = z.infer<typeof DependencyPackageSchema>;
export type DependencyOption = z.infer<typeof DependencyOptionSchema>;
