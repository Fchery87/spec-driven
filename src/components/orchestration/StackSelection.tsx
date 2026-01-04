"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, AlertCircle, Sparkles, Shield, Loader2 } from "lucide-react"
import { StackRecommendationView } from "./StackRecommendationView"
import { StackCard, StackTemplate } from "./StackCard"
import { CompositionBuilder } from "./CompositionBuilder"

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
  analysisContent?: string
  classificationContent?: string
}

export function StackSelection({
  selectedStack,
  onStackSelect,
  isLoading = false,
  analysisContent,
  classificationContent
}: StackSelectionProps) {
  const [templates, setTemplates] = useState<StackTemplate[]>([])
  const [preferenceOptions, setPreferenceOptions] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Custom stack state
  const [customStack, setCustomStack] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  
  // Selection state
  const [pendingStack, setPendingStack] = useState<string | null>(null)
  const [reasoning, setReasoning] = useState('')
  const [preferences, setPreferences] = useState<TechnicalPreferences>({})
  
  // View state: 'recommendation' | 'browse' | 'compose'
  const [viewMode, setViewMode] = useState<'recommendation' | 'browse' | 'compose'>('recommendation')

  // Composition system state
  const [compositionSystem, setCompositionSystem] = useState<any>(null)
  
  // Fetch stack templates from API
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch('/api/stacks')
        const data = await response.json()
        if (data.success) {
          setTemplates(data.data.templates)
          setPreferenceOptions(data.data.technical_preferences || {})
          if (data.data.composition_system) {
            setCompositionSystem(data.data.composition_system)
          }
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

  // Switch to browse mode if no analysis content is available
  useEffect(() => {
    if (!loading && !analysisContent) {
      setViewMode('browse')
    }
  }, [loading, analysisContent])

  const handleStackClick = (stackId: string) => {
    if (stackId === 'custom') {
      setShowCustom(true)
      setPendingStack(null)
    } else {
      setPendingStack(stackId)
      setShowCustom(false)
    }
  }

  const confirmStackSelection = () => {
    if (pendingStack) {
      onStackSelect(pendingStack, reasoning, preferences)
    }
  }

  const handleCustomStackSubmit = () => {
    if (customStack.trim()) {
      onStackSelect('custom', reasoning, preferences)
    }
  }

  const clearSelection = () => {
    setPendingStack(null)
    setReasoning('')
    setPreferences({})
    setShowCustom(false)
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

  const showRecommendationView = viewMode === 'recommendation' && analysisContent

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-[hsl(var(--chart-2))]" />
          Choose Your Technology Stack
        </h2>
        <div className="flex items-center justify-center gap-2 text-sm">
          {analysisContent && (
             <Button
               variant={viewMode === 'recommendation' ? "secondary" : "ghost"}
               onClick={() => setViewMode('recommendation')}
               size="sm"
             >
               AI Recommendations
             </Button>
          )}
          <Button
            variant={viewMode === 'browse' ? "secondary" : "ghost"}
            onClick={() => setViewMode('browse')}
            size="sm"
          >
            Browse All Templates
          </Button>
          <Button
            variant={viewMode === 'compose' ? "secondary" : "ghost"}
            onClick={() => setViewMode('compose')}
            size="sm"
            disabled={!compositionSystem}
          >
            Compose Custom
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'compose' ? (
        compositionSystem && (
          <CompositionBuilder
            compositionSystem={compositionSystem}
            onComplete={(composition, resolvedStack) => {
              const stackId = `${composition.base}+${composition.mobile}+${composition.backend}+${composition.data}+${composition.architecture}`
              onStackSelect(stackId, `Composed stack: ${composition.base} + ${composition.mobile}`, preferences)
            }}
            isLoading={isLoading}
          />
        )
      ) : showRecommendationView ? (
        <StackRecommendationView
          stackAnalysisContent={analysisContent!}
          classificationContent={classificationContent}
          templates={templates}
          onSelect={handleStackClick}
          selectedStackId={pendingStack}
          isLoading={isLoading}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <StackCard
              key={template.id}
              template={template}
              isSelected={pendingStack === template.id}
              onSelect={handleStackClick}
            />
          ))}
        </div>
      )}

      {/* Custom Stack Option (Visible in Browse Mode or if selected) */}
      {(viewMode === 'browse' || showCustom) && (
        <Card className={`border-dashed border-border ${showCustom ? 'ring-2 ring-primary' : ''}`}>
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
                    onClick={handleCustomStackSubmit}
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
                      setPendingStack(null) // clear logic
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Technical Preferences - Only show if pendingStack OR showCustom */}
      {(pendingStack || showCustom) && Object.keys(preferenceOptions).length > 0 && (
        <Card className="animate-in slide-in-from-bottom-5 fade-in duration-300">
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
        <Card className="border-2 border-primary/50 bg-primary/5 sticky bottom-4 shadow-lg z-10 animate-in slide-in-from-bottom-10 fade-in duration-500">
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
                className="w-full p-3 border rounded-md resize-none h-24 bg-background"
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
                    handleCustomStackSubmit()
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
