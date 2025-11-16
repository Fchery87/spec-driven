import { describe, it, expect } from 'vitest'
import { Validators } from './validators'

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
})
