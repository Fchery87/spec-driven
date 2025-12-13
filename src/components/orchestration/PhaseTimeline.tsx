"use client"

import { CheckCircle2, Circle, Play, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

interface Phase {
  name: string
  status: 'completed' | 'current' | 'pending' | 'blocked'
  blockedReason?: string
}

interface PhaseTimelineProps {
  phases: Phase[]
  currentPhase: string
  onPhaseClick?: (phase: string) => void
}

export function PhaseTimeline({ phases, currentPhase, onPhaseClick }: PhaseTimelineProps) {
  const getPhaseIcon = (status: Phase['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5" />
      case 'current':
        return <Play className="h-4 w-4" />
      case 'blocked':
        return <Lock className="h-4 w-4" />
      default:
        return <Circle className="h-5 w-5" />
    }
  }

  const getShortName = (name: string) => {
    const shortNames: Record<string, string> = {
      'ANALYSIS': 'Analysis',
      'STACK_SELECTION': 'Stack',
      'SPEC': 'Spec',
      'DEPENDENCIES': 'Deps',
      'SOLUTIONING': 'Solution',
      'DONE': 'Done'
    }
    return shortNames[name] || name
  }

  const currentIndex = phases.findIndex(p => p.name === currentPhase)

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <div className="flex items-center justify-between">
        {phases.map((phase, index) => (
          <div key={phase.name} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => (phase.status === 'completed' || phase.status === 'current') && onPhaseClick?.(phase.name)}
              disabled={phase.status === 'pending' || phase.status === 'blocked'}
              className={cn(
                "flex flex-col items-center gap-2 group transition-all",
                (phase.status === 'completed' || phase.status === 'current') && "cursor-pointer",
                (phase.status === 'pending' || phase.status === 'blocked') && "cursor-default opacity-60"
              )}
            >
              <div
                className={cn(
                  "phase-dot",
                  phase.status === 'completed' && "phase-dot-completed",
                  phase.status === 'current' && "phase-dot-current",
                  phase.status === 'pending' && "phase-dot-pending",
                  phase.status === 'blocked' && "phase-dot-blocked",
                  (phase.status === 'completed' || phase.status === 'current') && "group-hover:scale-110"
                )}
              >
                {getPhaseIcon(phase.status)}
              </div>
              <div className="text-center">
                <span className={cn(
                  "text-xs font-medium",
                  phase.status === 'current' && "text-primary",
                  phase.status === 'completed' && "text-emerald-600 dark:text-emerald-400",
                  phase.status === 'pending' && "text-muted-foreground",
                  phase.status === 'blocked' && "text-destructive"
                )}>
                  {getShortName(phase.name)}
                </span>
                {phase.status === 'blocked' && phase.blockedReason && (
                  <p className="text-[10px] text-destructive/80 max-w-16 truncate">
                    {phase.blockedReason}
                  </p>
                )}
              </div>
            </button>

            {index < phases.length - 1 && (
              <div
                className={cn(
                  "phase-connector",
                  index < currentIndex ? "phase-connector-completed" : "phase-connector-pending"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
