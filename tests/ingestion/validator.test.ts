import { validateRow } from "../../src/modules/ingestion/validator.js";

describe("validateRow", () => {
  describe("org_units validation", () => {
    it("passes for a valid org_unit row", () => {
      const result = validateRow(
        { org_unit_name: "Engineering", org_unit_code: "ENG" },
        "org_units",
        1,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("also accepts 'name' and 'code' fields", () => {
      const result = validateRow(
        { name: "Engineering", code: "ENG" },
        "org_units",
        1,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails when required name field is missing", () => {
      const result = validateRow(
        { org_unit_code: "ENG" },
        "org_units",
        1,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "name", error: "Name is required" }),
        ]),
      );
    });

    it("fails when required code field is missing", () => {
      const result = validateRow({ org_unit_name: "Eng" }, "org_units", 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "code" }),
        ]),
      );
    });
  });

  describe("envelopes validation", () => {
    it("passes for a valid envelope row", () => {
      const result = validateRow(
        { headcount_cap: 10, total_comp_budget: "500000.00" },
        "envelopes",
        1,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("also accepts camelCase field names", () => {
      const result = validateRow(
        { headcountCap: 5, totalCompBudget: "100000" },
        "envelopes",
        1,
      );
      expect(result.valid).toBe(true);
    });

    it("fails when headcountCap is not a valid number", () => {
      const result = validateRow(
        { headcount_cap: "abc", total_comp_budget: "500000" },
        "envelopes",
        1,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "headcountCap",
            error: "Headcount cap must be a non-negative integer",
          }),
        ]),
      );
    });

    it("fails when headcountCap is a negative number", () => {
      const result = validateRow(
        { headcount_cap: -3, total_comp_budget: "500000" },
        "envelopes",
        1,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "headcountCap" }),
        ]),
      );
    });

    it("fails when headcountCap is a float", () => {
      const result = validateRow(
        { headcount_cap: 3.7, total_comp_budget: "500000" },
        "envelopes",
        1,
      );
      expect(result.valid).toBe(false);
    });

    it("fails when totalCompBudget is missing", () => {
      const result = validateRow(
        { headcount_cap: 10 },
        "envelopes",
        1,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "totalCompBudget" }),
        ]),
      );
    });
  });

  describe("job_slots validation", () => {
    it("passes for a valid job_slot row", () => {
      const result = validateRow(
        { role_title: "Software Engineer", envelope_id: "env-1" },
        "job_slots",
        1,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("also accepts camelCase field names", () => {
      const result = validateRow(
        { roleTitle: "PM", envelopeId: "env-2" },
        "job_slots",
        1,
      );
      expect(result.valid).toBe(true);
    });

    it("fails when roleTitle is missing", () => {
      const result = validateRow(
        { envelope_id: "env-1" },
        "job_slots",
        1,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "roleTitle",
            error: "Role title is required",
          }),
        ]),
      );
    });

    it("fails when envelopeId is missing", () => {
      const result = validateRow(
        { role_title: "Engineer" },
        "job_slots",
        1,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "envelopeId" }),
        ]),
      );
    });
  });

  describe("unknown entity", () => {
    it("returns error for unknown target entity", () => {
      const result = validateRow({}, "unknown_entity", 1);
      expect(result.valid).toBe(false);
      expect(result.errors[0].error).toContain("Unknown target entity");
    });
  });
});
