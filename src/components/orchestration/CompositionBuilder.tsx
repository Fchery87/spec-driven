"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CompositionLayerCard } from "./CompositionLayerCard"
import { CompositionPreviewCard } from "./CompositionPreviewCard"
import { ProjectTypeSelector } from "./ProjectTypeSelector"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Layers, Smartphone, Server, Database, Globe, Sparkles, CheckCircle2 } from "lucide-react"
import { StackComposition, CompositionSystem, ProjectType, getRequiredLayerCount, PROJECT_TYPE_CONFIG } from "@/types/composition"

interface LayerDefinition {
  id: string
  name: string
  description?: string
  composition?: Record<string, string>
  strengths?: string[]
  tradeoffs?: string[]
  type?: string
}

interface CompositionBuilderProps {
  compositionSystem: CompositionSystem
  onComplete: (composition: StackComposition, resolvedStack: any) => void
  isLoading?: boolean
}

export function CompositionBuilder({
  compositionSystem,
  onComplete,
  isLoading = false
}: CompositionBuilderProps) {
  const [projectType, setProjectType] = useState<ProjectType>(ProjectType.WEB_APP)
  const [selection, setSelection] = useState<{
    base: string | null
    mobile: string | null
    backend: string | null
    data: string | null
    architecture: string | null
  }>({
    base: null,
    mobile: null,
    backend: null,
    data: null,
    architecture: null
  })

  const requiredLayerCount = getRequiredLayerCount(projectType)
  const completedCount = Object.values(selection).filter(v => v !== null).length
  const isComplete = completedCount >= requiredLayerCount

  const layers = useMemo(() => [
    {
      key: 'base' as const,
      title: 'Base Layer',
      description: 'Choose your frontend framework',
      layers: Object.entries(compositionSystem.base_layers).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description
      })),
      icon: <Layers className="h-5 w-5" />,
      required: true,
      showFor: [ProjectType.WEB_APP, ProjectType.BOTH, ProjectType.API_ONLY]
    },
    {
      key: 'mobile' as const,
      title: 'Mobile',
      description: 'Add native mobile (optional)',
      layers: Object.entries(compositionSystem.mobile_addons).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description
      })),
      icon: <Smartphone className="h-5 w-5" />,
      required: projectType === ProjectType.BOTH || projectType === ProjectType.MOBILE_APP,
      showFor: [ProjectType.WEB_APP, ProjectType.MOBILE_APP, ProjectType.BOTH]
    },
    {
      key: 'backend' as const,
      title: 'Backend',
      description: 'Choose backend approach',
      layers: Object.entries(compositionSystem.backend_addons).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description
      })),
      icon: <Server className="h-5 w-5" />,
      required: true,
      showFor: [ProjectType.WEB_APP, ProjectType.MOBILE_APP, ProjectType.BOTH, ProjectType.API_ONLY]
    },
    {
      key: 'data' as const,
      title: 'Data',
      description: 'Select database & storage',
      layers: Object.entries(compositionSystem.data_addons).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description
      })),
      icon: <Database className="h-5 w-5" />,
      required: true,
      showFor: [ProjectType.WEB_APP, ProjectType.MOBILE_APP, ProjectType.BOTH, ProjectType.API_ONLY]
    },
    {
      key: 'architecture' as const,
      title: 'Architecture',
      description: 'Deployment pattern',
      layers: Object.entries(compositionSystem.architecture_addons).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description
      })),
      icon: <Globe className="h-5 w-5" />,
      required: true,
      showFor: [ProjectType.WEB_APP, ProjectType.MOBILE_APP, ProjectType.BOTH, ProjectType.API_ONLY]
    }
  ], [compositionSystem, projectType])

  // Full-stack frameworks
  const fullStackLayers = useMemo(() => [
    {
      key: 'fullstack' as const,
      title: 'Full-Stack Framework',
      description: 'Frontend + Built-in Backend',
      layers: [
        { id: 'nextjs_fullstack', name: 'Next.js (Full-Stack)' },
        { id: 'remix_fullstack', name: 'Remix (Full-Stack)' },
        { id: 'sveltekit_fullstack', name: 'SvelteKit (Full-Stack)' },
        { id: 'nuxt_fullstack', name: 'Nuxt (Full-Stack)' },
        { id: 'django_fullstack', name: 'Django (Full-Stack)' },
        { id: 'laravel_fullstack', name: 'Laravel (Full-Stack)' },
        { id: 'tanstack_start', name: 'TanStack Start (Full-Stack)' }
      ],
      icon: <Sparkles className="h-5 w-5" />,
      required: false,
      showFor: [ProjectType.WEB_APP, ProjectType.BOTH]
    }
  ], [])

  const previewComposition = useMemo(() => {
    const getLayer = (key: keyof typeof selection, collection: Record<string, any>) => {
      const id = selection[key]
      if (!id) return { name: '', composition: {} }
      const layer = collection[id]
      return layer ? { name: layer.name, composition: layer.composition || {}, strengths: layer.strengths || [] } : { name: '', composition: {} }
    }

    return {
      base: getLayer('base', compositionSystem.base_layers),
      mobile: getLayer('mobile', compositionSystem.mobile_addons),
      backend: getLayer('backend', compositionSystem.backend_addons),
      data: getLayer('data', compositionSystem.data_addons),
      architecture: getLayer('architecture', compositionSystem.architecture_addons)
    }
  }, [selection, compositionSystem])

  const handleSelect = (key: keyof typeof selection, id: string) => {
    // If already selected, deselect it (toggle behavior)
    if (selection[key] === id) {
      setSelection(prev => ({ ...prev, [key]: null }))
    } else {
      setSelection(prev => ({ ...prev, [key]: id }))
    }
  }

  const handleComplete = () => {
    if (isComplete) {
      onComplete(
        {
          base: selection.base || 'none',
          mobile: selection.mobile || 'none',
          backend: selection.backend || 'none',
          data: selection.data || 'none',
          architecture: selection.architecture || 'monolith'
        },
        previewComposition
      )
    }
  }

  // Filter layers based on project type
  const visibleLayers = layers.filter(l => l.showFor.includes(projectType))
  const visibleFullStackLayers = fullStackLayers.filter(l => l.showFor.includes(projectType))

  return (
    <div className="space-y-6">
      {/* Project Type Selector */}
      <ProjectTypeSelector
        selected={projectType}
        onSelect={setProjectType}
      />

      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Compose Your Stack
          </h2>
          <p className="text-muted-foreground text-sm">
            Select your technology stack for this {PROJECT_TYPE_CONFIG[projectType].label.toLowerCase()}
          </p>
        </div>
        <Badge variant={isComplete ? "default" : "outline"} className="flex items-center gap-1">
          {isComplete ? <CheckCircle2 className="h-3 w-3" /> : null}
          {completedCount}/{requiredLayerCount} required layers selected
        </Badge>
      </div>

      {/* Layer Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleLayers.map((layer) => (
          <CompositionLayerCard
            key={layer.key}
            title={layer.title}
            description={layer.description}
            layers={layer.layers}
            selectedId={selection[layer.key as keyof typeof selection]}
            onSelect={(id) => handleSelect(layer.key, id)}
            icon={layer.icon}
          />
        ))}
        
        {/* Full-Stack Card */}
        {visibleFullStackLayers.map((layer) => (
          <CompositionLayerCard
            key={layer.key}
            title={layer.title}
            description={layer.description}
            layers={layer.layers}
            selectedId={null}
            onSelect={(id) => {
              if (id === 'nextjs_fullstack') {
                handleSelect('base', 'nextjs_app_router')
                handleSelect('backend', 'integrated')
              } else if (id === 'remix_fullstack') {
                handleSelect('base', 'remix')
                handleSelect('backend', 'integrated')
              } else if (id === 'sveltekit_fullstack') {
                handleSelect('base', 'sveltekit')
                handleSelect('backend', 'integrated')
              } else if (id === 'nuxt_fullstack') {
                handleSelect('base', 'vue_nuxt')
                handleSelect('backend', 'integrated')
              } else if (id === 'django_fullstack') {
                handleSelect('base', 'django')
                handleSelect('backend', 'integrated')
              } else if (id === 'laravel_fullstack') {
                handleSelect('base', 'laravel')
                handleSelect('backend', 'integrated')
              } else if (id === 'tanstack_start') {
                handleSelect('base', 'tanstack_start')
                handleSelect('backend', 'integrated')
              }
            }}
            icon={layer.icon}
          />
        ))}
      </div>

      {/* Preview Section */}
      <AnimatePresence>
        {completedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="border-t pt-6"
          >
            <CompositionPreviewCard
              composition={previewComposition as any}
              isComplete={isComplete}
            />

            {isComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 flex justify-end"
              >
                <Button
                  size="lg"
                  onClick={handleComplete}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {isLoading ? 'Creating Stack...' : 'Use This Stack'}
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
