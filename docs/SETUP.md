# Setup & Installation Guide

Complete guide for setting up the Spec-Driven Platform for development and production.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Cloud Storage Setup (Optional)](#cloud-storage-setup-optional)
- [Starting the Application](#starting-the-application)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **Node.js**: 18+ (with npm)
- **PostgreSQL** (for production) or SQLite (for local development)
- **Google Gemini API Key** (for LLM integration)
- **Git**: For version control
- **Docker** (optional): For containerized deployment

### Recommended Tools
- **Visual Studio Code**: Code editor
- **Drizzle Studio**: Visual database browser (included with npm scripts)
- **Postman** or **Insomnia**: API testing
- **Playwright Inspector**: E2E test debugging

---

## Local Development Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd spec-driven
```

### Step 2: Install Dependencies

```bash
npm install
```

**Note**: The `postinstall` script will automatically generate Drizzle types. No `DATABASE_URL` needed for local development.

### Step 3: Create Environment File

```bash
cp .env.example .env
```

See [Environment Configuration](#environment-configuration) below for details.

### Step 4: Initialize the Database

For **local development** (uses in-memory SQLite):

```bash
npm run db:push
```

This:
- Creates database schema
- Sets up tables and relationships
- Initializes foreign keys
- Prepares for seeding

### Step 5: (Optional) Seed Database

```bash
npm run db:seed
```

This populates the database with example data for testing.

### Step 6: Start the Development Server

```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3000/api
- **Logs**: Visible in terminal

---

## Environment Configuration

### .env File

Create a `.env` file in the root directory with the following variables:

#### Development Configuration

```env
# Database (local SQLite - NO URL NEEDED for development)
# DATABASE_URL=               # Leave blank for in-memory SQLite

# LLM Integration (Required)
GEMINI_API_KEY=your-gemini-api-key-here

# Authentication (Will use defaults if not set)
JWT_SECRET=your-jwt-secret-key-min-32-characters-long
JWT_EXPIRES_IN=24h

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: File Storage (leave blank to use filesystem)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Logging
LOG_LEVEL=info
```

#### Production Configuration

```env
# Database (PostgreSQL - REQUIRED for production)
DATABASE_URL=postgresql://user:password@host:5432/database_name

# LLM Integration (Required)
GEMINI_API_KEY=your-gemini-api-key-here

# Authentication (MUST SET - never use defaults in production)
JWT_SECRET=generate-long-random-secret-min-32-chars
JWT_EXPIRES_IN=1h

# Application URL
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com

# File Storage (R2/S3)
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=spec-driven-artifacts

# Environment
NODE_ENV=production

# Monitoring (Optional)
SENTRY_DSN=https://your-sentry-dsn
```

### Environment Variable Details

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `DATABASE_URL` | Prod only | PostgreSQL connection string | `postgresql://...` |
| `GEMINI_API_KEY` | Yes | Google Gemini API access | Key from Google Cloud |
| `JWT_SECRET` | Yes (prod) | Session signing secret | Min 32 random characters |
| `NEXT_PUBLIC_APP_URL` | Yes | Application base URL | `http://localhost:3000` |
| `R2_*` | Optional | Cloudflare R2 storage | See [S3_SETUP_GUIDE.md](S3_SETUP_GUIDE.md) |
| `NODE_ENV` | No | Environment mode | `development`, `production` |

### Obtaining API Keys

#### Google Gemini API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable "Generative Language API"
4. Create an API key (no authentication required)
5. Copy the key to `GEMINI_API_KEY`

#### Cloudflare R2 (Optional for Storage)
See [S3_SETUP_GUIDE.md](S3_SETUP_GUIDE.md) for complete R2 configuration.

---

## Database Setup

### Local Development (SQLite)

**Default for local development** - No setup needed!

The application uses in-memory SQLite by default when `DATABASE_URL` is not set.

#### Drizzle Studio (Visual Database Browser)

View and edit your database visually:

```bash
npm run db:studio
```

Opens browser at: http://localhost:5555

### Production (PostgreSQL)

#### Option 1: Neon (Recommended - Serverless PostgreSQL)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Add to `.env`:
   ```env
   DATABASE_URL=postgresql://user:password@host.neon.tech/database
   ```

#### Option 2: Self-Hosted PostgreSQL

1. Install PostgreSQL locally or on a server
2. Create a database:
   ```bash
   createdb spec_driven
   ```
3. Get connection string:
   ```env
   DATABASE_URL=postgresql://localhost/spec_driven
   ```

#### Running Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Or push schema directly (development)
npm run db:push
```

#### Database Backup

```bash
# Export database to SQL file
pg_dump $DATABASE_URL > backup.sql

# Restore from backup
psql $DATABASE_URL < backup.sql
```

---

## Cloud Storage Setup (Optional)

### Using Filesystem (Default - Development Only)

Projects and artifacts are stored in `/projects` directory locally.

```
projects/
└── my-project-slug/
    └── specs/
        ├── ANALYSIS/v1/
        ├── STACK_SELECTION/v1/
        └── ...
```

### Using Cloudflare R2 (Production Recommended)

See [S3_SETUP_GUIDE.md](S3_SETUP_GUIDE.md) for complete R2 configuration.

Quick steps:
1. Create Cloudflare R2 bucket
2. Generate API tokens
3. Set environment variables (see above)
4. Artifacts automatically sync to R2

---

## Starting the Application

### Development Server

```bash
npm run dev
```

**Output**:
```
▲ Next.js 14.2.33
- Local:        http://localhost:3000
- Environments: .env

✓ Ready in 2.5s
```

### Building for Production

```bash
npm run build
```

This:
- Compiles TypeScript
- Optimizes code
- Generates static assets
- Runs type checking

### Starting Production Server

```bash
npm run start
```

Runs the built application (must run `npm run build` first).

---

## Verification

### Check Installation

```bash
npm run build
```

Should complete without errors.

### Run Tests

```bash
# Unit and integration tests
npm test

# E2E tests (requires app running)
npm run test:e2e
```

### Verify Database Connection

```bash
npm run db:studio
```

Should open visual database browser at http://localhost:5555.

### Test API Endpoint

```bash
# Get session (should return null if not authenticated)
curl http://localhost:3000/api/auth/get-session

# Try to create project (should fail with 401 Unauthorized)
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'
```

### Manual Testing

1. Open http://localhost:3000 in browser
2. You should see the home page
3. Try to sign up (requires valid email)
4. Create a test project
5. Step through the workflow

---

## Troubleshooting

### Port 3000 Already in Use

```bash
# On macOS/Linux
lsof -i :3000
kill -9 <PID>

# On Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Or use a different port:
```bash
PORT=3001 npm run dev
```

### Database Connection Errors

```bash
# Verify DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Reset local SQLite (development)
rm -rf .next && npm run dev  # Fresh in-memory DB
```

### Drizzle Codegen Issues

```bash
# Skip codegen during install
SKIP_DRIZZLE_CODEGEN=1 npm install

# Generate manually
npm run db:generate
```

### TypeScript Errors

```bash
# Clear build cache
rm -rf .next .turbo

# Rebuild
npm run build
```

### Module Resolution Issues

```bash
# Path aliases configured in tsconfig.json:
# "@/*" → "./src/*"
# "@/backend/*" → "./backend/*"

# Clear cache and rebuild
rm -rf node_modules/.cache
npm run dev
```

### API Key Not Working

1. Verify `GEMINI_API_KEY` is set:
   ```bash
   echo $GEMINI_API_KEY
   ```

2. Check API key format (should be long alphanumeric string)

3. Verify API key is enabled in Google Cloud Console

4. Check rate limits aren't exceeded

### Database Migration Failures

```bash
# Check migration status
npm run db:studio  # Visual check

# Manual migration (if needed)
npm run db:migrate

# Reset database (LOCAL ONLY - CAREFUL!)
# rm -rf .next && npm run db:push
```

### Tests Failing

```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run specific test file
npm test error_handler.test.ts

# Run E2E with headed browser (see what's happening)
npm run test:e2e:headed
```

---

## Additional Resources

### Documentation
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Codebase layout
- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - Database details
- **[S3_SETUP_GUIDE.md](S3_SETUP_GUIDE.md)** - Cloud storage
- **[ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md)** - Workflow design

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Google Gemini API Docs](https://ai.google.dev/docs/gemini_api_overview)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)

### npm Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint

# Database
npm run db:push         # Push schema to database
npm run db:generate     # Generate migration
npm run db:migrate      # Run migrations
npm run db:studio       # Open Drizzle Studio
npm run db:seed         # Seed with example data

# Testing
npm test                # Run all tests
npm test -- --watch     # Watch mode
npm run test:coverage   # Coverage report
npm run test:e2e        # E2E tests (requires app running)
npm run test:e2e:headed # E2E with visible browser
npm run test:e2e:debug  # E2E debug mode
npm run test:e2e:ui     # E2E interactive UI
```

---

## Next Steps

1. ✅ Complete setup above
2. 📖 Read [ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md) to understand the workflow
3. 🧪 Run `npm run test:e2e` to verify everything works
4. 🚀 Start developing!

---

**Last Updated**: November 26, 2025
**Status**: Current and Tested
**Tested On**: Node 18+, macOS/Linux/Windows
