'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lightbulb, Layers, Package } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  const handleStartProject = () => {
    router.push('/project/create');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Spec-Driven Platform
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Transform your ideas into production-ready projects through structured specification generation
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Lightbulb className="h-6 w-6 text-amber-500" />
                <CardTitle className="text-xl">Analysis</CardTitle>
              </div>
              <CardDescription>
                Clarify requirements through guided Q&A with our Analyst agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Generate constitution, project brief, and user personas
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Layers className="h-6 w-6 text-blue-500" />
                <CardTitle className="text-xl">Architecture</CardTitle>
              </div>
              <CardDescription>
                Design system architecture and select technology stacks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Get detailed specs, data models, and API contracts
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-6 w-6 text-emerald-500" />
                <CardTitle className="text-xl">Handoff</CardTitle>
              </div>
              <CardDescription>
                Download complete specifications for code generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Ready-to-use prompts for your LLM of choice
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center space-x-4">
          <Button size="lg" className="px-8" onClick={handleStartProject}>
            Start New Project
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="px-8"
            onClick={handleGoToDashboard}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </main>
  )
}