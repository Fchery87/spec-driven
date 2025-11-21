import { eq } from 'drizzle-orm';
import { db } from '@/backend/lib/drizzle';
import { users } from '@/backend/lib/schema';

/**
 * Utility functions for authentication-related database operations
 */

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  return user[0] || null;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  
  return user[0] || null;
}

/**
 * Check if a user exists by email
 */
export async function userExists(email: string) {
  const user = await getUserByEmail(email);
  return !!user;
}

/**
 * Create a new user
 */
export async function createUser(userData: {
  email: string;
  name?: string;
  passwordHash?: string;
  image?: string;
}) {
  const [newUser] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      email: userData.email,
      name: userData.name,
      passwordHash: userData.passwordHash,
      image: userData.image,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  
  return newUser;
}

/**
 * Update user information
 */
export async function updateUser(
  id: string,
  updateData: Partial<{
    name: string;
    email: string;
    image: string;
    passwordHash: string;
    emailVerified: boolean;
  }>
) {
  const [updatedUser] = await db
    .update(users)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  
  return updatedUser;
}