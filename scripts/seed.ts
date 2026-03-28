/**
 * QWFP Seed Script — Populates TechCorp demo data via the service layer.
 * Run: npx tsx scripts/seed.ts
 */

import { db } from "../src/db/client.js";
import * as coreService from "../src/modules/core/service.js";
import * as financeService from "../src/modules/finance/service.js";
import * as hrService from "../src/modules/hr/service.js";
import * as taService from "../src/modules/ta/service.js";
import { recalculateEnvelope } from "../src/modules/reconciliation/engine.js";

// Table schemas for cleanup
import { users, orgUnits, costCenters, currencies, exchangeRates } from "../src/db/schema/core.js";
import {
  planningCycles,
  budgetEnvelopes,
  budgetAmendments,
  guardrailConfigs,
} from "../src/db/schema/finance.js";
import {
  jobFamilies,
  jobSlots,
  jobSlotChanges,
  changeRequests,
} from "../src/db/schema/hr.js";
import {
  recruiters,
  recruiterAssignments,
  pipelineVelocity,
  taCapacitySnapshots,
} from "../src/db/schema/ta.js";
import {
  envelopeSnapshots,
  driftAlerts,
  scenarios,
  scenarioActions,
  mobilityEvents,
} from "../src/db/schema/reconciliation.js";
import {
  importJobs,
  importRecords,
  fieldMappings,
} from "../src/db/schema/ingestion.js";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helper to transition a slot through multiple statuses in order
// ---------------------------------------------------------------------------
async function transitionThrough(
  slotId: string,
  statuses: string[],
  userId: string,
) {
  for (const status of statuses) {
    await hrService.transitionSlotStatus(slotId, status, userId);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== QWFP Seed Script ===\n");

  // ------------------------------------------------------------------
  // 1. Clean existing data (reverse dependency order)
  // ------------------------------------------------------------------
  console.log("Cleaning existing data...");

  // Leaf tables first, then parent tables
  await db.delete(scenarioActions);
  await db.delete(scenarios);
  await db.delete(mobilityEvents);
  await db.delete(driftAlerts);
  await db.delete(envelopeSnapshots);
  await db.delete(importRecords);
  await db.delete(importJobs);
  await db.delete(fieldMappings);
  await db.delete(taCapacitySnapshots);
  await db.delete(pipelineVelocity);
  await db.delete(recruiterAssignments);
  await db.delete(recruiters);
  await db.delete(jobSlotChanges);
  await db.delete(changeRequests);
  await db.delete(jobSlots);
  await db.delete(jobFamilies);
  await db.delete(budgetAmendments);
  await db.delete(guardrailConfigs);
  await db.delete(budgetEnvelopes);
  await db.delete(planningCycles);
  await db.delete(costCenters);
  await db.delete(exchangeRates);
  await db.delete(currencies);
  await db.delete(orgUnits);
  await db.delete(users);

  console.log("Cleaning existing data... ✓\n");

  // ------------------------------------------------------------------
  // 2. Create Users (8)
  // ------------------------------------------------------------------
  console.log("Creating users...");

  const sarah = await coreService.createUser({
    email: "sarah@techcorp.com",
    name: "Sarah Chen",
    role: "finance",
  });
  const marcus = await coreService.createUser({
    email: "marcus@techcorp.com",
    name: "Marcus Johnson",
    role: "hr",
  });
  const priya = await coreService.createUser({
    email: "priya@techcorp.com",
    name: "Priya Patel",
    role: "business_owner",
  });
  const james = await coreService.createUser({
    email: "james@techcorp.com",
    name: "James Wilson",
    role: "business_owner",
  });
  const emily = await coreService.createUser({
    email: "emily@techcorp.com",
    name: "Emily Rodriguez",
    role: "ta",
  });
  const david = await coreService.createUser({
    email: "david@techcorp.com",
    name: "David Kim",
    role: "ta",
  });
  const lisa = await coreService.createUser({
    email: "lisa@techcorp.com",
    name: "Lisa Wang",
    role: "ta",
  });
  const alex = await coreService.createUser({
    email: "alex@techcorp.com",
    name: "Alex Thompson",
    role: "admin",
  });

  console.log("Creating users... ✓ (8 users)\n");

  // ------------------------------------------------------------------
  // 3. Create Currencies & Exchange Rates
  // ------------------------------------------------------------------
  console.log("Creating currencies...");

  await coreService.createCurrency({ code: "USD", name: "United States Dollar", symbol: "$" });
  await coreService.createCurrency({ code: "EUR", name: "Euro", symbol: "€" });
  await coreService.createCurrency({ code: "GBP", name: "British Pound", symbol: "£" });

  await coreService.createExchangeRate({
    fromCurrency: "EUR",
    toCurrency: "USD",
    rate: "1.08",
    effectiveDate: "2026-01-01",
    source: "seed",
  });
  await coreService.createExchangeRate({
    fromCurrency: "GBP",
    toCurrency: "USD",
    rate: "1.27",
    effectiveDate: "2026-01-01",
    source: "seed",
  });

  console.log("Creating currencies... ✓ (3 currencies, 2 exchange rates)\n");

  // ------------------------------------------------------------------
  // 4. Create Org Structure
  // ------------------------------------------------------------------
  console.log("Creating org structure...");

  // Root
  const techcorp = await coreService.createOrgUnit({
    name: "TechCorp",
    code: "TECHCORP",
    level: "company",
    headUserId: alex.id,
  });

  // Divisions
  const engineering = await coreService.createOrgUnit({
    parentId: techcorp.id,
    name: "Engineering",
    code: "ENG",
    level: "division",
    headUserId: priya.id,
  });
  const product = await coreService.createOrgUnit({
    parentId: techcorp.id,
    name: "Product",
    code: "PROD",
    level: "division",
    headUserId: james.id,
  });
  const gtm = await coreService.createOrgUnit({
    parentId: techcorp.id,
    name: "Go-to-Market",
    code: "GTM",
    level: "division",
  });

  // Engineering departments
  const platformEng = await coreService.createOrgUnit({
    parentId: engineering.id,
    name: "Platform Engineering",
    code: "ENG-PLT",
    level: "department",
  });
  const productEng = await coreService.createOrgUnit({
    parentId: engineering.id,
    name: "Product Engineering",
    code: "ENG-PROD",
    level: "department",
  });

  // Platform Engineering teams
  const infra = await coreService.createOrgUnit({
    parentId: platformEng.id,
    name: "Infrastructure",
    code: "ENG-PLT-INFRA",
    level: "team",
  });
  const devex = await coreService.createOrgUnit({
    parentId: platformEng.id,
    name: "Developer Experience",
    code: "ENG-PLT-DEVEX",
    level: "team",
  });

  // Product Engineering teams
  const growth = await coreService.createOrgUnit({
    parentId: productEng.id,
    name: "Growth",
    code: "ENG-PROD-GROWTH",
    level: "team",
  });
  const coreProduct = await coreService.createOrgUnit({
    parentId: productEng.id,
    name: "Core Product",
    code: "ENG-PROD-CORE",
    level: "team",
  });

  // Product departments
  const prodMgmt = await coreService.createOrgUnit({
    parentId: product.id,
    name: "Product Management",
    code: "PROD-PM",
    level: "department",
  });
  const design = await coreService.createOrgUnit({
    parentId: product.id,
    name: "Design",
    code: "PROD-DES",
    level: "department",
  });

  // GTM departments
  const sales = await coreService.createOrgUnit({
    parentId: gtm.id,
    name: "Sales",
    code: "GTM-SALES",
    level: "department",
  });
  const marketing = await coreService.createOrgUnit({
    parentId: gtm.id,
    name: "Marketing",
    code: "GTM-MKT",
    level: "department",
  });

  console.log("Creating org structure... ✓ (13 org units)\n");

  // ------------------------------------------------------------------
  // 5. Create Cost Centers
  // ------------------------------------------------------------------
  console.log("Creating cost centers...");

  const ccEngPlt = await coreService.createCostCenter({
    code: "ENG-PLT",
    name: "Platform Engineering",
    orgUnitId: platformEng.id,
  });
  const ccEngProd = await coreService.createCostCenter({
    code: "ENG-PROD",
    name: "Product Engineering",
    orgUnitId: productEng.id,
  });
  const ccProdPm = await coreService.createCostCenter({
    code: "PROD-PM",
    name: "Product Management",
    orgUnitId: prodMgmt.id,
  });
  const ccProdDes = await coreService.createCostCenter({
    code: "PROD-DES",
    name: "Design",
    orgUnitId: design.id,
  });
  const ccGtmSales = await coreService.createCostCenter({
    code: "GTM-SALES",
    name: "Sales",
    orgUnitId: sales.id,
  });
  const ccGtmMkt = await coreService.createCostCenter({
    code: "GTM-MKT",
    name: "Marketing",
    orgUnitId: marketing.id,
  });

  console.log("Creating cost centers... ✓ (6 cost centers)\n");

  // ------------------------------------------------------------------
  // 6. Create Planning Cycle
  // ------------------------------------------------------------------
  console.log("Creating planning cycle...");

  const fy26 = await financeService.createPlanningCycle(
    {
      name: "FY26",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      baseCurrency: "USD",
    },
    alex.id,
  );

  // Transition: draft → under_review → approved → active
  await financeService.updatePlanningCycle(fy26.id, { status: "under_review" });
  await financeService.updatePlanningCycle(fy26.id, { status: "approved" });
  await financeService.updatePlanningCycle(fy26.id, { status: "active" });

  console.log("Creating planning cycle... ✓ (FY26, active)\n");

  // ------------------------------------------------------------------
  // 7. Create Budget Envelopes (hierarchical)
  // ------------------------------------------------------------------
  console.log("Creating budget envelopes...");

  // Division-level envelopes (no comp bands, no cost center)
  const envEng = await financeService.createEnvelope(fy26.id, {
    orgUnitId: engineering.id,
    headcountCap: 25,
    totalCompBudget: "4500000.00",
  });
  const envProd = await financeService.createEnvelope(fy26.id, {
    orgUnitId: product.id,
    headcountCap: 8,
    totalCompBudget: "1400000.00",
    compBandLow: "120000.00",
    compBandHigh: "190000.00",
  });
  const envGtm = await financeService.createEnvelope(fy26.id, {
    orgUnitId: gtm.id,
    headcountCap: 10,
    totalCompBudget: "1500000.00",
    compBandLow: "100000.00",
    compBandHigh: "180000.00",
  });

  // Department-level envelopes under Engineering
  const envPlatformEng = await financeService.createEnvelope(fy26.id, {
    orgUnitId: platformEng.id,
    parentEnvelopeId: envEng.id,
    headcountCap: 12,
    totalCompBudget: "2200000.00",
    compBandLow: "140000.00",
    compBandHigh: "220000.00",
  });
  const envProductEng = await financeService.createEnvelope(fy26.id, {
    orgUnitId: productEng.id,
    parentEnvelopeId: envEng.id,
    headcountCap: 13,
    totalCompBudget: "2300000.00",
    compBandLow: "130000.00",
    compBandHigh: "200000.00",
  });

  // Team-level envelopes under Platform Engineering
  const envInfra = await financeService.createEnvelope(fy26.id, {
    orgUnitId: infra.id,
    parentEnvelopeId: envPlatformEng.id,
    costCenterId: ccEngPlt.id,
    headcountCap: 6,
    totalCompBudget: "1100000.00",
    compBandLow: "140000.00",
    compBandHigh: "220000.00",
    startWindow: "2026-01-01",
    endWindow: "2026-12-31",
    autoApproveThresholdPct: "10.00",
  });
  const envDevex = await financeService.createEnvelope(fy26.id, {
    orgUnitId: devex.id,
    parentEnvelopeId: envPlatformEng.id,
    costCenterId: ccEngPlt.id,
    headcountCap: 6,
    totalCompBudget: "1100000.00",
    compBandLow: "140000.00",
    compBandHigh: "220000.00",
    startWindow: "2026-01-01",
    endWindow: "2026-12-31",
    autoApproveThresholdPct: "10.00",
  });

  // Team-level envelopes under Product Engineering
  const envGrowth = await financeService.createEnvelope(fy26.id, {
    orgUnitId: growth.id,
    parentEnvelopeId: envProductEng.id,
    costCenterId: ccEngProd.id,
    headcountCap: 7,
    totalCompBudget: "1200000.00",
    compBandLow: "130000.00",
    compBandHigh: "200000.00",
    startWindow: "2026-01-01",
    endWindow: "2026-12-31",
    autoApproveThresholdPct: "10.00",
  });
  const envCoreProduct = await financeService.createEnvelope(fy26.id, {
    orgUnitId: coreProduct.id,
    parentEnvelopeId: envProductEng.id,
    costCenterId: ccEngProd.id,
    headcountCap: 6,
    totalCompBudget: "1100000.00",
    compBandLow: "130000.00",
    compBandHigh: "200000.00",
    startWindow: "2026-01-01",
    endWindow: "2026-12-31",
    autoApproveThresholdPct: "10.00",
  });

  // Department-level envelopes under Product
  const envProdMgmt = await financeService.createEnvelope(fy26.id, {
    orgUnitId: prodMgmt.id,
    parentEnvelopeId: envProd.id,
    costCenterId: ccProdPm.id,
    headcountCap: 5,
    totalCompBudget: "900000.00",
    compBandLow: "130000.00",
    compBandHigh: "190000.00",
    startWindow: "2026-01-01",
    endWindow: "2026-12-31",
    autoApproveThresholdPct: "10.00",
  });
  const envDesign = await financeService.createEnvelope(fy26.id, {
    orgUnitId: design.id,
    parentEnvelopeId: envProd.id,
    costCenterId: ccProdDes.id,
    headcountCap: 3,
    totalCompBudget: "500000.00",
    compBandLow: "120000.00",
    compBandHigh: "170000.00",
    startWindow: "2026-01-01",
    endWindow: "2026-12-31",
    autoApproveThresholdPct: "10.00",
  });

  // Department-level envelopes under GTM
  const envSales = await financeService.createEnvelope(fy26.id, {
    orgUnitId: sales.id,
    parentEnvelopeId: envGtm.id,
    costCenterId: ccGtmSales.id,
    headcountCap: 6,
    totalCompBudget: "900000.00",
    compBandLow: "100000.00",
    compBandHigh: "180000.00",
    startWindow: "2026-01-01",
    endWindow: "2026-12-31",
    autoApproveThresholdPct: "10.00",
  });
  const envMarketing = await financeService.createEnvelope(fy26.id, {
    orgUnitId: marketing.id,
    parentEnvelopeId: envGtm.id,
    costCenterId: ccGtmMkt.id,
    headcountCap: 4,
    totalCompBudget: "600000.00",
    compBandLow: "110000.00",
    compBandHigh: "160000.00",
    startWindow: "2026-01-01",
    endWindow: "2026-12-31",
    autoApproveThresholdPct: "10.00",
  });

  console.log("Creating budget envelopes... ✓ (13 envelopes)\n");

  // ------------------------------------------------------------------
  // 8. Create Guardrails for team-level envelopes
  // ------------------------------------------------------------------
  console.log("Creating guardrails...");

  const teamEnvelopes = [
    envInfra, envDevex, envGrowth, envCoreProduct,
    envProdMgmt, envDesign, envSales, envMarketing,
  ];

  // Note: envProdMgmt and envDesign are department-level but act as leaf envelopes
  // for Product; envSales and envMarketing similarly for GTM.
  // We create guardrails for the 6 team-level envelopes.
  const guardrailEnvelopes = [envInfra, envDevex, envGrowth, envCoreProduct, envProdMgmt, envDesign];

  for (const env of guardrailEnvelopes) {
    await financeService.createGuardrail(env.id, {
      guardrailType: "headcount",
      enforcement: "hard",
      warningThresholdPct: "80.00",
      breachThresholdPct: "100.00",
    });
    await financeService.createGuardrail(env.id, {
      guardrailType: "total_comp",
      enforcement: "hard",
      warningThresholdPct: "85.00",
      breachThresholdPct: "100.00",
    });
    await financeService.createGuardrail(env.id, {
      guardrailType: "comp_band",
      enforcement: "soft",
      warningThresholdPct: "0.00",
      breachThresholdPct: "0.00",
    });
  }

  console.log("Creating guardrails... ✓ (18 guardrails)\n");

  // ------------------------------------------------------------------
  // 9. Create Job Families
  // ------------------------------------------------------------------
  console.log("Creating job families...");

  const jfEng = await hrService.createJobFamily({ name: "Engineering", code: "ENG" });
  const jfProd = await hrService.createJobFamily({ name: "Product", code: "PROD" });
  const jfDes = await hrService.createJobFamily({ name: "Design", code: "DES" });
  const jfSales = await hrService.createJobFamily({ name: "Sales", code: "SALES" });
  const jfMkt = await hrService.createJobFamily({ name: "Marketing", code: "MKT" });
  const jfDs = await hrService.createJobFamily({ name: "Data Science", code: "DS" });

  console.log("Creating job families... ✓ (6 families)\n");

  // ------------------------------------------------------------------
  // 10. Create Job Slots (20 total)
  // ------------------------------------------------------------------
  console.log("Creating job slots...");

  // ---- Infrastructure (6 slots) ----
  const infraSlot1 = await hrService.createJobSlot({
    envelopeId: envInfra.id,
    roleTitle: "Senior SRE",
    jobFamilyId: jfEng.id,
    level: "L4",
    hiringManagerId: priya.id,
    targetStartDate: "2026-01-15",
    baseSalary: "180000.00",
    equityValue: "45000.00",
    bonusTarget: "18000.00",
    benefitsCost: "15000.00",
    justification: "Critical SRE role for platform reliability",
  });

  const infraSlot2 = await hrService.createJobSlot({
    envelopeId: envInfra.id,
    roleTitle: "SRE",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-02-01",
    baseSalary: "155000.00",
    equityValue: "35000.00",
    bonusTarget: "15500.00",
    benefitsCost: "14000.00",
    justification: "SRE to support growing infrastructure",
  });

  const infraSlot3 = await hrService.createJobSlot({
    envelopeId: envInfra.id,
    roleTitle: "Platform Engineer",
    jobFamilyId: jfEng.id,
    level: "L4",
    hiringManagerId: priya.id,
    targetStartDate: "2026-04-01",
    baseSalary: "175000.00",
    equityValue: "42000.00",
    bonusTarget: "17500.00",
    benefitsCost: "15000.00",
    justification: "Platform engineer for internal tooling",
  });

  const infraSlot4 = await hrService.createJobSlot({
    envelopeId: envInfra.id,
    roleTitle: "DevOps Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-05-01",
    baseSalary: "150000.00",
    equityValue: "32000.00",
    bonusTarget: "15000.00",
    benefitsCost: "14000.00",
    justification: "DevOps to improve CI/CD pipeline",
  });

  const infraSlot5 = await hrService.createJobSlot({
    envelopeId: envInfra.id,
    roleTitle: "Cloud Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-06-01",
    baseSalary: "148000.00",
    equityValue: "30000.00",
    bonusTarget: "14800.00",
    benefitsCost: "13500.00",
    justification: "Cloud migration specialist",
  });

  const infraSlot6 = await hrService.createJobSlot({
    envelopeId: envInfra.id,
    roleTitle: "Junior SRE",
    jobFamilyId: jfEng.id,
    level: "L2",
    hiringManagerId: priya.id,
    targetStartDate: "2026-09-01",
    baseSalary: "130000.00",
    equityValue: "20000.00",
    bonusTarget: "13000.00",
    benefitsCost: "12000.00",
    justification: "Junior SRE to grow the team",
  });

  // ---- DevEx (4 slots) ----
  const devexSlot1 = await hrService.createJobSlot({
    envelopeId: envDevex.id,
    roleTitle: "Developer Tools Engineer",
    jobFamilyId: jfEng.id,
    level: "L4",
    hiringManagerId: priya.id,
    targetStartDate: "2026-01-15",
    baseSalary: "170000.00",
    equityValue: "40000.00",
    bonusTarget: "17000.00",
    benefitsCost: "14500.00",
    justification: "Lead engineer for developer tooling",
  });

  const devexSlot2 = await hrService.createJobSlot({
    envelopeId: envDevex.id,
    roleTitle: "Build Systems Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-04-01",
    baseSalary: "155000.00",
    equityValue: "33000.00",
    bonusTarget: "15500.00",
    benefitsCost: "14000.00",
    justification: "Build systems improvement",
  });

  const devexSlot3 = await hrService.createJobSlot({
    envelopeId: envDevex.id,
    roleTitle: "DX Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-05-01",
    baseSalary: "150000.00",
    equityValue: "30000.00",
    bonusTarget: "15000.00",
    benefitsCost: "13500.00",
    justification: "Developer experience improvement",
  });

  const devexSlot4 = await hrService.createJobSlot({
    envelopeId: envDevex.id,
    roleTitle: "Intern - DevEx",
    jobFamilyId: jfEng.id,
    level: "L1",
    hiringManagerId: priya.id,
    targetStartDate: "2026-06-15",
    baseSalary: "80000.00",
    equityValue: "0.00",
    bonusTarget: "0.00",
    benefitsCost: "8000.00",
    justification: "Summer intern for DX projects",
  });

  // ---- Growth (5 slots) ----
  const growthSlot1 = await hrService.createJobSlot({
    envelopeId: envGrowth.id,
    roleTitle: "Senior Full Stack",
    jobFamilyId: jfEng.id,
    level: "L4",
    hiringManagerId: priya.id,
    targetStartDate: "2026-01-15",
    baseSalary: "175000.00",
    equityValue: "45000.00",
    bonusTarget: "17500.00",
    benefitsCost: "15000.00",
    justification: "Senior full stack for growth features",
  });

  const growthSlot2 = await hrService.createJobSlot({
    envelopeId: envGrowth.id,
    roleTitle: "Full Stack Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-02-01",
    baseSalary: "155000.00",
    equityValue: "35000.00",
    bonusTarget: "15500.00",
    benefitsCost: "14000.00",
    justification: "Full stack engineer for growth team",
  });

  const growthSlot3 = await hrService.createJobSlot({
    envelopeId: envGrowth.id,
    roleTitle: "Frontend Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-03-15",
    baseSalary: "150000.00",
    equityValue: "32000.00",
    bonusTarget: "15000.00",
    benefitsCost: "13500.00",
    justification: "Frontend specialist for growth experiments",
  });

  const growthSlot4 = await hrService.createJobSlot({
    envelopeId: envGrowth.id,
    roleTitle: "Backend Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-05-01",
    baseSalary: "152000.00",
    equityValue: "33000.00",
    bonusTarget: "15200.00",
    benefitsCost: "14000.00",
    justification: "Backend engineer for growth APIs",
  });

  const growthSlot5 = await hrService.createJobSlot({
    envelopeId: envGrowth.id,
    roleTitle: "Growth Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-06-01",
    baseSalary: "148000.00",
    equityValue: "30000.00",
    bonusTarget: "14800.00",
    benefitsCost: "13000.00",
    justification: "Dedicated growth engineer",
  });

  // ---- Core Product (3 slots) ----
  const coreSlot1 = await hrService.createJobSlot({
    envelopeId: envCoreProduct.id,
    roleTitle: "Senior Backend",
    jobFamilyId: jfEng.id,
    level: "L4",
    hiringManagerId: priya.id,
    targetStartDate: "2026-01-15",
    baseSalary: "172000.00",
    equityValue: "42000.00",
    bonusTarget: "17200.00",
    benefitsCost: "14500.00",
    justification: "Senior backend for core product",
  });

  const coreSlot2 = await hrService.createJobSlot({
    envelopeId: envCoreProduct.id,
    roleTitle: "Backend Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-04-01",
    baseSalary: "150000.00",
    equityValue: "32000.00",
    bonusTarget: "15000.00",
    benefitsCost: "13500.00",
    justification: "Backend engineer for core services",
  });

  const coreSlot3 = await hrService.createJobSlot({
    envelopeId: envCoreProduct.id,
    roleTitle: "Full Stack Engineer",
    jobFamilyId: jfEng.id,
    level: "L3",
    hiringManagerId: priya.id,
    targetStartDate: "2026-05-15",
    baseSalary: "148000.00",
    equityValue: "30000.00",
    bonusTarget: "14800.00",
    benefitsCost: "13000.00",
    justification: "Full stack for core product features",
  });

  // ---- Product Management (2 slots) ----
  const pmSlot1 = await hrService.createJobSlot({
    envelopeId: envProdMgmt.id,
    roleTitle: "Senior PM",
    jobFamilyId: jfProd.id,
    level: "L4",
    hiringManagerId: james.id,
    targetStartDate: "2026-02-01",
    baseSalary: "175000.00",
    equityValue: "50000.00",
    bonusTarget: "17500.00",
    benefitsCost: "15000.00",
    justification: "Senior PM for product strategy",
  });

  const pmSlot2 = await hrService.createJobSlot({
    envelopeId: envProdMgmt.id,
    roleTitle: "PM",
    jobFamilyId: jfProd.id,
    level: "L3",
    hiringManagerId: james.id,
    targetStartDate: "2026-04-01",
    baseSalary: "155000.00",
    equityValue: "35000.00",
    bonusTarget: "15500.00",
    benefitsCost: "14000.00",
    justification: "PM for feature development — demo slot",
  });

  console.log("Creating job slots... ✓ (20 slots)\n");

  // ------------------------------------------------------------------
  // 10b. Transition slot statuses
  // ------------------------------------------------------------------
  console.log("Transitioning slot statuses...");

  const hrUserId = marcus.id;

  // FILLED slots: draft → open → sourcing → offer → filled
  await transitionThrough(infraSlot1.id, ["open", "sourcing", "offer", "filled"], hrUserId);
  await transitionThrough(infraSlot2.id, ["open", "sourcing", "offer", "filled"], hrUserId);
  await transitionThrough(devexSlot1.id, ["open", "sourcing", "offer", "filled"], hrUserId);
  await transitionThrough(growthSlot1.id, ["open", "sourcing", "offer", "filled"], hrUserId);
  await transitionThrough(growthSlot2.id, ["open", "sourcing", "offer", "filled"], hrUserId);
  await transitionThrough(coreSlot1.id, ["open", "sourcing", "offer", "filled"], hrUserId);
  await transitionThrough(pmSlot1.id, ["open", "sourcing", "offer", "filled"], hrUserId);

  // SOURCING slots: draft → open → sourcing
  await transitionThrough(infraSlot3.id, ["open", "sourcing"], hrUserId);
  await transitionThrough(infraSlot4.id, ["open", "sourcing"], hrUserId);
  await transitionThrough(growthSlot4.id, ["open", "sourcing"], hrUserId);
  await transitionThrough(growthSlot5.id, ["open", "sourcing"], hrUserId);
  await transitionThrough(coreSlot2.id, ["open", "sourcing"], hrUserId);

  // OFFER slots: draft → open → sourcing → offer
  await transitionThrough(growthSlot3.id, ["open", "sourcing", "offer"], hrUserId);

  // OPEN slots: draft → open
  await transitionThrough(infraSlot5.id, ["open"], hrUserId);
  await transitionThrough(devexSlot2.id, ["open"], hrUserId);
  await transitionThrough(devexSlot3.id, ["open"], hrUserId);
  await transitionThrough(coreSlot3.id, ["open"], hrUserId);
  await transitionThrough(pmSlot2.id, ["open"], hrUserId);

  // DRAFT slots: infraSlot6, devexSlot4 stay as draft (no transitions needed)

  console.log("Transitioning slot statuses... ✓\n");

  // ------------------------------------------------------------------
  // 11. Create Recruiters
  // ------------------------------------------------------------------
  console.log("Creating recruiters...");

  const recruiterDavid = await taService.createRecruiter({
    userId: david.id,
    maxActiveReqs: 15,
    availability: "full_time",
    availabilityPct: "100.00",
  });

  const recruiterLisa = await taService.createRecruiter({
    userId: lisa.id,
    maxActiveReqs: 12,
    availability: "full_time",
    availabilityPct: "100.00",
  });

  console.log("Creating recruiters... ✓ (2 recruiters)\n");

  // ------------------------------------------------------------------
  // 12. Create Recruiter Assignments
  // ------------------------------------------------------------------
  console.log("Creating recruiter assignments...");

  // David: all non-draft, non-filled Engineering slots
  const davidSlots = [
    infraSlot3, infraSlot4, infraSlot5,  // sourcing, sourcing, open
    devexSlot2, devexSlot3,              // open, open
    growthSlot3, growthSlot4, growthSlot5, // offer, sourcing, sourcing
    coreSlot2, coreSlot3,                // sourcing, open
  ];

  let assignmentCount = 0;
  for (const slot of davidSlots) {
    await taService.createAssignment(recruiterDavid.id, slot.id);
    assignmentCount++;
  }

  // Lisa: all non-draft, non-filled Product slots
  const lisaSlots = [pmSlot2]; // open
  for (const slot of lisaSlots) {
    await taService.createAssignment(recruiterLisa.id, slot.id);
    assignmentCount++;
  }

  console.log(`Creating recruiter assignments... ✓ (${assignmentCount} assignments)\n`);

  // ------------------------------------------------------------------
  // 13. Recalculate Envelopes
  // ------------------------------------------------------------------
  console.log("Recalculating envelopes...");

  // Recalculate team-level envelopes (will cascade to parents)
  await recalculateEnvelope(envInfra.id);
  await recalculateEnvelope(envDevex.id);
  await recalculateEnvelope(envGrowth.id);
  await recalculateEnvelope(envCoreProduct.id);
  await recalculateEnvelope(envProdMgmt.id);
  await recalculateEnvelope(envDesign.id);
  await recalculateEnvelope(envSales.id);
  await recalculateEnvelope(envMarketing.id);

  console.log("Recalculating envelopes... ✓\n");

  // ------------------------------------------------------------------
  // 14. Print Summary
  // ------------------------------------------------------------------
  console.log(`=== QWFP Seed Data Complete ===

Company: TechCorp
Users: 8
Org Units: 13
Cost Centers: 6
Planning Cycle: FY26 (active)
Budget Envelopes: 13 (3 division, 4 department, 6 team)
Guardrails: 18 (3 per team envelope)
Job Families: 6
Job Slots: 20 (7 filled, 5 sourcing, 5 open, 1 offer, 2 draft)
Recruiters: 2
Assignments: ${assignmentCount} active

Ready for demo! Run: npm run demo
`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
