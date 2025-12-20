"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, Smartphone, Layers, Globe, Server, ArrowRight, Star } from "lucide-react"

export interface StackTemplate {
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

interface StackCardProps {
  template: StackTemplate
  score?: number
  isPrimary?: boolean
  isSelected?: boolean
  onSelect: (id: string) => void
  disabled?: boolean
}

export function StackCard({
  template,
  score,
  isPrimary = false,
  isSelected = false,
  onSelect,
  disabled = false
}: StackCardProps) {
  
  const getStackIcon = (stackId: string) => {
    if (stackId.includes('mobile') || stackId.includes('expo') || stackId.includes('flutter') || stackId.includes('native')) {
      return <Smartphone className={`h-6 w-6 ${isPrimary ? 'text-primary-foreground' : 'text-violet-500'}`} />
    }
    if (stackId.includes('api') || stackId.includes('serverless') || stackId.includes('edge')) {
      return <Layers className={`h-6 w-6 ${isPrimary ? 'text-primary-foreground' : 'text-cyan-500'}`} />
    }
    if (stackId.includes('go') || stackId.includes('django') || stackId.includes('fastapi')) {
      return <Server className={`h-6 w-6 ${isPrimary ? 'text-primary-foreground' : 'text-orange-500'}`} />
    }
    return <Globe className={`h-6 w-6 ${isPrimary ? 'text-primary-foreground' : 'text-primary'}`} />
  }

  return (
    <Card 
      className={`
        relative transition-all duration-200 overflow-hidden
        ${isPrimary ? 'border-primary ring-2 ring-primary/20 shadow-xl scale-[1.01]' : 'hover:border-primary/50 hover:shadow-md'}
        ${isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}
        ${disabled ? 'opacity-60 grayscale pointer-events-none' : 'cursor-pointer'}
      `}
      onClick={() => !disabled && onSelect(template.id)}
    >
      {isPrimary && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-bl-lg flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          Recommended
        </div>
      )}

      {score !== undefined && (
        <div className={`
          absolute top-0 ${isPrimary ? 'left-0' : 'right-0'} px-3 py-1 text-xs font-bold rounded-br-lg
          ${isPrimary ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground rounded-bl-lg rounded-br-none'}
        `}>
          {score}/100 Match
        </div>
      )}

      <CardHeader className="pb-3 pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            {getStackIcon(template.id)}
          </div>
          <div>
            <CardTitle className="text-lg">{template.name}</CardTitle>
            <CardDescription className="line-clamp-1">{template.description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Composition Tags */}
        <div className="flex flex-wrap gap-1.5">
          {template.composition.frontend && <Badge variant="secondary" className="text-xs">{template.composition.frontend}</Badge>}
          {template.composition.backend && <Badge variant="secondary" className="text-xs">{template.composition.backend}</Badge>}
          {template.composition.database && <Badge variant="secondary" className="text-xs">{template.composition.database}</Badge>}
        </div>

        {/* Best For */}
        {template.best_for.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Best For</h4>
            <div className="flex flex-wrap gap-1">
              {template.best_for.slice(0, 3).map((item, i) => (
                <Badge key={i} className="text-xs bg-muted text-muted-foreground hover:bg-muted">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Strengths */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Strengths</h4>
          <ul className="space-y-1">
            {template.strengths.slice(0, 3).map((strength, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="leading-tight">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tradeoffs (only if selected or primary to save space, or if critical) */}
        {(isSelected || isPrimary) && template.tradeoffs.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Considerations</h4>
            <ul className="space-y-1">
              {template.tradeoffs.slice(0, 2).map((tradeoff, i) => (
                <li key={i} className="text-sm flex items-start gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="leading-tight">{tradeoff}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button 
          variant={isSelected ? "default" : isPrimary ? "default" : "outline"} 
          className="w-full mt-2 group"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(template.id)
          }}
        >
          {isSelected ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Selected
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Select Stack
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
