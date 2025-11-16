"use client"

import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Circle, AlertCircle, Play, ChevronRight, Lock, FileCheck, Clock, Eye } from "lucide-react"

interface Phase {
  name: string
  description: string
  status: 'completed' | 'current' | 'pending' | 'blocked'
  duration?: number
  artifacts?: {
    required: string[]
    generated: string[]
    complete: boolean
  }
  blockedReason?: string
  gateName?: string
}

interface PhaseStepperProps {
  phases: Phase[]
  currentPhase: string
  onPhaseClick?: (phase: string) => void
  canAdvance?: boolean
  onAdvance?: () => void
  canExecute?: boolean
  onExecute?: () => void
  executeLabel?: string
  executing?: boolean
}

export function PhaseStepper({
  phases,
  currentPhase,
  onPhaseClick,
  canAdvance = false,
  onAdvance,
  canExecute = false,
  onExecute,
  executeLabel,
  executing = false,
}: PhaseStepperProps) {
  const getPhaseIcon = (status: Phase['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-[hsl(var(--chart-4))]" />
      case 'current':
        return <Play className="h-5 w-5 text-primary" />
      case 'blocked':
        return <AlertCircle className="h-5 w-5 text-destructive" />
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getPhaseColor = (status: Phase['status']) => {
    switch (status) {
      case 'completed':
        return 'border border-[hsl(var(--chart-4))]/30 bg-[hsl(var(--chart-4))]/10'
      case 'current':
        return 'border border-primary/40 bg-primary/10'
      case 'blocked':
        return 'border border-destructive/30 bg-destructive/10'
      default:
        return 'border-border bg-muted'
    }
  }

  const getCurrentPhaseIndex = () => {
    return phases.findIndex(p => p.name === currentPhase)
  }

  const isPhaseClickable = (phase: Phase, index: number) => {
    // Can click completed phases or current phase
    return phase.status === 'completed' || phase.status === 'current'
  }

  const completedCount = phases.filter((phase) => phase.status === "completed").length
  const blockedCount = phases.filter((phase) => phase.status === "blocked").length
  const currentData = phases.find((phase) => phase.name === currentPhase)

  return (
    <div className="w-full max-w-4xl mx-auto lg:sticky lg:top-24">
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-4))]" /> Completed {completedCount}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" /> Current {currentPhase}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-destructive" /> Blocked {blockedCount}
        </div>
        <div className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
          {Math.round((completedCount / phases.length) * 100)}% complete
        </div>
      </div>

      {/* Phase Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {phases.map((phase, index) => {
            const currentIndex = getCurrentPhaseIndex()
            const isActive = index <= currentIndex
            const isCompleted = phase.status === 'completed'
            
            return (
              <div key={phase.name} className="flex items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full border-2 flex items-center justify-center
                    ${isActive
                      ? isCompleted
                        ? 'bg-[hsl(var(--chart-4))] border-[hsl(var(--chart-4))] text-background'
                        : 'bg-primary border-primary text-primary-foreground'
                      : 'bg-muted border-border text-muted-foreground'
                    }
                  `}
                >
                  {getPhaseIcon(phase.status)}
                </div>

                {index < phases.length - 1 && (
                  <div
                    className={`
                      w-16 h-1 mx-2
                      ${index < currentIndex ? 'bg-[hsl(var(--chart-4))]' : 'bg-muted'}
                    `}
                  />
                )}
              </div>
            )
          })}
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground">
          {phases.map((phase) => (
            <div key={phase.name} className="text-center max-w-20">
              <div className="font-medium truncate">{phase.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {phases.map((phase, index) => (
          <Card 
            key={phase.name}
            className={`
              cursor-pointer transition-all hover:shadow-md
              ${getPhaseColor(phase.status)}
              ${isPhaseClickable(phase, index) ? 'hover:scale-105' : 'opacity-75'}
            `}
            onClick={() => isPhaseClickable(phase, index) && onPhaseClick?.(phase.name)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{phase.name}</CardTitle>
                {getPhaseIcon(phase.status)}
              </div>
              <CardDescription className="text-sm">
                {phase.description}
              </CardDescription>
              {phase.status === "blocked" && phase.blockedReason && (
                <p className="text-xs text-destructive">
                  Waiting on {phase.blockedReason}
                </p>
              )}
            </CardHeader>
            
            <CardContent className="pt-0">
              {/* Status */}
              <div className="flex items-center gap-2 mb-3">
                <div className="text-sm font-medium capitalize text-muted-foreground">
                  {phase.status === 'blocked' ? 'Blocked' : phase.status}
                </div>
                {phase.status === 'completed' && (
                  <Badge variant="secondary" className="text-[11px]">Artifacts ready</Badge>
                )}
              </div>

              {/* Artifacts Progress */}
              {phase.artifacts && phase.artifacts.required.length > 0 && (
                <div className="mb-3 p-2 bg-muted rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Artifacts: {phase.artifacts.generated.length}/{phase.artifacts.required.length}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        phase.artifacts.complete ? 'bg-[hsl(var(--chart-4))]' : 'bg-primary'
                      }`}
                      style={{
                        width: `${(phase.artifacts.generated.length / phase.artifacts.required.length) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Blocked Reason */}
              {phase.blockedReason && (
                <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2">
                  <Lock className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-destructive">
                    <div className="font-semibold">{phase.gateName}</div>
                    <div className="text-destructive">{phase.blockedReason}</div>
                  </div>
                </div>
              )}

              {/* Duration */}
              {phase.duration && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {phase.duration} minutes
                </div>
              )}

              {/* Execute & Advance Buttons */}
              <div className="mt-3">
                <div className="flex flex-col gap-2">
                  {phase.name === currentPhase && phase.status === 'current' && canExecute && onExecute && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onExecute()
                      }}
                      className="w-full flex items-center justify-center gap-2"
                      disabled={executing}
                    >
                      {executing && (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-transparent" />
                      )}
                      {executing ? "Executing..." : executeLabel ?? `Execute ${phase.name} Phase`}
                    </Button>
                  )}
                  {phase.name === currentPhase && phase.status === 'current' && canAdvance && onAdvance && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAdvance()
                      }}
                      className="w-full flex items-center justify-center gap-1"
                    >
                      Advance to Next Phase
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                  {phase.status === 'blocked' && (
                    <Button
                      size="sm"
                      disabled
                      variant="outline"
                      className="w-full flex items-center justify-center gap-1"
                    >
                      <Lock className="h-4 w-4" />
                      Phase Blocked
                    </Button>
                  )}
                  {phase.status === 'completed' && phase.artifacts && phase.artifacts.generated.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full flex items-center justify-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPhaseClick?.(phase.name)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      View Artifacts
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current Phase Details */}
      <div className="mt-8">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Current Phase: {currentPhase}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const currentPhaseData = phases.find(p => p.name === currentPhase)
              return currentPhaseData?.description || 'No current phase selected'
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
