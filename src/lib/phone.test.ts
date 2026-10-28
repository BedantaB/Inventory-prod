import { describe, expect, it } from "vitest";
import { formatPhone, normalizeIndianPhone } from "./phone";

describe("normalizeIndianPhone", () => {
  it.each([
    ["9829012345", "+919829012345"],
    ["98290 12345", "+919829012345"],
    ["+91-98290-12345", "+919829012345"],
    ["+91 98290 12345", "+919829012345"],
    ["098290 12345", "+919829012345"],
    ["919829012345", "+919829012345"],
    ["(982) 901-2345", "+919829012345"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeIndianPhone(input)).toBe(expected);
  });

  it.each([
    "",
    "12345",
    "5829012345",
    "98290123456",
    "+1 9829012345",
    "abcdefghij",
    "0141 2345678",
  ])("rejects %s", (input) => {
    expect(normalizeIndianPhone(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups the digits for reading", () => {
    expect(formatPhone("+919829012345")).toBe("+91 98290 12345");
  });
});
