import { ProjectStorage } from './project_storage';
import { createReadStream, createWriteStream, existsSync, statSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import archiver from 'archiver';
import { logger } from '@/lib/logger';

export interface ZipConfig {
  include_metadata: boolean;
  include_ai_config: boolean;
  include_docs: boolean;
  compression_level: number;
}

export interface ZipManifest {
  files: Array<{
    path: string;
    size: number;
    hash: string;
    modified: Date;
  }>;
  total_size: number;
  created_at: Date;
}

export class Archiver {
  private projectStorage: ProjectStorage;

  constructor(projectStorage?: ProjectStorage) {
    this.projectStorage = projectStorage || new ProjectStorage();
  }

  /**
   * Create project ZIP archive
   */
  async createProjectZip(projectSlug: string, config?: Partial<ZipConfig>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const zipConfig: ZipConfig = {
          include_metadata: true,
          include_ai_config: true,
          include_docs: true,
          compression_level: 6,
          ...config
        };

        const projectPath = this.projectStorage.getProjectPath(projectSlug);
        const chunks: Buffer[] = [];

        // Create archive
        const archive = archiver('zip', {
          zlib: { level: zipConfig.compression_level }
        });

        // Handle archive events
        archive.on('error', (err: any) => {
          reject(new Error(`Failed to create ZIP: ${err.message}`));
        });

        // Collect chunks as they're written
        archive.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        // When archive is finished, resolve with Buffer
        archive.on('end', () => {
          const zipBuffer = Buffer.concat(chunks);
          resolve(zipBuffer);
        });

        // Add files to archive
        // Add HANDOFF.md if it exists
        const handoffPath = resolve(projectPath, 'HANDOFF.md');
        if (existsSync(handoffPath)) {
          archive.file(handoffPath, { name: 'HANDOFF.md' });
        }

        // Add specs directory
        const specsPath = resolve(projectPath, 'specs');
        if (existsSync(specsPath)) {
          archive.directory(specsPath, 'specs');
        }

        // Add metadata if requested
        if (zipConfig.include_metadata) {
          const metadataPath = resolve(projectPath, 'metadata.json');
          if (existsSync(metadataPath)) {
            archive.file(metadataPath, { name: 'metadata.json' });
          }
        }

        // Add .ai-config if requested
        if (zipConfig.include_ai_config) {
          const aiConfigPath = resolve(projectPath, '.ai-config');
          if (existsSync(aiConfigPath)) {
            archive.directory(aiConfigPath, '.ai-config');
          }
        }

        // Add docs if requested
        if (zipConfig.include_docs) {
          const docsPath = resolve(projectPath, 'docs');
          if (existsSync(docsPath)) {
            archive.directory(docsPath, 'docs');
          }
        }

        // Finalize archive
        archive.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate ZIP manifest
   */
  private async generateZipManifest(projectSlug: string, config: ZipConfig): Promise<ZipManifest> {
    const manifest: ZipManifest = {
      files: [],
      total_size: 0,
      created_at: new Date()
    };

    const projectPath = this.projectStorage.getProjectPath(projectSlug);

    // Add root files
    const rootFiles = [
      'constitution.md',
      'project-brief.md', 
      'personas.md',
      'README.md',
      'HANDOFF.md'
    ];

    for (const file of rootFiles) {
      const filePath = resolve(projectPath, file);
      if (this.fileExists(filePath)) {
        const stats = await this.getFileStats(filePath);
        manifest.files.push({
          path: file,
          size: stats.size,
          hash: await this.calculateFileHash(filePath),
          modified: stats.modified
        });
        manifest.total_size += stats.size;
      }
    }

    // Add specs directory
    const phases = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING'];
    for (const phase of phases) {
      const artifacts = this.projectStorage.listArtifacts(projectSlug, phase);
      for (const artifact of artifacts) {
        const relativePath = `specs/${phase}/v1/${artifact.name}`;
        manifest.files.push({
          path: relativePath,
          size: artifact.size,
          hash: artifact.hash,
          modified: artifact.modified_at
        });
        manifest.total_size += artifact.size;
      }
    }

    // Add .ai-config directory if requested
    if (config.include_ai_config) {
      const aiConfigFiles = [
        '.ai-config/analyst_prompt.md',
        '.ai-config/pm_prompt.md',
        '.ai-config/architect_prompt.md',
        '.ai-config/scrummaster_prompt.md',
        '.ai-config/devops_prompt.md',
        '.ai-config/validators.yml'
      ];

      for (const file of aiConfigFiles) {
        const filePath = resolve(projectPath, file);
        if (this.fileExists(filePath)) {
          const stats = await this.getFileStats(filePath);
          manifest.files.push({
            path: file,
            size: stats.size,
            hash: await this.calculateFileHash(filePath),
            modified: stats.modified
          });
          manifest.total_size += stats.size;
        }
      }
    }

    // Add docs directory if requested
    if (config.include_docs) {
      const docFiles = [
        'docs/security-baseline.md',
        'docs/DEPS_NOTES.md'
      ];

      for (const file of docFiles) {
        const filePath = resolve(projectPath, file);
        if (this.fileExists(filePath)) {
          const stats = await this.getFileStats(filePath);
          manifest.files.push({
            path: file,
            size: stats.size,
            hash: await this.calculateFileHash(filePath),
            modified: stats.modified
          });
          manifest.total_size += stats.size;
        }
      }
    }

    return manifest;
  }

  /**
   * Create handoff prompt
   */
  async createHandoffPrompt(projectSlug: string): Promise<string> {
    const metadata = this.projectStorage.getProjectMetadata(projectSlug);
    const projectPath = this.projectStorage.getProjectPath(projectSlug);

    if (!metadata) {
      throw new Error(`Project metadata not found: ${projectSlug}`);
    }

    // Read key artifacts
    const constitution = this.safeReadFile(resolve(projectPath, 'constitution.md'));
    const brief = this.safeReadFile(resolve(projectPath, 'project-brief.md'));
    const prd = this.safeReadFile(this.projectStorage.getArtifactPath(projectSlug, 'SPEC', 'PRD.md'));

    const handoffContent = `# Handoff: ${metadata.name || projectSlug}

**Project:** ${metadata.name || projectSlug}
**Created:** ${new Date().toISOString().split('T')[0]}
**Stack:** ${metadata.stack_choice || 'Not selected'}
**Status:** Ready for Code Generation

## What This Project Is

${brief ? this.extractDescription(brief) : 'Project description not available.'}

## Read Documents in This Order

1. **constitution.md** (5 min read)
   - Project guiding principles
   - Non-negotiable values

2. **project-brief.md** (5 min read)
   - Vision and objectives
   - Target audience
   - Key features at a glance

3. **personas.md** (10 min read)
   - User personas (3-5 profiles)
   - Pain points and goals
   - Usage patterns

4. **PRD.md** (20 min read)
   - Detailed product requirements
   - Functional & non-functional requirements
   - User stories with acceptance criteria
   - Epics breakdown
   - MVP vs Phase 2 features (marked clearly)

5. **data-model.md** (10 min read)
   - Database schema
   - Tables, columns, relationships
   - Key constraints

6. **api-spec.json** (reference)
   - OpenAPI specification
   - All endpoints, methods, payloads
   - Used during API implementation

7. **architecture.md** (15 min read)
   - System design and component overview
   - Tech stack rationale
   - Security & compliance design
   - Scaling strategy
   - Performance considerations

8. **DEPENDENCIES.md** (10 min read)
   - All required packages
   - Why each dependency was chosen
   - Security and licensing notes

9. **epics.md** (10 min read)
   - Feature set breakdown
   - Which requirements each epic covers
   - Components and APIs per epic

10. **tasks.md** (reference during implementation)
    - Detailed task list with execution context
    - Each task references PRD, architecture, data-model
    - Implementation hints and acceptance criteria

11. **README.md** (2 min read)
    - Quick start guide for developers
    - How to use this project folder
    - Directory structure explanation

## Approved Technology Stack

**Stack Choice:** ${metadata.stack_choice || 'Not selected'}
**Approved:** ${metadata.stack_approved ? 'Yes' : 'No'}

${this.getStackDescription(metadata.stack_choice)}

## Key Requirements (MVP)

${this.extractMVPRequirements(prd)}

## Security Baseline (All Projects Follow)

✅ **Authentication:** JWT tokens, 1-hour expiry, bcrypt password hashing
✅ **Data Protection:** HTTPS only, AES-256 encryption at rest
✅ **Scanning:** npm audit + pip-audit with zero HIGH/CRITICAL vulns
✅ **Logging:** Audit logs for auth events, no PII logged
✅ **Compliance:** GDPR-ready, data retention policies

See architecture.md § Security & Compliance for details.

---

## LLM Code Generation Prompt

**Copy the text below and paste into your IDE's LLM (Claude, ChatGPT, Gemini, etc.):**

\`\`\`
You are a senior full-stack engineer implementing a production project.

## Project Context

You are implementing: ${metadata.name || projectSlug}

This is a ${this.getProjectType(metadata)} project for:
${this.extractDescription(brief)}

The project must be production-ready, secure, and maintainable.

## Your Task

Implement the project following these documents (read in order):

1. constitution.md - Project guiding principles
2. project-brief.md - Vision and context
3. personas.md - User types and needs
4. PRD.md - Complete requirements (including MVP vs Phase 2)
5. data-model.md - Database schema
6. api-spec.json - API contracts (if generating backend)
7. architecture.md - System design
8. DEPENDENCIES.md - Approved packages and why
9. epics.md - Feature breakdown
10. tasks.md - Implementation sequence with acceptance criteria

## Key Constraints

- **Stack:** ${this.getStackConstraint(metadata.stack_choice)}
- **Security:** Follow the security baseline in architecture.md
- **MVP Focus:** Only implement Phase 1 features (marked in PRD.md)
- **Quality:** All code must pass tests and meet acceptance criteria in tasks.md
- **Dependencies:** Use ONLY packages listed in DEPENDENCIES.md
- **API Design:** Match api-spec.json exactly

## Implementation Steps

1. **Setup:** Create project structure
2. **Database:** Set up schema matching data-model.md
3. **Backend APIs:** Implement endpoints from api-spec.json
4. **Frontend:** Implement screens and components per tasks.md
5. **Testing:** Write tests matching acceptance criteria
6. **Documentation:** Keep implementation notes aligned with architecture.md

## Quality Standards

- Zero TypeScript errors or warnings
- All tests passing
- No HIGH/CRITICAL security vulnerabilities
- Code follows project conventions from architecture.md
- Each task's acceptance criteria met exactly

Good luck! You have a complete spec. Build excellent software. 🚀
\`\`\`

---

## What's Included in This ZIP

\`\`\`
${projectSlug}/
├── constitution.md              ← Project guiding principles
├── project-brief.md             ← Vision & objectives
├── personas.md                  ← User personas
├── README.md                    ← Quick start for this folder
├── HANDOFF.md                   ← This file (your guide)
│
├── specs/                      ← All specification artifacts
│   ├── PRD.md                  ← Complete product requirements
│   ├── data-model.md           ← Database schema
│   ├── api-spec.json           ← OpenAPI specification
│   ├── architecture.md         ← System design
│   ├── epics.md               ← Feature breakdown
│   ├── tasks.md                ← Detailed task list
│   ├── plan.md                ← Project plan & approved stack
│   └── DEPENDENCIES.md        ← Package choices & rationale
│
├── .ai-config/                ← Agent prompts & config (reference)
│   ├── analyst_prompt.md
│   ├── pm_prompt.md
│   ├── architect_prompt.md
│   ├── scrummaster_prompt.md
│   ├── devops_prompt.md
│   └── validators.yml
│
└── docs/                      ← Documentation
    ├── security-baseline.md     ← Security requirements & implementation
    └── DEPS_NOTES.md          ← Dependency policy notes & overrides
\`\`\`

## Next Steps

1. **Unzip this folder** to your local machine
2. **Read HANDOFF.md** (this file) top to bottom
3. **Read the documents in order** (constitution → PRD → architecture → tasks)
4. **Copy the LLM Prompt** (section above) into your IDE's AI assistant
5. **Paste the project folder** path into your IDE/LLM context
6. **Generate code** following the prompt and watching for any clarifications
7. **Iterate** - If anything in the spec needs adjustment, update the markdown docs and regenerate code sections

## Questions?

Each document is self-contained with full context. If something is unclear:
- Check the cross-references in the document
- Review the acceptance criteria in tasks.md
- Consult architecture.md for design reasoning

The entire project is documented. No guessing needed. Good luck! 🎯
`;

    return handoffContent;
  }

  /**
   * Helper methods
   */
  private safeReadFile(filePath: string): string | null {
    try {
      const { readFileSync } = require('fs');
      return readFileSync(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  private fileExists(filePath: string): boolean {
    try {
      const { existsSync } = require('fs');
      return existsSync(filePath);
    } catch {
      return false;
    }
  }

  private async getFileStats(filePath: string): Promise<{ size: number; modified: Date }> {
    try {
      const { statSync } = require('fs');
      const stats = statSync(filePath);
      return {
        size: stats.size,
        modified: stats.mtime
      };
    } catch {
      return { size: 0, modified: new Date() };
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = this.safeReadFile(filePath);
      return content ? createHash('sha256').update(content).digest('hex') : '';
    } catch {
      return '';
    }
  }

  private extractDescription(brief: string | null): string {
    if (!brief) return 'No description available';
    
    // Extract first paragraph or few lines
    const lines = brief.split('\n');
    const firstParagraph = lines.find(line => line.trim().length > 0);
    return firstParagraph || 'No description available';
  }

  private extractMVPRequirements(prd: string | null): string {
    if (!prd) return '- No PRD available';
    
    // Look for MVP section or requirements
    const mvpMatch = prd.match(/##? MVP.*?\n([\s\S]*?)(?=\n##|\n#|$)/i);
    if (mvpMatch) {
      return mvpMatch[1].trim();
    }
    
    // Look for Phase 1 or requirements
    const reqMatches = prd.match(/REQ-\w+-\d+/g) || [];
    if (reqMatches.length > 0) {
      return reqMatches.slice(0, 5).map(req => `- ${req}`).join('\n');
    }
    
    return '- No MVP requirements clearly defined';
  }

  private getStackDescription(stackChoice: string | null | undefined): string {
    if (!stackChoice) return 'No stack selected';
    
    const stackDescriptions: Record<string, string> = {
      'nextjs_only_expo': `
**Frontend:** Next.js 14 with App Router
**Mobile:** Expo with React Native  
**Backend:** Next.js API routes / tRPC
**Database:** PostgreSQL with Prisma
**Deployment:** Vercel`,
      
      'hybrid_nextjs_fastapi_expo': `
**Frontend:** Next.js 14
**Mobile:** Expo with React Native
**Backend:** FastAPI (Python)
**Database:** PostgreSQL with SQLAlchemy
**Deployment:** Separate infra`
    };
    
    return stackDescriptions[stackChoice] || 'Custom stack configuration';
  }

  private getProjectType(metadata: any): string {
    // Try to infer project type from brief or metadata
    if (metadata.description) {
      const desc = metadata.description.toLowerCase();
      if (desc.includes('mobile') || desc.includes('app')) return 'mobile app';
      if (desc.includes('dashboard') || desc.includes('admin')) return 'dashboard';
      if (desc.includes('api') || desc.includes('backend')) return 'API';
      if (desc.includes('saas') || desc.includes('platform')) return 'SaaS platform';
    }
    return 'web application';
  }

  private getStackConstraint(stackChoice: string | null | undefined): string {
    if (!stackChoice) return 'No stack selected - choose appropriate technologies';
    
    const stackConstraints: Record<string, string> = {
      'nextjs_only_expo': 'Next.js 14 (App Router), React 18, TypeScript, Expo, Prisma, PostgreSQL',
      'hybrid_nextjs_fastapi_expo': 'Next.js 14, FastAPI (Python), React 18, TypeScript, Expo, SQLAlchemy, PostgreSQL'
    };
    
    return stackConstraints[stackChoice] || 'Custom stack - follow project specifications';
  }
}