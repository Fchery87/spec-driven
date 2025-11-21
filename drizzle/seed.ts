import { db } from '../backend/lib/drizzle';
import { projects, artifacts, phaseHistory } from '../backend/lib/schema';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('Starting database seed...');

  // Create example project
  const exampleProject = await db.insert(projects).values({
    id: uuidv4(),
    slug: 'example-ai-saas',
    name: 'Example AI SaaS Platform',
    description: 'An example project demonstrating the Spec-Driven Platform',
    currentPhase: 'ANALYSIS',
    phasesCompleted: ''
  }).returning();

  console.log('Created example project:', exampleProject[0].slug);

  // Create sample artifacts
  await db.insert(artifacts).values({
    id: uuidv4(),
    projectId: exampleProject[0].id,
    phase: 'ANALYSIS',
    filename: 'constitution.md',
    content: `# Project Constitution

## Mission
Build an AI-powered SaaS platform for automated content generation.

## Vision
Empower businesses of all sizes to leverage AI for professional content creation.

## Values
- User-centric design
- Security and privacy first
- Continuous innovation
- Transparent communication`,
    version: 1
  });

  // Record phase history
  await db.insert(phaseHistory).values({
    id: uuidv4(),
    projectId: exampleProject[0].id,
    phase: 'ANALYSIS',
    status: 'in_progress',
    startedAt: new Date()
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });