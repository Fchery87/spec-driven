"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Layers, Smartphone, Server, Database, Globe } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface LayerDetail {
  name: string
  description?: string
  composition?: Record<string, string>
  strengths?: string[]
  tradeoffs?: string[]
  type?: string
}

interface CompositionPreviewCardProps {
  composition: {
    base: LayerDetail
    mobile: LayerDetail
    backend: LayerDetail
    data: LayerDetail
    architecture: LayerDetail
  }
  isComplete?: boolean
}

const getLayerIcon = (type?: string) => {
  switch (type) {
    case 'mobile_platform':
      return <Smartphone className="h-4 w-4 text-violet-500" />
    case 'backend_service':
      return <Server className="h-4 w-4 text-cyan-500" />
    case 'database':
      return <Database className="h-4 w-4 text-emerald-500" />
    case 'architecture':
      return <Globe className="h-4 w-4 text-amber-500" />
    default:
      return <Layers className="h-4 w-4 text-primary" />
  }
}

export function CompositionPreviewCard({
  composition,
  isComplete = false
}: CompositionPreviewCardProps) {
  const allLayers = [
    { key: 'base', label: 'Base', icon: <Layers className="h-4 w-4" />, data: composition.base },
    { key: 'mobile', label: 'Mobile', icon: <Smartphone className="h-4 w-4" />, data: composition.mobile },
    { key: 'backend', label: 'Backend', icon: <Server className="h-4 w-4" />, data: composition.backend },
    { key: 'data', label: 'Data', icon: <Database className="h-4 w-4" />, data: composition.data },
    { key: 'architecture', label: 'Architecture', icon: <Globe className="h-4 w-4" />, data: composition.architecture },
  ]

  return (
    <Card className={cn(
      "transition-all",
      isComplete && "ring-2 ring-primary/50 bg-primary/5"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {isComplete && <CheckCircle2 className="h-5 w-5 text-primary" />}
          Your Stack Composition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Layer Pills */}
        <div className="flex flex-wrap gap-2">
          {allLayers.map(({ key, label, icon, data }) => (
            <Badge
              key={key}
              variant={data.name ? "default" : "outline"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1",
                !data.name && "opacity-50"
              )}
            >
              {icon}
              {label}
            </Badge>
          ))}
        </div>

        {/* Composition Details */}
        <div className="grid gap-3">
          {allLayers.map(({ key, label, icon, data }) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                data.name ? "bg-muted/50" : "bg-muted/20 border border-dashed"
              )}
            >
              {icon}
              <div className="flex-1">
                <p className="font-medium">{data.name || `Select ${label}`}</p>
                {data.composition && Object.values(data.composition).some(v => v && v !== 'None') && (
                  <p className="text-sm text-muted-foreground">
                    {Object.entries(data.composition)
                      .filter(([, v]) => v && v !== 'None')
                      .map(([, v]) => v)
                      .join(' + ')}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Strengths Section */}
        <div className="pt-2 border-t">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Strengths</h4>
          <div className="flex flex-wrap gap-1.5">
            {allLayers
              .flatMap(({ data }) => data.strengths || [])
              .slice(0, 5)
              .map((strength, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {strength}
                </Badge>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
