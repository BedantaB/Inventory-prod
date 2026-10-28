import { describe, expect, it } from "vitest";
import { discountPaise, orderTotals, parsePercent, percentToInput } from "./totals";

describe("discountPaise", () => {
  it("takes a rupee amount, never more than the subtotal", () => {
    expect(discountPaise(10_000, "AMOUNT", 2_500)).toBe(2_500);
    expect(discountPaise(10_000, "AMOUNT", 50_000)).toBe(10_000);
  });
  it("takes a percentage, rounded half up to whole paise", () => {
    expect(discountPaise(10_000, "PERCENT", 1_000)).toBe(1_000); // 10%
    expect(discountPaise(999, "PERCENT", 250)).toBe(25); // 2.5% of ₹9.99 = 24.975 → 25
    expect(discountPaise(10_000, "PERCENT", 20_000)).toBe(10_000); // capped at 100%
  });
  it("is zero for nothing", () => {
    expect(discountPaise(0, "PERCENT", 1_000)).toBe(0);
    expect(discountPaise(10_000, "AMOUNT", 0)).toBe(0);
  });
});

describe("orderTotals", () => {
  it("adds lines, applies the discount and counts missing prices", () => {
    expect(
      orderTotals(
        [
          { qtyMilli: 10_000, unitPricePaise: 1_700 }, // 10 × ₹17
          { qtyMilli: 2_500, unitPricePaise: 4_001 }, // 2.5 × ₹40.01 = ₹100.03 (rounded)
          { qtyMilli: 3_000, unitPricePaise: null },
        ],
        { kind: "PERCENT", value: 500 },
      ),
    ).toEqual({ subtotal: 27_003, discount: 1_350, total: 25_653, missingPrices: 1 });
  });
});

describe("percent input", () => {
  it.each([
    ["10", 1000],
    ["12.5", 1250],
    ["5 %", 500],
    ["100", 10_000],
  ])("parses %s", (input, bp) => {
    expect(parsePercent(input)).toBe(bp);
  });
  it.each(["101", "-5", "abc", "1.234"])("rejects %s", (input) => {
    expect(parsePercent(input)).toBeNull();
  });
  it("formats back", () => {
    expect(percentToInput(1250)).toBe("12.5");
    expect(percentToInput(1000)).toBe("10");
  });
});
