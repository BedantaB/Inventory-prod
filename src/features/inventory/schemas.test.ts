import { describe, expect, it } from "vitest";
import { zodFieldErrors } from "@/lib/forms";
import { correctStockSchema, stockEntrySchema } from "./schemas";

const itemId = "6f1b9c2e-8a1d-4c1e-9a4b-2f0d3c4b5a69";
const lines = (value: unknown) => JSON.stringify(value);

describe("stockEntrySchema", () => {
  it("reads the bill details and lines", () => {
    const result = stockEntrySchema.parse({
      reference: " DOMS-INV-1 ",
      note: "",
      lines: lines([{ itemId, quantity: "1,200", unitCost: "17.50" }]),
    });
    expect(result).toEqual({
      reference: "DOMS-INV-1",
      note: null,
      lines: [{ itemId, quantity: 1_200_000, unitCost: 1750 }],
    });
  });

  it("points each problem at its line and box", () => {
    const result = stockEntrySchema.safeParse({
      lines: lines([
        { itemId: "", quantity: "5", unitCost: "1" },
        { itemId, quantity: "0", unitCost: "" },
        { itemId, quantity: "-2", unitCost: "1.234" },
      ]),
    });
    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      "lines.0.itemId": { key: "stock.chooseItem" },
      "lines.1.quantity": { key: "stock.invalidQuantity" },
      "lines.1.unitCost": { key: "stock.costRequired" },
      "lines.2.quantity": { key: "stock.invalidQuantity" },
      "lines.2.unitCost": { key: "items.invalidPrice" },
    });
  });

  it("needs at least one line", () => {
    const result = stockEntrySchema.safeParse({ lines: "[]" });
    expect(zodFieldErrors(result.error!)).toEqual({ lines: { key: "stock.noLines" } });
    expect(stockEntrySchema.safeParse({ lines: "not json" }).success).toBe(false);
  });

  it("allows a cost of zero (free samples)", () => {
    expect(
      stockEntrySchema.safeParse({ lines: lines([{ itemId, quantity: "2", unitCost: "0" }]) })
        .success,
    ).toBe(true);
  });
});

describe("correctStockSchema", () => {
  const parse = (v: Record<string, string>) => correctStockSchema.safeParse(v);

  it("reads the counted quantity in milli-units, 0 included", () => {
    expect(parse({ counted: "12.5", reason: "COUNT" }).data).toEqual({
      counted: 12_500,
      reason: "COUNT",
      note: null,
    });
    expect(parse({ counted: "0", reason: "LOST" }).data?.counted).toBe(0);
  });

  it("needs a valid count and a reason", () => {
    expect(parse({ counted: "-1", reason: "COUNT" }).success).toBe(false);
    expect(parse({ counted: "abc", reason: "COUNT" }).success).toBe(false);
    expect(parse({ counted: "5" }).success).toBe(false);
    expect(parse({ counted: "5", reason: "STOLEN" }).success).toBe(false);
  });

  it("needs a note for 'Other reason'", () => {
    const missing = parse({ counted: "5", reason: "OTHER", note: " " });
    expect(missing.error?.issues[0]).toMatchObject({
      path: ["note"],
      message: "stock.noteRequired",
    });
    expect(parse({ counted: "5", reason: "OTHER", note: "Sample to school" }).success).toBe(true);
  });
});
