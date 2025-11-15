"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle, AlertCircle, Play, ChevronRight, Lock, FileCheck, Clock } from "lucide-react"

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
}

export function PhaseStepper({ 
  phases, 
  currentPhase, 
  onPhaseClick, 
  canAdvance = false, 
  onAdvance 
}: PhaseStepperProps) {
  const getPhaseIcon = (status: Phase['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      case 'current':
        return <Play className="h-5 w-5 text-blue-600" />
      case 'blocked':
        return <AlertCircle className="h-5 w-5 text-amber-600" />
      default:
        return <Circle className="h-5 w-5 text-slate-400" />
    }
  }

  const getPhaseColor = (status: Phase['status']) => {
    switch (status) {
      case 'completed':
        return 'border-emerald-200 bg-emerald-50'
      case 'current':
        return 'border-blue-200 bg-blue-50'
      case 'blocked':
        return 'border-amber-200 bg-amber-50'
      default:
        return 'border-slate-200 bg-slate-50'
    }
  }

  const getCurrentPhaseIndex = () => {
    return phases.findIndex(p => p.name === currentPhase)
  }

  const isPhaseClickable = (phase: Phase, index: number) => {
    // Can click completed phases or current phase
    return phase.status === 'completed' || phase.status === 'current'
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
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
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-200 border-slate-300 text-slate-500'
                    }
                  `}
                >
                  {getPhaseIcon(phase.status)}
                </div>

                {index < phases.length - 1 && (
                  <div
                    className={`
                      w-16 h-1 mx-2
                      ${index < currentIndex ? 'bg-emerald-600' : 'bg-slate-300'}
                    `}
                  />
                )}
              </div>
            )
          })}
        </div>
        
        <div className="flex justify-between text-xs text-slate-600">
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
            </CardHeader>
            
            <CardContent className="pt-0">
              {/* Status */}
              <div className="flex items-center gap-2 mb-3">
                <div className="text-sm font-medium capitalize text-slate-700">
                  {phase.status === 'blocked' ? 'Blocked' : phase.status}
                </div>
              </div>

              {/* Artifacts Progress */}
              {phase.artifacts && phase.artifacts.required.length > 0 && (
                <div className="mb-3 p-2 bg-slate-100 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <FileCheck className="h-4 w-4 text-slate-600" />
                    <span className="text-xs font-medium text-slate-700">
                      Artifacts: {phase.artifacts.generated.length}/{phase.artifacts.required.length}
                    </span>
                  </div>
                  <div className="w-full bg-slate-300 rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        phase.artifacts.complete ? 'bg-emerald-500' : 'bg-blue-500'
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
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded flex items-start gap-2">
                  <Lock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <div className="font-semibold">{phase.gateName}</div>
                    <div className="text-amber-700">{phase.blockedReason}</div>
                  </div>
                </div>
              )}

              {/* Duration */}
              {phase.duration && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  {phase.duration} minutes
                </div>
              )}

              {/* Advance Button */}
              <div className="mt-3">
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
              <Play className="h-5 w-5 text-blue-600 fill-blue-100" />
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