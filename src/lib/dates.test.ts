import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, istDayStart, nextDay } from "./dates";

describe("dates", () => {
  it("shows dates in Indian time", () => {
    // 20:00 UTC on 31 Mar is already 1 Apr in India.
    expect(formatDate(new Date("2027-03-31T20:00:00Z"))).toBe("1 Apr 2027");
  });
  it("includes a 12-hour time", () => {
    expect(formatDateTime(new Date("2026-10-28T10:35:00Z"))).toMatch(/28 Oct 2026, 4:05\s?pm/i);
  });
});

describe("istDayStart", () => {
  it("turns a date box value into midnight in India", () => {
    expect(istDayStart("2026-10-28")?.toISOString()).toBe("2026-10-27T18:30:00.000Z");
    expect(nextDay(istDayStart("2026-10-28")!).toISOString()).toBe("2026-10-28T18:30:00.000Z");
  });
  it("ignores anything else", () => {
    expect(istDayStart("28/10/2026")).toBeNull();
    expect(istDayStart("2026-13-45")).toBeNull();
    expect(istDayStart("2027-02-31")).toBeNull();
    expect(istDayStart(undefined)).toBeNull();
  });
});
