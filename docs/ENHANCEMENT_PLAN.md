# Spec-Driven Project Enhancement Plan v2.0

## Executive Summary

This comprehensive enhancement plan outlines **critical improvements** to transform the spec-driven project from a production-ready MVP into a **robust, secure, and maintainable enterprise-grade application**. Based on deep codebase analysis, this plan addresses security vulnerabilities, architectural debt, testing gaps, and code quality issues through a phased, non-breaking implementation approach.

**Current State Analysis**:
- Production-ready Next.js 14 multi-agent orchestration platform
- Claims 85%+ test coverage but **actual coverage is only ~7%** (6 test files vs 84 source files)
- **7 npm security vulnerabilities** (3 high-severity, 4 moderate-severity)
- **Critical security gaps**: API keys exposed in URLs, missing CSRF protection, no security headers
- **Architectural debt**: Dual storage system creating complexity and consistency risks
- **Type safety issues**: 557 uses of `any` type undermining TypeScript benefits
- **Code organization debt**: 38 TODO comments, 18 console.log calls, duplicate component directories

**Key Achievements After Implementation**:
- ✅ Zero critical security vulnerabilities
- ✅ 60%+ test coverage with comprehensive test suites
- ✅ Single source of truth for artifact storage
- ✅ Type-safe codebase with <100 `any` occurrences
- ✅ Clean, maintainable code with consistent patterns
- ✅ Production observability with error tracking and monitoring

---

## Phase 1: Critical Security Hardening 🔴 **WEEK 1 - HIGHEST PRIORITY**

### Current Security State: CRITICAL GAPS IDENTIFIED

**What's Currently Lacking**:

1. **API Key Exposure** (CRITICAL VULNERABILITY)
   - **Location**: `backend/services/llm/llm_client.ts:52`
   - **Current Issue**: Gemini API key passed as URL query parameter `?key=${this.config.api_key}`
   - **Risk Level**: HIGH - API keys exposed in:
     - Server logs
     - Browser history
     - Proxy logs
     - Network monitoring tools
   - **Affected Code**:
     ```typescript
     // CURRENT (INSECURE):
     const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-latest:generateContent?key=${this.config.api_key}`;
     ```

2. **Weak Secret Management** (CRITICAL)
   - **Location**: `src/lib/auth.ts:28`
   - **Current Issue**: Falls back to weak default secret
   - **Affected Code**:
     ```typescript
     // CURRENT (INSECURE):
     secret: process.env.JWT_SECRET || "fallback-dev-secret-change-in-production"
     ```
   - **Risk**: Production deployments could accidentally use weak secret

3. **No Environment Validation** (HIGH RISK)
   - **Current Issue**: No startup validation of required environment variables
   - **Risk**: Silent failures, runtime errors in production
   - **Missing**: Zod schema validation for all env vars

4. **Missing Security Headers** (MEDIUM-HIGH RISK)
   - **Current Issue**: No `Content-Security-Policy`, `X-Frame-Options`, `HSTS`, `X-Content-Type-Options`
   - **Risk**: Vulnerable to XSS, clickjacking, MIME-sniffing attacks
   - **Affected**: All API routes and pages

5. **No CSRF Protection** (HIGH RISK)
   - **Current Issue**: Better Auth configured without CSRF tokens
   - **Location**: `src/lib/auth.ts`
   - **Risk**: Cross-site request forgery attacks possible

6. **Dependency Vulnerabilities** (CRITICAL)
   - **7 vulnerabilities found**:
     - **HIGH (3)**: `glob` command injection (GHSA-5j98-mcp5-4vw2)
     - **MODERATE (4)**: `esbuild` development server vulnerabilities
   - **Affected Packages**: eslint-config-next, drizzle-kit

---

### Implementation Plan: Security Hardening

#### 1.1 Migrate API Keys to Headers (CRITICAL FIX)

**Implementation Steps**:

1. **Update LLM Client**
   - File: `backend/services/llm/llm_client.ts`
   - Lines: 50-55 (URL construction)

   ```typescript
   // BEFORE (INSECURE):
   const url = `${baseUrl}?key=${this.config.api_key}`;
   const response = await fetch(url, { method: 'POST', body: ... });

   // AFTER (SECURE):
   const url = baseUrl; // Remove query param
   const response = await fetch(url, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'x-goog-api-key': this.config.api_key, // Header-based auth
     },
     body: JSON.stringify(payload),
   });
   ```

2. **Verify Google Gemini API Support**
   - Confirm header-based authentication works with `x-goog-api-key` header
   - Test with sample request

3. **Update Tests**
   - Verify mock LLM client tests still pass
   - Add test to ensure key not in URL

**Files to Modify**:
- `backend/services/llm/llm_client.ts` (lines 50-55, 80-90)

**Testing**:
- Manual test: Execute phase with real API
- Unit test: Mock fetch and verify headers
- Integration test: Full workflow still works

---

#### 1.2 Enforce Required Secrets with Validation

**Implementation Steps**:

1. **Create Environment Schema**
   - File: `src/lib/config.ts` (NEW or update existing)

   ```typescript
   import { z } from 'zod';

   const envSchema = z.object({
     // Database
     DATABASE_URL: z.string().url().startsWith('postgres'),

     // Authentication
     JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

     // LLM Integration
     GEMINI_API_KEY: z.string().min(32, 'GEMINI_API_KEY is required'),

     // Optional Services
     UPSTASH_REDIS_REST_URL: z.string().url().optional(),
     SENTRY_DSN: z.string().url().optional(),

     // Storage (R2)
     R2_ACCOUNT_ID: z.string().optional(),
     R2_ACCESS_KEY_ID: z.string().optional(),
     R2_SECRET_ACCESS_KEY: z.string().optional(),
     R2_BUCKET_NAME: z.string().optional(),

     // App Config
     NODE_ENV: z.enum(['development', 'production', 'test']),
     NEXT_PUBLIC_APP_URL: z.string().url(),
   });

   // Validate on module load (fails fast if invalid)
   export const env = envSchema.parse(process.env);
   ```

2. **Remove Fallback Secrets**
   - File: `src/lib/auth.ts`
   - Line 28: Remove `|| "fallback-dev-secret-change-in-production"`

   ```typescript
   // BEFORE:
   secret: process.env.JWT_SECRET || "fallback-dev-secret-change-in-production"

   // AFTER:
   secret: env.JWT_SECRET // Will fail if not set (from config.ts)
   ```

3. **Update All Config References**
   - Replace `process.env.X` with `env.X` throughout codebase
   - Ensures type safety and validation

**Files to Create/Modify**:
- `src/lib/config.ts` (NEW - centralized validated config)
- `src/lib/auth.ts` (remove fallback)
- `backend/services/llm/llm_client.ts` (use validated config)
- `.env.example` (document all required variables)

**Testing**:
- Test 1: Start app without JWT_SECRET → should crash with clear error
- Test 2: Start app with weak JWT_SECRET (<32 chars) → should crash
- Test 3: Start app with all valid env vars → should start successfully

---

#### 1.3 Add Security Headers Middleware

**Implementation Steps**:

1. **Create Next.js Middleware**
   - File: `src/middleware.ts` (NEW)

   ```typescript
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';

   export function middleware(request: NextRequest) {
     const response = NextResponse.next();

     // Content Security Policy
     response.headers.set(
       'Content-Security-Policy',
       [
         "default-src 'self'",
         "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval
         "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
         "img-src 'self' data: https:",
         "font-src 'self' data:",
         "connect-src 'self' https://generativelanguage.googleapis.com", // Gemini API
         "frame-ancestors 'none'", // Prevent clickjacking
       ].join('; ')
     );

     // Additional Security Headers
     response.headers.set('X-Frame-Options', 'DENY');
     response.headers.set('X-Content-Type-Options', 'nosniff');
     response.headers.set('X-XSS-Protection', '1; mode=block');
     response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

     // HSTS (only in production)
     if (process.env.NODE_ENV === 'production') {
       response.headers.set(
         'Strict-Transport-Security',
         'max-age=31536000; includeSubDomains'
       );
     }

     return response;
   }

   // Apply to all routes
   export const config = {
     matcher: [
       '/((?!_next/static|_next/image|favicon.ico).*)',
     ],
   };
   ```

2. **Update Vercel Configuration**
   - File: `vercel.json`
   - Add headers as fallback (in case middleware doesn't run)

   ```json
   {
     "buildCommand": "npm run build",
     "cleanUrls": true,
     "trailingSlash": false,
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           {
             "key": "X-Content-Type-Options",
             "value": "nosniff"
           },
           {
             "key": "X-Frame-Options",
             "value": "DENY"
           },
           {
             "key": "X-XSS-Protection",
             "value": "1; mode=block"
           },
           {
             "key": "Referrer-Policy",
             "value": "strict-origin-when-cross-origin"
           }
         ]
       }
     ],
     "regions": ["iad1"]
   }
   ```

**Files to Create/Modify**:
- `src/middleware.ts` (NEW - security headers)
- `vercel.json` (add headers config)

**Testing**:
- Use browser DevTools Network tab to verify headers
- Test with https://securityheaders.com
- Verify CSP doesn't block legitimate resources

---

#### 1.4 Enable CSRF Protection

**Implementation Steps**:

1. **Configure Better Auth with CSRF**
   - File: `src/lib/auth.ts`

   ```typescript
   export const auth = betterAuth({
     database: {
       // ... existing config
     },
     emailAndPassword: {
       enabled: true,
       requireEmailVerification: true, // ENABLE for production
     },
     session: {
       // ... existing config
     },
     // ADD CSRF PROTECTION
     advanced: {
       crossSubDomainCookies: {
         enabled: false, // Only if needed
       },
       useSecureCookies: process.env.NODE_ENV === 'production',
     },
     // Better Auth handles CSRF automatically via cookies
     secret: env.JWT_SECRET,
   });
   ```

2. **Verify Cookie Settings**
   - Ensure cookies have `httpOnly`, `secure` (in prod), `sameSite: 'lax'` flags
   - Better Auth should handle this automatically

**Files to Modify**:
- `src/lib/auth.ts` (enable email verification, secure cookies)

**Testing**:
- Test login/logout still works
- Verify cookies have proper flags in browser DevTools
- Test cross-origin request is rejected

---

#### 1.5 Fix Dependency Vulnerabilities

**Implementation Steps**:

1. **Update Vulnerable Packages**
   ```bash
   npm audit fix
   npm update eslint-config-next@latest
   npm update drizzle-kit@latest
   npm audit # Verify fixes
   ```

2. **Create GitHub Actions Security Workflow**
   - File: `.github/workflows/security.yml` (NEW)

   ```yaml
   name: Security Audit

   on:
     pull_request:
       branches: [main]
     push:
       branches: [main]
     schedule:
       - cron: '0 0 * * 1' # Weekly on Monday

   jobs:
     audit:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
         - run: npm ci
         - run: npm audit --audit-level=moderate
         - run: npm outdated
   ```

3. **Configure Dependabot**
   - File: `.github/dependabot.yml` (NEW)

   ```yaml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 5
       reviewers:
         - "nochaserz"
       labels:
         - "dependencies"
       versioning-strategy: increase
   ```

**Files to Create/Modify**:
- `package.json` (updated versions)
- `package-lock.json` (auto-updated)
- `.github/workflows/security.yml` (NEW)
- `.github/dependabot.yml` (NEW)

**Testing**:
- Verify `npm audit` shows 0 vulnerabilities
- Test that workflow runs on PR
- Verify app still builds and runs

---

### Phase 1 Success Metrics

**Must Achieve Before Moving to Phase 2**:
- ✅ `npm audit` shows **0 high-severity vulnerabilities**
- ✅ All API keys passed via headers (not URLs)
- ✅ Environment validation fails fast if secrets missing
- ✅ Security headers present on all responses (verify with https://securityheaders.com)
- ✅ CSRF protection enabled and tested
- ✅ GitHub Actions security workflow passing
- ✅ No secrets in code (all in environment variables)

**Estimated Time**: 3-5 days for one developer

---

## Phase 2: Architecture Refactoring & Type Safety 🟡 **WEEK 2-3 - HIGH PRIORITY**

### Current Architecture State: TECHNICAL DEBT & COMPLEXITY

**What's Currently Lacking**:

1. **Dual Storage Architecture** (CRITICAL COMPLEXITY)
   - **Locations**:
     - `backend/services/orchestrator/artifact_manager.ts`
     - `src/app/api/projects/[slug]/execute-phase/route.ts:159-180`
   - **Current Issue**: Artifacts written to BOTH R2 and PostgreSQL
   - **Code Example**:
     ```typescript
     // CURRENT (PROBLEMATIC):
     await writeArtifact(slug, phase, filename, content);  // R2 write
     await dbService.saveArtifact(projectId, phase, filename, content);  // DB write
     // ^ No transaction wrapping, can fail partially
     ```
   - **Problems**:
     - No transactional consistency between R2 and DB
     - Increased complexity (two systems to maintain)
     - Potential data inconsistency if one write fails
     - Database bloat from large text content
     - Higher costs (storage in both systems)

2. **Fat Route Handlers** (MAINTAINABILITY ISSUE)
   - **Location**: `src/app/api/projects/[slug]/execute-phase/route.ts`
   - **Current State**: **247 lines** mixing concerns:
     - HTTP request handling
     - Business logic (orchestration)
     - Database operations
     - File storage
     - Error handling
     - Logging
   - **Problem**: Violates Single Responsibility Principle
   - **Impact**: Hard to test, maintain, debug, reuse logic

3. **Type Safety Erosion** (CODE QUALITY ISSUE)
   - **Current State**: **557 occurrences of `any`** type across 20 files
   - **Affected Areas**:
     - Test files: `(a: any) => ...` mock functions
     - Route contexts: `context: any` in API routes
     - Error handlers: `details?: any`
     - Database queries: `artifacts.find((a: any) => ...)`
   - **Impact**:
     - Runtime errors not caught at compile time
     - Lost IDE autocomplete
     - Refactoring risks

4. **No Database Transactions** (DATA INTEGRITY RISK)
   - **Current Issue**: Multi-step operations not wrapped in transactions
   - **Example**:
     ```typescript
     // CURRENT (NO ATOMICITY):
     await db.update(projects).set({ phase: 'SPEC' });
     await db.insert(phaseHistory).values({ phase: 'SPEC' }); // Could fail
     // ^ If second insert fails, project state is inconsistent
     ```
   - **Risk**: Partial failures leave database in inconsistent state

---

### Implementation Plan: Architecture Refactoring

#### 2.1 Resolve Dual Storage (R2 Primary, PostgreSQL Metadata)

**Decision Rationale**:
- **R2 as Primary**: Best for large text files, cheaper storage, better for CDN
- **PostgreSQL for Metadata**: Best for queries, relationships, transactions
- **Single Write**: Simpler consistency model, atomic operations

**Implementation Steps**:

**Step 1: Update Database Schema**

File: `backend/lib/schema.ts`

```typescript
// BEFORE:
export const artifacts = pgTable('artifacts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  phase: text('phase').notNull(),
  filename: text('filename').notNull(),
  content: text('content').notNull(), // REMOVE THIS (bloats DB)
  contentHash: text('content_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

// AFTER:
export const artifacts = pgTable('artifacts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  phase: text('phase').notNull(),
  filename: text('filename').notNull(),

  // NEW: R2 storage fields
  storageUrl: text('storage_url').notNull(), // R2 URL
  storageKey: text('storage_key').notNull(), // R2 object key
  fileHash: text('file_hash').notNull(), // SHA-256 for integrity
  sizeBytes: integer('size_bytes').notNull(),
  mimeType: text('mime_type').default('text/markdown'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  projectPhaseIdx: index('artifacts_project_phase_idx').on(table.projectId, table.phase),
  filenameIdx: index('artifacts_filename_idx').on(table.filename),
}));
```

**Step 2: Create Migration**

```bash
npm run db:generate # Creates migration file
# Edit migration to handle existing data
npm run db:migrate # Apply migration
```

**Step 3: Refactor Artifact Manager**

File: `backend/services/orchestrator/artifact_manager.ts`

```typescript
import crypto from 'crypto';

export class ArtifactManager {
  async saveArtifact(
    projectId: string,
    phase: string,
    filename: string,
    content: string
  ): Promise<Artifact> {
    // Calculate hash for integrity
    const fileHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    const storageKey = `projects/${projectId}/${phase}/${filename}`;

    // Use database transaction for atomicity
    return await this.db.transaction(async (tx) => {
      // 1. Upload to R2 FIRST (fail fast if storage issues)
      const storageUrl = await this.r2Client.upload(storageKey, content, {
        contentType: 'text/markdown',
        metadata: {
          projectId,
          phase,
          hash: fileHash,
        },
      });

      // 2. Save metadata to database (wrapped in transaction)
      const [artifact] = await tx.insert(artifacts).values({
        id: generateId(),
        projectId,
        phase,
        filename,
        storageUrl,
        storageKey,
        fileHash,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        mimeType: 'text/markdown',
      }).returning();

      return artifact;
    });
    // ^ If either step fails, transaction rolls back
  }

  async getArtifactContent(artifactId: string): Promise<string> {
    // 1. Get metadata from DB
    const artifact = await this.db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, artifactId))
      .limit(1);

    if (!artifact[0]) {
      throw new Error('Artifact not found');
    }

    // 2. Fetch content from R2
    const content = await this.r2Client.download(artifact[0].storageKey);

    // 3. Verify integrity
    const actualHash = crypto.createHash('sha256').update(content).digest('hex');
    if (actualHash !== artifact[0].fileHash) {
      throw new Error('Artifact integrity check failed');
    }

    return content;
  }
}
```

**Step 4: Migration Strategy (Zero Downtime)**

1. **Deploy Phase 1**: Code writes to both R2 and DB (current state)
2. **Backfill**: Script to upload existing DB artifacts to R2
   ```typescript
   // migration-script.ts
   async function backfillR2() {
     const existingArtifacts = await db.select().from(artifacts);
     for (const artifact of existingArtifacts) {
       if (!artifact.storageUrl) {
         // Upload content to R2
         const storageKey = `projects/${artifact.projectId}/${artifact.phase}/${artifact.filename}`;
         const storageUrl = await r2.upload(storageKey, artifact.content);

         // Update DB with R2 URL
         await db.update(artifacts)
           .set({ storageUrl, storageKey })
           .where(eq(artifacts.id, artifact.id));
       }
     }
   }
   ```
3. **Deploy Phase 2**: Code reads from R2, falls back to DB if needed
4. **Deploy Phase 3**: Code writes to R2 only (remove dual writes)
5. **Cleanup**: Remove `content` column from DB (after verification)

**Files to Modify**:
- `backend/lib/schema.ts` (schema changes)
- `backend/services/orchestrator/artifact_manager.ts` (R2-first logic)
- `backend/services/file_system/project_storage.ts` (R2 client improvements)
- `src/app/api/projects/[slug]/execute-phase/route.ts` (remove dual writes)
- `drizzle/migrations/` (NEW migration)

**Testing**:
- Integration test: Save artifact → verify in R2 and DB metadata
- Integration test: Get artifact → verify content matches
- Integration test: R2 failure → transaction rolls back
- Integration test: Hash mismatch → error thrown

---

#### 2.2 Extract Business Logic from Route Handlers

**Pattern**: Service Layer (Business Logic) + Thin Controllers (HTTP Handling)

**Implementation Steps**:

**Step 1: Create Project Service**

File: `backend/services/project/project_service.ts` (NEW)

```typescript
export class ProjectService {
  constructor(
    private db: DrizzleProjectDBService,
    private orchestrator: OrchestratorEngine,
    private artifactManager: ArtifactManager,
    private logger: Logger
  ) {}

  async executePhase(params: {
    projectId: string;
    userId: string;
    correlationId: string;
  }): Promise<ExecutePhaseResult> {
    this.logger.info('Executing phase', { projectId: params.projectId });

    // Business logic here (extracted from route handler)
    const project = await this.db.getProjectById(params.projectId);

    if (!project) {
      throw Errors.notFound('Project not found');
    }

    // Orchestrator handles phase execution
    const result = await this.orchestrator.executePhase(project);

    // Save artifacts
    for (const artifact of result.artifacts) {
      await this.artifactManager.saveArtifact(
        project.id,
        result.phase,
        artifact.filename,
        artifact.content
      );
    }

    return result;
  }

  async approveStack(params: {
    projectId: string;
    stackId: string;
    userId: string;
  }): Promise<void> {
    // Business logic for stack approval
    await this.db.saveStackApproval(params.projectId, params.stackId, params.userId);
    await this.db.updateProjectPhase(params.projectId, 'SPEC');
  }

  // ... more service methods
}
```

**Step 2: Create API Handler Wrapper (HOF)**

File: `backend/lib/api_handler.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { withAuth } from '@/lib/auth-middleware';
import { withCorrelationId } from '@/lib/correlation-middleware';
import { logger } from '@/backend/lib/logger';

interface APIConfig<TInput> {
  auth?: boolean;
  schema?: ZodSchema<TInput>;
  rateLimit?: 'general' | 'auth' | 'llm';
}

export function withAPI<TInput, TOutput>(
  config: APIConfig<TInput>,
  handler: (req: NextRequest, input: TInput) => Promise<TOutput>
) {
  return async (req: NextRequest, context: any) => {
    const correlationId = crypto.randomUUID();

    try {
      // 1. Correlation ID
      req.headers.set('x-correlation-id', correlationId);

      // 2. Authentication (if required)
      if (config.auth) {
        const user = await authenticateRequest(req);
        if (!user) {
          return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
          );
        }
        req.headers.set('x-user-id', user.id);
      }

      // 3. Rate limiting (if configured)
      if (config.rateLimit) {
        const rateLimitResult = await checkRateLimit(req, config.rateLimit);
        if (!rateLimitResult.allowed) {
          return NextResponse.json(
            { success: false, error: 'Rate limit exceeded' },
            { status: 429 }
          );
        }
      }

      // 4. Validate input (if schema provided)
      let input: TInput;
      if (config.schema) {
        const body = await req.json();
        input = config.schema.parse(body);
      } else {
        input = {} as TInput;
      }

      // 5. Execute handler
      const result = await handler(req, input);

      // 6. Return success response
      return NextResponse.json({ success: true, data: result });

    } catch (error) {
      // Centralized error handling
      logger.error('API handler error', { error, correlationId });

      if (error instanceof AppError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.statusCode }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
```

**Step 3: Refactor Route Handlers**

File: `src/app/api/projects/[slug]/execute-phase/route.ts`

```typescript
// BEFORE (247 lines):
export async function POST(req: NextRequest, context: any) {
  // 247 lines of mixed concerns...
}

// AFTER (~30 lines):
import { withAPI } from '@/backend/lib/api_handler';
import { executePhaseSchema } from '@/app/api/schemas';
import { ProjectService } from '@/backend/services/project/project_service';

const projectService = new ProjectService(/* inject dependencies */);

export const POST = withAPI(
  {
    auth: true,
    schema: executePhaseSchema,
    rateLimit: 'llm',
  },
  async (req, input) => {
    const { slug } = await context.params;
    const userId = req.headers.get('x-user-id')!;
    const correlationId = req.headers.get('x-correlation-id')!;

    return await projectService.executePhase({
      projectId: slug,
      userId,
      correlationId,
    });
  }
);
```

**Benefits**:
- ✅ Route handlers now <50 lines (down from 247)
- ✅ Business logic is testable without HTTP mocking
- ✅ Consistent error handling, auth, validation across all endpoints
- ✅ Easy to add new features (webhooks, background jobs, etc.)

**Files to Create/Modify**:
- `backend/services/project/project_service.ts` (NEW - business logic)
- `backend/lib/api_handler.ts` (NEW - HOF wrapper)
- `src/app/api/projects/[slug]/execute-phase/route.ts` (refactor to ~30 lines)
- `src/app/api/projects/[slug]/approve-stack/route.ts` (refactor)
- `src/app/api/projects/[slug]/approve-dependencies/route.ts` (refactor)
- `src/app/api/projects/route.ts` (refactor)

**Testing**:
- Unit tests for `ProjectService` methods (no HTTP mocking needed)
- Integration tests for full API routes
- Verify all routes still work correctly

---

#### 2.3 Improve TypeScript Type Safety

**Goal**: Reduce `any` usage from 557 to <100 occurrences

**Implementation Steps**:

**Step 1: Type Route Handler Contexts**

File: `src/types/api.ts` (NEW)

```typescript
// Common API types
export interface RouteContext<TParams = Record<string, string>> {
  params: Promise<TParams>;
}

// Specific route param types
export interface ProjectRouteParams {
  slug: string;
}

export interface ArtifactRouteParams {
  slug: string;
  artifactId: string;
}
```

Usage in routes:
```typescript
// BEFORE:
export async function GET(req: NextRequest, context: any) {
  const { slug } = await context.params;
}

// AFTER:
export async function GET(
  req: NextRequest,
  context: RouteContext<ProjectRouteParams>
) {
  const { slug } = await context.params; // Fully typed!
}
```

**Step 2: Fix Test Type Safety**

```typescript
// BEFORE (test files):
const mockLLMClient = {
  executeAgent: vi.fn().mockResolvedValue({ content: 'test' })
} as any;

// AFTER:
import { vi } from 'vitest';
import type { LLMClient } from '@/backend/services/llm/llm_client';

const mockLLMClient: LLMClient = {
  executeAgent: vi.fn<Parameters<LLMClient['executeAgent']>, ReturnType<LLMClient['executeAgent']>>()
    .mockResolvedValue({ content: 'test', usage: { ... } }),
  config: { /* ... */ },
};
```

**Step 3: Use `unknown` Instead of `any` for Error Handling**

File: `backend/lib/error_handler.ts`

```typescript
// BEFORE:
export class AppError extends Error {
  details?: any; // Too permissive
}

// AFTER:
export class AppError extends Error {
  details?: Record<string, unknown>; // Safer

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
  }
}
```

**Step 4: Add Return Type Annotations**

File: `backend/services/llm/llm_client.ts`

```typescript
// BEFORE:
async executeAgent(agent: Agent, context: any) {
  // ... implementation
}

// AFTER:
async executeAgent(
  agent: Agent,
  context: AgentContext
): Promise<AgentExecutionResult> {
  // ... implementation
}
```

**Step 5: Enable Stricter TypeScript**

File: `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,  // NEW
    "noUncheckedIndexedAccess": true,  // NEW
    "noFallthroughCasesInSwitch": true,  // NEW
    // ... existing config
  }
}
```

**Files to Modify**:
- `tsconfig.json` (stricter settings)
- `src/types/api.ts` (NEW - route types)
- All test files (replace `any` with proper types)
- `backend/services/llm/llm_client.ts` (add return types)
- `backend/lib/error_handler.ts` (use `unknown`)
- All API route files (type contexts)

**Approach**:
- Fix one file at a time
- Commit each fix separately
- Run TypeScript checker after each change
- Don't rush - quality over speed

**Testing**:
- Verify `npm run build` succeeds
- Verify `npx tsc --noEmit` passes
- Run all tests to catch type-related runtime issues

---

#### 2.4 Wrap Operations in Database Transactions

**Implementation Steps**:

File: `backend/services/database/drizzle_project_db_service.ts`

```typescript
// BEFORE:
async createProject(data: ProjectData): Promise<Project> {
  const project = await this.db.insert(projects).values(data).returning();
  await this.db.insert(phaseHistory).values({
    projectId: project.id,
    phase: 'ANALYSIS',
    status: 'started',
  });
  return project;
  // ^ If second insert fails, orphaned project exists
}

// AFTER:
async createProject(data: ProjectData): Promise<Project> {
  return await this.db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values(data)
      .returning();

    await tx.insert(phaseHistory).values({
      projectId: project.id,
      phase: 'ANALYSIS',
      status: 'started',
    });

    return project;
  });
  // ^ Atomic: both succeed or both fail
}
```

**Operations to Wrap**:
1. `createProject()` - project + phase history
2. `updateProjectPhase()` - update phase + record history
3. `saveArtifact()` - save to R2 + save metadata (already done in 2.1)
4. `approveStack()` - save approval + update phase
5. `approveDependencies()` - save approval + update phase

**Add Rollback Logging**:

```typescript
async createProject(data: ProjectData): Promise<Project> {
  try {
    return await this.db.transaction(async (tx) => {
      // ... transaction logic
    });
  } catch (error) {
    this.logger.error('Transaction rolled back', {
      operation: 'createProject',
      error,
      correlationId: data.correlationId,
    });
    throw error;
  }
}
```

**Files to Modify**:
- `backend/services/database/drizzle_project_db_service.ts` (add transactions to all multi-step operations)

**Testing**:
- Test: Create project, kill DB mid-transaction → verify rollback
- Test: Update phase, force second operation to fail → verify rollback
- Test: Happy path still works

---

### Phase 2 Success Metrics

**Must Achieve**:
- ✅ Single storage system (R2 primary, PostgreSQL metadata only)
- ✅ All route handlers <100 lines (target: <50 lines)
- ✅ Business logic extracted to testable service layer
- ✅ TypeScript `any` usage <150 occurrences (down from 557)
- ✅ All multi-step database operations wrapped in transactions
- ✅ `npm run build` succeeds with stricter TypeScript
- ✅ All existing tests still pass

**Estimated Time**: 1.5-2 weeks for one developer

---

## Phase 3: Testing Infrastructure & Observability 🟢 **WEEK 3-4 - CRITICAL FOR CONFIDENCE**

### Current Testing State: MASSIVE COVERAGE GAP

**What's Currently Lacking**:

1. **Test Coverage Discrepancy** (CRITICAL)
   - **Claimed**: 85%+ test coverage
   - **Actual**: ~7% test file coverage (6 test files vs 84 source files)
   - **Gap Analysis**:
     - ✅ Tested: `DependencySelector.test.tsx`, `StackSelection.test.tsx`, API integration tests
     - ❌ **NOT Tested**: LLM client, Orchestrator engine, Auth service, Database service, File storage, Error handlers, Rate limiters, Validators, 70+ other files

2. **Zero Coverage on Critical Paths**
   - **Orchestrator Engine** (`backend/services/orchestrator/orchestrator_engine.ts`): **0% coverage**
     - State machine logic (6 phases, transitions)
     - Approval gates (blocking logic)
     - Validation execution
     - Error recovery

   - **LLM Client** (`backend/services/llm/llm_client.ts`): **0% coverage**
     - Agent execution
     - Retry logic (exponential backoff)
     - Timeout handling
     - Error parsing

   - **Authentication** (`backend/services/auth/*`): **0% coverage**
     - Login/logout flows
     - JWT generation/validation
     - Password hashing
     - Session management

   - **Database Service** (`backend/services/database/drizzle_project_db_service.ts`): **Partial coverage**
     - CRUD operations partially tested
     - Transaction logic NOT tested
     - Constraint violations NOT tested

3. **Test Infrastructure Gaps**
   - No test database setup helpers
   - No shared mock factories
   - No coverage thresholds configured
   - No CI/CD test gates

---

### Implementation Plan: Comprehensive Test Suite

#### 3.1 Test Infrastructure Setup

**Step 1: Create Test Utilities**

File: `backend/__tests__/helpers/test-utils.ts` (NEW)

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { v4 as uuid } from 'uuid';

// In-memory test database
export function setupTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);

  // Run migrations
  migrate(db, { migrationsFolder: './drizzle' });

  return { db, sqlite };
}

// Mock factories
export function createMockProject(overrides?: Partial<Project>): Project {
  return {
    id: uuid(),
    slug: 'test-project',
    name: 'Test Project',
    description: 'Test description',
    currentPhase: 'ANALYSIS',
    phasesCompleted: '',
    stackApproved: false,
    dependenciesApproved: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockLLMResponse(content: string): LLMResponse {
  return {
    content,
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    finishReason: 'stop',
  };
}

// Mock LLM client
export function mockLLMClient() {
  return {
    executeAgent: vi.fn().mockResolvedValue(
      createMockLLMResponse('Mock agent response')
    ),
    config: {
      api_key: 'test-key',
      model: 'gemini-2.5-flash',
      max_tokens: 8000,
    },
  };
}
```

**Step 2: Configure Coverage Thresholds**

File: `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    // ... existing config
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.config.*',
        'drizzle/',
      ],
      // NEW: Enforce coverage thresholds
      thresholds: {
        lines: 40,        // Start at 40%, increase over time
        functions: 40,
        branches: 35,
        statements: 40,
      },
    },
  },
});
```

---

#### 3.2 Orchestrator Engine Tests (CRITICAL)

**File**: `backend/services/orchestrator/__tests__/orchestrator_engine.test.ts` (NEW)

**Test Scenarios** (15-20 test cases):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrchestratorEngine } from '../orchestrator_engine';
import { setupTestDb, createMockProject, mockLLMClient } from '../../__tests__/helpers/test-utils';

describe('OrchestratorEngine', () => {
  let db: any;
  let engine: OrchestratorEngine;
  let llmClient: any;

  beforeEach(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    llmClient = mockLLMClient();
    engine = new OrchestratorEngine(db, llmClient);
  });

  describe('Phase Transitions', () => {
    it('should transition from ANALYSIS to STACK_SELECTION', async () => {
      const project = createMockProject({ currentPhase: 'ANALYSIS' });

      const result = await engine.executePhase(project);

      expect(result.nextPhase).toBe('STACK_SELECTION');
      expect(result.artifacts).toHaveLength(3); // constitution, brief, personas
    });

    it('should require stack approval before SPEC phase', async () => {
      const project = createMockProject({
        currentPhase: 'STACK_SELECTION',
        stackApproved: false,
      });

      await expect(engine.executePhase(project)).rejects.toThrow(
        'Stack must be approved before proceeding'
      );
    });

    it('should allow SPEC phase after stack approval', async () => {
      const project = createMockProject({
        currentPhase: 'STACK_SELECTION',
        stackApproved: true,
      });

      const result = await engine.executePhase(project);

      expect(result.nextPhase).toBe('DEPENDENCIES');
    });
  });

  describe('Approval Gates', () => {
    it('should block DEPENDENCIES phase without stack approval', async () => {
      const project = createMockProject({
        currentPhase: 'SPEC',
        stackApproved: false,
      });

      await expect(engine.canProceedToPhase(project, 'DEPENDENCIES')).resolves.toBe(false);
    });

    it('should block SOLUTIONING phase without dependencies approval', async () => {
      const project = createMockProject({
        currentPhase: 'DEPENDENCIES',
        dependenciesApproved: false,
      });

      await expect(engine.canProceedToPhase(project, 'SOLUTIONING')).resolves.toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate required artifacts exist', async () => {
      const project = createMockProject({ currentPhase: 'ANALYSIS' });

      const result = await engine.validatePhase(project, 'ANALYSIS');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation if artifacts missing', async () => {
      const project = createMockProject({ currentPhase: 'SPEC' });
      // Don't create required artifacts

      const result = await engine.validatePhase(project, 'SPEC');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required artifact: PRD.md');
    });
  });

  describe('Error Handling', () => {
    it('should recover from LLM API errors', async () => {
      llmClient.executeAgent.mockRejectedValueOnce(new Error('API timeout'));
      llmClient.executeAgent.mockResolvedValueOnce({ content: 'Retry succeeded' });

      const project = createMockProject({ currentPhase: 'ANALYSIS' });

      const result = await engine.executePhase(project);

      expect(result.success).toBe(true);
      expect(llmClient.executeAgent).toHaveBeenCalledTimes(2); // Retry
    });

    it('should persist state after errors', async () => {
      const project = createMockProject({ currentPhase: 'ANALYSIS' });

      llmClient.executeAgent.mockRejectedValue(new Error('Permanent failure'));

      await expect(engine.executePhase(project)).rejects.toThrow();

      // Verify project state wasn't corrupted
      const savedProject = await db.select().from(projects).where(eq(projects.id, project.id));
      expect(savedProject[0].currentPhase).toBe('ANALYSIS'); // Unchanged
    });
  });
});
```

**Estimated**: 15-20 test cases

---

#### 3.3 LLM Client Tests (CRITICAL)

**File**: `backend/services/llm/__tests__/llm_client.test.ts` (NEW)

**Test Scenarios** (12-15 test cases):

```typescript
describe('LLMClient', () => {
  let client: LLMClient;

  beforeEach(() => {
    client = new LLMClient({
      api_key: 'test-key',
      model: 'gemini-2.5-flash',
      max_tokens: 8000,
      temperature: 0.7,
    });
  });

  describe('Agent Execution', () => {
    it('should execute agent with correct payload', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: 'Agent response' }] } }
          ],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            totalTokenCount: 150,
          },
        }),
      });

      const result = await client.executeAgent(
        { name: 'Analyst', role: 'Test', prompt: 'Analyze this' },
        { projectDescription: 'Test project' }
      );

      expect(result.content).toBe('Agent response');
      expect(result.usage.totalTokens).toBe(150);

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-goog-api-key': 'test-key',  // Header-based auth
          }),
        })
      );
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 429 rate limit errors', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 429 })  // First: rate limit
        .mockResolvedValueOnce({ ok: false, status: 429 })  // Second: rate limit
        .mockResolvedValueOnce({  // Third: success
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: 'Success' }] } }] }),
        });

      const result = await client.executeAgent(agent, context);

      expect(result.content).toBe('Success');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      const sleepSpy = vi.spyOn(global, 'setTimeout');

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ... }) });

      await client.executeAgent(agent, context);

      expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 1000);  // 1s
      // Second retry would be 2s, third would be 4s, etc.
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid API key', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.executeAgent(agent, context)).rejects.toThrow(
        'Invalid API key'
      );
    });

    it('should handle malformed responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ malformed: 'response' }),  // Missing candidates
      });

      await expect(client.executeAgent(agent, context)).rejects.toThrow(
        'Malformed LLM response'
      );
    });

    it('should timeout after configured duration', async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 999999))  // Never resolves
      );

      const clientWithTimeout = new LLMClient({ ...config, timeout: 1000 });

      await expect(
        clientWithTimeout.executeAgent(agent, context)
      ).rejects.toThrow('Request timeout');
    }, 2000);
  });
});
```

**Estimated**: 12-15 test cases

---

#### 3.4 Authentication Tests

**File**: `backend/services/auth/__tests__/auth_service.test.ts` (NEW)

**Test Scenarios** (10-12 test cases):

```typescript
describe('AuthService', () => {
  describe('Login', () => {
    it('should authenticate valid credentials', async () => {
      const result = await authService.login('user@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('user@example.com');
    });

    it('should reject invalid password', async () => {
      await expect(
        authService.login('user@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      await expect(
        authService.login('nonexistent@example.com', 'password')
      ).rejects.toThrow('User not found');
    });
  });

  describe('JWT Tokens', () => {
    it('should generate valid JWT tokens', async () => {
      const token = await jwtService.generateToken({ userId: '123', email: 'test@example.com' });

      expect(token).toBeDefined();
      const decoded = await jwtService.verifyToken(token);
      expect(decoded.userId).toBe('123');
    });

    it('should reject expired tokens', async () => {
      const token = await jwtService.generateToken(
        { userId: '123' },
        { expiresIn: '1ms' }  // Expire immediately
      );

      await new Promise(resolve => setTimeout(resolve, 10));  // Wait

      await expect(jwtService.verifyToken(token)).rejects.toThrow('Token expired');
    });
  });

  describe('Password Hashing', () => {
    it('should hash passwords with bcrypt', async () => {
      const password = 'password123';
      const hashed = await passwordService.hash(password);

      expect(hashed).not.toBe(password);
      expect(hashed).toMatch(/^\$2[aby]\$/);  // bcrypt format
    });

    it('should verify correct passwords', async () => {
      const password = 'password123';
      const hashed = await passwordService.hash(password);

      const isValid = await passwordService.verify(password, hashed);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const hashed = await passwordService.hash('password123');

      const isValid = await passwordService.verify('wrongpassword', hashed);

      expect(isValid).toBe(false);
    });
  });
});
```

**Estimated**: 10-12 test cases

---

#### 3.5 Database Service Tests

**File**: `backend/services/database/__tests__/drizzle_project_db_service.test.ts` (NEW)

**Test Scenarios** (15-18 test cases):

```typescript
describe('DrizzleProjectDBService', () => {
  describe('CRUD Operations', () => {
    it('should create project with transaction', async () => {
      const data = {
        slug: 'test-project',
        name: 'Test Project',
        description: 'Test',
      };

      const project = await dbService.createProject(data);

      expect(project.id).toBeDefined();
      expect(project.slug).toBe('test-project');

      // Verify phase history was created
      const history = await db.select().from(phaseHistory).where(
        eq(phaseHistory.projectId, project.id)
      );
      expect(history).toHaveLength(1);
      expect(history[0].phase).toBe('ANALYSIS');
    });

    it('should rollback transaction on failure', async () => {
      // Mock DB to fail on second insert
      vi.spyOn(db, 'insert').mockImplementationOnce(() => ({ ... }))  // Success
        .mockImplementationOnce(() => { throw new Error('DB error'); });  // Fail

      await expect(dbService.createProject(data)).rejects.toThrow();

      // Verify no project was created
      const projects = await db.select().from(projects);
      expect(projects).toHaveLength(0);
    });
  });

  describe('Constraint Violations', () => {
    it('should reject duplicate slugs', async () => {
      await dbService.createProject({ slug: 'duplicate', ... });

      await expect(
        dbService.createProject({ slug: 'duplicate', ... })
      ).rejects.toThrow('Slug already exists');
    });
  });
});
```

**Estimated**: 15-18 test cases

---

#### 3.6 CI/CD Integration

**File**: `.github/workflows/test.yml` (NEW)

```yaml
name: Test & Coverage

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Check coverage thresholds
        run: |
          if ! npm run test:coverage | grep -q "All files"; then
            echo "Coverage check failed"
            exit 1
          fi

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: ./coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

### 3.7 Observability & Monitoring

#### Add Secret Redaction to Logger

**File**: `backend/lib/logger.ts`

```typescript
const SENSITIVE_KEYS = [
  'api_key', 'apiKey', 'API_KEY',
  'password', 'PASSWORD',
  'secret', 'SECRET',
  'token', 'TOKEN',
  'authorization', 'Authorization',
  'cookie', 'Cookie',
];

function redactSecrets(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactSecrets(value);
    }
  }
  return redacted;
}

export function log(level: string, message: string, context?: any) {
  const safeContext = redactSecrets(context);
  // ... existing logging logic
}
```

#### Integrate Sentry

**Install**: `npm install @sentry/nextjs`

**File**: `sentry.server.config.ts` (NEW)

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event, hint) {
    // Redact sensitive data
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
```

**File**: `sentry.client.config.ts` (NEW)

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  tracesSampleRate: 0.1,  // Lower for client
});
```

---

### Phase 3 Success Metrics

**Must Achieve**:
- ✅ Test coverage >40% (lines, functions, branches, statements)
- ✅ Orchestrator engine: 15+ test cases, 80%+ coverage
- ✅ LLM client: 12+ test cases, 80%+ coverage
- ✅ Authentication: 10+ test cases, 70%+ coverage
- ✅ Database service: 15+ test cases, 70%+ coverage
- ✅ CI/CD blocks merges if coverage drops below threshold
- ✅ Sentry error tracking active in production
- ✅ Secret redaction prevents key leakage in logs
- ✅ Coverage badge on README

**Estimated Time**: 1-1.5 weeks for one developer

---

## Implementation Roadmap Summary

### Week 1: Critical Security Hardening
- [ ] Migrate API keys to headers
- [ ] Add environment validation with Zod
- [ ] Create security headers middleware
- [ ] Enable CSRF protection
- [ ] Fix dependency vulnerabilities
- [ ] Set up GitHub Actions security workflow

### Week 2: Architecture Refactoring (Part 1)
- [ ] Design and plan dual storage migration
- [ ] Update database schema for R2 storage
- [ ] Create artifact manager with R2-first logic
- [ ] Test migration strategy with sample data

### Week 3: Architecture Refactoring (Part 2) + Testing (Part 1)
- [ ] Refactor route handlers (extract to service layer)
- [ ] Create API handler wrapper (HOF)
- [ ] Improve TypeScript type safety
- [ ] Wrap database operations in transactions
- [ ] Set up test infrastructure and utilities

### Week 4: Testing (Part 2) + Observability
- [ ] Write orchestrator engine tests
- [ ] Write LLM client tests
- [ ] Write authentication tests
- [ ] Write database service tests
- [ ] Add secret redaction to logger
- [ ] Integrate Sentry error tracking
- [ ] Configure CI/CD test gates

### Week 5-6: Optional Enhancements
- [ ] Redis-based rate limiting
- [ ] Database query optimizations
- [ ] Caching strategy implementation
- [ ] Code organization cleanup
- [ ] Developer tooling (pre-commit hooks, bundle analyzer)
- [ ] API documentation with OpenAPI

---

## Critical Files Reference

### Must Read Before Implementation:
1. [backend/services/orchestrator/orchestrator_engine.ts](backend/services/orchestrator/orchestrator_engine.ts) - Core state machine (Phase transitions, approval gates)
2. [backend/services/llm/llm_client.ts](backend/services/llm/llm_client.ts) - LLM integration (Gemini API, retry logic)
3. [backend/lib/schema.ts](backend/lib/schema.ts) - Database schema (8 tables, relationships, indexes)
4. [src/app/api/projects/[slug]/execute-phase/route.ts](src/app/api/projects/[slug]/execute-phase/route.ts) - Main workflow endpoint (247 lines, needs refactoring)
5. [backend/services/file_system/project_storage.ts](backend/services/file_system/project_storage.ts) - R2 storage client
6. [backend/lib/error_handler.ts](backend/lib/error_handler.ts) - Error handling patterns (AppError class)
7. [src/lib/auth.ts](src/lib/auth.ts) - Authentication config (Better Auth setup)
8. [orchestrator_spec.yml](orchestrator_spec.yml) - Workflow configuration SSOT (30KB, 1000+ lines)

### Testing Pattern References:
1. [src/components/__tests__/DependencySelector.test.tsx](src/components/__tests__/DependencySelector.test.tsx) - Component test pattern
2. [src/app/api/__tests__/projects.test.ts](src/app/api/__tests__/projects.test.ts) - API integration test pattern
3. [vitest.config.ts](vitest.config.ts) - Test configuration

---

## Risk Mitigation

### High-Risk Changes

**1. Dual Storage Migration** (Phase 2.1)
- **Risk**: Data loss, downtime, inconsistency
- **Mitigation**:
  - Multi-step rollout (gradual migration)
  - Keep DB as fallback during transition
  - Comprehensive backfill script with verification
  - Rollback plan documented
  - Test on staging with production data copy

**2. Route Handler Refactoring** (Phase 2.2)
- **Risk**: Breaking existing API contracts, regressions
- **Mitigation**:
  - Add integration tests BEFORE refactoring
  - Refactor one route at a time
  - Test each route individually
  - Keep original route handlers as reference
  - Deploy to staging first

**3. TypeScript Strict Mode** (Phase 2.3)
- **Risk**: Revealing hidden bugs, breaking builds
- **Mitigation**:
  - Incremental approach (one file at a time)
  - Commit each fix separately
  - Run full test suite after each change
  - Don't rush - quality over speed

### Testing Strategy
- **Unit tests**: Run on every file save (watch mode)
- **Integration tests**: Run on every commit (pre-commit hook)
- **E2E tests**: Run on PR (GitHub Actions)
- **Manual QA**: Staging environment before production
- **Feature flags**: For risky changes (if needed)
- **Rollback plan**: Document rollback steps for each phase

---

## Success Metrics

### Week 1 (Security)
- ✅ Zero high-severity vulnerabilities (`npm audit`)
- ✅ All secrets in environment variables (not hardcoded)
- ✅ Security headers present on all responses (verify with securityheaders.com)
- ✅ CSRF protection enabled
- ✅ GitHub Actions security workflow passing

### Week 3 (Architecture)
- ✅ Single storage system (R2 primary)
- ✅ All route handlers <100 lines
- ✅ TypeScript `any` usage <150 occurrences
- ✅ All multi-step operations use transactions
- ✅ `npm run build` succeeds

### Week 4 (Testing)
- ✅ Test coverage >40%
- ✅ Critical paths tested (orchestrator, LLM, auth, database)
- ✅ CI/CD blocks merges on coverage drop
- ✅ Sentry error tracking active

### Week 6 (Code Quality)
- ✅ No TODO comments in code (moved to GitHub issues)
- ✅ No console.log in production code
- ✅ Pre-commit hooks prevent regressions
- ✅ Bundle size <500KB
- ✅ API documentation available

---

## Cost Considerations

### Third-Party Services

**Required** (Security & Monitoring):
- **Sentry** (Error Tracking): Free tier available (5K errors/month), Paid: $26/month for 50K errors
- **GitHub Actions** (CI/CD): Free for public repos, 2000 min/month for private

**Optional** (Performance):
- **Upstash Redis** (Rate Limiting): Free tier (10K commands/day), Paid: $10/month
- **Vercel Analytics**: Free tier available, Paid: $10/month

**Total Estimated Monthly Cost**: $10-50/month (depending on usage)

---

## Notes

- All changes designed to be **non-breaking** for existing functionality
- Each phase can be implemented independently (though some dependencies exist)
- Prioritization can be adjusted based on team capacity and business needs
- Estimated effort: **6-8 weeks for one developer**, 3-4 weeks for team of 2-3
- Focus on **quality over speed** - thorough testing is critical
- Document all changes in CHANGELOG.md
- Update README.md with new features/requirements
- Consider creating a v2.0 release after completion

---

## Next Steps

1. **Review this plan** with your team
2. **Answer priority questions** (see introduction)
3. **Set up project board** (GitHub Projects) with tasks from roadmap
4. **Assign phases** to sprints/weeks
5. **Begin with Phase 1** (Critical Security) - highest impact, lowest risk
6. **Track progress** with success metrics
7. **Adjust plan** as needed based on learnings

**Ready to transform your spec-driven project into an enterprise-grade application!** 🚀
