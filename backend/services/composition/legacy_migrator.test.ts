import { describe, it, expect } from 'vitest';
import { LegacyMigrator } from './legacy_migrator';
import { LegacyTemplateMapping } from '@/types/composition';

describe('LegacyMigrator', () => {
  const mockLegacyMappings: Record<string, LegacyTemplateMapping> = {
    nextjs_fullstack_expo: {
      composition: {
        base: 'nextjs_app_router',
        mobile: 'expo_integration',
        backend: 'integrated',
        data: 'neon_postgres',
        architecture: 'monolith'
      },
      reason: 'Full-stack Next.js + Expo'
    },
    nextjs_web_app: {
      composition: {
        base: 'nextjs_app_router',
        mobile: 'none',
        backend: 'integrated',
        data: 'neon_postgres',
        architecture: 'monolith'
      },
      reason: 'Web-only Next.js'
    }
  };

  it('should migrate legacy template ID to composition', () => {
    const migrator = new LegacyMigrator(mockLegacyMappings);

    const composition = migrator.migrateTemplateId('nextjs_fullstack_expo');

    expect(composition).toBeDefined();
    expect(composition?.base).toBe('nextjs_app_router');
    expect(composition?.mobile).toBe('expo_integration');
    expect(composition?.data).toBe('neon_postgres');
  });

  it('should return null for unmapped template', () => {
    const migrator = new LegacyMigrator(mockLegacyMappings);

    const composition = migrator.migrateTemplateId('unknown_template');

    expect(composition).toBeNull();
  });

  it('should check if template ID is legacy', () => {
    const migrator = new LegacyMigrator(mockLegacyMappings);

    expect(migrator.isLegacyTemplate('nextjs_fullstack_expo')).toBe(true);
    expect(migrator.isLegacyTemplate('unknown_template')).toBe(false);
  });

  it('should get migration reason', () => {
    const migrator = new LegacyMigrator(mockLegacyMappings);

    const reason = migrator.getMigrationReason('nextjs_web_app');

    expect(reason).toBe('Web-only Next.js');
  });
});
