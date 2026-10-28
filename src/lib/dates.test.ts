import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./dates";

describe("dates", () => {
  it("shows dates in Indian time", () => {
    // 20:00 UTC on 31 Mar is already 1 Apr in India.
    expect(formatDate(new Date("2027-03-31T20:00:00Z"))).toBe("1 Apr 2027");
  });
  it("includes a 12-hour time", () => {
    expect(formatDateTime(new Date("2026-10-28T10:35:00Z"))).toMatch(/28 Oct 2026, 4:05\s?pm/i);
  });
});
