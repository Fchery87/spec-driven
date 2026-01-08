# TIER 1 Implementation Spec: Structured Output & Parsing Overhaul

> **Status**: Draft | **Date**: 2026-01-06 | **Target**: Phase 0 (Foundational)
> **Purpose**: Fix root cause of quality issues - fragile parsing infrastructure
> **Based on**: Gemini API structured output + immutable-moseying-lagoon.md

---

## Executive Summary

**Root Cause**: The `parseArtifacts()` function has a 6-layer fallback chain that silently degrades quality instead of failing fast. LLM non-compliance with output formats is **tolerated**, not **blocked**.

**Solution**: Use Gemini's native JSON schema enforcement for all multi-file and JSON artifacts. This eliminates 80% of parsing failures.

---

## Changes Required

### 1. Extend LLM Client with Structured Output

**Location**: `backend/services/llm/llm_client.ts`

```typescript
import { SchemaType } from '@google/generative-ai';

/**
 * Generate artifacts with structured JSON output (Gemini native)
 * Replaces fragile markdown code block parsing
 */
interface StructuredArtifact {
  filename: string;
  content: string;
}

interface StructuredGenerationConfig {
  artifacts: StructuredArtifact[];
  schema: {
    type: 'array';
    items: {
      type: 'object';
      properties: {
        filename: { type: 'string'; description: 'Output filename' };
        content: { type: 'string'; description: 'File content' };
      };
      required: ['filename', 'content'];
    };
  };
}

export async function generateStructuredArtifacts(
  prompt: string,
  expectedFiles: string[],
  phase: string,
  config?: { temperature?: number; maxOutputTokens?: number }
): Promise<Record<string, string>> {
  // Build schema from expected files
  const schema = buildArtifactSchema(expectedFiles);
  
  const response = await this.generateCompletion(prompt, {
    responseMimeType: 'application/json',
    responseSchema: schema,
    temperature: config?.temperature ?? 0.3,
    maxOutputTokens: config?.maxOutputTokens ?? 32768,
  }, 2, phase); // Only 2 retries - structured output is more reliable
  
  // Direct JSON parse - no fallback needed!
  const artifacts: StructuredArtifact[] = JSON.parse(response.content);
  
  // Convert array to record
  const result: Record<string, string> = {};
  for (const artifact of artifacts) {
    result[artifact.filename] = artifact.content;
  }
  
  // Validate all expected files present
  const missing = expectedFiles.filter(f => !result[f]);
  if (missing.length > 0) {
    throw new Error(`Missing artifacts: ${missing.join(', ')}`);
  }
  
  return result;
}

function buildArtifactSchema(expectedFiles: string[]) {
  return {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        filename: {
          type: SchemaType.STRING,
          description: `One of: ${expectedFiles.join(', ')}`,
          enum: expectedFiles,
        },
        content: {
          type: SchemaType.STRING,
          description: 'Complete file content with frontmatter if applicable',
        },
      },
      required: ['filename', 'content'],
    },
  };
}
```

---

### 2. Refactor parseArtifacts() to Fail-Fast

**Location**: `backend/services/llm/agent_executors.ts`

```typescript
/**
 * OLD (PROBLEMATIC): 6-layer fallback chain with silent degradation
 */
function parseArtifactsOLD(content: string, expectedFiles: string[]) {
  // Attempt 1: Markdown code blocks with filename markers
  // Attempt 2: JSON extraction
  // Attempt 3: Header-based parsing
  // ...
  // Attempt 5: DEGRADE - dump everything into first file ← BAD
  // Attempt 6: SILENT FAILURE - empty strings ← WORSE
}

/**
 * NEW: Fail-fast with structured output primary path
 * Markdown parsing only as STRICT fallback (no degradation!)
 */
interface ParseResult {
  success: boolean;
  artifacts: Record<string, string>;
  parseMethod: 'structured' | 'markdown_strict' | 'failed';
  errors: string[];
}

function parseArtifacts(
  content: string,
  expectedFiles: string[],
  options: { allowMarkdownFallback?: boolean } = { allowMarkdownFallback: true }
): ParseResult {
  const result: ParseResult = {
    success: false,
    artifacts: {},
    parseMethod: 'failed',
    errors: [],
  };
  
  // PRIMARY PATH: Try structured extraction first
  // Looks for JSON array pattern: [{"filename": "...", "content": "..."}]
  const structuredMatch = extractStructuredArtifacts(content);
  if (structuredMatch) {
    result.artifacts = structuredMatch;
    result.parseMethod = 'structured';
    result.success = validateAllFilesPresent(result.artifacts, expectedFiles);
    if (result.success) {
      return result;
    }
    result.errors.push('Structured output missing required files');
  }
  
  // FALLBACK: Strict markdown code block parsing
  if (options.allowMarkdownFallback) {
    const markdownArtifacts = parseMarkdownBlocksStrict(content, expectedFiles);
    if (markdownArtifacts) {
      result.artifacts = markdownArtifacts;
      result.parseMethod = 'markdown_strict';
      result.success = validateAllFilesPresent(result.artifacts, expectedFiles);
      if (result.success) {
        return result;
      }
      result.errors.push('Markdown fallback missing required files');
    }
  }
  
  // NO DEGRADATION: Don't dump everything into first file
  // NO SILENT FAILURE: Don't fill with empty strings
  
  result.errors.push(
    `Parse failed. Expected: ${expectedFiles.join(', ')}. ` +
    `Found: ${Object.keys(result.artifacts).join(', ')}`
  );
  
  return result;
}

function parseMarkdownBlocksStrict(
  content: string,
  expectedFiles: string[]
): Record<string, string> | null {
  // Strict regex - MUST match exactly: ```[lang]\nfilename: X\n...
  const fileRegex = /```(\w+)?\s*\nfilename:\s*([^\n]+)\n([\s\S]*?)```/g;
  
  const artifacts: Record<string, string> = {};
  let match;
  
  while ((match = fileRegex.exec(content)) !== null) {
    const [, lang, filename, fileContent] = match;
    const normalizedName = filename.trim();
    
    // Reject if filename doesn't match expected
    if (!expectedFiles.includes(normalizedName)) {
      continue;
    }
    
    artifacts[normalizedName] = fileContent.trim();
  }
  
  // Return null if not ALL files found
  const allFound = expectedFiles.every(f => artifacts[f]);
  return allFound ? artifacts : null;
}

function extractStructuredArtifacts(content: string): Record<string, string> | null {
  // Try to find JSON array pattern
  const arrayMatch = content.match(/\[\s*\{\s*"filename"/);
  if (!arrayMatch) return null;
  
  try {
    // Find the JSON array boundaries
    const startIndex = content.indexOf('[');
    let braceCount = 0;
    let endIndex = -1;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0 && content[i] === ']') {
        endIndex = i + 1;
        break;
      }
    }
    
    if (endIndex === -1) return null;
    
    const jsonContent = content.slice(startIndex, endIndex);
    const artifacts: StructuredArtifact[] = JSON.parse(jsonContent);
    
    const result: Record<string, string> = {};
    for (const artifact of artifacts) {
      result[artifact.filename] = artifact.content;
    }
    
    return result;
  } catch {
    return null;
  }
}
```

---

### 3. Add parseArtifactsWithValidation()

**Location**: `backend/services/llm/agent_executors.ts`

```typescript
/**
 * Parse with validation - REJECT on failure, RETRY with enhanced prompt
 */
export async function parseArtifactsWithValidation(
  content: string,
  expectedFiles: string[],
  llmClient: LLMProvider,
  originalPrompt: string,
  phase: string,
  maxRetries: number = 2
): Promise<Record<string, string>> {
  const parseResult = parseArtifacts(content, expectedFiles);
  
  if (parseResult.success) {
    return parseResult.artifacts;
  }
  
  // Retry with enhanced prompt
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const enhancedPrompt = buildRetryPrompt(originalPrompt, expectedFiles, parseResult.errors);
    
    const response = await llmClient.generateCompletion(
      enhancedPrompt,
      undefined,
      1,
      phase
    );
    
    const retryResult = parseArtifacts(response.content, expectedFiles);
    
    if (retryResult.success) {
      return retryResult.artifacts;
    }
  }
  
  // Final failure - don't degrade, throw!
  throw new Error(
    `Artifact parsing failed after ${maxRetries} retries. ` +
    `Expected files: ${expectedFiles.join(', ')}. ` +
    `Parse errors: ${parseResult.errors.join('; ')}`
  );
}

function buildRetryPrompt(
  originalPrompt: string,
  expectedFiles: string[],
  errors: string[]
): string {
  return `
${originalPrompt}

---

## CRITICAL: OUTPUT FORMAT REQUIREMENTS

Previous attempt failed: ${errors.join('; ')}

You MUST output a JSON array with this EXACT format:
\`\`\`json
[
  {"filename": "${expectedFiles[0]}", "content": "..."},
  {"filename": "${expectedFiles[1]}", "content": "..."}
  ${expectedFiles.slice(2).map(f => `, {"filename": "${f}", "content": "..."}`).join('')}
]
\`\`\`

Rules:
1. One JSON array, no markdown code block
2. filename must match expected files EXACTLY
3. content must be the complete file (including frontmatter)
4. ALL ${expectedFiles.length} files must be present
5. NO extra files

Generate the output now.
`;
}
```

---

### 4. Update Agent Executors to Use Structured Output

**Location**: `backend/services/llm/agent_executors.ts`

```typescript
/**
 * Execute Analyst Agent (ANALYSIS phase) - Updated
 */
async function executeAnalystAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  projectIdea: string,
  projectName?: string
): Promise<Record<string, string>> {
  logger.info('[ANALYSIS] Executing Analyst Agent');
  
  const agentConfig = configLoader.getSection('agents').analyst;
  const prompt = buildPrompt(agentConfig.prompt_template, {
    projectIdea,
    projectName: projectName || 'Untitled Project',
  });
  
  const expectedFiles = [
    'constitution.md',
    'project-brief.md',
    'project-classification.json',
    'personas.md',
  ];
  
  // Use structured output for JSON artifact (project-classification.json)
  const response = await llmClient.generateCompletion(
    prompt,
    {
      responseMimeType: 'application/json',
      responseSchema: buildArtifactSchema(expectedFiles),
    },
    3,
    'ANALYSIS'
  );
  
  // Parse with validation
  const artifacts = await parseArtifactsWithValidation(
    response.content,
    expectedFiles,
    llmClient,
    prompt,
    'ANALYSIS'
  );
  
  logger.info('[ANALYSIS] Agent completed', {
    artifacts: Object.keys(artifacts),
  });
  return artifacts;
}

/**
 * Execute Designer Agent (Phase 6) - TWO-FILE STRUCTURED OUTPUT
 */
async function executeDesignerAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  designTokens: string,
  stackChoice: string,
  projectName?: string
): Promise<Record<string, string>> {
  logger.info('[SPEC_DESIGN_COMPONENTS] Executing Designer Agent');
  
  const agentConfig = configLoader.getSection('agents').designer;
  const prompt = buildPrompt(agentConfig.prompt_template, {
    designTokens,
    stackChoice,
    projectName: projectName || 'Untitled Project',
  });
  
  const expectedFiles = [
    'component-mapping.md',
    'journey-maps.md',
  ];
  
  // STRUCTURED OUTPUT guarantees two-file separation!
  const response = await llmClient.generateCompletion(
    prompt,
    {
      responseMimeType: 'application/json',
      responseSchema: buildTwoFileSchema(),
    },
    3,
    'SPEC_DESIGN_COMPONENTS'
  );
  
  const artifacts = await parseArtifactsWithValidation(
    response.content,
    expectedFiles,
    llmClient,
    prompt,
    'SPEC_DESIGN_COMPONENTS'
  );
  
  logger.info('[SPEC_DESIGN_COMPONENTS] Agent completed', {
    artifacts: Object.keys(artifacts),
    hasJourneyMaps: !!artifacts['journey-maps.md'],
  });
  return artifacts;
}

function buildTwoFileSchema() {
  return {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        filename: {
          type: SchemaType.STRING,
          enum: ['component-mapping.md', 'journey-maps.md'],
        },
        content: {
          type: SchemaType.STRING,
        },
      },
      required: ['filename', 'content'],
    },
  };
}
```

---

### 5. Make Anti-Slop Validator Blocking

**Location**: `orchestrator_spec.yml`

```yaml
SPEC_DESIGN_TOKENS:
  name: 'SPEC_DESIGN_TOKENS'
  # ... existing config ...
  inline_validation:
    enabled: true
    blocking_on_errors: true
    blocking_on_warnings: true  # ← CHANGED from false
    validators:
      - 'presence'
      - 'markdown_frontmatter'
      - 'anti_ai_slop'
      - 'no_purple_defaults'
      - 'font_validation'
```

---

### 6. Add Anti-Slop Validators

**Location**: `backend/services/orchestrator/validators.ts`

```typescript
/**
 * Validate no purple/indigo color defaults
 */
async function validateNoPurpleDefaults(project: Project): Promise<ValidationResult> {
  const result: ValidationResult = { status: 'pass', checks: {}, errors: [], warnings: [] };
  
  const designTokens = await getArtifact(project.id, 'design-tokens.md');
  
  const purplePatterns = [
    /indigo-\d+/g,
    /violet-\d+/g,
    /purple-\d+/g,
    /#(8B|7B|6B|5B|4B|3B)5CDF/gi, // Purple hex patterns
    /oklch\([^)]*[\d.]+\s+[\d.]+\s+[28][0-9]{2}[^)]*\)/gi, // OKLCH purple range
  ];
  
  for (const pattern of purplePatterns) {
    const matches = designTokens.match(pattern);
    if (matches) {
      result.status = 'fail';
      result.errors.push(`Anti-slop violation: Found purple/indigo color: ${matches[0]}`);
    }
  }
  
  return result;
}

/**
 * Validate font choices - no Inter/Roboto/system defaults
 */
async function validateFontChoices(project: Project): Promise<ValidationResult> {
  const result: ValidationResult = { status: 'pass', checks: {}, errors: [], warnings: [] };
  
  const designTokens = await getArtifact(project.id, 'design-tokens.md');
  
  const bannedFonts = ['Inter', 'Roboto', 'Arial', 'Helvetica', 'system-ui', 'system-font'];
  
  for (const font of bannedFonts) {
    const regex = new RegExp(`\\b${font}\\b`, 'gi');
    const matches = designTokens.match(regex);
    if (matches) {
      result.errors.push(
        `Anti-slop violation: Banned font "${font}" used without explicit brand justification. ` +
        'See docs/frontend-design/SKILL.md for distinctive font recommendations.'
      );
    }
  }
  
  if (result.errors.length > 0) {
    result.status = 'fail';
  }
  
  return result;
}

/**
 * Validate design tokens have physics-based animation
 */
async function validateAnimationPhysics(project: Project): Promise<ValidationResult> {
  const result: ValidationResult = { status: 'pass', checks: {}, errors: [], warnings: [] };
  
  const designTokens = await getArtifact(project.id, 'design-tokens.md');
  
  // Check for physics parameters, not just duration
  const hasStiffness = /stiffness:\s*\d+/.test(designTokens);
  const hasDamping = /damping:\s*\d+/.test(designTokens);
  const hasDuration = /duration:\s*\d+/.test(designTokens);
  
  if (hasDuration && !hasStiffness && !hasDamping) {
    result.warnings.push(
      'Animation defined only by duration. Consider using spring physics (stiffness, damping).'
    );
  }
  
  return result;
}
```

---

## Architecture Comparison

### Before (Fragile)

```
LLM generates text
     ↓
parseArtifacts() 6-layer fallback
     ↓
Attempt 1 → 2 → 3 → ... → DEGRADE → FAIL
     ↓
User gets incomplete/broken artifacts
```

### After (Robust)

```
LLM generates JSON with schema
     ↓
Direct parse (no fallback needed!)
     ↓
Validation - REJECT if missing files
     ↓
RETRY with enhanced prompt (max 2x)
     ↓
THROW on failure (don't degrade)
     ↓
User gets complete artifacts OR clear error
```

---

## Expected Impact

| Metric | Current | After TIER 1 |
|--------|---------|--------------|
| Parsing success rate | ~60% | 95%+ |
| Two-file design output | ~40% | 95%+ |
| JSON artifact validity | ~50% | 98%+ |
| Anti-slop violations | Common | Blocked |
| Silent degradation | Common | Eliminated |

---

## Implementation Effort

| Task | Hours |
|------|-------|
| Extend llm_client.ts with structured output | 4-6h |
| Refactor parseArtifacts() fail-fast | 3-4h |
| Add parseArtifactsWithValidation() | 2-3h |
| Update agent executors | 2-3h |
| Add anti-slop validators | 3-4h |
| Make anti-slop blocking in orchestrator_spec.yml | 1h |
| **Total** | **15-21h** |

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/services/llm/llm_client.ts` | Add `generateStructuredArtifacts()`, schema builder |
| `backend/services/llm/agent_executors.ts` | Refactor `parseArtifacts()`, add validation wrapper, update executors |
| `backend/services/orchestrator/validators.ts` | Add 3 anti-slop validators |
| `orchestrator_spec.yml` | Make anti-slop blocking, update inline_validation |

---

## Success Criteria

- [ ] All JSON artifacts (project-classification.json, stack.json, etc.) parse correctly
- [ ] `journey-maps.md` generated alongside `component-mapping.md` (Phase 6)
- [ ] No silent degradation - parse failures throw clear errors
- [ ] Anti-slop violations block phase completion
- [ ] Retry with enhanced prompt recovers from most failures

---

## Example: Retry Prompt Output

```
Previous attempt failed: Missing artifact: journey-maps.md

You MUST output a JSON array with this EXACT format:
```json
[
  {"filename": "component-mapping.md", "content": "..."},
  {"filename": "journey-maps.md", "content": "..."}
]
```

Rules:
1. One JSON array, no markdown code block
2. filename must match exactly: component-mapping.md, journey-maps.md
3. content must be the complete file
4. ALL 2 files must be present

Generate the output now.
```
