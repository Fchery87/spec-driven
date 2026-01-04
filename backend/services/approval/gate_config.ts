export type GateName = 'stack_approved' | 'prd_approved' | 'architecture_approved' | 'handoff_acknowledged';
export type GateStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved';

export interface GateDefinition {
  name: GateName;
  phase: string;
  blocking: boolean;
  stakeholderRole: string;
  autoApproveThreshold?: number;
  description: string;
}

// Based on PHASE_WORKFLOW_ENHANCEMENT_PLAN.md lines 568-598
export const GATE_DEFINITIONS: GateDefinition[] = [
  {
    name: 'stack_approved',
    phase: 'STACK_SELECTION',
    blocking: true,
    stakeholderRole: 'Technical Lead / CTO',
    description: 'Technology decisions impact all downstream work',
  },
  {
    name: 'prd_approved',
    phase: 'SPEC_PM',
    blocking: false,
    stakeholderRole: 'Product Owner / PM',
    description: 'Requirements must align with business goals',
  },
  {
    name: 'architecture_approved',
    phase: 'SPEC_ARCHITECT',
    blocking: false,
    stakeholderRole: 'Technical Lead / Architect',
    autoApproveThreshold: 95,
    description: 'Architectural decisions should be reviewed before implementation',
  },
  {
    name: 'handoff_acknowledged',
    phase: 'DONE',
    blocking: false,
    stakeholderRole: 'Development Team',
    description: 'Team confirms understanding of handoff package',
  },
];
