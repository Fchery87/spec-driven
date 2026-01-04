"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CompositionLayerCard } from "./CompositionLayerCard"
import { CompositionPreviewCard } from "./CompositionPreviewCard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Layers, Smartphone, Server, Database, Globe, Sparkles, CheckCircle2 } from "lucide-react"
import { StackComposition } from "@/types/composition"

interface LayerDefinition {
  id: string
  name: string
  description?: string
  composition?: Record<string, string>
  strengths?: string[]
  tradeoffs?: string[]
  type?: string
}

interface CompositionSystem {
  version: string
  base_layers: Record<string, LayerDefinition>
  mobile_addons: Record<string, LayerDefinition>
  backend_addons: Record<string, LayerDefinition>
  data_addons: Record<string, LayerDefinition>
  architecture_addons: Record<string, LayerDefinition>
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

  const isComplete = Object.values(selection).every(v => v !== null)

  const layers = useMemo(() => [
    {
      key: 'base' as const,
      title: 'Base Layer',
      description: 'Choose your frontend framework',
      layers: Object.entries(compositionSystem.base_layers).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description,
        strengths: layer.strengths
      })),
      icon: <Layers className="h-5 w-5" />
    },
    {
      key: 'mobile' as const,
      title: 'Mobile',
      description: 'Add native mobile (optional)',
      layers: Object.entries(compositionSystem.mobile_addons).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description,
        strengths: layer.strengths
      })),
      icon: <Smartphone className="h-5 w-5" />
    },
    {
      key: 'backend' as const,
      title: 'Backend',
      description: 'Choose backend approach',
      layers: Object.entries(compositionSystem.backend_addons).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description,
        strengths: layer.strengths
      })),
      icon: <Server className="h-5 w-5" />
    },
    {
      key: 'data' as const,
      title: 'Data',
      description: 'Select database & storage',
      layers: Object.entries(compositionSystem.data_addons).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description,
        strengths: layer.strengths
      })),
      icon: <Database className="h-5 w-5" />
    },
    {
      key: 'architecture' as const,
      title: 'Architecture',
      description: 'Deployment pattern',
      layers: Object.entries(compositionSystem.architecture_addons).map(([id, layer]) => ({
        id,
        name: layer.name,
        description: layer.description,
        strengths: layer.strengths
      })),
      icon: <Globe className="h-5 w-5" />
    }
  ], [compositionSystem])

  const previewComposition = useMemo(() => {
    const getLayer = (key: keyof typeof selection, collection: Record<string, LayerDefinition>) => {
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
    setSelection(prev => ({ ...prev, [key]: id }))
  }

  const handleComplete = () => {
    if (isComplete) {
      onComplete(
        {
          base: selection.base!,
          mobile: selection.mobile!,
          backend: selection.backend!,
          data: selection.data!,
          architecture: selection.architecture!
        },
        previewComposition
      )
    }
  }

  const completedCount = Object.values(selection).filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Compose Your Stack
          </h2>
          <p className="text-muted-foreground text-sm">
            Build your perfect stack by selecting each layer
          </p>
        </div>
        <Badge variant={isComplete ? "default" : "outline"} className="flex items-center gap-1">
          {isComplete ? <CheckCircle2 className="h-3 w-3" /> : null}
          {completedCount}/5 Layers Selected
        </Badge>
      </div>

      {/* Layer Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {layers.map((layer) => (
          <CompositionLayerCard
            key={layer.key}
            title={layer.title}
            description={layer.description}
            layers={layer.layers}
            selectedId={selection[layer.key]}
            onSelect={(id) => handleSelect(layer.key, id)}
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
