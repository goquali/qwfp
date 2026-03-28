export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface OrgUnit {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  level: string;
  headUserId: string | null;
}

export interface PlanningCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  baseCurrency: string;
  status: string;
}

export interface BudgetEnvelope {
  id: string;
  planningCycleId: string;
  orgUnitId: string;
  parentEnvelopeId: string | null;
  envelopeType: string;
  headcountCap: number;
  totalCompBudget: string;
  compBandLow: string | null;
  compBandHigh: string | null;
  startWindow: string | null;
  endWindow: string | null;
  currencyCode: string;
  status: string;
  autoApproveThresholdPct: string;
}

export interface EnvelopeUtilization {
  headcountUsed: number;
  headcountRemaining: number;
  headcountCap?: number;
  budgetCommitted: number | string;
  budgetConsumed: number | string;
  budgetRemaining: number | string;
  totalCompBudget?: number | string;
  totalBudget?: number | string;
  flexibilityPct?: number;
  headcountFlexibilityPct?: number;
  budgetFlexibilityPct?: number;
  slotsTotal?: number;
  slotsOpen?: number;
  slotsFilled?: number;
  slotsCancelled?: number;
}

export interface JobSlot {
  id: string;
  envelopeId: string;
  roleTitle: string;
  jobFamilyId: string | null;
  level: string | null;
  workerType: string;
  status: string;
  baseSalary: string | null;
  equityValue: string | null;
  bonusTarget: string | null;
  benefitsCost: string | null;
  totalComp: string | null;
  totalCompBase: string | null;
  currencyCode: string;
  targetStartDate: string | null;
  hiringManagerId: string | null;
  recruiterId: string | null;
  sourceType: string;
}

export interface ChangeRequest {
  id: string;
  orgUnitId: string;
  requestedBy: string;
  requestType: string;
  description: string;
  targetRoleTitle: string | null;
  targetLevel: string | null;
  fitsEnvelope: boolean | null;
  budgetImpact: string | null;
  amendmentRequired: boolean | null;
  suggestedOffset: string | null;
  status: string;
  createdAt: string;
}

export interface DriftAlert {
  id: string;
  envelopeId: string;
  alertType: string;
  severity: string;
  enforcement: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface FlexibilityMetrics {
  headcountRemaining: number;
  budgetRemaining: number;
  flexibilityPct: number;
  canAddAtBandLow: number;
}

export interface Recruiter {
  id: string;
  userId: string;
  maxActiveReqs: number;
  availability: string;
  availabilityPct: string;
}

export interface RecruiterWorkload {
  recruiterId: string;
  activeAssignments: number;
  maxActiveReqs: number;
  effectiveCapacity?: number;
  utilizationPct: number;
  availability: string;
}

export interface CapacitySnapshot {
  totalRecruiters: number;
  availableCapacity: number;
  activeReqs: number;
  utilizationPct: number;
  capacityGap: number;
}
