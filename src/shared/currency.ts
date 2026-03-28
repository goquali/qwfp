import { db } from "../db/client.js";
import { exchangeRates } from "../db/schema/core.js";
import { and, eq, lte, desc } from "drizzle-orm";

/**
 * Convert an amount from one currency to another using the most recent
 * exchange rate on or before the given date.
 */
export async function convertCurrency(
  amount: string,
  fromCurrency: string,
  toCurrency: string,
  asOfDate: Date = new Date(),
): Promise<string> {
  if (fromCurrency === toCurrency) return amount;

  const rate = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.fromCurrency, fromCurrency),
        eq(exchangeRates.toCurrency, toCurrency),
        lte(exchangeRates.effectiveDate, asOfDate.toISOString().split("T")[0]),
      ),
    )
    .orderBy(desc(exchangeRates.effectiveDate))
    .limit(1);

  if (rate.length === 0) {
    throw new Error(
      `No exchange rate found for ${fromCurrency} → ${toCurrency} as of ${asOfDate.toISOString().split("T")[0]}`,
    );
  }

  const result = parseFloat(amount) * parseFloat(rate[0].rate);
  return result.toFixed(2);
}
