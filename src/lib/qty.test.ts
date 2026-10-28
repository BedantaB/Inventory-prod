import { describe, expect, it } from "vitest";
import { formatQty, lineTotalPaise, parseQty, qtyFromDb, qtyToDb, qtyToInput } from "./qty";

describe("parseQty", () => {
  it("accepts decimals only when the unit allows them", () => {
    expect(parseQty("2.5", { allowDecimal: true })).toBe(2500);
    expect(parseQty("2.5", { allowDecimal: false })).toBeNull();
    expect(parseQty("1,000", { allowDecimal: false })).toBe(1_000_000);
  });
  it.each(["", "-1", "1.2345", "abc", "1e3"])("rejects %s", (input) => {
    expect(parseQty(input, { allowDecimal: true })).toBeNull();
  });
  it("rejects quantities that do not fit numeric(12,3)", () => {
    expect(parseQty("1000000000", { allowDecimal: false })).toBeNull();
  });
});

describe("database round trip", () => {
  it.each([
    ["2.500", 2500],
    ["0.000", 0],
    ["-3.000", -3000],
    ["999999999.999", 999_999_999_999],
  ])("%s ⇄ %d", (db, milli) => {
    expect(qtyFromDb(db)).toBe(milli);
    expect(qtyToDb(milli)).toBe(db);
  });
});

describe("formatQty", () => {
  it("drops trailing zeros and groups the Indian way", () => {
    expect(formatQty(2500)).toBe("2.5");
    expect(formatQty(125_000_000)).toBe("1,25,000");
  });
});

describe("lineTotalPaise", () => {
  it("multiplies and rounds half up to whole paise", () => {
    expect(lineTotalPaise(3000, 4550)).toBe(13650); // 3 × ₹45.50
    expect(lineTotalPaise(2500, 4001)).toBe(10003); // 2.5 × ₹40.01 = 100.025 → 100.03
    expect(lineTotalPaise(1, 499)).toBe(0); // 0.001 × ₹4.99 = 0.499 paise → 0
  });
  it("stays exact for very large values", () => {
    expect(lineTotalPaise(999_999_999_000, 100)).toBe(99_999_999_900);
  });
});

describe("qtyToInput", () => {
  it("drops trailing zeros without grouping", () => {
    expect(qtyToInput(2500)).toBe("2.5");
    expect(qtyToInput(10_000)).toBe("10");
    expect(qtyToInput(1_250_000)).toBe("1250");
    expect(qtyToInput(0)).toBe("0");
    expect(qtyToInput(105)).toBe("0.105");
  });
});
