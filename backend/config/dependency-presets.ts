export type Runtime = 'node' | 'python' | 'go' | 'flutter';

export interface FeaturePreset {
  deps: Record<string, string>;
  triggerKeywords: string[];
  runtime?: Runtime;
}

export interface TemplatePreset {
  core: Record<string, string>;
  pythonDeps?: Record<string, string>;
  goDeps?: Record<string, string>;
  flutterDeps?: Record<string, string>;
  devDependencies?: Record<string, string>;
  features: Record<string, FeaturePreset>;
}

export interface DependencyEntry {
  name: string;
  range: string;
  reason: string;
  links: string[];
  category: string;
}

export interface DependencyContract {
  package_manager: string;
  lockfile: string;
  baseline: {
    dependencies: DependencyEntry[];
    devDependencies: DependencyEntry[];
  };
  addons: Array<{
    capability: string;
    packages: DependencyEntry[];
  }>;
  banned: string[];
  commands: Record<string, Record<string, string>>;
}

const BASE_NEXTJS_CORE: Record<string, string> = {
  next: '^14.2.0',
  react: '^18.2.0',
  'react-dom': '^18.2.0',
  typescript: '^5.4.0',
  tailwindcss: '^3.4.0',
  'drizzle-orm': '^0.30.0',
  '@neondatabase/serverless': '^0.9.0',
  'better-auth': '^1.0.0',
  zod: '^3.23.0',
  zustand: '^4.5.0',
  '@tanstack/react-query': '^5.0.0',
  'class-variance-authority': '^0.7.0',
  clsx: '^2.1.0',
  'tailwind-merge': '^2.2.0',
  'lucide-react': '^0.400.0',
};

const BASE_NEXTJS_DEV: Record<string, string> = {
  'drizzle-kit': '^0.20.0',
  '@types/node': '^20.11.0',
  '@types/react': '^18.2.0',
  '@types/react-dom': '^18.2.0',
  eslint: '^8.57.0',
  prettier: '^3.2.0',
  vitest: '^1.5.0',
  '@testing-library/react': '^14.2.0',
  playwright: '^1.43.0',
};

const BASE_EXPO_CORE: Record<string, string> = {
  expo: '^50.0.0',
  'react-native': '^0.73.0',
  'expo-router': '^3.0.0',
  'expo-status-bar': '^1.10.0',
  'expo-constants': '^15.4.0',
  'react-native-safe-area-context': '^4.9.0',
  'react-native-screens': '^3.30.0',
};

const BASE_REACT_CORE: Record<string, string> = {
  react: '^18.2.0',
  'react-dom': '^18.2.0',
  'react-router-dom': '^6.22.0',
  zod: '^3.23.0',
};

const BASE_REACT_DEV: Record<string, string> = {
  typescript: '^5.4.0',
  vite: '^5.2.0',
  '@vitejs/plugin-react': '^4.2.0',
  '@types/react': '^18.2.0',
  '@types/react-dom': '^18.2.0',
  eslint: '^8.57.0',
  prettier: '^3.2.0',
};

const BASE_EXPRESS_CORE: Record<string, string> = {
  express: '^4.19.0',
  cors: '^2.8.5',
  helmet: '^7.1.0',
  dotenv: '^16.4.0',
  pg: '^8.11.0',
  'drizzle-orm': '^0.30.0',
};

const BASE_NUXT_CORE: Record<string, string> = {
  nuxt: '^3.11.0',
  vue: '^3.4.0',
  pinia: '^2.1.0',
  zod: '^3.23.0',
};

const BASE_NUXT_DEV: Record<string, string> = {
  typescript: '^5.4.0',
  eslint: '^8.57.0',
  prettier: '^3.2.0',
};

const BASE_SVELTE_CORE: Record<string, string> = {
  svelte: '^4.2.0',
  '@sveltejs/kit': '^2.5.0',
  '@sveltejs/adapter-auto': '^3.2.0',
  zod: '^3.23.0',
};

const BASE_SVELTE_DEV: Record<string, string> = {
  typescript: '^5.4.0',
  vite: '^5.2.0',
  eslint: '^8.57.0',
  prettier: '^3.2.0',
};

const BASE_ASTRO_CORE: Record<string, string> = {
  astro: '^4.5.0',
  '@astrojs/tailwind': '^5.1.0',
  '@astrojs/mdx': '^3.0.1',
};

const BASE_ASTRO_DEV: Record<string, string> = {
  typescript: '^5.4.0',
  eslint: '^8.57.0',
  prettier: '^3.2.0',
};

const BASE_EDGE_CORE: Record<string, string> = {
  hono: '^4.2.0',
  zod: '^3.23.0',
};

const BASE_EDGE_DEV: Record<string, string> = {
  wrangler: '^3.50.0',
  '@cloudflare/workers-types': '^4.20240419.0',
  typescript: '^5.4.0',
};

const BASE_PYTHON_BACKEND: Record<string, string> = {
  fastapi: '>=0.109.0',
  pydantic: '>=2.5.0',
  uvicorn: '>=0.27.0',
  sqlalchemy: '>=2.0.0',
  alembic: '>=1.13.0',
  'python-jose': '>=3.3.0',
  passlib: '>=1.7.4',
  'python-dotenv': '>=1.0.0',
};

const BASE_DJANGO_BACKEND: Record<string, string> = {
  django: '>=5.0.0',
  'django-htmx': '>=1.17.0',
  'django-environ': '>=0.11.0',
  psycopg: '>=3.1.0',
  whitenoise: '>=6.6.0',
};

const BASE_GO_BACKEND: Record<string, string> = {
  'github.com/gin-gonic/gin': 'v1.9.1',
  'gorm.io/gorm': 'v1.25.0',
  'github.com/pressly/goose/v3': 'v3.17.0',
};

const BASE_FLUTTER_DEPS: Record<string, string> = {
  firebase_core: '>=2.24.0',
  firebase_auth: '>=4.15.0',
  cloud_firestore: '>=4.13.0',
  firebase_storage: '>=11.6.0',
};

const COMMON_WEB_FEATURES: Record<string, FeaturePreset> = {
  payments: {
    deps: {
      stripe: '^13.0.0',
      '@stripe/stripe-js': '^3.0.0',
    },
    triggerKeywords: ['payment', 'subscription', 'billing', 'checkout'],
  },
  real_time: {
    deps: {
      'pusher-js': '^8.4.0',
    },
    triggerKeywords: ['real-time', 'realtime', 'live', 'websocket', 'notifications'],
  },
  file_upload: {
    deps: {
      '@aws-sdk/client-s3': '^3.550.0',
      '@aws-sdk/s3-request-presigner': '^3.550.0',
    },
    triggerKeywords: ['upload', 'file', 'media', 'images', 'storage'],
  },
  email: {
    deps: {
      resend: '^4.0.0',
      '@react-email/components': '^0.0.19',
    },
    triggerKeywords: ['email', 'newsletter', 'transactional'],
  },
  analytics: {
    deps: {
      '@vercel/analytics': '^1.2.0',
    },
    triggerKeywords: ['analytics', 'tracking', 'metrics'],
  },
};

export const DEPENDENCY_PRESETS: Record<string, TemplatePreset> = {
  nextjs_web_app: {
    core: BASE_NEXTJS_CORE,
    devDependencies: BASE_NEXTJS_DEV,
    features: COMMON_WEB_FEATURES,
  },
  nextjs_web_only: {
    core: BASE_NEXTJS_CORE,
    devDependencies: BASE_NEXTJS_DEV,
    features: COMMON_WEB_FEATURES,
  },
  nextjs_fullstack_expo: {
    core: {
      ...BASE_NEXTJS_CORE,
      ...BASE_EXPO_CORE,
      'expo-secure-store': '^12.8.0',
    },
    devDependencies: {
      ...BASE_NEXTJS_DEV,
      '@types/react-native': '^0.73.0',
    },
    features: COMMON_WEB_FEATURES,
  },
  hybrid_nextjs_fastapi: {
    core: BASE_NEXTJS_CORE,
    devDependencies: BASE_NEXTJS_DEV,
    pythonDeps: BASE_PYTHON_BACKEND,
    features: {
      ...COMMON_WEB_FEATURES,
      ml: {
        deps: {
          numpy: '>=1.26.0',
          pandas: '>=2.2.0',
          'scikit-learn': '>=1.4.0',
        },
        triggerKeywords: ['machine learning', 'ml', 'ai', 'prediction', 'model'],
        runtime: 'python',
      },
      async_tasks: {
        deps: {
          celery: '>=5.3.0',
          redis: '>=5.0.0',
        },
        triggerKeywords: ['background', 'async', 'queue', 'workers'],
        runtime: 'python',
      },
    },
  },
  react_express: {
    core: {
      ...BASE_REACT_CORE,
      ...BASE_EXPRESS_CORE,
    },
    devDependencies: {
      ...BASE_REACT_DEV,
      '@types/node': '^20.11.0',
      '@types/express': '^4.17.0',
      nodemon: '^3.0.0',
    },
    features: COMMON_WEB_FEATURES,
  },
  vue_nuxt: {
    core: BASE_NUXT_CORE,
    devDependencies: BASE_NUXT_DEV,
    features: COMMON_WEB_FEATURES,
  },
  svelte_kit: {
    core: BASE_SVELTE_CORE,
    devDependencies: BASE_SVELTE_DEV,
    features: COMMON_WEB_FEATURES,
  },
  astro_static: {
    core: BASE_ASTRO_CORE,
    devDependencies: BASE_ASTRO_DEV,
    features: COMMON_WEB_FEATURES,
  },
  serverless_edge: {
    core: BASE_EDGE_CORE,
    devDependencies: BASE_EDGE_DEV,
    features: COMMON_WEB_FEATURES,
  },
  django_htmx: {
    core: {},
    pythonDeps: BASE_DJANGO_BACKEND,
    features: {
      ...COMMON_WEB_FEATURES,
      async_tasks: {
        deps: {
          celery: '>=5.3.0',
          redis: '>=5.0.0',
        },
        triggerKeywords: ['background', 'async', 'queue', 'workers'],
        runtime: 'python',
      },
    },
  },
  go_react: {
    core: BASE_REACT_CORE,
    devDependencies: BASE_REACT_DEV,
    goDeps: BASE_GO_BACKEND,
    features: COMMON_WEB_FEATURES,
  },
  flutter_firebase: {
    core: {},
    flutterDeps: BASE_FLUTTER_DEPS,
    features: {},
  },
  react_native_supabase: {
    core: {
      ...BASE_EXPO_CORE,
      '@supabase/supabase-js': '^2.43.0',
      'react-native-url-polyfill': '^2.0.0',
      'expo-secure-store': '^12.8.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-native': '^0.73.0',
    },
    features: COMMON_WEB_FEATURES,
  },
};

const COMMANDS: Record<string, Record<string, string>> = {
  pnpm: {
    install: 'pnpm install',
    ci: 'pnpm install --frozen-lockfile',
    add: 'pnpm add <pkg>',
    addDev: 'pnpm add -D <pkg>',
  },
  npm: {
    install: 'npm install',
    ci: 'npm ci',
    add: 'npm install <pkg>',
    addDev: 'npm install -D <pkg>',
  },
  bun: {
    install: 'bun install',
    ci: 'bun install --frozen-lockfile',
    add: 'bun add <pkg>',
    addDev: 'bun add -d <pkg>',
  },
};

const BANNED_PACKAGES = ['request', 'left-pad'];

const LOCKFILES: Record<string, string> = {
  pnpm: 'pnpm-lock.yaml',
  npm: 'package-lock.json',
  bun: 'bun.lockb',
};

export function detectFeaturesFromPRD(
  prdContent: string,
  templateId: string
): string[] {
  const preset = DEPENDENCY_PRESETS[templateId];
  if (!preset) return [];

  const detectedFeatures: string[] = [];
  const lowerPRD = prdContent.toLowerCase();

  for (const [featureName, feature] of Object.entries(preset.features)) {
    if (feature.triggerKeywords.some((keyword) => lowerPRD.includes(keyword))) {
      detectedFeatures.push(featureName);
    }
  }

  return detectedFeatures;
}

export function getTemplatePreset(templateId: string): TemplatePreset {
  if (templateId === 'custom') {
    return DEPENDENCY_PRESETS.nextjs_web_app;
  }
  if (DEPENDENCY_PRESETS[templateId]) {
    return DEPENDENCY_PRESETS[templateId];
  }
  return DEPENDENCY_PRESETS.nextjs_web_app;
}

function toEntries(
  deps: Record<string, string> | undefined,
  category: string,
  reason: string
): DependencyEntry[] {
  if (!deps) return [];
  return Object.entries(deps).map(([name, range]) => ({
    name,
    range,
    reason,
    links: [],
    category,
  }));
}

function createAddon(
  capability: string,
  deps: Record<string, string> | undefined,
  reason: string,
  category: string
): { capability: string; packages: DependencyEntry[] } | null {
  const packages = toEntries(deps, category, reason);
  if (packages.length === 0) return null;
  return { capability, packages };
}

export function buildDependencyContract(options: {
  templateId: string;
  prdContent: string;
  packageManager?: string;
}): DependencyContract {
  const templateId = options.templateId;
  const preset = getTemplatePreset(templateId);
  const packageManager = options.packageManager || 'pnpm';
  const detectedFeatures = detectFeaturesFromPRD(options.prdContent, templateId);

  const baselineDependencies = toEntries(
    preset.core,
    'core',
    `Core dependency for ${templateId}`
  );
  const baselineDevDependencies = toEntries(
    preset.devDependencies,
    'dev',
    `Development dependency for ${templateId}`
  );

  const addons: Array<{ capability: string; packages: DependencyEntry[] }> = [];

  const pythonAddon = createAddon(
    'python_backend',
    preset.pythonDeps,
    `Python backend dependency for ${templateId}`,
    'python'
  );
  if (pythonAddon) addons.push(pythonAddon);

  const goAddon = createAddon(
    'go_backend',
    preset.goDeps,
    `Go backend dependency for ${templateId}`,
    'go'
  );
  if (goAddon) addons.push(goAddon);

  const flutterAddon = createAddon(
    'flutter_mobile',
    preset.flutterDeps,
    `Flutter mobile dependency for ${templateId}`,
    'flutter'
  );
  if (flutterAddon) addons.push(flutterAddon);

  for (const featureName of detectedFeatures) {
    const feature = preset.features[featureName];
    if (!feature) continue;
    const runtime = feature.runtime || 'node';
    const category = runtime === 'python' ? 'python' : 'feature';
    const addon = createAddon(
      `feature:${featureName}`,
      feature.deps,
      `Feature dependency for ${featureName}`,
      category
    );
    if (addon) addons.push(addon);
  }

  return {
    package_manager: packageManager,
    lockfile: LOCKFILES[packageManager] || LOCKFILES.pnpm,
    baseline: {
      dependencies: baselineDependencies,
      devDependencies: baselineDevDependencies,
    },
    addons,
    banned: BANNED_PACKAGES,
    commands: COMMANDS,
  };
}

export function formatDependencyPresetForPrompt(options: {
  templateId: string;
  contract: DependencyContract;
  detectedFeatures: string[];
}): string {
  const { templateId, contract, detectedFeatures } = options;
  const lines: string[] = [];

  lines.push(`Template: ${templateId}`);
  lines.push(`Package Manager: ${contract.package_manager}`);
  lines.push(`Detected Features: ${detectedFeatures.length ? detectedFeatures.join(', ') : 'None'}`);
  lines.push('');
  lines.push('Core Dependencies:');
  for (const dep of contract.baseline.dependencies) {
    lines.push(`- ${dep.name}@${dep.range}`);
  }
  if (contract.baseline.devDependencies.length > 0) {
    lines.push('');
    lines.push('Dev Dependencies:');
    for (const dep of contract.baseline.devDependencies) {
      lines.push(`- ${dep.name}@${dep.range}`);
    }
  }
  if (contract.addons.length > 0) {
    lines.push('');
    lines.push('Add-ons:');
    for (const addon of contract.addons) {
      lines.push(`- ${addon.capability}:`);
      for (const dep of addon.packages) {
        lines.push(`  - ${dep.name}@${dep.range}`);
      }
    }
  }

  return lines.join('\n');
}
