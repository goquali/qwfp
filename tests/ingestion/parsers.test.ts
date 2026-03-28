import { parseCsvData } from "../../src/modules/ingestion/parsers/csv.js";
import { parseJsonData } from "../../src/modules/ingestion/parsers/json.js";

describe("parseCsvData", () => {
  it("correctly parses CSV with headers into array of objects", () => {
    const csv = `Name,Department,Salary
Alice,Engineering,150000
Bob,Product,130000`;

    const result = parseCsvData(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      Name: "Alice",
      Department: "Engineering",
      Salary: "150000",
    });
    expect(result[1]).toEqual({
      Name: "Bob",
      Department: "Product",
      Salary: "130000",
    });
  });

  it("handles empty input gracefully", () => {
    const result = parseCsvData("");
    expect(result).toEqual([]);
  });

  it("trims whitespace from values", () => {
    const csv = `Name , Role
  Alice , Engineer `;

    const result = parseCsvData(csv);

    expect(result).toHaveLength(1);
    expect(result[0].Name).toBe("Alice");
    expect(result[0].Role).toBe("Engineer");
  });

  it("skips empty lines", () => {
    const csv = `Name,Role
Alice,Engineer

Bob,Designer
`;

    const result = parseCsvData(csv);
    expect(result).toHaveLength(2);
  });
});

describe("parseJsonData", () => {
  it("parses valid JSON array of objects", () => {
    const json = JSON.stringify([
      { name: "Alice", role: "Engineer" },
      { name: "Bob", role: "Designer" },
    ]);

    const result = parseJsonData(json);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "Alice", role: "Engineer" });
    expect(result[1]).toEqual({ name: "Bob", role: "Designer" });
  });

  it("throws on invalid JSON syntax", () => {
    expect(() => parseJsonData("{not valid json")).toThrow();
  });

  it("throws when JSON is not an array", () => {
    const json = JSON.stringify({ name: "Alice" });
    expect(() => parseJsonData(json)).toThrow("JSON data must be an array of objects");
  });

  it("throws when array contains non-object elements", () => {
    const json = JSON.stringify(["string1", "string2"]);
    expect(() => parseJsonData(json)).toThrow("not a valid object");
  });

  it("throws when array contains null elements", () => {
    const json = JSON.stringify([null]);
    expect(() => parseJsonData(json)).toThrow("not a valid object");
  });
});
