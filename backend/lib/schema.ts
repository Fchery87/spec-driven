import { pgTable, text, boolean, timestamp, integer, index, uuid } from 'drizzle-orm/pg-core';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { sql } from 'drizzle-orm';
import { relations, InferSelectModel } from 'drizzle-orm';

// Project model
export const projects = pgTable('Project', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  currentPhase: text('current_phase').notNull().default('ANALYSIS'),
  phasesCompleted: text('phases_completed').notNull().default(''),
  stackChoice: text('stack_choice'),
  stackApproved: boolean('stack_approved').notNull().default(false),
  projectType: text('project_type'),
  scaleTier: text('scale_tier'),
  recommendedStack: text('recommended_stack'),
  workflowVersion: integer('workflow_version').notNull().default(2),
  handoffGenerated: boolean('handoff_generated').notNull().default(false),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Clarification tracking (JSON stored as text)
  clarificationState: text('clarification_state'), // JSON: ClarificationState
  clarificationMode: text('clarification_mode').default('hybrid'), // 'interactive' | 'hybrid' | 'auto_resolve'
  clarificationCompleted: boolean('clarification_completed').notNull().default(false),

  // AUTO_REMEDY tracking
  autoRemedyAttempts: integer('auto_remedy_attempts').notNull().default(0),
  lastRemedyPhase: text('last_remedy_phase'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  handoffGeneratedAt: timestamp('handoff_generated_at', { withTimezone: true }),
}, (table) => ({
  slugIdx: index('Project_slug_idx').on(table.slug),
  createdAtIdx: index('Project_created_at_idx').on(table.createdAt),
  ownerIdx: index('Project_owner_id_idx').on(table.ownerId),
}));

// Artifact model - stores generated specifications
export const artifacts = pgTable('Artifact', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phase: text('phase').notNull(), // ANALYSIS, STACK_SELECTION, SPEC, DEPENDENCIES, SOLUTIONING, VALIDATE, DONE
  filename: text('filename').notNull(),
  content: text('content').notNull(),
  version: integer('version').notNull().default(1),
  fileHash: text('file_hash'), // For detecting duplicates/changes

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('Artifact_project_id_idx').on(table.projectId),
  phaseIdx: index('Artifact_phase_idx').on(table.phase),
  createdAtIdx: index('Artifact_created_at_idx').on(table.createdAt),
}));

// Phase history - tracks when phases were completed
export const phaseHistory = pgTable('PhaseHistory', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phase: text('phase').notNull(),
  status: text('status').notNull().default('in_progress'), // in_progress, completed, failed
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'), // Time spent in this phase
  errorMessage: text('error_message'), // If phase failed
}, (table) => ({
  projectIdIdx: index('PhaseHistory_project_id_idx').on(table.projectId),
  phaseIdx: index('PhaseHistory_phase_idx').on(table.phase),
}));

// Stack choice record - for audit trail
export const stackChoices = pgTable('StackChoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  stackId: text('stack_id').notNull(),
  reasoning: text('reasoning').notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('StackChoice_project_id_idx').on(table.projectId),
}));

// User roles enum
export const userRoleEnum = ['user', 'admin', 'super_admin'] as const;
export type UserRole = typeof userRoleEnum[number];

// User model (for future multi-user support)
export const users = pgTable('User', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('user'), // 'user' | 'admin' | 'super_admin'

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('User_email_idx').on(table.email),
}));

// Better Auth: Account model (OAuth/credentials)
export const accounts = pgTable('Account', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  password: text('password'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdProviderIdIdx: index('Account_account_id_provider_id_idx').on(table.accountId, table.providerId),
  userIdIdx: index('Account_user_id_idx').on(table.userId),
}));

// Better Auth: Session model
export const sessions = pgTable('Session', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('Session_user_id_idx').on(table.userId),
}));

// Better Auth: Verification token model (for email verification, password reset)
export const verifications = pgTable('Verification', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  // Timestamps required by Better Auth
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('Verification_user_id_idx').on(table.userId),
  identifierValueIdx: index('Verification_identifier_value_idx').on(table.identifier, table.value),
}));

// Settings model for app-wide configuration
export const settings = pgTable('Setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Secrets model for encrypted API keys (fallback when env vars not set)
export const secrets = pgTable('Secret', {
  key: text('key').primaryKey(), // e.g., 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'
  encryptedValue: text('encrypted_value').notNull(), // AES-256-GCM encrypted
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Validation tracking tables for AUTO_REMEDY phase
export const validationRuns = pgTable('ValidationRun', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phase: text('phase').notNull(),
  passed: boolean('passed').notNull().default(false),
  failureReasons: text('failure_reasons'), // JSON string of FailureReason[]
  warningCount: integer('warning_count').notNull().default(0),
  durationMs: integer('duration_ms').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('ValidationRun_project_id_idx').on(table.projectId),
  phaseIdx: index('ValidationRun_phase_idx').on(table.phase),
  createdAtIdx: index('ValidationRun_created_at_idx').on(table.createdAt),
}));

export const artifactVersions = pgTable('ArtifactVersion', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  artifactId: text('artifact_id').notNull(), // e.g., 'PRD.md', 'stack.json'
  version: integer('version').notNull(), // Incremental version number
  contentHash: text('content_hash').notNull(), // SHA-256 hash for diff detection
  regenerationReason: text('regeneration_reason'), // Why was this regenerated?
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('ArtifactVersion_project_id_idx').on(table.projectId),
  artifactIdIdx: index('ArtifactVersion_artifact_id_idx').on(table.artifactId),
  createdAtIdx: index('ArtifactVersion_created_at_idx').on(table.createdAt),
}));

export const autoRemedyRuns = pgTable('AutoRemedyRun', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  validationRunId: uuid('validation_run_id').notNull().references(() => validationRuns.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  successful: boolean('successful').notNull().default(false),
  changesApplied: text('changes_applied'), // JSON string of changes made
}, (table) => ({
  projectIdIdx: index('AutoRemedyRun_project_id_idx').on(table.projectId),
  validationRunIdIdx: index('AutoRemedyRun_validation_run_id_idx').on(table.validationRunId),
  startedAtIdx: index('AutoRemedyRun_started_at_idx').on(table.startedAt),
}));

// Phase 2: Phase snapshots for rollback capability
export const phaseSnapshots = pgTable('PhaseSnapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phaseName: text('phase_name').notNull(),
  snapshotNumber: integer('snapshot_number').notNull(),

  // Snapshot contents (JSON stored as text)
  artifactsJson: text('artifacts_json').notNull(),
  metadata: text('metadata').notNull(),
  userInputs: text('user_inputs'),
  validationResults: text('validation_results'),

  // Git integration
  gitCommitHash: text('git_commit_hash'),
  gitBranch: text('git_branch'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectPhaseIdx: index('PhaseSnapshot_project_phase_idx').on(table.projectId, table.phaseName),
  createdAtIdx: index('PhaseSnapshot_created_at_idx').on(table.createdAt),
}));

// Phase 2: Approval gate tracking
export const approvalGates = pgTable('ApprovalGate', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  gateName: text('gate_name').notNull(), // stack_approved, prd_approved, architecture_approved, handoff_acknowledged
  phase: text('phase').notNull(),

  status: text('status').notNull().default('pending'), // pending, approved, rejected, auto_approved
  blocking: boolean('blocking').notNull().default(false),

  // Approval details
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  autoApproved: boolean('auto_approved').default(false),
  constitutionalScore: integer('constitutional_score'),

  // Stakeholder info
  stakeholderRole: text('stakeholder_role'),
  notes: text('notes'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectGateIdx: index('ApprovalGate_project_gate_idx').on(table.projectId, table.gateName),
  statusIdx: index('ApprovalGate_status_idx').on(table.status),
}));

// Phase 2: Git operation tracking
export const gitOperations = pgTable('GitOperation', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  operationType: text('operation_type').notNull(), // commit, push, tag, rollback
  phase: text('phase').notNull(),

  commitHash: text('commit_hash'),
  commitMessage: text('commit_message'),
  branch: text('branch'),
  tag: text('tag'),

  success: boolean('success').notNull(),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdx: index('GitOperation_project_idx').on(table.projectId),
  typeIdx: index('GitOperation_type_idx').on(table.operationType),
  createdAtIdx: index('GitOperation_created_at_idx').on(table.createdAt),
}));

// Define relationships using Drizzle relations
export const projectsRelations = relations(projects, ({ many }) => ({
  artifacts: many(artifacts),
  phaseHistory: many(phaseHistory),
  stackChoice: many(stackChoices),
  validationRuns: many(validationRuns),
  artifactVersions: many(artifactVersions),
  autoRemedyRuns: many(autoRemedyRuns),
  phaseSnapshots: many(phaseSnapshots),
  approvalGates: many(approvalGates),
  gitOperations: many(gitOperations),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  project: one(projects, {
    fields: [artifacts.projectId],
    references: [projects.id],
  }),
}));

export const phaseHistoryRelations = relations(phaseHistory, ({ one }) => ({
  project: one(projects, {
    fields: [phaseHistory.projectId],
    references: [projects.id],
  }),
}));

export const stackChoicesRelations = relations(stackChoices, ({ one }) => ({
  project: one(projects, {
    fields: [stackChoices.projectId],
    references: [projects.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const verificationsRelations = relations(verifications, ({ one }) => ({
  user: one(users, {
    fields: [verifications.userId],
    references: [users.id],
  }),
}));

export const validationRunsRelations = relations(validationRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [validationRuns.projectId],
    references: [projects.id],
  }),
  autoRemedyRuns: many(autoRemedyRuns),
}));

export const artifactVersionsRelations = relations(artifactVersions, ({ one }) => ({
  project: one(projects, {
    fields: [artifactVersions.projectId],
    references: [projects.id],
  }),
}));

export const autoRemedyRunsRelations = relations(autoRemedyRuns, ({ one }) => ({
  project: one(projects, {
    fields: [autoRemedyRuns.projectId],
    references: [projects.id],
  }),
  validationRun: one(validationRuns, {
    fields: [autoRemedyRuns.validationRunId],
    references: [validationRuns.id],
  }),
}));

export const phaseSnapshotsRelations = relations(phaseSnapshots, ({ one }) => ({
  project: one(projects, {
    fields: [phaseSnapshots.projectId],
    references: [projects.id],
  }),
}));

export const approvalGatesRelations = relations(approvalGates, ({ one }) => ({
  project: one(projects, {
    fields: [approvalGates.projectId],
    references: [projects.id],
  }),
  approvedByUser: one(users, {
    fields: [approvalGates.approvedBy],
    references: [users.id],
  }),
}));

export const gitOperationsRelations = relations(gitOperations, ({ one }) => ({
  project: one(projects, {
    fields: [gitOperations.projectId],
    references: [projects.id],
  }),
}));

// Types
export type Project = InferSelectModel<typeof projects>;
export type Artifact = InferSelectModel<typeof artifacts>;
export type PhaseHistory = InferSelectModel<typeof phaseHistory>;
export type StackChoice = InferSelectModel<typeof stackChoices>;
export type User = InferSelectModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type Verification = InferSelectModel<typeof verifications>;
export type Setting = InferSelectModel<typeof settings>;
export type Secret = InferSelectModel<typeof secrets>;
export type ValidationRun = InferSelectModel<typeof validationRuns>;
export type ArtifactVersion = InferSelectModel<typeof artifactVersions>;
export type AutoRemedyRun = InferSelectModel<typeof autoRemedyRuns>;
export type PhaseSnapshot = InferSelectModel<typeof phaseSnapshots>;
export type ApprovalGate = InferSelectModel<typeof approvalGates>;
export type GitOperation = InferSelectModel<typeof gitOperations>;
