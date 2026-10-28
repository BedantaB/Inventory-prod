import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("reads simple rows with CRLF or LF", () => {
    expect(parseCsv("a,b\r\nc,d\ne,f")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });

  it("handles quotes, commas and line breaks inside cells", () => {
    expect(parseCsv('"Drawing Pencil Set","HB, 2B, 4B",48\n"Say ""hi""","line\nbreak",1')).toEqual([
      ["Drawing Pencil Set", "HB, 2B, 4B", "48"],
      ['Say "hi"', "line\nbreak", "1"],
    ]);
  });

  it("ignores Excel's byte-order mark and blank lines", () => {
    expect(parseCsv("﻿Name,MRP\n\n,\nGum,5\n\n")).toEqual([
      ["Name", "MRP"],
      ["Gum", "5"],
    ]);
  });

  it("keeps empty cells", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });
});

describe("toCsv", () => {
  it("round-trips through parseCsv", () => {
    const rows = [
      ["Name", "Pack"],
      ['Oil Pastels "Pro"', "12, 24"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
