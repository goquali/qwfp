import { db } from "../../db/client.js";
import { orgUnits } from "../../db/schema/core.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import { importRecords } from "../../db/schema/ingestion.js";

export interface MappedRecord {
  rowNumber: number;
  data: Record<string, any>;
}

export interface ImportStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export async function loadRecords(
  jobId: string,
  records: MappedRecord[],
  targetEntity: string,
): Promise<ImportStats> {
  const stats: ImportStats = { created: 0, updated: 0, skipped: 0, errors: 0 };

  await db.transaction(async (tx) => {
    for (const record of records) {
      try {
        const entityId = await insertEntity(tx, record.data, targetEntity);

        if (entityId) {
          await tx.insert(importRecords).values({
            importJobId: jobId,
            rowNumber: record.rowNumber,
            sourceData: record.data,
            mappedData: record.data,
            targetEntityType: targetEntity,
            targetEntityId: entityId,
            status: "imported",
          });
          stats.created++;
        } else {
          await tx.insert(importRecords).values({
            importJobId: jobId,
            rowNumber: record.rowNumber,
            sourceData: record.data,
            mappedData: record.data,
            targetEntityType: targetEntity,
            status: "skipped",
            errorMessage: "Entity could not be created",
          });
          stats.skipped++;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        await tx.insert(importRecords).values({
          importJobId: jobId,
          rowNumber: record.rowNumber,
          sourceData: record.data,
          mappedData: record.data,
          targetEntityType: targetEntity,
          status: "error",
          errorMessage,
        });
        stats.errors++;
      }
    }
  });

  return stats;
}

async function insertEntity(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  data: Record<string, any>,
  targetEntity: string,
): Promise<string | null> {
  switch (targetEntity) {
    case "org_units": {
      const [result] = await tx
        .insert(orgUnits)
        .values({
          name: data.org_unit_name ?? data.name,
          code: data.org_unit_code ?? data.code,
          level: data.org_unit_level ?? data.level ?? "team",
          parentId: data.parent_id ?? null,
          headUserId: data.head_user_id ?? null,
        })
        .returning({ id: orgUnits.id });
      return result?.id ?? null;
    }

    case "envelopes": {
      const [result] = await tx
        .insert(budgetEnvelopes)
        .values({
          planningCycleId: data.planning_cycle_id ?? data.planningCycleId,
          orgUnitId: data.org_unit_id ?? data.orgUnitId,
          headcountCap: parseInt(data.headcount_cap ?? data.headcountCap, 10),
          totalCompBudget: String(data.total_comp_budget ?? data.totalCompBudget),
          compBandLow: data.comp_band_low ?? data.compBandLow ?? null,
          compBandHigh: data.comp_band_high ?? data.compBandHigh ?? null,
        })
        .returning({ id: budgetEnvelopes.id });
      return result?.id ?? null;
    }

    case "job_slots": {
      const [result] = await tx
        .insert(jobSlots)
        .values({
          envelopeId: data.envelope_id ?? data.envelopeId,
          roleTitle: data.role_title ?? data.roleTitle,
          jobFamilyId: data.job_family_id ?? data.jobFamilyId ?? null,
          level: data.level ?? null,
          workerType: data.worker_type ?? data.workerType ?? "fte",
          baseSalary: data.base_salary ?? data.baseSalary ?? null,
          equityValue: data.equity_value ?? data.equityValue ?? null,
          bonusTarget: data.bonus_target ?? data.bonusTarget ?? null,
          benefitsCost: data.benefits_cost ?? data.benefitsCost ?? null,
          totalComp: data.total_comp ?? data.totalComp ?? null,
          currencyCode: data.currency_code ?? data.currencyCode ?? "USD",
          targetStartDate: data.target_start_date ?? data.targetStartDate ?? null,
          justification: data.justification ?? null,
          status: "draft",
        })
        .returning({ id: jobSlots.id });
      return result?.id ?? null;
    }

    default:
      return null;
  }
}
