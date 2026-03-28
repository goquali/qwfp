export function parseJsonData(rawData: string): Record<string, any>[] {
  const parsed = JSON.parse(rawData);

  if (!Array.isArray(parsed)) {
    throw new Error("JSON data must be an array of objects");
  }

  for (let i = 0; i < parsed.length; i++) {
    if (typeof parsed[i] !== "object" || parsed[i] === null) {
      throw new Error(`Row ${i + 1} is not a valid object`);
    }
  }

  return parsed;
}
