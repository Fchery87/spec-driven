# Production Utilities Usage Guide

Quick reference for using the new production-hardening utilities.

## 1. Rate Limiting

Apply rate limiting to expensive operations (LLM calls, file uploads, etc.).

### Basic Usage

```typescript
import { llmLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limiter';

export async function POST(req: Request) {
  // Get rate limit key (uses user ID if available, falls back to IP)
  const key = getRateLimitKey(req, userId);

  // Check if allowed
  const allowed = await llmLimiter.isAllowed(key);

  if (!allowed) {
    // Return rate limit exceeded response
    const remaining = llmLimiter.getRemainingPoints(key);
    return createRateLimitResponse(remaining, Date.now() + 60000, 60);
  }

  // Proceed with operation
  return NextResponse.json({ success: true });
}
```

### Custom Rate Limits

```typescript
import { RateLimiter, generalLimiter, authLimiter } from '@/lib/rate-limiter';

// Use pre-configured limiters
const allowed = await generalLimiter.isAllowed(key); // 100 req/min
const allowed = await authLimiter.isAllowed(key);     // 5 req/min

// Create custom limiter
const customLimiter = new RateLimiter({
  points: 20,        // Allow 20 requests
  duration: 60,      // Per 60 seconds
  blockDuration: 600 // Block for 10 minutes
});
```

---

## 2. Correlation IDs

Track requests across logs for easier debugging and tracing.

### Server-Side

```typescript
import { withCorrelationId, getCorrelationId } from '@/lib/correlation-id';

// Option 1: Use middleware wrapper
export const POST = withCorrelationId(async (req: Request) => {
  const correlationId = getCorrelationId();
  logger.info('Processing request', { correlationId });

  // ... your handler
  return NextResponse.json({ success: true });
});

// Option 2: Manual usage
export async function GET(req: Request) {
  const correlationId = req.headers.get('x-correlation-id') || generateUUID();
  logger.debug('Request received', { correlationId });

  // ... your handler
}
```

### Client-Side

```typescript
import { getCorrelationId, withCorrelationIdFetch } from '@/lib/correlation-id';

// Automatic correlation ID injection
const response = await fetch('/api/endpoint',
  withCorrelationIdFetch('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify(data),
  })
);

// Manual usage
const correlationId = getCorrelationId();
const response = await fetch('/api/endpoint', {
  headers: {
    'x-correlation-id': correlationId,
  },
});
```

---

## 3. Structured Logging

Use the logger utility for production-grade logging with correlation IDs.

### Basic Usage

```typescript
import { logger } from '@/lib/logger';

// Debug level
logger.debug('Operation started', { userId: '123', action: 'upload' });

// Info level
logger.info('File uploaded successfully', { fileSize: 1024, format: 'json' });

// Warning level
logger.warn('Slow database query', { duration: 5000, query: 'SELECT ...' });

// Error level with error object
try {
  await risky Operation();
} catch (error) {
  logger.error('Operation failed', error instanceof Error ? error : new Error(String(error)), {
    userId: '123',
    operation: 'risky_operation',
  });
}
```

### In React Components

```typescript
import { useLogger } from '@/lib/logger';

export function MyComponent() {
  const { log, logEvent, logError } = useLogger('MyComponent');

  const handleClick = async () => {
    logEvent('button_clicked', { button: 'submit' });

    try {
      await submitForm();
      logEvent('form_submitted_success');
    } catch (error) {
      logError('Form submission failed', error);
    }
  };

  return <button onClick={handleClick}>Submit</button>;
}
```

### Production Output (JSON)

```json
{
  "timestamp": "2025-11-16T12:34:56.789Z",
  "level": "ERROR",
  "message": "Operation failed",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "context": {
    "userId": "123",
    "operation": "risky_operation"
  },
  "error": {
    "name": "TypeError",
    "message": "Cannot read property 'x' of undefined",
    "stack": "at risky_operation (/path/to/file.ts:123:45)"
  }
}
```

---

## 4. Configuration Constants

Centralize configuration with type-safe helpers.

### Basic Usage

```typescript
import { ARTIFACT_CONFIG, getArtifactPath, getRequiredFilesForPhase } from '@/lib/config';

// Use pre-built paths
const path = getArtifactPath('my-project', 'SPEC', 'PRD.md');
// Result: /projects/my-project/specs/SPEC/v1/PRD.md

// Get required files for phase
const required = getRequiredFilesForPhase('SPEC');
// Result: ['PRD.md', 'data-model.md', 'api-spec.json']

// Type-safe phase checking
if (isValidPhase(userInput)) {
  console.log('Phase is valid');
}
```

### Configuration Values

```typescript
import { RATE_LIMIT_CONFIG, LOGGING_CONFIG, LLM_CONFIG } from '@/lib/config';

// Access rate limit settings
const llmLimit = RATE_LIMIT_CONFIG.llm.points; // 10
const blockDuration = RATE_LIMIT_CONFIG.llm.blockDuration; // 300

// Access logging settings
const logLevel = LOGGING_CONFIG.level; // 'info'
const aggregationEnabled = LOGGING_CONFIG.aggregation.enabled; // false

// Access LLM settings
const model = LLM_CONFIG.model; // 'gemini-1.5-pro'
const timeout = LLM_CONFIG.timeout; // 300000
```

### Environment Variables

```bash
# Artifact configuration
ARTIFACT_BASE_DIR=/projects
ARTIFACT_VERSION=v1

# Rate limiting
RATE_LIMIT_GENERAL_POINTS=100
RATE_LIMIT_GENERAL_DURATION=60
RATE_LIMIT_LLM_POINTS=10
RATE_LIMIT_LLM_DURATION=60
RATE_LIMIT_LLM_BLOCK=300

# Logging
LOG_LEVEL=info
LOG_AGGREGATION_ENABLED=false
LOG_AGGREGATION_PROVIDER=vercel
```

---

## 5. Concurrent Execution Safeguards

Prevent race conditions, duplicate work, and ensure idempotency.

### Deduplication (Prevent Duplicate Work)

```typescript
import { deduplicator } from '@/lib/execution-guard';

export async function POST(req: Request) {
  const projectId = req.params.slug;

  // If multiple requests arrive simultaneously for same project,
  // only execute once and return same result to all
  const result = await deduplicator.deduplicate(
    `project:${projectId}:analysis`,
    () => expensiveAnalysis(projectId)
  );

  return NextResponse.json(result);
}
```

### Idempotency (Safe Retries)

```typescript
import { idempotencyTracker } from '@/lib/execution-guard';

export async function POST(req: Request) {
  // Get idempotency key from request header (client provides it)
  const idempotencyKey = req.headers.get('idempotency-key');

  // Check if already processed
  if (idempotencyTracker.has(idempotencyKey)) {
    logger.info('Returning cached idempotent result', { idempotencyKey });
    return NextResponse.json(idempotencyTracker.get(idempotencyKey));
  }

  // Process request
  const result = await processPayment();

  // Cache result for future idempotent requests
  idempotencyTracker.set(idempotencyKey, result);

  return NextResponse.json(result);
}
```

### Distributed Locking (Coordinate Work)

```typescript
import { lockManager } from '@/lib/execution-guard';

export async function POST(req: Request) {
  const resourceId = `project:${req.params.slug}`;
  const ownerId = userId;

  // Try to acquire lock
  const token = lockManager.tryAcquire(resourceId, ownerId);

  if (!token) {
    // Resource is locked by someone else
    return NextResponse.json(
      { error: 'Resource is currently being processed by another request' },
      { status: 409 } // Conflict
    );
  }

  try {
    // Do work while holding lock
    const result = await exclusiveOperation();
    return NextResponse.json(result);
  } finally {
    // Always release lock
    lockManager.release(resourceId, ownerId);
  }
}
```

### High-Order Function (All Guards)

```typescript
import { withConcurrencyGuard } from '@/lib/execution-guard';

// Wrap expensive operation with all safeguards
const safePhaseExecution = withConcurrencyGuard(
  async (projectId: string, phase: string) => {
    // Your expensive operation
    const result = await executePhase(projectId, phase);
    return result;
  },
  {
    // Deduplicate: same (projectId, phase) = same execution
    deduplicationKey: (projectId, phase) =>
      `phase:${projectId}:${phase}`,

    // Idempotency: same idempotency-key = same result
    idempotencyKey: (projectId, phase) =>
      req.headers.get('idempotency-key'),

    // Lock: coordinate across instances
    lockKey: (projectId, phase) =>
      `lock:project:${projectId}`,

    // Owner for lock tracking
    ownerId: userId,
  }
);

// Execute with all safeguards in place
const result = await safePhaseExecution(projectId, phase);
```

---

## 6. Common Patterns

### API Route with All Safeguards

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { llmLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limiter';
import { withCorrelationId, getCorrelationId } from '@/lib/correlation-id';
import { lockManager } from '@/lib/execution-guard';

export const POST = withCorrelationId(async (req: NextRequest) => {
  const correlationId = getCorrelationId();
  const userId = req.user?.id;
  const projectId = req.params.slug;

  try {
    // 1. Rate limit check
    const key = getRateLimitKey(req, userId);
    const allowed = await llmLimiter.isAllowed(key);
    if (!allowed) {
      logger.warn('Rate limit exceeded', { userId, correlationId });
      return createRateLimitResponse(0, Date.now() + 60000, 60);
    }

    // 2. Acquire lock
    const lockToken = lockManager.tryAcquire(`project:${projectId}`, userId);
    if (!lockToken) {
      logger.info('Resource locked', { projectId, correlationId });
      return NextResponse.json(
        { error: 'Resource is currently being processed' },
        { status: 409 }
      );
    }

    try {
      // 3. Log operation start
      logger.info('Starting phase execution', {
        projectId,
        phase: 'SPEC',
        userId,
      });

      // 4. Execute operation
      const result = await executePhase(projectId, 'SPEC');

      // 5. Log success
      logger.info('Phase execution completed', {
        projectId,
        duration: '5000ms',
      });

      return NextResponse.json({ success: true, data: result });
    } finally {
      // 6. Always release lock
      lockManager.release(`project:${projectId}`, userId);
    }
  } catch (error) {
    // 7. Log error with context
    logger.error('Phase execution failed', error instanceof Error ? error : new Error(String(error)), {
      projectId,
      correlationId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
```

### React Component with Logging

```typescript
'use client';

import { useState } from 'react';
import { useLogger } from '@/lib/logger';

export function UploadForm() {
  const [loading, setLoading] = useState(false);
  const { log, logEvent, logError } = useLogger('UploadForm');

  const handleUpload = async (file: File) => {
    logEvent('upload_started', { filename: file.name, size: file.size });
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      logEvent('upload_completed', { fileId: result.id });
      log('File uploaded successfully');
    } catch (error) {
      logError(
        'Upload failed',
        error instanceof Error ? error : new Error(String(error)),
        { filename: file.name }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const file = (e.target as HTMLFormElement).elements['file'] as HTMLInputElement;
      if (file.files?.[0]) {
        handleUpload(file.files[0]);
      }
    }}>
      <input type="file" name="file" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  );
}
```

---

## Migration Checklist

As you integrate these utilities into more routes:

- [ ] Apply rate limiting to `/api/projects/*/execute-phase`
- [ ] Apply rate limiting to `/api/projects/*/approve-*` endpoints
- [ ] Replace all console.log in API routes with logger
- [ ] Apply correlation ID middleware to all API routes
- [ ] Add idempotency check to POST endpoints
- [ ] Add lock acquisition to exclusive operations
- [ ] Configure log aggregation endpoint
- [ ] Test rate limiting under load
- [ ] Monitor correlation IDs in logs
- [ ] Update API documentation with rate limits

---

**Last Updated:** November 16, 2025
