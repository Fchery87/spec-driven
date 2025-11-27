"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, FileText, FileJson, Eye, Download, Search, FolderOpen, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Artifact {
  name: string
  [key: string]: unknown
}

interface ArtifactSidebarProps {
  artifacts: Record<string, Artifact[]>
  phases: string[]
  currentPhase: string
  onViewArtifact: (artifact: Artifact, phase: string) => void
  onDownloadArtifact: (artifact: Artifact, phase: string) => void
}

export function ArtifactSidebar({
  artifacts,
  phases,
  currentPhase,
  onViewArtifact,
  onDownloadArtifact,
}: ArtifactSidebarProps) {
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    phases.forEach(phase => {
      initial[phase] = phase === currentPhase || (artifacts[phase]?.length > 0)
    })
    return initial
  })
  const [searchQuery, setSearchQuery] = useState("")

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => ({ ...prev, [phase]: !prev[phase] }))
  }

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.json')) {
      return <FileJson className="h-4 w-4 text-amber-500" />
    }
    return <FileText className="h-4 w-4 text-blue-500" />
  }

  const filteredArtifacts = (phase: string) => {
    const phaseArtifacts = artifacts[phase] || []
    if (!searchQuery) return phaseArtifacts
    return phaseArtifacts.filter(a => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  const totalArtifacts = Object.values(artifacts).flat().length

  return (
    <div className="bg-card rounded-xl border border-border h-fit sticky top-24">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Artifacts</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {totalArtifacts} files
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      <div className="p-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {phases.map(phase => {
          const phaseArtifacts = filteredArtifacts(phase)
          const hasArtifacts = phaseArtifacts.length > 0
          const isExpanded = expandedPhases[phase]
          const isCurrent = phase === currentPhase

          return (
            <div key={phase} className="mb-1">
              <button
                onClick={() => togglePhase(phase)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  "hover:bg-muted/80",
                  isCurrent && "bg-primary/5 text-primary",
                  !hasArtifacts && "opacity-50"
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                {hasArtifacts ? (
                  <FolderOpen className="h-4 w-4 text-amber-500" />
                ) : (
                  <Folder className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="flex-1 text-left truncate">{phase}</span>
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  hasArtifacts ? "bg-muted text-muted-foreground" : "text-muted-foreground/50"
                )}>
                  {phaseArtifacts.length}
                </span>
              </button>

              {isExpanded && hasArtifacts && (
                <div className="ml-4 pl-4 border-l border-border/50 mt-1 space-y-0.5">
                  {phaseArtifacts.map(artifact => (
                    <div
                      key={artifact.name}
                      className="artifact-tree-item group"
                    >
                      {getFileIcon(artifact.name)}
                      <span className="flex-1 truncate text-muted-foreground group-hover:text-foreground">
                        {artifact.name}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewArtifact(artifact, phase)
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDownloadArtifact(artifact, phase)
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
