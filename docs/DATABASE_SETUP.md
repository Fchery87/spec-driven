# Database Setup Guide

This project uses **Prisma** as an ORM and **SQLite** as the database for local development and SQLite/PostgreSQL for production.

## Prerequisites

- Node.js 18+
- npm or yarn

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file to `.env.local`:

```bash
cp .env.example .env.local
```

Update `.env.local` with your values:

```env
DATABASE_URL="file:./dev.db"
GEMINI_API_KEY=your_api_key_here
```

### 3. Initialize Database

Run the initial migration and seed:

```bash
npm run db:setup
```

This command:
- Creates the SQLite database file
- Runs Prisma migrations
- Seeds example data

### 4. Verify Setup

You can inspect the database using Prisma Studio:

```bash
npm run db:studio
```

This opens an interactive GUI at `http://localhost:5555` where you can view and edit data.

## Database Schema

The database contains the following models:

### Project
- Stores project metadata
- Tracks current phase and completed phases
- Records stack selection and approval status

### Artifact
- Stores generated specifications and files
- Supports versioning (v1, v2, etc.)
- Organized by phase and filename

### PhaseHistory
- Audit trail of phase completions
- Tracks duration and errors
- Useful for analytics

### StackChoice
- Records which stack was selected
- Stores user reasoning
- Provides audit trail

### DependencyApproval
- Records when dependencies were approved
- Stores approval notes
- Tracks approval timestamp

### User
- For future multi-user support
- Stores user credentials
- Ready for authentication implementation

### Setting
- App-wide configuration
- Key-value store for settings

## Common Operations

### Create a New Migration

When you modify the schema in `prisma/schema.prisma`:

```bash
npm run db:migrate
```

Follow the prompts to name your migration.

### Reset Database (Development Only)

⚠️ **WARNING**: This deletes all data!

```bash
npx prisma migrate reset
```

### View Database Contents

```bash
npm run db:studio
```

### Seed Additional Data

```bash
npm run db:seed
```

## Production Deployment

### Using PostgreSQL

For production, use PostgreSQL:

1. Update `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/spec_driven"
   ```

2. Run migrations:
   ```bash
   npm run db:push
   ```

### Backups

Regular backups of your database are recommended:

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup.sql

# PostgreSQL restore
psql $DATABASE_URL < backup.sql
```

## Troubleshooting

### Database Lock Errors

If you see database lock errors with SQLite:

1. Close any other connections to the database
2. Stop the dev server
3. Delete `dev.db` and `dev.db-journal`
4. Run `npm run db:setup` again

### Migration Conflicts

If you have migration conflicts:

```bash
npx prisma migrate reset
npm run db:seed
```

### Prisma Client Out of Sync

Regenerate Prisma Client:

```bash
npx prisma generate
```

## Files

- `prisma/schema.prisma` - Database schema definition
- `prisma/seed.ts` - Seed data script
- `backend/lib/prisma.ts` - Prisma singleton instance
- `backend/services/database/project_db_service.ts` - Database operations

## API Integration

The database is accessed through `ProjectDBService`:

```typescript
import { ProjectDBService } from '@/backend/services/database/project_db_service';

const dbService = new ProjectDBService();

// Get project
const project = await dbService.getProjectBySlug('my-project');

// Save artifact
await dbService.saveArtifact(
  projectId,
  'ANALYSIS',
  'constitution.md',
  content
);

// Record phase completion
await dbService.recordPhaseHistory(
  projectId,
  'ANALYSIS',
  'completed'
);
```

## Next Steps

1. Update API routes to use `ProjectDBService` instead of file-based storage
2. Implement authentication and user association
3. Add database migrations for production
4. Set up automated backups
5. Monitor database performance with Prisma insights

For more information, see:
- [Prisma Documentation](https://www.prisma.io/docs/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
