# CI/CD Integration Guide

This document describes the CI/CD integration for the Spec-Driven Platform, enabling automated validation of project specifications on push and pull requests.

## Overview

The CI/CD pipeline automatically validates spec artifacts against the orchestrator configuration and checks Constitutional Articles compliance. It provides feedback on PRs and generates validation badges.

## GitHub Actions Workflow

### Location

`.github/workflows/spec-validation.yml`

### Triggers

| Event | Conditions |
|-------|------------|
| `push` | Branch matches `spec/**` |
| `pull_request` | Changes to `specs/**` or `orchestrator_spec.yml` |

### Jobs

#### 1. `validate_specs`

Runs validation checks on all phase artifacts:

- Validates orchestrator spec syntax
- Checks presence of required artifacts per phase
- Validates markdown frontmatter
- Verifies JSON/ OpenAPI structure
- Checks task DAG for circular dependencies

**Steps:**
1. Checkout repository
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Run `npm run spec:validate`
5. Run `npm run spec:constitutional-check`
6. Generate badge (`npm run spec:badge-gen`)
7. Upload validation report artifact
8. Comment on PR with results

#### 2. `constitutional_check`

Validates all 5 Constitutional Articles from `orchestrator_spec.yml`:

- **Article 1**: Library-First Principle (modular structure)
- **Article 2**: Test-First Imperative (tests before implementation)
- **Article 3**: Simplicity Gate (≤3 services for MVP)
- **Article 4**: Anti-Abstraction (no unnecessary wrappers)
- **Article 5**: Integration-First Testing (real services over mocks)

#### 3. `badge_generation`

Generates SVG badge showing current validation status:
- ✅ `pass` (green) - All checks passed
- ⚠️ `warning` (yellow) - Some warnings
- ❌ `fail` (red) - Critical failures

#### 4. `notify_on_failure`

Sends notifications when validation fails (can be extended for Slack/email).

## NPM Scripts

### `npm run spec:validate`

Runs validators defined in `orchestrator_spec.yml`:

```bash
npm run spec:validate
```

**Validates:**
- File presence for all phase outputs
- Markdown frontmatter (title, owner, version, date, status)
- OpenAPI 3.0.3 specification format
- Task DAG (no circular dependencies)
- Requirements traceability (PRD → Tasks)

**Output:** `validation-report.json`

### `npm run spec:constitutional-check`

Validates Constitutional Articles compliance:

```bash
npm run spec:constitutional-check
```

**Checks Articles:**
- Library-First: Modular structure with clear boundaries
- Test-First: Tests specified before implementation
- Simplicity: ≤3 services for MVP with justification
- Anti-Abstraction: No unnecessary wrapper libraries
- Integration-First: Real services for integration tests

**Output:** `constitutional-report.json`

### `npm run spec:badge-gen`

Generates validation badge:

```bash
npm run spec:badge-gen
```

**Generates:**
- `badge.json` - Badge data for GitHub Actions
- `spec-validation-badge.svg` - SVG badge image
- `SPEC_VALIDATION_BADGE.md` - Badge documentation

## Validation API

### Endpoint

```
POST /api/projects/[slug]/validate
```

### Authentication

Requires Bearer token (Better Auth).

### Response

```json
{
  "success": true,
  "data": {
    "checks": [
      {
        "id": "req-task-mapping",
        "name": "Requirement to Task Mapping",
        "description": "Every PRD requirement has at least one implementing task",
        "category": "requirement_mapping",
        "status": "pass",
        "details": "15/15 requirements mapped to tasks",
        "items": [...]
      }
    ],
    "summary": {
      "totalChecks": 10,
      "passed": 8,
      "failed": 1,
      "warnings": 1,
      "pending": 0,
      "overallStatus": "fail",
      "completedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Validation Checks

| Check ID | Category | Description |
|----------|----------|-------------|
| `req-task-mapping` | requirement_mapping | PRD requirements → Tasks traceability |
| `api-data-mapping` | consistency | API schemas → Data model entities |
| `persona-consistency` | consistency | Personas referenced in PRD exist in personas.md |
| `stack-consistency` | consistency | Architecture matches approved stack |
| `epic-task-consistency` | requirement_mapping | EPIC-IDs defined in epics.md |
| `unresolved-clarifications` | completeness | No [NEEDS CLARIFICATION] markers |
| `ai-assumptions` | completeness | AI assumptions documented |
| `design-system-compliance` | compliance | Design system follows guidelines |
| `test-first-compliance` | compliance | Tests before implementation |
| `constitutional-compliance` | compliance | Articles 1-5 compliance |

## Badge Usage

### Markdown

```markdown
![Spec Validation](https://img.shields.io/badge/spec%20validation-pass-green)
```

### SVG in README

```markdown
![Spec Validation](spec-validation-badge.svg)
```

### Dynamic Badge (GitHub Actions artifact)

```json
{
  "schemaVersion": 1,
  "label": "spec validation",
  "message": "pass",
  "color": "green"
}
```

## Local Development

### Running Validation Locally

```bash
# Validate specs
npm run spec:validate

# Check constitutional compliance
npm run spec:constitutional-check

# Generate badge
npm run spec:badge-gen
```

### Validation Report Location

After running validation scripts, reports are written to:
- `validation-report.json` - Full validation results
- `constitutional-report.json` - Constitutional compliance
- `badge.json` - Badge data
- `spec-validation-badge.svg` - Badge image

### Testing API Endpoint

```bash
# Create a test project first via UI, then:
curl -X POST http://localhost:3000/api/projects/your-project-slug/validate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Common Issues

#### Validation Fails on Missing Files

Ensure all phase outputs are present in `specs/[PHASE]/`:
- ANALYSIS: constitution.md, project-brief.md, personas.md, project-classification.json
- STACK_SELECTION: stack-analysis.md, stack-decision.md, stack-rationale.md, stack.json
- SPEC: PRD.md, data-model.md, api-spec.json, design-system.md
- DEPENDENCIES: DEPENDENCIES.md, dependencies.json
- SOLUTIONING: architecture.md, epics.md, tasks.md, plan.md

#### Constitutional Compliance Failures

| Article | Fix |
|---------|-----|
| Article 1 | Add modular structure to architecture.md |
| Article 2 | Move test specs before implementation notes in tasks.md |
| Article 3 | Reduce services to ≤3 or add justification |
| Article 4 | Remove unnecessary wrappers or justify each |
| Article 5 | Use real database/services for integration tests |

#### Badge Shows "unknown"

Run `npm run spec:validate` before `npm run spec:badge-gen` to generate validation report first.

## Extending Validation

### Adding New Validators

1. Define validator in `orchestrator_spec.yml`:

```yaml
validators:
  my_custom_check:
    description: "My custom validation"
    implementation: "custom_validator"
```

2. Implement in `scripts/spec-validate.js`:

```javascript
function checkMyCustomValidation(artifacts) {
  // Validation logic
  return {
    name: 'My Custom Check',
    status: 'pass',
    details: 'Custom validation passed'
  };
}
```

3. Add to validation checks in `src/app/api/projects/[slug]/validate/route.ts`

### Customizing Badge Colors

Edit `scripts/spec-badge-gen.js`:

```javascript
switch (overallStatus) {
  case 'pass': statusColor = '22c55e'; break;  // green-500
  case 'fail': statusColor = 'ef4444'; break;  // red-500
  case 'warning': statusColor = 'eab308'; break; // yellow-500
  default: statusColor = '6b7280'; break; // gray-500
}
```

## Best Practices

1. **Run validation locally** before pushing to catch issues early
2. **Fix failures in order**: Start with failed checks, then warnings
3. **Document assumptions**: Use [AI ASSUMED: ...] markers
4. **Resolve clarifications**: Don't leave [NEEDS CLARIFICATION] markers
5. **Update badges**: Regenerate badges after successful validation

## References

- [orchestrator_spec.yml](../orchestrator_spec.yml) - Full spec configuration
- [Constitutional Articles](../orchestrator_spec.yml#constitutional-articles) - Articles 1-5
- [Validation API Source](../src/app/api/projects/%5Bslug%5D/validate/route.ts) - API implementation
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
