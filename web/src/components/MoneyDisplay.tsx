interface MoneyDisplayProps {
  amount: number | string;
  currency?: string;
  compact?: boolean;
}

export default function MoneyDisplay({ amount, currency = "USD", compact = false }: MoneyDisplayProps) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(num)) {
    return <span className="money" style={{ fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.3px" }}>--</span>;
  }

  const formatted = compact
    ? formatCompact(num, currency)
    : num.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return <span className="money" style={{ fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.3px" }}>{formatted}</span>;
}

function formatCompact(num: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency + " ";
  if (num >= 1_000_000) return `${symbol}${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${symbol}${(num / 1_000).toFixed(0)}K`;
  return `${symbol}${num.toFixed(0)}`;
}
