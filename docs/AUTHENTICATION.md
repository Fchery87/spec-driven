# Authentication & Authorization Guide

**Status:** ✅ Fully implemented with JWT, bcrypt, and Zod validation
**Last Updated:** November 14, 2025

---

## Overview

This project uses JWT (JSON Web Tokens) for stateless authentication with bcrypt for secure password hashing. All sensitive endpoints are protected by authentication middleware.

### Key Features

- **JWT-based Authentication** - Stateless, scalable token system
- **Bcrypt Password Hashing** - Cost factor 12 (industry standard, ~250ms per hash)
- **Zod Input Validation** - Type-safe schema validation
- **Role-based Access Control (RBAC)** Ready - Can be extended with user roles
- **Password Strength Checking** - Enforces strong passwords
- **Token Expiry** - 24-hour default expiration (configurable)
- **CORS Protection** - Configurable allowed origins
- **Rate Limiting** - In-memory basic implementation (Redis recommended for production)

---

## Architecture

### Components

#### 1. JWT Service (`backend/services/auth/jwt_service.ts`)

Handles token generation and verification using HS256 symmetric signing.

```typescript
// Generate token
const token = jwtService.generateToken({
  userId: user.id,
  email: user.email,
  name: user.name
});

// Verify token
const payload = jwtService.verifyToken(token);

// Check expiry
const expired = jwtService.isTokenExpired(token);
const remaining = jwtService.getTimeRemaining(token); // seconds
```

**Security Notes:**
- Uses HS256 (HMAC SHA-256) for signing
- Secret must be at least 32 characters in production
- Tokens expire after configured duration (default 24h)
- Both expired and invalid tokens return `null` on verification

#### 2. Password Service (`backend/services/auth/password_service.ts`)

Handles password hashing and strength validation.

```typescript
// Hash password
const hash = await passwordService.hashPassword(password);

// Verify password
const valid = await passwordService.verifyPassword(plainPassword, hash);

// Check strength
const check = passwordService.checkPasswordStrength(password);
// Returns: { strong: boolean, score: 0-6, feedback: string[] }

// Generate random password
const temp = passwordService.generateRandomPassword(16);
```

**Security Criteria:**
- Minimum 8 characters (score +1)
- Minimum 12 characters (score +1)
- Contains lowercase (score +1)
- Contains uppercase (score +1)
- Contains numbers (score +1)
- Contains special characters (score +1)
- **Strong** if score >= 5

#### 3. Authentication Service (`backend/services/auth/auth_service.ts`)

High-level service orchestrating registration, login, and password management.

```typescript
// Register
const result = await authService.register({
  email: "user@example.com",
  name: "John Doe",
  password: "SecurePass123!"
});
// Returns: { success, message, user, token }

// Login
const result = await authService.login({
  email: "user@example.com",
  password: "SecurePass123!"
});
// Returns: { success, message, user, token }

// Verify token
const user = await authService.getCurrentUser(token);

// Change password
const result = await authService.changePassword(
  userId,
  oldPassword,
  newPassword
);
```

#### 4. Authentication Middleware (`backend/middleware/auth_middleware.ts`)

Protects routes and handles CORS, rate limiting, and token extraction.

```typescript
// Protect a route
export const POST = withAuth(async (request, params) => {
  // request.user is available and validated
  const userId = request.user.userId;
  // ... route handler
});

// Optional authentication (doesn't fail if missing)
export const GET = optionalAuth(async (request, params) => {
  if (request.user) {
    // User is authenticated
  } else {
    // Public access
  }
});

// With rate limiting
export const POST = withRateLimit(100, 60000)(handler);

// With CORS
export const POST = withCORS(handler);
```

---

## API Endpoints

### 1. Register User

**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "SecurePass123!"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "clg7x9k8w...",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**
- **400:** Validation error or weak password
- **409:** User already exists with email

**Password Requirements:**
- Minimum 8 characters
- Must include uppercase, lowercase, numbers, special characters
- System will suggest improvements if weak

---

### 2. Login User

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "clg7x9k8w...",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**
- **400:** Validation error (missing fields)
- **401:** Invalid email or password

**Token Usage:**
Include in subsequent requests:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

### 3. Verify Token

**Endpoint:** `POST /api/auth/verify`

**Request:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Token is valid",
  "user": {
    "id": "clg7x9k8w...",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Error Responses:**
- **400:** No token provided
- **401:** Invalid or expired token

**Use Case:** Check if stored token is still valid before making authenticated requests

---

### 4. Change Password

**Endpoint:** `POST /api/auth/change-password`

**Request:**
```
Authorization: Bearer <token>
Content-Type: application/json

{
  "oldPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**
- **400:** Weak password or missing fields
- **401:** Old password is incorrect
- **401:** Authentication required

---

## Environment Configuration

Add these to `.env.local`:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=24h  # Can be: "1h", "7d", "30d", etc.

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://yourdomain.com

# Rate Limiting (optional)
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
```

### Security Requirements

**JWT_SECRET:**
- Minimum 32 characters in production
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Never** commit to version control
- **Never** share or expose
- Rotate periodically in production

**ALLOWED_ORIGINS:**
- List all trusted domains
- Prevents CSRF attacks
- Default: `http://localhost:3000`

---

## Usage Examples

### Frontend: Register

```typescript
// React component example
async function register(email: string, name: string, password: string) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password })
  });

  const data = await response.json();

  if (data.success) {
    // Store token
    localStorage.setItem('token', data.token);
    // Redirect to dashboard
    window.location.href = '/dashboard';
  } else {
    console.error(data.message);
  }
}
```

### Frontend: Login

```typescript
async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (data.success) {
    localStorage.setItem('token', data.token);
    window.location.href = '/dashboard';
  } else {
    console.error(data.message);
  }
}
```

### Frontend: Make Authenticated Request

```typescript
async function fetchUserProjects() {
  const token = localStorage.getItem('token');

  const response = await fetch('/api/projects', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }

  return await response.json();
}
```

### Backend: Protect Route

```typescript
// src/app/api/projects/route.ts
import { withAuth } from '@/backend/middleware/auth_middleware';

export const GET = withAuth(async (request) => {
  const userId = request.user.userId;

  // Fetch user's projects from database
  const projects = await prisma.project.findMany({
    where: {
      // Add user_id field to Project schema first
      user_id: userId
    }
  });

  return NextResponse.json({ success: true, projects });
});
```

### Backend: Optional Authentication

```typescript
// Allow public access but identify if authenticated
export const GET = optionalAuth(async (request) => {
  if (request.user) {
    // Return user-specific data
  } else {
    // Return public data
  }
});
```

---

## Database Integration

The authentication system uses the existing `User` model in Prisma:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  password_hash String   // bcrypt hash
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@index([email])
}
```

### Add User Association to Projects

To associate projects with users, update the schema:

```prisma
model Project {
  // ... existing fields
  user_id       String?  // Make projects optional multi-user initially
  user          User?    @relation(fields: [user_id], references: [id])

  @@index([user_id])
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  password_hash String
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  projects      Project[] // Add this relation

  @@index([email])
}
```

Then run: `npm run db:migrate`

---

## Security Best Practices

### ✅ Implemented

1. **Password Hashing**
   - Bcrypt with cost factor 12 (~250ms per hash)
   - Salts included in hash
   - Cannot be reversed

2. **JWT Security**
   - HS256 symmetric signing
   - Expiring tokens (24h default)
   - Token verification on each request

3. **Input Validation**
   - Zod schemas for all inputs
   - Type-safe parsing
   - Detailed error messages

4. **Password Strength**
   - Enforced complexity requirements
   - Feedback on weak passwords
   - Generation of temporary passwords

5. **CORS Protection**
   - Whitelist allowed origins
   - Prevent cross-site attacks

6. **Rate Limiting**
   - Basic in-memory implementation
   - Prevents brute force attacks
   - Returns 429 Too Many Requests

### 🔄 Recommended Improvements

1. **Email Verification**
   - Confirm email ownership before full registration
   - Send verification link via email

2. **Password Reset**
   - Implement forgot password flow
   - Send reset tokens via email
   - Temporary token links

3. **Session Management**
   - Add refresh tokens
   - Implement token rotation
   - Logout (token blacklisting)

4. **Two-Factor Authentication (2FA)**
   - TOTP (Time-based One-Time Passwords)
   - SMS verification
   - Backup codes

5. **Audit Logging**
   - Log all authentication events
   - Track suspicious activities
   - Monitor from admin dashboard

6. **Redis Rate Limiting**
   - Replace in-memory store with Redis
   - Distributed rate limiting
   - Better for multi-instance deployments

7. **OAuth/Social Login**
   - Google, GitHub, Microsoft login
   - Third-party authentication
   - Reduced password fatigue

---

## Troubleshooting

### "JWT_SECRET not set"

**Problem:** Warning about using default secret

**Solution:**
```bash
# Generate secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env.local
JWT_SECRET=<generated_key>
```

### "Invalid or expired token"

**Problem:** Token verification fails

**Check:**
1. Token is being sent in `Authorization: Bearer <token>` format
2. Token hasn't expired (< 24h old)
3. JWT_SECRET matches between generation and verification
4. Token hasn't been tampered with

### "CORS policy violation"

**Problem:** Request blocked by CORS

**Solution:**
Add your domain to `ALLOWED_ORIGINS` in `.env.local`:
```bash
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### "Too many requests"

**Problem:** Rate limit exceeded (429 error)

**Solution:**
- Wait for rate limit window to reset (default 1 minute)
- Or increase `RATE_LIMIT_MAX_REQUESTS` in `.env.local`

---

## File Structure

```
backend/
├── services/
│   └── auth/
│       ├── jwt_service.ts         # JWT token operations
│       ├── password_service.ts    # Password hashing & strength
│       └── auth_service.ts        # High-level auth operations
└── middleware/
    └── auth_middleware.ts         # Route protection & utilities

src/app/api/auth/
├── register/
│   └── route.ts                   # POST /api/auth/register
├── login/
│   └── route.ts                   # POST /api/auth/login
├── verify/
│   └── route.ts                   # POST /api/auth/verify
└── change-password/
    └── route.ts                   # POST /api/auth/change-password
```

---

## Testing

### Test Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "TestPass123!"
  }'
```

### Test Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

### Test Verify Token

```bash
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer <token_from_login>"
```

### Test Change Password

```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "TestPass123!",
    "newPassword": "NewPass456!"
  }'
```

---

## Next Steps

1. **Update Project Schema** - Add `user_id` field to associate projects with users
2. **Implement Email Verification** - Confirm ownership before full account activation
3. **Add Password Reset** - Allow users to recover forgotten passwords
4. **Enable OAuth** - Support third-party authentication (Google, GitHub)
5. **Add 2FA** - Two-factor authentication for enhanced security
6. **Implement Audit Log** - Track authentication events
7. **Redis Integration** - Replace in-memory rate limiting

---

## References

- **JWT Spec:** [RFC 7519](https://tools.ietf.org/html/rfc7519)
- **Bcrypt:** [Official Library](https://www.npmjs.com/package/bcryptjs)
- **Zod:** [Validation Library](https://zod.dev/)
- **OWASP:** [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**Generated:** November 14, 2025
**Status:** ✅ Complete - Ready for production use with recommended improvements
