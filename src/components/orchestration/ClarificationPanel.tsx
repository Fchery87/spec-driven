"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  HelpCircle, 
  Bot, 
  User, 
  CheckCircle2, 
  Sparkles,
  AlertCircle,
  ChevronRight,
  RotateCcw
} from "lucide-react"

export interface ClarificationQuestion {
  id: string
  category: string
  question: string
  context?: string
  suggestedOptions?: string[]
  userAnswer?: string
  aiAssumed?: {
    assumption: string
    rationale: string
  }
  resolved: boolean
  resolvedBy: 'user' | 'ai' | null
}

export type ClarificationMode = 'interactive' | 'hybrid' | 'auto_resolve'

interface ClarificationPanelProps {
  projectSlug: string
  questions: ClarificationQuestion[]
  mode: ClarificationMode
  onModeChange: (mode: ClarificationMode) => void
  onAnswerQuestion: (questionId: string, answer: string) => void
  onAutoResolve: (questionId: string) => void
  onAutoResolveAll: () => void
  onSubmit: () => void
  onSkip: () => void
  isSubmitting?: boolean
  isAutoResolving?: boolean
}

const modeDescriptions: Record<ClarificationMode, { title: string; description: string; icon: React.ReactNode }> = {
  interactive: {
    title: "Interactive",
    description: "Answer all questions manually for maximum precision",
    icon: <User className="h-4 w-4" />
  },
  hybrid: {
    title: "Hybrid",
    description: "Pick which to answer, AI resolves the rest",
    icon: <Sparkles className="h-4 w-4" />
  },
  auto_resolve: {
    title: "Auto-resolve",
    description: "AI makes reasonable assumptions for all questions",
    icon: <Bot className="h-4 w-4" />
  }
}

export function ClarificationPanel({
  questions,
  mode,
  onModeChange,
  onAnswerQuestion,
  onAutoResolve,
  onAutoResolveAll,
  onSubmit,
  onSkip,
  isSubmitting = false,
  isAutoResolving = false,
}: ClarificationPanelProps) {
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  
  const unresolvedCount = questions.filter(q => !q.resolved).length
  const userAnsweredCount = questions.filter(q => q.resolvedBy === 'user').length
  const aiResolvedCount = questions.filter(q => q.resolvedBy === 'ai').length
  
  const canSubmit = mode === 'auto_resolve' || unresolvedCount === 0
  const allResolved = unresolvedCount === 0

  return (
    <Card className="w-full max-w-3xl mx-auto border-primary/20 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Clarification Required</CardTitle>
              <CardDescription>
                {unresolvedCount} question{unresolvedCount !== 1 ? 's' : ''} need{unresolvedCount === 1 ? 's' : ''} resolution
              </CardDescription>
            </div>
          </div>
          <Badge variant={allResolved ? "default" : "secondary"} className="text-xs">
            {allResolved ? "Ready to proceed" : `${unresolvedCount} pending`}
          </Badge>
        </div>

        {/* Mode Selector */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(Object.keys(modeDescriptions) as ClarificationMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`
                p-3 rounded-lg border text-left transition-all
                ${mode === m 
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/20' 
                  : 'border-border hover:border-primary/40 hover:bg-muted/50'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                {modeDescriptions[m].icon}
                <span className="font-medium text-sm">{modeDescriptions[m].title}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {modeDescriptions[m].description}
              </p>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress Summary */}
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span>{userAnsweredCount} answered</span>
          </div>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-amber-500" />
            <span>{aiResolvedCount} AI assumed</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span>{unresolvedCount} pending</span>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index + 1}
              mode={mode}
              isExpanded={expandedQuestion === question.id}
              onToggleExpand={() => setExpandedQuestion(
                expandedQuestion === question.id ? null : question.id
              )}
              onAnswer={(answer) => onAnswerQuestion(question.id, answer)}
              onAutoResolve={() => onAutoResolve(question.id)}
              isAutoResolving={isAutoResolving}
            />
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 pt-4 border-t">
        {/* Auto-resolve all button */}
        {mode !== 'interactive' && unresolvedCount > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={onAutoResolveAll}
            disabled={isAutoResolving}
          >
            {isAutoResolving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                Auto-resolving...
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                Auto-resolve All Remaining ({unresolvedCount})
              </>
            )}
          </Button>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 w-full">
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isSubmitting}
            className="flex-1"
          >
            Skip Clarification
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                Processing...
              </>
            ) : (
              <>
                Continue to Next Step
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>

        {!canSubmit && mode === 'interactive' && (
          <p className="text-xs text-muted-foreground text-center">
            Please answer all questions or switch to Hybrid/Auto-resolve mode
          </p>
        )}
      </CardFooter>
    </Card>
  )
}

interface QuestionCardProps {
  question: ClarificationQuestion
  index: number
  mode: ClarificationMode
  isExpanded: boolean
  onToggleExpand: () => void
  onAnswer: (answer: string) => void
  onAutoResolve: () => void
  isAutoResolving: boolean
}

function QuestionCard({
  question,
  index,
  mode,
  isExpanded,
  onToggleExpand,
  onAnswer,
  onAutoResolve,
  isAutoResolving,
}: QuestionCardProps) {
  const [inputValue, setInputValue] = useState(question.userAnswer || '')

  const handleSubmitAnswer = () => {
    if (inputValue.trim()) {
      onAnswer(inputValue.trim())
    }
  }

  const getStatusBadge = () => {
    if (!question.resolved) {
      return <Badge variant="outline" className="text-xs">Pending</Badge>
    }
    if (question.resolvedBy === 'user') {
      return <Badge className="text-xs bg-primary/20 text-primary border-0">Answered</Badge>
    }
    return <Badge className="text-xs bg-amber-500/20 text-amber-600 border-0">AI Assumed</Badge>
  }

  return (
    <div
      className={`
        rounded-lg border transition-all
        ${question.resolved 
          ? 'border-border/50 bg-muted/30' 
          : 'border-primary/30 bg-card'
        }
      `}
    >
      {/* Question Header */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 text-left flex items-start gap-3"
      >
        <div className={`
          w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0
          ${question.resolved 
            ? 'bg-muted text-muted-foreground' 
            : 'bg-primary/10 text-primary'
          }
        `}>
          {question.resolved ? <CheckCircle2 className="h-4 w-4" /> : index}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {question.category}
            </Badge>
            {getStatusBadge()}
          </div>
          <p className="text-sm font-medium">{question.question}</p>
          
          {/* Show resolved answer in collapsed state */}
          {question.resolved && !isExpanded && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {question.resolvedBy === 'user' 
                ? `Answer: ${question.userAnswer}`
                : `AI Assumed: ${question.aiAssumed?.assumption}`
              }
            </p>
          )}
        </div>

        <ChevronRight className={`
          h-4 w-4 text-muted-foreground transition-transform flex-shrink-0
          ${isExpanded ? 'rotate-90' : ''}
        `} />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 space-y-3">
          {question.context && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              {question.context}
            </p>
          )}

          {/* Resolved State */}
          {question.resolved ? (
            <div className="space-y-2">
              {question.resolvedBy === 'user' && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-primary mb-1">
                    <User className="h-3 w-3" />
                    Your Answer
                  </div>
                  <p className="text-sm">{question.userAnswer}</p>
                </div>
              )}
              {question.resolvedBy === 'ai' && question.aiAssumed && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-amber-600 mb-1">
                    <Bot className="h-3 w-3" />
                    AI Assumption
                  </div>
                  <p className="text-sm font-medium">{question.aiAssumed.assumption}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rationale: {question.aiAssumed.rationale}
                  </p>
                </div>
              )}
              
              {/* Reset button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => onAnswer('')}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset Answer
              </Button>
            </div>
          ) : (
            /* Input State */
            <div className="space-y-3">
              {/* Suggested Options */}
              {question.suggestedOptions && question.suggestedOptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {question.suggestedOptions.map((option) => (
                    <Button
                      key={option}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setInputValue(option)
                        onAnswer(option)
                      }}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}

              {/* Custom Input */}
              <div className="space-y-2">
                <Label htmlFor={`answer-${question.id}`} className="text-xs">
                  Or provide your own answer:
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`answer-${question.id}`}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your answer..."
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmitAnswer()
                      }
                    }}
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSubmitAnswer}
                    disabled={!inputValue.trim()}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Auto-resolve option */}
              {mode !== 'interactive' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                  onClick={onAutoResolve}
                  disabled={isAutoResolving}
                >
                  <Bot className="h-3 w-3 mr-1" />
                  Let AI decide this one
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
