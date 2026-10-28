import { describe, expect, it } from "vitest";
import { checkImport, itemKey, type ImportUnit } from "./import";

const units: ImportUnit[] = [
  { id: "u-pcs", name: "pcs", label: "Pieces", allowsDecimal: false },
  { id: "u-box", name: "box", label: "Box", allowsDecimal: false },
  { id: "u-kg", name: "kg", label: "Kilogram", allowsDecimal: true },
];
const empty = { units, existingSkus: new Set<string>(), existingKeys: new Set<string>() };
const HEADER =
  "Name,Colour/Variant,Brand,Category,Unit,Pack size,MRP,Selling price,Low stock warning,SKU,Opening stock,Cost price";

describe("checkImport", () => {
  it("reads a good sheet into rows", () => {
    const csv = `${HEADER}
Permanent Marker,Blue,DOMS,Markers,pcs,Pkt of 10,20,17,50,DOMS-002-BLU,200,14
Oil Pastels,,DOMS,Paints,Box,"12 Shades",50,42.50,,,,
`;
    const { rows, problems } = checkImport(csv, empty);
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      {
        row: 2,
        name: "Permanent Marker",
        variant: "Blue",
        brand: "DOMS",
        category: "Markers",
        unitId: "u-pcs",
        packSize: "Pkt of 10",
        mrpPaise: 2000,
        sellingPricePaise: 1700,
        lowStockMilli: 50_000,
        sku: "DOMS-002-BLU",
        openingStockMilli: 200_000,
        costPaise: 1400,
      },
      {
        row: 3,
        name: "Oil Pastels",
        variant: null,
        brand: "DOMS",
        category: "Paints",
        unitId: "u-box",
        packSize: "12 Shades",
        mrpPaise: 5000,
        sellingPricePaise: 4250,
        lowStockMilli: 0,
        sku: "",
        openingStockMilli: 0,
        costPaise: null,
      },
    ]);
  });

  it("accepts other column names and any column order", () => {
    const csv = "MRP,ITEM'S,UOM,DESCRIPRITON,Color\n10,Gum,pieces,20 ml,Clear";
    // "DESCRIPRITON" (sic) is not recognised, the rest is.
    const { rows, problems } = checkImport(csv, empty);
    expect(problems).toEqual([]);
    expect(rows[0]).toMatchObject({
      name: "Gum",
      unitId: "u-pcs",
      mrpPaise: 1000,
      variant: "Clear",
      packSize: null,
    });
  });

  it("explains every problem with its row and column", () => {
    const csv = `${HEADER}
,,,,pcs,,,,,,,
Marker,,,,packet,,,,,,,
Marker,Blue,,,pcs,,20,25,,,,
Loose Paper,,,,pcs,,,,2.5,,,
Glue,,,,pcs,,,,,,10,
Glue,,,,pcs,,abc,,,bad sku!,,
`;
    const { rows, problems } = checkImport(csv, empty);
    expect(rows).toEqual([]);
    expect(problems.map((p) => [p.row, p.column, p.key])).toEqual([
      [2, "Name", "validation.required"],
      [3, "Unit", "import.unknownUnit"],
      [4, "Selling price", "items.priceAboveMrp"],
      [5, "Low stock warning", "items.decimalNotAllowed"],
      [6, "Cost price", "import.costNeeded"],
      [7, "MRP", "items.invalidPrice"],
      [7, "SKU", "validation.skuFormat"],
      [7, "Name", "import.itemRepeated"],
    ]);
    expect(problems[1].vars).toEqual({ unit: "packet", units: "pcs, box, kg" });
  });

  it("refuses items and SKUs that already exist, in the app or earlier in the file", () => {
    const csv = `${HEADER}
White Glue,,,,pcs,45 g,,,,,,
Gum,,,,pcs,,,,,DOMS-010,,
Clay,,,,pcs,Small,,,,X-1,,
Clay,,,,pcs,small ,,,,X-1,,
`;
    const { problems } = checkImport(csv, {
      units,
      existingSkus: new Set(["DOMS-010"]),
      existingKeys: new Set([itemKey("white glue", null, "45 G")]),
    });
    expect(problems.map((p) => [p.row, p.key])).toEqual([
      [2, "import.itemExists"],
      [3, "import.skuExists"],
      [5, "import.skuRepeated"],
      [5, "import.itemRepeated"],
    ]);
  });

  it("needs the Name and Unit columns", () => {
    expect(checkImport("Item code,MRP\nA,1", empty).problems.map((p) => p.key)).toEqual([
      "import.missingColumn",
      "import.missingColumn",
    ]);
    expect(checkImport(HEADER, empty).problems.map((p) => p.key)).toEqual(["import.empty"]);
  });
});
