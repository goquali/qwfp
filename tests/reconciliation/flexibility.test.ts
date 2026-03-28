let selectCallIndex = 0;
let selectCallResponses: any[][] = [];

const { mockWhere, mockDb } = vi.hoisted(() => {
  const mockWhere = vi.fn(() => Promise.resolve([] as any[]));
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockWhere,
      })),
    })),
  };
  return { mockWhere, mockDb };
});

vi.mock("../../src/db/client.js", () => ({ db: mockDb }));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => ({ op: "eq", val })),
  and: vi.fn((...args: any[]) => ({ op: "and", args })),
  ne: vi.fn((_col: any, val: any) => ({ op: "ne", val })),
}));

vi.mock("../../src/db/schema/finance.js", () => ({
  budgetEnvelopes: { id: "id", compBandLow: "compBandLow" },
}));

vi.mock("../../src/db/schema/hr.js", () => ({
  jobSlots: { envelopeId: "envelopeId", status: "status" },
}));

import { getFlexibilityMetrics } from "../../src/modules/reconciliation/flexibility.js";

function makeEnvelope(overrides: Record<string, any> = {}) {
  return {
    id: "env-1",
    headcountCap: 10,
    totalCompBudget: "500000.00",
    compBandLow: "50000",
    compBandHigh: "150000",
    ...overrides,
  };
}

function makeSlot(overrides: Record<string, any> = {}) {
  return {
    id: "slot-1",
    envelopeId: "env-1",
    status: "open",
    totalCompBase: "100000.00",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  selectCallIndex = 0;
  selectCallResponses = [];

  mockWhere.mockImplementation(() => {
    const result = selectCallResponses[selectCallIndex] ?? [];
    selectCallIndex++;
    return Promise.resolve(result);
  });
});

describe("getFlexibilityMetrics", () => {
  it("returns 100% flexibility and full headcountRemaining for empty envelope", async () => {
    selectCallResponses = [
      [makeEnvelope()],
      [],
    ];

    const result = await getFlexibilityMetrics("env-1");

    expect(result.flexibilityPct).toBe(100);
    expect(result.headcountRemaining).toBe(10);
    expect(result.budgetRemaining).toBe(500000);
    expect(result.canAddAtBandLow).toBe(10);
  });

  it("returns 50% flexibility for half-filled envelope", async () => {
    const slots = Array.from({ length: 5 }, (_, i) =>
      makeSlot({ id: `slot-${i}`, totalCompBase: "50000.00" }),
    );

    selectCallResponses = [
      [makeEnvelope()],
      slots,
    ];

    const result = await getFlexibilityMetrics("env-1");

    expect(result.flexibilityPct).toBe(50);
    expect(result.headcountRemaining).toBe(5);
    expect(result.budgetRemaining).toBe(250000);
  });

  it("returns 0% flexibility for fully-consumed envelope", async () => {
    const slots = Array.from({ length: 10 }, (_, i) =>
      makeSlot({ id: `slot-${i}`, totalCompBase: "50000.00" }),
    );

    selectCallResponses = [
      [makeEnvelope()],
      slots,
    ];

    const result = await getFlexibilityMetrics("env-1");

    expect(result.flexibilityPct).toBe(0);
    expect(result.headcountRemaining).toBe(0);
    expect(result.budgetRemaining).toBe(0);
    expect(result.canAddAtBandLow).toBe(0);
  });

  it("calculates canAddAtBandLow correctly when budget-limited", async () => {
    const slots = Array.from({ length: 8 }, (_, i) =>
      makeSlot({ id: `slot-${i}`, totalCompBase: "50000.00" }),
    );

    selectCallResponses = [
      [makeEnvelope()],
      slots,
    ];

    const result = await getFlexibilityMetrics("env-1");

    expect(result.canAddAtBandLow).toBe(2);
    expect(result.headcountRemaining).toBe(2);
    expect(result.budgetRemaining).toBe(100000);
  });

  it("calculates canAddAtBandLow limited by headcount when budget is ample", async () => {
    const slots = Array.from({ length: 9 }, (_, i) =>
      makeSlot({ id: `slot-${i}`, totalCompBase: "10000.00" }),
    );

    selectCallResponses = [
      [makeEnvelope()],
      slots,
    ];

    const result = await getFlexibilityMetrics("env-1");

    expect(result.canAddAtBandLow).toBe(1);
    expect(result.headcountRemaining).toBe(1);
  });

  it("throws NotFoundError when envelope does not exist", async () => {
    selectCallResponses = [[]];

    await expect(getFlexibilityMetrics("nonexistent")).rejects.toThrow(
      "BudgetEnvelope with id nonexistent not found",
    );
  });
});
