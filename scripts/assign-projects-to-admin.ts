import { db } from '../backend/lib/drizzle';
import { users, projects } from '../backend/lib/schema';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    console.log('Finding admin user...');

    // Get the admin user (first user in the system, or find by email)
    const adminUsers = await db.select().from(users).limit(1);

    if (adminUsers.length === 0) {
      console.error('❌ No users found in the database. Please create a user first.');
      process.exit(1);
    }

    const adminUser = adminUsers[0];
    console.log(`✅ Found admin user: ${adminUser.email} (ID: ${adminUser.id})`);

    // Get all projects
    const allProjects = await db.select().from(projects);
    console.log(`\n📋 Found ${allProjects.length} projects to reassign`);

    if (allProjects.length === 0) {
      console.log('No projects to reassign.');
      process.exit(0);
    }

    // Update all projects to assign them to admin user
    const updated = await db
      .update(projects)
      .set({ ownerId: adminUser.id })
      .returning();

    console.log(`\n✅ Successfully assigned ${updated.length} projects to ${adminUser.email}`);
    console.log('\nAssigned projects:');
    updated.forEach((project: typeof projects.$inferSelect) => {
      console.log(`  ✓ ${project.name}`);
      console.log(`    Slug: ${project.slug}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
