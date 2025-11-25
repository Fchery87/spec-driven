"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, Zap, Shield, Cpu, Sparkles } from "lucide-react"

interface ArchitecturePattern {
  id: string
  name: string
  description: string
  pattern_type: string
  characteristics: {
    codebase: string
    scaling: string
    ops_complexity: string
    team_size: string
  }
  best_for: string[]
  strengths: string[]
  tradeoffs: string[]
  dau_range: string
  supports_mobile: boolean
}

interface StackSelectionProps {
  selectedStack?: string
  onStackSelect: (stackId: string, reasoning?: string) => void
  isLoading?: boolean
}

export function StackSelection({
  selectedStack,
  onStackSelect,
  isLoading = false
}: StackSelectionProps) {
  const [customStack, setCustomStack] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [reasoning, setReasoning] = useState('')

  // Define architecture patterns
  const ARCHITECTURE_PATTERNS: ArchitecturePattern[] = [
    {
      id: 'monolithic_fullstack',
      name: 'Monolithic Full-Stack',
      description: 'Single unified codebase with integrated API layer',
      pattern_type: 'Monolithic',
      characteristics: {
        codebase: 'Single unified repository',
        scaling: 'Vertical scaling, managed services',
        ops_complexity: 'Low - single deployment target',
        team_size: 'Small to medium (1-5 engineers)'
      },
      best_for: ['MVPs', 'startups', 'CRUD SaaS', 'dashboards', 'rapid iteration'],
      strengths: ['Single language ecosystem', 'unified codebase', 'fast iteration', 'integrated API layer', 'low operational overhead', 'easy debugging'],
      tradeoffs: ['Less suitable for heavy background compute', 'tightly coupled frontend/backend', 'harder to scale independent components'],
      dau_range: '<10k DAU',
      supports_mobile: false
    },
    {
      id: 'decoupled_services',
      name: 'Decoupled Services',
      description: 'Separate frontend and backend services with independent scaling',
      pattern_type: 'Microservices',
      characteristics: {
        codebase: 'Separate repositories per service',
        scaling: 'Horizontal scaling, independent service scaling',
        ops_complexity: 'Medium - multiple deployment targets',
        team_size: 'Medium to large (3-10+ engineers)'
      },
      best_for: ['AI/ML workloads', 'ETL pipelines', 'heavy compute', 'complex backend logic', 'teams with Python expertise'],
      strengths: ['Independent scaling', 'technology flexibility', 'specialized backend (Python/Go/Rust)', 'async job processing', 'better for data-heavy operations'],
      tradeoffs: ['Increased operational complexity', 'separate deployments required', 'API contract management', 'higher latency between services'],
      dau_range: '10k-100k+ DAU',
      supports_mobile: false
    }
  ]

  const patterns = ARCHITECTURE_PATTERNS

  const handleStackSelect = (stackId: string) => {
    onStackSelect(stackId, reasoning)
  }

  const handleCustomStack = () => {
    if (customStack.trim()) {
      onStackSelect('custom', reasoning)
    }
  }

  const getPatternIcon = (patternId: string) => {
    switch (patternId) {
      case 'monolithic_fullstack':
        return <Zap className="h-6 w-6 text-primary" />
      case 'decoupled_services':
        return <Cpu className="h-6 w-6 text-[hsl(var(--chart-3))]" />
      default:
        return <Shield className="h-6 w-6 text-muted-foreground" />
    }
  }

  const getPatternColor = (patternId: string) => {
    switch (patternId) {
      case 'monolithic_fullstack':
        return 'border-[hsl(var(--chart-2))]/40 bg-[hsl(var(--chart-2))]/10'
      case 'decoupled_services':
        return 'border-[hsl(var(--chart-3))]/40 bg-[hsl(var(--chart-3))]/10'
      default:
        return 'border-border bg-muted'
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Architecture Pattern Selector */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-[hsl(var(--chart-2))]" />
          Choose Your Architecture Pattern
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
          Select the architectural approach that best matches your project scale, team size, and technical requirements. Specific technology choices will be made in the next phase.
        </p>
      </div>

      {/* Architecture Pattern Options */}
      <div className="grid gap-6 lg:grid-cols-2">
        {patterns.map((pattern) => (
          <Card
            key={pattern.id}
            className={`
              cursor-pointer transition-all hover:shadow-lg
              ${selectedStack === pattern.id ? 'ring-2 ring-primary ' + getPatternColor(pattern.id) : 'hover:scale-105'}
            `}
            onClick={() => handleStackSelect(pattern.id)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getPatternIcon(pattern.id)}
                  <CardTitle className="text-xl">{pattern.name}</CardTitle>
                </div>
                {selectedStack === pattern.id && (
                  <CheckCircle2 className="h-6 w-6 text-[hsl(var(--chart-4))]" />
                )}
              </div>
              <CardDescription className="text-base">
                {pattern.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Best For */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Best For:</h4>
                <div className="flex flex-wrap gap-1">
                  {pattern.best_for.map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Characteristics */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Architecture Characteristics:</h4>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div><strong>Codebase:</strong> {pattern.characteristics.codebase}</div>
                  <div><strong>Scaling:</strong> {pattern.characteristics.scaling}</div>
                  <div><strong>Ops Complexity:</strong> {pattern.characteristics.ops_complexity}</div>
                  <div><strong>Team Size:</strong> {pattern.characteristics.team_size}</div>
                  <div><strong>Scale Range:</strong> {pattern.dau_range}</div>
                </div>
              </div>

              {/* Strengths */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Strengths:</h4>
                <ul className="text-sm space-y-1">
                  {pattern.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 text-[hsl(var(--chart-4))] mt-0.5 flex-shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tradeoffs */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Trade-offs:</h4>
                <ul className="text-sm space-y-1">
                  {pattern.tradeoffs.map((tradeoff, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 text-[hsl(var(--chart-3))] mt-0.5 flex-shrink-0" />
                      {tradeoff}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Custom Pattern Option */}
      <Card className="border-dashed border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-muted-foreground" />
            Custom Architecture
          </CardTitle>
          <CardDescription>
            Define your own architecture pattern if the predefined options don&apos;t match your needs.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!showCustom ? (
            <Button
              variant="outline"
              onClick={() => setShowCustom(true)}
              className="w-full"
            >
              Define Custom Architecture
            </Button>
          ) : (
            <div className="space-y-4">
              <Input
                placeholder="Describe your custom architecture pattern (e.g., Custom monolithic with message queues, specialized microservices)"
                value={customStack}
                onChange={(e) => setCustomStack(e.target.value)}
                className="w-full"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleCustomStack}
                  disabled={!customStack.trim() || isLoading}
                  className="flex-1"
                >
                  Use Custom Architecture
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCustom(false)
                    setCustomStack('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reasoning Input */}
      {(selectedStack || showCustom) && (
        <Card>
          <CardHeader>
            <CardTitle>Why did you choose this architecture?</CardTitle>
            <CardDescription>
              Help us understand your reasoning so we can recommend the best specific technologies for your needs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full p-3 border rounded-md resize-none h-24"
              placeholder="e.g., We chose monolithic because our team is small and we want fast iteration. We can scale later when needed..."
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
            />

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (selectedStack) {
                    handleStackSelect(selectedStack)
                  } else if (showCustom) {
                    handleCustomStack()
                  }
                }}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Confirming...' : 'Confirm Architecture Choice'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onStackSelect('')
                  setReasoning('')
                  setShowCustom(false)
                  setCustomStack('')
                }}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selection Summary */}
      {selectedStack && !showCustom && (
        <Card className="bg-[hsl(var(--chart-4))]/10 border border-[hsl(var(--chart-4))]/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-[hsl(var(--chart-4))]">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--chart-4))]" />
              <span className="font-semibold">
                Selected: {patterns.find(p => p.id === selectedStack)?.name} architecture
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
