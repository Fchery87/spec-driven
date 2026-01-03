'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FolderOpen, Search, User } from 'lucide-react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

interface ProjectData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  currentPhase: string;
  stackChoice: string | null;
  stackApproved: boolean;
  handoffGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  ownerEmail: string | null;
  ownerName: string | null;
}

const PHASES = ['ANALYSIS', 'STACK_SELECTION', 'SPEC', 'DEPENDENCIES', 'SOLUTIONING', 'VALIDATE', 'DONE'];

export default function AllProjectsPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('ALL');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/admin/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.ownerEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPhase = phaseFilter === 'ALL' || project.currentPhase === phaseFilter;
    return matchesSearch && matchesPhase;
  });

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'DONE':
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
      case 'ANALYSIS':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'SOLUTIONING':
        return 'bg-purple-500/15 text-purple-600 border-purple-500/30';
      default:
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" />
          All Projects
        </h1>
        <p className="text-muted-foreground">View and manage all user projects</p>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, slug, or owner email..."
                className="pl-10"
              />
            </div>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="ALL">All phases</option>
              {PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {phase.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            {filteredProjects.length} of {projects.length} projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Stack</TableHead>
                <TableHead>Approvals</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm">{project.ownerName || 'No name'}</p>
                        <p className="text-xs text-muted-foreground">{project.ownerEmail}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPhaseColor(project.currentPhase)}>
                      {project.currentPhase.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {project.stackChoice ? (
                      <Badge variant="outline">{project.stackChoice.replace(/_/g, ' ')}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          project.stackApproved ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        title={`Stack ${project.stackApproved ? 'approved' : 'pending'}`}
                      />
                      <span
                        className={`h-2 w-2 rounded-full ${
                          project.handoffGenerated ? 'bg-emerald-500' : 'bg-gray-400'
                        }`}
                        title={`Handoff ${project.handoffGenerated ? 'generated' : 'pending'}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredProjects.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No projects found</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </ErrorBoundary>
  );
}
