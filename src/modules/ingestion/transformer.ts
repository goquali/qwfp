export function transformRow(
  row: Record<string, any>,
  targetEntity: string,
): Record<string, any> {
  const transformed: Record<string, any> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null) {
      transformed[key] = null;
      continue;
    }

    transformed[key] = transformValue(key, value, targetEntity);
  }

  return transformed;
}

function transformValue(key: string, value: any, targetEntity: string): any {
  const strValue = typeof value === "string" ? value.trim() : value;

  // Numeric fields - parse to number then format
  const numericFields = [
    "headcount_cap",
    "headcountCap",
    "total_comp_budget",
    "totalCompBudget",
    "base_salary",
    "baseSalary",
    "equity_value",
    "equityValue",
    "bonus_target",
    "bonusTarget",
    "benefits_cost",
    "benefitsCost",
    "total_comp",
    "totalComp",
    "comp_band_low",
    "compBandLow",
    "comp_band_high",
    "compBandHigh",
  ];

  const integerFields = ["headcount_cap", "headcountCap"];

  if (numericFields.includes(key)) {
    const cleaned = typeof strValue === "string"
      ? strValue.replace(/[$,\s]/g, "")
      : strValue;
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return null;
    if (integerFields.includes(key)) return Math.round(parsed);
    return parsed.toFixed(2);
  }

  // Level normalization
  if (key === "level" || key === "org_unit_level") {
    return normalizeLevel(strValue);
  }

  // String fields - trim
  if (typeof strValue === "string") {
    return strValue;
  }

  return strValue;
}

function normalizeLevel(value: any): string {
  if (typeof value !== "string") return String(value);

  const lower = value.toLowerCase().trim();

  // Normalize common level names
  const levelMap: Record<string, string> = {
    junior: "L3",
    mid: "L4",
    "mid-level": "L4",
    senior: "L5",
    staff: "L6",
    principal: "L7",
    director: "L8",
    vp: "L9",
    "vice president": "L9",
    svp: "L10",
    "c-level": "L11",
    executive: "L11",
  };

  return levelMap[lower] ?? value.trim();
}
