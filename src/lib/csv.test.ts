import { describe, expect, it } from "vitest";
import Papa from "papaparse";

describe("CSV parsing expectations", () => {
  it("parses exported-style headers", () => {
    const parsed = Papa.parse<Record<string, string>>("title,author,isbn13\nPiranesi,Susanna Clarke,9781526622433", { header: true, skipEmptyLines: true });
    expect(parsed.data[0]).toEqual({ title: "Piranesi", author: "Susanna Clarke", isbn13: "9781526622433" });
  });
});
