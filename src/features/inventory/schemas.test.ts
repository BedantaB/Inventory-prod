import { describe, expect, it } from "vitest";
import { zodFieldErrors } from "@/lib/forms";
import { stockEntrySchema } from "./schemas";

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
