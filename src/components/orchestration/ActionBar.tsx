"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw, ChevronRight, Trash2, Download, Play } from "lucide-react"

interface ActionBarProps {
  currentPhase: string
  canAdvance: boolean
  canExecute: boolean
  hasArtifacts: boolean
  executing: boolean
  advancing: boolean
  onExecute: () => void
  onAdvance: () => void
  onRefresh: () => void
  onDownload: () => void
  onDelete: () => void
  refreshing?: boolean
  executeLabel?: string
}

export function ActionBar({
  currentPhase,
  canAdvance,
  canExecute,
  hasArtifacts,
  executing,
  advancing,
  onExecute,
  onAdvance,
  onRefresh,
  onDownload,
  onDelete,
  refreshing = false,
  executeLabel,
}: ActionBarProps) {
  if (currentPhase === 'DONE') return null

  return (
    <div className="sticky-action-bar">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {canExecute && (
            <Button
              onClick={onExecute}
              disabled={executing || advancing}
              variant={hasArtifacts ? "outline" : "default"}
              className="flex items-center gap-2"
            >
              {executing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {executeLabel || (hasArtifacts ? `Rebuild ${currentPhase}` : `Execute ${currentPhase}`)}
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={executing || advancing || refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onDownload}
            disabled={executing || advancing}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={executing || advancing}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <Button
            onClick={onAdvance}
            disabled={!canAdvance || advancing || executing}
            className="flex items-center gap-2"
          >
            {advancing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Advancing...
              </>
            ) : (
              <>
                Next Phase
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
