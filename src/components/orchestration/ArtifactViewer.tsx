"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Download } from "lucide-react"
import { useState } from "react"
import { useLogger } from "@/lib/logger"

interface ArtifactViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filename: string
  content: string
  phase: string
}

export function ArtifactViewer({
  open,
  onOpenChange,
  filename,
  content,
  phase
}: ArtifactViewerProps) {
  const [copied, setCopied] = useState(false)
  const { logError } = useLogger("ArtifactViewer")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logError('Failed to copy artifact content', error)
    }
  }

  const handleDownload = () => {
    const element = document.createElement('a')
    const file = new Blob([content], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = filename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(element.href)
  }

  // Determine file type for syntax highlighting hints
  const isJSON = filename.endsWith('.json')
  const isMarkdown = filename.endsWith('.md')

  // Format content based on file type
  const formatContent = (text: string) => {
    if (isJSON) {
      try {
        return JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        return text
      }
    }
    return text
  }

  const formattedContent = formatContent(content)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between w-full pr-8">
            <div>
              <DialogTitle className="text-lg font-bold">{filename}</DialogTitle>
              <DialogDescription className="mt-1">
                Phase: <span className="font-semibold text-muted-foreground">{phase}</span> ·
                Size: <span className="font-semibold text-muted-foreground">{(content.length / 1024).toFixed(2)} KB</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Display Area */}
        <div className="flex-1 overflow-hidden flex flex-col border border-border rounded-lg bg-muted">
          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-foreground">
              {isMarkdown ? (
                // For markdown, render with some basic formatting
                formattedContent
              ) : (
                formattedContent
              )}
            </pre>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy Content'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          <DialogClose asChild>
            <Button variant="default" size="sm">
              Close
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
