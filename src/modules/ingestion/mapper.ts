const FIELD_ALIASES: Record<string, string[]> = {
  // org_units fields
  org_unit_name: ["department", "dept", "org unit", "organization", "unit name", "name"],
  org_unit_code: ["dept code", "department code", "org code", "unit code", "code"],
  org_unit_level: ["level", "org level", "unit level"],
  parent_id: ["parent", "parent id", "parent org", "reports to"],

  // envelopes fields
  headcount_cap: ["headcount", "hc cap", "head count", "hc limit", "positions"],
  total_comp_budget: ["budget", "total budget", "comp budget", "total comp", "total compensation"],
  comp_band_low: ["band low", "min comp", "comp min", "salary min"],
  comp_band_high: ["band high", "max comp", "comp max", "salary max"],

  // job_slots fields
  role_title: ["role", "title", "job title", "position", "position title", "role title"],
  envelope_id: ["envelope", "envelope id", "budget envelope"],
  job_family: ["job family", "family", "job category", "category"],
  worker_type: ["worker type", "employment type", "type"],
  base_salary: ["salary", "base salary", "annual salary", "base pay", "base"],
  equity_value: ["equity", "equity value", "stock", "rsu"],
  bonus_target: ["bonus", "bonus target", "target bonus"],
  benefits_cost: ["benefits", "benefits cost", "benefit cost"],
  total_comp: ["total comp", "total compensation", "total package"],
  currency_code: ["currency", "currency code", "ccy"],
  target_start_date: ["start date", "target start", "start"],
  justification: ["justification", "reason", "notes"],

  // employees fields
  employee_name: ["employee", "employee name", "full name", "name"],
  employee_email: ["email", "employee email", "work email"],

  // shared
  org_unit: ["team", "department", "dept", "org unit"],
};

export function autoDetectMapping(
  headers: string[],
  targetEntity: string,
): Record<string, string> {
  const mapping: Record<string, string> = {};

  // Filter relevant fields based on target entity
  const relevantPrefixes = getRelevantPrefixes(targetEntity);

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim();

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [fieldName, aliases] of Object.entries(FIELD_ALIASES)) {
      // Skip fields not relevant to target entity
      if (relevantPrefixes.length > 0) {
        const isRelevant = relevantPrefixes.some(
          (prefix) => fieldName.startsWith(prefix) || aliases.some((a) => a === normalizedHeader),
        );
        if (!isRelevant) continue;
      }

      for (const alias of aliases) {
        const score = matchScore(normalizedHeader, alias);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = fieldName;
        }
      }
    }

    if (bestMatch && bestScore > 0.5) {
      mapping[header] = bestMatch;
    }
  }

  return mapping;
}

function getRelevantPrefixes(targetEntity: string): string[] {
  switch (targetEntity) {
    case "org_units":
      return ["org_unit", "parent"];
    case "envelopes":
      return ["headcount", "total_comp", "comp_band", "org_unit"];
    case "job_slots":
      return ["role", "envelope", "job_family", "worker", "base_salary", "equity", "bonus", "benefits", "total_comp", "currency", "target_start", "justification"];
    case "employees":
      return ["employee", "org_unit"];
    default:
      return [];
  }
}

function matchScore(header: string, alias: string): number {
  // Exact match
  if (header === alias) return 1.0;

  // Header contains alias or alias contains header
  if (header.includes(alias)) return 0.8;
  if (alias.includes(header)) return 0.7;

  // Word overlap
  const headerWords = header.split(/[\s_-]+/);
  const aliasWords = alias.split(/[\s_-]+/);
  const commonWords = headerWords.filter((w) => aliasWords.includes(w));

  if (commonWords.length > 0) {
    return (commonWords.length / Math.max(headerWords.length, aliasWords.length)) * 0.6;
  }

  return 0;
}

export function applyMapping(
  row: Record<string, any>,
  mapping: Record<string, string>,
): Record<string, any> {
  const mapped: Record<string, any> = {};

  for (const [sourceCol, targetField] of Object.entries(mapping)) {
    if (sourceCol in row) {
      mapped[targetField] = row[sourceCol];
    }
  }

  return mapped;
}
