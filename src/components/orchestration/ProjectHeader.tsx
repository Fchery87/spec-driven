"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Clock, Layers } from "lucide-react"

interface ProjectHeaderProps {
  name: string
  slug: string
  description?: string | null
  currentPhase: string
  completedCount: number
  totalPhases: number
  stackChoice?: string | null
  createdAt: string
  onBack: () => void
  onEditDescription?: () => void
}

export function ProjectHeader({
  name,
  description,
  currentPhase,
  completedCount,
  totalPhases,
  stackChoice,
  createdAt,
  onBack,
  onEditDescription,
}: ProjectHeaderProps) {
  const progress = Math.round((completedCount / totalPhases) * 100)
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <div className="gradient-header dark:gradient-header-dark rounded-2xl p-6 mb-6 border border-border/50">
      <div className="flex items-start justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-semibold">
            {currentPhase}
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">{progress}%</span>
        </div>
      </div>

      <div className="mb-4">
        <h1 className="text-3xl font-bold text-foreground mb-1">{name}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm max-w-2xl line-clamp-2">{description}</p>
        ) : (
          <button
            onClick={onEditDescription}
            className="text-muted-foreground/60 text-sm hover:text-muted-foreground transition-colors"
          >
            + Add project description
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completedCount} of {totalPhases} phases
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {stackChoice && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/60 border border-border/50">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{stackChoice.replace(/_/g, ' ')}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/60 border border-border/50">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{formattedDate}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/60 border border-border/50">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">~2h estimated</span>
        </div>
      </div>
    </div>
  )
}
