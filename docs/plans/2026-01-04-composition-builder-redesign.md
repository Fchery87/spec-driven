# CompositionBuilder Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Redesign CompositionBuilder with Project Type selector, 6-card grid (including Full-Stack card), dynamic layer requirements, and fixed expand/collapse for "+N more options" links.

**Architecture:** 
- Add ProjectTypeSelector component at top of CompositionBuilder
- Add FullStackCard as 6th option that auto-fills Base Layer + Backend
- Implement dynamic progress tracking based on project type (Web/Mobile/both/API)
- Fix expand/collapse button in CompositionLayerCard for "+N more options"
- Maintain backward compatibility with existing composition system

**Tech Stack:** React, TypeScript, Vitest, existing CompositionLayerCard, CompositionPreviewCard components

---

## Phase 1: Types & Constants

### Task 1: Add Project Type Enum and Constants

**Files:**
- Modify: `src/types/composition.ts`
- Create: `src/types/composition_project_type.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { ProjectType, PROJECT_TYPE_CONFIG, getRequiredLayerCount } from './composition';

describe('ProjectType Configuration', () => {
  it('should define all project types', () => {
    expect(ProjectType.WEB_APP).toBe('web_app');
    expect(ProjectType.MOBILE_APP).toBe('mobile_app');
    expect(ProjectType.BOTH).toBe('both');
    expect(ProjectType.API_ONLY).toBe('api_only');
  });

  it('should return correct required layer count for web_app', () => {
    expect(getRequiredLayerCount(ProjectType.WEB_APP)).toBe(4);
  });

  it('should return correct required layer count for mobile_app', () => {
    expect(getRequiredLayerCount(ProjectType.MOBILE_APP)).toBe(4);
  });

  it('should return correct required layer count for both', () => {
    expect(getRequiredLayerCount(ProjectType.BOTH)).toBe(5);
  });

  it('should return correct required layer count for api_only', () => {
    expect(getRequiredLayerCount(ProjectType.API_ONLY)).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npm run test -- composition_project_type.test.ts`
Expected: FAIL - "ProjectType not exported"

**Step 3: Add ProjectType enum and constants to composition.ts**

Add to `src/types/composition.ts`:

```typescript
export enum ProjectType {
  WEB_APP = 'web_app',
  MOBILE_APP = 'mobile_app',
  BOTH = 'both',
  API_ONLY = 'api_only'
}

export interface ProjectTypeConfig {
  label: string;
  description: string;
  icon: string;
  requiredLayers: string[];
  optionalLayers: string[];
}

export const PROJECT_TYPE_CONFIG: Record<ProjectType, ProjectTypeConfig> = {
  [ProjectType.WEB_APP]: {
    label: 'Web App',
    description: 'Browser-based application',
    icon: '🌐',
    requiredLayers: ['base', 'backend', 'data', 'architecture'],
    optionalLayers: ['mobile']
  },
  [ProjectType.MOBILE_APP]: {
    label: 'Mobile App',
    description: 'Native mobile application',
    icon: '📱',
    requiredLayers: ['mobile', 'backend', 'data', 'architecture'],
    optionalLayers: ['base']
  },
  [ProjectType.BOTH]: {
    label: 'Both Web + Mobile',
    description: 'Web application with mobile companion',
    icon: '🌐📱',
    requiredLayers: ['base', 'mobile', 'backend', 'data', 'architecture'],
    optionalLayers: []
  },
  [ProjectType.API_ONLY]: {
    label: 'API Only',
    description: 'Backend API without frontend',
    icon: '🔌',
    requiredLayers: ['backend', 'data', 'architecture'],
    optionalLayers: ['base', 'mobile']
  }
};

export function getRequiredLayerCount(projectType: ProjectType): number {
  return PROJECT_TYPE_CONFIG[projectType].requiredLayers.length;
}
```

**Step 4: Run test to verify it passes**
Run: `npm run test -- composition_project_type.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/composition.ts src/types/composition_project_type.test.ts
git commit -m "feat: add ProjectType enum and configuration for dynamic layer requirements"
```

---

### Task 2: Add Full-Stack Frameworks to Composition Types

**Files:**
- Modify: `src/types/composition.ts`
- Test: `src/types/composition_fullstack.test.ts` (new)

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { FullStackFramework, getFullStackFrameworks, isFullStackFramework } from './composition';

describe('Full-Stack Framework Support', () => {
  it('should have 7 full-stack frameworks', () => {
    const frameworks = getFullStackFrameworks();
    expect(frameworks.length).toBe(7);
  });

  it('should identify full-stack framework IDs', () => {
    expect(isFullStackFramework('nextjs_app_router')).toBe(false);
    expect(isFullStackFramework('nextjs_fullstack')).toBe(true);
    expect(isFullStackFramework('tanstack_start')).toBe(true);
  });

  it('should return composition when mapping full-stack to base+backend', () => {
    const composition = getFullStackComposition('nextjs_fullstack');
    expect(composition).toEqual({
      base: 'nextjs_app_router',
      backend: 'integrated'
    });
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npm run test -- composition_fullstack.test.ts`
Expected: FAIL - Functions not defined

**Step 3: Add full-stack framework constants**

Add to `src/types/composition.ts`:

```typescript
// Full-stack frameworks (frontend + built-in backend)
export enum FullStackFramework {
  NEXTJS_FULLSTACK = 'nextjs_fullstack',
  REMIX_FULLSTACK = 'remix_fullstack',
  SVELTEKIT_FULLSTACK = 'sveltekit_fullstack',
  NUXT_FULLSTACK = 'nuxt_fullstack',
  DJANGO_FULLSTACK = 'django_fullstack',
  LARAVEL_FULLSTACK = 'laravel_fullstack',
  TANSTACK_START = 'tanstack_start'
}

export const FULL_STACK_FRAMEWORKS: Record<string, { name: string; baseId: string; backendId: string }> = {
  [FullStackFramework.NEXTJS_FULLSTACK]: {
    name: 'Next.js (Full-Stack)',
    baseId: 'nextjs_app_router',
    backendId: 'integrated'
  },
  [FullStackFramework.REMIX_FULLSTACK]: {
    name: 'Remix (Full-Stack)',
    baseId: 'remix',
    backendId: 'integrated'
  },
  [FullStackFramework.SVELTEKIT_FULLSTACK]: {
    name: 'SvelteKit (Full-Stack)',
    baseId: 'sveltekit',
    backendId: 'integrated'
  },
  [FullStackFramework.NUXT_FULLSTACK]: {
    name: 'Nuxt (Full-Stack)',
    baseId: 'vue_nuxt',
    backendId: 'integrated'
  },
  [FullStackFramework.DJANGO_FULLSTACK]: {
    name: 'Django (Full-Stack)',
    baseId: 'django',
    backendId: 'integrated'
  },
  [FullStackFramework.LARAVEL_FULLSTACK]: {
    name: 'Laravel (Full-Stack)',
    baseId: 'laravel',
    backendId: 'integrated'
  },
  [FullStackFramework.TANSTACK_START]: {
    name: 'TanStack Start (Full-Stack)',
    baseId: 'tanstack_start',
    backendId: 'integrated'
  }
};

export function getFullStackFrameworks(): Array<{ id: string; name: string }> {
  return Object.entries(FULL_STACK_FRAMEWORKS).map(([id, config]) => ({
    id,
    name: config.name
  }));
}

export function isFullStackFramework(frameworkId: string): boolean {
  return frameworkId in FULL_STACK_FRAMEWORKS;
}

export function getFullStackComposition(frameworkId: string): { base: string; backend: string } | null {
  const config = FULL_STACK_FRAMEWORKS[frameworkId];
  if (!config) return null;
  return { base: config.baseId, backend: config.backendId };
}
```

**Step 4: Run test to verify it passes**
Run: `npm run test -- composition_fullstack.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/composition.ts src/types/composition_fullstack.test.ts
git commit -m "feat: add full-stack framework constants for 7 frameworks"
```

---

## Phase 2: Project Type Selector Component

### Task 3: Create ProjectTypeSelector Component

**Files:**
- Create: `src/components/orchestration/ProjectTypeSelector.tsx`
- Create: `src/components/orchestration/__tests__/ProjectTypeSelector.test.tsx`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectTypeSelector } from '@/components/orchestration/ProjectTypeSelector';
import { ProjectType } from '@/types/composition';

describe('ProjectTypeSelector', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 4 project type options', () => {
    render(<ProjectTypeSelector selected={ProjectType.WEB_APP} onSelect={mockOnSelect} />);
    expect(screen.getByText('Web App')).toBeInTheDocument();
    expect(screen.getByText('Mobile App')).toBeInTheDocument();
    expect(screen.getByText('Both')).toBeInTheDocument();
    expect(screen.getByText('API Only')).toBeInTheDocument();
  });

  it('highlights selected project type', () => {
    render(<ProjectTypeSelector selected={ProjectType.WEB_APP} onSelect={mockOnSelect} />);
    const webAppOption = screen.getByText('Web App').closest('[role="radio"]');
    expect(webAppOption).toHaveAttribute('data-state', 'checked');
  });

  it('calls onSelect when option is clicked', () => {
    render(<ProjectTypeSelector selected={ProjectType.WEB_APP} onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByText('Mobile App'));
    expect(mockOnSelect).toHaveBeenCalledWith(ProjectType.MOBILE_APP);
  });

  it('shows description for each option', () => {
    render(<ProjectTypeSelector selected={ProjectType.WEB_APP} onSelect={mockOnSelect} />);
    expect(screen.getByText(/Browser-based application/i)).toBeInTheDocument();
    expect(screen.getByText(/Native mobile application/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npm run test -- ProjectTypeSelector.test.tsx`
Expected: FAIL - Component not found

**Step 3: Implement ProjectTypeSelector**

Create: `src/components/orchestration/ProjectTypeSelector.tsx`

```typescript
"use client"

import * as React from 'react'
import { ProjectType, PROJECT_TYPE_CONFIG } from '@/types/composition'
import { cn } from '@/lib/utils'
import { Monitor, Smartphone, Globe, Plug } from 'lucide-react'

const icons = {
  [ProjectType.WEB_APP]: Monitor,
  [ProjectType.MOBILE_APP]: Smartphone,
  [ProjectType.BOTH]: Globe,
  [ProjectType.API_ONLY]: Plug
}

interface ProjectTypeSelectorProps {
  selected: ProjectType
  onSelect: (type: ProjectType) => void
}

export function ProjectTypeSelector({ selected, onSelect }: ProjectTypeSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium mb-3">
        What type of project are you building?
      </label>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(PROJECT_TYPE_CONFIG).map(([type, config]) => {
          const projectType = type as ProjectType
          const Icon = icons[projectType]
          const isSelected = selected === projectType
          
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(projectType)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                'hover:border-primary/50 hover:bg-muted/50',
                isSelected 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border bg-card'
              )}
            >
              <Icon className={cn(
                'w-6 h-6',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )}
              <span className={cn(
                'text-sm font-medium',
                isSelected ? 'text-primary' : 'text-foreground'
              )}>
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground text-center">
                {config.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**
Run: `npm run test -- ProjectTypeSelector.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/orchestration/ProjectTypeSelector.tsx src/components/orchestration/__tests__/ProjectTypeSelector.test.tsx
git commit -m "feat: add ProjectTypeSelector component with 4 project type options"
```

---

## Phase 3: Fixed Expand/Collapse

### Task 4: Fix CompositionLayerCard Expand/Collapse

**Files:**
- Modify: `src/components/orchestration/CompositionLayerCard.tsx`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompositionLayerCard } from '@/components/orchestration/CompositionLayerCard';

const mockLayers = Array.from({ length: 6 }, (_, i) => ({
  id: `layer_${i}`,
  name: `Layer ${i + 1}`,
  description: `Description for layer ${i + 1}`
}));

describe('CompositionLayerCard Expand/Collapse', () => {
  it('shows "+2 more options" when layers exceed 4', () => {
    render(
      <CompositionLayerCard
        title="Test Layer"
        layers={mockLayers as any[]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('+2 more options')).toBeInTheDocument();
  });

  it('expands when "+more" button is clicked', () => {
    render(
      <CompositionLayerCard
        title="Test Layer"
        layers={mockLayers as any[]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    const moreButton = screen.getByText('+2 more options');
    fireEvent.click(moreButton);
    expect(screen.getByText('Layer 5')).toBeInTheDocument();
    expect(screen.getByText('Layer 6')).toBeInTheDocument();
  });

  it('toggles between expand and collapse', () => {
    render(
      <CompositionLayerCard
        title="Test Layer"
        layers={mockLayers as any[]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('+2 more options'));
    expect(screen.getByText('Show fewer options')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Show fewer options'));
    expect(screen.getByText('+2 more options')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npm run test -- CompositionLayerCardExpand.test.tsx`
Expected: FAIL - Button not clickable or text not found

**Step 3: Fix CompositionLayerCard**

Modify `src/components/orchestration/CompositionLayerCard.tsx`:

```typescript
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface LayerOption {
  id: string
  name: string
  description?: string
  strengths?: string[]
}

interface CompositionLayerCardProps {
  title: string
  description?: string
  layers: LayerOption[]
  selectedId: string | null
  onSelect: (id: string) => void
  icon?: React.ReactNode
}

export function CompositionLayerCard({
  title,
  description,
  layers,
  selectedId,
  onSelect,
  icon
}: CompositionLayerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const displayLimit = 4
  const displayLayers = expanded ? layers : layers.slice(0, displayLimit)
  const hasMore = layers.length > displayLimit

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>}
          <div className="text-left">
            <h3 className="font-semibold">{title}</h3>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Layer Options */}
      <AnimatePresence initial={false}>
        <motion.div
          initial={false}
          animate={{ height: expanded ? 'auto' : 'auto' }}
          exit={{ height: 0 }}
          className="divide-y"
        >
          {displayLayers.map((layer) => {
            const isSelected = selectedId === layer.id
            return (
              <button
                key={layer.id}
                onClick={() => onSelect(layer.id)}
                className={cn(
                  "w-full px-4 py-3 flex items-center justify-between transition-all",
                  "hover:bg-muted/50",
                  isSelected && "bg-primary/5"
                )}
              >
                <div className="text-left">
                  <p className={cn("font-medium", isSelected && "text-primary")}>
                    {layer.name}
                  </p>
                  {layer.description && (
                    <p className="text-sm text-muted-foreground">{layer.description}</p>
                  )}
                </div>
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
              </button>
            )
          })}
          
          {/* Expand/Collapse Button */}
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-2 text-sm text-primary hover:underline transition-colors"
            >
              {expanded 
                ? 'Show fewer options' 
                : `+${layers.length - displayLimit} more options`}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**
Run: `npm run test -- CompositionLayerCardExpand.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/orchestration/CompositionLayerCard.tsx src/components/orchestration/__tests__/CompositionLayerCardExpand.test.tsx
git commit -m "fix: add working expand/collapse for +N more options button"
```

---

## Phase 4: Updated CompositionBuilder

### Task 5: Redesign CompositionBuilder with Project Type

**Files:**
- Modify: `src/components/orchestration/CompositionBuilder.tsx`
- Create: `src/components/orchestration/__tests__/CompositionBuilderRedesign.test.tsx`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompositionBuilder } from '@/components/orchestration/CompositionBuilder';
import { ProjectType } from '@/types/composition';

const mockCompositionSystem = {
  version: '2.0',
  base_layers: {
    nextjs_app_router: { name: 'Next.js App Router' },
    astro: { name: 'Astro' }
  },
  mobile_addons: {
    none: { name: 'No Mobile' },
    expo_integration: { name: 'Expo' }
  },
  backend_addons: {
    integrated: { name: 'Integrated' },
    fastapi_api: { name: 'FastAPI' }
  },
  data_addons: {
    neon_postgres: { name: 'Neon Postgres' }
  },
  architecture_addons: {
    monolith: { name: 'Monolith' }
  }
};

describe('CompositionBuilder Redesign', () => {
  const mockOnComplete = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ProjectTypeSelector at top', () => {
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Web App')).toBeInTheDocument();
    expect(screen.getByText('Mobile App')).toBeInTheDocument();
    expect(screen.getByText('Both')).toBeInTheDocument();
    expect(screen.getByText('API Only')).toBeInTheDocument();
  });

  it('shows Full-Stack card as 6th option', () => {
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Full-Stack Framework')).toBeInTheDocument();
  });

  it('shows progress indicator with dynamic count', () => {
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('4/4 required layers selected')).toBeInTheDocument();
  });

  it('auto-fills Base + Backend when Full-Stack selected', async () => {
    const user = userEvent.setup();
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    await user.click(screen.getByText('Full-Stack Framework'));
    await user.click(screen.getByText('Next.js (Full-Stack)'));
    const completeButton = screen.getByRole('button', { name: /Use This Stack/i });
    expect(completeButton).not.toBeDisabled();
  });

  it('updates progress when project type changes', async () => {
    const user = userEvent.setup();
    render(
      <CompositionBuilder
        compositionSystem={mockCompositionSystem as any}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('4/4 required layers selected')).toBeInTheDocument();
    await user.click(screen.getByText('API Only'));
    expect(screen.getByText('3/3 required layers selected')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npm run test -- CompositionBuilderRedesign.test.tsx`
Expected: FAIL - Tests expect new UI

**Step 3: Implement updated CompositionBuilder**

Replace content of `src/components/orchestration/CompositionBuilder.tsx` with the full implementation from the plan document.

**Step 4: Run test to verify it passes**
Run: `npm run test -- CompositionBuilderRedesign.test.tsx`
Expected: PASS (may need minor test adjustments)

**Step 5: Commit**

```bash
git add src/components/orchestration/CompositionBuilder.tsx src/components/orchestration/__tests__/CompositionBuilderRedesign.test.tsx
git commit -m "feat: redesign CompositionBuilder with ProjectType selector, 6-card grid, and dynamic progress"
```

---

## Phase 5: Integration Tests

### Task 6: Full Flow Integration Test

**Files:**
- Create: `src/components/__tests__/composition-full-redesign-flow.test.tsx`

**Step 1: Write comprehensive integration test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StackSelection } from '@/components/orchestration/StackSelection';

// Mock API response
const mockCompositionAPIResponse = {
  success: true,
  data: {
    mode: 'compositional',
    templates: [],
    composition_system: {
      version: '2.0',
      base_layers: {
        nextjs_app_router: { name: 'Next.js App Router' },
        astro: { name: 'Astro' }
      },
      mobile_addons: {
        none: { name: 'No Mobile' },
        expo_integration: { name: 'Expo' }
      },
      backend_addons: {
        integrated: { name: 'Integrated' },
        fastapi_api: { name: 'FastAPI' }
      },
      data_addons: {
        neon_postgres: { name: 'Neon Postgres' }
      },
      architecture_addons: {
        monolith: { name: 'Monolith' },
        edge: { name: 'Edge' }
      }
    },
    technical_preferences: {}
  }
};

describe('Complete Composition Redesign Flow', () => {
  const mockOnStackSelect = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/stacks') {
          return {
            ok: true,
            json: async () => mockCompositionAPIResponse,
          } as Response;
        }
        throw new Error(`Unhandled fetch: ${url}`);
      })
    );
  });

  it('complete web app flow with full-stack selection', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await screen.findByText('Browse Templates');
    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));
    await screen.findByText('Web App'));

    // Select Full-Stack framework
    await user.click(screen.getByText('Full-Stack Framework'));
    await user.click(screen.getByText('Next.js (Full-Stack)'));

    expect(screen.getByRole('button', { name: /Use This Stack/i })).not.toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Use This Stack/i }));

    expect(mockOnStackSelect).toHaveBeenCalledTimes(1);
    const callArgs = mockOnStackSelect.mock.calls[0];
    expect(callArgs[0]).toContain('nextjs_app_router');
    expect(callArgs[0]).toContain('integrated');
  });

  it('mobile app flow skips base layer', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));
    await user.click(screen.getByText('Mobile App'));

    expect(screen.getByText('4/4 required layers selected')).toBeInTheDocument();
    expect(screen.queryByText('Base Layer')).not.toBeInTheDocument();
  });

  it('both flow requires all 5 layers', async () => {
    const user = userEvent.setup();
    render(<StackSelection onStackSelect={mockOnStackSelect} />);

    await user.click(screen.getByRole('button', { name: /Compose Custom/i }));
    await user.click(screen.getByRole('button', { name: /Both/i }));

    expect(screen.getByText('5/5 required layers selected')).toBeInTheDocument();
  });
});
```

**Step 2: Run test**
Run: `npm run test -- composition-full-redesign-flow.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/__tests__/composition-full-redesign-flow.test.tsx
git commit -m "test: add full integration test for composition redesign flow"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add ProjectType enum + constants | `src/types/composition.ts` |
| 2 | Add Full-Stack framework constants | `src/types/composition.ts` |
| 3 | Create ProjectTypeSelector component | `src/components/orchestration/ProjectTypeSelector.tsx` |
| 4 | Fix expand/collapse button | `src/components/orchestration/CompositionLayerCard.tsx` |
| 5 | Redesign CompositionBuilder | `src/components/orchestration/CompositionBuilder.tsx` |
| 6 | Integration tests | `src/components/__tests__/composition-full-redesign-flow.test.tsx` |

---
