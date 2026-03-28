import type { UtilizationMetrics } from "../../src/modules/reconciliation/engine.js";

// Track all DB operations for assertions

const { mockReturning, mockSet, mockWhere, mockDb } = vi.hoisted(() => {
  const mockReturning = vi.fn(() => [] as any[]);
  const mockSet = vi.fn(() => ({
    where: vi.fn().mockResolvedValue(undefined),
  }));
  const mockWhere = vi.fn(() => Promise.resolve([] as any[]));
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockWhere,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: mockSet,
    })),
  };
  return { mockReturning, mockSet, mockWhere, mockDb };
});

vi.mock("../../src/db/client.js", () => ({ db: mockDb }));

import { evaluateGuardrails } from "../../src/modules/reconciliation/guardrails.js";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => ({ op: "eq", val })),
  and: vi.fn((...args: any[]) => ({ op: "and", args })),
  ne: vi.fn((_col: any, val: any) => ({ op: "ne", val })),
}));

vi.mock("../../src/db/schema/finance.js", () => ({
  budgetEnvelopes: { id: "id", compBandLow: "compBandLow", compBandHigh: "compBandHigh" },
  guardrailConfigs: { envelopeId: "envelopeId" },
}));

vi.mock("../../src/db/schema/hr.js", () => ({
  jobSlots: { envelopeId: "envelopeId", status: "status" },
}));

vi.mock("../../src/db/schema/reconciliation.js", () => ({
  driftAlerts: {
    envelopeId: "envelopeId",
    alertType: "alertType",
    status: "status",
    id: "id",
    $inferSelect: {},
  },
}));

function makeUtilization(overrides: Partial<UtilizationMetrics> = {}): UtilizationMetrics {
  return {
    slotsTotal: 10,
    slotsOpen: 3,
    slotsFilled: 5,
    slotsCancelled: 2,
    headcountUsed: 5,
    headcountRemaining: 5,
    headcountCap: 10,
    budgetCommitted: 250000,
    budgetConsumed: 200000,
    budgetRemaining: 250000,
    totalCompBudget: 500000,
    flexibilityPct: 50,
    ...overrides,
  };
}

// We need to control what the DB returns for each sequential call.
// The function does: select guardrail configs, then for each config: select existing alerts, insert alert.
// We'll use call counters to return different data per call.

let selectCallIndex = 0;
let selectCallResponses: any[][] = [];

beforeEach(() => {
  vi.clearAllMocks();
  selectCallIndex = 0;
  selectCallResponses = [];

  mockReturning.mockImplementation(() => []);

  mockWhere.mockImplementation(() => {
    const result = selectCallResponses[selectCallIndex] ?? [];
    selectCallIndex++;
    return Promise.resolve(result);
  });
});

describe("evaluateGuardrails", () => {
  describe("headcount guardrail", () => {
    it("returns no alerts when headcount is within limits", async () => {
      // Config: warning at 80%, breach at 100%. Usage: 50%.
      selectCallResponses = [
        // guardrail configs
        [{
          guardrailType: "headcount",
          warningThresholdPct: "80",
          breachThresholdPct: "100",
          enforcement: "hard",
        }],
        // resolveAlerts: select active headcount_warning alerts
        [],
        // resolveAlerts: select active headcount_breach alerts
        [],
      ];

      const utilization = makeUtilization({ headcountUsed: 5, headcountCap: 10 });
      const result = await evaluateGuardrails("env-1", utilization);

      expect(result.alerts).toHaveLength(0);
      expect(result.hardBlock).toBe(false);
    });

    it("generates warning alert at 80% threshold", async () => {
      const warningAlert = {
        id: "alert-1",
        envelopeId: "env-1",
        alertType: "headcount_warning",
        severity: "warning",
        enforcement: "hard",
        message: "Headcount usage at 80.0% (warning threshold: 80%)",
      };

      selectCallResponses = [
        // guardrail configs
        [{
          guardrailType: "headcount",
          warningThresholdPct: "80",
          breachThresholdPct: "100",
          enforcement: "hard",
        }],
        // check existing alerts of same type - none
        [],
      ];
      mockReturning.mockReturnValue([warningAlert]);

      const utilization = makeUtilization({ headcountUsed: 8, headcountCap: 10 });
      const result = await evaluateGuardrails("env-1", utilization);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].alertType).toBe("headcount_warning");
      expect(result.alerts[0].severity).toBe("warning");
      expect(result.hardBlock).toBe(false);
    });

    it("generates hard block when headcount exceeds breach threshold", async () => {
      const breachAlert = {
        id: "alert-2",
        envelopeId: "env-1",
        alertType: "headcount_breach",
        severity: "critical",
        enforcement: "hard",
      };

      selectCallResponses = [
        // guardrail configs
        [{
          guardrailType: "headcount",
          warningThresholdPct: "80",
          breachThresholdPct: "95",
          enforcement: "hard",
        }],
        // check existing alerts - none
        [],
      ];
      mockReturning.mockReturnValue([breachAlert]);

      const utilization = makeUtilization({ headcountUsed: 10, headcountCap: 10 });
      const result = await evaluateGuardrails("env-1", utilization);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].alertType).toBe("headcount_breach");
      expect(result.hardBlock).toBe(true);
    });
  });

  describe("budget guardrail (total_comp)", () => {
    it("returns no alerts when budget is within limits", async () => {
      selectCallResponses = [
        [{
          guardrailType: "total_comp",
          warningThresholdPct: "80",
          breachThresholdPct: "100",
          enforcement: "hard",
        }],
        // resolveAlerts: select active budget_warning
        [],
        // resolveAlerts: select active budget_breach
        [],
      ];

      const utilization = makeUtilization({
        budgetCommitted: 200000,
        totalCompBudget: 500000,
      });
      const result = await evaluateGuardrails("env-1", utilization);

      expect(result.alerts).toHaveLength(0);
      expect(result.hardBlock).toBe(false);
    });

    it("generates warning when budget at warning threshold", async () => {
      const warningAlert = {
        id: "alert-3",
        alertType: "budget_warning",
        severity: "warning",
        enforcement: "soft",
      };

      selectCallResponses = [
        [{
          guardrailType: "total_comp",
          warningThresholdPct: "80",
          breachThresholdPct: "100",
          enforcement: "soft",
        }],
        // no existing alert
        [],
      ];
      mockReturning.mockReturnValue([warningAlert]);

      const utilization = makeUtilization({
        budgetCommitted: 400000,
        totalCompBudget: 500000,
      });
      const result = await evaluateGuardrails("env-1", utilization);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].alertType).toBe("budget_warning");
      expect(result.hardBlock).toBe(false);
    });

    it("hard blocks when budget exceeds breach with hard enforcement", async () => {
      const breachAlert = {
        id: "alert-4",
        alertType: "budget_breach",
        severity: "critical",
        enforcement: "hard",
      };

      selectCallResponses = [
        [{
          guardrailType: "total_comp",
          warningThresholdPct: "80",
          breachThresholdPct: "95",
          enforcement: "hard",
        }],
        [],
      ];
      mockReturning.mockReturnValue([breachAlert]);

      const utilization = makeUtilization({
        budgetCommitted: 490000,
        totalCompBudget: 500000,
      });
      const result = await evaluateGuardrails("env-1", utilization);

      expect(result.alerts).toHaveLength(1);
      expect(result.hardBlock).toBe(true);
    });

    it("allows with warning when budget exceeds breach with soft enforcement", async () => {
      const breachAlert = {
        id: "alert-5",
        alertType: "budget_breach",
        severity: "critical",
        enforcement: "soft",
      };

      selectCallResponses = [
        [{
          guardrailType: "total_comp",
          warningThresholdPct: "80",
          breachThresholdPct: "95",
          enforcement: "soft",
        }],
        [],
      ];
      mockReturning.mockReturnValue([breachAlert]);

      const utilization = makeUtilization({
        budgetCommitted: 490000,
        totalCompBudget: 500000,
      });
      const result = await evaluateGuardrails("env-1", utilization);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].alertType).toBe("budget_breach");
      expect(result.hardBlock).toBe(false); // soft enforcement does NOT hard block
    });
  });

  describe("comp_band guardrail", () => {
    it("generates alert for comp band violation", async () => {
      const compAlert = {
        id: "alert-6",
        alertType: "comp_band_exception",
        severity: "warning",
        enforcement: "soft",
      };

      selectCallResponses = [
        // guardrail configs
        [{
          guardrailType: "comp_band",
          warningThresholdPct: "0",
          breachThresholdPct: "0",
          enforcement: "soft",
        }],
        // job slots for envelope
        [{
          id: "slot-1",
          envelopeId: "env-1",
          status: "open",
          totalCompBase: "200000", // above band high of 150000
        }],
        // envelope for comp band limits
        [{
          id: "env-1",
          compBandLow: "50000",
          compBandHigh: "150000",
        }],
        // check existing alert
        [],
      ];
      mockReturning.mockReturnValue([compAlert]);

      const utilization = makeUtilization();
      const result = await evaluateGuardrails("env-1", utilization);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].alertType).toBe("comp_band_exception");
    });
  });

  describe("multiple guardrails", () => {
    it("can trigger multiple guardrails simultaneously", async () => {
      const headcountAlert = {
        id: "alert-hc",
        alertType: "headcount_breach",
        severity: "critical",
        enforcement: "hard",
      };
      const budgetAlert = {
        id: "alert-budget",
        alertType: "budget_breach",
        severity: "critical",
        enforcement: "hard",
      };

      // Both headcount and budget configs returned
      selectCallResponses = [
        [
          {
            guardrailType: "headcount",
            warningThresholdPct: "80",
            breachThresholdPct: "95",
            enforcement: "hard",
          },
          {
            guardrailType: "total_comp",
            warningThresholdPct: "80",
            breachThresholdPct: "95",
            enforcement: "hard",
          },
        ],
        // headcount breach: no existing alert
        [],
        // budget breach: no existing alert
        [],
      ];

      // First insert returns headcount alert, second returns budget alert
      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        return insertCallCount === 1 ? [headcountAlert] : [budgetAlert];
      });

      const utilization = makeUtilization({
        headcountUsed: 10,
        headcountCap: 10,
        budgetCommitted: 490000,
        totalCompBudget: 500000,
      });
      const result = await evaluateGuardrails("env-1", utilization);

      expect(result.alerts).toHaveLength(2);
      expect(result.hardBlock).toBe(true);
      const alertTypes = result.alerts.map((a: any) => a.alertType);
      expect(alertTypes).toContain("headcount_breach");
      expect(alertTypes).toContain("budget_breach");
    });
  });
});
