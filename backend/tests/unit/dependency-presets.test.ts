import { describe, it, expect } from 'vitest';
import {
  detectFeaturesFromPRD,
  getTemplatePreset,
  buildDependencyContract,
  formatDependencyPresetForPrompt,
  DEPENDENCY_PRESETS,
  type TemplatePreset,
  type DependencyContract,
} from '@/backend/config/dependency-presets';

describe('Dependency Presets', () => {
  describe('detectFeaturesFromPRD', () => {
    it('should detect payment feature from PRD content', () => {
      const prd = 'This app needs payment processing and subscription billing';
      const features = detectFeaturesFromPRD(prd, 'nextjs_web_app');

      expect(features).toContain('payments');
    });

    it('should detect real-time feature from PRD content', () => {
      const prd = 'The application needs real-time notifications and live updates';
      const features = detectFeaturesFromPRD(prd, 'nextjs_web_app');

      expect(features).toContain('real_time');
    });

    it('should detect file upload feature from PRD content', () => {
      const prd = 'Users can upload images and media files to cloud storage';
      const features = detectFeaturesFromPRD(prd, 'nextjs_web_app');

      expect(features).toContain('file_upload');
    });

    it('should detect email feature from PRD content', () => {
      const prd = 'Send transactional emails and newsletters to users';
      const features = detectFeaturesFromPRD(prd, 'nextjs_web_app');

      expect(features).toContain('email');
    });

    it('should detect analytics feature from PRD content', () => {
      const prd = 'Track user analytics and metrics for business insights';
      const features = detectFeaturesFromPRD(prd, 'nextjs_web_app');

      expect(features).toContain('analytics');
    });

    it('should detect multiple features from PRD content', () => {
      const prd = `
        Build a web app with payment processing for subscriptions,
        real-time notifications, file upload for media,
        and email for transactional messages
      `;
      const features = detectFeaturesFromPRD(prd, 'nextjs_web_app');

      expect(features).toContain('payments');
      expect(features).toContain('real_time');
      expect(features).toContain('file_upload');
      expect(features).toContain('email');
      expect(features.length).toBeGreaterThanOrEqual(4);
    });

    it('should detect ML feature for hybrid_nextjs_fastapi stack', () => {
      const prd = 'Build an AI-powered app with machine learning models for predictions';
      const features = detectFeaturesFromPRD(prd, 'hybrid_nextjs_fastapi');

      expect(features).toContain('ml');
    });

    it('should detect async_tasks feature for hybrid stack', () => {
      const prd = 'Process background jobs with async task queues and workers';
      const features = detectFeaturesFromPRD(prd, 'hybrid_nextjs_fastapi');

      expect(features).toContain('async_tasks');
    });

    it('should return empty array for unknown template', () => {
      const prd = 'Some PRD content';
      const features = detectFeaturesFromPRD(prd, 'unknown_template');

      expect(features).toEqual([]);
    });

    it('should be case-insensitive for feature detection', () => {
      const prd = 'PAYMENTS, REAL-TIME, UPLOAD, EMAIL, ANALYTICS';
      const features = detectFeaturesFromPRD(prd, 'nextjs_web_app');

      expect(features).toContain('payments');
      expect(features).toContain('real_time');
      expect(features).toContain('file_upload');
      expect(features).toContain('email');
      expect(features).toContain('analytics');
    });
  });

  describe('getTemplatePreset', () => {
    it('should return correct preset for nextjs_web_app', () => {
      const preset = getTemplatePreset('nextjs_web_app');

      expect(preset).toBeDefined();
      expect(preset.core).toBeDefined();
      expect(preset.core.next).toBe('^14.2.0');
      expect(preset.core.react).toBe('^18.2.0');
      expect(preset.devDependencies).toBeDefined();
      expect(preset.features).toBeDefined();
    });

    it('should return correct preset for hybrid_nextjs_fastapi', () => {
      const preset = getTemplatePreset('hybrid_nextjs_fastapi');

      expect(preset).toBeDefined();
      expect(preset.core).toBeDefined();
      expect(preset.pythonDeps).toBeDefined();
      expect(preset.pythonDeps?.fastapi).toBe('>=0.109.0');
      expect(preset.features.ml).toBeDefined();
    });

    it('should return correct preset for react_native_supabase', () => {
      const preset = getTemplatePreset('react_native_supabase');

      expect(preset).toBeDefined();
      expect(preset.core).toBeDefined();
      expect(preset.core.expo).toBeDefined();
      expect(preset.core['@supabase/supabase-js']).toBe('^2.43.0');
    });

    it('should return nextjs_web_app as fallback for custom stack', () => {
      const preset = getTemplatePreset('custom');

      expect(preset).toBeDefined();
      expect(preset.core.next).toBe('^14.2.0');
    });

    it('should return nextjs_web_app as fallback for unknown template', () => {
      const preset = getTemplatePreset('unknown_template_xyz');

      expect(preset).toBeDefined();
      expect(preset.core.next).toBe('^14.2.0');
    });

    it('should have all required templates defined', () => {
      const requiredTemplates = [
        'nextjs_web_app',
        'nextjs_web_only',
        'nextjs_fullstack_expo',
        'hybrid_nextjs_fastapi',
        'react_express',
        'vue_nuxt',
        'svelte_kit',
        'astro_static',
        'serverless_edge',
        'django_htmx',
        'go_react',
        'flutter_firebase',
        'react_native_supabase',
      ];

      for (const templateId of requiredTemplates) {
        expect(DEPENDENCY_PRESETS[templateId]).toBeDefined();
      }
    });
  });

  describe('buildDependencyContract', () => {
    it('should build contract for nextjs_web_app with no features', () => {
      const contract = buildDependencyContract({
        templateId: 'nextjs_web_app',
        prdContent: 'Simple web app',
        packageManager: 'pnpm',
      });

      expect(contract).toBeDefined();
      expect(contract.package_manager).toBe('pnpm');
      expect(contract.lockfile).toBe('pnpm-lock.yaml');
      expect(contract.baseline.dependencies.length).toBeGreaterThan(0);
      expect(contract.baseline.devDependencies.length).toBeGreaterThan(0);
      expect(contract.banned).toContain('request');
      expect(contract.commands.pnpm).toBeDefined();
    });

    it('should build contract with detected payment feature', () => {
      const contract = buildDependencyContract({
        templateId: 'nextjs_web_app',
        prdContent: 'App with payment processing and billing',
        packageManager: 'npm',
      });

      expect(contract.package_manager).toBe('npm');
      expect(contract.lockfile).toBe('package-lock.json');

      const paymentAddon = contract.addons.find(
        (addon) => addon.capability === 'feature:payments'
      );
      expect(paymentAddon).toBeDefined();
      expect(paymentAddon?.packages.some((pkg) => pkg.name === 'stripe')).toBe(true);
    });

    it('should build contract with Python deps for hybrid stack', () => {
      const contract = buildDependencyContract({
        templateId: 'hybrid_nextjs_fastapi',
        prdContent: 'Web app with Python backend',
        packageManager: 'bun',
      });

      expect(contract.package_manager).toBe('bun');
      expect(contract.lockfile).toBe('bun.lockb');

      const pythonAddon = contract.addons.find(
        (addon) => addon.capability === 'python_backend'
      );
      expect(pythonAddon).toBeDefined();
      expect(pythonAddon?.packages.some((pkg) => pkg.name === 'fastapi')).toBe(true);
    });

    it('should build contract with ML features for hybrid stack', () => {
      const contract = buildDependencyContract({
        templateId: 'hybrid_nextjs_fastapi',
        prdContent: 'AI app with machine learning models and predictions',
      });

      const mlAddon = contract.addons.find(
        (addon) => addon.capability === 'feature:ml'
      );
      expect(mlAddon).toBeDefined();
      expect(mlAddon?.packages.some((pkg) => pkg.name === 'numpy')).toBe(true);
      expect(mlAddon?.packages.some((pkg) => pkg.name === 'pandas')).toBe(true);
      expect(mlAddon?.packages.some((pkg) => pkg.name === 'scikit-learn')).toBe(true);
    });

    it('should build contract with multiple features', () => {
      const contract = buildDependencyContract({
        templateId: 'nextjs_web_app',
        prdContent: `
          E-commerce app with:
          - Payment processing via Stripe
          - Real-time order notifications
          - Product image uploads to cloud storage
          - Email confirmations for orders
          - Analytics tracking for user behavior
        `,
      });

      expect(contract.addons.length).toBeGreaterThanOrEqual(5);
      expect(contract.addons.some((addon) => addon.capability === 'feature:payments')).toBe(true);
      expect(contract.addons.some((addon) => addon.capability === 'feature:real_time')).toBe(true);
      expect(contract.addons.some((addon) => addon.capability === 'feature:file_upload')).toBe(true);
      expect(contract.addons.some((addon) => addon.capability === 'feature:email')).toBe(true);
      expect(contract.addons.some((addon) => addon.capability === 'feature:analytics')).toBe(true);
    });

    it('should default to pnpm if package manager not specified', () => {
      const contract = buildDependencyContract({
        templateId: 'nextjs_web_app',
        prdContent: 'Simple app',
      });

      expect(contract.package_manager).toBe('pnpm');
      expect(contract.lockfile).toBe('pnpm-lock.yaml');
    });

    it('should include all baseline dependencies with proper structure', () => {
      const contract = buildDependencyContract({
        templateId: 'nextjs_web_app',
        prdContent: 'Test app',
      });

      for (const dep of contract.baseline.dependencies) {
        expect(dep.name).toBeDefined();
        expect(dep.range).toBeDefined();
        expect(dep.reason).toBeDefined();
        expect(dep.category).toBe('core');
        expect(Array.isArray(dep.links)).toBe(true);
      }

      for (const dep of contract.baseline.devDependencies) {
        expect(dep.name).toBeDefined();
        expect(dep.range).toBeDefined();
        expect(dep.reason).toBeDefined();
        expect(dep.category).toBe('dev');
        expect(Array.isArray(dep.links)).toBe(true);
      }
    });
  });

  describe('formatDependencyPresetForPrompt', () => {
    it('should format contract for prompt with no features', () => {
      const contract = buildDependencyContract({
        templateId: 'nextjs_web_app',
        prdContent: 'Simple app',
      });

      const formatted = formatDependencyPresetForPrompt({
        templateId: 'nextjs_web_app',
        contract,
        detectedFeatures: [],
      });

      expect(formatted).toContain('Template: nextjs_web_app');
      expect(formatted).toContain('Package Manager: pnpm');
      expect(formatted).toContain('Detected Features: None');
      expect(formatted).toContain('Core Dependencies:');
      expect(formatted).toContain('Dev Dependencies:');
      expect(formatted).toContain('next@^14.2.0');
      expect(formatted).toContain('react@^18.2.0');
    });

    it('should format contract for prompt with detected features', () => {
      const contract = buildDependencyContract({
        templateId: 'nextjs_web_app',
        prdContent: 'App with payments and real-time features',
        packageManager: 'npm',
      });

      const formatted = formatDependencyPresetForPrompt({
        templateId: 'nextjs_web_app',
        contract,
        detectedFeatures: ['payments', 'real_time'],
      });

      expect(formatted).toContain('Template: nextjs_web_app');
      expect(formatted).toContain('Package Manager: npm');
      expect(formatted).toContain('Detected Features: payments, real_time');
      expect(formatted).toContain('Add-ons:');
      expect(formatted).toContain('feature:payments');
      expect(formatted).toContain('feature:real_time');
      expect(formatted).toContain('stripe@');
      expect(formatted).toContain('pusher-js@');
    });

    it('should format Python dependencies correctly for hybrid stack', () => {
      const contract = buildDependencyContract({
        templateId: 'hybrid_nextjs_fastapi',
        prdContent: 'Web app with Python backend and ML',
      });

      const formatted = formatDependencyPresetForPrompt({
        templateId: 'hybrid_nextjs_fastapi',
        contract,
        detectedFeatures: ['ml'],
      });

      expect(formatted).toContain('python_backend');
      expect(formatted).toContain('fastapi@');
      expect(formatted).toContain('uvicorn@');
    });
  });

  describe('Template Preset Validation', () => {
    it('should have core dependencies for all templates', () => {
      for (const [templateId, preset] of Object.entries(DEPENDENCY_PRESETS)) {
        // flutter_firebase and django_htmx have empty core (use flutterDeps/pythonDeps instead)
        if (templateId === 'flutter_firebase' || templateId === 'django_htmx') {
          expect(preset.core).toBeDefined();
        } else {
          expect(preset.core).toBeDefined();
          expect(Object.keys(preset.core).length).toBeGreaterThan(0);
        }
        expect(preset.features).toBeDefined();
      }
    });

    it('should have proper version constraints', () => {
      const preset = DEPENDENCY_PRESETS.nextjs_web_app;

      for (const [depName, version] of Object.entries(preset.core)) {
        expect(version).toMatch(/^[\^~>=]/); // Should start with version constraint
      }
    });

    it('should have trigger keywords for all features', () => {
      for (const [templateId, preset] of Object.entries(DEPENDENCY_PRESETS)) {
        for (const [featureName, feature] of Object.entries(preset.features)) {
          expect(feature.triggerKeywords).toBeDefined();
          expect(feature.triggerKeywords.length).toBeGreaterThan(0);
          expect(feature.deps).toBeDefined();
          expect(Object.keys(feature.deps).length).toBeGreaterThan(0);
        }
      }
    });
  });
});
