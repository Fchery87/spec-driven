import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApprovalGateService, GateStatus } from './approval_gate_service';
import { db } from '@/backend/lib/drizzle';

vi.mock('@/backend/lib/drizzle');

describe('ApprovalGateService', () => {
  let service: ApprovalGateService;
  const mockProjectId = 'test-project-123';

  beforeEach(() => {
    service = new ApprovalGateService();
    vi.clearAllMocks();
  });

  describe('initializeGatesForProject', () => {
    it('should create all 4 approval gates for a project', async () => {
      const mockInsert = vi.fn().mockResolvedValue([]);
      (db.insert as any).mockReturnValue({
        values: mockInsert,
      });

      await service.initializeGatesForProject(mockProjectId);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ gateName: 'stack_approved' }),
          expect.objectContaining({ gateName: 'prd_approved' }),
          expect.objectContaining({ gateName: 'architecture_approved' }),
          expect.objectContaining({ gateName: 'handoff_acknowledged' }),
        ])
      );
    });
  });

  describe('checkGateStatus', () => {
    it('should return gate status', async () => {
      const mockGate = {
        id: 'gate-123',
        gateName: 'prd_approved',
        status: 'approved',
        blocking: false,
      };
      (db.query.approvalGates.findFirst as any).mockResolvedValue(mockGate);

      const status = await service.checkGateStatus(mockProjectId, 'prd_approved');

      expect(status).toBe('approved');
    });
  });

  describe('approveGate', () => {
    it('should approve a gate and record approver', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      (db.update as any).mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      }));

      await service.approveGate({
        projectId: mockProjectId,
        gateName: 'prd_approved',
        approvedBy: 'user-123',
        notes: 'Looks good',
      });

      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('shouldAutoApprove', () => {
    it('should auto-approve if constitutional score >= 95', () => {
      const result = service.shouldAutoApprove('architecture_approved', 96);
      expect(result).toBe(true);
    });

    it('should not auto-approve if score < 95', () => {
      const result = service.shouldAutoApprove('architecture_approved', 94);
      expect(result).toBe(false);
    });

    it('should not auto-approve stack_approved regardless of score', () => {
      const result = service.shouldAutoApprove('stack_approved', 100);
      expect(result).toBe(false);
    });
  });
});
