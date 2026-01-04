# Spec-Driven Platform

A multi-agent system that guides users through a **7-phase workflow** to generate production-ready project specifications, which are then used as prompts for LLM-based code generation.

**Version 3.1** - Now featuring AI-driven Stack Selection, Hybrid Clarification Mode, Constitutional Articles, and VALIDATE phase.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (with npm)
- **PostgreSQL** database (we use [Neon](https://neon.tech) for serverless hosting)
- **Google Gemini API Key** (for LLM integration)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd spec-driven

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration (database URL, API keys, etc.)

# Set up the database
npm run db:setup

# Start the development server
npm run dev
```

The application will be available at `http://localhost:3001`

## 📋 Core Workflow

The platform guides users through **7 sequential phases**:

```
User Input (project idea)
  ↓ [ANALYSIS] - Analyst generates constitution, brief, personas
  │             ★ NEW: Hybrid Clarification Mode (interactive/auto-resolve/hybrid)
  ↓ [STACK_SELECTION] - AI recommends optimal stack with alternatives (GATE)
  ↓ [SPEC] - PM generates PRD, data model, API spec + design system artifacts
  ↓ [DEPENDENCIES] - AI auto-generates dependencies from approved stack
  ↓ [SOLUTIONING] - Architect & Scrum Master create design, epics, tasks
  │                 ★ NEW: Test-First requirements, Task Parallelism [P] markers
  ↓ [VALIDATE] - ★ NEW: Cross-artifact consistency & compliance checks
  ↓ [DONE] - Auto-generate HANDOFF.md & ZIP for user download
  ↓ User uploads to IDE, pastes HANDOFF.md as LLM prompt for code generation
```

### New in Version 3.0

| Feature                     | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| **Hybrid Clarification**    | Choose to answer questions manually, let AI assume, or mix both |
| **Constitutional Articles** | 5 governing principles enforced across all specs                |
| **VALIDATE Phase**          | Automated consistency checks before handoff                     |
| **Test-First**              | Tests specified before implementation in task breakdown         |
| **Task Parallelism**        | `[P]` markers identify tasks that can run concurrently          |
| **Quality Checklists**      | Self-verification gates for each phase                          |
| **AUTO_REMEDY**             | Automated validation failure fixes with targeted agent re-runs  |
| **Inline Validation**       | Real-time feedback during artifact generation                   |
| **Phase Dependency Graph**  | Smart regeneration and impact analysis                          |

### Hybrid Stack Selection

The platform supports **12+ predefined stack templates** or fully **custom stack definitions**:

| Template                | Use Case                                  |
| ----------------------- | ----------------------------------------- |
| `nextjs_fullstack_expo` | Full-stack web + mobile with shared code  |
| `nextjs_web_only`       | Web-only SaaS applications                |
| `vue_nuxt`              | Vue ecosystem with Nuxt 3                 |
| `svelte_kit`            | Lightweight, performant web apps          |
| `django_htmx`           | Python backend with HTMX interactivity    |
| `go_react`              | High-performance Go API + React frontend  |
| `flutter_firebase`      | Cross-platform mobile with Firebase       |
| ...and more             | See `orchestrator_spec.yml` for full list |

**Custom Mode:** Define your own stack with frontend, backend, database, and deployment layers.

### Constitutional Articles

Five governing principles that are enforced across ALL generated specifications:

| Article | Name                  | Mandate                                                            |
| ------- | --------------------- | ------------------------------------------------------------------ |
| 1       | **Library-First**     | Every feature begins as a reusable module with clear boundaries    |
| 2       | **Test-First**        | No implementation code before tests are specified (NON-NEGOTIABLE) |
| 3       | **Simplicity Gate**   | Maximum 3 services for MVP; justify additional complexity          |
| 4       | **Anti-Abstraction**  | Use framework directly; no unnecessary wrappers                    |
| 5       | **Integration-First** | Prefer real databases over mocks in tests                          |

### Hybrid Clarification Mode (ANALYSIS Phase)

When AI encounters ambiguity, users choose how to resolve it:

| Mode             | Description                             | Best For                               |
| ---------------- | --------------------------------------- | -------------------------------------- |
| **Interactive**  | Answer all questions manually           | Complex projects, precise requirements |
| **Auto-resolve** | AI makes assumptions and documents them | Fast iteration, MVPs                   |
| **Hybrid**       | Pick which to answer; AI resolves rest  | Balanced control and speed             |

Uncertainty markers in generated artifacts:

- `[NEEDS CLARIFICATION: question]` - Requires user input
- `[AI ASSUMED: assumption - rationale]` - AI made a documented assumption

### VALIDATE Phase

New phase that runs 10 automated consistency checks before DONE:

1. **Requirement to Task Mapping** - Every PRD requirement has implementing task
2. **API to Data Model Mapping** - All schemas have corresponding entities
3. **Persona Consistency** - All personas referenced exist
4. **Stack Consistency** - Technologies match across artifacts
5. **Epic to Task Consistency** - All task EPICs are defined
6. **No Unresolved Clarifications** - All markers resolved
7. **AI Assumptions Documented** - All assumptions tracked
8. **Design System Compliance** - Follows design guidelines
9. **Test-First Compliance** - Tests specified before implementation
10. **Constitutional Compliance** - All 5 articles followed

Generates: `validation-report.md`, `coverage-matrix.md`

## 🏗️ Architecture

### Tech Stack

**Frontend:**

- Next.js 14.2.15
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Framer Motion (animations)

**Backend:**

- Node.js + TypeScript
- Drizzle ORM
- PostgreSQL (Neon - serverless)
- Cloudflare R2 (S3-compatible artifact storage)
- Google Gemini API (LLM)
- Better-Auth for authentication

**Testing & Quality:**

- Vitest for unit testing
- Testing Library for component testing
- TypeScript for type safety

### Project Structure

```
spec-driven/
├── src/                              # Next.js frontend (App Router)
│   ├── app/
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Home page
│   │   └── globals.css              # Global styles
│   ├── components/
│   │   ├── orchestration/           # Workflow components
│   │   │   ├── PhaseStepper.tsx
│   │   │   └── StackSelection.tsx
│   │   └── ui/                      # shadcn/ui components
│   ├── types/                       # TypeScript interfaces
│   │   ├── orchestrator.ts
│   │   └── llm.ts
│   └── lib/                         # Utility functions
│
├── backend/                         # Backend services
│   ├── lib/
│   │   ├── drizzle.ts              # Drizzle database client
│   │   ├── schema.ts               # Database schema definition
│   │   ├── error_handler.ts        # Error handling utilities
│   │   ├── sanitizer.ts            # Input sanitization
│   │   └── validation_schemas.ts   # Zod validation schemas
│   ├── middleware/
│   │   ├── auth_middleware.ts
│   │   └── error_handler_middleware.ts
│   └── services/
│       ├── orchestrator/           # State machine for workflow
│       ├── llm/                    # LLM integration (Gemini)
│       ├── file_system/            # Artifact storage & versioning
│       ├── projects/               # Project CRUD operations
│       ├── auth/                   # Authentication services
│       └── database/               # Database operations
│
├── drizzle/
│   ├── migrations/                 # Database migrations
│   └── seed.ts                     # Database seeding
│
├── drizzle.config.ts               # Drizzle configuration
│
├── docs/                           # Documentation
│   ├── ORCHESTRATOR_DESIGN.md
│   ├── AUTHENTICATION.md
│   ├── DATABASE_SETUP.md
│   ├── ERROR_HANDLING.md
│   ├── SECURITY_AUDIT.md
│   ├── TESTING.md
│   ├── IMPLEMENTATION_PROGRESS.md
│   └── CLAUDE.md
│
├── orchestrator_spec.yml           # Single source of truth (YAML config)
├── components.json                 # shadcn/ui configuration
├── tsconfig.json                   # TypeScript configuration
├── next.config.js                  # Next.js configuration
├── tailwind.config.js              # Tailwind CSS configuration
└── package.json                    # Project dependencies

```

## 🔧 Available Commands

### Development

```bash
# Start development server (http://localhost:3001)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- error_handler.test.ts

# Generate coverage report
npm run test:coverage

# Open interactive test UI
npm run test:ui
```

### Database

```bash
# Generate migrations from schema changes
npm run db:generate

# Push schema to database (development)
npm run db:push

# Run migrations (production)
npm run db:migrate

# Open Drizzle Studio (visual database browser)
npm run db:studio

# Seed database with example data
npm run db:seed
```

## 🔐 Security Features

### Built-in Security Baseline

Every project generated includes:

- **Authentication:** JWT tokens with 1-hour expiry
- **Password Security:** bcrypt hashing (cost 10+)
- **Data Protection:** AES-256 encryption at rest
- **Transport Security:** TLS 1.2+ for transit
- **Dependency Scanning:** npm audit (zero HIGH/CRITICAL)
- **Testing:** Unit & E2E test requirements

### Input Validation & Sanitization

- XSS prevention via HTML escaping
- SQL injection prevention via parameterized queries
- Directory traversal prevention for file paths
- Email validation and normalization
- Markdown content sanitization

## 📚 Documentation

Comprehensive documentation is available in the `docs/` folder:

- **[INDEX.md](docs/INDEX.md)** - Documentation index and navigation
- **[ORCHESTRATOR_DESIGN.md](docs/ORCHESTRATOR_DESIGN.md)** - Complete workflow design (2200+ lines)
- **[USAGE_GUIDE.md](docs/USAGE_GUIDE.md)** - Platform usage and stack selection guide
- **[AUTHENTICATION.md](docs/AUTHENTICATION.md)** - Auth system details
- **[DATABASE_SETUP.md](docs/DATABASE_SETUP.md)** - Database configuration guide
- **[ERROR_HANDLING.md](docs/ERROR_HANDLING.md)** - Error codes and handling
- **[SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md)** - Security analysis and recommendations
- **[TESTING.md](docs/TESTING.md)** - Testing guide with examples

**Design Reference:**

- **[fire-your-design-team.md](fire-your-design-team.md)** - Design system principles, Framer Motion patterns, anti-patterns to avoid

## 🗂️ Configuration Files

### orchestrator_spec.yml

The single source of truth for the entire workflow:

- Defines all 6 phases and their requirements
- Specifies 5 specialized agents and their prompts
- Lists all validators and validation rules
- Contains predefined tech stacks
- Includes security baseline configuration

```yaml
phases:
  ANALYSIS:
    owner: 'analyst'
    outputs: [constitution.md, project-brief.md, personas.md]
    validators: [presence, markdown_frontmatter, content_quality]

agents:
  analyst:
    role: 'Business Analyst and Product Strategist'
    prompt_template: |
      You are a Business Analyst...
```

### .env Configuration

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://user:pass@host/db"

# LLM API
GEMINI_API_KEY="your-api-key"

# Authentication
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="24h"

# CORS & Security
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
```

## 🧪 Testing

The project includes comprehensive test coverage:

- **Error Handler Tests** (25+ cases)
- **Sanitizer Tests** (30+ cases)
- **Password Service Tests** (20+ cases)
- **Validation Schema Tests** (20+ cases)

Coverage targets:

- Lines: 80%
- Functions: 80%
- Statements: 80%
- Branches: 75%

Run tests:

```bash
npm test
npm run test:coverage
npm run test:ui
```

## 🚀 Deployment

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm run start
```

### Environment Setup

Update `.env` with production values:

```env
NODE_ENV=production
DATABASE_URL="your-production-db-url"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
```

### Database Migration

```bash
# Run migrations in production
npm run db:migrate
```

## 📖 Key Concepts

### Multi-Agent Collaboration

Six specialized agents work together:

| Agent            | Phase           | Role                                          | Output                                   |
| ---------------- | --------------- | --------------------------------------------- | ---------------------------------------- |
| **Analyst**      | ANALYSIS        | Clarify requirements with uncertainty markers | Constitution, Brief, Personas            |
| **Architect**    | STACK_SELECTION | Propose technology stack                      | stack-decision.md, stack-rationale.md    |
| **PM**           | SPEC            | Document product                              | PRD, Data Model, API Spec, Design System |
| **DevOps**       | DEPENDENCIES    | Specify dependencies                          | Dependency list, security baseline       |
| **Scrum Master** | SOLUTIONING     | Break down work (test-first, parallelism)     | Epics, Tasks with `[P]` markers          |
| **Validator**    | VALIDATE        | Cross-artifact consistency checks             | validation-report.md, coverage-matrix.md |

### Approval Gates

One gate ensures user intentionality:

1. **STACK_SELECTION Gate** - AI recommends optimal stack with alternatives; requires explicit approval before proceeding to SPEC phase

> **Note:** Dependencies are now auto-generated from the approved stack without requiring a separate approval gate.

### Design System Integration

The SPEC phase generates design system artifacts following the **[fire-your-design-team.md](fire-your-design-team.md)** principles:

| Artifact                 | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `design-system.md`       | Colors, typography (4 sizes max), spacing (8pt grid), motion tokens |
| `component-inventory.md` | UI components with shadcn/ui mappings                               |
| `user-flows.md`          | Key user journey wireframes and interactions                        |

**Anti-pattern prevention:** The system avoids "AI slop" aesthetics (purple gradients, Inter font defaults, gradient blobs) by enforcing design constraints.

### Artifact Versioning

All project artifacts are stored in Cloudflare R2 (with database indexing):

```
/projects/{slug}/specs/
├── ANALYSIS/v1/
│   ├── constitution.md
│   ├── project-brief.md
│   └── personas.md
├── STACK_SELECTION/v1/
│   ├── stack-decision.md
│   └── stack-rationale.md
├── SPEC/v1/
│   ├── PRD.md
│   ├── data-model.md
│   ├── api-spec.json
│   ├── design-system.md
│   ├── component-inventory.md
│   └── user-flows.md
├── DEPENDENCIES/v1/
│   ├── DEPENDENCIES.md
│   └── dependency-proposal.md
├── SOLUTIONING/v1/
│   ├── architecture.md
│   ├── epics.md
│   ├── tasks.md
│   └── plan.md
├── VALIDATE/v1/           ★ NEW
│   ├── validation-report.md
│   └── coverage-matrix.md
└── DONE/v1/
    ├── README.md
    └── HANDOFF.md
```

## 🐛 Troubleshooting

### Port Already in Use

If port 3001 is in use, the dev server will try 3002, 3003, etc.

To kill processes on specific ports:

```bash
# On Windows
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# On macOS/Linux
lsof -i :3001
kill -9 <pid>
```

### Database Connection Issues

1. Verify `.env` has correct `DATABASE_URL`
2. Check Neon connection string format
3. Ensure database credentials are correct
4. Run `npm run db:push` to sync schema

### Module Resolution Issues

Path aliases are configured in `tsconfig.json`:

```json
"paths": {
  "@/*": ["./src/*"],
  "@/backend/*": ["./backend/*"]
}
```

Clear `.next` directory if imports fail:

```bash
rm -rf .next
npm run dev
```

## 📝 Contributing

When contributing:

1. Create feature branches from `main`
2. Add tests for new functionality
3. Ensure all tests pass: `npm test`
4. Run linter: `npm run lint`
5. Update documentation as needed

## 📄 License

This project is provided as-is for educational and commercial use.

## 🤝 Support

For questions or issues:

1. Check the documentation in `docs/`
2. Review existing test cases for usage examples
3. Check error messages for guidance

## 📊 Project Status

**Development Status:** Active

**Current Phase:** Implementation

**Test Coverage:** 85%+

**Security:** ✅ Baseline implemented

**Documentation:** ✅ Comprehensive

**Database:** ✅ PostgreSQL (Neon)

**Deployment:** Ready for production

---

**Last Updated:** December 10, 2025

**Version:** 3.1.0

### Changelog (v3.1.0)

- Added AI-driven stack selection with intelligent recommendations
- Removed dependencies approval gate (auto-generated from approved stack)
- Added intelligent defaults based on project type
- Added `project-classification.json` artifact for ANALYSIS phase
- Added `stack-analysis.md` artifact (replaces stack-proposal.md)
- New database columns: `project_type`, `scale_tier`, `recommended_stack`, `workflow_version`
- New StackRecommendationView and StackCard UI components

### Changelog (v3.0.0)

- Added 7th phase: VALIDATE with 10 automated consistency checks
- Added Hybrid Clarification Mode (interactive/auto-resolve/hybrid)
- Added Constitutional Articles (5 governing principles)
- Added Test-First requirements in SOLUTIONING phase
- Added Task Parallelism markers `[P]` for concurrent execution
- Added Quality Checklists for all phases
- Added Cloudflare R2 integration for artifact storage
- Updated database schema with clarification tracking
- Added ValidationResultsPanel UI component
- Added ClarificationPanel UI component
