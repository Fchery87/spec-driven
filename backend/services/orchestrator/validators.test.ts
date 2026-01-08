import { describe, it, expect } from 'vitest'
import { Validators } from './validators'
 
import { logger } from '@/lib/logger';

describe('Validators', () => {
  const validators = new Validators()

  describe('validatePresence', () => {
    it('should pass when all required files exist', () => {
      const artifacts = {
        'constitution.md': 'content',
        'brief.md': 'content'
      }
      const result = validators.validatePresence(artifacts, {
        required_files: ['constitution.md', 'brief.md']
         
      } as any)
      expect(result.passed).toBe(true)
    })

    it('should fail when required files are missing', () => {
      const artifacts = {
        'constitution.md': 'content'
      }
      const result = validators.validatePresence(artifacts, {
        required_files: ['constitution.md', 'brief.md']
         
      } as any)
      expect(result.passed).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })

  describe('validateMarkdownFrontmatter', () => {
    it('should pass when frontmatter is valid', () => {
      const artifacts = {
        'constitution.md': `---
title: Test
owner: analyst
version: v1
date: 2024-01-01
status: complete
---
# Content`
      }
      const result = validators.validateMarkdownFrontmatter(artifacts)
      expect(result.passed).toBe(true)
    })

    it('should fail when frontmatter is missing', () => {
      const artifacts = {
        'constitution.md': '# No frontmatter here'
      }
      const result = validators.validateMarkdownFrontmatter(artifacts)
      expect(result.passed).toBe(false)
    })
  })

  describe('validateContentQuality', () => {
    it('should pass when content meets minimum requirements', () => {
      const artifacts = {
        'constitution.md': 'a'.repeat(150) // More than 100 chars
      }
      const result = validators.validateContentQuality(artifacts)
      expect(result.passed).toBe(true)
    })

    it('should fail when content is too short', () => {
      const artifacts = {
        'constitution.md': 'short'
      }
      const result = validators.validateContentQuality(artifacts)
      expect(result.passed).toBe(false)
    })
  })

  describe('validateContentCoverage', () => {
    it('should validate PRD has minimum requirements', () => {
      const artifacts = {
        'PRD.md': `# PRD

## Requirements
- REQ-001: Requirement 1
- REQ-002: Requirement 2
- REQ-003: Requirement 3
- REQ-004: Requirement 4
- REQ-005: Requirement 5`
      }
      const result = validators.validateContentCoverage(artifacts, {
        type: 'SPEC'
         
      } as any)
      expect(result.passed).toBe(true)
    })

    it('should fail when PRD has insufficient requirements', () => {
      const artifacts = {
        'PRD.md': `# PRD
- REQ-001: Requirement 1
- REQ-002: Requirement 2`
      }
      const result = validators.validateContentCoverage(artifacts, {
        type: 'SPEC'
         
      } as any)
      expect(result.passed).toBe(false)
    })
  })

  describe('validateTaskDAG', () => {
    it('should pass when tasks have no circular dependencies', () => {
      const artifacts = {
        'tasks.md': `
## Task 1
- depends_on: []

## Task 2
- depends_on: [Task 1]

## Task 3
- depends_on: [Task 2]
`
      }
      const result = validators.validateTaskDAG(artifacts)
      expect(result.passed).toBe(true)
    })

    it('should fail when tasks have circular dependencies', () => {
      const artifacts = {
        'tasks.md': `
## Task 1
- depends_on: [Task 2]

## Task 2
- depends_on: [Task 1]
`
      }
      const result = validators.validateTaskDAG(artifacts)
      expect(result.passed).toBe(false)
    })
  })

  describe('validateAPIOpenAPI', () => {
    it('should pass with valid OpenAPI spec', () => {
      const artifacts = {
        'api-spec.json': JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'API', version: '1.0.0' },
          paths: {
            '/api/test': {
              get: {
                responses: { '200': { description: 'Success' } }
              }
            }
          }
        })
      }
      const result = validators.validateAPIOpenAPI(artifacts)
      expect(result.passed).toBe(true)
    })

    it('should fail with invalid OpenAPI spec', () => {
      const artifacts = {
        'api-spec.json': '{ invalid json'
      }
      const result = validators.validateAPIOpenAPI(artifacts)
      expect(result.passed).toBe(false)
    })
  })

  describe('validateMinimumLength', () => {
    it('should pass when content meets minimum length', () => {
      const content = 'a'.repeat(100) // Exactly 100 chars
      const result = validators.validateMinimumLength(content, 'test.md', 100)
      expect(result.passed).toBe(true)
    })

    it('should pass when content exceeds minimum length', () => {
      const content = 'a'.repeat(500) // More than 100 chars
      const result = validators.validateMinimumLength(content, 'test.md', 100)
      expect(result.passed).toBe(true)
    })

    it('should fail when content is below minimum length', () => {
      const content = 'short'
      const result = validators.validateMinimumLength(content, 'test.md', 100)
      expect(result.passed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]).toContain('test.md')
      expect(result.errors?.[0]).toContain('5 chars')
    })

    it('should fail when content is empty', () => {
      const content = ''
      const result = validators.validateMinimumLength(content, 'empty.md', 100)
      expect(result.passed).toBe(false)
      expect(result.errors?.[0]).toContain('0 chars')
    })

    it('should report exact character count in error message', () => {
      const content = 'a'.repeat(99) // Just under 100
      const result = validators.validateMinimumLength(content, 'almost.md', 100)
      expect(result.passed).toBe(false)
      expect(result.errors?.[0]).toContain('99 chars')
    })
  })

  describe('validateArtifactLengths', () => {
    it('should pass when all artifacts meet minimum length', () => {
      const artifacts = {
        'PRD.md': 'a'.repeat(3000),
        'tasks.md': 'a'.repeat(2000),
        'api-spec.json': 'a'.repeat(1000),
      }
      const result = validators.validateArtifactLengths(artifacts)
      expect(result.passed).toBe(true)
      expect(result.errors).toBeUndefined()
      expect(result.checks['PRD.md']).toBe(true)
      expect(result.checks['tasks.md']).toBe(true)
      expect(result.checks['api-spec.json']).toBe(true)
    })

    it('should fail when PRD.md is too short', () => {
      const artifacts = {
        'PRD.md': 'a'.repeat(500), // Under 3000
        'tasks.md': 'a'.repeat(2000),
      }
      const result = validators.validateArtifactLengths(artifacts)
      expect(result.passed).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]).toContain('PRD.md')
      expect(result.checks['PRD.md']).toBe(false)
      expect(result.checks['tasks.md']).toBe(true)
    })

    it('should fail when multiple artifacts are too short', () => {
      const artifacts = {
        'user-personas.md': 'a'.repeat(100), // Under 1500
        'component-mapping.md': 'a'.repeat(500), // Under 2000
      }
      const result = validators.validateArtifactLengths(artifacts)
      expect(result.passed).toBe(false)
      expect(result.errors?.length).toBe(2)
      expect(result.checks['user-personas.md']).toBe(false)
      expect(result.checks['component-mapping.md']).toBe(false)
    })

    it('should skip artifacts without minimum length standards', () => {
      const artifacts = {
        'unknown-artifact.md': 'short', // Not in minLengths
        'PRD.md': 'a'.repeat(3000),
      }
      const result = validators.validateArtifactLengths(artifacts)
      expect(result.passed).toBe(true)
      expect(result.checks['unknown-artifact.md']).toBeUndefined()
      expect(result.checks['PRD.md']).toBe(true)
    })

    it('should handle empty artifacts object', () => {
      const artifacts = {}
      const result = validators.validateArtifactLengths(artifacts)
      expect(result.passed).toBe(true)
      expect(Object.keys(result.checks)).toHaveLength(0)
    })

    it('should validate stack.json minimum length', () => {
      const artifacts = {
        'stack.json': '{"key": "value"}', // Under 500 chars
      }
      const result = validators.validateArtifactLengths(artifacts)
      expect(result.passed).toBe(false)
      expect(result.checks['stack.json']).toBe(false)
    })

    it('should validate data-model.md minimum length', () => {
      const artifacts = {
        'data-model.md': 'a'.repeat(1000), // Under 1500
      }
      const result = validators.validateArtifactLengths(artifacts)
      expect(result.passed).toBe(false)
      expect(result.checks['data-model.md']).toBe(false)
    })

    it('should validate journey-maps.md minimum length', () => {
      const artifacts = {
        'journey-maps.md': 'a'.repeat(1500), // Under 2000
      }
      const result = validators.validateArtifactLengths(artifacts)
      expect(result.passed).toBe(false)
      expect(result.checks['journey-maps.md']).toBe(false)
    })

    it('should validate dependencies.json minimum length', () => {
      const artifacts = {
        'dependencies.json': '{}', // Under 500
      }
      const result = validators.validateArtifactLengths(artifacts)
      expect(result.passed).toBe(false)
      expect(result.checks['dependencies.json']).toBe(false)
    })
  })

  // ============================================================================
  // QUALITY CHECKLIST VALIDATORS (Phases 1, 3, 6, 9)
  // ============================================================================

  describe('validateAnalysisQuality (Phase 1)', () => {
    it('should pass when all required files exist with valid content', () => {
      const artifacts = {
        'project-classification.json': '{"project_type": "web_app"}',
        'guiding-principles.md': `# Guiding Principles

1. **User Privacy First** - We protect user data at all costs
2. **Performance Matters** - Fast is better than slow
3. **Accessibility by Default** - Everyone should be able to use this
4. **Security First** - No feature is worth a security compromise
5. **Simplicity Wins** - Simple solutions are better`,
        'user-personas.md': `---
title: User Personas
owner: analyst
version: 1.0
date: 2024-01-01
status: complete
---

## Sarah - Marketing Manager

A 35-year-old marketing professional who needs to create campaigns.

## Tom - Small Business Owner

A 42-year-old entrepreneur running a local business.

## Lisa - Freelance Designer

A 28-year-old creative professional managing multiple clients.`,
        'user-journeys.md': `# User Journeys

## Journey 1: Onboarding

User signs up and completes profile setup.

## Journey 2: Creating Content

User creates and publishes their first piece of content.`,
      }
      const result = validators.validateAnalysisQuality(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0)
    })

    it('should fail when required files are missing', () => {
      const artifacts = {
        'project-classification.json': '{"project_type": "web_app"}',
        // Missing guiding-principles.md, user-personas.md, user-journeys.md
      }
      const result = validators.validateAnalysisQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.filter(i => i.category === 'missing_file')).toHaveLength(3)
    })

    it('should fail when fewer than 3 personas exist', () => {
      const artifacts = {
        'project-classification.json': '{}',
        'guiding-principles.md': '1. **Test** - Test principle\n'.repeat(5),
        'user-personas.md': `---
title: Personas
owner: analyst
version: 1.0
date: 2024-01-01
status: complete
---

## John Doe

A generic user profile.`,
        'user-journeys.md': 'content',
      }
      const result = validators.validateAnalysisQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'persona_count')).toBe(true)
    })

    it('should warn when persona names are too generic', () => {
      const artifacts = {
        'project-classification.json': '{}',
        'guiding-principles.md': '1. **Test** - Test principle\n'.repeat(5),
        'user-personas.md': `---
title: Personas
owner: analyst
version: 1.0
date: 2024-01-01
status: complete
---

## User

A generic user.

## Developer

A generic developer.`,
        'user-journeys.md': 'content',
      }
      const result = validators.validateAnalysisQuality(artifacts)
      expect(result.issues.some(i => i.category === 'persona_specificity')).toBe(true)
    })

    it('should fail when fewer than 5 guiding principles', () => {
      const artifacts = {
        'project-classification.json': '{}',
        'guiding-principles.md': '1. **Test** - Only one principle',
        'user-personas.md': `---
title: Personas
owner: analyst
version: 1.0
date: 2024-01-01
status: complete
---

## Sarah - Marketing Manager
## Tom - Business Owner
## Lisa - Designer`,
        'user-journeys.md': 'content',
      }
      const result = validators.validateAnalysisQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'principles_count')).toBe(true)
    })
  })

  describe('validatePMSpecQuality (Phase 3)', () => {
    it('should pass when all requirements are met', () => {
      const artifacts = {
        'PRD.md': `## REQ-001: User Authentication
As a User, I want to sign up with email, so that I can access the platform.

## REQ-002: User Profile
As a User, I want to create a profile, so that I can share information.

## REQ-003: Dashboard
As an Admin, I want to see a dashboard, so that I can monitor activity.

## REQ-004: Data Export
As a User, I want to export my data, so that I can backup my information.

## REQ-005: Notifications
As a User, I want to receive notifications, so that I stay informed.

## REQ-006: Search
As a User, I want to search content, so that I can find what I need.

## REQ-007: Settings
As a User, I want to manage settings, so that I can customize my experience.

## REQ-008: Analytics
As an Admin, I want to see analytics, so that I can track usage.

## REQ-009: Support
As a User, I want to contact support, so that I can get help.

## REQ-010: Social Sharing
As a User, I want to share content, so that I can promote my work.

## REQ-011: Two-Factor Auth
As a User, I want 2FA, so that my account is secure.

## REQ-012: Email Verification
As a User, I want email verification, so that I can confirm my identity.

## REQ-013: Password Reset
As a User, I want password reset, so that I can recover my account.

## REQ-014: Privacy Settings
As a User, I want privacy controls, so that I can manage my data.

## REQ-015: Activity Log
As a User, I want an activity log, so that I can see my history.`,
        'user-stories.md': `## User Story 1
As a User, I want to sign up, so that I can access the platform.

## User Story 2
As an Admin, I want to manage users, so that I can maintain the system.`,
        'acceptance-criteria.md': `# Acceptance Criteria

GIVEN a new user
WHEN they click sign up
THEN they should see the registration form

GIVEN a registered user
WHEN they enter valid credentials
THEN they should be logged in`,
      }
      const result = validators.validatePMSpecQuality(artifacts)
      expect(result.canProceed).toBe(true)
    })

    it('should fail when required files are missing', () => {
      const artifacts = {
        'PRD.md': 'content',
        // Missing user-stories.md and acceptance-criteria.md
      }
      const result = validators.validatePMSpecQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.filter(i => i.category === 'missing_file')).toHaveLength(2)
    })

    it('should fail when fewer than 15 requirements', () => {
      const artifacts = {
        'PRD.md': `# PRD

## REQ-001: Feature 1
As a User, I want feature 1.

## REQ-002: Feature 2
As a User, I want feature 2.`,
        'user-stories.md': 'content',
        'acceptance-criteria.md': 'content',
      }
      const result = validators.validatePMSpecQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'requirement_count')).toBe(true)
    })

    it('should warn when acceptance criteria lacks Gherkin format', () => {
      const artifacts = {
        'PRD.md': 'REQs here'.repeat(20),
        'user-stories.md': 'content',
        'acceptance-criteria.md': `The system should allow users to:
- Create new items
- Edit existing items
- Delete items`,
      }
      const result = validators.validatePMSpecQuality(artifacts)
      expect(result.issues.some(i => i.category === 'gherkin_format')).toBe(true)
    })
  })

  describe('validateDesignQuality (Phase 6)', () => {
    it('should pass when both design files exist with valid content', () => {
      const artifacts = {
        'component-mapping.md': `# Component Mapping

## COMP-001: Button Component
- **Journey Step**: User clicks CTA on the landing page to start the onboarding flow
- **Stack**: React + Tailwind CSS + Framer Motion
- **File**: components/ui/button.tsx
- **Description**: Primary action button with loading states and animations
- **Props**: variant, size, disabled, loading, children
- **Events**: onClick, onFocus, onBlur

## COMP-002: Card Component
- **Journey Step**: User views content in the dashboard after login
- **Stack**: React + Tailwind CSS + shadcn/ui
- **File**: components/ui/card.tsx
- **Description**: Versatile card component for displaying content summaries
- **Variants**: default, bordered, elevated
- **Slots**: header, footer, content

## COMP-003: Form Component
- **Journey Step**: User submits data during the profile creation process
- **Stack**: React + Tailwind CSS + React Hook Form + Zod
- **File**: components/ui/form.tsx
- **Description**: Accessible form with validation and error handling
- **Features**: Real-time validation, error messages, field descriptions
- **Integrations**: Works with any input components

## COMP-004: Input Component
- **Journey Step**: User enters text in search and form fields
- **Stack**: React + Tailwind CSS
- **File**: components/ui/input.tsx
- **Description**: Text input with support for labels, hints, and errors
- **Types**: text, email, password, number, search, tel, url

## COMP-005: Dialog Component
- **Journey Step**: User confirms destructive actions and views details
- **Stack**: React + Tailwind CSS + Radix UI
- **File**: components/ui/dialog.tsx
- **Description**: Modal dialog for focused user interactions
- **Variants**: default, dangerous, informative
- **Animation**: Smooth fade and scale transitions`,
        'journey-maps.md': `# Journey Maps

## User Journey 1: Onboarding
The onboarding journey guides new users through the initial setup process.

### Step 1: Landing Page
User arrives at the homepage for the first time and sees the hero section with call-to-action buttons.

### Step 2: Sign Up
User clicks the "Get Started" button and completes the registration form with email and password.

### Step 3: Email Verification
User receives and clicks the verification link in their email to activate their account.

### Step 4: Profile Setup
User completes their profile by adding a profile picture, bio, and preferences.

## User Journey 2: Creating Content
This journey covers the content creation flow from ideation to publication.

### Step 1: New Content
User navigates to the create page and starts a new content piece using the editor.

### Step 2: Edit Content
User adds title, body text, images, and formats the content using the rich text editor.

### Step 3: Preview
User previews how the content will look when published and makes final adjustments.

### Step 4: Publish
User publishes the content and receives a success confirmation.

## User Journey 3: Managing Settings
Users manage their account settings and preferences through this journey.

### Step 1: Access Settings
User navigates to the settings page from the user menu.

### Step 2: Update Preferences
User changes notification settings, privacy options, and display preferences.

### Step 3: Save Changes
User saves their changes and receives confirmation of the updated settings.

## Error States
When an error occurs during any journey step, display a clear error message at the top of the component with a retry button. For network errors, show "Connection lost - please check your internet" with a "Retry" button. For validation errors, highlight the specific field and show a helpful message below it. For authentication errors, redirect to the login page with a session expired message.

## Empty States
When no data is available in a component, display a friendly message with an illustration and call-to-action. For empty dashboards, show "No activity yet - create your first item to get started" with a "Create Item" button. For empty search results, display "No results found for [search term]" with suggestions for different searches. For empty notification lists, show "You're all caught up!" with a bell icon.

## Loading States
Show skeleton loaders while data is being fetched to improve perceived performance. Display shimmer effects that match the layout of the content being loaded. For page-level loading, show a full-screen skeleton with animated effects.

## Success States
When users complete actions successfully, show confirmation messages with relevant details. For completed forms, display "Changes saved successfully" with a checkmark icon. For published content, show "Your content is now live" with a link to view it.`,
      }
      const result = validators.validateDesignQuality(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0)
    })

    it('should fail when component-mapping.md is missing', () => {
      const artifacts = {
        'journey-maps.md': 'a'.repeat(600),
      }
      const result = validators.validateDesignQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.message.includes('component-mapping.md'))).toBe(true)
    })

    it('should fail when journey-maps.md is missing', () => {
      const artifacts = {
        'component-mapping.md': 'a'.repeat(600),
      }
      const result = validators.validateDesignQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.message.includes('journey-maps.md'))).toBe(true)
    })

    it('should fail when fewer than 3 user journeys', () => {
      const artifacts = {
        'component-mapping.md': 'a'.repeat(600),
        'journey-maps.md': `# Journey Maps

## User Journey 1: Onboarding
User completes signup process.`,
      }
      const result = validators.validateDesignQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'journey_count')).toBe(true)
    })

    it('should warn when error states are missing', () => {
      const artifacts = {
        'component-mapping.md': 'a'.repeat(600),
        'journey-maps.md': `## Journey 1
Content here.

## Journey 2
More content.

## Journey 3
Even more content.`,
      }
      const result = validators.validateDesignQuality(artifacts)
      expect(result.issues.some(i => i.category === 'error_states')).toBe(true)
    })

    it('should warn when empty states are missing', () => {
      const artifacts = {
        'component-mapping.md': 'a'.repeat(600),
        'journey-maps.md': `## Journey 1
Content here.

## Journey 2
More content.

## Journey 3
Even more content.`,
      }
      const result = validators.validateDesignQuality(artifacts)
      expect(result.issues.some(i => i.category === 'empty_states')).toBe(true)
    })

    it('should fail when placeholder code is detected', () => {
      const artifacts = {
        'component-mapping.md': 'TODO: Complete this later',
        'journey-maps.md': 'a'.repeat(600),
      }
      const result = validators.validateDesignQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'placeholder')).toBe(true)
    })
  })

  describe('validateSolutionQuality (Phase 9)', () => {
    it('should pass when all requirements are met', () => {
      const artifacts = {
        'tasks.md': `# Tasks

## TASK-001: Setup Project
### Test Specifications
Write unit tests for project setup.

### Implementation Notes
- Initialize Next.js project
- Configure TypeScript
- File: src/app/page.tsx

### Estimate: 2 hours

## TASK-002: Create Authentication
### Test Specifications
Write integration tests for auth flow.

### Implementation Notes
- Implement login/logout
- Add session management
- File: src/lib/auth.ts

### Estimate: 4 hours

## TASK-003: Build Dashboard
### Test Specifications
Write component tests for dashboard.

### Implementation Notes
- Create dashboard layout
- Add data visualization
- File: src/app/dashboard/page.tsx

### Estimate: 6 hours

## TASK-004: User Profile Page
### Test Specifications
Write tests for profile components.

### Implementation Notes
- Create profile page
- Add edit functionality
- File: src/app/profile/page.tsx

### Estimate: 4 hours

## TASK-005: Settings Page
### Test Specifications
Write tests for settings.

### Implementation Notes
- Create settings UI
- Add preference storage
- File: src/app/settings/page.tsx

### Estimate: 3 hours

## TASK-006: Data Export Feature
### Test Specifications
Write tests for data export.

### Implementation Notes
- Implement CSV export
- Add PDF generation
- File: src/lib/export.ts

### Estimate: 5 hours

## TASK-007: Notification System
### Test Specifications
Write tests for notifications.

### Implementation Notes
- Create notification service
- Add toast components
- File: src/lib/notifications.ts

### Estimate: 4 hours

## TASK-008: Search Functionality
### Test Specifications
Write tests for search.

### Implementation Notes
- Implement search API
- Create search UI
- File: src/app/search/page.tsx

### Estimate: 6 hours

## TASK-009: Analytics Dashboard
### Test Specifications
Write tests for analytics.

### Implementation Notes
- Create analytics charts
- Add data aggregation
- File: src/app/analytics/page.tsx

### Estimate: 8 hours

## TASK-010: API Routes
### Test Specifications
Write tests for API endpoints.

### Implementation Notes
- Create REST API
- Add validation
- File: src/app/api/**/*.ts

### Estimate: 6 hours

## TASK-011: Database Schema
### Test Specifications
Write tests for DB operations.

### Implementation Notes
- Design schema
- Add migrations
- File: src/db/schema.ts

### Estimate: 4 hours

## TASK-012: Error Handling
### Test Specifications
Write tests for error cases.

### Implementation Notes
- Add error boundaries
- Create fallback UI
- File: src/components/ErrorBoundary.tsx

### Estimate: 3 hours

## TASK-013: Performance Optimization
### Test Specifications
Write performance tests.

### Implementation Notes
- Add caching
- Optimize images
- File: src/lib/optimization.ts

### Estimate: 5 hours

## TASK-014: Security Hardening
### Test Specifications
Write security tests.

### Implementation Notes
- Add rate limiting
- Implement CSRF protection
- File: src/lib/security.ts

### Estimate: 4 hours

## TASK-015: Documentation
### Test Specifications
Write tests for docs generation.

### Implementation Notes
- Create API docs
- Add README files
- File: docs/**/*.md

### Estimate: 2 hours`,
        'architecture.md': 'The architecture uses Next.js with React for the frontend.',
        'stack-decision.md': 'Selected stack: Next.js',
      }
      const result = validators.validateSolutionQuality(artifacts)
      expect(result.canProceed).toBe(true)
    })

    it('should fail when tasks.md is missing', () => {
      const artifacts = {
        'architecture.md': 'content',
      }
      const result = validators.validateSolutionQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.message.includes('tasks.md missing'))).toBe(true)
    })

    it('should fail when fewer than 15 tasks', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Task 1
Description of task 1

## TASK-002: Task 2
Description of task 2

## TASK-003: Task 3
Description of task 3

## TASK-004: Task 4
Description of task 4

## TASK-005: Task 5
Description of task 5

## TASK-006: Task 6
Description of task 6

## TASK-007: Task 7
Description of task 7

## TASK-008: Task 8
Description of task 8

## TASK-009: Task 9
Description of task 9

## TASK-010: Task 10
Description of task 10

## TASK-011: Task 11
Description of task 11

## TASK-012: Task 12
Description of task 12

## TASK-013: Task 13
Description of task 13

## TASK-014: Task 14
Description of task 14`,
      }
      const result = validators.validateSolutionQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'task_count')).toBe(true)
    })

    it('should fail when implementation comes before test specifications', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Implement Feature
### Implementation Notes
First, implement the feature.

### Test Specifications
Then, write tests.

## TASK-002: Another Task
Test content here.

## TASK-003: Yet Another Task
Test content here.

## TASK-004: More Tasks
Test content here.

## TASK-005: Continue Testing
Test content here.

## TASK-006: Sixth Task
Test content here.

## TASK-007: Seventh Task
Test content here.

## TASK-008: Eighth Task
Test content here.

## TASK-009: Ninth Task
Test content here.

## TASK-010: Tenth Task
Test content here.

## TASK-011: Eleventh Task
Test content here.

## TASK-012: Twelfth Task
Test content here.

## TASK-013: Thirteenth Task
Test content here.

## TASK-014: Fourteenth Task
Test content here.

## TASK-015: Fifteenth Task
Test content here.`,
      }
      const result = validators.validateSolutionQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'test_order')).toBe(true)
    })

    it('should fail when circular dependencies are detected', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: First Task
Depends on: TASK-015

## TASK-002: Second Task
Depends on: TASK-003

## TASK-003: Third Task
Depends on: TASK-004

## TASK-004: Fourth Task
Depends on: TASK-005

## TASK-005: Fifth Task
Depends on: TASK-006

## TASK-006: Sixth Task
Depends on: TASK-007

## TASK-007: Seventh Task
Depends on: TASK-008

## TASK-008: Eighth Task
Depends on: TASK-009

## TASK-009: Ninth Task
Depends on: TASK-010

## TASK-010: Tenth Task
Depends on: TASK-011

## TASK-011: Eleventh Task
Depends on: TASK-012

## TASK-012: Twelfth Task
Depends on: TASK-013

## TASK-013: Thirteenth Task
Depends on: TASK-014

## TASK-014: Fourteenth Task
Depends on: TASK-001

## TASK-015: Fifteenth Task
Depends on: TASK-001
`,
      }
      const result = validators.validateSolutionQuality(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'circular_dependencies')).toBe(true)
    })

    it('should warn when time estimates are missing', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Task 1
### Implementation Notes
Do something.

## TASK-002: Task 2
### Implementation Notes
Do something else.`.repeat(10),
      }
      const result = validators.validateSolutionQuality(artifacts)
      expect(result.issues.some(i => i.category === 'time_estimates')).toBe(true)
    })
  })

  // ============================================================================
  // TRACEABILITY VALIDATORS TESTS (Task 11)
  // ============================================================================

  describe('validatePersonaTraceability (Task 11)', () => {
    it('should pass when all requirements reference personas', () => {
      const artifacts = {
        'PRD.md': `## REQ-001: User Authentication
As an Admin, I want to implement user authentication so that users can securely access the system.

## REQ-002: User Profile
As a User, I want to manage my profile so that I can update my personal information.

## REQ-003: Dashboard
As an Admin, I want to see a dashboard so that I can monitor system activity.`,
        'user-personas.md': `## Admin
System administrator with full access.

## User
Regular application user.`,
      }
      const result = validators.validatePersonaTraceability(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.category === 'persona_traceability')).toHaveLength(0)
    })

    it('should fail when PRD.md is missing', () => {
      const artifacts = {
        'user-personas.md': '## Admin\nAdmin persona',
      }
      const result = validators.validatePersonaTraceability(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'missing_file')).toBe(true)
    })

    it('should warn when no requirements found', () => {
      const artifacts = {
        'PRD.md': '# Product Requirements\n\nNo requirements defined yet.',
        'user-personas.md': '## Admin\nAdmin',
      }
      const result = validators.validatePersonaTraceability(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.some(i => i.category === 'no_requirements')).toBe(true)
    })

    it('should handle empty personas.md gracefully', () => {
      const artifacts = {
        'PRD.md': `## REQ-001: Feature
As a User, I want this feature.`,
        'user-personas.md': '',
      }
      const result = validators.validatePersonaTraceability(artifacts)
      expect(result.canProceed).toBe(true)
      // Should still pass since "User" is a common persona
      expect(result.issues.filter(i => i.category === 'persona_traceability')).toHaveLength(0)
    })
  })

  describe('validateGherkinStructure (Task 11)', () => {
    it('should pass when acceptance criteria use Gherkin format', () => {
      const artifacts = {
        'acceptance-criteria.md': `## Scenario: User logs in successfully
GIVEN the user is on the login page
WHEN they enter valid credentials
THEN they should be redirected to the dashboard

## Scenario: User submits invalid form
GIVEN the user is on the form page
WHEN they submit incomplete data
THEN they should see validation errors

## Scenario: Admin deletes a user
GIVEN the admin is logged in
WHEN they confirm the deletion
THEN the user should be removed from the system`,
      }
      const result = validators.validateGherkinStructure(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.category === 'gherkin_format')).toHaveLength(0)
    })

    it('should warn when acceptance criteria use generic format', () => {
      const artifacts = {
        'acceptance-criteria.md': `The system should allow users to:
- Create new items
- Edit existing items
- Delete items

As a user, I want to manage items so that I can organize my data.`,
      }
      const result = validators.validateGherkinStructure(artifacts)
      expect(result.issues.some(i => i.category === 'gherkin_format')).toBe(true)
      expect(result.issues.some(i => i.message.includes('generic user story format'))).toBe(true)
    })

    it('should fail when acceptance-criteria.md is missing', () => {
      const artifacts = {}
      const result = validators.validateGherkinStructure(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'missing_file')).toBe(true)
    })

    it('should warn when Gherkin keywords are missing', () => {
      const artifacts = {
        'acceptance-criteria.md': `## Login Criteria
Users must be able to log in with email and password.
The system should remember the user's session.
Passwords must be encrypted.`,
      }
      const result = validators.validateGherkinStructure(artifacts)
      expect(result.issues.some(i => i.category === 'gherkin_format')).toBe(true)
    })

    it('should be case-insensitive for Gherkin keywords', () => {
      const artifacts = {
        'acceptance-criteria.md': `## Scenario: User registration
given the user is on the registration page
when they fill in the form
then they should receive a confirmation email`,
      }
      const result = validators.validateGherkinStructure(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.category === 'gherkin_format')).toHaveLength(0)
    })
  })

  describe('validateRequirementToTaskMapping (Task 11)', () => {
    it('should pass when all tasks reference requirements', () => {
      const artifacts = {
        'PRD.md': `## REQ-001: User Authentication
As a User, I want to authenticate.

## REQ-002: User Profile
As a User, I want to manage profile.`,
        'tasks.md': `## TASK-001: Implement Authentication
Implement user authentication (REQ-001).

### Implementation Notes
- Add login form
- Add session management

## TASK-002: Implement Profile
Implement user profile management (REQ-002).

### Implementation Notes
- Add profile page
- Add profile editing`,
      }
      const result = validators.validateRequirementToTaskMapping(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.category === 'orphan_tasks')).toHaveLength(0)
    })

    it('should fail when tasks.md is missing', () => {
      const artifacts = {
        'PRD.md': '## REQ-001: Feature\nAs a User.',
      }
      const result = validators.validateRequirementToTaskMapping(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.category === 'missing_file')).toBe(true)
    })

    it('should warn when no TASK-XXX references found', () => {
      const artifacts = {
        'PRD.md': '## REQ-001: Feature\nAs a User.',
        'tasks.md': '## Task 1\nDo something.\n\n## Task 2\nDo something else.',
      }
      const result = validators.validateRequirementToTaskMapping(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.some(i => i.category === 'no_tasks')).toBe(true)
    })

    it('should handle tasks with multiple requirement references', () => {
      const artifacts = {
        'PRD.md': `## REQ-001: Authentication
## REQ-002: Authorization
## REQ-003: User Management`,
        'tasks.md': `## TASK-001: Auth System
Implement authentication and authorization (REQ-001, REQ-002).

## TASK-002: User API
Implement user management endpoints (REQ-003).`,
      }
      const result = validators.validateRequirementToTaskMapping(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.category === 'orphan_tasks')).toHaveLength(0)
    })

    it('should handle TASK-XXX-YYY format (nested tasks)', () => {
      const artifacts = {
        'PRD.md': `## REQ-001: Authentication Feature
As a User, I want to authenticate.

## REQ-002: Profile Feature
As a User, I want to manage my profile.`,
        'tasks.md': `## TASK-001: Authentication Module
Implement authentication (REQ-001).

### Test Specifications
Write tests for authentication.

### Implementation Notes
- Implement login
- Implement logout

## TASK-001-001: Login Implementation
Implement login functionality (part of TASK-001, implements REQ-001).

## TASK-001-002: Logout Implementation
Implement logout functionality (part of TASK-001, implements REQ-001).

## TASK-002: Profile Module
Implement profile features (REQ-002).`,
      }
      const result = validators.validateRequirementToTaskMapping(artifacts)
      // All tasks reference requirements, should have no orphan warnings
      expect(result.issues.filter(i => i.category === 'orphan_tasks')).toHaveLength(0)
    })
  })

  // ============================================================================
  // HELPER FUNCTION TESTS (Task 11)
  // ============================================================================

  describe('extractPersonaNames helper', () => {
    it('should extract persona names from markdown headers', () => {
      const content = `## Health Enthusiast
A fitness-focused user.

## Busy Professional
A time-conscious user.

## Freelance Designer
A creative user.`

      const names = validators.extractPersonaNames(content)
      expect(names).toContain('Health Enthusiast')
      expect(names).toContain('Busy Professional')
      expect(names).toContain('Freelance Designer')
    })

    it('should handle content without personas', () => {
      const content = `Some content without persona headers`

      const names = validators.extractPersonaNames(content)
      expect(names).toHaveLength(0)
    })

    it('should handle single word persona names', () => {
      const content = `## Admin
Admin persona content.`

      const names = validators.extractPersonaNames(content)
      expect(names).toContain('Admin')
    })

    it('should handle multi-word persona names', () => {
      const content = `## Health Enthusiast
Fitness-focused user.

## Busy Professional
Time-conscious user.`

      const names = validators.extractPersonaNames(content)
      expect(names).toContain('Health Enthusiast')
      expect(names).toContain('Busy Professional')
    })
  })

  describe('extractTaskReferences helper', () => {
    it('should extract TASK-XXX references', () => {
      const content = `## TASK-001: First Task
Implement authentication (REQ-001).

## TASK-002: Second Task
Implement profile (REQ-002).

## TASK-003: Third Task
Implement dashboard (REQ-001, REQ-003).`

      const refs = validators.extractTaskReferences(content)
      expect(refs).toContain('TASK-001')
      expect(refs).toContain('TASK-002')
      expect(refs).toContain('TASK-003')
    })

    it('should extract TASK-XXX-YYY nested references', () => {
      const content = `## TASK-001-001: Subtask 1
## TASK-001-002: Subtask 2`

      const refs = validators.extractTaskReferences(content)
      expect(refs).toContain('TASK-001-001')
      expect(refs).toContain('TASK-001-002')
    })

    it('should deduplicate task references', () => {
      const content = `## TASK-001: Task
Content (see TASK-001 for details).
Also see TASK-001 in the dependencies.`

      const refs = validators.extractTaskReferences(content)
      expect(refs.filter(r => r === 'TASK-001')).toHaveLength(1)
    })

    it('should return empty array for content without tasks', () => {
      const refs = validators.extractTaskReferences('No task references here')
      expect(refs).toHaveLength(0)
    })
  })

  describe('extractRequirementReferences helper', () => {
    it('should handle content without requirements', () => {
      const refs = validators.extractRequirementReferences('No requirements here')
      expect(refs).toHaveLength(0)
    })
  })

  describe('splitByRequirement helper', () => {
    it('should handle content without requirements', () => {
      const result = validators.splitByRequirement('No requirements here')
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  // ============================================================================
  // CONSTITUTIONAL COMPLIANCE VALIDATORS TESTS (Task 12)
  // Tests for all 5 Constitutional Articles
  // ============================================================================

  describe('validateSemanticGoalLocking (Article 1)', () => {
    it('should pass when all constitution files are valid', () => {
      const artifacts = {
        'constitution.md': '# Constitution\n\n1. User Privacy First - We protect user data at all costs\n2. Performance Matters - Fast is better than slow\n3. Accessibility by Default - Everyone should be able to use this\n4. Security First - No feature is worth a security compromise\n5. Simplicity Wins - Simple solutions are better',
        'project-classification.json': '{"project_type": "web_app", "scale_tier": "small"}',
        'PRD.md': 'This PRD follows the constitution guiding principles.',
        'architecture.md': 'The architecture for this web_app project follows the small scale tier.',
      }
      const result = validators.validateSemanticGoalLocking(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0)
    })

    it('should fail when constitution.md is missing', () => {
      const artifacts = {
        'project-classification.json': '{"project_type": "web_app"}',
      }
      const result = validators.validateSemanticGoalLocking(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.message.includes('constitution.md missing'))).toBe(true)
    })

    it('should fail when project-classification.json is missing', () => {
      const artifacts = {
        'constitution.md': 'a'.repeat(200),
      }
      const result = validators.validateSemanticGoalLocking(artifacts)
      expect(result.issues.some(i => i.message.includes('project-classification.json missing'))).toBe(true)
    })

    it('should fail when project-classification.json is invalid JSON', () => {
      const artifacts = {
        'constitution.md': 'a'.repeat(200),
        'project-classification.json': '{invalid json}',
      }
      const result = validators.validateSemanticGoalLocking(artifacts)
      expect(result.issues.some(i => i.message.includes('not valid JSON'))).toBe(true)
    })

    it('should warn when PRD.md does not reference constitution principles', () => {
      const artifacts = {
        'constitution.md': 'a'.repeat(200),
        'project-classification.json': '{}',
        'PRD.md': 'Some PRD content without constitution reference.',
      }
      const result = validators.validateSemanticGoalLocking(artifacts)
      expect(result.issues.some(i => i.category === 'article_1' && i.message.includes('does not reference constitution'))).toBe(true)
    })

    it('should warn when architecture.md does not reference project type', () => {
      const artifacts = {
        'constitution.md': 'a'.repeat(200),
        'project-classification.json': '{"project_type": "web_app"}',
        'architecture.md': 'Some architecture content without web_app reference.',
      }
      const result = validators.validateSemanticGoalLocking(artifacts)
      expect(result.issues.some(i => i.message.includes('does not reference project type'))).toBe(true)
    })
  })

  describe('validateTestFirstCompliance (Article 2)', () => {
    it('should pass when test specifications come before implementation', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Implement Feature
### Test Specifications
Write unit tests for the feature.

### Implementation Notes
- Implement the feature
- File: src/feature.ts

## TASK-002: Another Task
### Test Specifications
Write tests.

### Implementation Notes
- Implement the task.`,
      }
      const result = validators.validateTestFirstComplianceArt2(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.category === 'article_2')).toHaveLength(0)
    })

    it('should fail when implementation comes before test', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Implement Feature
### Implementation Notes
First, implement the feature.

### Test Specifications
Then, write tests.

## TASK-002: Another Task
Test first.

Implement second.`,
      }
      const result = validators.validateTestFirstComplianceArt2(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.message.includes('Implementation appears BEFORE test specification'))).toBe(true)
    })

    it('should handle missing tasks.md gracefully', () => {
      const artifacts = {}
      const result = validators.validateTestFirstComplianceArt2(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.some(i => i.message.includes('skipping test-first validation'))).toBe(true)
    })

    it('should handle Test: and Implement: patterns (not just ### headers)', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Task with Simple Patterns
Test: Write tests for this.
Implement: Do the work.

## TASK-002: Another Task
Test: More tests.
Implement: More work.`,
      }
      const result = validators.validateTestFirstComplianceArt2(artifacts)
      expect(result.canProceed).toBe(true)
    })

    it('should handle "Test Specifications" and "Implementation Notes" format', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Task
Test Specifications: Write tests.
Implementation Notes: Implement.`,
      }
      const result = validators.validateTestFirstComplianceArt2(artifacts)
      expect(result.canProceed).toBe(true)
    })
  })

  describe('validateBiteSizedTasks (Article 3)', () => {
    it('should pass when all tasks have time estimates and verification commands', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Setup Project
### Test Specifications
Write tests.

### Implementation Notes
- Initialize project
- File: src/app/page.tsx

### Estimate: 15min

Run: npm test

## TASK-002: Create Auth
### Test Specifications
Write auth tests.

### Implementation Notes
- Add auth logic
- File: src/lib/auth.ts

### Estimate: 30 minutes

Verify: npm run build`,
      }
      const result = validators.validateBiteSizedTasks(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0)
    })

    it('should fail when tasks lack time estimates', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Task 1
Test: Tests here.
Implement: Do work.

## TASK-002: Task 2
Test: Tests here.
Implement: Do work.`,
      }
      const result = validators.validateBiteSizedTasks(artifacts)
      expect(result.issues.some(i => i.category === 'article_3' && i.message.includes('lack time estimate'))).toBe(true)
    })

    it('should fail when tasks lack verification commands', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Task 1
### Time: 1 hour

Description of task 1.

## TASK-002: Task 2
### Time: 2 hours

Description of task 2.`,
      }
      const result = validators.validateBiteSizedTasks(artifacts)
      expect(result.issues.some(i => i.category === 'article_3' && i.message.includes('lack verification command'))).toBe(true)
    })

    it('should handle missing tasks.md gracefully', () => {
      const artifacts = {}
      const result = validators.validateBiteSizedTasks(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.some(i => i.message.includes('skipping bite-sized validation'))).toBe(true)
    })

    it('should accept various time estimate formats', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Task 1
### Time: 1 hour

## TASK-002: Task 2
### Complexity: Small

## TASK-003: Task 3
### Estimate: 45min`,
      }
      const result = validators.validateBiteSizedTasks(artifacts)
      expect(result.issues.filter(i => i.message.includes('lack time estimate'))).toHaveLength(0)
    })

    it('should accept various verification command formats', () => {
      const artifacts = {
        'tasks.md': `## TASK-001: Task 1
npm test

## TASK-002: Task 2
Run: npm run build

## TASK-003: Task 3
curl -f http://localhost:3000/api/health`,
      }
      const result = validators.validateBiteSizedTasks(artifacts)
      expect(result.issues.filter(i => i.message.includes('lack verification command'))).toHaveLength(0)
    })
  })

  describe('validateConstitutionalReview (Article 5)', () => {
    it('should pass when handoff is complete with all sections', () => {
      const artifacts = {
        'HANDOFF.md': `# Handoff Document - Complete Project Handoff

## Summary
This project has been completed successfully following the constitutional guidelines. All requirements have been implemented and tested according to the specifications.

## Key Decisions
1. Selected Next.js as the primary framework for its robust routing and server-side rendering capabilities
2. Used Drizzle ORM for type-safe database interactions and migrations
3. Implemented Better Auth for secure authentication and authorization
4. Chose Cloudflare R2 for cost-effective object storage

## Next Steps
- Deploy the application to production environment
- Set up monitoring and alerting for system health
- Document API endpoints for external integrations

## Known Issues
No critical issues remain. Minor UX improvements are tracked in the backlog.`,
        'tasks.md': 'a'.repeat(200),
        'architecture.md': 'a'.repeat(200),
        'PRD.md': 'a'.repeat(600),
      }
      const result = validators.validateConstitutionalReview(artifacts)
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0)
    })

    it('should fail when HANDOFF.md is missing', () => {
      const artifacts = {
        'tasks.md': 'a'.repeat(200),
        'architecture.md': 'a'.repeat(200),
        'PRD.md': 'a'.repeat(600),
      }
      const result = validators.validateConstitutionalReview(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.message.includes('HANDOFF.md missing'))).toBe(true)
    })

    it('should fail when required artifacts are incomplete', () => {
      const artifacts = {
        'HANDOFF.md': 'a'.repeat(300),
        'tasks.md': 'short',
        'architecture.md': 'a'.repeat(200),
        'PRD.md': 'a'.repeat(600),
      }
      const result = validators.validateConstitutionalReview(artifacts)
      expect(result.issues.some(i => i.message.includes('tasks.md missing or incomplete'))).toBe(true)
    })

    it('should fail when HANDOFF.md contains placeholders', () => {
      const artifacts = {
        'HANDOFF.md': `# Handoff Document

## Summary
TODO: Complete summary of the project.

## Next Steps
[TBD] - Determine deployment strategy.

## Known Issues
lorem ipsum dolor sit amet.`,
        'tasks.md': 'a'.repeat(200),
        'architecture.md': 'a'.repeat(200),
        'PRD.md': 'a'.repeat(600),
      }
      const result = validators.validateConstitutionalReview(artifacts)
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.message.includes('placeholder content'))).toBe(true)
    })

    it('should warn when HANDOFF.md is missing required sections', () => {
      const artifacts = {
        'HANDOFF.md': `# Handoff Document

This is just a summary section without the required headers that the validator is looking for in the handoff document.

Just some content here to make it long enough to pass the initial length check.`,
        'tasks.md': 'a'.repeat(200),
        'architecture.md': 'a'.repeat(200),
        'PRD.md': 'a'.repeat(600),
      }
      const result = validators.validateConstitutionalReview(artifacts)
      expect(result.issues.some(i => i.category === 'article_5' && i.message.includes('missing sections'))).toBe(true)
    })
  })

  describe('validateConstitutionalCompliance (Main)', () => {
    it('should pass when all constitutional requirements are met', () => {
      const artifacts = {
        'constitution.md': 'a'.repeat(200),
        'project-classification.json': '{"project_type": "web_app", "scale_tier": "small"}',
        'PRD.md': 'Follows constitution guiding principles for user-centric design.',
        'architecture.md': 'web_app project designed for small scale tier with modular architecture.',
        'tasks.md': `## TASK-001: Implement User Authentication
### Test Specifications
Write comprehensive unit tests for authentication middleware covering JWT validation, token refresh, and error handling. Implement integration tests for login and logout API endpoints.

### Implementation Notes
Implement JWT-based authentication with refresh tokens. Create user model with proper password hashing using bcrypt. Set up auth routes for login, logout, and token refresh. Implement middleware for protected routes.

### Estimate: 30min
Run: npm test --auth --integration`,
        'HANDOFF.md': `# Handoff Document - Complete Project Handoff

## Summary
Project completed successfully following all constitutional guidelines.

## Key Decisions
Made several key architectural decisions aligned with project goals.

## Next Steps
Deploy to production and monitor system performance.

## Known Issues
No critical issues remain. Minor UX improvements are tracked.`,
      }
      const result = validators.validateConstitutionalComplianceArt(artifacts, 'SOLUTIONING')
      expect(result.canProceed).toBe(true)
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0)
    })

    it('should fail when Article 2 is violated (test after implement)', () => {
      const artifacts = {
        'constitution.md': 'a'.repeat(200),
        'project-classification.json': '{"project_type": "web_app", "scale_tier": "small"}',
        'PRD.md': 'Follows constitution principles.',
        'architecture.md': 'web_app project.',
        'tasks.md': `## TASK-001: Implement User Authentication
### Implementation Notes
Implement JWT-based authentication with refresh tokens. Create user model, auth routes, and middleware.

### Test Specifications
Write unit tests for auth middleware, integration tests for login/logout flows.

### Estimate: 30min
Run: npm test`,
      }
      const result = validators.validateConstitutionalComplianceArt(artifacts, 'SOLUTIONING')
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.message.includes('Implementation appears BEFORE test specification'))).toBe(true)
    })

    it('should check Article 5 when phase is DONE', () => {
      const artifacts = {}
      const result = validators.validateConstitutionalComplianceArt(artifacts, 'DONE')
      expect(result.canProceed).toBe(false)
      expect(result.issues.some(i => i.message.includes('HANDOFF.md missing'))).toBe(true)
    })

    it('should not check Article 5 when phase is not DONE and no HANDOFF.md', () => {
      const artifacts = {
        'constitution.md': 'a'.repeat(200),
        'project-classification.json': '{}',
        'tasks.md': `## TASK-001: Task
### Test Specifications
Tests.
### Implementation Notes
Work.
### Estimate: 15min`,
      }
      const result = validators.validateConstitutionalComplianceArt(artifacts, 'SOLUTIONING')
      expect(result.canProceed).toBe(true)
    })
  })
})
