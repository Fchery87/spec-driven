/**
 * Migration utility to convert legacy stack template IDs
 * to new compositional format for existing projects.
 *
 * Usage: npx tsx scripts/migrate-legacy-stacks.ts
 */

import { db } from '@/backend/lib/drizzle';
import { projects } from '@/backend/lib/schema';
import { eq } from 'drizzle-orm';
import { ConfigLoader } from '@/backend/services/orchestrator/config_loader';

const LEGACY_TO_COMPOSITION: Record<string, string> = {
  'nextjs_fullstack_expo': 'nextjs_app_router+expo_integration+integrated+neon_postgres+monolith',
  'hybrid_nextjs_fastapi': 'nextjs_app_router+expo_integration+fastapi_api+postgresql+microservices',
  'nextjs_web_app': 'nextjs_app_router+none+integrated+neon_postgres+monolith',
  'nextjs_web_only': 'nextjs_app_router+none+integrated+neon_postgres+monolith',
  'react_express': 'react_spa+none+express_api+postgresql+monolith',
  'vue_nuxt': 'vue_nuxt+none+integrated+neon_postgres+monolith',
  'svelte_kit': 'sveltekit+none+integrated+neon_postgres+monolith',
  'astro_static': 'astro+none+serverless_only+headless_cms+monolith',
  'serverless_edge': 'nextjs_app_router+none+serverless_only+turso+edge',
  'django_htmx': 'django+none+integrated+postgresql+monolith',
  'go_react': 'react_spa+none+go_api+postgresql+microservices',
  'flutter_firebase': 'react_spa+flutter+integrated+firebase_full+monolith',
  'react_native_supabase': 'nextjs_app_router+react_native_bare+integrated+supabase_full+monolith'
};

async function migrateLegacyStacks() {
  console.log('Starting legacy stack migration...');

  const configLoader = new ConfigLoader();
  const spec = configLoader.loadSpec();
  const legacyMappings = spec.legacy_template_migration || {};

  // Get all projects with legacy stack choices
  const allProjects = await db.select().from(projects);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const project of allProjects) {
    const legacyStack = project.stackChoice;

    if (!legacyStack || legacyStack === 'custom') {
      skipped++;
      continue;
    }

    // Check if this is a legacy template
    if (legacyStack in LEGACY_TO_COMPOSITION) {
      const newStackId = LEGACY_TO_COMPOSITION[legacyStack];

      try {
        await db.update(projects)
          .set({ stackChoice: newStackId })
          .where(eq(projects.id, project.id));

        console.log(`Migrated project ${project.slug}: ${legacyStack} -> ${newStackId}`);
        migrated++;
      } catch (error) {
        console.error(`Error migrating project ${project.slug}:`, error);
        errors++;
      }
    } else if (legacyStack.includes('+')) {
      // Already in compositional format
      console.log(`Project ${project.slug}: Already in compositional format`);
      skipped++;
    } else {
      console.log(`Project ${project.slug}: Unknown stack ${legacyStack}, skipping`);
      skipped++;
    }
  }

  console.log('\nMigration complete:');
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

migrateLegacyStacks().catch(console.error);
