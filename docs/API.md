# API Reference

Complete API endpoint documentation for the Spec-Driven Platform. All endpoints are built on Next.js 14 API Routes and implement RESTful principles.

## Table of Contents
- [Base URL & Authentication](#base-url--authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Authentication Endpoints](#authentication-endpoints)
- [Project Endpoints](#project-endpoints)
- [Workflow Endpoints](#workflow-endpoints)
- [Artifact Endpoints](#artifact-endpoints)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Base URL & Authentication

### Base URL
```
http://localhost:3000/api           # Development
https://yourdomain.com/api          # Production
```

### Authentication
All endpoints (except auth) require **Better Auth session** via HTTP-only cookies.

**Cookie Flow**:
1. User logs in → receives `__auth_session` cookie
2. Subsequent requests automatically include cookie
3. Middleware validates cookie and extracts user ID
4. Unauthenticated requests return `401 Unauthorized`

### Headers
All requests should include:
```
Content-Type: application/json
Cookie: __auth_session=<session-token>  # Auto-managed by browser
```

---

## Response Format

### Success Response (2xx)
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "..."
  }
}
```

### Error Response (4xx, 5xx)
```json
{
  "success": false,
  "error": "Error message",
  "details": {
    "field": ["validation error"]
  }
}
```

### Validation Error (400)
```json
{
  "success": false,
  "error": "Invalid input",
  "details": {
    "name": ["Project name is required"],
    "description": ["Must not exceed 1000 characters"]
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Validation error, invalid input |
| 401 | Unauthorized | Missing/invalid session, unauthenticated |
| 403 | Forbidden | User not owner of resource |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate key, invalid state transition |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |

### Common Error Messages

```json
{
  "error": "Unauthorized",
  "details": {}
}
```

```json
{
  "error": "Project not found",
  "details": { "slug": "Unknown project" }
}
```

```json
{
  "error": "Invalid input",
  "details": { "stack_choice": ["Stack choice is required"] }
}
```

---

## Authentication Endpoints

### POST /api/auth/register
Register a new user.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "name": "John Doe"
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "session": {
      "token": "jwt-token"
    }
  }
}
```

**Errors**:
- `400` - Validation error (email format, password strength)
- `409` - Email already registered

---

### POST /api/auth/login
Authenticate user and create session.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "session": {
      "token": "jwt-token"
    }
  }
}
```

**Errors**:
- `401` - Invalid credentials
- `404` - User not found

---

### POST /api/auth/logout
Destroy user session.

**Request**: (No body required)

**Response (200)**:
```json
{
  "success": true,
  "data": {}
}
```

---

### GET /api/auth/get-session
Get current session and authenticated user.

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session-uuid",
      "expiresAt": "2025-11-26T12:00:00Z"
    },
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

**Response (200 - Not authenticated)**:
```json
{
  "success": true,
  "data": null
}
```

---

## Project Endpoints

### GET /api/projects
List all projects owned by authenticated user.

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Pagination page |
| limit | number | 20 | Results per page |
| sort | string | created_at | Sort field |
| order | string | desc | Sort order (asc/desc) |

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "project-uuid",
      "slug": "my-awesome-project",
      "name": "My Awesome Project",
      "description": "Project description",
      "currentPhase": "SPEC",
      "phasesCompleted": "ANALYSIS,STACK_SELECTION",
      "stackApproved": true,
      "dependenciesApproved": false,
      "createdAt": "2025-11-25T10:00:00Z",
      "updatedAt": "2025-11-26T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

---

### POST /api/projects
Create a new project. **Requires authentication**.

**Request**:
```json
{
  "name": "My Awesome Project",
  "description": "A detailed description of the project"
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "id": "project-uuid",
    "slug": "my-awesome-project",
    "name": "My Awesome Project",
    "description": "A detailed description of the project",
    "currentPhase": "ANALYSIS",
    "phasesCompleted": "",
    "stackApproved": false,
    "dependenciesApproved": false,
    "createdAt": "2025-11-26T14:30:00Z",
    "updatedAt": "2025-11-26T14:30:00Z"
  }
}
```

**Errors**:
- `400` - Validation error (name required, max 100 chars)
- `401` - Unauthorized
- `409` - Slug already exists

---

### GET /api/projects/[slug]
Get project details by slug. **Requires authentication & ownership**.

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "project-uuid",
    "slug": "my-awesome-project",
    "name": "My Awesome Project",
    "description": "Description",
    "currentPhase": "SPEC",
    "phasesCompleted": "ANALYSIS,STACK_SELECTION",
    "stackApproved": true,
    "dependenciesApproved": false,
    "metadata": {
      "created_by_id": "user-uuid",
      "slug": "my-awesome-project",
      "name": "My Awesome Project"
    }
  }
}
```

**Errors**:
- `401` - Unauthorized
- `404` - Project not found or not owned

---

### PUT /api/projects/[slug]
Update project metadata. **Requires authentication & ownership**.

**Request**:
```json
{
  "name": "Updated Project Name",
  "description": "Updated description"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "project-uuid",
    "slug": "my-awesome-project",
    "name": "Updated Project Name",
    "description": "Updated description",
    "updatedAt": "2025-11-26T15:00:00Z"
  }
}
```

**Errors**:
- `400` - Validation error
- `401` - Unauthorized
- `404` - Project not found

---

### DELETE /api/projects/[slug]
Delete project and all artifacts. **Requires authentication & ownership**. **WARNING: Permanent deletion!**

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "message": "Project deleted successfully"
  }
}
```

**Errors**:
- `401` - Unauthorized
- `404` - Project not found

---

## Workflow Endpoints

### POST /api/projects/[slug]/execute-phase
Execute current phase and generate artifacts. **Requires authentication & ownership**.

**Request**:
```json
{
  "user_input": "Additional context or requirements for this phase"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "phase": "ANALYSIS",
    "nextPhase": "STACK_SELECTION",
    "artifacts": [
      {
        "filename": "constitution.md",
        "content": "# Project Constitution\n...",
        "phase": "ANALYSIS",
        "version": 1
      },
      {
        "filename": "project-brief.md",
        "content": "# Project Brief\n...",
        "phase": "ANALYSIS",
        "version": 1
      },
      {
        "filename": "personas.md",
        "content": "# User Personas\n...",
        "phase": "ANALYSIS",
        "version": 1
      }
    ],
    "executionTime": 45000,
    "tokenUsage": {
      "promptTokens": 2150,
      "completionTokens": 1820,
      "totalTokens": 3970
    }
  }
}
```

**Errors**:
- `400` - Invalid phase transition or missing required fields
- `401` - Unauthorized
- `404` - Project not found
- `409` - Cannot proceed (gate blocked, invalid state)
- `429` - Rate limit exceeded (LLM quota)

---

### POST /api/projects/[slug]/approve-stack
Approve technology stack selection. **Requires authentication & ownership**.

**Request**:
```json
{
  "stack_choice": "React + Node.js + PostgreSQL",
  "reasoning": "Chosen for scalability and team expertise",
  "platform": "Web"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "phase": "STACK_SELECTION",
    "nextPhase": "SPEC",
    "stackApproved": true,
    "stack": {
      "choice": "React + Node.js + PostgreSQL",
      "reasoning": "Chosen for scalability and team expertise",
      "platform": "Web"
    },
    "artifact": {
      "filename": "stack-decision.md",
      "phase": "STACK_SELECTION",
      "version": 1
    }
  }
}
```

**Errors**:
- `400` - Invalid stack choice
- `401` - Unauthorized
- `404` - Project not found
- `409` - Already approved or invalid state

---

### POST /api/projects/[slug]/approve-dependencies
Approve proposed dependencies. **Requires authentication & ownership**.

**Request**:
```json
{
  "notes": "Dependencies approved for production use"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "phase": "DEPENDENCIES",
    "nextPhase": "SOLUTIONING",
    "dependenciesApproved": true,
    "dependencies": {
      "npm_packages": [...],
      "security_baseline": {...},
      "approved_at": "2025-11-26T15:30:00Z"
    },
    "artifact": {
      "filename": "DEPENDENCIES.md",
      "phase": "DEPENDENCIES",
      "version": 1
    }
  }
}
```

**Errors**:
- `400` - Invalid request
- `401` - Unauthorized
- `404` - Project not found
- `409` - Already approved or invalid state

---

## Artifact Endpoints

### GET /api/projects/[slug]/artifacts
List all artifacts for project. **Requires authentication & ownership**.

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| phase | string | all | Filter by phase (ANALYSIS, SPEC, etc.) |
| version | number | all | Filter by version |

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "artifact-uuid",
      "filename": "constitution.md",
      "phase": "ANALYSIS",
      "version": 1,
      "sizeBytes": 2450,
      "createdAt": "2025-11-25T10:00:00Z"
    },
    {
      "id": "artifact-uuid",
      "filename": "project-brief.md",
      "phase": "ANALYSIS",
      "version": 1,
      "sizeBytes": 3120,
      "createdAt": "2025-11-25T10:02:00Z"
    }
  ],
  "total": 12
}
```

---

### GET /api/projects/[slug]/artifacts/[artifactId]
Get artifact content. **Requires authentication & ownership**.

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "artifact-uuid",
    "filename": "constitution.md",
    "phase": "ANALYSIS",
    "version": 1,
    "content": "# Project Constitution\n\n## Vision\n...",
    "createdAt": "2025-11-25T10:00:00Z"
  }
}
```

**Errors**:
- `401` - Unauthorized
- `404` - Artifact or project not found

---

### POST /api/projects/[slug]/generate-handoff
Generate HANDOFF.md and create downloadable ZIP. **Requires authentication & ownership & all phases complete**.

**Request**:
```json
{
  "format": "zip"  // Options: zip, tar
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "filename": "spec-driven-my-awesome-project.zip",
    "downloadUrl": "https://yourdomain.com/api/projects/my-awesome-project/download",
    "size": 125430,
    "artifacts": 15,
    "createdAt": "2025-11-26T15:45:00Z"
  }
}
```

**Errors**:
- `400` - Workflow not complete
- `401` - Unauthorized
- `404` - Project not found

---

### GET /api/projects/[slug]/download
Download generated spec package. **Requires authentication & ownership**.

**Response**: Binary file (ZIP/TAR)

```
spec-driven-my-awesome-project.zip
├── HANDOFF.md                    # Complete project spec
├── ANALYSIS/
│   ├── constitution.md
│   ├── project-brief.md
│   └── personas.md
├── SPEC/
│   ├── PRD.md
│   ├── data-model.md
│   └── api-spec.json
├── DEPENDENCIES/
│   ├── DEPENDENCIES.md
│   └── approval.md
├── SOLUTIONING/
│   ├── architecture.md
│   ├── epics.md
│   ├── tasks.md
│   └── plan.md
└── README.md                     # Instructions
```

**Errors**:
- `401` - Unauthorized
- `404` - Project not found or not ready for download

---

## Rate Limiting

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640685600
```

### Limits by Endpoint Category

| Category | Limit | Window |
|----------|-------|--------|
| Auth (login, register) | 5 | 15 minutes |
| General API | 100 | 1 hour |
| LLM (phase execution) | 20 | 1 hour |
| File uploads | 10 | 1 hour |

### When Rate Limited

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "details": {
    "retryAfter": 3600,
    "limit": 20,
    "window": "1 hour"
  }
}
```

HTTP Status: `429 Too Many Requests`

---

## Examples

### Complete Workflow Example

#### 1. Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecurePass123!",
    "name": "Jane Developer"
  }'
```

Response: `201 Created` + Session cookie

#### 2. Create Project

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: __auth_session=..." \
  -d '{
    "name": "AI Chat Application",
    "description": "Real-time chat with GPT integration"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "proj-123",
    "slug": "ai-chat-application",
    "currentPhase": "ANALYSIS"
  }
}
```

#### 3. Execute Analysis Phase

```bash
curl -X POST http://localhost:3000/api/projects/ai-chat-application/execute-phase \
  -H "Content-Type: application/json" \
  -H "Cookie: __auth_session=..." \
  -d '{
    "user_input": "Real-time chat application with AI language model integration"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "phase": "ANALYSIS",
    "nextPhase": "STACK_SELECTION",
    "artifacts": [
      { "filename": "constitution.md", "version": 1 },
      { "filename": "project-brief.md", "version": 1 },
      { "filename": "personas.md", "version": 1 }
    ]
  }
}
```

#### 4. Approve Stack

```bash
curl -X POST http://localhost:3000/api/projects/ai-chat-application/approve-stack \
  -H "Content-Type: application/json" \
  -H "Cookie: __auth_session=..." \
  -d '{
    "stack_choice": "Next.js + TypeScript + OpenAI API",
    "reasoning": "Modern React framework with excellent TypeScript support"
  }'
```

#### 5. Download Spec Package

```bash
curl -X GET http://localhost:3000/api/projects/ai-chat-application/download \
  -H "Cookie: __auth_session=..." \
  --output spec-ai-chat.zip
```

---

## API Client Libraries

### JavaScript/TypeScript

```typescript
import { betterFetch } from '@better-fetch/fetch';

const client = betterFetch('http://localhost:3000/api');

// Create project
const { data: project, error } = await client('projects', {
  method: 'POST',
  body: { name: 'My Project' }
});

// Execute phase
const { data: result } = await client(`projects/${project.slug}/execute-phase`, {
  method: 'POST',
  body: { user_input: 'My requirements' }
});
```

### cURL

See examples above.

### Python

```python
import requests

BASE_URL = 'http://localhost:3000/api'
session = requests.Session()

# Login
response = session.post(f'{BASE_URL}/auth/login', json={
    'email': 'user@example.com',
    'password': 'password'
})

# Create project
response = session.post(f'{BASE_URL}/projects', json={
    'name': 'My Project'
})
```

---

## Pagination

APIs that return lists support pagination:

```bash
GET /api/projects?page=2&limit=20
```

Response includes pagination metadata:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 145,
    "pages": 8
  }
}
```

---

## Filtering & Sorting

### Filtering

```bash
GET /api/projects?status=completed
GET /api/projects?phase=SPEC
```

### Sorting

```bash
GET /api/projects?sort=created_at&order=desc
GET /api/projects?sort=name&order=asc
```

---

## WebHooks (Future)

Planned for future releases - subscribe to workflow events.

---

## OpenAPI/Swagger

Generate OpenAPI spec:
```bash
npm run generate:openapi
```

View Swagger UI:
```
http://localhost:3000/api-docs
```

---

**Last Updated**: November 26, 2025
**API Version**: 1.0
**Status**: Stable
**Last Tested**: November 26, 2025
