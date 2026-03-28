interface ValidationResult {
  valid: boolean;
  errors: { field: string; error: string }[];
}

export function validateRow(
  row: Record<string, any>,
  targetEntity: string,
  rowNumber: number,
): ValidationResult {
  const errors: { field: string; error: string }[] = [];

  switch (targetEntity) {
    case "org_units":
      validateOrgUnit(row, errors);
      break;
    case "envelopes":
      validateEnvelope(row, errors);
      break;
    case "job_slots":
      validateJobSlot(row, errors);
      break;
    default:
      errors.push({ field: "_entity", error: `Unknown target entity: ${targetEntity}` });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateOrgUnit(
  row: Record<string, any>,
  errors: { field: string; error: string }[],
): void {
  if (!row.org_unit_name && !row.name) {
    errors.push({ field: "name", error: "Name is required" });
  }
  if (!row.org_unit_code && !row.code) {
    errors.push({ field: "code", error: "Code is required" });
  }
}

function validateEnvelope(
  row: Record<string, any>,
  errors: { field: string; error: string }[],
): void {
  const hcCap = row.headcount_cap ?? row.headcountCap;
  if (hcCap === undefined || hcCap === null || hcCap === "") {
    errors.push({ field: "headcountCap", error: "Headcount cap is required" });
  } else {
    const parsed = Number(hcCap);
    if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      errors.push({ field: "headcountCap", error: "Headcount cap must be a non-negative integer" });
    }
  }

  const budget = row.total_comp_budget ?? row.totalCompBudget;
  if (budget === undefined || budget === null || budget === "") {
    errors.push({ field: "totalCompBudget", error: "Total comp budget is required" });
  } else {
    const parsed = parseFloat(budget);
    if (isNaN(parsed) || parsed < 0) {
      errors.push({ field: "totalCompBudget", error: "Total comp budget must be a non-negative decimal" });
    }
  }
}

function validateJobSlot(
  row: Record<string, any>,
  errors: { field: string; error: string }[],
): void {
  if (!row.role_title && !row.roleTitle) {
    errors.push({ field: "roleTitle", error: "Role title is required" });
  }
  if (!row.envelope_id && !row.envelopeId) {
    errors.push({ field: "envelopeId", error: "Envelope ID is required" });
  }
}
