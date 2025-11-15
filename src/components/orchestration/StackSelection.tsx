"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, Zap, Shield, Cpu, Sparkles, Smartphone, Globe } from "lucide-react"

interface Stack {
  id: string
  name: string
  description: string
  composition: {
    frontend: string
    mobile: string
    backend: string
    database: string
    deployment: string
  }
  best_for: string[]
  strengths: string[]
  tradeoffs: string[]
  scaling: string
}

interface StackSelectionProps {
  selectedStack?: string
  onStackSelect: (stackId: string, reasoning?: string, platform?: string) => void
  isLoading?: boolean
}

export function StackSelection({
  selectedStack,
  onStackSelect,
  isLoading = false
}: StackSelectionProps) {
  const [platform, setPlatform] = useState<'web' | 'mobile' | null>(null)
  const [customStack, setCustomStack] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [reasoning, setReasoning] = useState('')

  // Define stacks for each platform
  const WEB_STACKS: Stack[] = [
    {
      id: 'nextjs_only_web',
      name: 'Next.js Full-Stack',
      description: 'Unified TypeScript codebase with Next.js App Router for web applications',
      composition: {
        frontend: 'Next.js 14 (App Router)',
        mobile: 'N/A',
        backend: 'Next.js API routes / tRPC',
        database: 'PostgreSQL with Prisma',
        deployment: 'Vercel'
      },
      best_for: ['MVPs', 'dashboards', 'CRUD SaaS', 'low ops footprint', 'web apps'],
      strengths: ['Single language', 'unified codebase', 'fast iteration', 'integrated API', 'easy deployment'],
      tradeoffs: ['Web-only', 'less suitable for heavy backend compute'],
      scaling: 'Good for <10k DAU, existing managed infra'
    },
    {
      id: 'hybrid_nextjs_fastapi_web',
      name: 'Hybrid Next.js + FastAPI',
      description: 'Decoupled services with Python backend for heavy compute on web',
      composition: {
        frontend: 'Next.js 14',
        mobile: 'N/A',
        backend: 'FastAPI (Python)',
        database: 'PostgreSQL with SQLAlchemy',
        deployment: 'Separate infra'
      },
      best_for: ['AI/ETL/OCR', 'long-running jobs', 'heavier backend compute', 'data pipelines'],
      strengths: ['Decoupled services', 'Python for data science/ML', 'flexibility', 'async workers'],
      tradeoffs: ['More operational complexity', 'separate deployments', 'web-only'],
      scaling: 'Good for 10k-100k DAU, complex backend logic'
    }
  ]

  const MOBILE_STACKS: Stack[] = [
    {
      id: 'nextjs_only_expo',
      name: 'Next.js + Expo',
      description: 'Unified TypeScript codebase with Next.js App Router and Expo mobile',
      composition: {
        frontend: 'Next.js 14 (App Router)',
        mobile: 'Expo with React Native',
        backend: 'Next.js API routes / tRPC',
        database: 'PostgreSQL with Prisma',
        deployment: 'Vercel'
      },
      best_for: ['MVPs', 'dashboards', 'CRUD SaaS', 'low ops footprint', 'cross-platform apps'],
      strengths: ['Single language', 'unified codebase', 'fast iteration', 'integrated API', 'web + mobile'],
      tradeoffs: ['Less suitable for heavy backend compute', 'long-running jobs'],
      scaling: 'Good for <10k DAU, existing managed infra'
    },
    {
      id: 'hybrid_nextjs_fastapi_expo',
      name: 'Hybrid Next.js + FastAPI + Expo',
      description: 'Decoupled services with Python backend and cross-platform mobile with Expo',
      composition: {
        frontend: 'Next.js 14',
        mobile: 'Expo with React Native',
        backend: 'FastAPI (Python)',
        database: 'PostgreSQL with SQLAlchemy',
        deployment: 'Separate infra'
      },
      best_for: ['AI/ETL/OCR', 'long-running jobs', 'heavier backend compute', 'cross-platform apps'],
      strengths: ['Decoupled services', 'Python for data science/ML', 'flexibility', 'async workers', 'web + mobile'],
      tradeoffs: ['More operational complexity', 'separate deployments'],
      scaling: 'Good for 10k-100k DAU, complex backend logic'
    }
  ]

  const stacks = platform === 'web' ? WEB_STACKS : platform === 'mobile' ? MOBILE_STACKS : []

  const handleStackSelect = (stackId: string) => {
    onStackSelect(stackId, reasoning, platform || undefined)
  }

  const handleCustomStack = () => {
    if (customStack.trim()) {
      onStackSelect('custom', reasoning, platform || undefined)
    }
  }

  const getStackIcon = (stackId: string) => {
    switch (stackId) {
      case 'nextjs_only_web':
      case 'nextjs_only_expo':
        return <Zap className="h-6 w-6 text-blue-600" />
      case 'hybrid_nextjs_fastapi_web':
      case 'hybrid_nextjs_fastapi_expo':
        return <Cpu className="h-6 w-6 text-violet-600" />
      default:
        return <Shield className="h-6 w-6 text-slate-600" />
    }
  }

  const getStackColor = (stackId: string) => {
    switch (stackId) {
      case 'nextjs_only_web':
      case 'nextjs_only_expo':
        return 'border-blue-200 bg-blue-50'
      case 'hybrid_nextjs_fastapi_web':
      case 'hybrid_nextjs_fastapi_expo':
        return 'border-violet-200 bg-violet-50'
      default:
        return 'border-slate-200 bg-slate-50'
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Platform Selector */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-violet-600" />
          Choose Your Project Type
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto mb-8">
          First, let's determine whether you're building a web application, mobile application, or both.
        </p>

        <div className="flex gap-4 justify-center mb-8 flex-wrap">
          <Button
            onClick={() => {
              setPlatform('web')
              setShowCustom(false)
              setCustomStack('')
            }}
            variant={platform === 'web' ? 'default' : 'outline'}
            className="flex items-center gap-2 px-6 h-12"
          >
            <Globe className="h-5 w-5" />
            Web App Only
          </Button>
          <Button
            onClick={() => {
              setPlatform('mobile')
              setShowCustom(false)
              setCustomStack('')
            }}
            variant={platform === 'mobile' ? 'default' : 'outline'}
            className="flex items-center gap-2 px-6 h-12"
          >
            <Smartphone className="h-5 w-5" />
            Mobile App (with Web)
          </Button>
        </div>
      </div>

      {platform && (
        <>
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Choose Your Technology Stack
            </h3>
            <p className="text-slate-600">
              Select the technology stack that best fits your {platform === 'web' ? 'web application' : 'cross-platform'} requirements.
            </p>
          </div>

          {/* Stack Options */}
          <div className="grid gap-6 lg:grid-cols-2">
            {stacks.map((stack) => (
              <Card
                key={stack.id}
                className={`
                  cursor-pointer transition-all hover:shadow-lg
                  ${selectedStack === stack.id ? 'ring-2 ring-blue-500 ' + getStackColor(stack.id) : 'hover:scale-105'}
                `}
                onClick={() => handleStackSelect(stack.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStackIcon(stack.id)}
                      <CardTitle className="text-xl">{stack.name}</CardTitle>
                    </div>
                    {selectedStack === stack.id && (
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    )}
                  </div>
                  <CardDescription className="text-base">
                    {stack.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Best For */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Best For:</h4>
                    <div className="flex flex-wrap gap-1">
                      {stack.best_for.map((item) => (
                        <Badge key={item} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Composition */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Technology Composition:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><strong>Frontend:</strong> {stack.composition.frontend}</div>
                      {stack.composition.mobile !== 'N/A' && (
                        <div><strong>Mobile:</strong> {stack.composition.mobile}</div>
                      )}
                      <div><strong>Backend:</strong> {stack.composition.backend}</div>
                      <div><strong>Database:</strong> {stack.composition.database}</div>
                      <div className="col-span-2"><strong>Deployment:</strong> {stack.composition.deployment}</div>
                    </div>
                  </div>

                  {/* Strengths */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Strengths:</h4>
                    <ul className="text-sm space-y-1">
                      {stack.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Tradeoffs */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Trade-offs:</h4>
                    <ul className="text-sm space-y-1">
                      {stack.tradeoffs.map((tradeoff, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                          {tradeoff}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Scaling */}
                  <div className="text-sm">
                    <strong>Scaling:</strong> {stack.scaling}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Custom Stack Option */}
          <Card className="border-dashed border-slate-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-slate-600" />
                Custom Stack
              </CardTitle>
              <CardDescription>
                Define your own technology stack if the predefined options don't fit your needs.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {!showCustom ? (
                <Button
                  variant="outline"
                  onClick={() => setShowCustom(true)}
                  className="w-full"
                >
                  Define Custom Stack
                </Button>
              ) : (
                <div className="space-y-4">
                  <Input
                    placeholder={`Describe your custom ${platform} stack (e.g., React + Django + PostgreSQL)`}
                    value={customStack}
                    onChange={(e) => setCustomStack(e.target.value)}
                    className="w-full"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCustomStack}
                      disabled={!customStack.trim() || isLoading}
                      className="flex-1"
                    >
                      Use Custom Stack
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCustom(false)
                        setCustomStack('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reasoning Input */}
          {(selectedStack || showCustom) && (
            <Card>
              <CardHeader>
                <CardTitle>Why did you choose this stack?</CardTitle>
                <CardDescription>
                  Help us understand your reasoning to better tailor the specifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  className="w-full p-3 border rounded-md resize-none h-24"
                  placeholder="e.g., I chose this because our team has extensive experience with TypeScript and we want fast iteration for our MVP..."
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                />

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (selectedStack) {
                        handleStackSelect(selectedStack)
                      } else if (showCustom) {
                        handleCustomStack()
                      }
                    }}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? 'Confirming...' : 'Confirm Stack Choice'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      onStackSelect('')
                      setReasoning('')
                      setShowCustom(false)
                      setCustomStack('')
                    }}
                  >
                    Clear Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selection Summary */}
          {selectedStack && !showCustom && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">
                    Selected: {stacks.find(s => s.id === selectedStack)?.name} for {platform} apps
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
