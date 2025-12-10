"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ChevronRight,
  FileCheck,
  Shield,
  Link2,
  Users,
  Layers,
  BookOpen,
  RefreshCw,
  Download
} from "lucide-react"

export interface ValidationCheck {
  id: string
  name: string
  description: string
  category: 'requirement_mapping' | 'consistency' | 'compliance' | 'completeness'
  status: 'pass' | 'fail' | 'warning' | 'pending'
  details?: string
  items?: {
    item: string
    status: 'pass' | 'fail' | 'warning'
    message?: string
  }[]
}

export interface ValidationSummary {
  totalChecks: number
  passed: number
  failed: number
  warnings: number
  pending: number
  overallStatus: 'pass' | 'fail' | 'warning' | 'pending'
  completedAt?: string
}

interface ValidationResultsPanelProps {
  checks: ValidationCheck[]
  summary: ValidationSummary
  onRunValidation: () => void
  onDownloadReport: () => void
  isValidating?: boolean
  canProceed?: boolean
  onProceed?: () => void
}

const categoryIcons: Record<ValidationCheck['category'], React.ReactNode> = {
  requirement_mapping: <Link2 className="h-4 w-4" />,
  consistency: <Layers className="h-4 w-4" />,
  compliance: <Shield className="h-4 w-4" />,
  completeness: <FileCheck className="h-4 w-4" />
}

const categoryLabels: Record<ValidationCheck['category'], string> = {
  requirement_mapping: 'Requirement Mapping',
  consistency: 'Consistency Checks',
  compliance: 'Constitutional Compliance',
  completeness: 'Completeness Checks'
}

const statusColors: Record<ValidationCheck['status'], string> = {
  pass: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30',
  fail: 'text-red-600 bg-red-500/10 border-red-500/30',
  warning: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
  pending: 'text-muted-foreground bg-muted border-border'
}

const statusIcons: Record<ValidationCheck['status'], React.ReactNode> = {
  pass: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  fail: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  pending: <RefreshCw className="h-5 w-5 text-muted-foreground" />
}

export function ValidationResultsPanel({
  checks,
  summary,
  onRunValidation,
  onDownloadReport,
  isValidating = false,
  canProceed = false,
  onProceed
}: ValidationResultsPanelProps) {
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null)

  // Group checks by category
  const checksByCategory = checks.reduce((acc, check) => {
    if (!acc[check.category]) {
      acc[check.category] = []
    }
    acc[check.category].push(check)
    return acc
  }, {} as Record<ValidationCheck['category'], ValidationCheck[]>)

  const getOverallStatusBadge = () => {
    switch (summary.overallStatus) {
      case 'pass':
        return <Badge className="bg-emerald-500/20 text-emerald-600 border-0">All Checks Passed</Badge>
      case 'fail':
        return <Badge variant="destructive">Validation Failed</Badge>
      case 'warning':
        return <Badge className="bg-amber-500/20 text-amber-600 border-0">Passed with Warnings</Badge>
      default:
        return <Badge variant="secondary">Not Validated</Badge>
    }
  }

  return (
    <Card className="w-full border-primary/20 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Validation Results</CardTitle>
              <CardDescription>
                Cross-artifact consistency and compliance checks
              </CardDescription>
            </div>
          </div>
          {getOverallStatusBadge()}
        </div>

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-2xl font-bold text-emerald-600">{summary.passed}</div>
            <div className="text-xs text-emerald-600/80">Passed</div>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
            <div className="text-xs text-red-600/80">Failed</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <div className="text-2xl font-bold text-amber-600">{summary.warnings}</div>
            <div className="text-xs text-amber-600/80">Warnings</div>
          </div>
          <div className="p-3 rounded-lg bg-muted border border-border text-center">
            <div className="text-2xl font-bold text-muted-foreground">{summary.pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Checks by Category */}
        {(Object.keys(checksByCategory) as ValidationCheck['category'][]).map((category) => (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {categoryIcons[category]}
              <span>{categoryLabels[category]}</span>
              <span className="text-xs">
                ({checksByCategory[category].filter(c => c.status === 'pass').length}/{checksByCategory[category].length} passed)
              </span>
            </div>

            <div className="space-y-2">
              {checksByCategory[category].map((check) => (
                <ValidationCheckCard
                  key={check.id}
                  check={check}
                  isExpanded={expandedCheck === check.id}
                  onToggle={() => setExpandedCheck(expandedCheck === check.id ? null : check.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {checks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No validation checks run yet</p>
            <p className="text-sm">Click "Run Validation" to check artifact consistency</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={onRunValidation}
            disabled={isValidating}
            variant={summary.overallStatus === 'pending' ? 'default' : 'outline'}
            className="flex-1"
          >
            {isValidating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {summary.overallStatus === 'pending' ? 'Run Validation' : 'Re-run Validation'}
              </>
            )}
          </Button>

          {summary.overallStatus !== 'pending' && (
            <Button variant="outline" onClick={onDownloadReport}>
              <Download className="h-4 w-4 mr-2" />
              Report
            </Button>
          )}

          {canProceed && onProceed && (
            <Button onClick={onProceed} className="flex-1">
              Proceed to DONE
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>

        {summary.overallStatus === 'fail' && (
          <p className="text-xs text-destructive text-center">
            Fix the failed checks before proceeding to the DONE phase
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface ValidationCheckCardProps {
  check: ValidationCheck
  isExpanded: boolean
  onToggle: () => void
}

function ValidationCheckCard({ check, isExpanded, onToggle }: ValidationCheckCardProps) {
  return (
    <div className={`rounded-lg border transition-all ${statusColors[check.status]}`}>
      <button
        onClick={onToggle}
        className="w-full p-3 text-left flex items-center gap-3"
      >
        {statusIcons[check.status]}
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{check.name}</div>
          <div className="text-xs opacity-80 truncate">{check.description}</div>
        </div>

        <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          {check.details && (
            <p className="text-xs mb-2 p-2 bg-background/50 rounded">{check.details}</p>
          )}

          {check.items && check.items.length > 0 && (
            <div className="space-y-1">
              {check.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-xs p-2 bg-background/50 rounded"
                >
                  {item.status === 'pass' && <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                  {item.status === 'fail' && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                  {item.status === 'warning' && <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                  <span className="flex-1">{item.item}</span>
                  {item.message && <span className="text-muted-foreground">{item.message}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
