import { StackComposition, LegacyTemplateMapping } from '@/types/composition';
import { logger } from '@/lib/logger';

export class LegacyMigrator {
  constructor(private mappings: Record<string, LegacyTemplateMapping>) {}

  /**
   * Migrate a legacy template ID to a composition
   */
  migrateTemplateId(templateId: string): StackComposition | null {
    const mapping = this.mappings[templateId];

    if (!mapping) {
      logger.warn('[LegacyMigrator] No migration mapping for template', { templateId });
      return null;
    }

    logger.info('[LegacyMigrator] Migrating legacy template', {
      templateId,
      composition: mapping.composition,
      reason: mapping.reason
    });

    return mapping.composition;
  }

  /**
   * Check if a template ID is a legacy template
   */
  isLegacyTemplate(templateId: string): boolean {
    return templateId in this.mappings;
  }

  /**
   * Get the migration reason for a template
   */
  getMigrationReason(templateId: string): string | null {
    const mapping = this.mappings[templateId];
    return mapping?.reason || null;
  }

  /**
   * Get all legacy template IDs
   */
  getAllLegacyTemplateIds(): string[] {
    return Object.keys(this.mappings);
  }

  /**
   * Migrate multiple template IDs
   */
  migrateMultiple(templateIds: string[]): Record<string, StackComposition | null> {
    const results: Record<string, StackComposition | null> = {};

    for (const id of templateIds) {
      results[id] = this.migrateTemplateId(id);
    }

    return results;
  }
}
