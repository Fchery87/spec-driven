'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Lightbulb, Layers, Package, Workflow, ClipboardList, ShieldCheck, 
  ArrowRight, Timer, FileText, CheckCircle2, Zap, Users, GitBranch,
  ArrowUpRight
} from 'lucide-react';

import { sampleSpecText, sampleSpecTitle } from '@/content/sample-spec';

const phases = [
  { name: 'Analysis', description: 'Clarify vision with hybrid Q&A mode.', icon: Lightbulb, color: 'text-amber-500', badge: 'AI + Human' },
  { name: 'Stack Selection', description: 'Approve platform choices with rationale.', icon: Layers, color: 'text-blue-500', badge: 'Gate' },
  { name: 'Spec', description: 'Generate PRDs, API contracts, and data models.', icon: FileText, color: 'text-purple-500' },
  { name: 'Dependencies', description: 'AI-generated from approved stack with security checks.', icon: Package, color: 'text-orange-500' },
  { name: 'Solutioning', description: 'Test-first tasks with parallelism markers.', icon: GitBranch, color: 'text-cyan-500' },
  { name: 'Validate', description: '10 automated consistency checks.', icon: ShieldCheck, color: 'text-rose-500', badge: 'New' },
  { name: 'Done', description: 'Export HANDOFF.md for downstream codegen.', icon: CheckCircle2, color: 'text-emerald-500' },
]

const metrics = [
  { label: 'Specs delivered', value: '480+', icon: FileText },
  { label: 'Median handoff time', value: '2.6 hrs', icon: Timer },
  { label: 'Approval accuracy', value: '94%', icon: CheckCircle2 },
]

const features = [
  {
    title: 'AI-Driven Stack Selection',
    description: 'AI analyzes requirements and recommends optimal stack with alternatives. See scores, reasoning, and choose with confidence.',
    icon: Lightbulb,
    gradient: 'from-amber-500/20 to-orange-500/20',
    badge: 'New in v3.1',
  },
  {
    title: 'Streamlined Dependencies',
    description: 'Dependencies auto-generated from approved stack—no approval gate needed. Stack approval implies dependency approval.',
    icon: Package,
    gradient: 'from-blue-500/20 to-cyan-500/20',
    badge: 'New in v3.1',
  },
  {
    title: 'Intelligent Defaults',
    description: 'Smart defaults based on project type: web apps get Next.js+Bun, mobile gets Expo+Supabase, ML gets FastAPI+Python.',
    icon: CheckCircle2,
    gradient: 'from-emerald-500/20 to-teal-500/20',
    badge: 'New in v3.1',
  },
]

const capabilities = [
  {
    title: 'Phase choreography',
    description: 'The platform decides whether to execute AI agents or request approvals before advancing.',
    icon: Zap,
  },
  {
    title: 'Artifact lineage',
    description: 'Each deliverable—PRDs, data models, dependency proposals—is versioned and traceable.',
    icon: ClipboardList,
  },
  {
    title: 'Gate reviews',
    description: 'Stakeholders sign off on stack selection before downstream automation continues.',
    icon: ShieldCheck,
  },
]

const testimonials = [
  {
    quote: "Handoff turnaround dropped from days to hours. Stakeholders now approve dependencies before a single line of code ships.",
    author: "Head of Platform",
    company: "Alto Robotics",
    icon: Timer,
  },
  {
    quote: "4 squads rely on Spec-Driven to align AI-generated artifacts with tech leadership requirements.",
    author: "Engineering Lead",
    company: "TechCorp",
    icon: Users,
  },
  {
    quote: "AI-driven stack selection reduced our decision time from hours to minutes. The recommendations are spot-on.",
    author: "VP Engineering",
    company: "Nexus Labs",
    icon: ShieldCheck,
  },
]

export default function Home() {
  const router = useRouter();
  const [sampleOpen, setSampleOpen] = useState(false)

  const handleStartProject = () => {
    router.push('/project/create');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const samplePreview = sampleSpecText.split('\n').slice(0, 18).join('\n')

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        {/* Hero Section */}
        <section className="relative mb-20">
          <div className="gradient-header dark:gradient-header-dark rounded-3xl p-8 md:p-12 border border-border/50">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div className="space-y-6">
                <Badge className="bg-primary/15 text-primary border-primary/30 border px-3 py-1">
                  Spec-first orchestration OS — v3.1
                </Badge>
                
                <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                  From idea to handoff in{' '}
                  <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                    seven guided phases
                  </span>
                </h1>
                
                <p className="text-lg text-muted-foreground max-w-xl">
                  Spec-Driven aligns analysts, architects, and AI copilots around a single source of truth 
                  with hybrid clarification, constitutional articles, and automated validation.
                </p>

                <div className="flex flex-wrap gap-3">
                  <Button size="lg" onClick={handleStartProject} className="gap-2 px-6">
                    Start New Project
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setSampleOpen(true)} className="px-6">
                    See sample Spec
                  </Button>
                </div>

                <div className="flex flex-wrap gap-8 pt-4">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-background/60 border border-border/50 flex items-center justify-center">
                        <metric.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase Timeline Card */}
              <Card className="border-border/60 bg-card/80 shadow-xl backdrop-blur lg:ml-auto">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Workflow className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Guided Orchestration</CardTitle>
                  </div>
                  <CardDescription>
                    Every artifact is generated, reviewed, and approved in a predictable flow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {phases.map((phase, index) => (
                    <div key={phase.name} className="flex items-start gap-3 group">
                      <div className="flex flex-col items-center">
                        <div className={`h-9 w-9 rounded-lg border border-border bg-background flex items-center justify-center group-hover:border-primary/50 transition-colors`}>
                          <phase.icon className={`h-4 w-4 ${phase.color}`} />
                        </div>
                        {index < phases.length - 1 && (
                          <div className="w-px h-3 bg-border mt-1" />
                        )}
                      </div>
                      <div className="pb-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground text-sm">{phase.name}</p>
                          {phase.badge && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${phase.badge === 'New' ? 'border-rose-500/50 text-rose-500' : 'border-muted-foreground/30'}`}>
                              {phase.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{phase.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features Section - Version 3.1 Highlights */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 border mb-3">
              Version 3.1
            </Badge>
            <h2 className="text-2xl font-bold text-foreground">What&apos;s new in this release</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="group border-border/50 bg-card/50 hover:border-primary/30 transition-all duration-300">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <feature.icon className="h-6 w-6 text-foreground" />
                    </div>
                    {feature.badge && (
                      <Badge variant="outline" className="text-[10px] border-rose-500/50 text-rose-500">
                        {feature.badge}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Workflow Section */}
        <section className="mb-20">
          <Card className="border-border/50 bg-muted/30 overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
                <div>
                  <Badge className="bg-primary/10 text-primary border-0 mb-3">Workflow in one glance</Badge>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Every phase knows what&apos;s next</h2>
                  <p className="text-muted-foreground max-w-xl">
                    Analysts, architects, and engineers stay aligned because the orchestrator 
                    enforces gates before moving forward.
                  </p>
                </div>
                <Button variant="outline" onClick={handleGoToDashboard} className="gap-2 shrink-0">
                  Explore Workflow
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {capabilities.map((cap) => (
                  <div key={cap.title} className="rounded-xl border border-border/60 bg-card/70 p-5 hover:border-primary/30 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <cap.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{cap.title}</h3>
                    <p className="text-sm text-muted-foreground">{cap.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Sample Spec Section */}
        <section className="mb-20">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 border">
                Outcome highlight
              </Badge>
              <h2 className="text-3xl font-bold text-foreground">
                See exactly what you hand off
              </h2>
              <p className="text-muted-foreground">
                Every project bundles PRDs, API schemas, dependency memos, and a final HANDOFF.md prompt. 
                Preview the quality of content downstream teams receive.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setSampleOpen(true)} className="gap-2">
                  <FileText className="h-4 w-4" />
                  See sample Spec
                </Button>
                <Button variant="outline" onClick={handleStartProject}>
                  Generate your own
                </Button>
              </div>
            </div>

            <Card className="border-border/60 bg-card/80 shadow-lg overflow-hidden">
              <CardHeader className="bg-muted/50 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{sampleSpecTitle}</CardTitle>
                    <CardDescription className="text-xs">Excerpt from a completed HANDOFF bundle</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="max-h-72 overflow-auto p-4 text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/20">
                  {samplePreview}
                </pre>
                <div className="p-3 border-t border-border/50 bg-muted/30">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setSampleOpen(true)}>
                    View full spec
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="mb-20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 border mb-3">
                Operational uplift
              </Badge>
              <h2 className="text-2xl font-bold text-foreground">Teams ship with clarity</h2>
            </div>
            <Button variant="ghost" onClick={handleGoToDashboard} className="gap-2">
              View live projects
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((testimonial, i) => (
              <Card key={i} className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <testimonial.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-sm font-medium text-foreground">{testimonial.author}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section>
          <Card className="border-0 bg-gradient-to-r from-primary/10 via-amber-500/10 to-orange-500/10 overflow-hidden">
            <CardContent className="py-12 px-8 text-center">
              <h2 className="text-3xl font-bold text-foreground mb-3">
                Ready to orchestrate your next build?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Launch a project in minutes, invite stakeholders, and watch every artifact align itself automatically.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="lg" onClick={handleStartProject} className="gap-2 px-8">
                  Start New Project
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => setSampleOpen(true)} className="px-8">
                  See sample Spec
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Sample Spec Dialog */}
      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {sampleSpecTitle}
            </DialogTitle>
            <DialogDescription>
              Representative excerpt from a completed HANDOFF.md package.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted p-4 text-sm text-foreground whitespace-pre-wrap font-mono">
            {sampleSpecText}
          </pre>
        </DialogContent>
      </Dialog>
    </main>
  )
}
