"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, RefreshCw, Eye } from "lucide-react"

interface DependenciesReviewProps {
  architecture: string
  dependenciesSummary?: {
    total_packages: number
    production_deps: number
    dev_deps: number
    vulnerabilities: number
    license_types: string[]
  }
  onApprove: () => Promise<void>
  onRegenerate: () => Promise<void>
  onViewDetails: () => void
  submitting?: boolean
  regenerating?: boolean
}

export function DependenciesReview({
  architecture,
  dependenciesSummary,
  onApprove,
  onRegenerate,
  onViewDetails,
  submitting = false,
  regenerating = false
}: DependenciesReviewProps) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')

  const handleRegenerateWithFeedback = async () => {
    if (feedbackText.trim()) {
      // Would pass feedback to regenerate endpoint
      await onRegenerate()
      setFeedbackText('')
      setShowFeedback(false)
    } else {
      await onRegenerate()
    }
  }

  const architectureDisplayName = architecture
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className="border-[hsl(var(--chart-2))]/30 bg-[hsl(var(--chart-2))]/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--chart-2))] mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground">
                Dependencies Generated for {architectureDisplayName} Architecture
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                The DevOps agent has analyzed your architecture choice and generated a comprehensive dependency plan.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dependencies Summary */}
      {dependenciesSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dependency Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted p-3">
                <div className="text-sm text-muted-foreground">Total Packages</div>
                <div className="text-2xl font-bold">{dependenciesSummary.total_packages}</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-sm text-muted-foreground">Production / Dev</div>
                <div className="text-2xl font-bold">{dependenciesSummary.production_deps} / {dependenciesSummary.dev_deps}</div>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-3">
              <div className="text-sm text-muted-foreground mb-2">Licenses</div>
              <div className="flex flex-wrap gap-1">
                {dependenciesSummary.license_types.map((license) => (
                  <Badge key={license} variant="secondary" className="text-xs">
                    {license}
                  </Badge>
                ))}
              </div>
            </div>

            {dependenciesSummary.vulnerabilities > 0 && (
              <div className="rounded-lg border border-[hsl(var(--chart-3))]/30 bg-[hsl(var(--chart-3))]/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-[hsl(var(--chart-3))] mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-semibold text-muted-foreground">{dependenciesSummary.vulnerabilities} vulnerability alert</div>
                    <div className="text-xs text-muted-foreground">Review DEPENDENCIES.md for details</div>
                  </div>
                </div>
              </div>
            )}

            {dependenciesSummary.vulnerabilities === 0 && (
              <div className="rounded-lg border border-[hsl(var(--chart-4))]/30 bg-[hsl(var(--chart-4))]/5 p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--chart-4))] mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-semibold text-[hsl(var(--chart-4))]">Security audit passed</div>
                    <div className="text-xs text-muted-foreground">No known vulnerabilities detected</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* View Details Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={onViewDetails}
        disabled={submitting || regenerating}
      >
        <Eye className="h-4 w-4 mr-2" />
        View Full DEPENDENCIES.md
      </Button>

      {/* Regenerate with Feedback */}
      {!showFeedback ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowFeedback(true)}
          disabled={submitting || regenerating}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerate with Feedback
        </Button>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6 space-y-4">
            <textarea
              placeholder="e.g., Please use Drizzle instead of Prisma, include @tanstack/react-query, or any other specific requests..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="w-full p-3 border rounded-md resize-none h-24 text-sm"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleRegenerateWithFeedback}
                disabled={submitting || regenerating}
                className="flex-1"
              >
                {regenerating ? 'Regenerating...' : 'Apply Feedback'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowFeedback(false)
                  setFeedbackText('')
                }}
                disabled={submitting || regenerating}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Button */}
      <Button
        onClick={onApprove}
        disabled={submitting || regenerating}
        className="w-full"
        size="lg"
      >
        {submitting ? 'Approving...' : '✓ Approve Dependencies'}
      </Button>
    </div>
  )
}
