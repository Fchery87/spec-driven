import { db } from '../backend/lib/drizzle';
import { users, projects } from '../backend/lib/schema';

async function main() {
  try {
    console.log('Getting all users...');
    const allUsers = await db.select().from(users);
    console.log(`\n📋 Total users: ${allUsers.length}`);
    allUsers.forEach((user: typeof users.$inferSelect) => {
      console.log(`  - ${user.email} (ID: ${user.id})`);
    });

    console.log('\n\nGetting all projects...');
    const allProjects = await db.select().from(projects);
    console.log(`📋 Total projects: ${allProjects.length}`);
    allProjects.forEach((project: typeof projects.$inferSelect) => {
      console.log(`  - ${project.name} (${project.slug})`);
      console.log(`    Owner ID: ${project.ownerId}`);

      // Check if owner exists
      const ownerExists = allUsers.some((u: typeof users.$inferSelect) => u.id === project.ownerId);
      console.log(`    Owner exists: ${ownerExists ? '✅ Yes' : '❌ No'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
