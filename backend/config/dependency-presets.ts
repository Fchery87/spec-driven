export interface FeaturePreset {
  deps: string[];
  triggerKeywords: string[];
}

export interface TemplatePreset {
  core: Record<string, string>;
  pythonDeps?: Record<string, string>;
  devDependencies?: Record<string, string>;
  features: Record<string, FeaturePreset>;
}

const createEmptyPreset = (): TemplatePreset => ({
  core: {},
  devDependencies: {},
  features: {},
});

export const DEPENDENCY_PRESETS: Record<string, TemplatePreset> = {
  nextjs_web_app: createEmptyPreset(),
  hybrid_nextjs_fastapi: { ...createEmptyPreset(), pythonDeps: {} },
};

export function detectFeaturesFromPRD(prdContent: string, templateId: string): string[] {
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
