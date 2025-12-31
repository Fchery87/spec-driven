/**
 * Artifact Dependency Graph
 *
 * Defines relationships between spec artifacts to determine:
 * - What needs to be regenerated when an artifact changes
 * - What artifacts depend on a given artifact
 * - Transitive impact analysis (cascade effects)
 *
 * Used by AUTO_REMEDY phase to determine scope of fixes.
 */

export interface ArtifactDependency {
  affects: string[]; // Artifacts that depend on this one
  reason: string;    // Human-readable explanation
}

/**
 * Artifact Dependency Graph (DAG)
 *
 * Format: { 'upstream-artifact.md': { affects: ['downstream1.md', 'downstream2.md'], reason: '...' } }
 *
 * Based on spec from PHASE_WORKFLOW_ENHANCEMENT_PLAN.md lines 1015-1051
 */
export const ARTIFACT_DEPENDENCIES: Record<string, ArtifactDependency> = {
  // Foundation documents
  'constitution.md': {
    affects: ['stack-decision.md', 'PRD.md', 'architecture.md', 'design-tokens.md'],
    reason: 'Constitutional articles constrain all technical and product decisions',
  },

  'project-brief.md': {
    affects: ['stack-analysis.md', 'PRD.md', 'personas.md'],
    reason: 'Project scope and goals inform stack selection, requirements, and target users',
  },

  'personas.md': {
    affects: ['PRD.md', 'user-flows.md', 'design-tokens.md'],
    reason: 'User personas drive requirements, interaction patterns, and design decisions',
  },

  // Requirements and Architecture
  'PRD.md': {
    affects: ['data-model.md', 'api-spec.json', 'epics.md', 'tasks.md', 'architecture.md'],
    reason: 'Requirements drive data model, API design, and architecture decisions',
  },

  'stack.json': {
    affects: ['component-inventory.md', 'dependencies.json', 'DEPENDENCIES.md'],
    reason: 'Technology choices determine available components and required dependencies',
  },

  // Technical Specs
  'data-model.md': {
    affects: ['api-spec.json', 'architecture.md'],
    reason: 'Data structures shape API contracts and storage architecture',
  },

  'api-spec.json': {
    affects: ['epics.md', 'tasks.md'],
    reason: 'API contracts define implementation scope and task breakdown',
  },

  // Design System
  'design-tokens.md': {
    affects: ['component-inventory.md', 'journey-maps.md'],
    reason: 'Design primitives constrain component design and interaction patterns',
  },

  'component-inventory.md': {
    affects: ['user-flows.md', 'epics.md'],
    reason: 'Available components determine possible user flows and implementation epics',
  },

  // Architecture
  'architecture.md': {
    affects: ['epics.md', 'tasks.md'],
    reason: 'Architectural decisions constrain implementation approach',
  },

  // Implementation Planning
  'epics.md': {
    affects: ['tasks.md'],
    reason: 'Epic breakdown defines granular task structure',
  },

  // Leaf nodes (no downstream dependencies)
  'stack-decision.md': {
    affects: ['architecture.md', 'DEPENDENCIES.md', 'tasks.md', 'data-model.md'],
    reason: 'Stack selection decisions constrain architecture, dependencies, and task breakdown',
  },
  'stack-analysis.md': {
    affects: [],
    reason: 'Analysis artifact, consumed during stack selection',
  },
  'user-flows.md': {
    affects: ['journey-maps.md'],
    reason: 'User flows inform journey mapping and interaction design',
  },
  'journey-maps.md': {
    affects: [],
    reason: 'Journey mapping artifact, final design deliverable',
  },
  'DEPENDENCIES.md': {
    affects: [],
    reason: 'Dependency documentation, used for development reference',
  },
  'tasks.md': {
    affects: [],
    reason: 'Final implementation plan, no downstream artifacts',
  },
  'dependencies.json': {
    affects: [],
    reason: 'Package manifest, not referenced by spec artifacts',
  },
  'validation-report.md': {
    affects: [],
    reason: 'Validation output, not an input to other artifacts',
  },
};

/**
 * Get artifacts directly affected by changes to the given artifact
 *
 * @param artifactId - e.g., 'PRD.md', 'stack.json'
 * @returns Array of affected artifact IDs
 *
 * @example
 * getAffectedArtifacts('PRD.md')
 * // => ['data-model.md', 'api-spec.json', 'epics.md', 'tasks.md', 'architecture.md']
 */
export function getAffectedArtifacts(artifactId: string): string[] {
  const dep = ARTIFACT_DEPENDENCIES[artifactId];
  return dep ? dep.affects : [];
}

/**
 * Get artifacts that the given artifact depends on (reverse lookup)
 *
 * @param artifactId - e.g., 'data-model.md'
 * @returns Array of dependency artifact IDs
 *
 * @example
 * getArtifactDependencies('data-model.md')
 * // => ['PRD.md']
 */
export function getArtifactDependencies(artifactId: string): string[] {
  const dependencies: string[] = [];

  for (const [upstreamId, dep] of Object.entries(ARTIFACT_DEPENDENCIES)) {
    if (dep.affects.includes(artifactId)) {
      dependencies.push(upstreamId);
    }
  }

  return dependencies;
}

/**
 * Get all artifacts transitively affected by changes (cascade analysis)
 *
 * Uses breadth-first search to find all downstream artifacts.
 * Handles cycles gracefully (though DAG shouldn't have cycles).
 *
 * @param artifactId - Starting artifact
 * @returns Array of all transitively affected artifact IDs (deduplicated)
 *
 * @example
 * getTransitiveAffectedArtifacts('constitution.md')
 * // => ['stack-decision.md', 'PRD.md', 'architecture.md', 'design-tokens.md', 'data-model.md', ...]
 */
export function getTransitiveAffectedArtifacts(artifactId: string): string[] {
  const visited = new Set<string>();
  const queue: string[] = [artifactId];
  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current)) {
      continue; // Cycle protection
    }
    visited.add(current);

    const affected = getAffectedArtifacts(current);

    for (const affectedId of affected) {
      if (!visited.has(affectedId)) {
        result.push(affectedId);
        queue.push(affectedId);
      }
    }
  }

  return result;
}
