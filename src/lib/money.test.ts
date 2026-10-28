import { describe, expect, it } from "vitest";
import { formatINR, paiseToInput, rupeesToPaise } from "./money";

describe("formatINR", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(12_345_600)).toBe("₹1,23,456.00");
    expect(formatINR(1_00_00_000_00)).toBe("₹1,00,00,000.00");
  });
  it("always shows two decimals", () => {
    expect(formatINR(0)).toBe("₹0.00");
    expect(formatINR(5)).toBe("₹0.05");
    expect(formatINR(1005)).toBe("₹10.05");
  });
  it("rejects fractional paise", () => {
    expect(() => formatINR(10.5)).toThrow(RangeError);
  });
});

describe("rupeesToPaise", () => {
  it.each([
    ["1234.5", 123450],
    ["1,234.50", 123450],
    ["₹ 99", 9900],
    ["0.01", 1],
    ["0", 0],
  ])("parses %s", (input, expected) => {
    expect(rupeesToPaise(input)).toBe(expected);
  });
  it.each(["", "abc", "-5", "1.234", "1.2.3", "."])("rejects %s", (input) => {
    expect(rupeesToPaise(input)).toBeNull();
  });
});

describe("paiseToInput", () => {
  it("formats for an input box", () => {
    expect(paiseToInput(123450)).toBe("1234.50");
    expect(paiseToInput(100000)).toBe("1000");
    expect(paiseToInput(5)).toBe("0.05");
  });
});
