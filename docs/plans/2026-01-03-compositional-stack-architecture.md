# Compositional Stack Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace 13 monolithic stack templates with compositional architecture (base layers + addons) that integrates seamlessly with existing orchestrator system.

**Architecture:** Base layers (7 frontend frameworks) + composable addons (mobile, backend, data, architecture) with validation engine. Backward compatible migration layer maps old template IDs to compositions. AI recommendation logic updated to score and combine layers.

**Tech Stack:** TypeScript, Zod for validation, existing orchestrator_spec.yml, Drizzle ORM, React/Next.js

---

## Phase 1: Schema Design & Type System

### Task 1: Define Compositional Schema in YAML

**Files:**
- Modify: `orchestrator_spec.yml:537-765`
- Create: `backend/lib/composition_schema.test.ts`

**Step 1: Create compositional schema structure in orchestrator_spec.yml**

Insert after line 536 (before existing `stack_templates:`):

```yaml
# === COMPOSITIONAL STACK ARCHITECTURE ===
# New architecture: base layers + composable addons
# Replaces monolithic templates with mix-and-match components

composition_system:
  version: "2.0"
  mode: "compositional" # compositional | legacy | hybrid

  # Base Layers - Primary frontend/framework choice
  base_layers:
    nextjs_app_router:
      name: "Next.js App Router"
      type: "frontend_framework"
      description: "Next.js 14+ with App Router, Server Components, Server Actions"
      composition:
        frontend: "Next.js 14 (App Router)"
        backend: "Next.js API routes / Server Actions"
      compatible_with:
        mobile: ["expo_integration", "react_native_bare", "capacitor", "none"]
        backend: ["fastapi_api", "express_api", "go_api", "serverless_only", "integrated"]
        data: ["neon_postgres", "supabase_full", "firebase_full", "planetscale", "turso"]
        architecture: ["monolith", "edge", "microservices"]
      strengths: ["Server Components", "Fast refresh", "Type-safe", "SEO optimized"]
      tradeoffs: ["Learning curve for App Router", "More opinionated"]
      best_for: ["Full-stack web apps", "SEO-critical sites", "Real-time dashboards"]

    remix:
      name: "Remix"
      type: "frontend_framework"
      description: "Remix with nested routes, progressive enhancement, edge-ready"
      composition:
        frontend: "Remix (React Router v6)"
        backend: "Remix loaders/actions"
      compatible_with:
        mobile: ["react_native_bare", "capacitor", "none"]
        backend: ["fastapi_api", "express_api", "go_api", "serverless_only", "integrated"]
        data: ["neon_postgres", "supabase_full", "planetscale", "turso"]
        architecture: ["monolith", "edge", "microservices"]
      strengths: ["Progressive enhancement", "Nested routes", "Edge-first", "Web fundamentals"]
      tradeoffs: ["Smaller ecosystem than Next.js", "Newer framework"]
      best_for: ["Edge-first apps", "Progressive enhancement", "Form-heavy apps"]

    sveltekit:
      name: "SvelteKit"
      type: "frontend_framework"
      description: "SvelteKit with Svelte 5, smallest bundle, no virtual DOM"
      composition:
        frontend: "SvelteKit (Svelte 5)"
        backend: "SvelteKit endpoints"
      compatible_with:
        mobile: ["capacitor", "none"]
        backend: ["fastapi_api", "express_api", "go_api", "serverless_only", "integrated"]
        data: ["neon_postgres", "supabase_full", "planetscale", "turso"]
        architecture: ["monolith", "edge", "microservices"]
      strengths: ["Smallest bundle", "No virtual DOM", "Excellent performance", "Simple mental model"]
      tradeoffs: ["Smaller ecosystem", "Fewer libraries", "Less mature tooling"]
      best_for: ["Performance-critical apps", "Minimal bundle size", "Simple state management"]

    vue_nuxt:
      name: "Vue + Nuxt"
      type: "frontend_framework"
      description: "Nuxt 3 with Vue 3, auto-imports, hybrid rendering"
      composition:
        frontend: "Nuxt 3 (Vue 3)"
        backend: "Nuxt server routes / Nitro"
      compatible_with:
        mobile: ["capacitor", "none"]
        backend: ["fastapi_api", "express_api", "go_api", "serverless_only", "integrated"]
        data: ["neon_postgres", "supabase_full", "planetscale", "turso"]
        architecture: ["monolith", "edge", "microservices"]
      strengths: ["Excellent DX", "Auto-imports", "Hybrid rendering", "Vue ecosystem"]
      tradeoffs: ["Smaller ecosystem than React", "Less job market demand"]
      best_for: ["Vue teams", "Content-heavy sites", "Progressive enhancement"]

    astro:
      name: "Astro"
      type: "frontend_framework"
      description: "Astro with islands architecture, zero JS by default"
      composition:
        frontend: "Astro with React/Vue/Svelte islands"
        backend: "Serverless functions (optional)"
      compatible_with:
        mobile: ["none"]
        backend: ["serverless_only", "integrated"]
        data: ["neon_postgres", "supabase_full", "headless_cms", "none"]
        architecture: ["monolith", "edge"]
      strengths: ["Zero JS by default", "Fastest load times", "SEO optimized", "Multi-framework"]
      tradeoffs: ["Limited interactivity", "Rebuild for content", "Less suitable for SPAs"]
      best_for: ["Marketing sites", "Blogs", "Documentation", "Content sites"]

    react_spa:
      name: "React SPA"
      type: "frontend_framework"
      description: "React 18 SPA with Vite, client-side routing"
      composition:
        frontend: "React 18 + Vite"
        backend: "Separate API server"
      compatible_with:
        mobile: ["react_native_bare", "none"]
        backend: ["fastapi_api", "express_api", "go_api", "django_api"]
        data: ["neon_postgres", "supabase_full", "firebase_full", "mongodb"]
        architecture: ["monolith", "microservices"]
      strengths: ["Full control", "Flexible architecture", "Mature ecosystem", "Simple deployment"]
      tradeoffs: ["SEO challenges", "Manual optimizations", "Separate deployments"]
      best_for: ["Traditional SPAs", "Dashboard apps", "Internal tools"]

    django:
      name: "Django"
      type: "backend_framework"
      description: "Django with templates/HTMX or Django REST for API"
      composition:
        frontend: "Django templates + HTMX (or separate SPA)"
        backend: "Django"
      compatible_with:
        mobile: ["react_native_bare", "flutter", "none"]
        backend: ["integrated"]
        data: ["postgresql", "mongodb"]
        architecture: ["monolith", "microservices"]
      strengths: ["Batteries included", "Excellent admin", "Mature ecosystem", "Python power"]
      tradeoffs: ["Less interactive UIs by default", "Monolithic by default"]
      best_for: ["Python teams", "Admin-heavy apps", "Rapid prototyping"]

  # Mobile Addons - Optional mobile platform integration
  mobile_addons:
    expo_integration:
      name: "Expo (React Native)"
      type: "mobile_platform"
      description: "Expo with React Native for iOS + Android from single codebase"
      composition:
        mobile: "Expo with React Native"
      requires_base: ["nextjs_app_router", "remix", "react_spa"]
      strengths: ["Single codebase", "Fast iteration", "OTA updates", "Managed workflow"]
      tradeoffs: ["Bundle size", "Some native modules require ejecting"]
      best_for: ["MVPs", "Fast prototyping", "Teams without native mobile expertise"]

    react_native_bare:
      name: "React Native (Bare)"
      type: "mobile_platform"
      description: "Bare React Native for full native control"
      composition:
        mobile: "React Native (bare workflow)"
      requires_base: ["nextjs_app_router", "remix", "react_spa", "django"]
      strengths: ["Full native control", "All native modules", "Better performance"]
      tradeoffs: ["More setup", "Native dev knowledge required", "Slower iteration"]
      best_for: ["Production apps", "Complex native integrations", "Performance-critical"]

    flutter:
      name: "Flutter"
      type: "mobile_platform"
      description: "Flutter for iOS + Android with Dart"
      composition:
        mobile: "Flutter (iOS + Android)"
      requires_base: ["django", "react_spa"]
      strengths: ["Single codebase", "Native performance", "Beautiful UI", "Hot reload"]
      tradeoffs: ["Dart language", "Larger bundle", "Different ecosystem"]
      best_for: ["Mobile-first apps", "Pixel-perfect UIs", "Cross-platform consistency"]

    capacitor:
      name: "Capacitor"
      type: "mobile_platform"
      description: "Capacitor to wrap web app as native mobile app"
      composition:
        mobile: "Capacitor (iOS + Android from web)"
      requires_base: ["nextjs_app_router", "remix", "sveltekit", "vue_nuxt", "react_spa"]
      strengths: ["Reuse web code", "Quick mobile version", "Web-first approach"]
      tradeoffs: ["WebView performance", "Not fully native feel"]
      best_for: ["Web apps needing mobile presence", "Content-heavy apps", "PWA extensions"]

    none:
      name: "No Mobile"
      type: "mobile_platform"
      description: "Web-only, no native mobile app"
      composition:
        mobile: "None (responsive web design)"
      requires_base: ["nextjs_app_router", "remix", "sveltekit", "vue_nuxt", "astro", "react_spa", "django"]
      strengths: ["Simplest setup", "Single deployment", "Lower maintenance"]
      tradeoffs: ["No native mobile experience", "Limited offline capabilities"]
      best_for: ["Web-first products", "Admin dashboards", "Internal tools"]

  # Backend Addons - Separate backend services (when not using integrated)
  backend_addons:
    fastapi_api:
      name: "FastAPI (Python)"
      type: "backend_service"
      description: "FastAPI for high-performance Python API with async support"
      composition:
        backend: "FastAPI (Python)"
      requires_base: ["nextjs_app_router", "remix", "sveltekit", "vue_nuxt", "react_spa"]
      incompatible_with: ["integrated"]
      strengths: ["Python ecosystem", "Async/await", "ML/AI libraries", "Auto-generated docs"]
      tradeoffs: ["Separate deployment", "Two languages", "More operational complexity"]
      best_for: ["ML/AI workloads", "Data pipelines", "Python teams", "Complex backend logic"]
      deployment: "Railway, Render, or AWS"

    express_api:
      name: "Express.js API"
      type: "backend_service"
      description: "Express.js for flexible Node.js API server"
      composition:
        backend: "Express.js or Fastify"
      requires_base: ["react_spa", "vue_nuxt", "sveltekit"]
      incompatible_with: ["integrated"]
      strengths: ["Full control", "Flexible architecture", "Mature ecosystem", "Same language"]
      tradeoffs: ["Manual setup", "Less opinionated", "More boilerplate"]
      best_for: ["Custom server needs", "WebSocket apps", "Traditional SPAs"]
      deployment: "Any (Vercel, Railway, AWS, etc.)"

    go_api:
      name: "Go Backend"
      type: "backend_service"
      description: "Go backend with Gin/Echo/Chi for high performance"
      composition:
        backend: "Go (Gin, Echo, or Chi)"
      requires_base: ["react_spa", "vue_nuxt", "sveltekit", "nextjs_app_router"]
      incompatible_with: ["integrated"]
      strengths: ["Fastest performance", "Low memory", "Great concurrency", "Type safety"]
      tradeoffs: ["Two languages", "More verbose", "Smaller web ecosystem"]
      best_for: ["High-throughput APIs", "Microservices", "Performance-critical systems"]
      deployment: "Docker on any cloud"

    django_api:
      name: "Django REST Framework"
      type: "backend_service"
      description: "Django REST Framework for Python API"
      composition:
        backend: "Django REST Framework"
      requires_base: ["react_spa", "vue_nuxt", "flutter"]
      incompatible_with: ["integrated", "django"]
      strengths: ["Batteries included", "Excellent admin", "ORM", "Authentication built-in"]
      tradeoffs: ["Monolithic by default", "Python overhead"]
      best_for: ["Admin-heavy APIs", "CRUD operations", "Python teams"]
      deployment: "Railway, Render, AWS"

    serverless_only:
      name: "Serverless Functions"
      type: "backend_service"
      description: "Serverless functions only (Vercel/Cloudflare Workers/AWS Lambda)"
      composition:
        backend: "Serverless functions"
      requires_base: ["nextjs_app_router", "remix", "astro", "react_spa"]
      incompatible_with: ["integrated"]
      strengths: ["Auto-scaling", "Pay-per-use", "Zero ops", "Global edge"]
      tradeoffs: ["Cold starts", "Stateless", "Vendor lock-in"]
      best_for: ["APIs", "Webhooks", "Event handlers", "Cost optimization"]
      deployment: "Vercel, Cloudflare, AWS Lambda"

    integrated:
      name: "Integrated Backend"
      type: "backend_service"
      description: "Use framework's built-in backend (Next.js API routes, Remix loaders, etc.)"
      composition:
        backend: "Integrated with frontend framework"
      requires_base: ["nextjs_app_router", "remix", "sveltekit", "vue_nuxt", "django"]
      incompatible_with: ["fastapi_api", "express_api", "go_api", "django_api", "serverless_only"]
      strengths: ["Single deployment", "Same language", "Type-safe", "Simple ops"]
      tradeoffs: ["Less separation of concerns", "Framework lock-in"]
      best_for: ["Full-stack frameworks", "Monolith architecture", "Fast iteration"]
      deployment: "Vercel, Netlify, Cloudflare"

  # Data Addons - Database and storage solutions
  data_addons:
    neon_postgres:
      name: "Neon Postgres + Drizzle"
      type: "database"
      description: "Neon serverless Postgres with Drizzle ORM and Cloudflare R2 storage"
      composition:
        database: "Neon Postgres + Drizzle ORM"
        storage: "Cloudflare R2 (S3-compatible)"
        auth: "Better Auth"
      compatible_with_all: true
      strengths: ["Serverless Postgres", "Type-safe ORM", "Cheap R2 storage", "Modern auth"]
      tradeoffs: ["Vendor dependency", "Edge regions limited"]
      best_for: ["Web apps", "Serverless architectures", "Cost-conscious projects"]

    supabase_full:
      name: "Supabase"
      type: "database"
      description: "Supabase with Postgres, Auth, Storage, Real-time"
      composition:
        database: "PostgreSQL (via Supabase)"
        auth: "Supabase Auth"
        storage: "Supabase Storage"
      compatible_with_all: true
      strengths: ["All-in-one backend", "Real-time subscriptions", "Self-hostable", "Row-level security"]
      tradeoffs: ["Vendor dependency", "Less mature than Firebase"]
      best_for: ["Rapid prototyping", "Real-time features", "Open-source preference"]

    firebase_full:
      name: "Firebase"
      type: "database"
      description: "Firebase with Firestore, Auth, Storage, Functions"
      composition:
        database: "Firestore (NoSQL)"
        auth: "Firebase Auth"
        storage: "Firebase Storage"
      compatible_with_all: true
      strengths: ["Real-time sync", "Offline-first", "Mobile SDKs", "Mature ecosystem"]
      tradeoffs: ["NoSQL limitations", "Vendor lock-in", "Cost at scale"]
      best_for: ["Mobile apps", "Real-time collaboration", "Rapid prototyping"]

    planetscale:
      name: "PlanetScale + Prisma"
      type: "database"
      description: "PlanetScale MySQL with Prisma ORM"
      composition:
        database: "PlanetScale MySQL + Prisma ORM"
      compatible_with_all: true
      strengths: ["Branching workflow", "Horizontal scaling", "Connection pooling"]
      tradeoffs: ["MySQL not Postgres", "Prisma overhead"]
      best_for: ["High-scale apps", "Teams wanting branching", "MySQL preference"]

    turso:
      name: "Turso + Drizzle"
      type: "database"
      description: "Turso SQLite at the edge with Drizzle ORM"
      composition:
        database: "Turso (SQLite) + Drizzle ORM"
      compatible_with: ["nextjs_app_router", "remix", "astro"]
      strengths: ["Sub-50ms latency", "SQLite power", "Edge-first", "Low cost"]
      tradeoffs: ["SQLite limitations", "Not for huge datasets"]
      best_for: ["Edge apps", "Global low latency", "Read-heavy workloads"]

    mongodb:
      name: "MongoDB"
      type: "database"
      description: "MongoDB with Mongoose ODM"
      composition:
        database: "MongoDB with Mongoose"
      compatible_with: ["react_spa", "django"]
      strengths: ["Flexible schema", "Document model", "Mature ecosystem"]
      tradeoffs: ["NoSQL limitations", "No ACID by default"]
      best_for: ["Flexible schemas", "Document-heavy data", "Rapid prototyping"]

    postgresql:
      name: "PostgreSQL"
      type: "database"
      description: "Self-hosted or managed PostgreSQL"
      composition:
        database: "PostgreSQL"
      compatible_with: ["django", "react_spa"]
      strengths: ["Most powerful SQL", "Self-hostable", "ACID compliant", "Extensions"]
      tradeoffs: ["Self-hosting complexity", "Manual scaling"]
      best_for: ["Enterprise apps", "Self-hosting", "Complex queries"]

    headless_cms:
      name: "Headless CMS"
      type: "database"
      description: "Headless CMS (Sanity, Contentful, Strapi)"
      composition:
        database: "Headless CMS (Sanity, Contentful, Strapi)"
      compatible_with: ["astro", "nextjs_app_router", "remix"]
      strengths: ["Content management", "Content preview", "Multi-channel"]
      tradeoffs: ["Not for transactional data", "CMS vendor lock-in"]
      best_for: ["Content sites", "Marketing sites", "Blogs"]

    none:
      name: "No Database"
      type: "database"
      description: "No database (static site or external API only)"
      composition:
        database: "None"
      compatible_with: ["astro"]
      strengths: ["Simplest setup", "Zero database costs", "Fast deployment"]
      tradeoffs: ["No dynamic data", "Limited functionality"]
      best_for: ["Static sites", "Landing pages", "Documentation"]

  # Architecture Addons - Deployment architecture patterns
  architecture_addons:
    monolith:
      name: "Monolith"
      type: "architecture"
      description: "Single deployment, all code together"
      compatible_with_all: true
      strengths: ["Simplest deployment", "Easy local dev", "Single codebase"]
      tradeoffs: ["Harder to scale teams", "All or nothing deployment"]
      best_for: ["Small teams", "MVPs", "Most projects"]

    edge:
      name: "Edge Computing"
      type: "architecture"
      description: "Edge-first deployment for global low latency"
      compatible_with: ["nextjs_app_router", "remix", "astro", "sveltekit"]
      requires_data: ["turso", "planetscale", "supabase_full"]
      strengths: ["Sub-50ms latency globally", "Auto-scaling", "Pay-per-use"]
      tradeoffs: ["Edge runtime limitations", "Cold starts", "Vendor lock-in"]
      best_for: ["Global apps", "Low latency requirements", "Static + dynamic hybrid"]

    microservices:
      name: "Microservices"
      type: "architecture"
      description: "Multiple independent services, separate deployments"
      compatible_with: ["react_spa", "django"]
      requires_backend: ["fastapi_api", "express_api", "go_api", "django_api"]
      strengths: ["Independent scaling", "Team autonomy", "Technology flexibility"]
      tradeoffs: ["Operational complexity", "Network overhead", "Distributed debugging"]
      best_for: ["Large teams", "High scale", "Different service requirements"]

# Legacy template mapping for backward compatibility
# Maps old template IDs to new compositional definitions
legacy_template_migration:
  nextjs_fullstack_expo:
    composition:
      base: "nextjs_app_router"
      mobile: "expo_integration"
      backend: "integrated"
      data: "neon_postgres"
      architecture: "monolith"
    reason: "Full-stack Next.js + Expo mobile + Neon Postgres"

  hybrid_nextjs_fastapi:
    composition:
      base: "nextjs_app_router"
      mobile: "expo_integration"
      backend: "fastapi_api"
      data: "postgresql"
      architecture: "microservices"
    reason: "Next.js + Python backend for ML/AI workloads"

  nextjs_web_app:
    composition:
      base: "nextjs_app_router"
      mobile: "none"
      backend: "integrated"
      data: "neon_postgres"
      architecture: "monolith"
    reason: "Web-only Next.js with Neon Postgres"

  nextjs_web_only:
    composition:
      base: "nextjs_app_router"
      mobile: "none"
      backend: "integrated"
      data: "neon_postgres"
      architecture: "monolith"
    reason: "Legacy alias for nextjs_web_app"

  react_express:
    composition:
      base: "react_spa"
      mobile: "none"
      backend: "express_api"
      data: "postgresql"
      architecture: "monolith"
    reason: "Traditional SPA with Express backend"

  vue_nuxt:
    composition:
      base: "vue_nuxt"
      mobile: "none"
      backend: "integrated"
      data: "neon_postgres"
      architecture: "monolith"
    reason: "Nuxt 3 full-stack"

  svelte_kit:
    composition:
      base: "sveltekit"
      mobile: "none"
      backend: "integrated"
      data: "neon_postgres"
      architecture: "monolith"
    reason: "SvelteKit full-stack"

  astro_static:
    composition:
      base: "astro"
      mobile: "none"
      backend: "serverless_only"
      data: "headless_cms"
      architecture: "monolith"
    reason: "Static site with optional CMS"

  serverless_edge:
    composition:
      base: "nextjs_app_router"
      mobile: "none"
      backend: "serverless_only"
      data: "turso"
      architecture: "edge"
    reason: "Edge-first serverless stack"

  django_htmx:
    composition:
      base: "django"
      mobile: "none"
      backend: "integrated"
      data: "postgresql"
      architecture: "monolith"
    reason: "Django with HTMX for hypermedia approach"

  go_react:
    composition:
      base: "react_spa"
      mobile: "none"
      backend: "go_api"
      data: "postgresql"
      architecture: "microservices"
    reason: "High-performance Go backend with React"

  flutter_firebase:
    composition:
      base: "react_spa"
      mobile: "flutter"
      backend: "integrated"
      data: "firebase_full"
      architecture: "monolith"
    reason: "Flutter mobile with Firebase backend"

  react_native_supabase:
    composition:
      base: "nextjs_app_router"
      mobile: "react_native_bare"
      backend: "integrated"
      data: "supabase_full"
      architecture: "monolith"
    reason: "React Native mobile with Supabase"
```

**Step 2: Keep old stack_templates for backward compatibility**

Leave existing `stack_templates:` section unchanged (lines 537-765). Add comment above it:

```yaml
# === LEGACY MONOLITHIC TEMPLATES (Backward Compatibility) ===
# These are kept for backward compatibility but will be deprecated
# New projects should use composition_system above
stack_templates:
  # ... existing templates remain unchanged ...
```

**Step 3: Run linter to verify YAML validity**

Run: `npx js-yaml orchestrator_spec.yml`
Expected: Valid YAML, no parse errors

**Step 4: Commit schema changes**

```bash
git add orchestrator_spec.yml
git commit -m "feat: add compositional stack architecture schema to orchestrator spec"
```

---

### Task 2: Create TypeScript Types for Compositional System

**Files:**
- Create: `src/types/composition.ts`
- Modify: `src/types/orchestrator.ts:54-78`

**Step 1: Write failing test for composition types**

Create: `src/types/composition.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  BaseLayer,
  MobileAddon,
  BackendAddon,
  DataAddon,
  ArchitectureAddon,
  StackComposition,
  CompositionValidation,
  validateComposition
} from './composition';

describe('Composition Types', () => {
  it('should define BaseLayer type', () => {
    const base: BaseLayer = {
      id: 'nextjs_app_router',
      name: 'Next.js App Router',
      type: 'frontend_framework',
      description: 'Next.js 14+',
      composition: {
        frontend: 'Next.js 14',
        backend: 'Next.js API routes'
      },
      compatible_with: {
        mobile: ['expo_integration', 'none'],
        backend: ['integrated', 'fastapi_api'],
        data: ['neon_postgres'],
        architecture: ['monolith', 'edge']
      },
      strengths: ['Server Components'],
      tradeoffs: ['Learning curve'],
      best_for: ['Full-stack web apps']
    };
    expect(base.id).toBe('nextjs_app_router');
  });

  it('should validate compatible compositions', () => {
    const composition: StackComposition = {
      base: 'nextjs_app_router',
      mobile: 'expo_integration',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const result = validateComposition(composition, mockCompositionSystem);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject incompatible compositions', () => {
    const composition: StackComposition = {
      base: 'astro',
      mobile: 'expo_integration', // Astro doesn't support Expo
      backend: 'integrated',
      data: 'none',
      architecture: 'monolith'
    };

    const result = validateComposition(composition, mockCompositionSystem);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('mobile addon "expo_integration" incompatible with base "astro"');
  });
});

const mockCompositionSystem = {
  version: '2.0',
  mode: 'compositional',
  base_layers: {
    nextjs_app_router: {
      id: 'nextjs_app_router',
      compatible_with: {
        mobile: ['expo_integration', 'none'],
        backend: ['integrated'],
        data: ['neon_postgres'],
        architecture: ['monolith', 'edge']
      }
    },
    astro: {
      id: 'astro',
      compatible_with: {
        mobile: ['none'],
        backend: ['serverless_only'],
        data: ['headless_cms', 'none'],
        architecture: ['monolith', 'edge']
      }
    }
  }
};
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- composition.test.ts`
Expected: FAIL with "Module './composition' not found"

**Step 3: Create composition types**

Create: `src/types/composition.ts`

```typescript
// Compositional Stack Architecture Types

export type LayerType =
  | 'frontend_framework'
  | 'mobile_platform'
  | 'backend_service'
  | 'database'
  | 'architecture';

export interface BaseLayer {
  id: string;
  name: string;
  type: 'frontend_framework' | 'backend_framework';
  description: string;
  composition: {
    frontend?: string;
    backend: string;
  };
  compatible_with: {
    mobile: string[];
    backend: string[];
    data: string[];
    architecture: string[];
  };
  strengths: string[];
  tradeoffs: string[];
  best_for: string[];
}

export interface MobileAddon {
  id: string;
  name: string;
  type: 'mobile_platform';
  description: string;
  composition: {
    mobile: string;
  };
  requires_base: string[];
  strengths: string[];
  tradeoffs: string[];
  best_for: string[];
}

export interface BackendAddon {
  id: string;
  name: string;
  type: 'backend_service';
  description: string;
  composition: {
    backend: string;
  };
  requires_base?: string[];
  incompatible_with?: string[];
  strengths: string[];
  tradeoffs: string[];
  best_for: string[];
  deployment?: string;
}

export interface DataAddon {
  id: string;
  name: string;
  type: 'database';
  description: string;
  composition: {
    database: string;
    auth?: string;
    storage?: string;
  };
  compatible_with_all?: boolean;
  compatible_with?: string[];
  strengths: string[];
  tradeoffs: string[];
  best_for: string[];
}

export interface ArchitectureAddon {
  id: string;
  name: string;
  type: 'architecture';
  description: string;
  compatible_with_all?: boolean;
  compatible_with?: string[];
  requires_data?: string[];
  requires_backend?: string[];
  strengths: string[];
  tradeoffs: string[];
  best_for: string[];
}

export interface StackComposition {
  base: string;
  mobile: string;
  backend: string;
  data: string;
  architecture: string;
}

export interface CompositionValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  composition?: StackComposition;
  resolved_stack?: ResolvedStack;
}

export interface ResolvedStack {
  id: string;
  name: string;
  description: string;
  composition: {
    frontend?: string;
    mobile?: string;
    backend: string;
    database: string;
    deployment?: string;
    auth?: string;
    storage?: string;
  };
  layers: {
    base: BaseLayer;
    mobile: MobileAddon | null;
    backend: BackendAddon | null;
    data: DataAddon;
    architecture: ArchitectureAddon;
  };
  strengths: string[];
  tradeoffs: string[];
  best_for: string[];
  scaling: string;
}

export interface CompositionSystem {
  version: string;
  mode: 'compositional' | 'legacy' | 'hybrid';
  base_layers: Record<string, Omit<BaseLayer, 'id'>>;
  mobile_addons: Record<string, Omit<MobileAddon, 'id'>>;
  backend_addons: Record<string, Omit<BackendAddon, 'id'>>;
  data_addons: Record<string, Omit<DataAddon, 'id'>>;
  architecture_addons: Record<string, Omit<ArchitectureAddon, 'id'>>;
}

export interface LegacyTemplateMapping {
  composition: StackComposition;
  reason: string;
}

/**
 * Validate a stack composition for compatibility
 */
export function validateComposition(
  composition: StackComposition,
  system: Partial<CompositionSystem>
): CompositionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate base exists
  const base = system.base_layers?.[composition.base];
  if (!base) {
    errors.push(`Base layer "${composition.base}" not found`);
    return { valid: false, errors, warnings };
  }

  // Validate mobile compatibility
  if (composition.mobile !== 'none') {
    const mobile = system.mobile_addons?.[composition.mobile];
    if (!mobile) {
      errors.push(`Mobile addon "${composition.mobile}" not found`);
    } else {
      // Check if mobile requires this base
      if (mobile.requires_base && !mobile.requires_base.includes(composition.base)) {
        errors.push(
          `Mobile addon "${composition.mobile}" requires base layers: ${mobile.requires_base.join(', ')} (got "${composition.base}")`
        );
      }

      // Check if base supports this mobile
      if (base.compatible_with?.mobile && !base.compatible_with.mobile.includes(composition.mobile)) {
        errors.push(
          `Base layer "${composition.base}" doesn't support mobile addon "${composition.mobile}"`
        );
      }
    }
  }

  // Validate backend compatibility
  const backend = system.backend_addons?.[composition.backend];
  if (!backend) {
    errors.push(`Backend addon "${composition.backend}" not found`);
  } else {
    // Check backend requirements
    if (backend.requires_base && !backend.requires_base.includes(composition.base)) {
      errors.push(
        `Backend addon "${composition.backend}" requires base layers: ${backend.requires_base.join(', ')} (got "${composition.base}")`
      );
    }

    // Check base supports this backend
    if (base.compatible_with?.backend && !base.compatible_with.backend.includes(composition.backend)) {
      errors.push(
        `Base layer "${composition.base}" doesn't support backend addon "${composition.backend}"`
      );
    }
  }

  // Validate data compatibility
  const data = system.data_addons?.[composition.data];
  if (!data) {
    errors.push(`Data addon "${composition.data}" not found`);
  } else {
    // If not compatible_with_all, check compatibility list
    if (!data.compatible_with_all && data.compatible_with) {
      if (!data.compatible_with.includes(composition.base)) {
        errors.push(
          `Data addon "${composition.data}" incompatible with base "${composition.base}"`
        );
      }
    }
  }

  // Validate architecture compatibility
  const arch = system.architecture_addons?.[composition.architecture];
  if (!arch) {
    errors.push(`Architecture addon "${composition.architecture}" not found`);
  } else {
    // Check architecture requirements
    if (!arch.compatible_with_all && arch.compatible_with) {
      if (!arch.compatible_with.includes(composition.base)) {
        errors.push(
          `Architecture "${composition.architecture}" incompatible with base "${composition.base}"`
        );
      }
    }

    // Check if architecture requires specific data
    if (arch.requires_data && !arch.requires_data.includes(composition.data)) {
      warnings.push(
        `Architecture "${composition.architecture}" works best with data: ${arch.requires_data.join(', ')} (got "${composition.data}")`
      );
    }

    // Check if architecture requires specific backend
    if (arch.requires_backend && !arch.requires_backend.includes(composition.backend)) {
      warnings.push(
        `Architecture "${composition.architecture}" requires backend: ${arch.requires_backend.join(', ')} (got "${composition.backend}")`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    composition
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- composition.test.ts`
Expected: PASS

**Step 5: Update orchestrator types to include composition system**

Modify: `src/types/orchestrator.ts`

Add after line 102:

```typescript
import { CompositionSystem, LegacyTemplateMapping } from './composition';

export interface OrchestratorSpec {
  phases: Record<string, Phase>;
  stacks: Record<string, Stack>;
  composition_system?: CompositionSystem;
  legacy_template_migration?: Record<string, LegacyTemplateMapping>;
  agents: Record<string, Agent>;
  validators: Record<string, Validator>;
  security_baseline: Record<string, unknown>;
  file_structure: Record<string, unknown>;
  llm_config: Record<string, unknown>;
  project_defaults: Record<string, unknown>;
}
```

**Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 7: Commit types**

```bash
git add src/types/composition.ts src/types/composition.test.ts src/types/orchestrator.ts
git commit -m "feat: add TypeScript types for compositional stack system"
```

---

## Phase 2: Composition Engine

### Task 3: Build Composition Resolver Service

**Files:**
- Create: `backend/services/composition/composition_resolver.ts`
- Create: `backend/services/composition/composition_resolver.test.ts`

**Step 1: Write failing test for composition resolver**

Create: `backend/services/composition/composition_resolver.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { CompositionResolver } from './composition_resolver';
import { StackComposition, CompositionSystem } from '@/types/composition';

describe('CompositionResolver', () => {
  const mockSystem: CompositionSystem = {
    version: '2.0',
    mode: 'compositional',
    base_layers: {
      nextjs_app_router: {
        name: 'Next.js App Router',
        type: 'frontend_framework',
        description: 'Next.js 14+',
        composition: {
          frontend: 'Next.js 14',
          backend: 'Next.js API routes'
        },
        compatible_with: {
          mobile: ['expo_integration', 'none'],
          backend: ['integrated', 'fastapi_api'],
          data: ['neon_postgres', 'supabase_full'],
          architecture: ['monolith', 'edge']
        },
        strengths: ['Server Components'],
        tradeoffs: ['Learning curve'],
        best_for: ['Full-stack web apps']
      }
    },
    mobile_addons: {
      expo_integration: {
        name: 'Expo',
        type: 'mobile_platform',
        description: 'Expo with React Native',
        composition: { mobile: 'Expo' },
        requires_base: ['nextjs_app_router'],
        strengths: ['Single codebase'],
        tradeoffs: ['Bundle size'],
        best_for: ['MVPs']
      },
      none: {
        name: 'No Mobile',
        type: 'mobile_platform',
        description: 'Web-only',
        composition: { mobile: 'None' },
        requires_base: ['nextjs_app_router'],
        strengths: ['Simplest'],
        tradeoffs: ['No native'],
        best_for: ['Web apps']
      }
    },
    backend_addons: {
      integrated: {
        name: 'Integrated',
        type: 'backend_service',
        description: 'Framework backend',
        composition: { backend: 'Integrated' },
        strengths: ['Simple'],
        tradeoffs: ['Framework lock-in'],
        best_for: ['Monoliths']
      }
    },
    data_addons: {
      neon_postgres: {
        name: 'Neon Postgres',
        type: 'database',
        description: 'Serverless Postgres',
        composition: { database: 'Neon Postgres', auth: 'Better Auth', storage: 'R2' },
        compatible_with_all: true,
        strengths: ['Serverless'],
        tradeoffs: ['Vendor dependency'],
        best_for: ['Web apps']
      }
    },
    architecture_addons: {
      monolith: {
        name: 'Monolith',
        type: 'architecture',
        description: 'Single deployment',
        compatible_with_all: true,
        strengths: ['Simple'],
        tradeoffs: ['Harder to scale'],
        best_for: ['MVPs']
      }
    }
  };

  it('should resolve valid composition to full stack', () => {
    const resolver = new CompositionResolver(mockSystem);
    const composition: StackComposition = {
      base: 'nextjs_app_router',
      mobile: 'none',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const result = resolver.resolve(composition);

    expect(result.valid).toBe(true);
    expect(result.resolved_stack).toBeDefined();
    expect(result.resolved_stack?.name).toBe('Next.js App Router + Neon Postgres');
    expect(result.resolved_stack?.composition.frontend).toBe('Next.js 14');
    expect(result.resolved_stack?.composition.backend).toBe('Next.js API routes');
    expect(result.resolved_stack?.composition.database).toBe('Neon Postgres');
  });

  it('should reject invalid compositions', () => {
    const resolver = new CompositionResolver(mockSystem);
    const composition: StackComposition = {
      base: 'invalid_base',
      mobile: 'none',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const result = resolver.resolve(composition);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Base layer "invalid_base" not found');
  });

  it('should generate composition ID', () => {
    const resolver = new CompositionResolver(mockSystem);
    const composition: StackComposition = {
      base: 'nextjs_app_router',
      mobile: 'expo_integration',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const id = resolver.generateCompositionId(composition);
    expect(id).toBe('nextjs_app_router+expo_integration+integrated+neon_postgres+monolith');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- composition_resolver.test.ts`
Expected: FAIL with "Module './composition_resolver' not found"

**Step 3: Implement CompositionResolver**

Create: `backend/services/composition/composition_resolver.ts`

```typescript
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

    // Merge compositions
    const mergedComposition: ResolvedStack['composition'] = {
      ...layers.base.composition,
      ...(layers.mobile?.composition || {}),
      ...(layers.backend?.composition || {}),
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
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- composition_resolver.test.ts`
Expected: PASS

**Step 5: Commit composition resolver**

```bash
git add backend/services/composition/
git commit -m "feat: implement composition resolver service with validation"
```

---

### Task 4: Build Legacy Template Migrator

**Files:**
- Create: `backend/services/composition/legacy_migrator.ts`
- Create: `backend/services/composition/legacy_migrator.test.ts`

**Step 1: Write failing test for legacy migrator**

Create: `backend/services/composition/legacy_migrator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { LegacyMigrator } from './legacy_migrator';
import { CompositionSystem, LegacyTemplateMapping } from '@/types/composition';

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

  const mockSystem: Partial<CompositionSystem> = {
    base_layers: {
      nextjs_app_router: {
        name: 'Next.js',
        type: 'frontend_framework',
        description: 'Next.js 14+',
        composition: { backend: 'Next.js API' },
        compatible_with: {
          mobile: ['expo_integration', 'none'],
          backend: ['integrated'],
          data: ['neon_postgres'],
          architecture: ['monolith']
        },
        strengths: [],
        tradeoffs: [],
        best_for: []
      }
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
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- legacy_migrator.test.ts`
Expected: FAIL with "Module './legacy_migrator' not found"

**Step 3: Implement LegacyMigrator**

Create: `backend/services/composition/legacy_migrator.ts`

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- legacy_migrator.test.ts`
Expected: PASS

**Step 5: Commit legacy migrator**

```bash
git add backend/services/composition/legacy_migrator.ts backend/services/composition/legacy_migrator.test.ts
git commit -m "feat: implement legacy template migration service"
```

---

## Phase 3: Backend Integration

### Task 5: Update ConfigLoader to Load Composition System

**Files:**
- Modify: `backend/services/orchestrator/config_loader.ts:18-53`
- Create: `backend/services/orchestrator/config_loader_composition.test.ts`

**Step 1: Write failing test for composition loading**

Create: `backend/services/orchestrator/config_loader_composition.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ConfigLoader } from './config_loader';

describe('ConfigLoader - Composition System', () => {
  it('should load composition_system from spec', () => {
    const loader = new ConfigLoader();
    const spec = loader.loadSpec();

    expect(spec.composition_system).toBeDefined();
    expect(spec.composition_system?.version).toBe('2.0');
    expect(spec.composition_system?.mode).toBe('compositional');
    expect(spec.composition_system?.base_layers).toBeDefined();
    expect(Object.keys(spec.composition_system?.base_layers || {}).length).toBeGreaterThan(0);
  });

  it('should load legacy_template_migration from spec', () => {
    const loader = new ConfigLoader();
    const spec = loader.loadSpec();

    expect(spec.legacy_template_migration).toBeDefined();
    expect(spec.legacy_template_migration?.nextjs_fullstack_expo).toBeDefined();
    expect(spec.legacy_template_migration?.nextjs_fullstack_expo.composition.base).toBe('nextjs_app_router');
  });

  it('should provide getCompositionSystem helper', () => {
    const loader = new ConfigLoader();
    const compositionSystem = loader.getCompositionSystem();

    expect(compositionSystem).toBeDefined();
    expect(compositionSystem.version).toBe('2.0');
    expect(compositionSystem.base_layers).toBeDefined();
  });

  it('should provide getLegacyMappings helper', () => {
    const loader = new ConfigLoader();
    const mappings = loader.getLegacyMappings();

    expect(mappings).toBeDefined();
    expect(Object.keys(mappings).length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- config_loader_composition.test.ts`
Expected: FAIL with "Property 'getCompositionSystem' does not exist"

**Step 3: Update ConfigLoader to add composition helpers**

Modify: `backend/services/orchestrator/config_loader.ts`

Add after line 488:

```typescript
  /**
   * Get composition system configuration
   */
  getCompositionSystem(): CompositionSystem {
    const spec = this.loadSpec();

    if (!spec.composition_system) {
      logger.warn('[ConfigLoader] No composition_system in spec, using empty default');
      return {
        version: '2.0',
        mode: 'legacy',
        base_layers: {},
        mobile_addons: {},
        backend_addons: {},
        data_addons: {},
        architecture_addons: {},
      };
    }

    return spec.composition_system;
  }

  /**
   * Get legacy template migration mappings
   */
  getLegacyMappings(): Record<string, LegacyTemplateMapping> {
    const spec = this.loadSpec();
    return spec.legacy_template_migration || {};
  }

  /**
   * Check if composition mode is enabled
   */
  isCompositionMode(): boolean {
    const system = this.getCompositionSystem();
    return system.mode === 'compositional' || system.mode === 'hybrid';
  }

  /**
   * Check if legacy mode is enabled
   */
  isLegacyMode(): boolean {
    const system = this.getCompositionSystem();
    return system.mode === 'legacy' || system.mode === 'hybrid';
  }
```

Add import at top of file:

```typescript
import { CompositionSystem, LegacyTemplateMapping } from '@/types/composition';
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- config_loader_composition.test.ts`
Expected: PASS

**Step 5: Commit ConfigLoader updates**

```bash
git add backend/services/orchestrator/config_loader.ts backend/services/orchestrator/config_loader_composition.test.ts
git commit -m "feat: add composition system loading to ConfigLoader"
```

---

### Task 6: Create Composition Service Facade

**Files:**
- Create: `backend/services/composition/composition_service.ts`
- Create: `backend/services/composition/composition_service.test.ts`

**Step 1: Write failing test for composition service**

Create: `backend/services/composition/composition_service.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CompositionService } from './composition_service';
import { ConfigLoader } from '../orchestrator/config_loader';

describe('CompositionService', () => {
  let service: CompositionService;
  let configLoader: ConfigLoader;

  beforeEach(() => {
    configLoader = new ConfigLoader();
    service = new CompositionService(configLoader);
  });

  it('should resolve composition to full stack', () => {
    const composition = {
      base: 'nextjs_app_router',
      mobile: 'none',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const result = service.resolveComposition(composition);

    expect(result.valid).toBe(true);
    expect(result.resolved_stack).toBeDefined();
    expect(result.resolved_stack?.name).toContain('Next.js');
  });

  it('should migrate legacy template to composition', () => {
    const composition = service.migrateLegacyTemplate('nextjs_fullstack_expo');

    expect(composition).toBeDefined();
    expect(composition?.base).toBe('nextjs_app_router');
    expect(composition?.mobile).toBe('expo_integration');
  });

  it('should resolve legacy template to full stack', () => {
    const result = service.resolveLegacyTemplate('nextjs_web_app');

    expect(result.valid).toBe(true);
    expect(result.resolved_stack).toBeDefined();
  });

  it('should recommend compositions based on requirements', () => {
    const requirements = {
      project_type: 'web_app',
      platform_targets: ['web'],
      backend_complexity: 'simple'
    };

    const recommendations = service.recommendCompositions(requirements);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].composition.base).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- composition_service.test.ts`
Expected: FAIL with "Module './composition_service' not found"

**Step 3: Implement CompositionService**

Create: `backend/services/composition/composition_service.ts`

```typescript
import { CompositionResolver } from './composition_resolver';
import { LegacyMigrator } from './legacy_migrator';
import { ConfigLoader } from '../orchestrator/config_loader';
import {
  StackComposition,
  CompositionValidation,
  ResolvedStack
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
    const system = configLoader.getCompositionSystem();
    const mappings = configLoader.getLegacyMappings();

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
      const result = this.resolver.resolve(composition);

      if (result.valid && result.resolved_stack) {
        recommendations.push({
          composition,
          score: base.score,
          reason: base.reason,
          resolved_stack: result.resolved_stack
        });
      }
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    logger.info('[CompositionService] Generated recommendations', {
      count: recommendations.length
    });

    return recommendations;
  }

  private selectBaseLayers(
    requirements: CompositionRequirements,
    system: any
  ): Array<{ id: string; score: number; reason: string }> {
    const candidates: Array<{ id: string; score: number; reason: string }> = [];

    // Explicit frontend framework preference
    if (requirements.tech_preferences?.frontend_framework) {
      const framework = requirements.tech_preferences.frontend_framework.toLowerCase();

      if (framework.includes('next') && system.base_layers.nextjs_app_router) {
        candidates.push({ id: 'nextjs_app_router', score: 100, reason: 'Matches Next.js preference' });
      } else if (framework.includes('remix') && system.base_layers.remix) {
        candidates.push({ id: 'remix', score: 100, reason: 'Matches Remix preference' });
      } else if (framework.includes('svelte') && system.base_layers.sveltekit) {
        candidates.push({ id: 'sveltekit', score: 100, reason: 'Matches SvelteKit preference' });
      } else if (framework.includes('vue') && system.base_layers.vue_nuxt) {
        candidates.push({ id: 'vue_nuxt', score: 100, reason: 'Matches Vue/Nuxt preference' });
      } else if (framework.includes('astro') && system.base_layers.astro) {
        candidates.push({ id: 'astro', score: 100, reason: 'Matches Astro preference' });
      } else if (framework.includes('react') && system.base_layers.react_spa) {
        candidates.push({ id: 'react_spa', score: 100, reason: 'Matches React preference' });
      }
    }

    // If explicit preference didn't match or wasn't provided, use heuristics
    if (candidates.length === 0) {
      // Static sites -> Astro
      if (requirements.project_type === 'static_site' && system.base_layers.astro) {
        candidates.push({ id: 'astro', score: 95, reason: 'Best for static sites' });
      }

      // Backend-heavy Python -> Django or use with separate backend
      if (requirements.backend_complexity === 'ml_ai_intensive' ||
          requirements.tech_preferences?.backend_language === 'python') {
        if (system.base_layers.django) {
          candidates.push({ id: 'django', score: 90, reason: 'Python ecosystem for ML/AI' });
        }
        if (system.base_layers.nextjs_app_router) {
          candidates.push({ id: 'nextjs_app_router', score: 85, reason: 'Next.js + Python backend addon' });
        }
      }

      // Default: Next.js for web apps
      if (system.base_layers.nextjs_app_router) {
        candidates.push({ id: 'nextjs_app_router', score: 80, reason: 'Default for modern web apps' });
      }

      // Alternative: React SPA
      if (system.base_layers.react_spa) {
        candidates.push({ id: 'react_spa', score: 70, reason: 'Alternative SPA approach' });
      }

      // Alternative: Remix for edge
      if (system.base_layers.remix) {
        candidates.push({ id: 'remix', score: 75, reason: 'Alternative edge-first framework' });
      }
    }

    return candidates;
  }

  private selectMobile(requirements: CompositionRequirements): string {
    const platforms = requirements.platform_targets || [];
    const hasMobile = platforms.some(p =>
      ['ios', 'android', 'mobile'].includes(p.toLowerCase())
    );

    if (!hasMobile) {
      return 'none';
    }

    // Default to Expo for mobile
    return 'expo_integration';
  }

  private selectBackend(requirements: CompositionRequirements, baseId: string): string {
    // If backend language preference is Python -> FastAPI
    if (requirements.tech_preferences?.backend_language === 'python' ||
        requirements.backend_complexity === 'ml_ai_intensive') {
      return 'fastapi_api';
    }

    // If backend language preference is Go -> Go API
    if (requirements.tech_preferences?.backend_language === 'go') {
      return 'go_api';
    }

    // Default to integrated for full-stack frameworks
    if (['nextjs_app_router', 'remix', 'sveltekit', 'vue_nuxt', 'django'].includes(baseId)) {
      return 'integrated';
    }

    // For SPAs, use Express
    if (baseId === 'react_spa') {
      return 'express_api';
    }

    // For Astro, use serverless
    if (baseId === 'astro') {
      return 'serverless_only';
    }

    return 'integrated';
  }

  private selectData(requirements: CompositionRequirements): string {
    const dbType = requirements.tech_preferences?.database_type;

    // Explicit database preference
    if (dbType === 'supabase') return 'supabase_full';
    if (dbType === 'firebase') return 'firebase_full';
    if (dbType === 'mongodb') return 'mongodb';
    if (dbType === 'turso') return 'turso';

    // Static sites might not need DB
    if (requirements.project_type === 'static_site') {
      return 'headless_cms';
    }

    // Default: Neon Postgres
    return 'neon_postgres';
  }

  private selectArchitecture(requirements: CompositionRequirements): string {
    // High scale -> microservices
    if (requirements.scale_tier === 'enterprise' ||
        requirements.scale_tier === 'high_scale') {
      return 'microservices';
    }

    // Global/low latency -> edge
    if (requirements.project_type === 'api_platform' ||
        requirements.project_type === 'serverless') {
      return 'edge';
    }

    // Default: monolith
    return 'monolith';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- composition_service.test.ts`
Expected: PASS

**Step 5: Commit composition service**

```bash
git add backend/services/composition/composition_service.ts backend/services/composition/composition_service.test.ts
git commit -m "feat: implement composition service facade with recommendation logic"
```

---

## Phase 4: AI Agent Integration

### Task 7: Update Stack Selection Agent to Use Compositions

**Files:**
- Modify: `backend/services/llm/agent_executors.ts:1021-1050`
- Create: `backend/services/llm/stack_selection_compositional.test.ts`

**Step 1: Write failing integration test**

Create: `backend/services/llm/stack_selection_compositional.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getStackSelectionExecutor } from './agent_executors';
import { ConfigLoader } from '../orchestrator/config_loader';

// Mock LLM client
const mockLLMClient = {
  generateContent: vi.fn().mockResolvedValue({
    candidates: [{
      content: {
        parts: [{
          text: `\`\`\`markdown
filename: stack-analysis.md
---
Stack analysis content here
---
\`\`\``
        }]
      }
    }]
  })
};

describe('Stack Selection - Compositional Mode', () => {
  it('should pass composition system to AI agent', async () => {
    const artifacts = {
      'ANALYSIS/project-brief.md': 'Build a web app',
      'ANALYSIS/personas.md': 'Users',
      'ANALYSIS/constitution.md': 'Principles',
      'ANALYSIS/project-classification.json': JSON.stringify({
        project_type: 'web_app',
        platform_targets: ['web']
      })
    };

    await getStackSelectionExecutor(
      mockLLMClient as any,
      'test-project-id',
      artifacts,
      'Test Project'
    );

    // Check that LLM was called
    expect(mockLLMClient.generateContent).toHaveBeenCalled();

    // Check that the prompt includes composition information
    const callArgs = mockLLMClient.generateContent.mock.calls[0];
    const prompt = callArgs[0];

    expect(prompt).toContain('composition_system');
    expect(prompt).toContain('base_layers');
    expect(prompt).toContain('mobile_addons');
  });

  it('should support legacy mode', async () => {
    // Test that legacy templates still work
    const configLoader = new ConfigLoader();
    const spec = configLoader.loadSpec();

    expect(spec.stacks).toBeDefined();
    expect(spec.stacks.nextjs_fullstack_expo).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- stack_selection_compositional.test.ts`
Expected: FAIL (prompt doesn't include composition info yet)

**Step 3: Update agent executor to include composition system**

Modify: `backend/services/llm/agent_executors.ts`

Find the `getStackSelectionExecutor` function (around line 1021) and modify `executeArchitectAgent` call to pass composition data:

```typescript
export async function getStackSelectionExecutor(
  llmClient: LLMProvider,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  projectId: string,
  artifacts: Record<string, string>,
  projectName?: string
): Promise<Record<string, string>> {
  const configLoader = new ConfigLoader();
  const brief = artifacts['ANALYSIS/project-brief.md'] || '';
  const personas = artifacts['ANALYSIS/personas.md'] || '';
  const constitution = artifacts['ANALYSIS/constitution.md'] || '';
  const classificationRaw =
    artifacts['ANALYSIS/project-classification.json'] || '';
  const classification = parseProjectClassification(classificationRaw);

  // NEW: Get composition system and recommendations
  const compositionSystem = configLoader.getCompositionSystem();
  const isCompositional = configLoader.isCompositionMode();

  let defaultStack: string;
  let defaultStackReason: string;

  if (isCompositional) {
    // Use composition service for recommendations
    const { CompositionService } = await import('../composition/composition_service');
    const compositionService = new CompositionService(configLoader);

    const requirements = {
      project_type: classification?.project_type,
      platform_targets: classification?.platform_targets || [],
      backend_complexity: classification?.backend_complexity,
      scale_tier: classification?.scale_tier
    };

    const recommendations = compositionService.recommendCompositions(requirements);

    if (recommendations.length > 0) {
      const top = recommendations[0];
      defaultStack = compositionService.resolver.generateCompositionId(top.composition);
      defaultStackReason = top.reason;
    } else {
      // Fallback
      defaultStack = 'nextjs_app_router+none+integrated+neon_postgres+monolith';
      defaultStackReason = 'Default composition';
    }
  } else {
    // Use legacy defaults
    const legacyDefault = deriveIntelligentDefaultStack(classification, brief);
    defaultStack = legacyDefault.stack;
    defaultStackReason = legacyDefault.reason;
  }

  return executeArchitectAgent(
    llmClient,
    configLoader,
    'STACK_SELECTION',
    brief,
    personas,
    constitution,
    '',
    undefined,
    projectName,
    classificationRaw,
    defaultStack,
    defaultStackReason,
    isCompositional, // NEW: pass compositional flag
    compositionSystem // NEW: pass composition system
  );
}
```

**Step 4: Update executeArchitectAgent signature and implementation**

Modify: `backend/services/llm/agent_executors.ts`

Find `async function executeArchitectAgent` (around line 289) and update:

```typescript
async function executeArchitectAgent(
  llmClient: LLMProvider,
  configLoader: ConfigLoader,
  phase: 'STACK_SELECTION' | 'SPEC' | 'SOLUTIONING',
  projectBrief: string,
  personas: string,
  constitution: string,
  prd: string = '',
  stackChoice?: string,
  projectName?: string,
  projectClassification?: string,
  defaultStack?: string,
  defaultStackReason?: string,
  isCompositional?: boolean, // NEW
  compositionSystem?: any // NEW
): Promise<Record<string, string>> {
  logger.info(`[${phase}] Executing Architect Agent`, {
    briefLength: projectBrief?.length || 0,
    personasLength: personas?.length || 0,
    constitutionLength: constitution?.length || 0,
    prdLength: prd?.length || 0,
    stackChoice,
    projectName,
    isCompositional
  });

  const agentConfig = configLoader.getSection('agents').architect;

  let expectedFiles: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let variables: Record<string, any>;

  if (phase === 'STACK_SELECTION') {
    expectedFiles = ['stack-analysis.md', 'stack-decision.md', 'stack-rationale.md', 'stack.json'];

    // NEW: Build composition context for prompt
    let compositionContext = '';

    if (isCompositional && compositionSystem) {
      compositionContext = `
## COMPOSITIONAL STACK SYSTEM

You have access to a **compositional stack architecture** where you build stacks by combining:
- **Base Layer**: Frontend/framework choice (Next.js, Remix, SvelteKit, Vue/Nuxt, Astro, React SPA, Django)
- **Mobile Addon**: Optional mobile platform (Expo, React Native, Flutter, Capacitor, or None)
- **Backend Addon**: Backend service (Integrated, FastAPI, Express, Go, Django REST, Serverless)
- **Data Addon**: Database/storage (Neon Postgres, Supabase, Firebase, PlanetScale, Turso, MongoDB, etc.)
- **Architecture Addon**: Deployment pattern (Monolith, Edge, Microservices)

### Available Base Layers:
${Object.entries(compositionSystem.base_layers)
  .map(([id, layer]: [string, any]) =>
    `- **${id}**: ${layer.name} - ${layer.description}
   Compatible with: ${Object.entries(layer.compatible_with).map(([type, opts]: [string, any]) => `${type}=[${opts.join(', ')}]`).join(', ')}
   Best for: ${layer.best_for.join(', ')}`
  )
  .join('\n')}

### Available Mobile Addons:
${Object.entries(compositionSystem.mobile_addons)
  .map(([id, addon]: [string, any]) =>
    `- **${id}**: ${addon.name} - ${addon.description}`
  )
  .join('\n')}

### Available Backend Addons:
${Object.entries(compositionSystem.backend_addons)
  .map(([id, addon]: [string, any]) =>
    `- **${id}**: ${addon.name} - ${addon.description}`
  )
  .join('\n')}

### Available Data Addons:
${Object.entries(compositionSystem.data_addons)
  .map(([id, addon]: [string, any]) =>
    `- **${id}**: ${addon.name} - ${addon.description}`
  )
  .join('\n')}

### Available Architecture Addons:
${Object.entries(compositionSystem.architecture_addons)
  .map(([id, addon]: [string, any]) =>
    `- **${id}**: ${addon.name} - ${addon.description}`
  )
  .join('\n')}

## YOUR TASK

Analyze the project requirements and **compose the optimal stack** by selecting:
1. One base layer
2. One mobile addon (or 'none')
3. One backend addon
4. One data addon
5. One architecture addon

In your **stack-decision.md**, specify your composition like:
\`\`\`yaml
composition:
  base: nextjs_app_router
  mobile: expo_integration
  backend: integrated
  data: neon_postgres
  architecture: monolith
\`\`\`

The composition will be validated and resolved into a full stack automatically.

**Default Recommendation**: ${defaultStack} (${defaultStackReason})
`;
    } else {
      // Legacy mode - list templates
      const templates = configLoader.getSection('stacks');
      compositionContext = `
## AVAILABLE STACK TEMPLATES

${Object.entries(templates)
  .map(([id, template]: [string, any]) =>
    `- **${id}**: ${template.name} - ${template.description}`
  )
  .join('\n')}

**Default Recommendation**: ${defaultStack} (${defaultStackReason})
`;
    }

    variables = {
      brief: projectBrief,
      personas,
      constitution,
      prd: '',
      phase: 'STACK_SELECTION',
      stackChoice: stackChoice || 'web_application',
      projectName: projectName || 'Untitled Project',
      classification: projectClassification || '',
      defaultStack: defaultStack || 'nextjs_web_app',
      defaultStackReason: defaultStackReason || 'Fallback default for web applications',
      compositionContext, // NEW: inject composition info
      isCompositional: isCompositional || false // NEW
    };
  } else if (phase === 'SPEC') {
    // ... existing SPEC logic ...
  } else {
    // ... existing SOLUTIONING logic ...
  }

  // Rest of function remains the same...
}
```

**Step 5: Update prompt template in orchestrator_spec.yml**

Modify: `orchestrator_spec.yml` (find the architect agent prompt template around line 1380)

Update the prompt to include `{{compositionContext}}`:

```yaml
agents:
  architect:
    role: 'Chief Architect'
    perspective: 'System design and technology selection'
    responsibilities:
      - 'Analyze requirements and select optimal technology stack'
      - 'Define data models and API specifications'
      - 'Design system architecture and deployment strategy'
    prompt_template: |
      You are a Chief Architect analyzing requirements for: {{projectName}}

      ## Project Brief
      {{brief}}

      ## User Personas
      {{personas}}

      ## Constitution (Principles)
      {{constitution}}

      ## Project Classification
      {{classification}}

      {{compositionContext}}

      # ... rest of prompt ...
```

**Step 6: Run test to verify it passes**

Run: `npm run test -- stack_selection_compositional.test.ts`
Expected: PASS

**Step 7: Commit agent integration**

```bash
git add backend/services/llm/agent_executors.ts backend/services/llm/stack_selection_compositional.test.ts orchestrator_spec.yml
git commit -m "feat: integrate compositional stack system into AI agent prompts"
```

---

## Phase 5: Frontend UI Updates

### Task 8: Create Composition Display Components

**Files:**
- Create: `src/components/orchestration/CompositionCard.tsx`
- Create: `src/components/orchestration/CompositionBuilder.tsx`

**Step 1: Create CompositionCard component**

Create: `src/components/orchestration/CompositionCard.tsx`

```typescript
"use client"

import { ResolvedStack } from "@/types/composition"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Layers, Database, Cloud, Smartphone } from "lucide-react"

interface CompositionCardProps {
  stack: ResolvedStack
  isSelected?: boolean
  onSelect: (stackId: string) => void
  score?: number
  isPrimary?: boolean
  disabled?: boolean
}

export function CompositionCard({
  stack,
  isSelected,
  onSelect,
  score,
  isPrimary,
  disabled
}: CompositionCardProps) {
  return (
    <div
      className={`
        relative border rounded-lg p-6 transition-all cursor-pointer
        ${isSelected ? 'border-primary ring-2 ring-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'}
        ${isPrimary ? 'border-emerald-500 bg-emerald-50/50' : ''}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
      `}
      onClick={() => !disabled && onSelect(stack.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {isPrimary && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            {stack.name}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{stack.description}</p>
        </div>
        {score && (
          <Badge variant={isPrimary ? "default" : "secondary"}>
            {score}% Match
          </Badge>
        )}
      </div>

      {/* Composition Layers */}
      <div className="space-y-3 mb-4">
        <div className="flex items-start gap-2 text-sm">
          <Layers className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
          <div>
            <div className="font-medium">Frontend:</div>
            <div className="text-muted-foreground">{stack.composition.frontend}</div>
          </div>
        </div>

        {stack.composition.mobile && stack.composition.mobile !== 'None' && (
          <div className="flex items-start gap-2 text-sm">
            <Smartphone className="h-4 w-4 mt-0.5 text-purple-500 flex-shrink-0" />
            <div>
              <div className="font-medium">Mobile:</div>
              <div className="text-muted-foreground">{stack.composition.mobile}</div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-sm">
          <Database className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
          <div>
            <div className="font-medium">Database:</div>
            <div className="text-muted-foreground">{stack.composition.database}</div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm">
          <Cloud className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
          <div>
            <div className="font-medium">Backend:</div>
            <div className="text-muted-foreground">{stack.composition.backend}</div>
          </div>
        </div>
      </div>

      {/* Strengths & Tradeoffs */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
        <div>
          <div className="font-medium text-green-700 mb-1">✓ Strengths</div>
          <ul className="space-y-1 text-muted-foreground">
            {stack.strengths.slice(0, 3).map((strength, i) => (
              <li key={i}>• {strength}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-medium text-amber-700 mb-1">⚠ Tradeoffs</div>
          <ul className="space-y-1 text-muted-foreground">
            {stack.tradeoffs.slice(0, 3).map((tradeoff, i) => (
              <li key={i}>• {tradeoff}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Best For */}
      <div className="mb-4">
        <div className="text-xs font-medium mb-2">Best for:</div>
        <div className="flex flex-wrap gap-1">
          {stack.best_for.slice(0, 4).map((use, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {use}
            </Badge>
          ))}
        </div>
      </div>

      {/* Select Button */}
      <Button
        className="w-full"
        variant={isSelected ? "default" : "outline"}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(stack.id)
        }}
      >
        {isSelected ? 'Selected' : 'Select Stack'}
      </Button>
    </div>
  )
}
```

**Step 2: Update StackRecommendationView to support compositions**

Modify: `src/components/orchestration/StackRecommendationView.tsx`

Add new imports and update component:

```typescript
"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { StackCard, StackTemplate } from "./StackCard"
import { CompositionCard } from "./CompositionCard"
import { ResolvedStack } from "@/types/composition"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles, Shield, AlertTriangle } from "lucide-react"

interface StackRecommendationViewProps {
  stackAnalysisContent: string
  classificationContent?: string
  templates: StackTemplate[]
  compositions?: ResolvedStack[] // NEW: support compositions
  mode?: 'legacy' | 'compositional' // NEW: mode flag
  onSelect: (stackId: string) => void
  selectedStackId?: string | null
  isLoading?: boolean
}

// ... keep existing parseAnalysis function ...

export function StackRecommendationView({
  stackAnalysisContent,
  classificationContent,
  templates,
  compositions, // NEW
  mode = 'legacy', // NEW
  onSelect,
  selectedStackId,
  isLoading
}: StackRecommendationViewProps) {
  const [showAlternatives, setShowAlternatives] = useState(false)

  const analysis = useMemo(() =>
    parseAnalysis(stackAnalysisContent, classificationContent),
    [stackAnalysisContent, classificationContent]
  )

  // Compositional mode - use ResolvedStack[]
  if (mode === 'compositional' && compositions) {
    const primaryComposition = compositions[0]
    const alternativeCompositions = compositions.slice(1, 3)

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* AI Insight Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-4">
          <div className="p-2 bg-primary/10 rounded-full mt-1">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-primary">AI Stack Composition</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Built a custom stack composition from {compositions.length} analyzed combinations.
              The <strong>{primaryComposition?.name}</strong> composition is the best fit.
            </p>
          </div>
        </div>

        <div className="grid gap-8">
          {/* Primary Recommendation */}
          {primaryComposition && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Primary Recommendation
                </h3>
                <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Best Match
                </span>
              </div>

              <CompositionCard
                stack={primaryComposition}
                isPrimary={true}
                isSelected={selectedStackId === primaryComposition.id}
                onSelect={onSelect}
                disabled={isLoading}
              />
            </section>
          )}

          {/* Alternatives Section */}
          {alternativeCompositions.length > 0 && (
            <section className="space-y-4">
              <Button
                variant="ghost"
                className="w-full flex justify-between items-center group"
                onClick={() => setShowAlternatives(!showAlternatives)}
              >
                <span className="font-medium text-lg">Consider Alternatives</span>
                {showAlternatives ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>

              <AnimatePresence>
                {showAlternatives && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid md:grid-cols-2 gap-4 py-2">
                      {alternativeCompositions.map((composition) => (
                        <CompositionCard
                          key={composition.id}
                          stack={composition}
                          isSelected={selectedStackId === composition.id}
                          onSelect={onSelect}
                          disabled={isLoading}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}
        </div>
      </div>
    )
  }

  // Legacy mode - use existing template rendering
  const primaryTemplate = templates.find(t => t.id === analysis.primaryId)
  const alternativeTemplates = analysis.alternatives
    .map(alt => ({ template: templates.find(t => t.id === alt.id), score: alt.score }))
    .filter(item => item.template !== undefined) as { template: StackTemplate, score: number | null }[]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ... existing legacy rendering ... */}
    </div>
  )
}
```

**Step 3: Commit UI components**

```bash
git add src/components/orchestration/CompositionCard.tsx src/components/orchestration/StackRecommendationView.tsx
git commit -m "feat: add composition card component and update stack recommendation view"
```

---

## Phase 6: End-to-End Integration & Testing

### Task 9: Integration Test for Full Compositional Flow

**Files:**
- Create: `backend/tests/integration/compositional-stack-flow.test.ts`

**Step 1: Write integration test**

Create: `backend/tests/integration/compositional-stack-flow.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { ConfigLoader } from '@/backend/services/orchestrator/config_loader';
import { CompositionService } from '@/backend/services/composition/composition_service';

describe('Compositional Stack Flow - Integration', () => {
  let configLoader: ConfigLoader;
  let compositionService: CompositionService;

  beforeAll(() => {
    configLoader = new ConfigLoader();
    compositionService = new CompositionService(configLoader);
  });

  it('should load composition system from orchestrator_spec.yml', () => {
    const system = configLoader.getCompositionSystem();

    expect(system).toBeDefined();
    expect(system.version).toBe('2.0');
    expect(system.base_layers).toBeDefined();
    expect(Object.keys(system.base_layers)).toContain('nextjs_app_router');
    expect(Object.keys(system.mobile_addons)).toContain('expo_integration');
    expect(Object.keys(system.backend_addons)).toContain('integrated');
    expect(Object.keys(system.data_addons)).toContain('neon_postgres');
  });

  it('should migrate legacy templates to compositions', () => {
    const composition = compositionService.migrateLegacyTemplate('nextjs_fullstack_expo');

    expect(composition).toBeDefined();
    expect(composition?.base).toBe('nextjs_app_router');
    expect(composition?.mobile).toBe('expo_integration');
    expect(composition?.backend).toBe('integrated');
    expect(composition?.data).toBe('neon_postgres');
  });

  it('should resolve composition to full stack', () => {
    const composition = {
      base: 'nextjs_app_router',
      mobile: 'expo_integration',
      backend: 'integrated',
      data: 'neon_postgres',
      architecture: 'monolith'
    };

    const result = compositionService.resolveComposition(composition);

    expect(result.valid).toBe(true);
    expect(result.resolved_stack).toBeDefined();
    expect(result.resolved_stack?.name).toContain('Next.js');
    expect(result.resolved_stack?.composition.frontend).toBe('Next.js 14 (App Router)');
    expect(result.resolved_stack?.composition.mobile).toBe('Expo with React Native');
  });

  it('should recommend compositions based on requirements', () => {
    const requirements = {
      project_type: 'web_app',
      platform_targets: ['web', 'ios', 'android'],
      backend_complexity: 'simple'
    };

    const recommendations = compositionService.recommendCompositions(requirements);

    expect(recommendations.length).toBeGreaterThan(0);

    const top = recommendations[0];
    expect(top.composition.base).toBeDefined();
    expect(top.composition.mobile).not.toBe('none'); // Should include mobile
    expect(top.score).toBeGreaterThan(0);
  });

  it('should validate incompatible compositions', () => {
    const invalidComposition = {
      base: 'astro',
      mobile: 'expo_integration', // Astro doesn't support Expo
      backend: 'integrated',
      data: 'none',
      architecture: 'monolith'
    };

    const result = compositionService.resolveComposition(invalidComposition);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should support both compositional and legacy modes', () => {
    const isCompositional = configLoader.isCompositionMode();
    const isLegacy = configLoader.isLegacyMode();

    expect(isCompositional).toBe(true);
    expect(isLegacy).toBe(true); // Hybrid mode supports both
  });
});
```

**Step 2: Run integration test**

Run: `npm run test -- compositional-stack-flow.test.ts`
Expected: PASS (all systems integrated)

**Step 3: Commit integration test**

```bash
git add backend/tests/integration/compositional-stack-flow.test.ts
git commit -m "test: add end-to-end integration test for compositional stack flow"
```

---

### Task 10: Update Documentation

**Files:**
- Create: `docs/architecture/compositional-stacks.md`

**Step 1: Write architecture documentation**

Create: `docs/architecture/compositional-stacks.md`

```markdown
# Compositional Stack Architecture

## Overview

The spec-driven system uses a compositional architecture for stack selection, replacing 13 monolithic templates with mix-and-match layers that can be combined in 100+ valid configurations.

## Architecture

### Core Concept

Instead of monolithic templates like "Next.js Full-Stack + Expo", we compose stacks from **5 independent layers**:

1. **Base Layer** - Frontend/framework choice
2. **Mobile Addon** - Optional mobile platform
3. **Backend Addon** - Backend service choice
4. **Data Addon** - Database and storage
5. **Architecture Addon** - Deployment pattern

### Example Composition

```yaml
composition:
  base: nextjs_app_router
  mobile: expo_integration
  backend: integrated
  data: neon_postgres
  architecture: monolith
```

Resolves to:
- **Frontend**: Next.js 14 (App Router)
- **Mobile**: Expo with React Native
- **Backend**: Next.js API routes
- **Database**: Neon Postgres + Drizzle ORM
- **Auth**: Better Auth
- **Storage**: Cloudflare R2
- **Deployment**: Vercel (monolith)

## Implementation

### Schema (`orchestrator_spec.yml`)

```yaml
composition_system:
  version: "2.0"
  mode: "compositional" # compositional | legacy | hybrid

  base_layers:
    nextjs_app_router:
      name: "Next.js App Router"
      # ...
      compatible_with:
        mobile: ["expo_integration", "none"]
        backend: ["integrated", "fastapi_api"]
        data: ["neon_postgres", "supabase_full"]
        architecture: ["monolith", "edge"]

  mobile_addons: { ... }
  backend_addons: { ... }
  data_addons: { ... }
  architecture_addons: { ... }
```

### Services

1. **CompositionResolver** (`backend/services/composition/composition_resolver.ts`)
   - Validates compositions
   - Resolves layers into full stack
   - Generates unique composition IDs

2. **LegacyMigrator** (`backend/services/composition/legacy_migrator.ts`)
   - Migrates old template IDs to compositions
   - Maintains backward compatibility

3. **CompositionService** (`backend/services/composition/composition_service.ts`)
   - Facade combining resolver and migrator
   - Recommends compositions based on requirements
   - Scores and ranks compositions

### AI Integration

The stack selection agent receives the composition system in its prompt:

```
### Available Base Layers:
- nextjs_app_router: Next.js App Router - ...
- remix: Remix - ...
- sveltekit: SvelteKit - ...

### Your Task
Compose the optimal stack by selecting:
1. One base layer
2. One mobile addon
3. One backend addon
4. One data addon
5. One architecture addon

Output in stack-decision.md:
```yaml
composition:
  base: nextjs_app_router
  mobile: none
  backend: integrated
  data: neon_postgres
  architecture: monolith
```
```

### Frontend UI

- **CompositionCard** component displays resolved stacks with layer breakdown
- **StackRecommendationView** supports both compositional and legacy modes

## Backward Compatibility

### Legacy Template Migration

Old template IDs are mapped to compositions:

```yaml
legacy_template_migration:
  nextjs_fullstack_expo:
    composition:
      base: nextjs_app_router
      mobile: expo_integration
      backend: integrated
      data: neon_postgres
      architecture: monolith
    reason: "Full-stack Next.js + Expo"
```

### Hybrid Mode

Set `mode: "hybrid"` to support both:
- AI can use compositional system
- Old projects with template IDs continue working
- Frontend displays appropriate UI based on stack format

## Benefits

1. **Eliminates Duplication**: Update auth once in `neon_postgres` addon → affects all compositions
2. **Exponential Coverage**: 7 bases × 5 backends × 4 mobile × 9 data = 140+ valid combinations
3. **Clearer Decisions**: Pick base, then augment (vs. choosing from 13 similar templates)
4. **Future-Proof**: Add Remix = 1 base layer, instantly get Remix+FastAPI, Remix+Expo, etc.
5. **AI-Friendly**: Structured composition is easier for LLM to reason about than monolithic templates

## Migration Guide

### For Existing Projects

No action needed. Legacy template IDs automatically migrate to compositions.

### For New Projects

1. AI analyzes requirements
2. AI selects optimal composition
3. System validates composition
4. System resolves to full stack
5. User approves or customizes

### Adding New Components

To add a new framework (e.g., Angular):

1. Add to `base_layers` in `orchestrator_spec.yml`:

```yaml
angular:
  name: "Angular"
  type: "frontend_framework"
  description: "Angular 17+ with standalone components"
  composition:
    frontend: "Angular 17"
    backend: "Angular server routes"
  compatible_with:
    mobile: ["capacitor", "none"]
    backend: ["integrated", "express_api"]
    data: ["neon_postgres", "supabase_full"]
    architecture: ["monolith"]
  # ...
```

2. Done! No other code changes needed. Angular now works with all compatible addons.

## Testing

Run integration test:

```bash
npm run test -- compositional-stack-flow.test.ts
```

Validates:
- Schema loading
- Composition resolution
- Legacy migration
- Validation logic
- Recommendation engine

## See Also

- `src/types/composition.ts` - TypeScript types
- `backend/services/composition/` - Service implementations
- `orchestrator_spec.yml` - Schema definition
```

**Step 2: Commit documentation**

```bash
git add docs/architecture/compositional-stacks.md
git commit -m "docs: add compositional stack architecture documentation"
```

---

## Phase 7: Cleanup & Final Verification

### Task 11: Run Full Test Suite

**Files:**
- All test files

**Step 1: Run all unit tests**

Run: `npm run test`
Expected: All tests pass

**Step 2: Run type checking**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run linting**

Run: `npm run lint`
Expected: No linting errors

**Step 4: Fix any failing tests or type errors**

If any tests fail:
- Read error message
- Fix the issue
- Re-run tests
- Commit fix

**Step 5: Commit any fixes**

```bash
git add .
git commit -m "fix: resolve test failures and type errors"
```

---

### Task 12: Update README with Composition System Info

**Files:**
- Modify: `README.md`

**Step 1: Add composition system section to README**

Add section after project overview:

```markdown
## Stack Selection Architecture

Spec-driven uses a **compositional stack architecture** where you build custom tech stacks by combining independent layers:

- **Base Layer**: Frontend framework (Next.js, Remix, SvelteKit, Vue/Nuxt, Astro, React SPA, Django)
- **Mobile Addon**: Optional mobile platform (Expo, React Native, Flutter, Capacitor)
- **Backend Addon**: Backend service (Integrated, FastAPI, Express, Go, Django REST, Serverless)
- **Data Addon**: Database/storage (Neon Postgres, Supabase, Firebase, PlanetScale, Turso, MongoDB)
- **Architecture Addon**: Deployment pattern (Monolith, Edge, Microservices)

This provides **100+ valid combinations** from ~30 components, replacing 13 monolithic templates.

**Example:**
```yaml
composition:
  base: nextjs_app_router
  mobile: expo_integration
  backend: integrated
  data: neon_postgres
  architecture: monolith
```

See [Compositional Architecture Docs](docs/architecture/compositional-stacks.md) for details.
```

**Step 2: Commit README update**

```bash
git add README.md
git commit -m "docs: update README with compositional stack architecture overview"
```

---

### Task 13: Create Migration Script for Existing Projects

**Files:**
- Create: `backend/scripts/migrate-legacy-stacks.ts`

**Step 1: Write migration script**

Create: `backend/scripts/migrate-legacy-stacks.ts`

```typescript
#!/usr/bin/env tsx

/**
 * Migration script to convert existing projects using legacy template IDs
 * to use the new compositional stack system.
 *
 * Usage: npx tsx backend/scripts/migrate-legacy-stacks.ts
 */

import { db } from '@/backend/lib/drizzle';
import { projects } from '@/backend/lib/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { ConfigLoader } from '@/backend/services/orchestrator/config_loader';
import { CompositionService } from '@/backend/services/composition/composition_service';
import { logger } from '@/lib/logger';

async function migrateLegacyStacks() {
  logger.info('[Migration] Starting legacy stack migration');

  const configLoader = new ConfigLoader();
  const compositionService = new CompositionService(configLoader);

  // Get all projects with stack_choice set
  const allProjects = await db
    .select()
    .from(projects)
    .where(isNotNull(projects.stack_choice));

  logger.info(`[Migration] Found ${allProjects.length} projects with stack_choice`);

  let migratedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const project of allProjects) {
    const stackId = project.stack_choice;

    if (!stackId) {
      skippedCount++;
      continue;
    }

    // Check if already compositional (contains + signs)
    if (stackId.includes('+')) {
      logger.info(`[Migration] Project ${project.id} already uses compositional ID: ${stackId}`);
      skippedCount++;
      continue;
    }

    // Try to migrate
    const composition = compositionService.migrateLegacyTemplate(stackId);

    if (!composition) {
      logger.warn(`[Migration] No migration mapping for project ${project.id} with stack: ${stackId}`);
      failedCount++;
      continue;
    }

    // Generate new composition ID
    const newStackId = compositionService.resolver.generateCompositionId(composition);

    // Update project
    await db
      .update(projects)
      .set({
        stack_choice: newStackId,
        updated_at: new Date()
      })
      .where(eq(projects.id, project.id));

    logger.info(`[Migration] Migrated project ${project.id}: ${stackId} -> ${newStackId}`);
    migratedCount++;
  }

  logger.info('[Migration] Migration complete', {
    total: allProjects.length,
    migrated: migratedCount,
    skipped: skippedCount,
    failed: failedCount
  });

  if (failedCount > 0) {
    logger.warn(`[Migration] ${failedCount} projects failed to migrate. Review logs for details.`);
  }

  process.exit(0);
}

migrateLegacyStacks().catch((error) => {
  logger.error('[Migration] Migration failed', error);
  process.exit(1);
});
```

**Step 2: Make script executable**

Run: `chmod +x backend/scripts/migrate-legacy-stacks.ts`

**Step 3: Test migration script (dry run)**

Add dry-run support:

```typescript
const DRY_RUN = process.argv.includes('--dry-run');

// ... in loop ...
if (!DRY_RUN) {
  await db.update(projects)...
} else {
  logger.info(`[DRY RUN] Would migrate: ${stackId} -> ${newStackId}`);
}
```

Run: `npx tsx backend/scripts/migrate-legacy-stacks.ts --dry-run`
Expected: Shows what would be migrated without actually changing DB

**Step 4: Commit migration script**

```bash
git add backend/scripts/migrate-legacy-stacks.ts
git commit -m "feat: add migration script for legacy stack templates"
```

---

### Task 14: Final Integration Test & Deployment Checklist

**Files:**
- Create: `docs/deployment/compositional-rollout.md`

**Step 1: Create deployment checklist**

Create: `docs/deployment/compositional-rollout.md`

```markdown
# Compositional Stack Architecture Rollout Checklist

## Pre-Deployment

- [ ] All unit tests pass (`npm run test`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No linting errors (`npm run lint`)
- [ ] Integration tests pass (`npm run test -- compositional-stack-flow.test.ts`)
- [ ] Documentation complete
- [ ] Migration script tested in staging

## Deployment Steps

### 1. Database Backup

```bash
# Backup production database before migration
npm run db:backup
```

### 2. Deploy Code

```bash
# Deploy to production
git push origin main
# ... your deployment process ...
```

### 3. Run Migration (Optional)

If you want to migrate existing projects immediately:

```bash
# Dry run first to preview changes
npx tsx backend/scripts/migrate-legacy-stacks.ts --dry-run

# If looks good, run migration
npx tsx backend/scripts/migrate-legacy-stacks.ts
```

**Note:** Migration is **optional**. The system supports both:
- Old projects with legacy template IDs (backward compatible)
- New projects with compositional IDs

### 4. Verify System

- [ ] Check orchestrator loads composition system
- [ ] Test new project creation with compositions
- [ ] Test existing project with legacy template ID still works
- [ ] Test stack recommendation flow
- [ ] Test UI displays compositions correctly

### 5. Monitor

- [ ] Check logs for composition validation errors
- [ ] Monitor AI agent prompt lengths (composition info adds ~2-3K tokens)
- [ ] Track user selections (compositional vs legacy)

## Rollback Plan

If issues arise:

1. **Rollback code** to previous deployment
2. **Restore database** from backup (if migration was run)
3. **Investigate** errors in logs
4. **Fix** and re-test in staging
5. **Re-deploy** when ready

## Configuration

### Enable/Disable Compositional Mode

In `orchestrator_spec.yml`:

```yaml
composition_system:
  mode: "compositional"  # compositional | legacy | hybrid
```

- `compositional`: Only use new system (recommended)
- `legacy`: Only use old templates (for rollback)
- `hybrid`: Support both (default for transition period)

## Success Criteria

- [ ] No increase in error rates
- [ ] Stack selection flow completes successfully
- [ ] UI renders correctly for both modes
- [ ] AI generates valid compositions
- [ ] Validation catches incompatible combinations
- [ ] Legacy projects continue working

## Post-Deployment

- [ ] Document any issues encountered
- [ ] Update this checklist based on learnings
- [ ] Monitor for 1 week
- [ ] Plan deprecation timeline for legacy mode (if desired)

## Support

If issues arise:
1. Check logs at `/logs/orchestrator.log`
2. Verify composition system loaded: `getCompositionSystem()`
3. Test composition validation: `compositionService.resolveComposition()`
4. Review [Architecture Docs](../architecture/compositional-stacks.md)
```

**Step 2: Commit deployment checklist**

```bash
git add docs/deployment/compositional-rollout.md
git commit -m "docs: add compositional stack rollout checklist"
```

**Step 3: Create final summary commit**

```bash
git log --oneline -15 > migration-summary.txt
git add migration-summary.txt
git commit -m "chore: compositional stack architecture implementation complete

Complete rewrite from 13 monolithic templates to compositional system:
- 7 base layers (frontend frameworks)
- 4 mobile addons
- 6 backend addons
- 9 data addons
- 3 architecture addons

= 100+ valid combinations from ~30 components

Features:
- Full backward compatibility via legacy migration
- AI agent integration with compositional prompts
- Frontend UI with CompositionCard component
- Comprehensive validation engine
- Migration script for existing projects
- Full test coverage

All tests passing, ready for deployment."
```

---

## Summary

This implementation plan delivers a **production-ready compositional stack architecture** that:

✅ **Solves all four pain points:**
- Decision paralysis → Clearer layered choices
- Maintenance → Update once, affects all compositions
- Coverage gaps → 100+ combinations vs 13 templates
- Flexibility → Mix and match any compatible layers

✅ **Seamlessly integrates** with existing codebase:
- Extends `orchestrator_spec.yml` (doesn't replace)
- Works with existing `ConfigLoader`, `orchestrator_engine`, and agent executors
- UI updates are additive (supports both modes)

✅ **Complete implementation:**
- Schema design ✓
- Type system ✓
- Composition engine ✓
- Legacy migration ✓
- Backend integration ✓
- AI agent prompts ✓
- Frontend UI ✓
- Testing ✓
- Documentation ✓
- Migration script ✓
- Deployment checklist ✓

✅ **Test-driven:** Every component has unit tests + integration test

✅ **Production-ready:**
- Backward compatible (hybrid mode)
- Error handling and validation
- Logging and monitoring
- Migration path for existing projects
- Rollback plan

## Next Steps

After saving this plan, you have two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which would you prefer?
