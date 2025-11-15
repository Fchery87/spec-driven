"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, Zap, Shield, Cpu, Sparkles } from "lucide-react"

interface Stack {
  id: string
  name: string
  description: string
  composition: {
    frontend: string
    mobile: string
    backend: string
    database: string
    deployment: string
  }
  best_for: string[]
  strengths: string[]
  tradeoffs: string[]
  scaling: string
}

interface StackSelectionProps {
  stacks: Stack[]
  selectedStack?: string
  onStackSelect: (stackId: string, reasoning?: string) => void
  isLoading?: boolean
}

export function StackSelection({ 
  stacks, 
  selectedStack, 
  onStackSelect, 
  isLoading = false 
}: StackSelectionProps) {
  const [customStack, setCustomStack] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [reasoning, setReasoning] = useState('')

  const handleStackSelect = (stackId: string) => {
    onStackSelect(stackId, reasoning)
  }

  const handleCustomStack = () => {
    if (customStack.trim()) {
      onStackSelect('custom', reasoning)
    }
  }

  const getStackIcon = (stackId: string) => {
    switch (stackId) {
      case 'nextjs_only_expo':
        return <Zap className="h-6 w-6 text-blue-600" />
      case 'hybrid_nextjs_fastapi_expo':
        return <Cpu className="h-6 w-6 text-violet-600" />
      default:
        return <Shield className="h-6 w-6 text-slate-600" />
    }
  }

  const getStackColor = (stackId: string) => {
    switch (stackId) {
      case 'nextjs_only_expo':
        return 'border-blue-200 bg-blue-50'
      case 'hybrid_nextjs_fastapi_expo':
        return 'border-violet-200 bg-violet-50'
      default:
        return 'border-slate-200 bg-slate-50'
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-violet-600" />
          Choose Your Technology Stack
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Select the technology stack that best fits your project requirements.
          This choice will guide the entire specification and implementation process.
        </p>
      </div>

      {/* Stack Options */}
      <div className="grid gap-6 lg:grid-cols-2">
        {stacks.map((stack) => (
          <Card 
            key={stack.id}
            className={`
              cursor-pointer transition-all hover:shadow-lg
              ${selectedStack === stack.id ? 'ring-2 ring-blue-500 ' + getStackColor(stack.id) : 'hover:scale-105'}
            `}
            onClick={() => handleStackSelect(stack.id)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStackIcon(stack.id)}
                  <CardTitle className="text-xl">{stack.name}</CardTitle>
                </div>
                {selectedStack === stack.id && (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                )}
              </div>
              <CardDescription className="text-base">
                {stack.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Best For */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Best For:</h4>
                <div className="flex flex-wrap gap-1">
                  {stack.best_for.map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Composition */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Technology Composition:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Frontend:</strong> {stack.composition.frontend}</div>
                  <div><strong>Mobile:</strong> {stack.composition.mobile}</div>
                  <div><strong>Backend:</strong> {stack.composition.backend}</div>
                  <div><strong>Database:</strong> {stack.composition.database}</div>
                  <div className="col-span-2"><strong>Deployment:</strong> {stack.composition.deployment}</div>
                </div>
              </div>

              {/* Strengths */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Strengths:</h4>
                <ul className="text-sm space-y-1">
                  {stack.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tradeoffs */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Trade-offs:</h4>
                <ul className="text-sm space-y-1">
                  {stack.tradeoffs.map((tradeoff, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                      {tradeoff}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Scaling */}
              <div className="text-sm">
                <strong>Scaling:</strong> {stack.scaling}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Custom Stack Option */}
      <Card className="border-dashed border-slate-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-slate-600" />
            Custom Stack
          </CardTitle>
          <CardDescription>
            Define your own technology stack if the predefined options don't fit your needs.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!showCustom ? (
            <Button 
              variant="outline" 
              onClick={() => setShowCustom(true)}
              className="w-full"
            >
              Define Custom Stack
            </Button>
          ) : (
            <div className="space-y-4">
              <Input
                placeholder="Describe your custom stack (e.g., React + Node.js + MongoDB + AWS)"
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
                  Use Custom Stack
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
            <CardTitle>Why did you choose this stack?</CardTitle>
            <CardDescription>
              Help us understand your reasoning to better tailor the specifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full p-3 border rounded-md resize-none h-24"
              placeholder="e.g., I chose this because our team has extensive experience with TypeScript and we want fast iteration for our MVP..."
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
                {isLoading ? 'Confirming...' : 'Confirm Stack Choice'}
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
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">
                Selected: {stacks.find(s => s.id === selectedStack)?.name}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}