# Spec-Driven Platform

A multi-agent system that guides users through a 6-phase workflow to generate production-ready project specifications, which are then used as prompts for LLM-based code generation.

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

The platform guides users through 6 sequential phases:

```
User Input (project idea)
  ↓ [ANALYSIS] - Analyst generates constitution, brief, personas
  ↓ [STACK_SELECTION] - User approves technology stack (GATE)
  ↓ [SPEC] - PM generates PRD, data model, API spec
  ↓ [DEPENDENCIES] - DevOps proposes packages (GATE)
  ↓ [SOLUTIONING] - Architect & Scrum Master create design, epics, tasks
  ↓ [DONE] - Auto-generate HANDOFF.md & ZIP for user download
  ↓ User uploads to IDE, pastes HANDOFF.md as LLM prompt for code generation
```

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- Next.js 14.2.15
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui components

**Backend:**
- Node.js + TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- Google Gemini API

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
│   │   ├── prisma.ts               # Prisma client instance
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
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── seed.ts                     # Database seeding
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
# Set up database (migrate + seed)
npm run db:setup

# Run migrations
npm run db:migrate

# Push schema to database (for new projects)
npm run db:push

# Open Prisma Studio (visual database browser)
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

- **[CLAUDE.md](docs/CLAUDE.md)** - Claude Code guidance and quick reference
- **[ORCHESTRATOR_DESIGN.md](docs/ORCHESTRATOR_DESIGN.md)** - Complete workflow design (2200+ lines)
- **[AUTHENTICATION.md](docs/AUTHENTICATION.md)** - Auth system details
- **[DATABASE_SETUP.md](docs/DATABASE_SETUP.md)** - Database configuration guide
- **[ERROR_HANDLING.md](docs/ERROR_HANDLING.md)** - Error codes and handling
- **[SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md)** - Security analysis and recommendations
- **[TESTING.md](docs/TESTING.md)** - Testing guide with examples
- **[IMPLEMENTATION_PROGRESS.md](docs/IMPLEMENTATION_PROGRESS.md)** - Feature completion status

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
    owner: "analyst"
    outputs: [constitution.md, project-brief.md, personas.md]
    validators: [presence, markdown_frontmatter, content_quality]

agents:
  analyst:
    role: "Business Analyst and Product Strategist"
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

Five specialized agents work together:

| Agent | Phase | Role | Output |
|-------|-------|------|--------|
| **Analyst** | ANALYSIS | Clarify requirements | Constitution, Brief, Personas |
| **PM** | SPEC | Document product | PRD, Data Model, API Spec |
| **Architect** | SOLUTIONING | Design system | Architecture, Tech choices |
| **Scrum Master** | SOLUTIONING | Break down work | Epics, Tasks (with DAG dependencies) |
| **DevOps** | DEPENDENCIES | Specify dependencies | Dependency list, security baseline |

### Approval Gates

Two gates ensure user intentionality:

1. **STACK_SELECTION Gate** - Requires explicit stack approval before proceeding to SPEC phase
2. **DEPENDENCIES Gate** - Requires security review before proceeding to SOLUTIONING phase

### Artifact Versioning

All project artifacts are stored as human-readable files:

```
/projects/{slug}/specs/
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
└── ...
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

**Last Updated:** November 15, 2025

**Version:** 0.1.0
