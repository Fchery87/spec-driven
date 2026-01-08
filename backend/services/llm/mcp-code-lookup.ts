/**
 * MCP Code Lookup Utility
 * 
 * This module provides utilities for fetching accurate code patterns
 * from MCP (Model Context Protocol) tools during spec generation.
 * 
 * Available MCP Tools:
 * - exa-code: Search code libraries, SDKs, and APIs
 * - context7: Query library documentation
 * 
 * Usage in LLM prompts:
 * The AI agent should call these MCP tools directly when generating
 * frontend components to ensure accurate, production-ready code.
 */

export interface MCPCodeResult {
  code: string;
  source: string;
  url?: string;
  description?: string;
}

export interface MCPQuery {
  query: string;
  library?: string;
  language?: string;
  maxResults?: number;
  description?: string;
}

// Predefined code patterns that can be fetched via MCP
export const SHADCN_UI_PATTERNS: Record<string, MCPQuery> = {
  button: {
    query: "shadcn/ui button component TypeScript React cva variants",
    library: "shadcn/ui",
    description: "Standard button component with variants"
  },
  input: {
    query: "shadcn/ui input component React TypeScript form input",
    library: "shadcn/ui",
    description: "Form input component"
  },
  card: {
    query: "shadcn/ui card component React TypeScript container",
    library: "shadcn/ui",
    description: "Card/container component"
  },
  dialog: {
    query: "shadcn/ui dialog component React TypeScript modal",
    library: "shadcn/ui",
    description: "Modal dialog component"
  },
  select: {
    query: "shadcn/ui select component React TypeScript dropdown",
    library: "shadcn/ui",
    description: "Dropdown select component"
  },
  form: {
    query: "shadcn/ui form React Hook Form zod integration",
    library: "shadcn/ui",
    description: "Form with React Hook Form integration"
  },
  toast: {
    query: "shadcn/ui toast component React TypeScript notification",
    library: "shadcn/ui",
    description: "Toast notification component"
  },
  tabs: {
    query: "shadcn/ui tabs component React TypeScript navigation",
    library: "shadcn/ui",
    description: "Tab navigation component"
  },
  dropdown: {
    query: "shadcn/ui dropdown-menu component React TypeScript",
    library: "shadcn/ui",
    description: "Dropdown menu component"
  },
  badge: {
    query: "shadcn/ui badge component React TypeScript label",
    library: "shadcn/ui",
    description: "Badge/label component"
  }
};

export const FRAMER_MOTION_PATTERNS: Record<string, MCPQuery> = {
  fadeInUp: {
    query: "framer-motion fadeInUp animation React TypeScript",
    library: "framer-motion",
    description: "Fade in up animation"
  },
  scaleIn: {
    query: "framer-motion scaleIn animation React TypeScript",
    library: "framer-motion",
    description: "Scale in animation"
  },
  useReducedMotion: {
    query: "framer-motion useReducedMotion React hook accessibility",
    library: "framer-motion",
    description: "Reduced motion hook"
  },
  spring: {
    query: "framer-motion spring animation React TypeScript config",
    library: "framer-motion",
    description: "Spring animation config"
  }
};

export const DRIZZLE_PATTERNS: Record<string, MCPQuery> = {
  schema: {
    query: "drizzle ORM schema TypeScript PostgreSQL tables",
    library: "drizzle-orm",
    description: "Database schema definition"
  },
  queries: {
    query: "drizzle ORM select insert update queries",
    library: "drizzle-orm",
    description: "Database queries"
  },
  migrations: {
    query: "drizzle-kit migrations PostgreSQL setup",
    library: "drizzle-kit",
    description: "Database migrations"
  }
};

/**
 * Get MCP query for a component type
 */
export function getMCPCodePattern(componentType: string): MCPQuery | null {
  const normalized = componentType.toLowerCase().replace(/[^a-z]/g, '');
  
  // Check shadcn/ui patterns
  for (const [key, pattern] of Object.entries(SHADCN_UI_PATTERNS)) {
    if (normalized.includes(key)) {
      return pattern;
    }
  }
  
  return null;
}

/**
 * Format MCP query for LLM prompt injection
 */
export function formatMCPContext(componentType: string): string {
  const pattern = getMCPCodePattern(componentType);
  
  if (!pattern) {
    return '';
  }
  
  return `
## MCP Code Lookup Reference
Use the following MCP tool to fetch accurate code:

**Query**: "${pattern.query}"
**Library**: ${pattern.library}

When generating the ${componentType} component:
1. Call MCP tool (exa-code or context7) to fetch real ${pattern.library} ${componentType} code
2. Use the fetched code as reference for:
   - Component structure and imports
   - TypeScript interfaces
   - cva variants pattern
   - Accessibility attributes
3. Adapt the fetched code to match your design tokens
4. Ensure all imports use @/lib/utils style aliases
`;
}

/**
 * Available MCP tools documentation for LLM prompts
 */
export const MCP_TOOLS_DOC = `
## Available MCP Tools

### exa-code (Code Search)
Search across millions of code repositories for production-ready examples.

**Capabilities:**
- Find real-world usage patterns
- Search by file type, library, and language
- Get context around code snippets

**Example Usage:**
\`\`\`
Search for: "shadcn/ui button component React TypeScript cva"
Filter: language:typescript, maxResults:3
\`\`\`

### context7 (Documentation Query)
Query specific library documentation with structured responses.

**Capabilities:**
- Get official documentation for libraries
- Query API references
- Find implementation examples

**Example Usage:**
\`\`\`
Query: "How to use framer-motion useReducedMotion hook?"
Library: framer-motion
\`\`\`

### web-search (Web Lookup)
Find recent code patterns and examples from the web.

**Capabilities:**
- Search for recent tutorials
- Find community examples
- Get updated patterns

**Example Usage:**
\`\`\`
Query: "shadcn/ui latest button component patterns 2024"
Type: keyword
\`\`\`

## Best Practices for MCP Code Lookups

1. **Always verify** - MCP-fetched code should be verified against your design tokens
2. **Adapt, don't copy** - Modify patterns to match your project's conventions
3. **Check dependencies** - Ensure fetched code uses compatible package versions
4. **Test accessibility** - Verify ARIA attributes and keyboard navigation
`;
