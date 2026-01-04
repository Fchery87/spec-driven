export type GitMode = 'full_integration' | 'local_only' | 'disabled';

export interface GitConfig {
  mode: GitMode;
  branch_prefix: string;
  commit_message_template: string;
  protected_files: string[];
  never_commit: string[];
}

export const DEFAULT_GIT_CONFIG: GitConfig = {
  mode: 'full_integration', // Will auto-detect and fallback
  branch_prefix: 'spec/',
  commit_message_template: `{phase}: Generate {artifacts}

Project: {project-name}
Phase: {phase-name}
Agent: {owner}
Duration: {duration}ms

Generated artifacts:
{artifact-list}

Co-authored-by: {agent-role} <ai@spec-driven.dev>`,
  protected_files: ['constitution.md', 'project-brief.md'],
  never_commit: ['.env', '.env.local', '*.key', 'secrets/*'],
};
