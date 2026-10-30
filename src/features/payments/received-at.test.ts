import { describe, expect, it } from "vitest";
import { receivedAtFrom } from "./received-at";

const now = new Date("2026-10-30T08:00:00Z"); // 30 Oct, 1:30 pm in India

describe("receivedAtFrom", () => {
  it("uses the current time for today or an empty box", () => {
    expect(receivedAtFrom("", now)).toBe(now);
    expect(receivedAtFrom("2026-10-30", now)).toBe(now);
  });

  it("uses midday (Indian time) for an earlier day", () => {
    expect(receivedAtFrom("2026-10-28", now)).toEqual(new Date("2026-10-28T06:30:00Z"));
  });

  it("refuses future and impossible dates", () => {
    expect(receivedAtFrom("2026-10-31", now)).toBe("future");
    expect(receivedAtFrom("2026-02-31", now)).toBe("invalid");
    expect(receivedAtFrom("yesterday", now)).toBe("invalid");
  });

  it("treats just after midnight in India as the new day", () => {
    const earlyMorning = new Date("2026-10-30T18:45:00Z"); // 31 Oct, 00:15 in India
    expect(receivedAtFrom("2026-10-31", earlyMorning)).toBe(earlyMorning);
  });
});
