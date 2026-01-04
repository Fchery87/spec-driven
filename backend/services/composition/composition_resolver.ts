import {
  StackComposition,
  CompositionSystem,
  CompositionValidation,
  ResolvedStack,
  BaseLayer,
  MobileAddon,
  BackendAddon,
  DataAddon,
  ArchitectureAddon,
  validateComposition
} from '@/types/composition';
import { logger } from '@/lib/logger';

export class CompositionResolver {
  constructor(private system: CompositionSystem) {}

  /**
   * Resolve a stack composition into a full stack definition
   */
  resolve(composition: StackComposition): CompositionValidation {
    logger.info('[CompositionResolver] Resolving composition', { composition });

    // Validate composition first
    const validation = validateComposition(composition, this.system);

    if (!validation.valid) {
      logger.warn('[CompositionResolver] Invalid composition', {
        composition,
        errors: validation.errors
      });
      return validation;
    }

    // Resolve layers
    const base = this.resolveBase(composition.base);
    const mobile = composition.mobile !== 'none' ? this.resolveMobile(composition.mobile) : null;
    const backend = this.resolveBackend(composition.backend);
    const data = this.resolveData(composition.data);
    const architecture = this.resolveArchitecture(composition.architecture);

    if (!base || !backend || !data || !architecture) {
      return {
        valid: false,
        errors: ['Failed to resolve one or more layers'],
        warnings: validation.warnings
      };
    }

    // Build resolved stack
    const resolved_stack = this.buildResolvedStack(
      composition,
      { base, mobile, backend, data, architecture }
    );

    logger.info('[CompositionResolver] Successfully resolved stack', {
      stackId: resolved_stack.id,
      stackName: resolved_stack.name
    });

    return {
      valid: true,
      errors: [],
      warnings: validation.warnings,
      composition,
      resolved_stack
    };
  }

  /**
   * Generate unique ID for composition
   */
  generateCompositionId(composition: StackComposition): string {
    return `${composition.base}+${composition.mobile}+${composition.backend}+${composition.data}+${composition.architecture}`;
  }

  /**
   * Generate human-readable name for composition
   */
  generateCompositionName(layers: {
    base: BaseLayer;
    mobile: MobileAddon | null;
    data: DataAddon;
  }): string {
    const parts = [layers.base.name];

    if (layers.mobile && layers.mobile.name !== 'No Mobile') {
      parts.push(layers.mobile.name);
    }

    parts.push(layers.data.name);

    return parts.join(' + ');
  }

  private resolveBase(id: string): BaseLayer | null {
    const layer = this.system.base_layers[id];
    if (!layer) return null;
    return { id, ...layer };
  }

  private resolveMobile(id: string): MobileAddon | null {
    const layer = this.system.mobile_addons[id];
    if (!layer) return null;
    return { id, ...layer };
  }

  private resolveBackend(id: string): BackendAddon | null {
    const layer = this.system.backend_addons[id];
    if (!layer) return null;
    return { id, ...layer };
  }

  private resolveData(id: string): DataAddon | null {
    const layer = this.system.data_addons[id];
    if (!layer) return null;
    return { id, ...layer };
  }

  private resolveArchitecture(id: string): ArchitectureAddon | null {
    const layer = this.system.architecture_addons[id];
    if (!layer) return null;
    return { id, ...layer };
  }

  private buildResolvedStack(
    composition: StackComposition,
    layers: {
      base: BaseLayer;
      mobile: MobileAddon | null;
      backend: BackendAddon | null;
      data: DataAddon;
      architecture: ArchitectureAddon;
    }
  ): ResolvedStack {
    const id = this.generateCompositionId(composition);
    const name = this.generateCompositionName(layers);

    // Merge compositions - base layer takes precedence for core components
    const mergedComposition: ResolvedStack['composition'] = {
      frontend: layers.base.composition.frontend,
      backend: layers.base.composition.backend,
      ...(layers.mobile?.composition || {}),
      ...layers.data.composition,
    };

    // Merge strengths, tradeoffs, best_for
    const strengths = [
      ...layers.base.strengths,
      ...(layers.mobile?.strengths || []),
      ...(layers.backend?.strengths || []),
      ...layers.data.strengths,
      ...layers.architecture.strengths,
    ];

    const tradeoffs = [
      ...layers.base.tradeoffs,
      ...(layers.mobile?.tradeoffs || []),
      ...(layers.backend?.tradeoffs || []),
      ...layers.data.tradeoffs,
      ...layers.architecture.tradeoffs,
    ];

    const best_for = [
      ...layers.base.best_for,
      ...(layers.mobile?.best_for || []),
      ...(layers.backend?.best_for || []),
      ...layers.data.best_for,
      ...layers.architecture.best_for,
    ];

    // Generate description
    const description = [
      layers.base.description,
      layers.mobile?.description,
      layers.backend?.description,
      layers.data.description,
      `Deployment: ${layers.architecture.name}`,
    ]
      .filter(Boolean)
      .join('. ');

    // Determine scaling based on architecture and data
    const scaling = this.determineScaling(layers.architecture, layers.data);

    return {
      id,
      name,
      description,
      composition: mergedComposition,
      layers,
      strengths: [...new Set(strengths)], // Remove duplicates
      tradeoffs: [...new Set(tradeoffs)],
      best_for: [...new Set(best_for)],
      scaling,
    };
  }

  private determineScaling(
    architecture: ArchitectureAddon,
    data: DataAddon
  ): string {
    if (architecture.id === 'edge') {
      return 'Global edge, virtually unlimited scale with proper database choice';
    }

    if (architecture.id === 'microservices') {
      return 'Horizontally scalable, can handle millions of users with proper infrastructure';
    }

    // Monolith scaling depends on database
    if (data.id === 'neon_postgres' || data.id === 'turso') {
      return 'Good for <100k DAU with serverless database, can scale with caching';
    }

    if (data.id === 'supabase_full' || data.id === 'planetscale') {
      return 'Good for <500k DAU, scales with database tier';
    }

    return 'Scalable based on infrastructure configuration';
  }
}
