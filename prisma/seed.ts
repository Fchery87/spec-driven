import prisma from '../backend/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('Starting database seed...');

  // Create example project
  const exampleProject = await prisma.project.create({
    data: {
      id: uuidv4(),
      slug: 'example-ai-saas',
      name: 'Example AI SaaS Platform',
      description: 'An example project demonstrating the Spec-Driven Platform',
      current_phase: 'ANALYSIS',
      phases_completed: ''
    }
  });

  console.log('Created example project:', exampleProject.slug);

  // Create sample artifacts
  await prisma.artifact.create({
    data: {
      id: uuidv4(),
      project_id: exampleProject.id,
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
    }
  });

  // Record phase history
  await prisma.phaseHistory.create({
    data: {
      id: uuidv4(),
      project_id: exampleProject.id,
      phase: 'ANALYSIS',
      status: 'in_progress',
      started_at: new Date()
    }
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
