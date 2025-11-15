export const sampleSpecTitle = "Aurora Assist – Intelligent Support Co-Pilot"

export const sampleSpecText = `## Project Brief
Aurora Assist is a multi-channel support companion that helps SaaS customer success teams triage, diagnose, and resolve inbound issues. Analysts synthesize incoming signals, architects propose remediation steps, and engineers receive implementation-ready prompts.

## Core Personas
1. **Support Lead** – Monitors queue health, approves dependency proposals, and ensures SLAs are met.
2. **Implementation Engineer** – Converts approved specs into production code inside the existing Next.js monorepo.
3. **End User** – Submits tickets from in-app widget, Slack, or email.

## Functional Requirements
- Real-time ticket ingestion from HelpScout, Slack, and SMTP bridge.
- Spec-driven triage workflow that tags urgency, KPIs affected, and recommended stack action.
- Knowledge graph search across Constitution.md, PRD.md, and previous handoffs to suggest fixes.
- Human-in-the-loop approval for dependency upgrades and architecture changes.

## Technical Architecture
- **Frontend**: Next.js 14 App Router, Radix primitives, shadcn UI.
- **Backend**: FastAPI microservice for NLP scoring + orchestrator workers.
- **Data**: PostgreSQL (operational), Neon read replica, Redis for task queue.
- **Deployment**: Vercel for web, Fly.io for Python services, Terraform-managed secrets.

## Key Artifacts
- PRD.md – Success metrics, KPIs, and non-functional requirements.
- data-model.md – ERD describing Tickets, Signals, Recommendations, and Approvals.
- api-spec.json – REST + Webhook contracts for ticket ingestion.
- DEPENDENCIES.md – Verified npm/pip packages with reasoning and risk notes.
- HANDOFF.md – Unified prompt for downstream code generation agents.

## Success Criteria
- Triage accuracy ≥ 92% on historical tickets.
- Median ticket-to-recommendation time under 45 seconds.
- Complete handoff bundle delivered within 3 autonomous phases.
`

