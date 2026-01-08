"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Download, Shield } from "lucide-react"
import type { ValidationSummary } from "./ValidationResultsPanel"

interface ValidationCompactCardProps {
  summary: ValidationSummary
  hasReport: boolean
  isValidating: boolean
  onRunValidation: () => void
  onDownloadReport: () => void
}

const statusBadgeClasses: Record<ValidationSummary['overallStatus'], string> = {
  pass: 'bg-emerald-500/20 text-emerald-600 border-0',
  fail: 'bg-red-500/20 text-red-600 border-0',
  warning: 'bg-amber-500/20 text-amber-600 border-0',
  pending: 'bg-muted text-muted-foreground border-0'
}

const statusLabel: Record<ValidationSummary['overallStatus'], string> = {
  pass: 'All Checks Passed',
  fail: 'Validation Failed',
  warning: 'Passed with Warnings',
  pending: 'Not Run'
}

export function ValidationCompactCard({
  summary,
  hasReport,
  isValidating,
  onRunValidation,
  onDownloadReport
}: ValidationCompactCardProps) {
  const showReportBadge = summary.overallStatus === 'pending' && hasReport
  const badgeText = showReportBadge ? 'Report available' : statusLabel[summary.overallStatus]
  const badgeClass = showReportBadge
    ? 'bg-primary/10 text-primary border-0'
    : statusBadgeClasses[summary.overallStatus]

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Validation</CardTitle>
              <CardDescription>Run validation without reverting phases.</CardDescription>
            </div>
          </div>
          <Badge className={badgeClass}>{badgeText}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onRunValidation}
            disabled={isValidating}
            className="gap-2"
          >
            {isValidating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run Validation
              </>
            )}
          </Button>
          {hasReport && (
            <Button variant="outline" onClick={onDownloadReport} className="gap-2">
              <Download className="h-4 w-4" />
              Report
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
