import { db } from '../backend/lib/drizzle';
import { users, projects, artifacts, phaseHistory } from '../backend/lib/schema';

async function main() {
  try {
    console.log('🔍 OWNER IMPLEMENTATION VERIFICATION\n');

    // 1. Check users exist
    const allUsers = await db.select().from(users);
    console.log(`1️⃣  Users in database: ${allUsers.length}`);
    if (allUsers.length === 0) {
      console.log('   ⚠️  WARNING: No users found');
    } else {
      allUsers.forEach(u => {
        console.log(`   ✅ ${u.email} (${u.id})`);
      });
    }

    // 2. Check projects have owners
    const allProjects = await db.select().from(projects);
    console.log(`\n2️⃣  Projects in database: ${allProjects.length}`);
    let orphanedProjects = 0;
    allProjects.forEach(p => {
      const ownerExists = allUsers.some(u => u.id === p.ownerId);
      const status = ownerExists ? '✅' : '❌';
      console.log(`   ${status} ${p.name} → Owner: ${p.ownerId}`);
      if (!ownerExists) orphanedProjects++;
    });

    if (orphanedProjects > 0) {
      console.log(`   ⚠️  WARNING: ${orphanedProjects} orphaned project(s)`);
    }

    // 3. Check artifacts have projects
    const allArtifacts = await db.select().from(artifacts);
    console.log(`\n3️⃣  Artifacts in database: ${allArtifacts.length}`);
    let orphanedArtifacts = 0;
    const projectIds = new Set(allProjects.map(p => p.id));
    allArtifacts.forEach(a => {
      if (!projectIds.has(a.projectId)) {
        console.log(`   ❌ Artifact orphaned: ${a.id}`);
        orphanedArtifacts++;
      }
    });
    if (orphanedArtifacts === 0) {
      console.log(`   ✅ All artifacts linked to projects`);
    }

    // 4. Check phase history
    const allPhaseHistory = await db.select().from(phaseHistory);
    console.log(`\n4️⃣  Phase history records: ${allPhaseHistory.length}`);
    let orphanedHistory = 0;
    allPhaseHistory.forEach(h => {
      if (!projectIds.has(h.projectId)) {
        console.log(`   ❌ History orphaned: ${h.id}`);
        orphanedHistory++;
      }
    });
    if (orphanedHistory === 0) {
      console.log(`   ✅ All phase history linked to projects`);
    }

    // 5. Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Users: ${allUsers.length}`);
    console.log(`   Projects: ${allProjects.length} (${orphanedProjects} orphaned)`);
    console.log(`   Artifacts: ${allArtifacts.length} (${orphanedArtifacts} orphaned)`);
    console.log(`   Phase History: ${allPhaseHistory.length} (${orphanedHistory} orphaned)`);

    if (orphanedProjects === 0 && orphanedArtifacts === 0 && orphanedHistory === 0) {
      console.log('\n✅ ALL OWNERSHIP CHECKS PASSED');
    } else {
      console.log('\n⚠️  OWNERSHIP ISSUES DETECTED');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
