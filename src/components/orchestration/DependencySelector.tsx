"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Globe, Smartphone, Layers, Shield, CheckCircle2, Package } from "lucide-react"

// Architecture types that align with Stack Selection phase
type ArchitectureType = "web_application" | "mobile_application" | "api_first_platform" | "custom"

export interface DependencyPackage {
  name: string
  version: string
  size?: string
  category: "core" | "ui" | "data" | "auth" | "utils" | "dev"
}

export interface DependencyOption {
  id: string
  title: string
  summary: string
  frontend: string
  backend: string
  database: string
  deployment: string
  packages: DependencyPackage[]
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
      architecture: Exclude<ArchitectureType, "custom">
      option: DependencyOption
      notes: string
    }
  | {
      mode: "custom"
      architecture: "custom"
      customStack: Omit<CustomStack, "dependenciesText"> & { dependencies: string[] }
      notes: string
    }

// Modern dependency presets aligned with the 3 architecture options
const dependencyOptions: Record<Exclude<ArchitectureType, "custom">, DependencyOption[]> = {
  web_application: [
    {
      id: "web_nextjs_drizzle",
      title: "Next.js + Drizzle (Recommended)",
      summary: "Modern full-stack with type-safe ORM and serverless-ready database",
      frontend: "Next.js 14 App Router + Tailwind CSS",
      backend: "Next.js API Routes + Server Actions",
      database: "Neon Postgres + Drizzle ORM",
      deployment: "Vercel / Railway",
      packages: [
        { name: "next", version: "^14.2.0", size: "~150KB", category: "core" },
        { name: "react", version: "^18.3.0", size: "~6KB", category: "core" },
        { name: "typescript", version: "^5.4.0", category: "core" },
        { name: "tailwindcss", version: "^3.4.0", size: "varies", category: "ui" },
        { name: "drizzle-orm", version: "^0.30.0", size: "~20KB", category: "data" },
        { name: "@neondatabase/serverless", version: "^0.9.0", size: "~15KB", category: "data" },
        { name: "@aws-sdk/client-s3", version: "^3.937.0", category: "utils" },
        { name: "@aws-sdk/s3-request-presigner", version: "^3.937.0", category: "utils" },
        { name: "better-auth", version: "^1.0.0", size: "~25KB", category: "auth" },
        { name: "@tanstack/react-query", version: "^5.32.0", size: "~40KB", category: "data" },
        { name: "zod", version: "^3.23.0", size: "~12KB", category: "utils" },
        { name: "react-hook-form", version: "^7.51.0", size: "~25KB", category: "ui" },
        { name: "lucide-react", version: "^0.378.0", size: "varies", category: "ui" },
        { name: "date-fns", version: "^3.6.0", size: "~30KB", category: "utils" },
      ],
      highlights: [
        "Type-safe database queries with Drizzle",
        "Serverless-ready with Neon PostgreSQL",
        "S3-compatible media storage with Cloudflare R2",
        "Modern form handling with react-hook-form + zod",
        "Optimistic updates with TanStack Query",
      ],
    },
    {
      id: "web_django_htmx",
      title: "Django + HTMX",
      summary: "Python-first with minimal JavaScript using HTMX for interactivity",
      frontend: "Django Templates + HTMX + Tailwind CSS",
      backend: "Django 5.0 + Django REST Framework",
      database: "PostgreSQL + Django ORM",
      deployment: "Fly.io / Railway / Render",
      packages: [
        { name: "django", version: "^5.0.0", category: "core" },
        { name: "djangorestframework", version: "^3.15.0", category: "core" },
        { name: "django-htmx", version: "^1.17.0", category: "ui" },
        { name: "django-allauth", version: "^0.62.0", category: "auth" },
        { name: "psycopg", version: "^3.1.0", category: "data" },
        { name: "whitenoise", version: "^6.6.0", category: "utils" },
        { name: "django-environ", version: "^0.11.0", category: "utils" },
        { name: "gunicorn", version: "^22.0.0", category: "core" },
        { name: "pytest-django", version: "^4.8.0", category: "dev" },
        { name: "ruff", version: "^0.4.0", category: "dev" },
      ],
      highlights: [
        "Batteries-included Python framework",
        "Minimal JavaScript with HTMX",
        "Built-in admin panel",
        "Excellent for CRUD applications",
      ],
    },
  ],
  mobile_application: [
    {
      id: "mobile_expo_supabase",
      title: "Expo + Supabase (Recommended)",
      summary: "React Native with Expo for cross-platform and Supabase for backend",
      frontend: "Expo SDK 51 + Expo Router + NativeWind",
      backend: "Supabase (PostgreSQL + Auth + Storage)",
      database: "Supabase PostgreSQL",
      deployment: "Expo EAS + Supabase Cloud",
      packages: [
        { name: "expo", version: "~51.0.0", category: "core" },
        { name: "expo-router", version: "~3.5.0", category: "core" },
        { name: "react-native", version: "0.74.0", category: "core" },
        { name: "nativewind", version: "^4.0.0", category: "ui" },
        { name: "@supabase/supabase-js", version: "^2.43.0", size: "~50KB", category: "data" },
        { name: "react-native-reanimated", version: "~3.10.0", category: "ui" },
        { name: "react-native-gesture-handler", version: "~2.16.0", category: "ui" },
        { name: "expo-secure-store", version: "~13.0.0", category: "auth" },
        { name: "@tanstack/react-query", version: "^5.32.0", size: "~40KB", category: "data" },
        { name: "zod", version: "^3.23.0", size: "~12KB", category: "utils" },
        { name: "expo-notifications", version: "~0.28.0", category: "utils" },
        { name: "date-fns", version: "^3.6.0", size: "~30KB", category: "utils" },
      ],
      highlights: [
        "Cross-platform iOS & Android from single codebase",
        "OTA updates with Expo EAS",
        "Real-time subscriptions with Supabase",
        "Built-in auth, storage, and edge functions",
      ],
    },
    {
      id: "mobile_flutter_firebase",
      title: "Flutter + Firebase",
      summary: "Dart-based cross-platform with Firebase backend services",
      frontend: "Flutter 3.x + Material 3",
      backend: "Firebase (Firestore + Auth + Cloud Functions)",
      database: "Cloud Firestore",
      deployment: "App Store / Play Store + Firebase Hosting",
      packages: [
        { name: "flutter", version: "^3.22.0", category: "core" },
        { name: "firebase_core", version: "^2.31.0", category: "core" },
        { name: "cloud_firestore", version: "^4.17.0", category: "data" },
        { name: "firebase_auth", version: "^4.19.0", category: "auth" },
        { name: "firebase_messaging", version: "^14.9.0", category: "utils" },
        { name: "go_router", version: "^14.1.0", category: "core" },
        { name: "riverpod", version: "^2.5.0", category: "data" },
        { name: "freezed", version: "^2.5.0", category: "utils" },
        { name: "flutter_local_notifications", version: "^17.1.0", category: "utils" },
        { name: "intl", version: "^0.19.0", category: "utils" },
      ],
      highlights: [
        "Single codebase for iOS, Android, Web, Desktop",
        "Hot reload for rapid development",
        "Firebase real-time sync & offline support",
        "Strong typing with Dart",
      ],
    },
  ],
  api_first_platform: [
    {
      id: "api_hono_drizzle",
      title: "Hono + Drizzle (Recommended)",
      summary: "Lightweight, edge-ready API with type-safe database access",
      frontend: "Separate client apps (web/mobile/CLI)",
      backend: "Hono (Edge Runtime) + OpenAPI",
      database: "PostgreSQL + Drizzle ORM + Neon",
      deployment: "Cloudflare Workers / Vercel Edge",
      packages: [
        { name: "hono", version: "^4.3.0", size: "~14KB", category: "core" },
        { name: "@hono/zod-openapi", version: "^0.14.0", category: "core" },
        { name: "drizzle-orm", version: "^0.30.0", size: "~20KB", category: "data" },
        { name: "@neondatabase/serverless", version: "^0.9.0", size: "~15KB", category: "data" },
        { name: "zod", version: "^3.23.0", size: "~12KB", category: "utils" },
        { name: "jose", version: "^5.3.0", size: "~20KB", category: "auth" },
        { name: "bcryptjs", version: "^2.4.3", size: "~8KB", category: "auth" },
        { name: "@scalar/hono-api-reference", version: "^0.5.0", category: "utils" },
        { name: "nanoid", version: "^5.0.0", size: "~1KB", category: "utils" },
        { name: "vitest", version: "^1.6.0", category: "dev" },
      ],
      highlights: [
        "Ultra-lightweight (~14KB) edge-first framework",
        "Auto-generated OpenAPI documentation",
        "Runs on Cloudflare Workers, Deno, Bun, Node.js",
        "Type-safe request/response with Zod",
      ],
    },
    {
      id: "api_fastapi_sqlalchemy",
      title: "FastAPI + SQLAlchemy",
      summary: "Python async API with automatic OpenAPI docs and SQL toolkit",
      frontend: "Separate client apps (web/mobile/CLI)",
      backend: "FastAPI + Pydantic v2 + Async SQLAlchemy",
      database: "PostgreSQL + SQLAlchemy 2.0",
      deployment: "Fly.io / Railway / AWS Lambda",
      packages: [
        { name: "fastapi", version: "^0.111.0", category: "core" },
        { name: "uvicorn", version: "^0.29.0", category: "core" },
        { name: "pydantic", version: "^2.7.0", category: "utils" },
        { name: "sqlalchemy", version: "^2.0.0", category: "data" },
        { name: "alembic", version: "^1.13.0", category: "data" },
        { name: "asyncpg", version: "^0.29.0", category: "data" },
        { name: "python-jose", version: "^3.3.0", category: "auth" },
        { name: "passlib", version: "^1.7.4", category: "auth" },
        { name: "python-multipart", version: "^0.0.9", category: "utils" },
        { name: "httpx", version: "^0.27.0", category: "utils" },
        { name: "pytest", version: "^8.2.0", category: "dev" },
        { name: "ruff", version: "^0.4.0", category: "dev" },
      ],
      highlights: [
        "Auto-generated OpenAPI/Swagger docs",
        "Native async support for high concurrency",
        "Excellent for ML/AI integrations",
        "Strong Python ecosystem for data processing",
      ],
    },
  ],
}

const architectureInfo: Record<Exclude<ArchitectureType, "custom">, { icon: React.ReactNode; label: string; color: string }> = {
  web_application: { icon: <Globe className="h-4 w-4" />, label: "Web Application", color: "text-primary" },
  mobile_application: { icon: <Smartphone className="h-4 w-4" />, label: "Mobile Application", color: "text-violet-500" },
  api_first_platform: { icon: <Layers className="h-4 w-4" />, label: "API-First Platform", color: "text-cyan-500" },
}

interface DependencySelectorProps {
  selectedArchitecture?: string
  submitting?: boolean
  onApprove: (payload: DependencySelection) => void
}

export function DependencySelector({ 
  selectedArchitecture,
  submitting = false, 
  onApprove 
}: DependencySelectorProps) {
  // Map legacy stack IDs to new architecture types
  const mapToArchitecture = (stack?: string): ArchitectureType => {
    if (!stack) return "web_application"
    if (stack === "custom") return "custom"
    if (stack === "web_application" || stack === "monolithic_fullstack" || stack.includes("nextjs") || stack.includes("web")) return "web_application"
    if (stack === "mobile_application" || stack.includes("expo") || stack.includes("react_native") || stack.includes("flutter")) return "mobile_application"
    if (stack === "api_first_platform" || stack === "decoupled_services" || stack.includes("hono") || stack.includes("api")) return "api_first_platform"
    return "web_application"
  }

  const derivedArchitecture = useMemo(() => mapToArchitecture(selectedArchitecture), [selectedArchitecture])
  const [architecture, setArchitecture] = useState<ArchitectureType>(derivedArchitecture)

  useEffect(() => {
    if (!selectedArchitecture) return
    // Keep the selector aligned to the approved stack choice unless the user explicitly switches to custom deps.
    if (architecture === "custom") return
    setArchitecture(derivedArchitecture)
  }, [derivedArchitecture, architecture, selectedArchitecture])
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
    if (architecture === "custom") {
      const dependencies = customStack.dependenciesText
        .split(/[\n,]+/)
        .map((dep) => dep.trim())
        .filter(Boolean)

      if (!customStack.frontend || !customStack.backend || !customStack.database || !customStack.deployment) {
        return
      }

      onApprove({
        mode: "custom",
        architecture: "custom",
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

    onApprove({ mode: "preset", architecture, option: selectedOption, notes })
  }

  const options = architecture === "custom" ? [] : dependencyOptions[architecture]

  const customReady =
    architecture === "custom" &&
    customStack.frontend.trim() &&
    customStack.backend.trim() &&
    customStack.database.trim() &&
    customStack.deployment.trim()

  const approveDisabled =
    submitting ||
    (architecture === "custom" ? !customReady : !selectedOption)

  const dependencySummary = useMemo(() => {
    if (architecture !== "custom") {
      return selectedOption ? `${selectedOption.title} selected` : null
    }
    return customReady ? "Custom tech stack ready for approval." : "Fill out all required custom fields."
  }, [architecture, selectedOption, customReady])

  const getCategoryColor = (category: DependencyPackage["category"]) => {
    switch (category) {
      case "core": return "bg-blue-500/10 text-blue-600 border-blue-500/30"
      case "ui": return "bg-purple-500/10 text-purple-600 border-purple-500/30"
      case "data": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
      case "auth": return "bg-amber-500/10 text-amber-600 border-amber-500/30"
      case "utils": return "bg-slate-500/10 text-slate-600 border-slate-500/30"
      case "dev": return "bg-rose-500/10 text-rose-600 border-rose-500/30"
      default: return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-6">
      {/* Architecture Type Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Select Architecture Type</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(architectureInfo) as Exclude<ArchitectureType, "custom">[]).map((arch) => {
            const info = architectureInfo[arch]
            return (
              <Button
                key={arch}
                type="button"
                variant={architecture === arch ? "default" : "outline"}
                className="flex items-center gap-2"
                disabled={Boolean(selectedArchitecture) && derivedArchitecture !== "custom" && arch !== derivedArchitecture}
                onClick={() => {
                  setArchitecture(arch)
                  setSelectedOption(null)
                }}
              >
                <span className={architecture === arch ? "text-primary-foreground" : info.color}>
                  {info.icon}
                </span>
                {info.label}
              </Button>
            )
          })}
          <Button
            type="button"
            variant={architecture === "custom" ? "default" : "outline"}
            className="flex items-center gap-2"
            onClick={() => {
              setArchitecture("custom")
              setSelectedOption(null)
            }}
          >
            <Shield className="h-4 w-4" />
            Custom Stack
          </Button>
        </div>
      </div>

      {architecture !== "custom" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {options.map((option) => {
            const isSelected = selectedOption?.id === option.id
            return (
              <Card
                key={option.id}
                className={cn(
                  "cursor-pointer border border-border/60 transition-all hover:border-primary/60 hover:shadow-md",
                  isSelected && "ring-2 ring-primary border-primary shadow-lg"
                )}
                onClick={() => setSelectedOption(option)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{option.title}</CardTitle>
                      <CardDescription className="text-sm mt-1">{option.summary}</CardDescription>
                    </div>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {/* Stack Details */}
                  <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-xs space-y-1">
                    <p><span className="font-medium">Frontend:</span> {option.frontend}</p>
                    <p><span className="font-medium">Backend:</span> {option.backend}</p>
                    <p><span className="font-medium">Database:</span> {option.database}</p>
                    <p><span className="font-medium">Deployment:</span> {option.deployment}</p>
                  </div>

                  {/* Packages with versions */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">
                        Dependencies ({option.packages.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {option.packages.slice(0, 8).map((pkg) => (
                        <Badge 
                          key={pkg.name} 
                          variant="outline" 
                          className={cn("text-[10px] font-mono", getCategoryColor(pkg.category))}
                        >
                          {pkg.name}@{pkg.version}
                          {pkg.size && <span className="ml-1 opacity-60">({pkg.size})</span>}
                        </Badge>
                      ))}
                      {option.packages.length > 8 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{option.packages.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Highlights */}
                  <ul className="space-y-1">
                    {option.highlights.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border border-dashed border-border/70 bg-muted/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Custom Tech Stack
            </CardTitle>
            <CardDescription>Specify the exact technologies you prefer for this project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Frontend</label>
                <Input
                  placeholder="e.g., Next.js 14, React, Vue 3"
                  value={customStack.frontend}
                  onChange={(event) => setCustomStack((prev) => ({ ...prev, frontend: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Backend</label>
                <Input
                  placeholder="e.g., FastAPI, Express, Go Fiber"
                  value={customStack.backend}
                  onChange={(event) => setCustomStack((prev) => ({ ...prev, backend: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Database</label>
                <Input
                  placeholder="e.g., PostgreSQL, MongoDB, Supabase"
                  value={customStack.database}
                  onChange={(event) => setCustomStack((prev) => ({ ...prev, database: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Deployment</label>
                <Input
                  placeholder="e.g., Vercel, AWS, Fly.io"
                  value={customStack.deployment}
                  onChange={(event) => setCustomStack((prev) => ({ ...prev, deployment: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Required Dependencies</label>
              <textarea
                className="min-h-[90px] w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="List package names with versions, e.g.:&#10;next@^14.2.0&#10;react@^18.3.0&#10;drizzle-orm@^0.30.0"
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

      {/* Notes */}
      <div className="space-y-2">
        <label htmlFor="dependency-notes" className="text-sm font-medium text-foreground">
          Additional Notes / Requests
        </label>
        <textarea
          id="dependency-notes"
          className="min-h-[100px] w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          placeholder="Security exceptions, licensing requirements, hosting preferences..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {/* Summary & Approve */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {dependencySummary || "Select an option to continue."}
        </p>
        <Button type="button" onClick={handleApprove} disabled={approveDisabled} size="lg">
          {submitting ? "Submitting..." : "Approve Dependencies"}
        </Button>
      </div>
    </div>
  )
}
