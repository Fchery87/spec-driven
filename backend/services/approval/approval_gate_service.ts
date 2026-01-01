import { db } from '@/backend/lib/drizzle';
import { approvalGates } from '@/backend/lib/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { GateName, GateStatus, GateDefinition, GATE_DEFINITIONS } from './gate_config';

export type { GateName, GateStatus } from './gate_config';

export interface ApprovalGateRecord {
  id: string;
  projectId: string;
  gateName: GateName;
  phase: string;
  status: GateStatus;
  blocking: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  autoApproved?: boolean;
  constitutionalScore?: number;
  stakeholderRole: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApproveGateOptions {
  projectId: string;
  gateName: GateName;
  approvedBy: string;
  notes?: string;
  constitutionalScore?: number;
}

export interface RejectGateOptions {
  projectId: string;
  gateName: GateName;
  rejectedBy: string;
  reason: string;
}

export class ApprovalGateService {
  /**
   * Initialize all approval gates for a project
   */
  async initializeGatesForProject(projectId: string): Promise<void> {
    const gateRecords = GATE_DEFINITIONS.map(def => ({
      projectId,
      gateName: def.name,
      phase: def.phase,
      status: 'pending' as GateStatus,
      blocking: def.blocking,
      stakeholderRole: def.stakeholderRole,
    }));

    await db.insert(approvalGates).values(gateRecords);

    logger.info('[ApprovalGateService] Initialized approval gates', {
      projectId,
      gateCount: gateRecords.length,
    });
  }

  /**
   * Get gate definition
   */
  getGateDefinition(gateName: GateName): GateDefinition | undefined {
    return GATE_DEFINITIONS.find(def => def.name === gateName);
  }

  /**
   * Check if gate is passed
   */
  async checkGateStatus(projectId: string, gateName: GateName): Promise<GateStatus | null> {
    const gate = await db.query.approvalGates.findFirst({
      where: and(
        eq(approvalGates.projectId, projectId),
        eq(approvalGates.gateName, gateName)
      ),
    });

    return gate ? (gate.status as GateStatus) : null;
  }

  /**
   * Check if gate is blocking
   */
  async isGateBlocking(projectId: string, gateName: GateName): Promise<boolean> {
    const gate = await db.query.approvalGates.findFirst({
      where: and(
        eq(approvalGates.projectId, projectId),
        eq(approvalGates.gateName, gateName)
      ),
    });

    return gate?.blocking ?? false;
  }

  /**
   * Approve a gate
   */
  async approveGate(options: ApproveGateOptions): Promise<void> {
    const { projectId, gateName, approvedBy, notes, constitutionalScore } = options;

    // Check if should auto-approve based on score
    const autoApprove = constitutionalScore !== undefined &&
                        this.shouldAutoApprove(gateName, constitutionalScore);

    await db.update(approvalGates)
      .set({
        status: autoApprove ? 'auto_approved' : 'approved',
        approvedBy,
        approvedAt: new Date(),
        autoApproved: autoApprove,
        constitutionalScore,
        notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(approvalGates.projectId, projectId),
          eq(approvalGates.gateName, gateName)
        )
      );

    logger.info('[ApprovalGateService] Gate approved', {
      projectId,
      gateName,
      autoApprove,
      constitutionalScore,
    });
  }

  /**
   * Reject a gate
   */
  async rejectGate(options: RejectGateOptions): Promise<void> {
    const { projectId, gateName, rejectedBy, reason } = options;

    await db.update(approvalGates)
      .set({
        status: 'rejected',
        approvedBy: rejectedBy,
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(approvalGates.projectId, projectId),
          eq(approvalGates.gateName, gateName)
        )
      );

    logger.info('[ApprovalGateService] Gate rejected', {
      projectId,
      gateName,
      reason,
    });
  }

  /**
   * Get all gates for a project
   */
  async getProjectGates(projectId: string): Promise<ApprovalGateRecord[]> {
    const gates = await db.query.approvalGates.findMany({
      where: eq(approvalGates.projectId, projectId),
    });

    return gates as ApprovalGateRecord[];
  }

  /**
   * Check if should auto-approve based on constitutional score
   */
  shouldAutoApprove(gateName: GateName, constitutionalScore: number): boolean {
    const definition = this.getGateDefinition(gateName);

    if (!definition?.autoApproveThreshold) {
      return false;
    }

    return constitutionalScore >= definition.autoApproveThreshold;
  }

  /**
   * Check if all blocking gates are passed for a phase
   */
  async canProceedFromPhase(projectId: string, phase: string): Promise<boolean> {
    const gates = await db.query.approvalGates.findMany({
      where: and(
        eq(approvalGates.projectId, projectId),
        eq(approvalGates.phase, phase)
      ),
    });

    const blockingGates = gates.filter((gate: any) => gate.blocking);

    if (blockingGates.length === 0) {
      return true; // No blocking gates
    }

    // All blocking gates must be approved or auto_approved
    return blockingGates.every(
      (gate: ApprovalGateRecord) => gate.status === 'approved' || gate.status === 'auto_approved'
    );
  }
}
