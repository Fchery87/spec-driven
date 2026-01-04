import { CompositionResolver } from './composition_resolver';
import { LegacyMigrator } from './legacy_migrator';
import { ConfigLoader } from '../orchestrator/config_loader';
import {
  StackComposition,
  CompositionValidation,
  ResolvedStack,
  CompositionSystem
} from '@/types/composition';
import { logger } from '@/lib/logger';

export interface CompositionRequirements {
  project_type?: string;
  platform_targets?: string[];
  backend_complexity?: string;
  scale_tier?: string;
  tech_preferences?: {
    frontend_framework?: string;
    backend_language?: string;
    database_type?: string;
  };
}

export interface CompositionRecommendation {
  composition: StackComposition;
  score: number;
  reason: string;
  resolved_stack?: ResolvedStack;
}

export class CompositionService {
  private resolver: CompositionResolver;
  private migrator: LegacyMigrator;

  constructor(private configLoader: ConfigLoader) {
    const system = this.configLoader.getCompositionSystem();
    const mappings = this.configLoader.getLegacyMappings();

    this.resolver = new CompositionResolver(system);
    this.migrator = new LegacyMigrator(mappings);

    logger.info('[CompositionService] Initialized', {
      mode: system.mode,
      baseLayers: Object.keys(system.base_layers).length,
      legacyTemplates: Object.keys(mappings).length
    });
  }

  /**
   * Resolve a composition to a full stack
   */
  resolveComposition(composition: StackComposition): CompositionValidation {
    return this.resolver.resolve(composition);
  }

  /**
   * Migrate a legacy template ID to a composition
   */
  migrateLegacyTemplate(templateId: string): StackComposition | null {
    return this.migrator.migrateTemplateId(templateId);
  }

  /**
   * Resolve a legacy template to a full stack
   */
  resolveLegacyTemplate(templateId: string): CompositionValidation {
    const composition = this.migrator.migrateTemplateId(templateId);

    if (!composition) {
      return {
        valid: false,
        errors: [`No migration mapping for template "${templateId}"`],
        warnings: []
      };
    }

    return this.resolver.resolve(composition);
  }

  /**
   * Check if a template ID is legacy
   */
  isLegacyTemplate(templateId: string): boolean {
    return this.migrator.isLegacyTemplate(templateId);
  }

  /**
   * Recommend compositions based on requirements
   */
  recommendCompositions(requirements: CompositionRequirements): CompositionRecommendation[] {
    logger.info('[CompositionService] Recommending compositions', { requirements });

    const recommendations: CompositionRecommendation[] = [];
    const system = this.configLoader.getCompositionSystem();

    // Determine base layer
    const baseCandidates = this.selectBaseLayers(requirements, system);

    // For each base candidate, generate complete compositions
    for (const base of baseCandidates) {
      const mobile = this.selectMobile(requirements);
      const backend = this.selectBackend(requirements, base.id);
      const data = this.selectData(requirements);
      const architecture = this.selectArchitecture(requirements);

      const composition: StackComposition = {
        base: base.id,
        mobile,
        backend,
        data,
        architecture
      };

      // Validate and resolve
      const validation = this.resolver.resolve(composition);

      if (validation.valid) {
        const score = this.calculateScore(composition, requirements);
        const reason = this.generateReason(composition, requirements);

        recommendations.push({
          composition,
          score,
          reason,
          resolved_stack: validation.resolved_stack
        });
      }
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
  }

  private selectBaseLayers(
    requirements: CompositionRequirements,
    system: CompositionSystem
  ): Array<{ id: string; name: string }> {
    const bases: Array<{ id: string; name: string }> = [];

    // Check tech preferences first
    if (requirements.tech_preferences?.frontend_framework) {
      const pref = requirements.tech_preferences.frontend_framework;
      const mapping: Record<string, string> = {
        'nextjs': 'nextjs_app_router',
        'remix': 'remix',
        'sveltekit': 'sveltekit',
        'nuxt': 'vue_nuxt',
        'astro': 'astro',
        'react': 'react_spa',
        'django': 'django'
      };

      const baseId = mapping[pref.toLowerCase()];
      if (baseId && system.base_layers[baseId]) {
        return [{ id: baseId, name: system.base_layers[baseId].name }];
      }
    }

    // Default: return all base layers
    for (const [id, layer] of Object.entries(system.base_layers)) {
      bases.push({ id, name: layer.name });
    }

    return bases;
  }

  private selectMobile(requirements: CompositionRequirements): string {
    if (requirements.platform_targets?.includes('mobile')) {
      return 'expo_integration';
    }
    return 'none';
  }

  private selectBackend(requirements: CompositionRequirements, baseId: string): string {
    // If user wants separate backend
    if (requirements.backend_complexity === 'complex') {
      const backendMapping: Record<string, string> = {
        nextjs_app_router: 'fastapi_api',
        remix: 'fastapi_api',
        react_spa: 'express_api',
        django: 'integrated'
      };
      return backendMapping[baseId] || 'integrated';
    }
    return 'integrated';
  }

  private selectData(requirements: CompositionRequirements): string {
    if (requirements.tech_preferences?.database_type) {
      const type = requirements.tech_preferences.database_type.toLowerCase();
      if (type.includes('postgres') && type.includes('neon')) return 'neon_postgres';
      if (type.includes('supabase')) return 'supabase_full';
      if (type.includes('firebase')) return 'firebase_full';
      if (type.includes('turso')) return 'turso';
      if (type.includes('mongo')) return 'mongodb';
    }
    return 'neon_postgres'; // Default
  }

  private selectArchitecture(requirements: CompositionRequirements): string {
    if (requirements.scale_tier === 'global') {
      return 'edge';
    }
    return 'monolith';
  }

  private calculateScore(composition: StackComposition, requirements: CompositionRequirements): number {
    let score = 50; // Base score

    // Bonus for matching tech preferences
    if (requirements.tech_preferences?.frontend_framework) {
      const pref = requirements.tech_preferences.frontend_framework.toLowerCase();
      const baseMapping: Record<string, string> = {
        'nextjs': 'nextjs_app_router',
        'remix': 'remix',
        'sveltekit': 'sveltekit',
        'nuxt': 'vue_nuxt',
        'astro': 'astro'
      };
      if (baseMapping[pref] === composition.base) {
        score += 30;
      }
    }

    // Bonus for matching database preference
    if (requirements.tech_preferences?.database_type) {
      const type = requirements.tech_preferences.database_type.toLowerCase();
      if (type.includes('postgres') && composition.data === 'neon_postgres') {
        score += 20;
      }
    }

    // Bonus for mobile if requested
    if (requirements.platform_targets?.includes('mobile') && composition.mobile !== 'none') {
      score += 20;
    }

    // Penalty for unnecessary complexity
    if (requirements.backend_complexity === 'simple' && composition.backend !== 'integrated') {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score)); // Clamp between 0-100
  }

  private generateReason(composition: StackComposition, requirements: CompositionRequirements): string {
    const reasons: string[] = [];

    if (composition.base === 'nextjs_app_router') {
      reasons.push('Next.js provides excellent developer experience and SEO');
    } else if (composition.base === 'astro') {
      reasons.push('Astro is perfect for content-heavy sites with minimal JavaScript');
    }

    if (composition.data === 'neon_postgres') {
      reasons.push('Neon offers serverless PostgreSQL with excellent DX');
    }

    if (composition.architecture === 'monolith') {
      reasons.push('Monolith architecture is simplest for MVPs and small teams');
    }

    if (composition.mobile !== 'none') {
      reasons.push('Mobile support via Expo for cross-platform deployment');
    }

    return reasons.join(' ');
  }
}
