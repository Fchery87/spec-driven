"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { StackCard, StackTemplate } from "./StackCard"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles, Shield, AlertTriangle } from "lucide-react"

interface StackRecommendationViewProps {
  stackAnalysisContent: string
  classificationContent?: string
  templates: StackTemplate[]
  onSelect: (stackId: string) => void
  selectedStackId?: string | null
  isLoading?: boolean
}

interface ParsedAnalysis {
  primaryId: string | null
  primaryScore: number | null
  alternatives: { id: string; score: number | null }[]
  classification: Record<string, string>
}

// Helper to parse markdown content
function parseAnalysis(content: string, classificationContent?: string): ParsedAnalysis {
  const result: ParsedAnalysis = {
    primaryId: null,
    primaryScore: null,
    alternatives: [],
    classification: {}
  }

  // Parse Classification
  if (classificationContent) {
    try {
      result.classification = JSON.parse(classificationContent)
    } catch {
      // Fallback: try to regex from markdown if passed as MD or if JSON parse fails
    }
  }

  // Parse Primary Recommendation
  const primaryMatch = content.match(/###\s*🏆\s*Primary Recommendation:\s*(\w+)/i)
  if (primaryMatch) {
    result.primaryId = primaryMatch[1]
  }

  // Parse Primary Score
  const primaryScoreMatch = content.match(/\*\*Score:\s*(\d+)\/100\*\*/i)
  if (primaryScoreMatch) {
    result.primaryScore = parseInt(primaryScoreMatch[1], 10)
  }

  // Parse Alternatives
  const alt1Match = content.match(/###\s*🥈\s*Alternative 1:\s*(\w+)/i)
  const alt1ScoreMatch = content.match(/###\s*🥈.*?Score:\s*(\d+)\/100/is)
  
  if (alt1Match) {
    result.alternatives.push({
      id: alt1Match[1],
      score: alt1ScoreMatch ? parseInt(alt1ScoreMatch[1], 10) : null
    })
  }

  const alt2Match = content.match(/###\s*🥉\s*Alternative 2:\s*(\w+|CUSTOM)/i)
  const alt2ScoreMatch = content.match(/###\s*🥉.*?Score:\s*(\d+)\/100/is)
  
  if (alt2Match && alt2Match[1] !== 'CUSTOM') {
    result.alternatives.push({
      id: alt2Match[1],
      score: alt2ScoreMatch ? parseInt(alt2ScoreMatch[1], 10) : null
    })
  }

  return result
}

export function StackRecommendationView({
  stackAnalysisContent,
  classificationContent,
  templates,
  onSelect,
  selectedStackId,
  isLoading
}: StackRecommendationViewProps) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  
  const analysis = useMemo(() => 
    parseAnalysis(stackAnalysisContent, classificationContent), 
    [stackAnalysisContent, classificationContent]
  )

  const primaryTemplate = templates.find(t => t.id === analysis.primaryId)
  const alternativeTemplates = analysis.alternatives
    .map(alt => ({ template: templates.find(t => t.id === alt.id), score: alt.score }))
    .filter(item => item.template !== undefined) as { template: StackTemplate, score: number | null }[]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* AI Insight Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-4">
        <div className="p-2 bg-primary/10 rounded-full mt-1">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-primary">AI Stack Recommendation</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Based on your requirements, we&apos;ve analyzed {templates.length} templates. 
            The <strong>{primaryTemplate?.name}</strong> stack is the best fit for your 
            {analysis.classification?.project_type?.replace('_', ' ') || 'project'}.
          </p>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Primary Recommendation */}
        {primaryTemplate ? (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Primary Recommendation
              </h3>
              <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                {analysis.primaryScore ? `${analysis.primaryScore}% Match` : 'Best Match'}
              </span>
            </div>
            
            <StackCard 
              template={primaryTemplate}
              score={analysis.primaryScore || undefined}
              isPrimary={true}
              isSelected={selectedStackId === primaryTemplate.id}
              onSelect={onSelect}
              disabled={isLoading}
            />
          </section>
        ) : (
          <div className="p-8 border-2 border-dashed rounded-lg flex flex-col items-center text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mb-4 text-amber-500" />
            <p className="font-medium">Could not parse primary recommendation.</p>
            <p className="text-sm">Please select a stack manually below.</p>
          </div>
        )}

        {/* Alternatives Section */}
        {alternativeTemplates.length > 0 && (
          <section className="space-y-4">
            <Button 
              variant="ghost" 
              className="w-full flex justify-between items-center group"
              onClick={() => setShowAlternatives(!showAlternatives)}
            >
              <span className="font-medium text-lg">Consider Alternatives</span>
              {showAlternatives ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
            
            <AnimatePresence>
              {showAlternatives && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid md:grid-cols-2 gap-4 py-2">
                    {alternativeTemplates.map(({ template, score }) => (
                      <StackCard 
                        key={template.id}
                        template={template}
                        score={score || undefined}
                        isSelected={selectedStackId === template.id}
                        onSelect={onSelect}
                        disabled={isLoading}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Custom Stack Fallback */}
        <section className="border-t pt-8">
           <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  Need something else?
                </h3>
                <p className="text-sm text-muted-foreground">
                  You can build a custom stack if none of the recommendations fit.
                </p>
              </div>
              <Button 
                variant="outline"
                onClick={() => onSelect('custom')}
                className={selectedStackId === 'custom' ? 'border-primary ring-1 ring-primary' : ''}
              >
                Build Custom Stack
              </Button>
           </div>
        </section>
      </div>
    </div>
  )
}
