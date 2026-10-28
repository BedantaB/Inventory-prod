import { describe, expect, it } from "vitest";
import { financialYear, formatOrderNumber } from "./financial-year";

describe("financialYear", () => {
  it("starts on 1 April in Indian time", () => {
    expect(financialYear(new Date("2026-10-28T10:00:00+05:30"))).toBe("2026-27");
    expect(financialYear(new Date("2027-03-31T23:59:00+05:30"))).toBe("2026-27");
    expect(financialYear(new Date("2027-04-01T00:01:00+05:30"))).toBe("2027-28");
  });
  it("uses IST even when the server runs in UTC", () => {
    // 31 March 2027 20:00 UTC is already 1 April 01:30 in India.
    expect(financialYear(new Date("2027-03-31T20:00:00Z"))).toBe("2027-28");
  });
  it("handles the century rollover", () => {
    expect(financialYear(new Date("2099-06-01T12:00:00+05:30"))).toBe("2099-00");
  });
});

describe("formatOrderNumber", () => {
  it("pads the sequence", () => {
    expect(formatOrderNumber("2026-27", 1)).toBe("ORD-2026-27-00001");
    expect(formatOrderNumber("2026-27", 123456)).toBe("ORD-2026-27-123456");
  });
});
