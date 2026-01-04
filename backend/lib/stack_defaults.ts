import { StackComposition } from '@/types/composition';

export type ProjectClassification = {
  project_type?: string;
  scale_tier?: string;
  platform_targets?: string[];
  backend_complexity?: string;
};

export const DEFAULT_STACKS_BY_TYPE: Record<string, string> = {
  web_app: 'nextjs_web_app',
  mobile_app: 'react_native_supabase',
  fullstack_with_mobile: 'nextjs_fullstack_expo',
  api_platform: 'serverless_edge',
  static_site: 'astro_static',
  backend_heavy: 'hybrid_nextjs_fastapi',
};

export function parseProjectClassification(
  raw: string
): ProjectClassification | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProjectClassification;
    return parsed;
  } catch {
    return null;
  }
}

export function deriveIntelligentDefaultStack(
  classification: ProjectClassification | null,
  projectBrief: string
): { stack: string; reason: string } {
  const projectType = classification?.project_type;
  if (projectType && DEFAULT_STACKS_BY_TYPE[projectType]) {
    return {
      stack: DEFAULT_STACKS_BY_TYPE[projectType],
      reason: `project_type=${projectType}`,
    };
  }

  const platforms = classification?.platform_targets || [];
  const platformList = platforms.map((platform) => platform.toLowerCase());
  const hasMobileTargets = platformList.some(
    (platform) => platform === 'ios' || platform === 'android'
  );
  if (hasMobileTargets) {
    return {
      stack: DEFAULT_STACKS_BY_TYPE.mobile_app,
      reason: 'platform_targets include mobile',
    };
  }

  if (classification?.backend_complexity === 'ml_ai_intensive') {
    return {
      stack: DEFAULT_STACKS_BY_TYPE.backend_heavy,
      reason: 'backend_complexity=ml_ai_intensive',
    };
  }

  const brief = projectBrief.toLowerCase();
  const mentionsMobile =
    brief.includes('mobile') ||
    brief.includes('ios') ||
    brief.includes('android') ||
    brief.includes('react native') ||
    brief.includes('expo');
  const mentionsWeb = brief.includes('web') || brief.includes('browser');

  if (mentionsMobile && mentionsWeb) {
    return {
      stack: DEFAULT_STACKS_BY_TYPE.fullstack_with_mobile,
      reason: 'brief mentions web + mobile',
    };
  }

  if (mentionsMobile) {
    return {
      stack: DEFAULT_STACKS_BY_TYPE.mobile_app,
      reason: 'brief mentions mobile targets',
    };
  }

  if (brief.includes('static site') || brief.includes('landing page') || brief.includes('blog')) {
    return {
      stack: DEFAULT_STACKS_BY_TYPE.static_site,
      reason: 'brief suggests static content',
    };
  }

  if (brief.includes('api') || brief.includes('webhook') || brief.includes('sdk')) {
    return {
      stack: DEFAULT_STACKS_BY_TYPE.api_platform,
      reason: 'brief suggests API-first platform',
    };
  }

  if (brief.includes('machine learning') || brief.includes('ml') || brief.includes('ai')) {
    return {
      stack: DEFAULT_STACKS_BY_TYPE.backend_heavy,
      reason: 'brief suggests ML/AI workload',
    };
  }

  return {
    stack: DEFAULT_STACKS_BY_TYPE.web_app,
    reason: 'fallback default for web applications',
  };
}

// Composition mapping: maps project_type to StackComposition
const COMPOSITION_BY_PROJECT_TYPE: Record<string, StackComposition> = {
  web_app: {
    base: 'nextjs_app_router',
    mobile: 'none',
    backend: 'integrated',
    data: 'neon_postgres',
    architecture: 'monolith',
  },
  mobile_app: {
    base: 'react_spa',
    mobile: 'expo_integration',
    backend: 'integrated',
    data: 'supabase_full',
    architecture: 'monolith',
  },
  fullstack_with_mobile: {
    base: 'nextjs_app_router',
    mobile: 'expo_integration',
    backend: 'integrated',
    data: 'neon_postgres',
    architecture: 'monolith',
  },
  api_platform: {
    base: 'nextjs_app_router',
    mobile: 'none',
    backend: 'fastapi_api',
    data: 'neon_postgres',
    architecture: 'monolith',
  },
  static_site: {
    base: 'astro',
    mobile: 'none',
    backend: 'none',
    data: 'none',
    architecture: 'monolith',
  },
  backend_heavy: {
    base: 'nextjs_app_router',
    mobile: 'none',
    backend: 'fastapi_api',
    data: 'neon_postgres',
    architecture: 'monolith',
  },
};

export function deriveCompositionFromClassification(
  classification: ProjectClassification | null,
  _projectBrief: string
): StackComposition | null {
  if (!classification?.project_type) {
    return null;
  }

  const composition = COMPOSITION_BY_PROJECT_TYPE[classification.project_type];
  return composition ?? null;
}
