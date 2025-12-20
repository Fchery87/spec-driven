import { describe, it, expect } from 'vitest';
import { OrchestratorEngine } from '@/backend/services/orchestrator/orchestrator_engine';
import {
  deriveIntelligentDefaultStack,
  parseProjectClassification,
} from '@/backend/lib/stack_defaults';

describe('Stack Selection Flow Integration', () => {
  describe('OrchestratorEngine.parseStackAnalysis', () => {
    const engine = new OrchestratorEngine();

    it('should parse stack-analysis.md with PRIMARY_RECOMMENDATION', () => {
      const stackAnalysisMd = `
# Stack Analysis Report

## Project Classification
- Type: web_app
- Scale Tier: startup
- Platforms: [web]

## Evaluation Results

### 🏆 Primary Recommendation: nextjs_web_app

PRIMARY_RECOMMENDATION: nextjs_web_app

**Score: 95/100**

- ✅ Platform Coverage: Perfect match for web-only
- ✅ Scale Appropriateness: Excellent for 1k-10k users

### 🥈 Alternative 1: hybrid_nextjs_fastapi

ALTERNATIVE_1: hybrid_nextjs_fastapi

**Score: 78/100**

### 🥉 Alternative 2: CUSTOM

ALTERNATIVE_2: custom

**Score: N/A**
      `;

      const result = engine.parseStackAnalysis(stackAnalysisMd);

      expect(result.primary).toBe('nextjs_web_app');
      expect(result.alternative1).toBe('hybrid_nextjs_fastapi');
      expect(result.alternative2).toBe('custom');
    });

    it('should parse stack-analysis.md with alternative markdown formatting', () => {
      const stackAnalysisMd = `
# Stack Analysis

Recommended Template: nextjs_web_app

Alternative 1: react_express

Alternative 2: vue_nuxt
      `;

      const result = engine.parseStackAnalysis(stackAnalysisMd);

      expect(result.primary).toBe('nextjs_web_app');
      expect(result.alternative1).toBe('react_express');
      expect(result.alternative2).toBe('vue_nuxt');
    });

    it('should normalize stack IDs with spaces to underscores', () => {
      const stackAnalysisMd = `
PRIMARY_RECOMMENDATION: Next.js Web App
ALTERNATIVE_1: React Express
      `;

      const result = engine.parseStackAnalysis(stackAnalysisMd);

      expect(result.primary).toBe('nextjs_web_app');
      expect(result.alternative1).toBe('react_express');
    });

    it('should handle CUSTOM stack recommendation', () => {
      const stackAnalysisMd = `
PRIMARY_RECOMMENDATION: nextjs_web_app
ALTERNATIVE_1: hybrid_nextjs_fastapi
ALTERNATIVE_2: CUSTOM
      `;

      const result = engine.parseStackAnalysis(stackAnalysisMd);

      expect(result.primary).toBe('nextjs_web_app');
      expect(result.alternative1).toBe('hybrid_nextjs_fastapi');
      expect(result.alternative2).toBe('custom');
    });

    it('should handle default fallback indicator', () => {
      const stackAnalysisMd = `
PRIMARY_RECOMMENDATION: nextjs_web_app
DEFAULT_FALLBACK_USED: true
      `;

      const result = engine.parseStackAnalysis(stackAnalysisMd);

      expect(result.primary).toBe('nextjs_web_app');
      expect(result.defaultFallbackUsed).toBe(true);
    });

    it('should handle missing recommendations gracefully', () => {
      const stackAnalysisMd = `
# Some random markdown content without proper format
      `;

      const result = engine.parseStackAnalysis(stackAnalysisMd);

      expect(result.primary).toBeUndefined();
      expect(result.alternative1).toBeUndefined();
      expect(result.alternative2).toBeUndefined();
    });

    it('should handle empty content', () => {
      const result = engine.parseStackAnalysis('');

      expect(result).toEqual({});
    });
  });

  describe('OrchestratorEngine.resolveStackSelectionMetadata', () => {
    const engine = new OrchestratorEngine();

    it('should resolve metadata from ANALYSIS and STACK_SELECTION artifacts', () => {
      const artifacts = {
        'ANALYSIS/project-classification.json': JSON.stringify({
          project_type: 'web_app',
          scale_tier: 'startup',
          platform_targets: ['web'],
          backend_complexity: 'moderate_business_logic',
        }),
        'ANALYSIS/project-brief.md': 'Build a web app for startups',
        'STACK_SELECTION/stack-analysis.md': `
PRIMARY_RECOMMENDATION: nextjs_web_app
ALTERNATIVE_1: hybrid_nextjs_fastapi
        `,
      };

      const metadata = engine.resolveStackSelectionMetadata(artifacts);

      expect(metadata.projectType).toBe('web_app');
      expect(metadata.scaleTier).toBe('startup');
      expect(metadata.recommendedStack).toBe('nextjs_web_app');
      expect(metadata.workflowVersion).toBe(2);
    });

    it('should use intelligent defaults when stack-analysis.md is missing', () => {
      const artifacts = {
        'ANALYSIS/project-classification.json': JSON.stringify({
          project_type: 'mobile_app',
          scale_tier: 'prototype',
          platform_targets: ['ios', 'android'],
        }),
        'ANALYSIS/project-brief.md': 'Mobile app for iOS and Android',
      };

      const metadata = engine.resolveStackSelectionMetadata(artifacts);

      expect(metadata.projectType).toBe('mobile_app');
      expect(metadata.scaleTier).toBe('prototype');
      expect(metadata.recommendedStack).toBe('react_native_supabase');
      expect(metadata.workflowVersion).toBe(2);
    });

    it('should handle missing project classification gracefully', () => {
      const artifacts = {
        'ANALYSIS/project-brief.md': 'Some project description',
      };

      const metadata = engine.resolveStackSelectionMetadata(artifacts);

      expect(metadata.projectType).toBeUndefined();
      expect(metadata.scaleTier).toBeUndefined();
      expect(metadata.recommendedStack).toBe('nextjs_web_app'); // Default fallback
      expect(metadata.workflowVersion).toBe(2);
    });

    it('should prefer primary recommendation over defaults', () => {
      const artifacts = {
        'ANALYSIS/project-classification.json': JSON.stringify({
          project_type: 'web_app',
        }),
        'STACK_SELECTION/stack-analysis.md': `
PRIMARY_RECOMMENDATION: vue_nuxt
        `,
      };

      const metadata = engine.resolveStackSelectionMetadata(artifacts);

      expect(metadata.recommendedStack).toBe('vue_nuxt');
    });
  });

  describe('Intelligent Default Stack Selection', () => {
    it('should recommend nextjs_web_app for web_app type', () => {
      const classification = {
        project_type: 'web_app',
        scale_tier: 'startup',
        platform_targets: ['web'],
        backend_complexity: 'moderate_business_logic',
      };

      const result = deriveIntelligentDefaultStack(classification, '');

      expect(result.stack).toBe('nextjs_web_app');
      expect(result.reason).toBe('project_type=web_app');
    });

    it('should recommend react_native_supabase for mobile_app type', () => {
      const classification = {
        project_type: 'mobile_app',
        scale_tier: 'startup',
        platform_targets: ['ios', 'android'],
        backend_complexity: 'simple_crud',
      };

      const result = deriveIntelligentDefaultStack(classification, '');

      expect(result.stack).toBe('react_native_supabase');
      expect(result.reason).toBe('project_type=mobile_app');
    });

    it('should recommend nextjs_fullstack_expo for fullstack_with_mobile type', () => {
      const classification = {
        project_type: 'fullstack_with_mobile',
        scale_tier: 'growth',
        platform_targets: ['web', 'ios', 'android'],
        backend_complexity: 'moderate_business_logic',
      };

      const result = deriveIntelligentDefaultStack(classification, '');

      expect(result.stack).toBe('nextjs_fullstack_expo');
      expect(result.reason).toBe('project_type=fullstack_with_mobile');
    });

    it('should recommend serverless_edge for api_platform type', () => {
      const classification = {
        project_type: 'api_platform',
        scale_tier: 'growth',
        platform_targets: ['api'],
        backend_complexity: 'moderate_business_logic',
      };

      const result = deriveIntelligentDefaultStack(classification, '');

      expect(result.stack).toBe('serverless_edge');
      expect(result.reason).toBe('project_type=api_platform');
    });

    it('should recommend astro_static for static_site type', () => {
      const classification = {
        project_type: 'static_site',
        scale_tier: 'prototype',
        platform_targets: ['web'],
        backend_complexity: 'simple_crud',
      };

      const result = deriveIntelligentDefaultStack(classification, '');

      expect(result.stack).toBe('astro_static');
      expect(result.reason).toBe('project_type=static_site');
    });

    it('should recommend hybrid_nextjs_fastapi for backend_heavy type', () => {
      const classification = {
        project_type: 'backend_heavy',
        scale_tier: 'growth',
        platform_targets: ['web', 'api'],
        backend_complexity: 'ml_ai_intensive',
      };

      const result = deriveIntelligentDefaultStack(classification, '');

      expect(result.stack).toBe('hybrid_nextjs_fastapi');
      expect(result.reason).toBe('project_type=backend_heavy');
    });

    it('should detect Python/ML keywords in brief and suggest hybrid stack', () => {
      // When project_type is not 'web_app', the function checks the brief for ML keywords
      const classification = null; // No classification to force brief-based detection

      const brief = `
        Build an AI-powered web app with machine learning models
        using Python and TensorFlow for data processing
      `;

      const result = deriveIntelligentDefaultStack(classification, brief);

      expect(result.stack).toBe('hybrid_nextjs_fastapi');
      expect(result.reason).toBe('brief suggests ML/AI workload');
    });

    it('should fallback to nextjs_web_app for unknown project type', () => {
      const classification = null;
      const result = deriveIntelligentDefaultStack(classification, '');

      expect(result.stack).toBe('nextjs_web_app');
      expect(result.reason).toBe('fallback default for web applications');
    });
  });

  describe('Project Classification Parsing', () => {
    it('should parse valid project classification JSON', () => {
      const json = JSON.stringify({
        project_type: 'web_app',
        scale_tier: 'startup',
        platform_targets: ['web'],
        backend_complexity: 'moderate_business_logic',
      });

      const result = parseProjectClassification(json);

      expect(result?.project_type).toBe('web_app');
      expect(result?.scale_tier).toBe('startup');
      expect(result?.platform_targets).toEqual(['web']);
      expect(result?.backend_complexity).toBe('moderate_business_logic');
    });

    it('should handle invalid JSON gracefully', () => {
      const result = parseProjectClassification('invalid json');

      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      const result = parseProjectClassification('');

      expect(result).toBeNull();
    });

    it('should handle JSON with missing fields', () => {
      const json = JSON.stringify({
        project_type: 'mobile_app',
      });

      const result = parseProjectClassification(json);

      expect(result?.project_type).toBe('mobile_app');
      expect(result?.scale_tier).toBeUndefined();
    });
  });

  describe('End-to-End Workflow Simulation', () => {
    it('should handle complete workflow: minimal input -> classification -> stack selection', () => {
      const engine = new OrchestratorEngine();

      // Step 1: ANALYSIS phase generates classification
      const classificationJson = JSON.stringify({
        project_type: 'web_app',
        scale_tier: 'prototype',
        platform_targets: ['web'],
        backend_complexity: 'simple_crud',
      });

      const classification = parseProjectClassification(classificationJson);
      expect(classification?.project_type).toBe('web_app');

      // Step 2: Derive intelligent default
      const defaultResult = deriveIntelligentDefaultStack(classification, 'Build a web app');
      expect(defaultResult.stack).toBe('nextjs_web_app');

      // Step 3: AI generates stack-analysis.md
      const stackAnalysisMd = `
# Stack Analysis Report

PRIMARY_RECOMMENDATION: ${defaultResult.stack}
ALTERNATIVE_1: react_express
ALTERNATIVE_2: custom
DEFAULT_FALLBACK_USED: false
      `;

      const parsed = engine.parseStackAnalysis(stackAnalysisMd);
      expect(parsed.primary).toBe('nextjs_web_app');

      // Step 4: Resolve final metadata
      const artifacts = {
        'ANALYSIS/project-classification.json': classificationJson,
        'ANALYSIS/project-brief.md': 'Build a web app',
        'STACK_SELECTION/stack-analysis.md': stackAnalysisMd,
      };

      const metadata = engine.resolveStackSelectionMetadata(artifacts);
      expect(metadata.projectType).toBe('web_app');
      expect(metadata.scaleTier).toBe('prototype');
      expect(metadata.recommendedStack).toBe('nextjs_web_app');
      expect(metadata.workflowVersion).toBe(2);
    });

    it('should handle mobile project workflow', () => {
      const engine = new OrchestratorEngine();

      const classificationJson = JSON.stringify({
        project_type: 'mobile_app',
        scale_tier: 'startup',
        platform_targets: ['ios', 'android'],
        backend_complexity: 'moderate_business_logic',
      });

      const classification = parseProjectClassification(classificationJson);
      const defaultResult = deriveIntelligentDefaultStack(
        classification,
        'Create an iOS and Android app'
      );

      expect(defaultResult.stack).toBe('react_native_supabase');
      expect(defaultResult.reason).toBe('project_type=mobile_app');

      const stackAnalysisMd = `
PRIMARY_RECOMMENDATION: react_native_supabase
ALTERNATIVE_1: flutter_firebase
ALTERNATIVE_2: custom
      `;

      const metadata = engine.resolveStackSelectionMetadata({
        'ANALYSIS/project-classification.json': classificationJson,
        'ANALYSIS/project-brief.md': 'Create an iOS and Android app',
        'STACK_SELECTION/stack-analysis.md': stackAnalysisMd,
      });

      expect(metadata.projectType).toBe('mobile_app');
      expect(metadata.recommendedStack).toBe('react_native_supabase');
    });

    it('should handle fullstack + mobile workflow', () => {
      const engine = new OrchestratorEngine();

      const classificationJson = JSON.stringify({
        project_type: 'fullstack_with_mobile',
        scale_tier: 'growth',
        platform_targets: ['web', 'ios', 'android'],
        backend_complexity: 'complex_realtime',
      });

      const classification = parseProjectClassification(classificationJson);
      const defaultResult = deriveIntelligentDefaultStack(
        classification,
        'Web dashboard with companion mobile app'
      );

      expect(defaultResult.stack).toBe('nextjs_fullstack_expo');

      const metadata = engine.resolveStackSelectionMetadata({
        'ANALYSIS/project-classification.json': classificationJson,
        'ANALYSIS/project-brief.md': 'Web dashboard with companion mobile app',
        'STACK_SELECTION/stack-analysis.md': `PRIMARY_RECOMMENDATION: nextjs_fullstack_expo`,
      });

      expect(metadata.projectType).toBe('fullstack_with_mobile');
      expect(metadata.recommendedStack).toBe('nextjs_fullstack_expo');
    });
  });
});
