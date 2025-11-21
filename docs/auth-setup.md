# Better Auth & Drizzle Integration

This project uses Better Auth for authentication with Drizzle ORM as the database adapter. This document explains how to set up and run the authentication system properly.

## Configuration

### Environment Variables

The following environment variables are required for authentication:

```bash
# Authentication
BETTER_AUTH_SECRET="your-32-character-minimum-secret-key-here" # Required for JWT signing (use a strong random value)

# OAuth Providers (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Database Schema

The project uses Drizzle ORM with the following tables for authentication:
- `users` - Stores user information
- `accounts` - Stores OAuth account information 
- `sessions` - Stores session information
- `verifications` - Stores email verification and password reset tokens

The schema is located in `backend/lib/schema.ts` and is compatible with Better Auth's Drizzle adapter.

## Setup Steps

1. Install dependencies:
   ```bash
   npm install better-auth drizzle-orm better-sqlite3
   ```

2. Set your environment variables in `.env.local`

3. Generate database migrations:
   ```bash
   npm run db:generate
   ```

4. Run database migrations:
   ```bash
   npm run db:migrate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## API Routes

Authentication API routes are automatically handled by Better Auth at `/api/auth/`. The catch-all route is configured as:

```
/api/auth/[...betterAuth] -> src/app/api/auth/[...betterAuth]/route.ts
```

## Client-Side Usage

To use authentication in client components, you can use the provided hooks:

```tsx
'use client';

import { useAuthManager } from '@/hooks/use-auth-manager';

export default function MyComponent() {
  const { user, isAuthenticated, signIn, signOut } = useAuthManager();
  
  if (!isAuthenticated) {
    return <div>Please sign in</div>;
  }
  
  return <div>Welcome, {user?.name}!</div>;
}
```

## Protected Routes

The middleware in `src/middleware.ts` automatically redirects unauthenticated users away from protected routes. Public routes are defined as:

```ts
const publicRoutes = ["/", "/sign-in", "/sign-up"]
```

## Components

Authentication components are located in:
- Sign in page: `src/app/(auth)/sign-in/page.tsx`
- Sign up page: `src/app/(auth)/sign-up/page.tsx`

These pages use the Better Auth client methods for handling authentication flows.

## Context Provider

The `AuthProvider` in `src/contexts/auth-context.tsx` wraps the application in `src/app/layout.tsx` to provide authentication context throughout the app.