# Spec-Driven Documentation Index

**Version 3.1** | Updated December 20, 2025

Welcome to the Spec-Driven Platform documentation! This index will guide you through all available documentation to help you understand, develop, and deploy the project.

## 🆕 What's New in Version 3.1

| Feature                         | Description                                               | Documentation                                                                          |
| ------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **AI-Driven Stack Selection**   | AI recommends optimal stack with alternatives and scoring | [ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md#phase-2-stack_selection-approval-gate) |
| **Auto-Generated Dependencies** | Dependencies auto-generated from approved stack (no gate) | [ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md#phase-4-dependencies-auto-generated)   |
| **Intelligent Defaults**        | Smart defaults by project type (web→Next.js, mobile→Expo) | [USAGE_GUIDE.md](USAGE_GUIDE.md#stack-selection)                                       |
| **VALIDATE Phase**              | 7th phase with 10 automated consistency checks            | [ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md#version-30-enhancements)               |
| **Hybrid Clarification**        | Interactive/Auto-resolve/Hybrid modes for ambiguity       | [USAGE_GUIDE.md](USAGE_GUIDE.md#hybrid-clarification-mode-analysis-phase)              |
| **Constitutional Articles**     | 5 governing principles for all specs                      | [USAGE_GUIDE.md](USAGE_GUIDE.md#constitutional-articles)                               |

## 🚀 Quick Navigation

### New to the Project?

Start here for a complete introduction:

1. **[README.md](../README.md)** - Project overview and quick start
2. **[SETUP.md](SETUP.md)** - Environment setup and installation
3. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Codebase layout and architecture
4. **[fire-your-design-team.md](../fire-your-design-team.md)** - Design system principles and anti-patterns

### Running the Application

- **[SETUP.md](SETUP.md)** - Installation, environment variables, database setup
- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - Database configuration and migrations
- **[S3_SETUP_GUIDE.md](S3_SETUP_GUIDE.md)** - R2/S3 storage configuration
- **[VERCEL_DEPLOYMENT_CHECKLIST.md](VERCEL_DEPLOYMENT_CHECKLIST.md)** - Production deployment

### Understanding the Architecture

- **[ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md)** - Complete workflow orchestration design (2200+ lines)
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Code organization and module breakdown
- **[API.md](API.md)** - Complete API endpoint reference

### Design System

- **[fire-your-design-team.md](../fire-your-design-team.md)** - Design principles, Framer Motion patterns, anti-patterns
- AI-driven stack selection recommends from 13 predefined stacks or enables custom composition
- Design artifacts: `design-system.md`, `component-inventory.md`, `user-flows.md`

### Building Features

- **[AUTHENTICATION.md](AUTHENTICATION.md)** - Auth system details and implementation
- **[ERROR_HANDLING.md](ERROR_HANDLING.md)** - Error codes and handling patterns
- **[SECURITY_AUDIT.md](SECURITY_AUDIT.md)** - Security analysis and recommendations
- **[SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md)** - Security features and patterns

### Testing & Quality

- **[TESTING.md](TESTING.md)** - Unit testing strategy and examples
- **[QUICK_START_E2E.md](QUICK_START_E2E.md)** - End-to-end testing quick start (5 minutes)
- **[E2E_TEST_SUMMARY.md](E2E_TEST_SUMMARY.md)** - E2E test implementation details
- **[E2E_MANIFEST.md](E2E_MANIFEST.md)** - E2E test files and structure
- **[E2E_DOCUMENTATION_INDEX.md](E2E_DOCUMENTATION_INDEX.md)** - E2E test navigation guide

### Advanced Topics

- **[ENHANCEMENT_PLAN.md](ENHANCEMENT_PLAN.md)** - Future improvements and roadmap (57KB)
- **[OWNER_IMPLEMENTATION_SUMMARY.md](OWNER_IMPLEMENTATION_SUMMARY.md)** - Project ownership and security model
- **[AWS_S3_QUICK_REFERENCE.md](AWS_S3_QUICK_REFERENCE.md)** - AWS/R2 quick reference
- **[USAGE_GUIDE.md](USAGE_GUIDE.md)** - User guide for platform features

---

## 📚 Documentation by Category

### Getting Started (Read in this order)

| Document                                     | Purpose              | Time   |
| -------------------------------------------- | -------------------- | ------ |
| [README.md](../README.md)                    | Project overview     | 10 min |
| [SETUP.md](SETUP.md)                         | Installation & setup | 15 min |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Codebase layout      | 10 min |

### Core Functionality

| Document                                         | Purpose                            | Time   |
| ------------------------------------------------ | ---------------------------------- | ------ |
| [ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md) | Workflow orchestration (MUST READ) | 30 min |
| [API.md](API.md)                                 | API reference                      | 20 min |
| [AUTHENTICATION.md](AUTHENTICATION.md)           | Auth system                        | 15 min |
| [DATABASE_SETUP.md](DATABASE_SETUP.md)           | Database operations                | 15 min |

### Operations & Deployment

| Document                                                         | Purpose                | Time   |
| ---------------------------------------------------------------- | ---------------------- | ------ |
| [S3_SETUP_GUIDE.md](S3_SETUP_GUIDE.md)                           | Cloud storage setup    | 15 min |
| [VERCEL_DEPLOYMENT_CHECKLIST.md](VERCEL_DEPLOYMENT_CHECKLIST.md) | Production deployment  | 20 min |
| [AWS_S3_QUICK_REFERENCE.md](AWS_S3_QUICK_REFERENCE.md)           | Quick AWS/R2 reference | 5 min  |

### Quality & Testing

| Document                                 | Purpose                | Time   |
| ---------------------------------------- | ---------------------- | ------ |
| [TESTING.md](TESTING.md)                 | Unit testing strategy  | 15 min |
| [QUICK_START_E2E.md](QUICK_START_E2E.md) | E2E testing quickstart | 5 min  |
| [ERROR_HANDLING.md](ERROR_HANDLING.md)   | Error patterns         | 15 min |

### Security

| Document                                                           | Purpose                 | Time   |
| ------------------------------------------------------------------ | ----------------------- | ------ |
| [SECURITY_AUDIT.md](SECURITY_AUDIT.md)                             | Security analysis       | 20 min |
| [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md)           | Security implementation | 20 min |
| [OWNER_IMPLEMENTATION_SUMMARY.md](OWNER_IMPLEMENTATION_SUMMARY.md) | Data ownership model    | 15 min |

### Future Development

| Document                                   | Purpose             | Time    |
| ------------------------------------------ | ------------------- | ------- |
| [ENHANCEMENT_PLAN.md](ENHANCEMENT_PLAN.md) | v2.0 roadmap        | 60+ min |
| [USAGE_GUIDE.md](USAGE_GUIDE.md)           | Platform user guide | 20 min  |

---

## 🎯 Documentation by Task

### I want to...

#### Set Up the Project

→ Read: [SETUP.md](SETUP.md) → [DATABASE_SETUP.md](DATABASE_SETUP.md) → [S3_SETUP_GUIDE.md](S3_SETUP_GUIDE.md)

#### Understand the Workflow System

→ Read: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) → [ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md)

#### Integrate with APIs

→ Read: [API.md](API.md) → [AUTHENTICATION.md](AUTHENTICATION.md) → [ERROR_HANDLING.md](ERROR_HANDLING.md)

#### Add New Features

→ Read: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) → [TESTING.md](TESTING.md) → [SECURITY_AUDIT.md](SECURITY_AUDIT.md)

#### Deploy to Production

→ Read: [VERCEL_DEPLOYMENT_CHECKLIST.md](VERCEL_DEPLOYMENT_CHECKLIST.md) → [S3_SETUP_GUIDE.md](S3_SETUP_GUIDE.md) → [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md)

#### Write Tests

→ Read: [TESTING.md](TESTING.md) → [QUICK_START_E2E.md](QUICK_START_E2E.md) → [E2E_TEST_SUMMARY.md](E2E_TEST_SUMMARY.md)

#### Understand Security

→ Read: [SECURITY_AUDIT.md](SECURITY_AUDIT.md) → [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) → [OWNER_IMPLEMENTATION_SUMMARY.md](OWNER_IMPLEMENTATION_SUMMARY.md)

#### Plan Next Phase

→ Read: [ENHANCEMENT_PLAN.md](ENHANCEMENT_PLAN.md)

---

## 📖 Document Descriptions

### Core Reference Documents (Must Read)

- **ORCHESTRATOR_DESIGN.md** (80KB, 2400+ lines)

  - Complete specification of the **7-phase workflow** (including VALIDATE)
  - Multi-agent orchestration details (6 agents including Validator)
  - Constitutional Articles enforcement
  - Hybrid Clarification Mode
  - State machine implementation
  - API specifications and examples
  - Data models and database schema
  - **Must read to understand the project core**

- **API.md** (New - Complete API reference)

  - All HTTP endpoints documented
  - Request/response schemas
  - Authentication requirements
  - Error codes and examples
  - Rate limits and pagination

- **PROJECT_STRUCTURE.md** (New - Codebase layout)
  - Directory tree with descriptions
  - Module responsibilities
  - Key files and their purposes
  - Architecture patterns
  - Dependency graph

### Setup & Configuration

- **SETUP.md** (New - Consolidated setup guide)

  - Installation steps
  - Environment configuration
  - Database initialization
  - Development server startup
  - Troubleshooting

- **DATABASE_SETUP.md**

  - Database connection setup
  - Migration procedures
  - Schema overview
  - Development vs production
  - Backup and restore

- **S3_SETUP_GUIDE.md**
  - R2/S3 bucket configuration
  - Access credentials
  - Upload/download procedures
  - CDN configuration
  - Cost optimization

### Feature Documentation

- **AUTHENTICATION.md**

  - Better Auth setup
  - Session management
  - JWT tokens
  - User registration and login flows
  - Security patterns

- **ERROR_HANDLING.md**

  - Error code reference
  - Custom error types
  - Logging patterns
  - Recovery strategies
  - User-facing error messages

- **SECURITY_AUDIT.md**

  - Security assessment
  - Vulnerability analysis
  - Recommendations
  - Compliance checklist
  - Third-party audit results

- **SECURITY_IMPLEMENTATION.md**
  - Authentication guards
  - Input validation
  - DB-primary artifact strategy
  - State initialization
  - Deployment security

### Testing Documentation

- **TESTING.md**

  - Unit test patterns
  - Test utilities and fixtures
  - Coverage targets
  - Running tests locally
  - CI/CD integration

- **QUICK_START_E2E.md**

  - 5-minute E2E test setup
  - Common commands
  - Running and debugging tests
  - Viewing reports

- **E2E_TEST_SUMMARY.md**
  - Complete E2E test implementation
  - Test file structure
  - 61 total test cases
  - Configuration details

### Deployment & Operations

- **VERCEL_DEPLOYMENT_CHECKLIST.md**

  - Pre-deployment checklist
  - Environment setup
  - Build configuration
  - Deployment steps
  - Post-deployment verification
  - Monitoring and logging

- **AWS_S3_QUICK_REFERENCE.md**
  - AWS console navigation
  - Common S3 operations
  - Bucket configuration
  - Cost analysis

### Advanced Topics

- **ENHANCEMENT_PLAN.md** (57KB)

  - Phase 1: Security hardening (API keys, secrets, headers, CSRF, dependencies)
  - Phase 2: Architecture refactoring (storage, type safety, transactions)
  - Phase 3: Testing & observability
  - Risk mitigation strategies
  - Implementation roadmap

- **OWNER_IMPLEMENTATION_SUMMARY.md**

  - Project ownership model
  - Three-tier validation
  - Database constraints
  - API ownership checks
  - Security architecture

- **USAGE_GUIDE.md**
  - User-facing feature documentation
  - Workflow walkthrough
  - Best practices
  - FAQs

---

## 🔍 Key Files Reference

### Must-Read Files

1. **[ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md)** - Core design document
2. **[SECURITY_AUDIT.md](SECURITY_AUDIT.md)** - Security baseline
3. **[API.md](API.md)** - API reference
4. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Code organization

### Important References

- **[../orchestrator_spec.yml](../orchestrator_spec.yml)** - Workflow configuration (SSOT)
- **[../package.json](../package.json)** - Dependencies and scripts
- **[../README.md](../README.md)** - Project README

---

## 📊 Statistics

- **Total Documentation Files**: 20
- **Total Documentation Size**: 400+ KB
- **Lines of Documentation**: 15,000+
- **Code Examples**: 200+
- **Diagrams & Tables**: 50+

---

## 🔄 Documentation Maintenance

### File Conventions

- File naming: `UPPERCASE_WITH_UNDERSCORES.md` for core docs
- Table of contents at top of longer files
- Cross-references using relative links
- Code examples with language highlighting
- Updated dates in footers

### When Adding New Docs

1. Add to this INDEX.md
2. Use clear naming convention
3. Include table of contents for files >2000 lines
4. Link to related documents
5. Update the statistics section

### Review Cycle

- Core docs reviewed annually
- Feature docs updated with each release
- Security docs reviewed with security patches
- API docs updated with version bumps

---

## 🆘 Need Help?

### Common Questions

- **"How do I get started?"** → [SETUP.md](SETUP.md)
- **"How does the workflow work?"** → [ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md)
- **"What APIs are available?"** → [API.md](API.md)
- **"How do I test?"** → [TESTING.md](TESTING.md)
- **"How do I deploy?"** → [VERCEL_DEPLOYMENT_CHECKLIST.md](VERCEL_DEPLOYMENT_CHECKLIST.md)
- **"What's the roadmap?"** → [ENHANCEMENT_PLAN.md](ENHANCEMENT_PLAN.md)

### Support Resources

- GitHub Issues: For bug reports and feature requests
- GitHub Discussions: For questions and community help
- Documentation: You're reading it!
- Code Examples: In `src/__tests__/` and `e2e/` directories

---

## 📋 Checklist for New Team Members

- [ ] Read [README.md](../README.md) (10 min)
- [ ] Complete [SETUP.md](SETUP.md) (15 min)
- [ ] Skim [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) (10 min)
- [ ] Read [ORCHESTRATOR_DESIGN.md](ORCHESTRATOR_DESIGN.md) (30 min)
- [ ] Read [SECURITY_AUDIT.md](SECURITY_AUDIT.md) (20 min)
- [ ] Run [QUICK_START_E2E.md](QUICK_START_E2E.md) tests (45 min)
- [ ] Review [API.md](API.md) (20 min)
- [ ] Bookmark this INDEX.md for future reference

**Total onboarding time**: ~2.5 hours

---

**Last Updated**: December 10, 2025
**Status**: Complete and Current (v3.1)
**Next Review**: Q1 2026
