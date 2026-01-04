"use client"

import { useState } from "react"
import { motion } from "framer-motion"
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
  const [expanded, setExpanded] = useState(true)
  const displayLayers = layers.slice(0, 4)
  const hasMore = layers.length > 4

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
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Layer Options */}
      {expanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: "auto" }}
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
          
          {hasMore && (
            <button className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-primary transition-colors">
              +{layers.length - 4} more options
            </button>
          )}
        </motion.div>
      )}
    </div>
  )
}
