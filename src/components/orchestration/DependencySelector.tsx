"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PlatformSelection = "web" | "mobile" | "custom"

export interface DependencyOption {
  id: string
  title: string
  summary: string
  frontend: string
  backend: string
  database: string
  deployment: string
  dependencies: string[]
  highlights: string[]
}

interface CustomStack {
  frontend: string
  backend: string
  database: string
  deployment: string
  dependenciesText: string
  requests: string
}

export type DependencySelection =
  | {
      mode: "preset"
      platform: Exclude<PlatformSelection, "custom">
      option: DependencyOption
      notes: string
    }
  | {
      mode: "custom"
      platform: "custom"
      customStack: Omit<CustomStack, "dependenciesText"> & { dependencies: string[] }
      notes: string
    }

const dependencyOptions: Record<Exclude<PlatformSelection, "custom">, DependencyOption[]> = {
  web: [
    {
      id: "web_next_full",
      title: "Option 1 · Next.js Full-Stack",
      summary: "Single Next.js codebase powering UI + APIs with Prisma/Postgres",
      frontend: "Next.js 14 App Router + Tailwind",
      backend: "Next.js API routes / tRPC",
      database: "PostgreSQL + Drizzle",
      deployment: "Vercel",
      dependencies: ["next", "react", "better-auth", "drizzle-orm", "@neondatabase/serverless", "tailwindcss", "zod"],
      highlights: ["Unified TypeScript codebase", "Fast iteration", "Minimal DevOps footprint"],
    },
    {
      id: "web_next_fastapi",
      title: "Option 2 · Next.js + FastAPI",
      summary: "Next.js frontend with Python FastAPI backend for heavier compute",
      frontend: "Next.js 14 App Router",
      backend: "FastAPI + Uvicorn + Celery workers",
      database: "PostgreSQL + SQLAlchemy",
      deployment: "Vercel (web) + Fly.io/Render (API)",
      dependencies: ["next", "react", "axios", "fastapi", "uvicorn", "sqlalchemy", "alembic", "redis"],
      highlights: ["Decoupled services", "Python for AI/data workloads", "Scales independently"],
    },
  ],
  mobile: [
    {
      id: "mobile_next_expo",
      title: "Option 1 · Next.js + Expo",
      summary: "Shared TypeScript stack for web + mobile via Expo Router",
      frontend: "Next.js 14 (web) + Expo (mobile)",
      backend: "Next.js API routes / tRPC",
      database: "PostgreSQL + Drizzle",
      deployment: "Vercel + Expo Application Services",
      dependencies: ["next", "react-native", "expo", "expo-router", "drizzle-orm", "@neondatabase/serverless", "nativewind"],
      highlights: ["Single codebase", "Fast prototyping", "OTA updates via Expo"],
    },
    {
      id: "mobile_next_fastapi",
      title: "Option 2 · Next.js + FastAPI + Expo",
      summary: "Split architecture with Expo mobile clients and Python APIs",
      frontend: "Next.js 14 + Expo",
      backend: "FastAPI + Uvicorn + Celery workers",
      database: "PostgreSQL + SQLAlchemy",
      deployment: "Vercel + Expo + Fly.io/Render",
      dependencies: ["next", "expo", "expo-router", "react-native-reanimated", "fastapi", "sqlalchemy", "redis"],
      highlights: ["Python services", "Cross-platform UX", "Background workers ready"],
    },
  ],
}

interface DependencySelectorProps {
  submitting?: boolean
  onApprove: (payload: DependencySelection) => void
}

export function DependencySelector({ submitting = false, onApprove }: DependencySelectorProps) {
  const [platform, setPlatform] = useState<PlatformSelection>("web")
  const [selectedOption, setSelectedOption] = useState<DependencyOption | null>(null)
  const [notes, setNotes] = useState("")
  const [customStack, setCustomStack] = useState<CustomStack>({
    frontend: "",
    backend: "",
    database: "",
    deployment: "",
    dependenciesText: "",
    requests: "",
  })

  const handleApprove = () => {
    if (platform === "custom") {
      const dependencies = customStack.dependenciesText
        .split(/[\n,]+/)
        .map((dep) => dep.trim())
        .filter(Boolean)

      if (!customStack.frontend || !customStack.backend || !customStack.database || !customStack.deployment) {
        return
      }

      onApprove({
        mode: "custom",
        platform: "custom",
        customStack: {
          frontend: customStack.frontend,
          backend: customStack.backend,
          database: customStack.database,
          deployment: customStack.deployment,
          dependencies,
          requests: customStack.requests,
        },
        notes,
      })
      return
    }

    if (!selectedOption) return

    onApprove({ mode: "preset", platform, option: selectedOption, notes })
  }

  const options = platform === "custom" ? [] : dependencyOptions[platform]

  const customReady =
    platform === "custom" &&
    customStack.frontend.trim() &&
    customStack.backend.trim() &&
    customStack.database.trim() &&
    customStack.deployment.trim()

  const approveDisabled =
    submitting ||
    (platform === "custom" ? !customReady : !selectedOption)

  const dependencySummary = useMemo(() => {
    if (platform !== "custom") {
      return selectedOption ? `${selectedOption.title} selected for ${platform}` : null
    }
    return customReady ? "Custom tech stack ready for approval." : "Fill out all required custom fields."
  }, [platform, selectedOption, customReady])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {(["web", "mobile", "custom"] as PlatformSelection[]).map((p) => (
          <Button
            key={p}
            type="button"
            variant={platform === p ? "default" : "outline"}
            className="flex items-center gap-2"
            onClick={() => {
              setPlatform(p)
              setSelectedOption(null)
              if (p !== "custom") {
                setCustomStack({
                  frontend: "",
                  backend: "",
                  database: "",
                  deployment: "",
                  dependenciesText: "",
                  requests: "",
                })
              }
            }}
          >
            {p === "web"
              ? "Web App"
              : p === "mobile"
                ? "Mobile / Cross-platform"
                : "Custom Tech Stack"}
            {platform === p && <Badge variant="secondary">Active</Badge>}
          </Button>
        ))}
      </div>

      {platform !== "custom" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {options.map((option) => {
            const isSelected = selectedOption?.id === option.id
            return (
              <Card
                key={option.id}
                className={cn(
                  "border border-border/60 transition hover:border-primary/60",
                  isSelected && "border-primary shadow-lg"
                )}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                  <CardDescription>{option.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-xs">
                    <p>
                      <strong>Frontend:</strong> {option.frontend}
                    </p>
                    <p>
                      <strong>Backend:</strong> {option.backend}
                    </p>
                    <p>
                      <strong>Database:</strong> {option.database}
                    </p>
                    <p>
                      <strong>Deployment:</strong> {option.deployment}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-foreground mb-1">Key Dependencies</p>
                    <div className="flex flex-wrap gap-2">
                      {option.dependencies.map((dep) => (
                        <Badge key={dep} variant="outline" className="text-[11px]">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {option.highlights.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setSelectedOption(option)}
                  >
                    {isSelected ? "Selected" : "Choose this option"}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border border-dashed border-border/70 bg-muted/20">
          <CardHeader>
            <CardTitle className="text-lg">Custom Tech Stack</CardTitle>
            <CardDescription>Specify the exact technologies you prefer for this project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Frontend</label>
                <Input
                  placeholder="Enter frontend stack here"
                  value={customStack.frontend}
                  onChange={(event) => setCustomStack((prev) => ({ ...prev, frontend: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Backend</label>
                <Input
                  placeholder="Enter backend stack here"
                  value={customStack.backend}
                  onChange={(event) => setCustomStack((prev) => ({ ...prev, backend: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Database</label>
                <Input
                  placeholder="Enter database here"
                  value={customStack.database}
                  onChange={(event) => setCustomStack((prev) => ({ ...prev, database: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Deployment</label>
                <Input
                  placeholder="Enter deployment preference"
                  value={customStack.deployment}
                  onChange={(event) => setCustomStack((prev) => ({ ...prev, deployment: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Required Dependencies</label>
              <textarea
                className="min-h-[90px] w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="List package names separated by commas or new lines"
                value={customStack.dependenciesText}
                onChange={(event) => setCustomStack((prev) => ({ ...prev, dependenciesText: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Additional Requests</label>
              <textarea
                className="min-h-[90px] w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="Security constraints, compliance needs, CI/CD specifics..."
                value={customStack.requests}
                onChange={(event) => setCustomStack((prev) => ({ ...prev, requests: event.target.value }))}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <label htmlFor="dependency-notes" className="text-sm font-medium text-foreground">
          Additional Notes / Requests
        </label>
        <textarea
          id="dependency-notes"
          className="min-h-[120px] w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          placeholder="Call out security exceptions, licensing requirements, or hosting preferences..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {dependencySummary || "Select a platform and option to continue."}
        </p>
        <Button type="button" onClick={handleApprove} disabled={approveDisabled}>
          {submitting ? "Submitting..." : "Approve Dependencies"}
        </Button>
      </div>
    </div>
  )
}
