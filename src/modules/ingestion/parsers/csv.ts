import { parse } from "csv-parse/sync";

export function parseCsvData(rawData: string): Record<string, string>[] {
  const records = parse(rawData, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records as Record<string, string>[];
}
