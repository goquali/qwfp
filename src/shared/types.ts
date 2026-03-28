// Shared enums and types used across modules

export const UserRole = {
  ADMIN: "admin",
  FINANCE: "finance",
  HR: "hr",
  TA: "ta",
  BUSINESS_OWNER: "business_owner",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const OrgUnitLevel = {
  COMPANY: "company",
  DIVISION: "division",
  DEPARTMENT: "department",
  TEAM: "team",
} as const;
export type OrgUnitLevel = (typeof OrgUnitLevel)[keyof typeof OrgUnitLevel];

export const PlanningCycleStatus = {
  DRAFT: "draft",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  ACTIVE: "active",
  CLOSED: "closed",
} as const;
export type PlanningCycleStatus =
  (typeof PlanningCycleStatus)[keyof typeof PlanningCycleStatus];

export const EnvelopeStatus = {
  DRAFT: "draft",
  APPROVED: "approved",
  ACTIVE: "active",
  FROZEN: "frozen",
  CLOSED: "closed",
} as const;
export type EnvelopeStatus =
  (typeof EnvelopeStatus)[keyof typeof EnvelopeStatus];

export const EnvelopeType = {
  NEW_HEADCOUNT: "new_headcount",
  BACKFILL: "backfill",
  CONVERSION: "conversion",
  CONTRACTOR_TO_FTE: "contractor_to_fte",
} as const;
export type EnvelopeType = (typeof EnvelopeType)[keyof typeof EnvelopeType];

export const GuardrailType = {
  HEADCOUNT: "headcount",
  TOTAL_COMP: "total_comp",
  COMP_BAND: "comp_band",
  TIMELINE: "timeline",
  VACANCY_RATE: "vacancy_rate",
} as const;
export type GuardrailType = (typeof GuardrailType)[keyof typeof GuardrailType];

export const Enforcement = {
  SOFT: "soft",
  HARD: "hard",
} as const;
export type Enforcement = (typeof Enforcement)[keyof typeof Enforcement];

export const AmendmentType = {
  INCREASE: "increase",
  DECREASE: "decrease",
  TRANSFER: "transfer",
  REALLOCATION: "reallocation",
} as const;
export type AmendmentType = (typeof AmendmentType)[keyof typeof AmendmentType];

export const AmendmentStatus = {
  PENDING: "pending",
  AUTO_APPROVED: "auto_approved",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
export type AmendmentStatus =
  (typeof AmendmentStatus)[keyof typeof AmendmentStatus];

export const WorkerType = {
  FTE: "fte",
  CONTRACTOR: "contractor",
  CONTINGENT: "contingent",
} as const;
export type WorkerType = (typeof WorkerType)[keyof typeof WorkerType];

export const SlotStatus = {
  DRAFT: "draft",
  OPEN: "open",
  SOURCING: "sourcing",
  OFFER: "offer",
  FILLED: "filled",
  CANCELLED: "cancelled",
} as const;
export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

export const SourceType = {
  NEW_HIRE: "new_hire",
  BACKFILL: "backfill",
  TRANSFER: "transfer",
  PROMOTION: "promotion",
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const ChangeRequestType = {
  NEW_ROLE: "new_role",
  SWAP_ROLE: "swap_role",
  MODIFY_ROLE: "modify_role",
  CANCEL_ROLE: "cancel_role",
  ACCELERATE: "accelerate",
  ADD_HEADCOUNT: "add_headcount",
} as const;
export type ChangeRequestType =
  (typeof ChangeRequestType)[keyof typeof ChangeRequestType];

export const ChangeRequestStatus = {
  SUBMITTED: "submitted",
  FEASIBLE: "feasible",
  NEEDS_AMENDMENT: "needs_amendment",
  APPROVED: "approved",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  REJECTED: "rejected",
} as const;
export type ChangeRequestStatus =
  (typeof ChangeRequestStatus)[keyof typeof ChangeRequestStatus];

export const AlertType = {
  HEADCOUNT_WARNING: "headcount_warning",
  HEADCOUNT_BREACH: "headcount_breach",
  BUDGET_WARNING: "budget_warning",
  BUDGET_BREACH: "budget_breach",
  COMP_BAND_EXCEPTION: "comp_band_exception",
  TIMELINE_DRIFT: "timeline_drift",
  UTILIZATION_LOW: "utilization_low",
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];

export const AlertSeverity = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export const AlertStatus = {
  ACTIVE: "active",
  ACKNOWLEDGED: "acknowledged",
  RESOLVED: "resolved",
  OVERRIDDEN: "overridden",
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const ImportStatus = {
  UPLOADED: "uploaded",
  MAPPING: "mapping",
  VALIDATING: "validating",
  PREVIEW: "preview",
  IMPORTING: "importing",
  COMPLETED: "completed",
  FAILED: "failed",
  ROLLED_BACK: "rolled_back",
} as const;
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];

export const RecruiterAvailability = {
  FULL_TIME: "full_time",
  PART_TIME: "part_time",
  ON_LEAVE: "on_leave",
} as const;
export type RecruiterAvailability =
  (typeof RecruiterAvailability)[keyof typeof RecruiterAvailability];

export const MobilityEventType = {
  TRANSFER: "transfer",
  PROMOTION: "promotion",
} as const;
export type MobilityEventType =
  (typeof MobilityEventType)[keyof typeof MobilityEventType];

export const SubscriptionTier = {
  FREE: "free",
  ESSENTIALS: "essentials",
  PRO: "pro",
  ENTERPRISE: "enterprise",
} as const;
export type SubscriptionTier =
  (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const SubscriptionStatus = {
  ACTIVE: "active",
  CANCELLED: "cancelled",
  PAST_DUE: "past_due",
  TRIALING: "trialing",
} as const;
export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const AIAction = {
  FEASIBILITY_CHECK: "feasibility_check",
  COPILOT_QUERY: "copilot_query",
  SCENARIO_RUN: "scenario_run",
  AMENDMENT_DRAFT: "amendment_draft",
  SMART_RECOMMENDATION: "smart_recommendation",
  PREDICTIVE_ALERT: "predictive_alert",
} as const;
export type AIAction = (typeof AIAction)[keyof typeof AIAction];

export const BillingEventType = {
  SUBSCRIPTION_CREATED: "subscription_created",
  TIER_UPGRADED: "tier_upgraded",
  TIER_DOWNGRADED: "tier_downgraded",
  CREDITS_PURCHASED: "credits_purchased",
  CREDITS_RESET: "credits_reset",
  PAYMENT_RECEIVED: "payment_received",
} as const;
export type BillingEventType =
  (typeof BillingEventType)[keyof typeof BillingEventType];

export const SnapshotType = {
  EVENT_TRIGGERED: "event_triggered",
  SCHEDULED_DAILY: "scheduled_daily",
  SCHEDULED_WEEKLY: "scheduled_weekly",
} as const;
export type SnapshotType = (typeof SnapshotType)[keyof typeof SnapshotType];
