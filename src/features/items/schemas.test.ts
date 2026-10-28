import { describe, expect, it } from "vitest";
import { itemSchema, unitSchema } from "./schemas";

const unitId = "6f1b9c2e-8a1d-4c1e-9a4b-2f0d3c4b5a69";

function messages(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return result.success ? [] : result.error!.issues.map((i) => [i.path[0], i.message]);
}

describe("itemSchema", () => {
  it("turns form strings into clean values", () => {
    const result = itemSchema.parse({
      name: "  Toor Dal ",
      sku: " dal-toor ",
      categoryId: "",
      unitId,
      packSize: "",
      sellingPrice: "1,650.5",
      lowStockThreshold: "2.5",
    });
    expect(result).toEqual({
      name: "Toor Dal",
      sku: "DAL-TOOR",
      categoryId: null,
      unitId,
      packSize: null,
      sellingPrice: 165050,
      lowStockThreshold: 2500,
      removePhoto: false,
    });
  });

  it("treats empty price and threshold as 'not set' and 0", () => {
    const result = itemSchema.parse({ name: "X", unitId, sellingPrice: "", lowStockThreshold: "" });
    expect(result.sellingPrice).toBeNull();
    expect(result.lowStockThreshold).toBe(0);
    expect(result.sku).toBe("");
  });

  it("explains bad input with friendly keys", () => {
    const result = itemSchema.safeParse({
      name: "",
      sku: "bad sku!",
      unitId: "",
      sellingPrice: "12.345",
      lowStockThreshold: "-1",
    });
    expect(messages(result)).toEqual([
      ["name", "validation.required"],
      ["sku", "validation.skuFormat"],
      ["unitId", "validation.required"],
      ["sellingPrice", "items.invalidPrice"],
      ["lowStockThreshold", "items.invalidQuantity"],
    ]);
  });

  it("caps the price at ₹1 crore", () => {
    const result = itemSchema.safeParse({ name: "X", unitId, sellingPrice: "10000000.01" });
    expect(messages(result)).toEqual([["sellingPrice", "validation.tooLarge"]]);
  });
});

describe("unitSchema", () => {
  it("lower-cases the short name and reads the checkbox", () => {
    expect(unitSchema.parse({ name: " Bag ", label: "Bag", allowsDecimal: "on" })).toEqual({
      name: "bag",
      label: "Bag",
      allowsDecimal: true,
    });
  });
});
