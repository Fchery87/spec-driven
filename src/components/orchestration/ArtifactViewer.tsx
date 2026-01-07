"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Download, FileText, Hash, Type, CheckCircle } from "lucide-react"
import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import mermaid from "mermaid"
import DOMPurify from "dompurify"

interface ArtifactViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filename: string
  content: string
  phase: string
}

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
})

export function ArtifactViewer({
  open,
  onOpenChange,
  filename,
  content,
  phase
}: ArtifactViewerProps) {
  const [copied, setCopied] = useState(false)
  const mermaidRef = useRef<HTMLDivElement>(null)
  const [renderedContent, setRenderedContent] = useState<React.ReactNode>(null)

  // Calculate metadata
  const lineCount = content.split('\n').length
  const wordCount = content.split(/\s+/).filter(Boolean).length
  const charCount = content.length
  const sizeKB = (charCount / 1024).toFixed(2)

  // Determine file type
  const isJSON = filename.endsWith('.json')
  const isMarkdown = filename.endsWith('.md')
  const isYAML = filename.endsWith('.yml') || filename.endsWith('.yaml')

  // Get language for syntax highlighter
  const getLanguage = () => {
    if (isJSON) return 'json'
    if (isYAML) return 'yaml'
    if (isMarkdown) return 'markdown'
    return 'text'
  }

  // Format JSON content
  const formatContent = useCallback((text: string) => {
    if (isJSON) {
      try {
        return JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        return text
      }
    }
    return text
  }, [isJSON])

  // Normalize mermaid diagram syntax to fix common LLM-generated issues
  const normalizeMermaidDiagram = (code: string): string => {
    let normalized = code

    // Fix bidirectional arrows: <--> is not supported, convert to two separate arrows or use ---
    // Replace <--> with --- (for now, simplest fix)
    normalized = normalized.replace(/<-->/g, '---')

    // Fix <-> which is also problematic in some versions
    normalized = normalized.replace(/<->/g, '---')

    // Fix subgraph labels with problematic characters - ensure proper quoting
    // e.g., subgraph Client["Client Layer (Vercel)"] is fine, but sometimes parsing fails
    // Make sure subgraph labels are properly quoted
    normalized = normalized.replace(
      /subgraph\s+(\w+)\["([^"]+)"\]/g,
      'subgraph $1[$2]'
    )

    // Fix arrow labels with special characters - ensure they're quoted
    // e.g., -->|HTTPS/WSS| should work, but sometimes causes issues

    // Remove any HTML-like tags that might be in the diagram
    normalized = normalized.replace(/<[^>]+>/g, (match) => {
      // Keep arrow syntax like --> and <--
      if (match.match(/^<-+>?$/) || match.match(/^-+>$/)) {
        return match
      }
      // Remove other HTML-like tags
      return ''
    })

    return normalized
  }

  // Extract and render mermaid diagrams from markdown
  const renderMermaidDiagrams = useCallback(async (text: string) => {
    if (!isMarkdown) return null

    const mermaidRegex = /```mermaid\n([\s\S]*?)```/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match
    let diagramIndex = 0

    while ((match = mermaidRegex.exec(text)) !== null) {
      // Add text before this diagram
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index)
        parts.push(
          <SyntaxHighlighter
            key={`text-${lastIndex}`}
            language="markdown"
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'transparent',
              fontSize: '0.75rem',
            }}
            wrapLongLines
          >
            {beforeText}
          </SyntaxHighlighter>
        )
      }

      // Render mermaid diagram
      const rawDiagramCode = match[1].trim()
      // Normalize the diagram to fix common LLM-generated syntax issues
      const diagramCode = normalizeMermaidDiagram(rawDiagramCode)
      const diagramId = `mermaid-${diagramIndex++}`
      
      try {
        const { svg } = await mermaid.render(diagramId, diagramCode)
        // Sanitize SVG to prevent XSS attacks
        const sanitizedSvg = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, mathMl: false, html: false }
        })
        parts.push(
          <div 
            key={diagramId}
            className="my-4 p-4 bg-muted/50 rounded-lg border border-border overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
          />
        )
      } catch {
        // If mermaid fails, show the raw code
        parts.push(
          <div key={diagramId} className="my-4 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
            <p className="text-xs text-destructive mb-2">Failed to render diagram:</p>
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{diagramCode}</pre>
          </div>
        )
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex)
      parts.push(
        <SyntaxHighlighter
          key={`text-${lastIndex}`}
          language="markdown"
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.75rem',
          }}
          wrapLongLines
        >
          {remainingText}
        </SyntaxHighlighter>
      )
    }

    return parts.length > 0 ? parts : null
  }, [isMarkdown])

  // Process content when it changes
  useEffect(() => {
    if (!open) return

    const processContent = async () => {
      if (isMarkdown && content.includes('```mermaid')) {
        const rendered = await renderMermaidDiagrams(content)
        setRenderedContent(rendered)
      } else {
        setRenderedContent(null)
      }
    }

    processContent()
  }, [content, open, isMarkdown, renderMermaidDiagrams])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      toast.success('Copied to clipboard', {
        description: `${filename} content copied`,
        duration: 2000,
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy', {
        description: 'Could not copy to clipboard',
      })
    }
  }, [content, filename])

  const handleDownload = useCallback(() => {
    const element = document.createElement('a')
    const file = new Blob([content], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = filename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(element.href)
    toast.success('Download started', {
      description: `Downloading ${filename}`,
      duration: 2000,
    })
  }, [content, filename])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
      // Ctrl/Cmd + C to copy (when not selecting text)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && window.getSelection()?.toString() === '') {
        e.preventDefault()
        handleCopy()
      }
      // Ctrl/Cmd + S to download
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleDownload()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange, handleCopy, handleDownload])

  const formattedContent = formatContent(content)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between w-full pr-8">
            <div className="flex-1">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {filename}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Phase: <span className="font-semibold text-foreground">{phase}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Metadata Bar */}
        <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-muted/50 rounded-lg border border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5" />
            <span>{lineCount.toLocaleString()} lines</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Type className="h-3.5 w-3.5" />
            <span>{wordCount.toLocaleString()} words</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span>{sizeKB} KB</span>
          </div>
          <div className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {getLanguage().toUpperCase()}
          </div>
        </div>

        {/* Content Display Area */}
        <div className="flex-1 overflow-hidden flex flex-col border border-border rounded-lg bg-[#282c34]">
          <div className="flex-1 overflow-auto" ref={mermaidRef}>
            {renderedContent ? (
              <div className="p-2">{renderedContent}</div>
            ) : (
              <SyntaxHighlighter
                language={getLanguage()}
                style={oneDark}
                showLineNumbers
                lineNumberStyle={{
                  minWidth: '3em',
                  paddingRight: '1em',
                  color: '#636d83',
                  userSelect: 'none',
                }}
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  background: 'transparent',
                  fontSize: '0.75rem',
                  lineHeight: '1.6',
                }}
                wrapLongLines
              >
                {formattedContent}
              </SyntaxHighlighter>
            )}
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="text-[10px] text-muted-foreground/60 text-center">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> close
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘C</kbd> copy
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘S</kbd> download
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
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
