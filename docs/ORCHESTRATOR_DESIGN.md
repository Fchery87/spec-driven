# Spec-Driven Platform: Orchestrator Design Document

**Version:** 3.0
**Date:** 2025-12-10
**Status:** Production
**Owner:** Spec-Driven Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Vision](#system-vision)
3. [Architecture Overview](#architecture-overview)
4. [Phase Workflow](#phase-workflow)
5. [Multi-Agent Roles & Responsibilities](#multi-agent-roles--responsibilities)
6. [Core Components](#core-components)
7. [Key Features & Enhancements](#key-features--enhancements)
8. [Project Folder Structure](#project-folder-structure)
9. [API Specification](#api-specification)
10. [Data Models](#data-models)
11. [Implementation Roadmap](#implementation-roadmap)
12. [Technical Decisions](#technical-decisions)
13. [Version 3.0 Enhancements](#version-30-enhancements)

---

## Executive Summary

Spec-Driven is transforming from a simple project scaffolder into a **comprehensive spec-first orchestrator** that guides users through a structured **7-phase workflow** to produce production-ready project documentation.

**Core Principle:** The system generates **complete, structured markdown specifications and planning documents** that users download as a ZIP, upload to their IDE, and use as context for their LLM of choice to generate production code. **No code generation happens in Spec-Driven itself.**

**Key Improvements:**
- ✅ Formal orchestrator spec (YAML) defining phases, artifacts, validators, and agents
- ✅ Explicit approval gates for stack selection and dependency approval
- ✅ Multi-agent role-based specification generation (Analyst, PM, Architect, Scrum Master, DevOps)
- ✅ Auto-generated HANDOFF.md that bridges specs to code generation
- ✅ LLM-agnostic system (Gemini 2.5 Pro Flash, but pluggable architecture)
- ✅ Persistent project storage for iterative refinement
- ✅ Security baseline integrated into all specs
- ✅ MVP/Priority mapping for incremental development

---

## System Vision

### The Problem

Traditional AI-assisted development suffers from "vibe coding" – unstructured prompting without clear specifications. This results in:
- Inconsistent implementations that diverge from intent
- Missing edge cases and non-functional requirements
- Difficulty iterating or extending the project
- Context loss across development sessions

### The Solution

Spec-Driven combines **GitHub Spec Kit** (spec-first philosophy) and **BMAD Method** (multi-agent collaboration) to create a structured "AI startup team in a box" that:

1. **Clarifies requirements** through guided Q&A (Analyst)
2. **Documents specifications** comprehensively (Product Manager)
3. **Designs architecture** and selects technology stacks (Architect)
4. **Manages dependencies** with security and policy awareness (DevOps)
5. **Plans implementation** as structured, self-contained tasks (Scrum Master)
6. **Hands off complete specs** to the user's IDE for code generation

The user's LLM (in their IDE) then generates production code from these specifications, ensuring alignment between requirements and implementation.

### Why This Approach?

- **Separation of Concerns:** Spec generation is separate from code generation
- **Flexibility:** Users control code generation with their chosen LLM
- **Quality:** Comprehensive specs reduce implementation bugs and misunderstandings
- **Reusability:** Specs can be iterated, shared, and referenced in future versions
- **Transparency:** All decisions documented and traceable
- **LLM-Agnostic:** Works with any LLM that understands markdown specs

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                       │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ ProjectList  │  │ ProjectWizard    │  │ ProjectDetail │ │
│  └──────────────┘  └──────────────────┘  └───────────────┘ │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ PhaseStepper │  │ StackSelection   │  │ Dependencies  │ │
│  └──────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ (API calls)
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Orchestrator Service (Core)                 │   │
│  │  • Phase State Machine                               │   │
│  │  • Gate Validation Engine                            │   │
│  │  • Artifact Management                               │   │
│  │  • Config Loader (orchestrator_spec.yml)             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            LLM Service (Agent-Agnostic)              │   │
│  │  • Gemini Client Wrapper                             │   │
│  │  • Prompt Template Management                        │   │
│  │  • Agent Executors (Analyst, PM, Architect, etc.)    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           File System & Storage Service              │   │
│  │  • Project Directory Creation                        │   │
│  │  • Artifact File Writing                             │   │
│  │  • ZIP Archive Creation                              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      Projects Service (Enhanced)                     │   │
│  │  • Project CRUD                                      │   │
│  │  • Orchestration State Tracking                      │   │
│  │  • Stack & Dependencies Management                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ (File I/O)
┌─────────────────────────────────────────────────────────────┐
│              File System Storage                            │
│  /projects/{slug}/                                         │
│  ├── specs/                                                │
│  │   ├── ANALYSIS/ (versioned)                            │
│  │   ├── STACK_SELECTION/                                │
│  │   ├── SPEC/                                            │
│  │   ├── DEPENDENCIES/                                    │
│  │   ├── SOLUTIONING/                                     │
│  │   └── DONE/                                            │
│  └── metadata.json (phase state, approvals)               │
└─────────────────────────────────────────────────────────────┘
                            ↓ (On Download)
┌─────────────────────────────────────────────────────────────┐
│              User Downloads                                │
│  {project-slug}.zip                                        │
│  ├── constitution.md                                       │
│  ├── project-brief.md                                      │
│  ├── personas.md                                           │
│  ├── PRD.md (Product Requirements)                         │
│  ├── architecture.md                                       │
│  ├── data-model.md                                         │
│  ├── api-spec.json                                         │
│  ├── tasks.md                                              │
│  ├── epics.md                                              │
│  ├── plan.md (with approved stack)                         │
│  ├── HANDOFF.md ← Auto-generated, ready for LLM           │
│  ├── DEPENDENCIES.md                                       │
│  ├── README.md                                             │
│  └── .ai-config/ (role prompts, validators)               │
│                                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓ (User uploads to IDE)
┌─────────────────────────────────────────────────────────────┐
│           User's IDE + LLM of Choice                       │
│  (VS Code, JetBrains, etc. + Claude, GPT-4, etc.)        │
│                                                            │
│  User pastes HANDOFF.md prompt → LLM generates code       │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase Workflow

### Phase Sequence

```
ANALYSIS
   ↓
STACK_SELECTION (Approval Gate)
   ↓
SPEC
   ↓
DEPENDENCIES (Approval Gate)
   ↓
SOLUTIONING
   ↓
VALIDATE
   ↓
DONE (ZIP Ready)
```

### Phase Descriptions

#### Phase 1: ANALYSIS

**Duration:** 15-30 minutes (interactive)
**Owner:** Analyst Agent
**Input:** User's project description/idea
**Output:**
- `constitution.md` - Project constitution/guiding principles
- `project-brief.md` - High-level vision, target market, key objectives
- `personas.md` - User personas (3-5 detailed profiles)

**Process:**
1. User describes their project idea
2. Analyst Agent asks clarifying questions:
   - "Who are your primary users?"
   - "What problem does this solve?"
   - "What are the key features?"
   - "What are your constraints (budget, timeline, scale)?"
   - "What success looks like?"
3. LLM generates three markdown files capturing the vision
4. User reviews and proceeds to STACK_SELECTION

**Validation:**
- `markdown_frontmatter` - Each file has required meta (title, owner, version, date)
- `presence` - All three files exist
- `content_quality` - Files aren't empty or obviously incomplete

**Next:** → STACK_SELECTION

---

#### Phase 2: STACK_SELECTION (Approval Gate)

**Duration:** 10-20 minutes
**Owner:** Architect Agent (proposal), User (approval)
**Input:** project-brief.md, personas.md
**Output:**
- `stack-decision.md` - Approved stack with composition details
- `stack-rationale.md` - Decision reasoning and alternatives considered

**Process:**
1. **Proposal Generation (Hybrid Mode):**
   - Architect Agent analyzes project requirements and proposes a stack from 12+ templates:

     | Template | Use Case |
     |----------|----------|
     | `nextjs_fullstack_expo` | Full-stack web + mobile with shared TypeScript code |
     | `nextjs_web_only` | Web-only SaaS, dashboards, CRUD applications |
     | `hybrid_nextjs_fastapi` | AI/ML workloads, Python backend + Next.js frontend |
     | `vue_nuxt` | Vue ecosystem with Nuxt 3 SSR/SSG |
     | `svelte_kit` | Lightweight, performant web applications |
     | `astro_static` | Content-heavy sites with partial hydration |
     | `serverless_edge` | Edge-first serverless architecture |
     | `django_htmx` | Python backend with HTMX interactivity |
     | `go_react` | High-performance Go API + React frontend |
     | `flutter_firebase` | Cross-platform mobile with Firebase |
     | `react_native_supabase` | React Native + Supabase backend |
     | `react_express` | Traditional MERN stack pattern |

   - Architect provides reasoning based on:
     - Project requirements from `project-brief.md`
     - User personas from `personas.md`
     - Technical constraints from `constitution.md`

2. **User Approval Options:**
   - **Template Mode:** Select from predefined templates
   - **Custom Mode:** Define custom stack composition:
     ```yaml
     frontend:
       framework: "React"
       meta_framework: "Next.js"
       styling: "Tailwind CSS"
       ui_library: "shadcn/ui"
     mobile:
       platform: "expo" | "flutter" | "none"
     backend:
       language: "TypeScript" | "Python" | "Go"
       framework: "Express" | "FastAPI" | "Gin"
     database:
       type: "sql" | "nosql" | "edge"
       provider: "Neon" | "PlanetScale" | "MongoDB"
       orm: "Drizzle" | "Prisma"
     deployment:
       platform: "Vercel" | "Railway" | "Fly.io"
       architecture: "monolith" | "microservices" | "serverless"
     ```

3. **Technical Preferences:**
   - User can specify library preferences:
     - State management: zustand, redux, jotai
     - Data fetching: tanstack-query, swr
     - Forms: react-hook-form, formik
     - Validation: zod, yup
     - Animation: framer-motion, react-spring
     - Testing: vitest, jest, playwright

4. **Stamping Decision:**
   - Backend generates `stack-decision.md` with:
     - Selected template or custom composition
     - Technical preferences applied
     - Rationale for selection
   - Backend generates `stack-rationale.md` with:
     - Decision factors
     - Alternatives considered and why not chosen
     - Trade-offs accepted
   - Updates project metadata: `stack_choice`, `stack_mode`, `stack_approved = true`

**Validation:**
- `presence` - stack-decision.md and stack-rationale.md exist
- `stack_approved == true` - User has explicitly approved a stack
- `stack_completeness` - All required layers defined

**Next:** → SPEC

---

#### Phase 3: SPEC

**Duration:** 30-45 minutes
**Owner:** Product Manager Agent + Architect Agent
**Input:** project-brief.md, personas.md, approved stack choice
**Output:**
- `PRD.md` - Product Requirements Document (detailed specs)
- `data-model.md` - Database schema, data structures
- `api-spec.json` - OpenAPI specification for API contracts
- `design-system.md` - Colors, typography, spacing, motion tokens
- `component-inventory.md` - UI components with shadcn/ui mappings
- `user-flows.md` - Key user journey wireframes
- Review checkpoint (user can request refinements)

**Process:**
1. **PRD Generation (PM Agent):**
   - Comprehensive Product Requirements Document including:
     - Functional requirements (numbered, linked to features)
     - Non-functional requirements (performance, security, UX)
     - Use cases and user flows
     - Epics and user stories with acceptance criteria
     - MVP features vs. Phase 2 features (tagged with priority)
   - Front-matter metadata: title, owner, version, date, status

2. **Data Model Generation (Architect Agent):**
   - Database schema based on PRD requirements
   - Entity-Relationship Diagram (ASCII or reference)
   - Table definitions with column types, constraints
   - Relationships and foreign keys

3. **API Specification (Architect Agent):**
   - OpenAPI 3.0 JSON schema
   - All endpoints derived from PRD requirements
   - Request/response models
   - Error handling
   - Authentication requirements

4. **Design System Generation (Architect Agent):**
   Following principles from `fire-your-design-team.md`:
   
   - **design-system.md:**
     - Color palette (project-specific, no purple defaults)
     - Typography scale (max 4 sizes: body, label, heading, display)
     - Spacing tokens (8pt grid: 8, 16, 24, 32, 48, 64)
     - Motion tokens (Framer Motion: duration scale, spring configs)
     - Accessibility requirements (WCAG compliance)
   
   - **component-inventory.md:**
     - UI components mapped to shadcn/ui
     - Custom components with props and variants
     - Animation patterns using Framer Motion
   
   - **user-flows.md:**
     - Key user journeys as wireframes
     - Interaction states and transitions
     - Error and empty states
   
   Anti-patterns enforced:
   - No gradient blob backgrounds
   - No default Inter font
   - No purple as primary color (unless brand-specific)
   - No excessive border radius (max 12px)

5. **Review Checkpoint:**
   - Frontend shows "SPEC Phase Complete" with button to review artifacts
   - User can: "Proceed to Dependencies", "Ask LLM to Refine PRD", or "Edit PRD manually"
   - If user requests refinement, PRD is regenerated (versioned)

**Validation:**
- `markdown_frontmatter` - PRD.md has required metadata
- `api_openapi` - api-spec.json is valid OpenAPI 3.0
- `presence` - All 6 files exist (PRD, data-model, api-spec, design-system, component-inventory, user-flows)
- `content_coverage` - PRD has at least 5 requirements, data-model has tables, api-spec has endpoints
- `design_system_compliance` - No purple defaults, max 4 typography sizes, 8pt spacing grid

**Next:** → DEPENDENCIES

---

#### Phase 4: DEPENDENCIES (Approval Gate)

**Duration:** 15-30 minutes
**Owner:** DevOps Agent (proposal), User (approval)
**Input:** PRD.md, approved stack choice
**Output:**
- `DEPENDENCIES.md` - Comprehensive dependency proposal
- `dependency-proposal.md` - JSON/detailed version (for policy checks)
- Policy validation scripts

**Process:**
1. **Dependency Proposal Generation:**
   - DevOps Agent generates `DEPENDENCIES.md` listing all required packages:

   **For Option A (Next.js-Only + Expo):**
   ```markdown
   ## Frontend & Mobile Dependencies
   - next@14.x - React framework
     - Why: App Router, file-based routing, built-in API
     - Security: Maintained, frequent updates, good track record
     - License: MIT

   - react@18.x - UI library
     - Why: Industry standard, excellent ecosystem

   - typescript@5.x - Type safety
   - tailwindcss@3.x - Styling
   - shadcn/ui@latest - Component library
   - zod@3.x - Schema validation
   - zustand@4.x - State management (lightweight alternative to Redux)
   - tanstack/react-query@5.x - Data fetching & caching
   - axios@latest - HTTP client

   ## tRPC (TypeScript RPC)
   - @trpc/client
   - @trpc/server
   - @trpc/next
   - Why: End-to-end type safety between frontend and API

   ## Database
   - @prisma/client@latest - ORM
   - prisma@latest (dev) - CLI & migrations
   - Why: Type-safe database access, excellent TypeScript support

   ## Testing
   - vitest@latest - Unit tests
   - @testing-library/react@latest - Component testing
   - playwright@latest - E2E tests

   ## Dev Tools
   - eslint@latest - Linting
   - prettier@latest - Formatting
   - husky@latest - Git hooks
   - lint-staged@latest - Run linters on staged files

   ## Security & Scanning
   - All dependencies subject to:
     - npm audit (zero HIGH/CRITICAL vulnerabilities)
     - npm outdated (must use latest minor version within constraints)
     - npm ls (no deprecated packages)
   ```

   **For Option B (Hybrid) - adds:**
   ```markdown
   ## Backend Dependencies (Python)
   - fastapi@0.104+ - Web framework
   - pydantic@2.x - Data validation
   - uvicorn@0.24+ - ASGI server
   - sqlalchemy@2.x - ORM
   - alembic@1.x - Migrations
   - pytest@7.x - Testing
   - black@23.x - Code formatting
   - ruff@0.1+ - Linting
   - python-jose@3.x - JWT tokens
   - passlib@1.x - Password hashing
   - python-dotenv@1.x - Environment variables

   ## Policy Checks:
   - pip-audit (zero HIGH/CRITICAL)
   - pip-compile requirements.in (with hashes)
   - No deprecated packages
   ```

2. **User Approval:**
   - Frontend displays DEPENDENCIES.md in a readable format
   - Shows which stack is active
   - Provides "Approve Dependencies" button
   - Option to "Request Custom Packages" or "Override"

3. **Policy Script Execution:**
   - On approval, backend runs dependency policy scripts:

     **Node Script** (`scripts/node/ensure_deps.mjs`):
     ```bash
     pnpm install --frozen-lockfile
     npm outdated → fail if any outdated
     npm audit → fail if HIGH/CRITICAL
     npm ls → warn if deprecated
     ```

     **Python Script** (`scripts/python/ensure_deps.sh`):
     ```bash
     pip-compile requirements.in --generate-hashes
     pip install --require-hashes -r requirements.txt
     pip-audit --strict
     ```

4. **Lockfile Storage:**
   - On success, store lockfiles in project:
     - `frontend/pnpm-lock.yaml` (or package-lock.json)
     - `backend/requirements.txt` (with hashes)
   - Generate `docs/DEPS_NOTES.md` with any manual overrides

5. **SBOM Generation (Optional):**
   - Generate CycloneDX JSON software bill of materials
   - Useful for compliance/security tracking

**Validation:**
- `presence` - DEPENDENCIES.md exists
- `dependencies_approved == true` - User has approved
- Policy scripts exit with code 0 (no warnings, no outdated, no HIGH/CRITICAL)

**Next:** → SOLUTIONING

---

#### Phase 5: SOLUTIONING

**Duration:** 30-60 minutes
**Owner:** Architect Agent + Scrum Master Agent
**Input:** PRD.md, data-model.md, api-spec.json, DEPENDENCIES.md
**Output:**
- `architecture.md` - Complete system architecture & design
- `epics.md` - Epic breakdown of features
- `tasks.md` - Structured task list with context
- Review checkpoint (user can refine before download)

**Process:**

1. **Architecture Document (Architect Agent):**
   - **System Overview:** Diagrams (text or ASCII) of components and flow
   - **Tech Stack Details:**
     - Frontend: Components, state management, routing
     - Backend: Services, layers, patterns
     - Database: Schema overview, key relationships
     - Infrastructure: Deployment targets, scaling
   - **Security & Compliance:**
     - Reference security_baseline from orchestrator spec
     - Auth flows (OAuth, JWT, session-based)
     - Data encryption (at rest, in transit)
     - Compliance notes (GDPR, etc.)
   - **API Design:** Request/response flows, error handling
   - **Performance Considerations:** Caching strategy, optimization points
   - **Scalability Plan:** How to scale as traffic grows

2. **Epics Breakdown (Scrum Master Agent):**
   - `epics.md` lists all epics (feature sets) from PRD
   - Format:
     ```markdown
     ## Epic 1: User Authentication & Account Management

     **Requirements Covered:**
     - REQ-AUTH-001: User registration
     - REQ-AUTH-002: User login
     - REQ-AUTH-003: Password reset

     **User Stories:**
     - 1.1: User can register with email/password
     - 1.2: User can log in
     - 1.3: User can reset forgotten password
     - 1.4: User account dashboard

     **Components (Frontend):**
     - LoginScreen.tsx
     - RegisterScreen.tsx
     - ResetPasswordScreen.tsx
     - AccountDashboard.tsx

     **APIs (Backend):**
     - POST /auth/register
     - POST /auth/login
     - POST /auth/reset-password
     - GET /user/account

     **Acceptance Criteria:**
     - Users can create accounts with email validation
     - Login returns valid JWT token
     - Sessions expire after 1 hour
     - Password stored with bcrypt
     ```

3. **Tasks Breakdown (Scrum Master Agent):**
   - `tasks.md` contains detailed task list with execution context
   - Each task includes:
     - **Task ID & Title**
     - **Requirement(s):** Which PRD requirements it fulfills
     - **Architecture Reference:** Which component from architecture.md
     - **Epic:** Which epic it belongs to
     - **User Story:** What the user wants to do
     - **Acceptance Criteria:** How to know it's done
     - **Implementation Hints:** Tech suggestions (not code, but guidance)
     - **Dependencies:** What must be done first
     - **Est. Complexity:** Small/Medium/Large
     - **MVP:** Yes/No (if Phase 2 feature, mark as Phase 2)

   **Example Task:**
   ```markdown
   ## Task 1.1: User Registration Backend API

   **Requirement(s):** REQ-AUTH-001, REQ-AUTH-002
   **Epic:** Epic 1 - Authentication
   **User Story:** As a new user, I want to register an account with my email and password

   **Acceptance Criteria:**
   - POST /auth/register accepts { email, password, name }
   - Email validation: Must be valid email format
   - Password validation: Min 8 chars, requires uppercase, number, special char
   - Duplicate email: Returns 409 Conflict
   - Success: Returns { userId, token, expiresIn }
   - Password: Hashed with bcrypt (cost factor 10)
   - User stored in users table (see data-model.md)

   **Architecture Component:** See architecture.md § Backend Services → Auth Service

   **Implementation Hints:**
   - Use Pydantic for request validation (if FastAPI) or zod (if Node)
   - Implement strong password validation per OWASP guidelines
   - Use bcrypt with cost factor 10 (not less, for security)
   - Consider rate limiting: max 5 registration attempts per IP per hour
   - Log registration attempt (not password) for audit trail
   - Return 400 Bad Request for validation errors (not 409)
   - Consider async execution for password hashing

   **Database Changes:**
   - No new migrations (users table already defined in data-model.md)

   **Tests Expected:**
   - Valid registration succeeds
   - Duplicate email returns 409
   - Weak password returns 400
   - Password is properly hashed (not stored plaintext)
   - Email validation works correctly

   **Dependencies:**
   - Project structure setup (from Task 0.0)
   - Database initialized and migrations applied

   **Est. Complexity:** Medium
   **MVP:** Yes (Phase 1)
   **Priority:** High (blocks other auth tasks)
   ```

4. **Task Organization:**
   - Tasks numbered with epic prefix (1.1, 1.2, 2.1, etc.)
   - Organized by execution order
   - Parallel tasks clearly marked
   - Dependencies clearly stated

5. **Review Checkpoint:**
   - User sees "SOLUTIONING Phase Complete"
   - Can review architecture, epics, tasks
   - Can request refinements before moving to DONE
   - Can manually edit tasks if needed

**Validation:**
- `markdown_frontmatter` - All files have metadata
- `tasks_dag` - No circular dependencies in task list
- `presence` - All three files exist
- `content_coverage` - At least 10 tasks, clear dependencies

**Next:** → VALIDATE

---

#### Phase 6: VALIDATE

**Duration:** 10-15 minutes
**Owner:** Validator (automation)
**Input:** All previous phase outputs
**Output:**
- `validation-report.md` - Cross-artifact consistency results (errors + warnings)
- `coverage-matrix.md` - Artifact presence/coverage by phase

**Process:**
1. Verify PRD requirements map to tasks
2. Verify API endpoints are reflected in tasks
3. Verify cross-artifact consistency (personas/REQs/EPICs/stack)
4. Verify constitutional compliance (test-first, simplicity, anti-abstraction)
5. Produce reports for user review before packaging

**Next:** → DONE

---

#### Phase 7: DONE

**Duration:** 5-10 minutes
**Owner:** Orchestrator (automation)
**Input:** All previous phase outputs
**Output:**
- `HANDOFF.md` - Master handoff document for LLM code generation
- Project ZIP archive ready for download
- `metadata.json` - Complete project state

**Process:**

1. **HANDOFF.md Auto-Generation:**
   - Create master document referencing all artifacts
   - Include ready-to-use LLM prompt template
   - Specify document reading order
   - Summarize stack, dependencies, security baseline

   **Example HANDOFF.md:**
   ```markdown
   # Handoff: Freelancer Time Tracking App

   **Project:** Freelancer Invoice & Time Tracking
   **Created:** 2025-11-14
   **Stack:** Next.js-Only + Expo
   **Status:** Ready for Code Generation

   ## What This Project Is
   A mobile app (iOS/Android) and web dashboard for freelancers to track billable time,
   generate invoices, and manage client relationships. MVP focuses on core time tracking
   and invoice generation.

   ## Read Documents in This Order

   1. **constitution.md** (5 min read)
      - Project guiding principles
      - Non-negotiable values

   2. **project-brief.md** (5 min read)
      - Vision and objectives
      - Target audience
      - Key features at a glance

   3. **personas.md** (10 min read)
      - User personas (3-5 profiles)
      - Pain points and goals
      - Usage patterns

   4. **PRD.md** (20 min read)
      - Detailed product requirements
      - Functional & non-functional requirements
      - User stories with acceptance criteria
      - Epics breakdown
      - MVP vs Phase 2 features (marked clearly)

   5. **data-model.md** (10 min read)
      - Database schema
      - Tables, columns, relationships
      - Key constraints

   6. **api-spec.json** (reference)
      - OpenAPI specification
      - All endpoints, methods, payloads
      - Used during API implementation

   7. **architecture.md** (15 min read)
      - System design and component overview
      - Tech stack rationale
      - Security & compliance design
      - Scaling strategy
      - Performance considerations

   8. **DEPENDENCIES.md** (10 min read)
      - All required packages
      - Why each dependency was chosen
      - Security and licensing notes

   9. **epics.md** (10 min read)
      - Feature set breakdown
      - Which requirements each epic covers
      - Components and APIs per epic

   10. **tasks.md** (reference during implementation)
       - Detailed task list with execution context
       - Each task references PRD, architecture, data-model
       - Implementation hints and acceptance criteria

   11. **README.md** (2 min read)
       - Quick start guide for developers
       - How to use this project folder
       - Directory structure explanation

   ## Approved Technology Stack

   **Frontend:**
   - Next.js 14 with App Router
   - React 18 with TypeScript
   - Tailwind CSS for styling
   - shadcn/ui for components

   **Mobile:**
   - Expo with React Native
   - Shared TypeScript codebase with web

   **Backend:**
   - Next.js API routes (or tRPC for better type safety)
   - Prisma ORM for database access

   **Database:**
   - PostgreSQL

   **DevOps:**
   - Vercel for frontend/API deployment
   - GitHub Actions for CI/CD

   **See plan.md for full stack rationale and trade-offs.**

   ## Key Requirements (MVP)

   - [ ] User registration & login (secure JWT-based auth)
   - [ ] Start/stop timer interface (mobile + web)
   - [ ] Time entry list and editing
   - [ ] Project/client management
   - [ ] Invoice PDF generation
   - [ ] Offline support (sync when online)
   - [ ] Export to CSV/PDF

   Phase 2 (not in MVP):
   - AI-assisted invoice draft
   - Advanced reporting
   - Team collaboration features

   ## Security Baseline (All Projects Follow)

   ✅ **Authentication:** JWT tokens, 1-hour expiry, bcrypt password hashing
   ✅ **Data Protection:** HTTPS only, AES-256 encryption at rest
   ✅ **Scanning:** npm audit + pip-audit with zero HIGH/CRITICAL vulns
   ✅ **Logging:** Audit logs for auth events, no PII logged
   ✅ **Compliance:** GDPR-ready, data retention policies

   See architecture.md § Security & Compliance for details.

   ## Dependencies

   - **Frontend/Mobile:** Next.js, React, Tailwind, shadcn/ui, Prisma, + testing tools
   - **Database:** PostgreSQL via Prisma
   - **Locked manifests:** pnpm-lock.yaml (node), requirements.txt (Python if hybrid)

   See DEPENDENCIES.md for full justification and version constraints.

   ---

   ## LLM Code Generation Prompt

   **Copy the text below and paste into your IDE's LLM (Claude, ChatGPT, Gemini, etc.):**

   ```
   You are a senior full-stack engineer implementing a production project.

   ## Project Context

   You are implementing: Freelancer Time Tracking App

   This is a mobile app (iOS/Android via Expo) and web dashboard for freelancers to:
   - Track billable time by project/client
   - Generate invoices automatically
   - Manage client relationships
   - Export reports and invoices

   The project must be production-ready, secure, and maintainable.

   ## Your Task

   Implement the project following these documents (read in order):

   1. constitution.md - Project guiding principles
   2. project-brief.md - Vision and context
   3. personas.md - User types and needs
   4. PRD.md - Complete requirements (including MVP vs Phase 2)
   5. data-model.md - Database schema
   6. api-spec.json - API contracts (if generating backend)
   7. architecture.md - System design
   8. DEPENDENCIES.md - Approved packages and why
   9. epics.md - Feature breakdown
   10. tasks.md - Implementation sequence with acceptance criteria

   ## Key Constraints

   - **Stack:** Next.js 14 (App Router), React 18, TypeScript, Expo, Prisma, PostgreSQL
   - **Security:** Follow the security baseline in architecture.md
   - **MVP Focus:** Only implement Phase 1 features (marked in PRD.md)
   - **Quality:** All code must pass tests and meet acceptance criteria in tasks.md
   - **Dependencies:** Use ONLY packages listed in DEPENDENCIES.md
   - **API Design:** Match api-spec.json exactly

   ## Implementation Steps

   1. **Setup:** Create Next.js + Expo project structure
   2. **Database:** Set up Prisma schema matching data-model.md
   3. **Backend APIs:** Implement endpoints from api-spec.json
   4. **Frontend:** Implement screens and components per tasks.md
   5. **Mobile:** Mirror web functionality in Expo
   6. **Testing:** Write tests matching acceptance criteria
   7. **Documentation:** Keep implementation notes aligned with architecture.md

   ## Quality Standards

   - Zero TypeScript errors or warnings
   - All tests passing (vitest + Playwright)
   - No HIGH/CRITICAL security vulnerabilities
   - Code follows project conventions from architecture.md
   - Each task's acceptance criteria met exactly

   Good luck! You have a complete spec. Build excellent software. 🚀
   ```

   ---

   ## What's Included in This ZIP

   ```
   freelancer-time-tracker/
   ├── constitution.md              ← Project guiding principles
   ├── project-brief.md             ← Vision & objectives
   ├── personas.md                  ← User personas
   ├── README.md                    ← Quick start for this folder
   ├── HANDOFF.md                   ← This file (your guide)
   │
   ├── specs/
   │   ├── PRD.md                   ← Complete product requirements
   │   ├── data-model.md            ← Database schema
   │   ├── api-spec.json            ← OpenAPI specification
   │   ├── architecture.md          ← System design
   │   ├── epics.md                 ← Feature breakdown
   │   ├── tasks.md                 ← Detailed task list
   │   ├── plan.md                  ← Project plan & approved stack
   │   └── DEPENDENCIES.md          ← Package choices & rationale
   │
   ├── .ai-config/
   │   ├── analyst_prompt.md        ← Analyst role guidelines (reference)
   │   ├── pm_prompt.md             ← PM role guidelines (reference)
   │   ├── architect_prompt.md      ← Architect role guidelines (reference)
   │   └── validators.yml           ← Validation rules used (reference)
   │
   └── docs/
       ├── security-baseline.md     ← Security requirements & implementation
       └── DEPS_NOTES.md            ← Dependency policy notes & overrides
   ```

   ## Next Steps

   1. **Unzip this folder** to your local machine
   2. **Read HANDOFF.md** (this file) top to bottom
   3. **Read the documents in order** (constitution → PRD → architecture → tasks)
   4. **Copy the LLM Prompt** (section above) into your IDE's AI assistant
   5. **Paste the project folder** path into your IDE/LLM context
   6. **Generate code** following the prompt and watching for any clarifications
   7. **Iterate** - If anything in the spec needs adjustment, update the markdown docs and regenerate code sections

   ## Questions?

   Each document is self-contained with full context. If something is unclear:
   - Check the cross-references in the document
   - Review the acceptance criteria in tasks.md
   - Consult architecture.md for design reasoning

   The entire project is documented. No guessing needed. Good luck! 🎯
   ```

2. **ZIP Archive Creation:**
   - Collect all spec files
   - Include HANDOFF.md
   - Include .ai-config/ (role prompts, validators)
   - Include docs/ (security baseline, dependency notes)
   - Create README.md at root (overview of project structure)
   - Zip everything with project slug as filename: `{project-slug}.zip`

3. **Metadata Finalization:**
   - Update `metadata.json`:
     ```json
     {
       "project_id": "uuid",
       "project_slug": "freelancer-time-tracker",
       "project_name": "Freelancer Time Tracking App",
       "current_phase": "DONE",
       "phases_completed": ["ANALYSIS", "STACK_SELECTION", "SPEC", "DEPENDENCIES", "SOLUTIONING"],
       "stack_choice": "nextjs_only_expo",
       "stack_approved": true,
       "dependencies_approved": true,
       "created_at": "2025-11-14T10:30:00Z",
       "last_updated": "2025-11-14T11:45:00Z",
       "artifact_versions": {
         "ANALYSIS": 1,
         "STACK_SELECTION": 1,
         "SPEC": 1,
         "DEPENDENCIES": 1,
         "SOLUTIONING": 1
       },
       "zip_ready": true,
       "download_url": "/api/projects/{slug}/download"
     }
     ```

4. **Frontend Completion Screen:**
   - Show "Project Complete! Ready for Download"
   - Display all artifacts generated
   - Show stack and dependencies approved
   - Provide download button
   - Option to review any artifact
   - Copy HANDOFF.md prompt to clipboard

**Validation:**
- All previous phases complete
- HANDOFF.md generated and valid
- ZIP archive created successfully
- All required files present in ZIP

**Next:** End of workflow

---

## Multi-Agent Roles & Responsibilities

### 1. Analyst Agent (Product Strategist)

**Role Description:**
The Analyst is the "CEO/CPO" perspective. They ask clarifying questions to deeply understand the project vision, market context, and user needs.

**Primary Responsibility:** Phase 1 (ANALYSIS)

**Outputs:**
- `constitution.md` - Project guiding principles, non-negotiable values, core mission
- `project-brief.md` - High-level vision, target market, competitive analysis, key objectives
- `personas.md` - Detailed user personas (3-5 profiles with motivations, pain points, goals)

**Key Questions Asked:**
- Who are your primary users? (Detailed demographics)
- What problem does this solve? (Pain point analysis)
- Who are your competitors? (Competitive landscape)
- What makes your solution different? (Unique value proposition)
- What success looks like? (KPIs and goals)
- Are there regulatory or compliance requirements? (Industry constraints)
- What's your timeline and budget? (Resource constraints)

**Prompt Template:**
```
You are a Business Analyst and Product Strategist (CEO/CPO perspective).
Your goal is to deeply understand the user's project vision.

Ask targeted questions to clarify:
1. Target market and user personas
2. Problem and solution fit
3. Competitive landscape
4. Key features and MVP scope
5. Success criteria and constraints

After Q&A, generate three markdown files:
- constitution.md (project guiding principles)
- project-brief.md (vision, market, objectives)
- personas.md (3-5 detailed user profiles)

Each file must have front-matter: title, owner, version, date, status.
```

---

### 2. Product Manager Agent (PM)

**Role Description:**
The PM is the "CPO" who converts vision into concrete specifications. They document requirements comprehensively and prioritize features.

**Primary Responsibility:** Phase 3 (SPEC - specifications)

**Outputs:**
- `PRD.md` - Complete Product Requirements Document
  - Functional requirements (numbered, linked to features)
  - Non-functional requirements (performance, security, UX)
  - User stories with acceptance criteria
  - Epics and feature breakdown
  - MVP vs Phase 2 marking
- Contributes to review gates and refinement loops

**Key Decisions:**
- Which features are MVP vs Phase 2?
- How are requirements prioritized?
- What are the acceptance criteria for each feature?
- How do user stories map to requirements?

**Prompt Template:**
```
You are a Product Manager (CPO perspective).
Your task: Create a detailed Product Requirements Document (PRD).

Input: project-brief.md, personas.md

Generate PRD.md with sections:
1. Executive Summary
2. Functional Requirements (numbered REQ-XXX-YYY format)
3. Non-Functional Requirements (performance, security, UX, scalability)
4. Use Cases and User Flows
5. Epics (feature sets) with IDs
6. User Stories per Epic with acceptance criteria
7. MVP Features (marked Phase 1) vs Phase 2 Features
8. Success Criteria and KPIs

Each requirement must:
- Have a unique ID (REQ-FEATURE-001)
- Be linked to one or more personas
- Have clear acceptance criteria
- Be either MVP or Phase 2

Front-matter: title, owner, version, date, status.
```

---

### 3. Architect Agent (Chief Architect / CTO)

**Role Description:**
The Architect is the "CTO" who designs the system and makes technology choices. They ensure the solution is technically sound, scalable, and uses appropriate technologies.

**Primary Responsibility:** Phase 2 (STACK_SELECTION - proposal), Phase 3 (SPEC - data model & API), Phase 5 (SOLUTIONING - full architecture)

**Outputs:**
- `stack-proposal.md` - Two stack options with trade-offs (Phase 2)
- `data-model.md` - Database schema and data structures (Phase 3)
- `api-spec.json` - OpenAPI specification (Phase 3)
- `architecture.md` - Complete system architecture (Phase 5)
  - Tech stack details (frontend, backend, mobile, infra)
  - Component architecture
  - Database design deep dive
  - API design patterns
  - Security architecture
  - Performance and scaling strategy

**Key Decisions:**
- Which technology stack fits the project?
- How should the system be architected?
- What database schema and relationships?
- How should APIs be designed?
- How to ensure security and scalability?

**Prompt Template:**
```
You are a Chief Architect (CTO perspective).
Your task: Design the system architecture and technology choices.

For Stack Selection Phase:
- Propose two stacks (Option A, Option B)
- Explain composition, use-cases, strengths, trade-offs
- Consider the project brief and requirements

For Specification Phase:
- Design database schema (tables, columns, relationships)
- Create OpenAPI spec (endpoints, methods, payloads)
- Ensure alignment with PRD requirements

For Solutioning Phase:
- Create comprehensive architecture.md
- Include tech stack details, component design, security, performance
- Reference PRD and data-model in your design
- Provide implementation hints and patterns

All outputs must be technically sound and production-ready.
```

---

### 4. Scrum Master Agent (Project Manager)

**Role Description:**
The Scrum Master is the "VP Engineering" who breaks work into tasks, plans execution, and ensures nothing falls through the cracks.

**Primary Responsibility:** Phase 5 (SOLUTIONING - task breakdown)

**Outputs:**
- `epics.md` - Epic breakdown of features from PRD
  - Maps each epic to requirements
  - Lists components and APIs per epic
  - Defines user stories per epic

- `tasks.md` - Detailed task list with execution context
  - Each task with requirement references
  - Architecture component references
  - Acceptance criteria
  - Dependencies and complexity
  - MVP vs Phase 2 marking
  - Implementation hints

**Key Decisions:**
- How should requirements be broken into tasks?
- What's the execution order?
- Which tasks can run in parallel?
- What's the complexity of each task?
- What are hard dependencies?

**Prompt Template:**
```
You are a Scrum Master and Project Manager (VP Engineering perspective).
Your task: Break requirements into executable tasks.

Input: PRD.md, architecture.md, data-model.md, api-spec.json

Generate:
1. epics.md - Map each epic from PRD with requirements, user stories, components, APIs
2. tasks.md - Detailed task list with:
   - Unique ID and title
   - Requirement(s) it fulfills (link to PRD REQ-XXX-YYY)
   - Epic it belongs to
   - User story
   - Acceptance criteria
   - Architecture reference (which component)
   - Implementation hints (tech guidance, not code)
   - Dependencies (what must be done first)
   - Complexity (Small/Medium/Large)
   - Priority (MVP or Phase 2)

Tasks must be:
- Sequentially ordered with dependencies clear
- Self-contained (one task = one feature or logical unit)
- Implementable in 4-8 hours
- Testable with clear acceptance criteria

Front-matter: title, owner, version, date, status.
```

---

### 5. DevOps Agent (Infrastructure & Reliability)

**Role Description:**
The DevOps Engineer ensures the project is deployment-ready, secure, and follows policy guidelines.

**Primary Responsibility:** Phase 4 (DEPENDENCIES)

**Outputs:**
- `DEPENDENCIES.md` - Comprehensive dependency proposal
  - Lists all packages with justification
  - Security and licensing notes
  - Version constraints and rationale
- `dependency-proposal.md` - Structured version for policy checks
- Policy validation scripts execution results

**Key Decisions:**
- Which packages are necessary?
- What version constraints are safe?
- Are there licensing concerns?
- Are all dependencies within security policy?
- Are there deprecated or outdated packages?

**Prompt Template:**
```
You are a DevOps Engineer (Infrastructure & SRE perspective).
Your task: Define all dependencies for the approved stack.

Input: PRD.md, approved stack choice

For Next.js-Only + Expo Stack:
Generate DEPENDENCIES.md listing:
- Frontend: Next.js, React, TypeScript, Tailwind, UI library, state mgmt, HTTP client
- Mobile: Expo, React Native, shared code
- Backend: API framework (tRPC, Hono, or Next.js routes), ORM
- Database: PostgreSQL driver
- Testing: Unit test framework, E2E testing
- Dev tools: Linting, formatting, git hooks, type checking
- Security: Audit tools, scanning

For Hybrid Stack (add):
- Backend: FastAPI, Pydantic, Uvicorn, SQLAlchemy, etc.
- Python testing, linting, scanning tools

For each dependency:
- Explain WHY it was chosen
- Note security considerations
- Check licensing (MIT, Apache 2.0, etc.)
- Note any version constraints and why
- Mention any known deprecations or issues

Format as readable markdown with rationale.
Include policy notes: no deprecated, no outdated, zero HIGH/CRITICAL vulns.
```

---

## Core Components

### 1. Orchestrator Service (`backend/services/orchestrator/`)

**Purpose:** Central orchestration engine that manages phase state, validates gates, and coordinates artifacts.

**Files:**
- `main.py` - API routes for orchestration
- `orchestrator_engine.py` - Core state machine and gate validation
- `config_loader.py` - Load and manage orchestrator_spec.yml
- `validators.py` - Artifact validators (markdown_frontmatter, api_openapi, tasks_dag, presence)
- `stack_selector.py` - Stack proposal generation and decision stamping
- `dependencies.py` - Dependency proposal and policy checking
- `artifact_manager.py` - Track and manage artifact versions
- `tests/` - Unit tests for orchestrator logic

**Key Functions:**

```python
class OrchestratorEngine:
    def validate_phase_completion() → bool
    def can_advance_to_phase(current_phase, next_phase) → bool
    def advance_phase(project_id, next_phase) → bool
    def run_phase_agent(project_id, phase) → str (artifact path)
    def validate_artifacts(project_id, phase) → ValidationResult
    def get_phase_artifacts(project_id, phase) → List[str]
    def get_artifact_content(project_id, artifact_name) → str
    def rollback_phase(project_id) → bool

class StackSelector:
    def generate_stack_proposal(project_brief, personas) → str
    def approve_stack(project_id, choice, reasoning) → bool
    def stamp_stack_decision(project_id, plan_md, readme_md) → bool

class DependencyManager:
    def generate_dependency_proposal(prd, approved_stack) → str
    def validate_dependencies(project_id) → ValidationResult
    def run_dependency_scripts(project_id, stack_choice) → bool
```

---

### 2. LLM Service (`backend/services/llm/`)

**Purpose:** Agent-agnostic LLM wrapper that executes phase agents and produces artifacts.

**Files:**
- `main.py` - API routes for LLM operations
- `llm_client.py` - Abstract LLM client (Gemini wrapper)
- `prompt_templates.py` - Prompts for each agent and phase
- `agent_executors.py` - Execute each agent (Analyst, PM, Architect, etc.)
- `response_parser.py` - Parse LLM responses and extract artifacts
- `tests/` - Unit tests for LLM integration

**Key Classes:**

```python
class GeminiClient:
    def generate_completion(prompt: str, context: List[str]) → str
    def generate_with_context(prompt: str, artifacts: Dict[str, str]) → str

class AgentExecutor:
    def run_analyst_agent(project_idea: str) → AnalystOutput
    def run_pm_agent(brief: str, personas: str) → PMOutput
    def run_architect_agent(brief: str, prd: str) → ArchitectOutput
    def run_scrummaster_agent(prd: str, architecture: str) → ScrummasterOutput
    def run_devops_agent(prd: str, stack: str) → DevOpsOutput

class PromptManager:
    def get_analyst_prompt() → str
    def get_pm_prompt(brief: str, personas: str) → str
    def get_architect_prompt(prd: str, personas: str) → str
    # ... etc for each agent
```

---

### 3. File System Service (`backend/services/file_system/`)

**Purpose:** Manage project directory structure and artifact storage.

**Files:**
- `project_storage.py` - Create and manage project directories
- `artifact_writer.py` - Write markdown and JSON files
- `archiver.py` - Create ZIP archives
- `path_resolver.py` - Resolve project paths safely

**Key Functions:**

```python
class ProjectStorage:
    def create_project_directory(project_slug) → str (path)
    def get_project_path(project_slug) → str
    def create_phase_directory(project_slug, phase) → str
    def write_artifact(project_slug, phase, artifact_name, content) → bool
    def read_artifact(project_slug, phase, artifact_name) → str
    def list_artifacts(project_slug, phase) → List[str]

class Archiver:
    def create_project_zip(project_slug) → bytes
    def add_readme_and_config(zip_buffer) → bytes
    def create_handoff_prompt(project_slug) → str
```

---

### 4. Projects Service (Enhanced) (`backend/services/projects/`)

**Purpose:** Project CRUD with orchestration state tracking.

**Updates:**
- Add `stack_choice: Optional[str]` field
- Add `stack_approved: bool = False` field
- Add `dependencies_approved: bool = False` field
- Add `orchestration_state: Optional[dict]` field
- Add phase-specific metadata

**New Endpoints:**
- `POST /projects/{slug}/phase/advance` - Advance to next phase with validation
- `POST /projects/{slug}/stack/approve` - Approve stack selection
- `GET /projects/{slug}/stack/proposal` - Get stack proposal
- `POST /projects/{slug}/dependencies/approve` - Approve dependencies
- `GET /projects/{slug}/dependencies/proposal` - Get dependency proposal
- `GET /projects/{slug}/artifacts/{artifact_name}` - Get specific artifact
- `GET /projects/{slug}/download` - Download ZIP
- `POST /projects/{slug}/rollback` - Rollback last phase

---

## Key Features & Enhancements

### 1. Auto-Generated HANDOFF.md

**What:** Master document that bridges specs to code generation.

**Content:**
- Project context and vision summary
- Document reading order with time estimates
- Approved tech stack summary
- Key requirements and MVP definition
- Security baseline checklist
- Dependencies overview
- **Ready-to-copy LLM prompt** for code generation
- Complete file listing and directory structure

**Generated in:** DONE phase
**Used by:** User's IDE + LLM for code generation

**Benefits:**
- Users don't have to craft prompts manually
- LLM has clear, structured context
- Reduces context confusion and errors
- Makes handoff reproducible and testable

---

### 2. Dependency Justification Document

**What:** Detailed explanation of why each dependency was chosen.

**Content per Package:**
- Package name and version
- Purpose and what it does
- Why it was chosen (alternatives considered?)
- Security considerations (vulnerabilities, updates)
- License type
- Any version constraints and rationale
- Deprecation status

**Benefits:**
- Users understand technology choices
- LLM respects and maintains chosen dependencies
- Security concerns documented
- Helps with future maintenance and upgrades

---

### 3. Execution Context in Tasks

**What:** Each task is self-contained with full implementation context.

**Includes:**
- Requirement reference (which PRD req #)
- Architecture component (which part of system)
- User story and acceptance criteria
- Implementation hints (tech guidance, patterns)
- Dependencies (what tasks must run first)
- Complexity and priority
- Test expectations

**Benefits:**
- Developers/LLMs can implement one task in isolation
- No context switching needed
- Acceptance criteria are explicit and testable
- Task dependencies prevent mistakes

---

### 4. Artifact Dependency Mapping

**What:** Explicit declaration of which documents depend on which.

**Stored in:** orchestrator_spec.yml

**Example:**
```yaml
phases:
  ANALYSIS:
    outputs: [constitution.md, project-brief.md, personas.md]
    next_phase: STACK_SELECTION

  STACK_SELECTION:
    outputs: [plan.md, README.md]
    depends_on: [ANALYSIS outputs]
    gates: [stack_approved]

  SPEC:
    outputs: [PRD.md, data-model.md, api-spec.json]
    depends_on: [ANALYSIS outputs, approved stack]
```

**Benefits:**
- Prevents using specs out of order
- Enables intelligent rollback
- Clear dependency graph for automation

---

### 5. Review Checkpoints (Non-Blocking)

**What:** Optional review gates after major phases (ANALYSIS, SPEC, SOLUTIONING).

**User Options:**
- Proceed to next phase
- Review documents
- Ask LLM to refine (regenerate phase)
- Manually edit documents

**Benefits:**
- Quality control without blocking flow
- Catch misalignment early
- Support iterative refinement
- Users maintain full control

---

### 6. Custom Stack Support

**What:** Users can choose Option A, Option B, or Custom.

**For Custom:**
- User provides stack description (frontend, backend, db, tools)
- System respects custom choice
- Generates dependency list for custom stack
- Full orchestration continues normally

**Benefits:**
- No user locked out by predefined options
- System remains flexible and adaptable
- Structure maintained even with custom choices

---

### 7. Phase Versioning & Rollback

**What:** Artifact versioning with history.

**Storage:**
```
/projects/{slug}/specs/
  ├── ANALYSIS/
  │   ├── v1/ (initial generation)
  │   │   ├── constitution.md
  │   │   ├── project-brief.md
  │   │   └── personas.md
  │   └── v2/ (after refinement)
  │       ├── constitution.md
  │       ├── project-brief.md
  │       └── personas.md
  ├── SPEC/
  │   ├── v1/
  │   └── v2/ (regenerated after PRD edit)
  # ... etc for each phase
```

**User Actions:**
- Compare versions
- Rollback to previous version
- Keep audit trail of spec evolution

**Benefits:**
- Safe experimentation
- Change tracking
- Ability to undo mistakes
- Complete spec history

---

### 8. Security Baseline Integration

**What:** Standard security requirements embedded in all specs.

**Defined in:** orchestrator_spec.yml

**Example:**
```yaml
security_baseline:
  authentication:
    - All passwords hashed with bcrypt (cost 10+)
    - JWT tokens with 1-hour expiry
    - HTTPS only (no HTTP)

  data_protection:
    - Sensitive data encrypted at rest (AES-256)
    - TLS 1.2+ for transit

  compliance:
    - GDPR-ready user data handling
    - Audit logs for sensitive operations
    - PII never in logs

  scanning:
    - npm audit (zero HIGH/CRITICAL)
    - pip-audit (zero HIGH/CRITICAL)
    - SAST scanning (SonarQube or Snyk)

  testing:
    - Unit test coverage >80%
    - E2E tests for critical flows
    - Security-focused test cases
```

**Referenced in:** architecture.md automatically
**Checked by:** LLM during code generation

**Benefits:**
- Security not an afterthought
- Consistent across all projects
- Easy to audit and verify
- Compliance-ready from start

---

### 9. Priority/MVP Mapping

**What:** Features tagged as MVP vs Phase 2 vs Future.

**In PRD:**
```markdown
## Functional Requirements

### Phase 1 (MVP) - Must Have
- REQ-AUTH-001: User registration
- REQ-CRUD-001: Create resource

### Phase 2 - Should Have
- REQ-EXPORT-001: Export to PDF
- REQ-REPORT-001: Advanced reporting

### Phase 3+ - Nice to Have
- REQ-AI-001: AI recommendations
```

**In tasks.md:**
```markdown
## Task 1.1: User Auth Backend

**Priority:** MVP (Phase 1)
**Acceptance Criteria:**
- Users can register and log in
- Sessions expire after 1 hour
...
```

**Benefits:**
- Clear scope definition
- Prevents scope creep
- Incremental implementation possible
- Users can plan in phases

---

## Project Folder Structure

### On-Disk Storage (`/projects/{slug}/`)

```
/projects/freelancer-time-tracker/
│
├── metadata.json                          # Project state & phase info
│
├── specs/                                 # All specification artifacts
│   ├── ANALYSIS/
│   │   └── v1/
│   │       ├── constitution.md
│   │       ├── project-brief.md
│   │       └── personas.md
│   │
│   ├── STACK_SELECTION/
│   │   └── v1/
│   │       ├── plan.md
│   │       ├── README.md
│   │       └── stack-proposal.md (tmp)
│   │
│   ├── SPEC/
│   │   └── v1/
│   │       ├── PRD.md
│   │       ├── data-model.md
│   │       └── api-spec.json
│   │
│   ├── DEPENDENCIES/
│   │   └── v1/
│   │       ├── DEPENDENCIES.md
│   │       ├── dependency-proposal.md
│   │       ├── requirements.txt (Python)
│   │       └── pnpm-lock.yaml (Node)
│   │
│   └── SOLUTIONING/
│       └── v1/
│           ├── architecture.md
│           ├── epics.md
│           └── tasks.md
│
├── .ai-config/                            # Agent prompts & config (reference)
│   ├── analyst_prompt.md
│   ├── pm_prompt.md
│   ├── architect_prompt.md
│   ├── scrummaster_prompt.md
│   ├── devops_prompt.md
│   └── validators.yml
│
└── docs/                                  # Documentation
    ├── security-baseline.md
    └── DEPS_NOTES.md
```

### ZIP Download Structure (What User Gets)

```
freelancer-time-tracker/
│
├── constitution.md
├── project-brief.md
├── personas.md
├── README.md
├── HANDOFF.md                             ← Master document for LLM
│
├── specs/
│   ├── PRD.md
│   ├── data-model.md
│   ├── api-spec.json
│   ├── architecture.md
│   ├── epics.md
│   ├── tasks.md
│   ├── plan.md
│   └── DEPENDENCIES.md
│
├── .ai-config/
│   ├── analyst_prompt.md
│   ├── pm_prompt.md
│   ├── architect_prompt.md
│   ├── scrummaster_prompt.md
│   ├── devops_prompt.md
│   └── validators.yml
│
└── docs/
    ├── security-baseline.md
    └── DEPS_NOTES.md
```

---

## API Specification

### New Orchestration Endpoints

#### Phase Management

**GET /api/projects/{slug}/phase**
```
Get current phase status
Response: {
  "current_phase": "SPEC",
  "phases_completed": ["ANALYSIS", "STACK_SELECTION"],
  "can_advance": true,
  "blocking_issues": []
}
```

**POST /api/projects/{slug}/phase/advance**
```
Attempt to advance to next phase
Request: { "confirm": true }
Response: {
  "success": true,
  "new_phase": "DEPENDENCIES",
  "message": "Advanced to DEPENDENCIES phase"
}
OR
{
  "success": false,
  "message": "Cannot advance: stack not approved",
  "blocking_gates": ["stack_approved == false"]
}
```

**POST /api/projects/{slug}/phase/run-agent**
```
Run agent for current phase manually
Response: {
  "status": "running",
  "phase": "SPEC",
  "message": "PM Agent is generating PRD..."
}
```

#### Stack Selection

**GET /api/projects/{slug}/stack/proposal**
```
Get stack selection proposal
Response: {
  "stack_proposal_md": "# Stack Proposal\n\n## Option A...",
  "options": [
    {
      "id": "nextjs_only_expo",
      "name": "Next.js-Only + Expo",
      "description": "..."
    },
    {
      "id": "hybrid_nextjs_fastapi_expo",
      "name": "Hybrid Next.js + FastAPI + Expo",
      "description": "..."
    }
  ]
}
```

**POST /api/projects/{slug}/stack/approve**
```
Approve a stack choice
Request: {
  "choice": "nextjs_only_expo",
  "reasoning": "Fast iteration, single language",
  "tradeoffs": "Less suitable for heavy compute"
}
Response: {
  "success": true,
  "stack_choice": "nextjs_only_expo",
  "stack_approved": true,
  "plan_updated": true,
  "readme_updated": true
}
```

#### Dependencies

**GET /api/projects/{slug}/dependencies/proposal**
```
Get dependency proposal
Response: {
  "dependencies_md": "# Dependencies\n\n## Frontend...",
  "summary": {
    "node_packages": 45,
    "python_packages": 12,
    "security_issues": 0
  }
}
```

**POST /api/projects/{slug}/dependencies/approve**
```
Approve dependencies and run policy scripts
Request: { "confirm": true }
Response: {
  "success": true,
  "dependencies_approved": true,
  "policy_check": {
    "npm_audit": "pass",
    "pip_audit": "pass",
    "no_deprecated": true,
    "no_outdated": true
  },
  "lockfiles_generated": true
}
```

#### Artifacts

**GET /api/projects/{slug}/artifacts**
```
List all artifacts for project
Response: {
  "artifacts": [
    {
      "phase": "ANALYSIS",
      "name": "constitution.md",
      "version": 1,
      "size": 2048,
      "created_at": "2025-11-14T10:30:00Z"
    },
    ...
  ]
}
```

**GET /api/projects/{slug}/artifacts/{artifact_name}**
```
Get specific artifact content
Response: {
  "name": "PRD.md",
  "phase": "SPEC",
  "version": 1,
  "content": "# Product Requirements Document\n\n...",
  "frontmatter": {
    "title": "Product Requirements for ...",
    "owner": "PM Agent",
    "version": "1.0",
    "date": "2025-11-14"
  }
}
```

**POST /api/projects/{slug}/artifacts/validate**
```
Validate all artifacts for current phase
Response: {
  "phase": "SPEC",
  "validation": {
    "PRD.md": {
      "status": "pass",
      "checks": {
        "has_frontmatter": true,
        "has_requirements": true,
        "has_acceptance_criteria": true
      }
    },
    "data-model.md": {
      "status": "pass",
      "checks": {...}
    },
    "api-spec.json": {
      "status": "warn",
      "message": "Missing authentication definitions"
    }
  },
  "overall": "pass"
}
```

#### Download & Handoff

**GET /api/projects/{slug}/handoff-prompt**
```
Get the auto-generated handoff prompt
Response: {
  "prompt": "You are a senior full-stack engineer...",
  "ready_to_copy": true
}
```

**GET /api/projects/{slug}/download**
```
Download project ZIP
Response: Binary ZIP file
Content-Type: application/zip
Content-Disposition: attachment; filename="freelancer-time-tracker.zip"
```

**POST /api/projects/{slug}/rollback**
```
Rollback to previous phase or version
Request: { "target_phase": "SOLUTIONING", "version": 1 }
Response: {
  "success": true,
  "current_phase": "SOLUTIONING",
  "message": "Rolled back to SOLUTIONING v1"
}
```

#### Status & Health

**GET /api/orchestrator/spec**
```
Get orchestrator specification (YAML as JSON)
Response: {
  "phases": [...],
  "stacks": [...],
  "agents": [...],
  "validators": [...],
  "security_baseline": {...}
}
```

---

## Data Models

### Updated Project Model

```python
class Project(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str
    description: str

    # User Reference
    created_by_id: UUID = Field(foreign_key="user.id")

    # Orchestration State
    current_phase: str = Field(default="ANALYSIS")  # ANALYSIS, STACK_SELECTION, SPEC, DEPENDENCIES, SOLUTIONING, DONE
    phases_completed: List[str] = Field(default_factory=list)

    # Stack Selection
    stack_choice: Optional[str] = None  # nextjs_only_expo, hybrid_nextjs_fastapi_expo, or custom
    stack_approved: bool = False
    stack_approval_date: Optional[datetime] = None

    # Dependencies
    dependencies_approved: bool = False
    dependencies_approval_date: Optional[datetime] = None

    # Artifact Tracking
    orchestration_state: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    # {
    #   "artifact_versions": {
    #     "ANALYSIS": 1,
    #     "STACK_SELECTION": 1,
    #     ...
    #   },
    #   "validation_results": {...},
    #   "approval_gates": {
    #     "stack_approved": true,
    #     "dependencies_approved": true
    #   }
    # }

    # Metadata
    project_path: str  # File system path: /projects/{slug}/
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    specifications: List["Specification"] = Relationship(back_populates="project")
    phase_history: List["PhaseHistory"] = Relationship(back_populates="project")
```

### PhaseHistory (Enhanced)

```python
class PhaseHistory(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id")
    from_phase: str
    to_phase: str

    # Artifact Tracking
    artifacts_generated: List[str] = Field(default_factory=list)
    validation_passed: bool
    validation_errors: Optional[List[str]] = None

    # Gate Information
    gate_name: Optional[str] = None  # "stack_approval", "dependencies_approval", None
    gate_passed: Optional[bool] = None
    gate_notes: Optional[str] = None

    # Metadata
    transitioned_by: UUID = Field(foreign_key="user.id")
    transition_date: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None

    # Relationships
    project: "Project" = Relationship(back_populates="phase_history")
```

### Artifact Model (New)

```python
class ProjectArtifact(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id")

    phase: str  # ANALYSIS, STACK_SELECTION, etc.
    artifact_name: str  # constitution.md, PRD.md, etc.
    version: int = Field(default=1)

    # Content & Metadata
    file_path: str  # /projects/{slug}/specs/ANALYSIS/v1/constitution.md
    file_size: int
    content_hash: str  # SHA256 for content verification

    # Frontmatter (if markdown)
    frontmatter: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    # { "title": "...", "owner": "...", "version": "1.0", "date": "..." }

    # Validation
    validation_status: str = "pending"  # pending, pass, warn, fail
    validation_errors: Optional[List[str]] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

---

## Implementation Roadmap

### MVP Scope (Week 1-4)

**Week 1: Foundation**
- [ ] Create orchestrator_spec.yml with all phases, artifacts, stacks
- [ ] Build Orchestrator Service core (phase machine, validators)
- [ ] Implement stack selection workflow (proposal + approval)
- [ ] Update Project model with stack fields
- [ ] Create basic frontend phase stepper

**Week 2: LLM & Spec Generation**
- [ ] Create LLM Service wrapper for Gemini
- [ ] Implement Analyst Agent (ANALYSIS phase)
- [ ] Implement PM Agent (SPEC phase)
- [ ] Implement Architect Agent (stack proposal, architecture)
- [ ] Wire frontend to show stack approval UI

**Week 3: Dependencies & Solutioning**
- [ ] Implement DependencyManager (proposal + policy checks)
- [ ] Implement Scrum Master Agent (tasks breakdown)
- [ ] Create policy validation scripts (npm audit, pip-audit)
- [ ] Frontend: Dependencies approval UI
- [ ] Frontend: Phase stepper showing all phases

**Week 4: Handoff & Download**
- [ ] Auto-generate HANDOFF.md with prompt
- [ ] Implement ZIP archive creation
- [ ] Create file system service (project storage)
- [ ] Frontend: Download button and confirmation
- [ ] E2E testing of entire workflow

### Phase 2 (Future)

**Partial Re-Generation**
- Allow users to regenerate individual phases
- Validate consistency with previous phases
- Preserve versioning

**Extended Agents**
- Security Agent (detailed security review)
- Compliance Agent (regulatory requirements)
- Marketing Agent (go-to-market strategy)

**Advanced Features**
- Side-by-side document comparison
- Collaborative editing of specs
- Integration with GitHub for automatic repo creation
- Continuous spec refinement and iteration

---

## Technical Decisions

### 1. Why Gemini 2.5 Pro Flash?

- **Speed:** Flash model optimized for rapid responses
- **Cost:** Lower token usage than larger models
- **Capability:** Sufficient for spec generation tasks
- **Flexibility:** Interface abstraction allows easy swapping later

**Decision:** Hardcode Gemini for MVP, abstract interface for future flexibility.

---

### 2. Why Persistent File Storage vs Database?

**Artifacts stored as files because:**
- Markdown files are human-readable and editable
- Version control friendly (can use Git)
- Easy to ZIP and download
- Large files (API specs, architecture) don't fit well in DB
- Users can manually edit specs if needed

**Project metadata stored in DB because:**
- Need to track phase state, approvals, users
- Relationships and queries easier in DB
- Audit trail for compliance

**Decision:** Hybrid approach - files for artifacts, DB for state.

---

### 3. Why No Code Generation in Backend?

**Benefits:**
- **Simpler backend:** No code scaffolding complexity
- **More flexible:** Users choose their LLM and tools
- **LLM-agnostic:** Works with Claude, GPT-4, Gemini, local models
- **True separation:** Spec generation ≠ code generation
- **User control:** Users drive code generation in their IDE

**Trade-off:** Users must manually run code generation in their IDE.

**Mitigation:** HANDOFF.md prompt is ready to copy-paste, making it trivial.

---

### 4. Why Phase Gates?

**Stack Selection Gate:**
- Ensures tech decisions are explicit and documented
- Prevents specifying requirements for wrong tech stack
- Creates approval checkpoint for major decision

**Dependencies Gate:**
- Ensures security policy compliance before proceeding
- Locks in versions before spec generation begins
- Creates audit trail of approved dependencies

**Benefits:**
- Quality assurance at critical points
- Clear decision documentation
- Prevents downstream issues from upstream choices

---

### 5. Why Artifact Versioning?

**Supports iteration:**
- Users can refine specs without losing history
- Rollback if something goes wrong
- Compare versions to see what changed

**Trade-off:**
- Adds complexity to storage
- Need cleanup strategy for old versions (keep last N, auto-delete after 30 days?)

**Decision:** Keep versioning, add cleanup strategy in Phase 2.

---

## Success Criteria

**MVP Launch Success:**
- ✅ User can create project → ANALYSIS phase auto-starts
- ✅ Analyst Agent generates constitution, brief, personas (< 5 min)
- ✅ Stack proposal shown, user approves choice
- ✅ Stack decision stamped into plan.md and README.md
- ✅ PM Agent generates PRD with requirements
- ✅ Architect Agent generates data model and API spec
- ✅ DependencyManager generates dependency proposal
- ✅ User approves dependencies, policy scripts pass
- ✅ Scrum Master generates architecture, epics, tasks
- ✅ HANDOFF.md auto-generated with copy-paste prompt
- ✅ Project ZIP downloadable with all artifacts
- ✅ User downloads ZIP, uploads to IDE, pastes HANDOFF.md prompt into LLM
- ✅ LLM can generate production code from specs

**Quality Standards:**
- All markdown files have front-matter
- PRD has minimum 15 requirements with acceptance criteria
- API spec is valid OpenAPI 3.0
- Task DAG is acyclic with clear dependencies
- Security baseline included in all projects
- MVP/Phase 2 features clearly marked
- Zero HIGH/CRITICAL security vulnerabilities in dependencies

---

## Glossary

- **Artifact:** A generated file (markdown, JSON, etc.) produced by an agent
- **Gate:** A checkpoint that blocks phase progression until condition is met
- **Phase:** A stage in the orchestration (ANALYSIS, STACK_SELECTION, etc.)
- **Agent:** An AI "role" (Analyst, PM, Architect, Scrum Master, DevOps)
- **Orchestrator:** The engine that manages phase state and coordinates agents
- **Handoff:** The process of passing specs to the user's IDE for code generation
- **MVP:** Minimum Viable Product - Phase 1 features that must be in initial release
- **Requirements:** Documented needs, each with a unique ID (REQ-XXX-YYY)
- **Acceptance Criteria:** Specific, testable conditions that define "done"

---

## Appendix: Example Orchestrator Spec

See `backend/app/config/orchestrator_spec.yml` for the complete specification in YAML format. Key sections:

```yaml
# Phases
phases:
  ANALYSIS: { outputs: [...], next_phase: STACK_SELECTION }
  STACK_SELECTION: { outputs: [...], gates: [stack_approved], next_phase: SPEC }
  # ... etc

# Stacks
stacks:
  nextjs_only_expo:
    name: "Next.js-Only + Expo"
    composition: [...]
    best_for: [...]
    strengths: [...]
    tradeoffs: [...]

  hybrid_nextjs_fastapi_expo:
    name: "Hybrid Next.js + FastAPI + Expo"
    composition: [...]
    best_for: [...]
    strengths: [...]
    tradeoffs: [...]

# Agents
agents:
  analyst: { role: "Product Strategist", outputs: [...] }
  pm: { role: "Product Manager", outputs: [...] }
  # ... etc

# Validators
validators:
  markdown_frontmatter: { checks: [title, owner, version, date] }
  api_openapi: { version: "3.0", checks: [endpoints, schemas] }
  tasks_dag: { checks: [acyclic, dependencies_valid] }
  presence: { checks: [file_exists] }

# Security Baseline
security_baseline:
  authentication: [...]
  data_protection: [...]
  compliance: [...]
  scanning: [...]
```

---

## Version 3.0 Enhancements

### New Phase: VALIDATE

A new 7th phase added between SOLUTIONING and DONE that performs automated cross-artifact consistency checks.

**Purpose:** Ensure all artifacts are internally consistent before generating the final handoff.

**Validation Checks (10 total):**

| Check | Category | Description |
|-------|----------|-------------|
| Requirement to Task Mapping | Mapping | Every REQ-XXX in PRD maps to at least one task |
| API to Data Model Mapping | Consistency | All API schemas have corresponding data model entities |
| Persona Consistency | Consistency | All personas referenced in PRD exist in personas.md |
| Stack Consistency | Consistency | Technologies in architecture.md match stack-decision.md |
| Epic to Task Consistency | Mapping | All EPIC-IDs in tasks.md exist in epics.md |
| No Unresolved Clarifications | Completeness | No `[NEEDS CLARIFICATION]` markers remain |
| AI Assumptions Documented | Completeness | All `[AI ASSUMED]` items tracked |
| Design System Compliance | Compliance | Follows design system guidelines |
| Test-First Compliance | Compliance | Tests specified before implementation |
| Constitutional Compliance | Compliance | All 5 Constitutional Articles followed |

**Outputs:** `validation-report.md`, `coverage-matrix.md`

### Hybrid Clarification Mode

New feature in ANALYSIS phase allowing users to choose how to resolve ambiguities:

| Mode | Description |
|------|-------------|
| Interactive | User answers all clarification questions manually |
| Hybrid | User picks which to answer; AI resolves rest with documented assumptions |
| Auto-resolve | AI makes all assumptions and documents them (fastest) |

**Markers:**
- `[NEEDS CLARIFICATION: question]` - Requires user input
- `[AI ASSUMED: assumption - rationale]` - AI-generated assumption

### Constitutional Articles

Five governing principles enforced across all specifications:

1. **Library-First Principle** - Features as reusable modules
2. **Test-First Imperative** - Tests specified before implementation (NON-NEGOTIABLE)
3. **Simplicity Gate** - Max 3 services for MVP
4. **Anti-Abstraction** - Use frameworks directly, justify wrappers
5. **Integration-First Testing** - Real databases over mocks

### Test-First Requirements

SOLUTIONING phase now enforces test-first approach:
- Tasks must list test specifications BEFORE implementation notes
- Gherkin-style acceptance criteria required
- Test order: Contract → Integration → E2E → Unit

### Task Parallelism Markers

Tasks in `tasks.md` now include `[P]` markers to identify tasks that can run concurrently:

```markdown
## Sequential Tasks
- TASK-001: Setup database schema

## Parallel Tasks [P]
- TASK-002: Implement user service [P]
- TASK-003: Implement auth service [P]
- TASK-004: Create UI components [P]
```

### Quality Checklists

Each phase now includes a `quality_checklist` in `orchestrator_spec.yml` for self-verification before advancing.

### Infrastructure Updates

| Component | Change |
|-----------|--------|
| Database | Added clarification_state, clarification_mode, clarification_completed columns |
| Storage | Cloudflare R2 integration for artifact storage |
| API | New routes: `/clarification`, `/clarification/auto-resolve`, `/validate` |
| UI | New components: ClarificationPanel, ValidationResultsPanel |

---

## Document History

| Version | Date       | Author | Changes |
|---------|------------|--------|---------|
| 1.0     | 2025-11-14 | Team   | Initial design document |
| 3.0     | 2025-12-10 | Team   | Added VALIDATE phase, Hybrid Clarification, Constitutional Articles, Test-First, Task Parallelism |

---

## Questions & Contact

For questions about this design, refer to:
- Architecture decisions: See "Technical Decisions" section
- Implementation questions: See "Core Components" section
- API details: See "API Specification" section
- Phase details: See "Phase Workflow" section

**Next Steps:**
1. Review this document with stakeholders
2. Finalize orchestrator_spec.yml
3. Begin Week 1 implementation
4. Iterate based on testing feedback
