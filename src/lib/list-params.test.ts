import { describe, expect, it } from "vitest";
import { parseChoice, parsePage, searchPatterns } from "./list-params";

describe("list params", () => {
  it("parses page numbers defensively", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "5"])).toBe(2);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
  });

  it("only accepts known filter values", () => {
    expect(parseChoice("low", ["all", "low"] as const, "all")).toBe("low");
    expect(parseChoice("drop table", ["all", "low"] as const, "all")).toBe("all");
  });

  it("splits search words and escapes wildcards", () => {
    expect(searchPatterns("  toor   dal ")).toEqual(["%toor%", "%dal%"]);
    expect(searchPatterns("50%_off")).toEqual(["%50\\%\\_off%"]);
    expect(searchPatterns("")).toEqual([]);
  });
});
