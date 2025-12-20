import { NextResponse } from 'next/server';
import { db } from '@/backend/lib/drizzle';
import { projects, users } from '@/backend/lib/schema';
import { desc, eq } from 'drizzle-orm';
import { withAdminAuth } from '@/app/api/middleware/auth-guard';

export const GET = withAdminAuth(async () => {
  try {
    const allProjects = await db
      .select({
        id: projects.id,
        slug: projects.slug,
        name: projects.name,
        description: projects.description,
        currentPhase: projects.currentPhase,
        stackChoice: projects.stackChoice,
        stackApproved: projects.stackApproved,
        handoffGenerated: projects.handoffGenerated,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        ownerId: projects.ownerId,
        ownerEmail: users.email,
        ownerName: users.name,
      })
      .from(projects)
      .leftJoin(users, eq(projects.ownerId, users.id))
      .orderBy(desc(projects.createdAt));

    return NextResponse.json({ success: true, data: allProjects });
  } catch (error) {
    console.error('Failed to fetch all projects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
});
