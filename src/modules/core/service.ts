import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  users,
  orgUnits,
  costCenters,
  currencies,
  exchangeRates,
} from "../../db/schema/core.js";
import { NotFoundError } from "../../shared/errors.js";
import type {
  CreateUserInput,
  CreateOrgUnitInput,
  CreateCostCenterInput,
  CreateCurrencyInput,
  CreateExchangeRateInput,
} from "./validators.js";

// ---- Users ----

export async function createUser(input: CreateUserInput) {
  const [user] = await db.insert(users).values(input).returning();
  return user;
}

export async function getUsers() {
  return db.select().from(users);
}

export async function getUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw new NotFoundError("User", id);
  return user;
}

// ---- Org Units ----

export async function createOrgUnit(input: CreateOrgUnitInput) {
  let materializedPath: string | null = null;

  if (input.parentId) {
    const parent = await getOrgUnitById(input.parentId);
    materializedPath = parent.materializedPath
      ? `${parent.materializedPath}.${parent.id}`
      : parent.id;
  }

  const [orgUnit] = await db
    .insert(orgUnits)
    .values({
      ...input,
      materializedPath,
    })
    .returning();
  return orgUnit;
}

export async function getOrgUnits() {
  return db.select().from(orgUnits);
}

export async function getOrgUnitById(id: string) {
  const [orgUnit] = await db
    .select()
    .from(orgUnits)
    .where(eq(orgUnits.id, id));
  if (!orgUnit) throw new NotFoundError("OrgUnit", id);
  return orgUnit;
}

export async function getOrgUnitChildren(parentId: string) {
  return db.select().from(orgUnits).where(eq(orgUnits.parentId, parentId));
}

export async function getOrgUnitTree(rootId?: string) {
  // Use materialized path for efficient tree queries.
  // If rootId is provided, return that node and all descendants.
  if (!rootId) {
    const allUnits = await db.select().from(orgUnits);
    return buildTree(allUnits, null);
  }

  const root = await getOrgUnitById(rootId);
  const pathPrefix = root.materializedPath
    ? `${root.materializedPath}.${root.id}`
    : root.id;

  const descendants = await db
    .select()
    .from(orgUnits)
    .where(
      sql`${orgUnits.materializedPath} LIKE ${pathPrefix + "%"} OR ${orgUnits.id} = ${rootId}`,
    );

  return buildTree(descendants, rootId);
}

interface OrgUnitNode {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  level: string;
  headUserId: string | null;
  materializedPath: string | null;
  children: OrgUnitNode[];
}

function buildTree(
  units: (typeof orgUnits.$inferSelect)[],
  rootParentId: string | null,
): OrgUnitNode[] {
  const lookup = new Map<string | null, (typeof orgUnits.$inferSelect)[]>();

  for (const unit of units) {
    const key = unit.parentId ?? null;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push(unit);
  }

  function build(parentId: string | null): OrgUnitNode[] {
    const children = lookup.get(parentId) ?? [];
    return children.map((u) => ({
      id: u.id,
      parentId: u.parentId,
      name: u.name,
      code: u.code,
      level: u.level,
      headUserId: u.headUserId,
      materializedPath: u.materializedPath,
      children: build(u.id),
    }));
  }

  return build(rootParentId);
}

// ---- Cost Centers ----

export async function createCostCenter(input: CreateCostCenterInput) {
  const [cc] = await db.insert(costCenters).values(input).returning();
  return cc;
}

export async function getCostCenters() {
  return db.select().from(costCenters);
}

// ---- Currencies ----

export async function createCurrency(input: CreateCurrencyInput) {
  const [currency] = await db.insert(currencies).values(input).returning();
  return currency;
}

export async function getCurrencies() {
  return db.select().from(currencies);
}

// ---- Exchange Rates ----

export async function createExchangeRate(input: CreateExchangeRateInput) {
  const [rate] = await db.insert(exchangeRates).values(input).returning();
  return rate;
}

export async function getExchangeRates() {
  return db.select().from(exchangeRates);
}
