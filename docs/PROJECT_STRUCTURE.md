# Project Structure Guide

Complete overview of the Spec-Driven Platform codebase organization, module responsibilities, and architecture patterns.

## Table of Contents
- [Directory Overview](#directory-overview)
- [Frontend Structure](#frontend-structure-src)
- [Backend Structure](#backend-structure)
- [Configuration Files](#configuration-files)
- [Key Modules](#key-modules)
- [Module Responsibilities](#module-responsibilities)
- [Architecture Patterns](#architecture-patterns)
- [Dependencies](#dependencies)

---

## Directory Overview

```
spec-driven/
├── src/                          # Next.js 14 Frontend (React/TypeScript)
├── backend/                      # Backend Services (Node.js/TypeScript)
├── drizzle/                      # Database Migrations
├── docs/                         # Documentation (you are here)
├── e2e/                          # End-to-End Tests (Playwright)
├── public/                       # Static Assets
├── projects/                     # Generated Project Artifacts
├── scripts/                      # Utility Scripts
├── .github/                      # GitHub Actions & CI/CD
├── .claude/                      # Claude Code Configuration
├── coverage/                     # Test Coverage Reports
├── .next/                        # Next.js Build Output (git-ignored)
├── node_modules/                 # Dependencies (git-ignored)
├── README.md                     # Project README
├── package.json                  # Dependencies & Scripts
├── tsconfig.json                 # TypeScript Configuration
├── next.config.js                # Next.js Configuration
├── tailwind.config.js            # Tailwind CSS Configuration
├── drizzle.config.ts             # Drizzle ORM Configuration
├── vitest.config.ts              # Unit Test Configuration
├── playwright.config.ts          # E2E Test Configuration
├── components.json               # shadcn/ui Configuration
├── orchestrator_spec.yml         # Workflow Specification (SSOT)
├── vercel.json                   # Vercel Deployment Configuration
└── .env.example                  # Environment Template
```

---

## Frontend Structure (src/)

### App Router (Next.js 14)

```
src/app/
├── api/                          # API Routes (Backend)
│   ├── auth/                     # Authentication Endpoints
│   │   ├── login/                POST /api/auth/login
│   │   ├── register/             POST /api/auth/register
│   │   ├── logout/               POST /api/auth/logout
│   │   ├── get-session/          GET /api/auth/get-session
│   │   └── verify/               POST /api/auth/verify
│   │
│   ├── projects/                 # Project Management
│   │   ├── route.ts              GET /api/projects, POST /api/projects
│   │   └── [slug]/
│   │       ├── route.ts          GET, PUT, DELETE /api/projects/[slug]
│   │       ├── execute-phase/    POST execute phase workflow
│   │       ├── approve-stack/    POST approve tech stack
│   │       ├── approve-dependencies/ POST approve dependencies
│   │       ├── generate-handoff/ POST generate handoff document
│   │       ├── download/         GET download spec package
│   │       └── artifacts/        Artifact operations
│   │
│   ├── lib/                      # API Utilities
│   │   ├── project-utils.ts      Project metadata helpers
│   │   └── artifact-utils.ts     Artifact operations
│   │
│   ├── middleware/               # API Middleware
│   │   ├── auth-guard.ts         Authentication wrapper
│   │   ├── error-handler.ts      Error handling
│   │   └── rate-limit.ts         Rate limiting
│   │
│   ├── schemas/                  # Zod Validation Schemas
│   │   └── index.ts              All request schemas
│   │
│   └── __tests__/                # API Tests
│       ├── projects.test.ts
│       ├── auth.test.ts
│       └── integration.test.ts
│
├── dashboard/                    # User Dashboard Pages
│   ├── page.tsx                  Dashboard view
│   ├── projects/                 Projects list
│   ├── [slug]/                   Project details
│   └── settings/                 User settings
│
├── project/[slug]/               # Project Workflow Pages
│   ├── page.tsx                  Project overview
│   ├── phases/                   Phase-specific pages
│   ├── artifacts/                Artifact viewer
│   └── download/                 Download page
│
├── (auth)/                       # Auth Layout Group
│   ├── login/                    Login page
│   ├── register/                 Registration page
│   └── layout.tsx                Auth layout wrapper
│
├── resources/                    # Static Content
│   ├── page.tsx                  Resources page
│   └── [resource]/               Resource details
│
├── privacy/                      # Policy Pages
│   └── page.tsx                  Privacy policy
│
├── terms/                        # Policy Pages
│   └── page.tsx                  Terms of service
│
├── layout.tsx                    # Root Layout
├── page.tsx                      # Home Page
├── globals.css                   # Global Styles
├── error.tsx                     # Error Boundary
└── not-found.tsx                 # 404 Page

src/
├── components/                   # React Components
│   ├── orchestration/            # Workflow Components
│   │   ├── PhaseStepper.tsx     Shows current phase
│   │   ├── StackSelection.tsx    Tech stack selector
│   │   ├── DependencySelector.tsx Dependency approval
│   │   ├── ArtifactViewer.tsx    View generated artifacts
│   │   └── WorkflowProgress.tsx  Phase progress indicator
│   │
│   ├── ui/                       # shadcn/ui Components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Dialog.tsx
│   │   ├── Form.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Textarea.tsx
│   │   ├── Toast.tsx
│   │   ├── Table.tsx
│   │   └── ...
│   │
│   ├── layout/                   # Layout Components
│   │   ├── Header.tsx            Navigation header
│   │   ├── Sidebar.tsx           Navigation sidebar
│   │   ├── Footer.tsx            Footer
│   │   └── Container.tsx         Layout wrapper
│   │
│   ├── error/                    # Error Handling
│   │   ├── ErrorBoundary.tsx    React error boundary
│   │   ├── ErrorDisplay.tsx      Error UI
│   │   └── FallbackUI.tsx        Fallback component
│   │
│   └── __tests__/                # Component Tests
│       ├── DependencySelector.test.tsx
│       ├── StackSelection.test.tsx
│       └── PhaseStepper.test.tsx
│
├── contexts/                     # React Contexts
│   ├── AuthContext.tsx           Authentication state
│   ├── ProjectContext.tsx        Current project state
│   ├── ThemeContext.tsx          Dark mode toggle
│   └── NotificationContext.tsx   Toast notifications
│
├── hooks/                        # Custom Hooks
│   ├── useAuth.ts                Auth state management
│   ├── useProject.ts             Project operations
│   ├── usePhase.ts               Phase execution
│   ├── useFetch.ts               Data fetching wrapper
│   └── useLocalStorage.ts        Local storage wrapper
│
├── lib/                          # Client Utilities
│   ├── auth.ts                   Better Auth config
│   ├── auth-client.ts            Auth client wrapper
│   ├── auth-utils.ts             Auth helper functions
│   ├── db.ts                     Database client
│   ├── store.ts                  Zustand state store
│   ├── config.ts                 Configuration constants
│   ├── env.ts                    Environment validation
│   ├── logger.ts                 Client-side logging
│   ├── r2-storage.ts             R2 client wrapper
│   ├── rate-limiter.ts           Client rate limiting
│   ├── execution-guard.ts        Phase execution guards
│   ├── db-lock.ts                Distributed locks
│   ├── correlation-id.ts         Request correlation
│   └── utils.ts                  Utility functions
│
├── types/                        # TypeScript Type Definitions
│   ├── index.ts                  All type exports
│   ├── orchestrator.ts           Workflow types
│   ├── project.ts                Project types
│   ├── phase.ts                  Phase types
│   ├── artifact.ts               Artifact types
│   ├── llm.ts                    LLM integration types
│   ├── auth.ts                   Authentication types
│   └── api.ts                    API response types
│
├── content/                      # Static Content
│   ├── features.ts               Features list
│   ├── faq.ts                    FAQ content
│   └── docs.ts                   Documentation links
│
├── utils/                        # Backend Utilities
│   ├── date-utils.ts             Date formatting
│   ├── string-utils.ts           String operations
│   ├── validation-utils.ts       Data validation
│   └── file-utils.ts             File operations
│
└── middleware.ts                 # Next.js Middleware
    (Auth checks, session validation, headers)
```

---

## Backend Structure (backend/)

```
backend/
├── lib/                          # Core Utilities & Config
│   ├── drizzle.ts               ORM client (SQLite/Postgres)
│   ├── schema.ts                Database schema definition
│   ├── error_handler.ts         Custom error classes
│   ├── sanitizer.ts             Input sanitization
│   ├── validation_schemas.ts    Zod validation schemas
│   ├── migration_helper.ts      Migration utilities
│   ├── logger.ts                Structured logging
│   ├── rate_limiter.ts          Rate limit utilities
│   └── __tests__/
│       ├── error_handler.test.ts
│       ├── sanitizer.test.ts
│       └── validation_schemas.test.ts
│
├── middleware/
│   ├── auth_middleware.ts       Request authentication
│   └── error_handler_middleware.ts Exception handling
│
└── services/                     # Business Logic Services
    ├── auth/                     # Authentication Service
    │   ├── auth_service.ts       Core auth logic
    │   ├── jwt_service.ts        JWT token handling
    │   ├── password_service.ts   Password hashing (bcrypt)
    │   ├── drizzle_auth_service.ts Database operations
    │   └── __tests__/
    │       └── password_service.test.ts
    │
    ├── llm/                      # LLM Integration (Gemini)
    │   ├── llm_client.ts         Google Gemini API client
    │   ├── agent_executors.ts    Agent execution logic
    │   └── __tests__/
    │       └── llm_client.test.ts
    │
    ├── orchestrator/             # Workflow Orchestration
    │   ├── orchestrator_engine.ts State machine (6 phases)
    │   ├── validators.ts         Phase validators
    │   ├── artifact_manager.ts   Artifact storage/versioning
    │   ├── config_loader.ts      Load orchestrator_spec.yml
    │   └── __tests__/
    │       ├── orchestrator_engine.test.ts
    │       └── validators.test.ts
    │
    ├── file_system/              # File Storage & Versioning
    │   ├── project_storage.ts    Filesystem storage
    │   ├── handoff_generator.ts  Generate HANDOFF.md
    │   ├── archiver.ts           Create ZIP packages
    │   └── s3_client.ts          R2/S3 integration
    │
    ├── database/                 # Database Operations
    │   └── drizzle_project_db_service.ts CRUD operations
    │
    ├── projects/                 # Project Service
    │   └── projects_service.ts   Project business logic
    │
    └── middleware/               # Request/Response Handling
        ├── auth_guard.ts         Auth verification
        ├── error_handler.ts      Error response formatting
        └── rate_limit.ts         Request rate limiting
```

---

## Configuration Files

### Database & ORM
- **drizzle.config.ts** - ORM configuration, migration settings
- **backend/lib/schema.ts** - Complete database schema (8 tables)

### Application
- **next.config.js** - Next.js 14 configuration, webpack overrides
- **tsconfig.json** - TypeScript compiler options, path aliases
- **tailwind.config.js** - Tailwind CSS theme, plugins
- **components.json** - shadcn/ui configuration
- **package.json** - Dependencies, npm scripts

### Testing
- **vitest.config.ts** - Unit test configuration
- **playwright.config.ts** - E2E test configuration

### Deployment
- **vercel.json** - Vercel platform configuration
- **.env.example** - Environment variable template

### Workflow
- **orchestrator_spec.yml** - **SINGLE SOURCE OF TRUTH** (30KB)
  - Defines all 6 phases
  - Specifies 5 agent roles and prompts
  - Lists validators and validation rules
  - Contains predefined tech stacks
  - Includes security baseline config

---

## Key Modules

### 1. Orchestrator Engine (Core)
**Location**: `backend/services/orchestrator/orchestrator_engine.ts`

**Responsibilities**:
- State machine managing 6 phases (ANALYSIS → DONE)
- Approval gate enforcement
- Agent execution coordination
- Artifact validation
- Error recovery

**Key Classes**:
- `OrchestratorEngine` - Main orchestration logic
- `PhaseValidator` - Phase-specific validation
- `ArtifactManager` - Artifact storage and versioning

**Entry Point**: `src/app/api/projects/[slug]/execute-phase/route.ts`

---

### 2. LLM Client (Integration)
**Location**: `backend/services/llm/llm_client.ts`

**Responsibilities**:
- Google Gemini API communication
- Request payload construction
- Response parsing and validation
- Retry logic with exponential backoff
- Token usage tracking

**Key Methods**:
- `executeAgent(agent, context)` - Execute single agent
- `streamAgentResponse()` - Streaming responses (future)

**Rate Limits**: 100 req/min per API key

---

### 3. Database Service (Persistence)
**Location**: `backend/services/database/drizzle_project_db_service.ts`

**Responsibilities**:
- Project CRUD operations
- Artifact storage and retrieval
- Phase history tracking
- Approval gate persistence
- User session management

**Key Methods**:
- `createProject()` - Create new project
- `getProjectBySlug()` - Fetch by slug (owner-gated)
- `updateProjectPhase()` - Progress workflow
- `saveArtifact()` - Store generated artifacts
- `approveStackSelection()` - Save stack choice
- `approveDependencies()` - Save dependency approval

---

### 4. Authentication (Security)
**Location**: `src/lib/auth.ts` + `backend/services/auth/`

**Responsibilities**:
- Better Auth integration
- Session management
- JWT token generation/validation
- Password hashing (bcrypt cost 10+)
- Email verification

**Key Classes**:
- `AuthService` - Login/registration logic
- `JWTService` - Token operations
- `PasswordService` - Bcrypt wrapper

---

### 5. File System Service (Storage)
**Location**: `backend/services/file_system/project_storage.ts`

**Responsibilities**:
- Local filesystem artifact storage
- R2/S3 cloud storage integration
- ZIP package creation
- Directory structure management
- File versioning

**Storage Structure**:
```
projects/{slug}/specs/
├── ANALYSIS/v1/
│   ├── constitution.md
│   ├── project-brief.md
│   └── personas.md
├── STACK_SELECTION/v1/
│   └── README.md
├── SPEC/v1/
│   ├── PRD.md
│   ├── data-model.md
│   └── api-spec.json
├── DEPENDENCIES/v1/
│   ├── DEPENDENCIES.md
│   └── approval.md
├── SOLUTIONING/v1/
│   ├── architecture.md
│   ├── tasks.md
│   ├── epics.md
│   └── plan.md
└── DONE/v1/
    └── HANDOFF.md
```

---

## Module Responsibilities

### Authentication Module
| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | Better Auth configuration |
| `src/lib/auth-client.ts` | Client-side auth wrapper |
| `backend/services/auth/auth_service.ts` | Login/registration logic |
| `backend/services/auth/jwt_service.ts` | Token generation/validation |
| `src/app/api/middleware/auth-guard.ts` | Request authentication |

**Flow**:
1. User submits credentials
2. `AuthService.login()` verifies password
3. `JWTService.generateToken()` creates token
4. Token sent to client as HTTP-only cookie
5. Client includes cookie in subsequent requests
6. `withAuth()` wrapper verifies token

---

### Project Management Module
| File | Purpose |
|------|---------|
| `src/app/api/projects/route.ts` | List/create projects |
| `src/app/api/projects/[slug]/route.ts` | Project CRUD |
| `backend/services/projects/projects_service.ts` | Business logic |
| `backend/services/database/drizzle_project_db_service.ts` | Data access |
| `src/app/api/lib/project-utils.ts` | Metadata helpers |

**Flow**:
1. API route receives request
2. `withAuth()` verifies user session
3. Schema validation with Zod
4. `ProjectService` handles logic
5. `ProjectDBService` persists to database
6. Response returned to client

---

### Workflow Orchestration Module
| File | Purpose |
|------|---------|
| `orchestrator_spec.yml` | Workflow definition (SSOT) |
| `backend/services/orchestrator/orchestrator_engine.ts` | State machine |
| `backend/services/orchestrator/validators.ts` | Phase validation |
| `backend/services/orchestrator/artifact_manager.ts` | Artifact handling |
| `src/app/api/projects/[slug]/execute-phase/route.ts` | Workflow entry point |

**Flow**:
1. User triggers phase execution
2. `OrchestratorEngine.executePhase()` loads spec
3. Identifies current phase and next phase
4. Checks approval gates if needed
5. Calls appropriate agent via `LLMClient`
6. Saves artifacts to database + filesystem/R2
7. Updates phase history
8. Returns results to client

---

### Artifact Management Module
| File | Purpose |
|------|---------|
| `backend/services/orchestrator/artifact_manager.ts` | Artifact versioning |
| `backend/services/file_system/project_storage.ts` | Storage operations |
| `backend/services/file_system/handoff_generator.ts` | HANDOFF.md creation |
| `src/app/api/projects/[slug]/artifacts/route.ts` | Artifact API |

**Artifact Storage**:
- **Primary**: R2/S3 (production) or Filesystem (development)
- **Metadata**: PostgreSQL database
- **Versions**: Incrementing v1, v2, v3...
- **Format**: Markdown + JSON

---

## Architecture Patterns

### Service Layer Pattern
```
API Route (HTTP)
    ↓
withAuth() (Authentication)
    ↓
Schema.safeParse() (Validation)
    ↓
Service.method() (Business Logic)
    ↓
DB Service.operation() (Data Access)
    ↓
Database (PostgreSQL/SQLite)
```

### State Machine Pattern (7-Phase Workflow v3.0)
```
ANALYSIS → STACK_SELECTION (Gate) → SPEC → DEPENDENCIES (Gate) → SOLUTIONING → VALIDATE → DONE
```

### Multi-Agent Collaboration
```
OrchestratorEngine.executePhase()
    ↓
LLMClient.executeAgent(analyst)
    ↓
Google Gemini API
    ↓
Parse Response → Validate → Save Artifacts → Return
```

### Error Handling Pattern
```
try {
  // operation
} catch (error) {
  if (error instanceof AppError) {
    // Known error - return with proper status
  } else {
    // Unknown error - log and return 500
  }
}
```

---

## Dependencies

### Key Production Dependencies
- **Next.js 14.2** - React framework
- **React 18** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 3.4** - Styling
- **shadcn/ui** - Component library
- **Drizzle ORM 0.44** - Database ORM
- **PostgreSQL** - Production database
- **Better Auth 1.3** - Authentication
- **Zod** - Schema validation
- **Google Generative AI SDK** - Gemini API

### Development Dependencies
- **Vitest 4.0** - Unit testing
- **Testing Library** - Component testing
- **Playwright 1.56** - E2E testing
- **ESLint 9** - Linting
- **TypeScript** - Type checking

---

## Key Files Reference

### Must-Read for Development
1. **orchestrator_spec.yml** - Workflow specification
2. **backend/lib/schema.ts** - Database schema
3. **backend/services/orchestrator/orchestrator_engine.ts** - State machine
4. **src/app/api/projects/[slug]/execute-phase/route.ts** - Main workflow endpoint
5. **src/lib/auth.ts** - Authentication config

### Configuration Files
1. **tsconfig.json** - TypeScript path aliases
2. **next.config.js** - Next.js settings
3. **drizzle.config.ts** - Database migrations
4. **playwright.config.ts** - E2E test settings

---

## Adding New Features

### Step 1: Define Types
```typescript
// src/types/myfeature.ts
export interface MyFeature {
  id: string;
  name: string;
  // ...
}
```

### Step 2: Create Database Schema
```typescript
// backend/lib/schema.ts
export const myFeature = pgTable('my_feature', {
  id: text('id').primaryKey(),
  // fields
});
```

### Step 3: Create Service
```typescript
// backend/services/myfeature/myfeature_service.ts
export class MyFeatureService {
  async create(data: MyFeature) { ... }
}
```

### Step 4: Create API Route
```typescript
// src/app/api/myfeature/route.ts
export const POST = withAuth(async (req, ctx, session) => {
  // Handle request
});
```

### Step 5: Create Component
```typescript
// src/components/MyFeatureComponent.tsx
export function MyFeatureComponent() {
  // React component
}
```

### Step 6: Add Tests
```typescript
// backend/services/myfeature/__tests__/myfeature_service.test.ts
// src/components/__tests__/MyFeatureComponent.test.tsx
// e2e/tests/myfeature.spec.ts
```

---

## Next Steps

- Read **[ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md)** for detailed workflow design
- Review **[API.md](API.md)** for endpoint reference
- Explore source code with IDE (VS Code recommended)
- Run tests to understand behavior: `npm test`

---

**Last Updated**: November 26, 2025
**Tested On**: Node 18+, TypeScript 5
**Status**: Current and Accurate
