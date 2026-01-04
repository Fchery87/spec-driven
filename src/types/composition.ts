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
