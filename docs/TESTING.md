# Testing Guide

**Status:** ✅ Vitest framework set up with unit tests for critical paths
**Last Updated:** November 14, 2025

---

## Overview

This project uses **Vitest** for fast, unit testing with full TypeScript support. Tests focus on critical paths:

- Error handling and error codes
- Input validation and sanitization
- Password hashing and verification
- Authentication logic

---

## Quick Start

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Watch mode (re-runs on file changes)
npm test -- --watch

# Run specific test file
npm test -- error_handler.test.ts

# Run tests matching pattern
npm test -- --grep "password"
```

### View Results

```bash
# Show coverage report
npm run test:coverage

# Open interactive UI
npm run test:ui
```

---

## Architecture

### Configuration Files

**vitest.config.ts** - Vitest configuration
- Environment: `jsdom` for DOM testing
- Global test utilities enabled
- Path aliases configured (@/backend, @/components, etc.)
- Coverage targets: 80% lines, functions, statements; 75% branches

**vitest.setup.ts** - Test setup and mocks
- Testing library cleanup after each test
- Environment variables for testing
- Next.js router mocks
- Next.js navigation mocks

### Test Files

Tests are colocated with source files using `.test.ts` suffix:

```
backend/
├── lib/
│   ├── error_handler.ts
│   ├── error_handler.test.ts      ← Tests
│   ├── sanitizer.ts
│   ├── sanitizer.test.ts          ← Tests
│   ├── validation_schemas.ts
│   └── validation_schemas.test.ts ← Tests
└── services/auth/
    ├── password_service.ts
    └── password_service.test.ts   ← Tests
```

---

## Test Coverage

### Current Tests

#### 1. Error Handler Tests (`error_handler.test.ts`)

**Tests:** 25+ test cases

```typescript
✓ AppError class creation and properties
✓ Error code to HTTP status mapping
✓ Error response formatting
✓ Predefined error creators (Errors helper)
  - validationError()
  - missingField()
  - unauthorized()
  - invalidToken()
  - forbidden()
  - notFound()
  - projectNotFound()
  - duplicateEmail()
  - rateLimitExceeded()
  - databaseError()
```

**Running:**
```bash
npm test -- error_handler.test.ts
```

#### 2. Sanitizer Tests (`sanitizer.test.ts`)

**Tests:** 30+ test cases

```typescript
✓ HTML escaping (XSS prevention)
✓ Dangerous character removal
✓ File path sanitization (directory traversal prevention)
✓ SQL input sanitization (SQL injection prevention)
✓ URL validation (XSS via URLs)
✓ Email normalization
✓ Markdown content cleaning
✓ JSON recursive sanitization
✓ Dangerous content detection
  - Scripts
  - Event handlers
  - JavaScript protocol
  - Iframe/object/embed tags
```

**Running:**
```bash
npm test -- sanitizer.test.ts
```

#### 3. Password Service Tests (`password_service.test.ts`)

**Tests:** 20+ test cases

```typescript
✓ Password hashing
✓ Password verification
✓ Random password generation
✓ Password strength checking
  - Minimum length enforcement
  - Character type requirements
  - Strength scoring
  - Feedback messages
```

**Running:**
```bash
npm test -- password_service.test.ts
```

#### 4. Validation Schemas Tests (`validation_schemas.test.ts`)

**Tests:** 20+ test cases

```typescript
✓ Register schema validation
✓ Login schema validation
✓ Create project schema validation
✓ Approve stack schema validation
✓ Email normalization
✓ Field length validation
✓ Pattern validation (slug format)
✓ Optional field handling
```

**Running:**
```bash
npm test -- validation_schemas.test.ts
```

---

## Test Examples

### Example 1: Error Handler

```typescript
describe('AppError', () => {
  it('should create an error with code and message', () => {
    const error = new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Test error message',
      400
    );

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe('Test error message');
    expect(error.statusCode).toBe(400);
  });
});
```

### Example 2: Password Hashing

```typescript
describe('PasswordService', () => {
  it('should verify correct password', async () => {
    const password = 'MySecurePass123!';
    const hash = await service.hashPassword(password);
    const isValid = await service.verifyPassword(password, hash);

    expect(isValid).toBe(true);
  });
});
```

### Example 3: Input Validation

```typescript
describe('RegisterSchema', () => {
  it('should validate correct registration data', () => {
    const data = {
      email: 'user@example.com',
      name: 'John Doe',
      password: 'SecurePass123!'
    };

    expect(() => RegisterSchema.parse(data)).not.toThrow();
  });
});
```

---

## Running Tests

### All Tests

```bash
npm test
```

Output:
```
✓ backend/lib/error_handler.test.ts (25)
✓ backend/lib/sanitizer.test.ts (30)
✓ backend/lib/validation_schemas.test.ts (20)
✓ backend/services/auth/password_service.test.ts (20)

Test Files  4 passed (4)
     Tests  95 passed (95)
```

### Watch Mode

```bash
npm test -- --watch
```

Automatically re-runs tests when files change.

### Specific Test File

```bash
npm test -- error_handler.test.ts
```

### Test Pattern

```bash
npm test -- --grep "password"
```

Runs only tests with "password" in the name.

### Coverage Report

```bash
npm run test:coverage
```

Generates coverage report:

```
------ Coverage summary ------
Statements   : 85% ( 200/235 )
Branches     : 82% ( 45/55 )
Functions    : 87% ( 30/35 )
Lines        : 86% ( 180/210 )
```

### Interactive UI

```bash
npm run test:ui
```

Opens browser with interactive test viewer showing:
- Test results
- Code coverage
- Test file browser
- Live rerun on changes

---

## Writing New Tests

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature Name', () => {
  // Setup
  beforeEach(() => {
    // Before each test
  });

  // Cleanup
  afterEach(() => {
    // After each test
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });

  describe('Nested describe block', () => {
    it('should do something else', () => {
      // Test code
    });
  });
});
```

### Common Assertions

```typescript
// Equality
expect(value).toBe(5);           // Exact equality
expect(obj).toEqual(expectedObj); // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(5);
expect(value).toBeGreaterThanOrEqual(5);
expect(value).toBeLessThan(10);

// Strings
expect(text).toContain('substring');
expect(text).toMatch(/regex/);

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain('item');

// Objects
expect(obj).toHaveProperty('property');

// Async
await expect(promise).rejects.toThrow();
await expect(promise).resolves.toBe(value);
```

### Testing Async Functions

```typescript
it('should hash a password', async () => {
  const password = 'MyPass123!';
  const hash = await service.hashPassword(password);

  expect(hash).toBeDefined();
  expect(hash).not.toBe(password);
});
```

### Testing Error Throwing

```typescript
it('should reject invalid password', async () => {
  await expect(
    service.hashPassword('short')
  ).rejects.toThrow();
});
```

---

## Next Steps

### Add Integration Tests

Test API route handlers:

```typescript
// tests/api/auth/login.test.ts
describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user@example.com',
        password: 'SecurePass123!'
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
```

### Add E2E Tests

Test complete workflows with Playwright:

```typescript
// e2e/auth.spec.ts
test('user can register and login', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'SecurePass123!');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
});
```

### Mock External Services

Mock LLM calls in tests:

```typescript
import { vi } from 'vitest';

vi.mock('@/backend/services/llm/gemini_client', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    executeAgent: vi.fn().mockResolvedValue({
      content: 'Mocked response'
    })
  }))
}));
```

### Test Database Operations

Use in-memory database for tests:

```typescript
beforeEach(async () => {
  // Create test database
  await setupTestDatabase();
});

afterEach(async () => {
  // Clean up test database
  await teardownTestDatabase();
});
```

---

## Coverage Goals

Target coverage by component:

| Component | Target | Current |
|-----------|--------|---------|
| Error Handler | 95% | 100% |
| Sanitizer | 90% | 100% |
| Validation | 90% | 100% |
| Password Service | 95% | 100% |
| Auth Service | 80% | Pending |
| DB Service | 80% | Pending |
| API Routes | 70% | Pending |
| React Components | 60% | Pending |

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Troubleshooting

### Tests Not Found

Ensure test files use `.test.ts` or `.spec.ts` suffix:

```bash
# Good
error_handler.test.ts
password_service.spec.ts

# Bad
error_handler_test.ts
test_error_handler.ts
```

### Module Resolution Issues

Check path aliases in `vitest.config.ts` match `tsconfig.json`:

```typescript
// vitest.config.ts
alias: {
  '@': path.resolve(__dirname, './'),
  '@/backend': path.resolve(__dirname, './backend')
}
```

### Timeout Issues

Increase timeout for slow tests:

```typescript
it('should do something slow', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Mock Not Working

Ensure mocks are defined before imports:

```typescript
// Good
vi.mock('./module', () => ({ ... }));
import { functionFromModule } from './module';

// Bad
import { functionFromModule } from './module';
vi.mock('./module', () => ({ ... }));
```

---

## References

- **Vitest Docs:** https://vitest.dev/
- **Testing Library:** https://testing-library.com/
- **Best Practices:** https://testingjavascript.com/

---

**Generated:** November 14, 2025
**Status:** ✅ Test framework configured with 95+ unit tests
