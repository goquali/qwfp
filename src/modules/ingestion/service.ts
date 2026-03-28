import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  importJobs,
  importRecords,
  fieldMappings,
} from "../../db/schema/ingestion.js";
import { orgUnits } from "../../db/schema/core.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import { NotFoundError } from "../../shared/errors.js";
import { parseCsvData } from "./parsers/csv.js";
import { parseXlsxData } from "./parsers/xlsx.js";
import { parseJsonData } from "./parsers/json.js";
import { autoDetectMapping, applyMapping } from "./mapper.js";
import { validateRow } from "./validator.js";
import { transformRow } from "./transformer.js";
import { loadRecords } from "./loader.js";
import type { MappedRecord } from "./loader.js";

// ---- Import Jobs ----

interface CreateImportJobInput {
  sourceType: "csv" | "xlsx" | "json" | "hris_api";
  sourceName: string;
  targetEntity: "org_units" | "envelopes" | "job_slots" | "employees" | "mixed";
  filePath?: string;
  rawData?: string;
}

export async function createImportJob(input: CreateImportJobInput, userId: string) {
  const [job] = await db
    .insert(importJobs)
    .values({
      createdBy: userId,
      sourceType: input.sourceType,
      sourceName: input.sourceName,
      targetEntity: input.targetEntity,
      filePath: input.filePath ?? null,
      status: "uploaded",
    })
    .returning();
  return job;
}

export async function getImportJobById(id: string) {
  const [job] = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, id));
  if (!job) throw new NotFoundError("ImportJob", id);
  return job;
}

export async function submitColumnMapping(
  jobId: string,
  mapping: Record<string, string>,
) {
  const job = await getImportJobById(jobId);

  const [updated] = await db
    .update(importJobs)
    .set({
      columnMapping: mapping,
      status: "mapping",
    })
    .where(eq(importJobs.id, jobId))
    .returning();

  return updated;
}

export async function runValidation(jobId: string) {
  const job = await getImportJobById(jobId);

  // Transition to validating
  await db
    .update(importJobs)
    .set({ status: "validating" })
    .where(eq(importJobs.id, jobId));

  // Parse source data
  const rows = await parseSourceData(job);
  const mapping = (job.columnMapping as Record<string, string>) ?? {};

  const allErrors: { row: number; field: string; error: string }[] = [];
  let validCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const mappedRow = Object.keys(mapping).length > 0
      ? applyMapping(rows[i], mapping)
      : rows[i];
    const transformed = transformRow(mappedRow, job.targetEntity);
    const result = validateRow(transformed, job.targetEntity, i + 1);

    if (result.valid) {
      validCount++;
      // Store as validated record
      await db.insert(importRecords).values({
        importJobId: jobId,
        rowNumber: i + 1,
        sourceData: rows[i],
        mappedData: transformed,
        targetEntityType: job.targetEntity,
        status: "validated",
      });
    } else {
      for (const err of result.errors) {
        allErrors.push({ row: i + 1, field: err.field, error: err.error });
      }
      await db.insert(importRecords).values({
        importJobId: jobId,
        rowNumber: i + 1,
        sourceData: rows[i],
        mappedData: mappedRow,
        targetEntityType: job.targetEntity,
        status: "error",
        errorMessage: result.errors.map((e) => `${e.field}: ${e.error}`).join("; "),
      });
    }
  }

  const previewSummary = {
    totalRows: rows.length,
    validRows: validCount,
    errorRows: rows.length - validCount,
    entitiesToCreate: validCount,
    errors: allErrors,
  };

  // Transition to preview
  const [updated] = await db
    .update(importJobs)
    .set({
      status: "preview",
      validationErrors: allErrors.length > 0 ? allErrors : null,
      previewSummary,
    })
    .where(eq(importJobs.id, jobId))
    .returning();

  return updated;
}

export async function getPreview(jobId: string) {
  const job = await getImportJobById(jobId);
  return {
    jobId: job.id,
    status: job.status,
    previewSummary: job.previewSummary,
    validationErrors: job.validationErrors,
  };
}

export async function executeImport(jobId: string) {
  const job = await getImportJobById(jobId);

  // Transition to importing
  await db
    .update(importJobs)
    .set({ status: "importing" })
    .where(eq(importJobs.id, jobId));

  // Get validated records
  const validatedRecords = await db
    .select()
    .from(importRecords)
    .where(eq(importRecords.importJobId, jobId));

  const toLoad: MappedRecord[] = validatedRecords
    .filter((r) => r.status === "validated")
    .map((r) => ({
      rowNumber: r.rowNumber,
      data: r.mappedData as Record<string, any>,
    }));

  // Delete existing import records so loader can re-create them
  await db
    .delete(importRecords)
    .where(eq(importRecords.importJobId, jobId));

  const stats = await loadRecords(jobId, toLoad, job.targetEntity);

  // Transition to completed
  const [updated] = await db
    .update(importJobs)
    .set({
      status: "completed",
      importStats: stats,
      completedAt: new Date(),
    })
    .where(eq(importJobs.id, jobId))
    .returning();

  return updated;
}

export async function rollbackImport(jobId: string) {
  const job = await getImportJobById(jobId);

  // Get imported records with target entity IDs
  const records = await db
    .select()
    .from(importRecords)
    .where(eq(importRecords.importJobId, jobId));

  const importedRecords = records.filter(
    (r) => r.status === "imported" && r.targetEntityId,
  );

  // Delete created entities
  await db.transaction(async (tx) => {
    for (const record of importedRecords) {
      if (!record.targetEntityId || !record.targetEntityType) continue;

      try {
        switch (record.targetEntityType) {
          case "org_units":
            await tx
              .delete(orgUnits)
              .where(eq(orgUnits.id, record.targetEntityId));
            break;
          case "envelopes":
            await tx
              .delete(budgetEnvelopes)
              .where(eq(budgetEnvelopes.id, record.targetEntityId));
            break;
          case "job_slots":
            await tx
              .delete(jobSlots)
              .where(eq(jobSlots.id, record.targetEntityId));
            break;
        }
      } catch {
        // Entity may already be deleted or have dependencies; continue
      }
    }
  });

  // Transition to rolled_back
  const [updated] = await db
    .update(importJobs)
    .set({ status: "rolled_back" })
    .where(eq(importJobs.id, jobId))
    .returning();

  return updated;
}

// ---- Field Mappings ----

interface CreateFieldMappingInput {
  name: string;
  sourceType: "csv" | "xlsx" | "json" | "hris_api";
  targetEntity: "org_units" | "envelopes" | "job_slots" | "employees" | "mixed";
  mappings: Record<string, string>;
}

export async function createFieldMapping(
  input: CreateFieldMappingInput,
  userId: string,
) {
  const [mapping] = await db
    .insert(fieldMappings)
    .values({
      name: input.name,
      sourceType: input.sourceType,
      targetEntity: input.targetEntity,
      mappings: input.mappings,
      createdBy: userId,
    })
    .returning();
  return mapping;
}

export async function getFieldMappings() {
  return db.select().from(fieldMappings);
}

// ---- Helpers ----

async function parseSourceData(
  job: typeof importJobs.$inferSelect,
): Promise<Record<string, any>[]> {
  // For MVP, we expect rawData stored in filePath or as part of the job
  // In production, this would read from S3/GCS
  const rawData = job.filePath ?? "";

  switch (job.sourceType) {
    case "csv":
      return parseCsvData(rawData);
    case "xlsx":
      return parseXlsxData(Buffer.from(rawData, "base64"));
    case "json":
      return parseJsonData(rawData);
    default:
      return [];
  }
}
