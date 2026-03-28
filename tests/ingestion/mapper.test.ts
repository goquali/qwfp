import { autoDetectMapping, applyMapping } from "../../src/modules/ingestion/mapper.js";

describe("autoDetectMapping", () => {
  describe("column auto-detection", () => {
    it("maps 'Department' header to org_unit field for envelopes", () => {
      const mapping = autoDetectMapping(["Department"], "envelopes");
      // "department" alias exists on both org_unit_name and org_unit; for envelopes, org_unit prefix is relevant
      expect(mapping["Department"]).toBeDefined();
      expect(["org_unit", "org_unit_name"]).toContain(mapping["Department"]);
    });

    it("maps 'Job Title' header to role_title field", () => {
      const mapping = autoDetectMapping(["Job Title"], "job_slots");
      expect(mapping["Job Title"]).toBe("role_title");
    });

    it("maps 'Salary' header to base_salary field", () => {
      const mapping = autoDetectMapping(["Salary"], "job_slots");
      expect(mapping["Salary"]).toBe("base_salary");
    });

    it("maps 'Total Budget' header to total_comp_budget field", () => {
      const mapping = autoDetectMapping(["Total Budget"], "envelopes");
      expect(mapping["Total Budget"]).toBe("total_comp_budget");
    });

    it("handles case-insensitive matching", () => {
      const mapping = autoDetectMapping(["DEPARTMENT", "salary", "Job title"], "job_slots");
      // "DEPARTMENT" normalized to "department" matches aliases for org_unit or org_unit_name
      expect(mapping["DEPARTMENT"]).toBeDefined();
      expect(mapping["salary"]).toBe("base_salary");
      expect(mapping["Job title"]).toBe("role_title");
    });

    it("maps multiple headers for job_slots entity", () => {
      const headers = ["Job Title", "Salary", "Equity", "Bonus", "Currency"];
      const mapping = autoDetectMapping(headers, "job_slots");

      expect(mapping["Job Title"]).toBe("role_title");
      expect(mapping["Salary"]).toBe("base_salary");
      expect(mapping["Equity"]).toBe("equity_value");
      expect(mapping["Bonus"]).toBe("bonus_target");
      expect(mapping["Currency"]).toBe("currency_code");
    });

    it("maps org_units headers correctly", () => {
      const mapping = autoDetectMapping(["Department", "Dept Code", "Level"], "org_units");
      expect(mapping["Department"]).toBe("org_unit_name");
      expect(mapping["Dept Code"]).toBe("org_unit_code");
      expect(mapping["Level"]).toBe("org_unit_level");
    });
  });

  describe("applyMapping", () => {
    it("transforms a row using the provided mapping", () => {
      const row = {
        "Job Title": "Software Engineer",
        "Salary": "150000",
        "Department": "Engineering",
      };
      const mapping = {
        "Job Title": "role_title",
        "Salary": "base_salary",
        "Department": "org_unit",
      };

      const result = applyMapping(row, mapping);

      expect(result).toEqual({
        role_title: "Software Engineer",
        base_salary: "150000",
        org_unit: "Engineering",
      });
    });

    it("only includes mapped columns, ignoring unmapped ones", () => {
      const row = {
        "Job Title": "PM",
        "Random Column": "ignored",
      };
      const mapping = {
        "Job Title": "role_title",
      };

      const result = applyMapping(row, mapping);

      expect(result).toEqual({ role_title: "PM" });
      expect(result).not.toHaveProperty("Random Column");
    });

    it("skips mapping entries where source column is not in row", () => {
      const row = { "Job Title": "Designer" };
      const mapping = {
        "Job Title": "role_title",
        "Missing Column": "base_salary",
      };

      const result = applyMapping(row, mapping);

      expect(result).toEqual({ role_title: "Designer" });
      expect(result).not.toHaveProperty("base_salary");
    });
  });
});
