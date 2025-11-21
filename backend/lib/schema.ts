import { pgTable, text, boolean, timestamp, integer, index, uuid } from 'drizzle-orm/pg-core';
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
  dependenciesApproved: boolean('dependencies_approved').notNull().default(false),
  handoffGenerated: boolean('handoff_generated').notNull().default(false),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  handoffGeneratedAt: timestamp('handoff_generated_at', { withTimezone: true }),
}, (table) => ({
  slugIdx: index('Project_slug_idx').on(table.slug),
  createdAtIdx: index('Project_created_at_idx').on(table.createdAt),
}));

// Artifact model - stores generated specifications
export const artifacts = pgTable('Artifact', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phase: text('phase').notNull(), // ANALYSIS, STACK_SELECTION, SPEC, DEPENDENCIES, SOLUTIONING, DONE
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

// Dependency approval record
export const dependencyApprovals = pgTable('DependencyApproval', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }).defaultNow().notNull(),
  approvedBy: text('approved_by'), // For future multi-user support
  notes: text('notes'),
}, (table) => ({
  projectIdIdx: index('DependencyApproval_project_id_idx').on(table.projectId),
}));

// User model (for future multi-user support)
export const users = pgTable('User', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  passwordHash: text('password_hash'),

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

// Define relationships using Drizzle relations
export const projectsRelations = relations(projects, ({ many }) => ({
  artifacts: many(artifacts),
  phaseHistory: many(phaseHistory),
  stackChoice: many(stackChoices),
  dependencyApproval: many(dependencyApprovals),
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

export const dependencyApprovalsRelations = relations(dependencyApprovals, ({ one }) => ({
  project: one(projects, {
    fields: [dependencyApprovals.projectId],
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

// Types
export type Project = InferSelectModel<typeof projects>;
export type Artifact = InferSelectModel<typeof artifacts>;
export type PhaseHistory = InferSelectModel<typeof phaseHistory>;
export type StackChoice = InferSelectModel<typeof stackChoices>;
export type DependencyApproval = InferSelectModel<typeof dependencyApprovals>;
export type User = InferSelectModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type Verification = InferSelectModel<typeof verifications>;
export type Setting = InferSelectModel<typeof settings>;
