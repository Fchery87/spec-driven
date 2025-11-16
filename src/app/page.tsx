'use client';

export const dynamic = 'force-dynamic'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Lightbulb, Layers, Package, Sparkles, Workflow, ClipboardList, ShieldCheck, Rocket, ArrowUpRight, Timer, FileText } from 'lucide-react';

import { sampleSpecText, sampleSpecTitle } from '@/content/sample-spec';

const valueProps = [
  {
    title: 'Spec-first orchestration',
    description: 'Guide analysts, architects, and AI agents through a single shared workflow with guardrails and approvals.',
    icon: Lightbulb,
  },
  {
    title: 'Stack-aware decisions',
    description: 'Bake technology constraints into every phase so dependency proposals, PRDs, and diagrams stay in sync.',
    icon: Layers,
  },
  {
    title: 'Production-ready handoffs',
    description: 'Deliver curated prompts, artifacts, and handoff bundles engineers can ship without rework.',
    icon: Package,
  },
]

const phases = [
  { name: 'Analysis', description: 'Clarify vision, personas, and KPIs.' },
  { name: 'Stack Selection', description: 'Approve platform choices with rationale.' },
  { name: 'Spec', description: 'Generate PRDs, API contracts, and data models.' },
  { name: 'Dependencies', description: 'Validate npm/pip packages with risk notes.' },
  { name: 'Solutioning', description: 'Map architecture, epics, and workstreams.' },
  { name: 'Done', description: 'Export HANDOFF.md for downstream codegen.' },
]

const metrics = [
  { label: 'Specs delivered', value: '480+' },
  { label: 'Median handoff time', value: '2.6 hrs' },
  { label: 'Approval accuracy', value: '94%' },
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

  const samplePreview = sampleSpecText.split('\n').slice(0, 16).join('\n')

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-12 md:px-6">
        {/* Hero */}
        <section className="grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-6">
            <Badge className="w-fit bg-[hsl(var(--chart-2))]/20 text-[hsl(var(--chart-2))]">
              Spec-first orchestration OS
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                From idea to handoff in six guided phases.
              </h1>
              <p className="text-lg text-muted-foreground">
                Spec-Driven aligns analysts, architects, and AI copilots around a single source of truth so you can ship production-ready instructions faster than ever.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="px-8" onClick={handleStartProject}>
                Start New Project
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-8"
                onClick={() => setSampleOpen(true)}
              >
                See sample Spec
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              {metrics.map((metric) => (
                <div key={metric.label}>
                  <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
                  <p>{metric.label}</p>
                </div>
              ))}
            </div>
          </div>
          <Card className="border border-border/80 bg-card/80 shadow-xl backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-primary" />
                Guided Orchestration
              </CardTitle>
              <CardDescription>
                Every artifact is generated, reviewed, and approved in a predictable flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {phases.map((phase, index) => (
                <div key={phase.name} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-col items-center text-xs text-muted-foreground">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold">
                      {index + 1}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{phase.name}</p>
                    <p className="text-sm text-muted-foreground">{phase.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* Value props */}
        <section className="grid gap-6 md:grid-cols-3">
          {valueProps.map((item) => (
            <Card key={item.title} className="border border-border/60 bg-card/70 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <item.icon className="h-6 w-6 text-primary" />
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Flow timeline */}
        <section className="rounded-3xl border border-border/60 bg-muted/40 p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Workflow in one glance</p>
              <h2 className="text-2xl font-bold text-foreground">Every phase knows what’s next</h2>
              <p className="text-muted-foreground">
                Analysts, architects, and engineers stay aligned because the orchestrator enforces gates before moving forward.
              </p>
            </div>
            <Button variant="outline" onClick={handleGoToDashboard}>
              Explore Workflow
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
              <Workflow className="mb-3 h-6 w-6 text-primary" />
              <h3 className="font-semibold text-foreground">Phase choreography</h3>
              <p className="text-sm text-muted-foreground">
                The platform decides whether to execute AI agents or request approvals before advancing.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
              <ClipboardList className="mb-3 h-6 w-6 text-[hsl(var(--chart-3))]" />
              <h3 className="font-semibold text-foreground">Artifact lineage</h3>
              <p className="text-sm text-muted-foreground">
                Each deliverable—PRDs, data models, dependency proposals—is versioned and traceable back to its phase.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
              <ShieldCheck className="mb-3 h-6 w-6 text-[hsl(var(--chart-4))]" />
              <h3 className="font-semibold text-foreground">Gate reviews</h3>
              <p className="text-sm text-muted-foreground">
                Stakeholders sign off on stacks and dependencies before downstream automation continues.
              </p>
            </div>
          </div>
        </section>

        {/* Sample spec preview */}
        <section className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <Badge className="w-fit bg-[hsl(var(--chart-4))]/20 text-[hsl(var(--chart-4))]">Outcome highlight</Badge>
            <h2 className="text-3xl font-bold text-foreground">See exactly what you hand off</h2>
            <p className="text-muted-foreground">
              Every project bundles PRDs, API schemas, dependency memos, and a final HANDOFF.md prompt. Preview the quality of content downstream teams receive.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setSampleOpen(true)}>See sample Spec</Button>
              <Button variant="outline" onClick={handleStartProject}>
                Generate your own
              </Button>
            </div>
          </div>
          <Card className="border border-border/60 bg-card/80 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {sampleSpecTitle}
              </CardTitle>
              <CardDescription>Excerpt from a completed HANDOFF bundle.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-4 text-xs text-foreground">
                {samplePreview}
              </pre>
            </CardContent>
          </Card>
        </section>

        {/* Social proof */}
        <section className="rounded-3xl border border-border/50 bg-card/60 p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Operational uplift</p>
              <h2 className="text-2xl font-bold text-foreground">Teams ship with clarity</h2>
            </div>
            <Button variant="ghost" onClick={handleGoToDashboard}>
              View live projects
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-6">
              <Timer className="mb-3 h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">
                “Handoff turnaround dropped from days to hours. Stakeholders now approve dependencies before a single line of code ships.”
              </p>
              <p className="mt-3 text-sm font-semibold text-foreground">Head of Platform, Alto Robotics</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/80 p-6">
              <Rocket className="mb-3 h-6 w-6 text-[hsl(var(--chart-2))]" />
              <p className="text-sm text-muted-foreground">
                4 squads rely on Spec-Driven to align AI-generated artifacts with tech leadership requirements.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/80 p-6">
              <ShieldCheck className="mb-3 h-6 w-6 text-[hsl(var(--chart-4))]" />
              <p className="text-sm text-muted-foreground">
                92% of dependency proposals are approved on the first pass because risks are documented in-context.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-3xl border border-border/60 bg-gradient-to-r from-[hsl(var(--chart-1))]/15 via-[hsl(var(--chart-2))]/15 to-[hsl(var(--chart-3))]/15 p-10 text-center">
          <h2 className="text-3xl font-bold text-foreground">Ready to orchestrate your next build?</h2>
          <p className="mt-3 text-muted-foreground">
            Launch a project in minutes, invite stakeholders, and watch every artifact align itself automatically.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={handleStartProject}>Start New Project</Button>
            <Button size="lg" variant="outline" onClick={() => setSampleOpen(true)}>
              See sample Spec
            </Button>
          </div>
        </section>
      </div>

      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{sampleSpecTitle}</DialogTitle>
            <DialogDescription>Representative excerpt from a completed HANDOFF.md package.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted p-4 text-sm text-foreground whitespace-pre-wrap">
            {sampleSpecText}
          </pre>
        </DialogContent>
      </Dialog>
    </main>
  )
}
