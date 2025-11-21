// Test file to verify Better Auth + Drizzle integration
// This file is just for verification and doesn't need to pass TypeScript checks during development

import { auth } from '@/lib/auth';
import { db } from '@/backend/lib/drizzle';
import { users } from '@/backend/lib/schema';

// This is a basic verification that the imports work
console.log('Auth instance created:', !!auth);
console.log('DB instance available:', !!db);
console.log('Users schema available:', !!users);

export { auth, db, users };