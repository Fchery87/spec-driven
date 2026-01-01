import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/backend/services/database/drizzle_project_db_service', () => ({
  ProjectDBService: vi.fn()
}));
vi.mock('@/backend/services/approval/approval_gate_service', () => ({
  ApprovalGateService: vi.fn()
}));
vi.mock('@/lib/logger');
vi.mock('@/app/api/middleware/auth-guard', () => ({
  requireAuth: async () => ({
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      emailVerified: true,
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    session: {
      id: 'test-session-123',
      token: 'test-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }),
  withAuth: (handler: unknown) => async (req: unknown, ctx: unknown) => {
    const mockSession = {
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      session: {
        id: 'test-session-123',
        token: 'test-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
    return (handler as (req: unknown, ctx: unknown, session: unknown) => Promise<unknown>)(req, ctx, mockSession);
  },
  isAdmin: () => true,
  isSuperAdmin: () => true
}));

import { GET } from '@/app/api/projects/[slug]/approvals/route';
import { POST as approveGate } from '@/app/api/projects/[slug]/approvals/[gateName]/approve/route';
import { POST as rejectGate } from '@/app/api/projects/[slug]/approvals/[gateName]/reject/route';
import { ProjectDBService } from '@/backend/services/database/drizzle_project_db_service';
import { ApprovalGateService } from '@/backend/services/approval/approval_gate_service';

describe('Approval Gates API', () => {
  const mockProject = {
    id: 'test-project-id',
    slug: 'test-project',
    name: 'Test Project',
    description: 'A test project',
    ownerId: 'test-user-123',
    currentPhase: 'STACK_SELECTION',
    phasesCompleted: [],
    stackChoice: null,
    stackApproved: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    artifacts: [],
    phaseHistory: []
  };

  const mockGates = [
    {
      id: 'gate-1',
      projectId: 'test-project-id',
      gateName: 'stack_approved' as const,
      phase: 'STACK_SELECTION',
      status: 'pending' as const,
      blocking: true,
      stakeholderRole: 'Technical Lead / CTO',
      notes: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01')
    },
    {
      id: 'gate-2',
      projectId: 'test-project-id',
      gateName: 'prd_approved' as const,
      phase: 'SPEC_PM',
      status: 'pending' as const,
      blocking: false,
      stakeholderRole: 'Product Owner / PM',
      notes: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01')
    },
    {
      id: 'gate-3',
      projectId: 'test-project-id',
      gateName: 'architecture_approved' as const,
      phase: 'SPEC_ARCHITECT',
      status: 'pending' as const,
      blocking: false,
      stakeholderRole: 'Technical Lead / Architect',
      notes: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01')
    },
    {
      id: 'gate-4',
      projectId: 'test-project-id',
      gateName: 'handoff_acknowledged' as const,
      phase: 'DONE',
      status: 'pending' as const,
      blocking: false,
      stakeholderRole: 'Development Team',
      notes: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/projects/:slug/approvals', () => {
    it('should return all approval gates for a project', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(mockProject);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(ApprovalGateService.prototype, 'getProjectGates').mockResolvedValue(mockGates as any);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals')
      );

      const response = await GET(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.projectId).toBe('test-project-id');
      expect(json.data.slug).toBe('test-project');
      expect(json.data.gates).toHaveLength(4);
      expect(json.data.gates[0].gateName).toBe('stack_approved');
    });

    it('should return 404 if project not found', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(null);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/missing/approvals')
      );

      const response = await GET(request, { params: { slug: 'missing' } });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });

    it('should return 403 if user does not have access to project', async () => {
      const otherUserProject = { ...mockProject, ownerId: 'other-user-id' };
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(otherUserProject);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals')
      );

      const response = await GET(request, { params: { slug: 'test-project' } });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Forbidden');
    });
  });

  describe('POST /api/projects/:slug/approvals/:gateName/approve', () => {
    it('should approve a gate with notes', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(mockProject);
      vi.spyOn(ApprovalGateService.prototype, 'getGateDefinition').mockReturnValue({
        name: 'stack_approved',
        phase: 'STACK_SELECTION',
        blocking: true,
        stakeholderRole: 'Technical Lead / CTO',
        description: 'Technology decisions impact all downstream work'
      });
      vi.spyOn(ApprovalGateService.prototype, 'approveGate').mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals/stack_approved/approve'),
        {
          method: 'POST',
          body: JSON.stringify({
            notes: 'Looking good, approved!',
            constitutionalScore: 90
          })
        }
      );

      const response = await approveGate(request, {
        params: { slug: 'test-project', gateName: 'stack_approved' }
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.gateName).toBe('stack_approved');
      expect(json.data.status).toBe('approved');
      expect(ApprovalGateService.prototype.approveGate).toHaveBeenCalledWith({
        projectId: 'test-project-id',
        gateName: 'stack_approved',
        approvedBy: 'test-user-123',
        notes: 'Looking good, approved!',
        constitutionalScore: 90
      });
    });

    it('should approve a gate without notes', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(mockProject);
      vi.spyOn(ApprovalGateService.prototype, 'getGateDefinition').mockReturnValue({
        name: 'prd_approved',
        phase: 'SPEC_PM',
        blocking: false,
        stakeholderRole: 'Product Owner / PM',
        description: 'Requirements must align with business goals'
      });
      vi.spyOn(ApprovalGateService.prototype, 'approveGate').mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals/prd_approved/approve'),
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );

      const response = await approveGate(request, {
        params: { slug: 'test-project', gateName: 'prd_approved' }
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should return 400 for invalid gate name', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(mockProject);
      vi.spyOn(ApprovalGateService.prototype, 'getGateDefinition').mockReturnValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals/invalid_gate/approve'),
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );

      const response = await approveGate(request, {
        params: { slug: 'test-project', gateName: 'invalid_gate' }
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid gate name');
    });

    it('should return 404 if project not found', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(null);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/missing/approvals/stack_approved/approve'),
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );

      const response = await approveGate(request, {
        params: { slug: 'missing', gateName: 'stack_approved' }
      });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });
  });

  describe('POST /api/projects/:slug/approvals/:gateName/reject', () => {
    it('should reject a gate with a reason', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(mockProject);
      vi.spyOn(ApprovalGateService.prototype, 'getGateDefinition').mockReturnValue({
        name: 'stack_approved',
        phase: 'STACK_SELECTION',
        blocking: true,
        stakeholderRole: 'Technical Lead / CTO',
        description: 'Technology decisions impact all downstream work'
      });
      vi.spyOn(ApprovalGateService.prototype, 'rejectGate').mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals/stack_approved/reject'),
        {
          method: 'POST',
          body: JSON.stringify({
            reason: 'Not ready yet, needs more work on dependencies'
          })
        }
      );

      const response = await rejectGate(request, {
        params: { slug: 'test-project', gateName: 'stack_approved' }
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.gateName).toBe('stack_approved');
      expect(json.data.status).toBe('rejected');
      expect(ApprovalGateService.prototype.rejectGate).toHaveBeenCalledWith({
        projectId: 'test-project-id',
        gateName: 'stack_approved',
        rejectedBy: 'test-user-123',
        reason: 'Not ready yet, needs more work on dependencies'
      });
    });

    it('should return 400 if reason is not provided', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(mockProject);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals/stack_approved/reject'),
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );

      const response = await rejectGate(request, {
        params: { slug: 'test-project', gateName: 'stack_approved' }
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Reason is required for rejection');
    });

    it('should return 400 for invalid gate name', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(mockProject);
      vi.spyOn(ApprovalGateService.prototype, 'getGateDefinition').mockReturnValue(undefined);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals/invalid_gate/reject'),
        {
          method: 'POST',
          body: JSON.stringify({
            reason: 'Invalid gate'
          })
        }
      );

      const response = await rejectGate(request, {
        params: { slug: 'test-project', gateName: 'invalid_gate' }
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid gate name');
    });

    it('should return 404 if project not found', async () => {
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(null);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/missing/approvals/stack_approved/reject'),
        {
          method: 'POST',
          body: JSON.stringify({
            reason: 'Project missing'
          })
        }
      );

      const response = await rejectGate(request, {
        params: { slug: 'missing', gateName: 'stack_approved' }
      });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Project not found');
    });

    it('should return 403 if user does not have access to project', async () => {
      const otherUserProject = { ...mockProject, ownerId: 'other-user-id' };
      vi.spyOn(ProjectDBService.prototype, 'getProjectBySlug').mockResolvedValue(otherUserProject);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/projects/test-project/approvals/stack_approved/reject'),
        {
          method: 'POST',
          body: JSON.stringify({
            reason: 'No access'
          })
        }
      );

      const response = await rejectGate(request, {
        params: { slug: 'test-project', gateName: 'stack_approved' }
      });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Forbidden');
    });
  });
});
