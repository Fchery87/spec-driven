# Phase 2 Migration Guide

## Overview

This guide covers migrating existing projects to Phase 2 (Collaboration & Control) which adds:
- Progressive Approval System (4 gates)
- Git Workflow Integration
- Rollback & State Management

## Prerequisites

- Database migration 0005 completed (`npm run db:migrate`)
- simple-git package installed (`npm install`)
- Existing projects in database

## Migration Steps

### 1. Database Migration

Run the Phase 2 database migration:

```bash
npm run db:migrate
```

This creates:
- `PhaseSnapshot` table
- `ApprovalGate` table
- `GitOperation` table

### 2. Initialize Approval Gates

For **existing projects**, initialize approval gates:

```bash
# Dry run (preview changes)
npx tsx backend/scripts/migrate_phase2.ts --dry-run

# Execute migration
npx tsx backend/scripts/migrate_phase2.ts
```

This initializes 4 gates per project:
- `stack_approved` (blocking)
- `prd_approved` (non-blocking)
- `architecture_approved` (non-blocking, auto-approve at score 95)
- `handoff_acknowledged` (non-blocking)

### 3. Git Integration Setup

**Option A: Enable Git for existing projects**

For projects you want Git tracking:

```bash
cd /path/to/project
git init
git remote add origin <your-repo-url>
git checkout -b spec/<project-slug>
```

**Option B: Disable Git (filesystem only)**

No action needed - Git service auto-detects and falls back to `disabled` mode.

### 4. Verify Migration

Check that gates were created:

```bash
# API call to check gates
curl http://localhost:3000/api/projects/<slug>/approvals
```

Expected response:
```json
{
  "success": true,
  "gates": [
    {
      "gateName": "stack_approved",
      "status": "pending",
      "blocking": true,
      ...
    },
    ...
  ]
}
```

## Rollback Plan

If migration causes issues:

1. **Revert database migration:**
   ```bash
   npm run db:rollback
   ```

2. **Remove approval gate records:**
   ```sql
   DELETE FROM "ApprovalGate";
   DELETE FROM "PhaseSnapshot";
   DELETE FROM "GitOperation";
   ```

3. **Restart application**

## Post-Migration

### New Projects

New projects automatically get:
- 4 approval gates initialized on creation
- Git branch created (`spec/<slug>`) if Git available
- Snapshots created after each phase

### Existing Projects

Existing projects now have:
- Approval gates in `pending` state
- No Git history (starts from now)
- No snapshots (created going forward)

## Troubleshooting

### Gates not showing in UI

Check database:
```sql
SELECT * FROM "ApprovalGate" WHERE project_id = '<project-id>';
```

### Git commits failing

Check Git mode:
```typescript
const gitService = new GitService('/project/path');
await gitService.initialize();
console.log(gitService.getMode()); // Should be 'local_only' or 'full_integration'
```

### Snapshots not created

Check logs for `[RollbackService]` entries - snapshots are created after each phase execution.

## Support

For issues, check:
- Database logs: `docker logs <db-container>`
- Application logs: Look for `[Migration]`, `[GitService]`, `[ApprovalGateService]` entries
- GitHub Issues: https://github.com/your-repo/issues
