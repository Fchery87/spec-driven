"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, AlertCircle, Globe, Shield, Smartphone, Layers, Sparkles, Server, Loader2 } from "lucide-react"

interface StackTemplate {
  id: string
  name: string
  description: string
  composition: {
    frontend?: string
    mobile?: string
    backend?: string
    database?: string
    deployment?: string
    pattern?: string
    examples?: string
  }
  best_for: string[]
  strengths: string[]
  tradeoffs: string[]
  scaling: string
}

interface TechnicalPreferences {
  state_management?: string
  data_fetching?: string
  forms?: string
  validation?: string
  http_client?: string
  testing?: string
  e2e_testing?: string
  animation?: string
}

interface StackSelectionProps {
  selectedStack?: string
  onStackSelect: (stackId: string, reasoning?: string, preferences?: TechnicalPreferences) => void
  isLoading?: boolean
}

export function StackSelection({
  selectedStack,
  onStackSelect,
  isLoading = false
}: StackSelectionProps) {
  const [templates, setTemplates] = useState<StackTemplate[]>([])
  const [preferenceOptions, setPreferenceOptions] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customStack, setCustomStack] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [reasoning, setReasoning] = useState('')
  const [preferences, setPreferences] = useState<TechnicalPreferences>({})
  
  // Two-step selection: pendingStack is what user clicked, selectedStack is what's confirmed
  const [pendingStack, setPendingStack] = useState<string | null>(null)

  // Fetch stack templates from API
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch('/api/stacks')
        const data = await response.json()
        if (data.success) {
          setTemplates(data.data.templates)
          setPreferenceOptions(data.data.technical_preferences || {})
        } else {
          setError('Failed to load stack templates')
        }
      } catch {
        setError('Failed to fetch stack templates')
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  // Step 1: User clicks a card - only highlights it (no submission)
  const handleStackClick = (stackId: string) => {
    setPendingStack(stackId)
    setShowCustom(false) // Clear custom mode if selecting a template
  }

  // Step 2: User confirms their selection - NOW we submit
  const confirmStackSelection = () => {
    if (pendingStack) {
      onStackSelect(pendingStack, reasoning, preferences)
    }
  }

  const handleCustomStack = () => {
    if (customStack.trim()) {
      onStackSelect('custom', reasoning, preferences)
    }
  }

  const clearSelection = () => {
    setPendingStack(null)
    setReasoning('')
    setPreferences({})
    setShowCustom(false)
    setCustomStack('')
  }

  const getStackIcon = (stackId: string) => {
    if (stackId.includes('mobile') || stackId.includes('expo') || stackId.includes('flutter') || stackId.includes('native')) {
      return <Smartphone className="h-6 w-6 text-violet-500" />
    }
    if (stackId.includes('api') || stackId.includes('serverless') || stackId.includes('edge')) {
      return <Layers className="h-6 w-6 text-cyan-500" />
    }
    if (stackId.includes('go') || stackId.includes('django') || stackId.includes('fastapi')) {
      return <Server className="h-6 w-6 text-orange-500" />
    }
    return <Globe className="h-6 w-6 text-primary" />
  }

  const getStackColor = (stackId: string) => {
    if (stackId.includes('mobile') || stackId.includes('expo') || stackId.includes('flutter') || stackId.includes('native')) {
      return 'border-violet-500/40 bg-violet-500/10'
    }
    if (stackId.includes('api') || stackId.includes('serverless') || stackId.includes('edge')) {
      return 'border-cyan-500/40 bg-cyan-500/10'
    }
    if (stackId.includes('go') || stackId.includes('django') || stackId.includes('fastapi')) {
      return 'border-orange-500/40 bg-orange-500/10'
    }
    return 'border-primary/40 bg-primary/10'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading stack templates...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-[hsl(var(--chart-2))]" />
          Choose Your Technology Stack
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
          Select from {templates.length} predefined stack templates or define a fully custom stack.
          Each template is optimized for specific use cases.
        </p>
        <Badge variant="outline" className="text-sm">
          Hybrid Mode: Architect proposes, you approve or customize
        </Badge>
      </div>

      {/* Stack Template Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const isSelected = pendingStack === template.id
          return (
          <Card
            key={template.id}
            className={`
              cursor-pointer transition-all hover:shadow-lg
              ${isSelected ? 'ring-2 ring-primary ' + getStackColor(template.id) : 'hover:scale-[1.02]'}
            `}
            onClick={() => handleStackClick(template.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStackIcon(template.id)}
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </div>
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
              </div>
              <CardDescription className="text-sm line-clamp-2">
                {template.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Composition */}
              {template.composition && (
                <div>
                  <h4 className="font-semibold text-xs mb-1.5 text-muted-foreground uppercase">Stack</h4>
                  <div className="flex flex-wrap gap-1">
                    {template.composition.frontend && (
                      <Badge variant="secondary" className="text-xs">{template.composition.frontend}</Badge>
                    )}
                    {template.composition.backend && (
                      <Badge variant="secondary" className="text-xs">{template.composition.backend}</Badge>
                    )}
                    {template.composition.database && (
                      <Badge variant="secondary" className="text-xs">{template.composition.database}</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Best For */}
              <div>
                <h4 className="font-semibold text-xs mb-1.5 text-muted-foreground uppercase">Best For</h4>
                <div className="flex flex-wrap gap-1">
                  {template.best_for.slice(0, 3).map((item) => (
                    <Badge key={item} className="text-xs bg-muted text-muted-foreground hover:bg-muted">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Strengths */}
              <div>
                <h4 className="font-semibold text-xs mb-1.5 text-muted-foreground uppercase">Strengths</h4>
                <ul className="text-xs space-y-0.5">
                  {template.strengths.slice(0, 3).map((strength, index) => (
                    <li key={index} className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-1">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tradeoffs */}
              {template.tradeoffs.length > 0 && (
                <div>
                  <h4 className="font-semibold text-xs mb-1.5 text-muted-foreground uppercase">Trade-offs</h4>
                  <ul className="text-xs space-y-0.5">
                    {template.tradeoffs.slice(0, 2).map((tradeoff, index) => (
                      <li key={index} className="flex items-start gap-1.5">
                        <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{tradeoff}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Scaling */}
              {template.scaling && (
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">{template.scaling}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )})}
      </div>

      {/* Custom Stack Option */}
      <Card className="border-dashed border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-muted-foreground" />
            Custom Stack
          </CardTitle>
          <CardDescription>
            Define your own technology stack if the predefined templates don&apos;t match your needs.
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
                placeholder="Describe your custom stack (e.g., SvelteKit + Go API + Turso SQLite + Fly.io)"
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

      {/* Technical Preferences */}
      {(pendingStack || showCustom) && Object.keys(preferenceOptions).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Technical Preferences (Optional)</CardTitle>
            <CardDescription>
              Customize library choices for your project. Leave blank to use defaults.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(preferenceOptions).map(([key, options]) => (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium capitalize">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <Select
                    value={preferences[key as keyof TechnicalPreferences] || ''}
                    onValueChange={(value) => setPreferences(prev => ({ ...prev, [key]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Default" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Selection Panel */}
      {(pendingStack || showCustom) && (
        <Card className="border-2 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Confirm Your Selection
            </CardTitle>
            <CardDescription>
              You selected: <strong>{pendingStack ? templates.find(t => t.id === pendingStack)?.name : 'Custom Stack'}</strong>. 
              Add optional reasoning and click confirm when ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Why did you choose this stack? (Optional)</label>
              <textarea
                className="w-full p-3 border rounded-md resize-none h-24"
                placeholder="e.g., We need fast iteration for our MVP. The unified TypeScript codebase helps our small team move quickly..."
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (pendingStack) {
                    confirmStackSelection()
                  } else if (showCustom) {
                    handleCustomStack()
                  }
                }}
                disabled={isLoading || (!pendingStack && !customStack.trim())}
                className="flex-1"
                size="lg"
              >
                {isLoading ? 'Confirming...' : 'Confirm Stack Choice'}
              </Button>
              <Button
                variant="outline"
                onClick={clearSelection}
                size="lg"
              >
                Change Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already Approved Notice */}
      {selectedStack && (
        <Card className="bg-emerald-500/10 border border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">
                Stack Approved: {templates.find(t => t.id === selectedStack)?.name || selectedStack}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
