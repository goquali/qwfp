import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as core from "./schema/core.js";
import * as finance from "./schema/finance.js";
import * as hr from "./schema/hr.js";
import * as reconciliation from "./schema/reconciliation.js";
import * as ingestion from "./schema/ingestion.js";
import * as ta from "./schema/ta.js";
import * as billing from "./schema/billing.js";

const queryClient = postgres(config.databaseUrl);

export const db = drizzle(queryClient, {
  schema: { ...core, ...finance, ...hr, ...reconciliation, ...ingestion, ...ta, ...billing },
});

export type Database = typeof db;
