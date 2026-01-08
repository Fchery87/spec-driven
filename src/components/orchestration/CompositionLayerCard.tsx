"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react"
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
                {isSelected ? (
                  <X className="h-5 w-5 text-primary hover:text-primary/80" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground/50" />
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
