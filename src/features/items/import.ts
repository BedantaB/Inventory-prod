import type { MessageKey, MessageVars } from "@/i18n";
import { parseCsv } from "@/lib/csv";
import { rupeesToPaise } from "@/lib/money";
import { parseQty, QTY_SCALE } from "@/lib/qty";
import { MAX_PRICE_PAISE } from "./schemas";

/**
 * Item import from a spreadsheet saved as CSV. Pure functions (no database) so every rule is
 * unit-tested; ./actions.ts loads units and existing items, then calls checkImport().
 */

export const MAX_IMPORT_ROWS = 2000;

export const IMPORT_COLUMNS = [
  { key: "name", header: "Name", aliases: ["item", "items", "item name", "item's", "product"] },
  { key: "variant", header: "Colour/Variant", aliases: ["colour", "color", "variant", "shade"] },
  { key: "brand", header: "Brand", aliases: ["company", "make"] },
  { key: "category", header: "Category", aliases: ["group"] },
  { key: "unit", header: "Unit", aliases: ["uom"] },
  { key: "packSize", header: "Pack size", aliases: ["pack", "description", "packing", "size"] },
  { key: "mrp", header: "MRP", aliases: ["mrp (rs)", "mrp (₹)"] },
  { key: "sellingPrice", header: "Selling price", aliases: ["price", "rate", "sale price"] },
  {
    key: "lowStock",
    header: "Low stock warning",
    aliases: ["low stock", "reorder level", "minimum stock"],
  },
  { key: "sku", header: "SKU", aliases: ["code", "item code"] },
  { key: "openingStock", header: "Opening stock", aliases: ["stock", "quantity", "qty"] },
  { key: "costPrice", header: "Cost price", aliases: ["cost", "purchase price"] },
] as const;

type ColumnKey = (typeof IMPORT_COLUMNS)[number]["key"];

export type ImportUnit = { id: string; name: string; label: string; allowsDecimal: boolean };

export type ImportRow = {
  /** Row number as shown in the spreadsheet (header = 1). */
  row: number;
  name: string;
  variant: string | null;
  brand: string | null;
  category: string | null;
  unitId: string;
  packSize: string | null;
  mrpPaise: number | null;
  sellingPricePaise: number | null;
  lowStockMilli: number;
  sku: string;
  openingStockMilli: number;
  costPaise: number | null;
};

export type ImportProblem = {
  row: number | null;
  column: string | null;
  key: MessageKey;
  vars?: MessageVars;
};

export type ImportCheck = {
  rows: ImportRow[];
  problems: ImportProblem[];
};

const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Same item = same name + colour + pack size (ignoring capitals and extra spaces). */
export function itemKey(name: string, variant: string | null, packSize: string | null): string {
  return [name, variant ?? "", packSize ?? ""].map(normalise).join("|");
}

function mapHeaders(header: string[]): Map<ColumnKey, number> {
  const map = new Map<ColumnKey, number>();
  header.forEach((cell, index) => {
    const h = normalise(cell);
    const column = IMPORT_COLUMNS.find(
      (c) => normalise(c.header) === h || (c.aliases as readonly string[]).includes(h),
    );
    if (column && !map.has(column.key)) map.set(column.key, index);
  });
  return map;
}

export function checkImport(
  csvText: string,
  context: { units: ImportUnit[]; existingSkus: Set<string>; existingKeys: Set<string> },
): ImportCheck {
  const problems: ImportProblem[] = [];
  const table = parseCsv(csvText);
  if (table.length < 2) {
    return { rows: [], problems: [{ row: null, column: null, key: "import.empty" }] };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      problems: [
        { row: null, column: null, key: "import.tooManyRows", vars: { max: MAX_IMPORT_ROWS } },
      ],
    };
  }

  const columns = mapHeaders(table[0]);
  for (const required of ["name", "unit"] as const) {
    if (!columns.has(required)) {
      const header = IMPORT_COLUMNS.find((c) => c.key === required)!.header;
      problems.push({
        row: null,
        column: header,
        key: "import.missingColumn",
        vars: { column: header },
      });
    }
  }
  if (problems.length > 0) return { rows: [], problems };

  const unitByName = new Map<string, ImportUnit>();
  for (const unit of context.units) {
    unitByName.set(normalise(unit.name), unit);
    unitByName.set(normalise(unit.label), unit);
  }
  const unitList = context.units.map((u) => u.name).join(", ");

  const seenSkus = new Map<string, number>();
  const seenKeys = new Map<string, number>();
  const rows: ImportRow[] = [];

  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const get = (key: ColumnKey) => {
      const i = columns.get(key);
      return i === undefined ? "" : (cells[i] ?? "").trim();
    };
    const optional = (key: ColumnKey) => get(key) || null;
    const problem = (key: ColumnKey, messageKey: MessageKey, vars?: MessageVars) =>
      problems.push({
        row: rowNumber,
        column: IMPORT_COLUMNS.find((c) => c.key === key)!.header,
        key: messageKey,
        vars,
      });
    const before = problems.length;

    const name = get("name");
    if (!name) problem("name", "validation.required");
    else if (name.length > 120) problem("name", "validation.tooLong");

    const unitText = get("unit");
    const unit = unitByName.get(normalise(unitText));
    if (!unitText) problem("unit", "validation.required");
    else if (!unit) problem("unit", "import.unknownUnit", { unit: unitText, units: unitList });

    const money = (key: ColumnKey): number | null => {
      const text = get(key);
      if (!text) return null;
      const paise = rupeesToPaise(text);
      if (paise === null) problem(key, "items.invalidPrice");
      else if (paise > MAX_PRICE_PAISE) problem(key, "validation.tooLarge");
      return paise;
    };
    const mrpPaise = money("mrp");
    const sellingPricePaise = money("sellingPrice");
    if (mrpPaise !== null && sellingPricePaise !== null && sellingPricePaise > mrpPaise) {
      problem("sellingPrice", "items.priceAboveMrp");
    }
    const costPaise = money("costPrice");

    const quantity = (key: ColumnKey): number => {
      const text = get(key);
      if (!text) return 0;
      const milli = parseQty(text, { allowDecimal: true });
      if (milli === null) {
        problem(key, "items.invalidQuantity");
        return 0;
      }
      if (unit && !unit.allowsDecimal && milli % QTY_SCALE !== 0)
        problem(key, "items.decimalNotAllowed");
      return milli;
    };
    const lowStockMilli = quantity("lowStock");
    const openingStockMilli = quantity("openingStock");
    if (openingStockMilli > 0 && costPaise === null) problem("costPrice", "import.costNeeded");

    const sku = get("sku").toUpperCase();
    if (sku) {
      if (!/^[A-Z0-9][A-Z0-9\-_/.]{0,39}$/.test(sku)) problem("sku", "validation.skuFormat");
      else if (context.existingSkus.has(sku)) problem("sku", "import.skuExists", { sku });
      else if (seenSkus.has(sku))
        problem("sku", "import.skuRepeated", { sku, row: seenSkus.get(sku)! });
      else seenSkus.set(sku, rowNumber);
    }

    const variant = optional("variant");
    const packSize = optional("packSize");
    for (const [key, max] of [
      ["variant", 60],
      ["packSize", 60],
      ["brand", 60],
      ["category", 60],
    ] as const) {
      if (get(key).length > max) problem(key, "validation.tooLong");
    }
    if (name) {
      const key = itemKey(name, variant, packSize);
      if (context.existingKeys.has(key)) problem("name", "import.itemExists");
      else if (seenKeys.has(key))
        problem("name", "import.itemRepeated", { row: seenKeys.get(key)! });
      else seenKeys.set(key, rowNumber);
    }

    if (problems.length === before && unit) {
      rows.push({
        row: rowNumber,
        name,
        variant,
        brand: optional("brand"),
        category: optional("category"),
        unitId: unit.id,
        packSize,
        mrpPaise,
        sellingPricePaise,
        lowStockMilli,
        sku,
        openingStockMilli,
        costPaise,
      });
    }
  });

  return { rows, problems };
}
