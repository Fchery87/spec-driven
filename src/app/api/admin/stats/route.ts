import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/backend/lib/drizzle';
import { users, projects, settings } from '@/backend/lib/schema';
import { eq, count, ne, like } from 'drizzle-orm';
import { withAdminAuth } from '@/app/api/middleware/auth-guard';

async function handler() {
  try {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [projectCount] = await db.select({ count: count() }).from(projects);
    const [activeCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(ne(projects.currentPhase, 'DONE'));
    const [completedCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.currentPhase, 'DONE'));

    const llmModelSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'llm_model'))
      .limit(1);

    const llmProviderSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'llm_provider'))
      .limit(1);

    const featureFlagCount = await db
      .select({ count: count() })
      .from(settings)
      .where(like(settings.key, 'feature_%'));

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: userCount.count,
        totalProjects: projectCount.count,
        activeProjects: activeCount.count,
        completedProjects: completedCount.count,
        llmModel: llmModelSetting[0]?.value ?? 'gemini-2.5-flash',
        llmProvider: llmProviderSetting[0]?.value ?? 'gemini',
        featureFlags: featureFlagCount[0]?.count ?? 0,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(async (request: NextRequest) => {
  return handler();
});
