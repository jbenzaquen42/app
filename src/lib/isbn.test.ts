import { describe, expect, it } from "vitest";
import { isbn10To13, isbn13To10, isValidIsbn10, isValidIsbn13, normalizeIsbn } from "./isbn";

describe("ISBN utilities", () => {
  it("normalizes punctuation and lowercase x", () => {
    expect(normalizeIsbn("0-8044-2957-x")).toBe("080442957X");
  });

  it("validates ISBN-10 values", () => {
    expect(isValidIsbn10("0-8044-2957-X")).toBe(true);
    expect(isValidIsbn10("0-8044-2957-0")).toBe(false);
  });

  it("validates ISBN-13 values", () => {
    expect(isValidIsbn13("9780306406157")).toBe(true);
    expect(isValidIsbn13("9780306406158")).toBe(false);
  });

  it("converts between ISBN-10 and ISBN-13", () => {
    expect(isbn10To13("0306406152")).toBe("9780306406157");
    expect(isbn13To10("9780306406157")).toBe("0306406152");
  });
});
