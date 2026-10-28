import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { archivedAt, paise, quantity, timestamps } from "./columns";
import { lower, profiles } from "./profiles";

/** Units such as pcs, box, kg. Admin can edit the list. */
export const units = pgTable(
  "units",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    label: text().notNull(),
    allowsDecimal: boolean().notNull().default(false),
    ...archivedAt(),
    ...timestamps(),
    // Null for the built-in units created by the migration.
    createdBy: uuid().references(() => profiles.id),
  },
  (t) => [uniqueIndex("units_name_key").on(lower(t.name))],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    ...archivedAt(),
    ...timestamps(),
    createdBy: uuid().references(() => profiles.id),
  },
  (t) => [uniqueIndex("categories_name_key").on(lower(t.name))],
);

/** Brands such as DOMS, Camlin, Classmate. Created from the item form or by import. */
export const brands = pgTable(
  "brands",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    ...archivedAt(),
    ...timestamps(),
    createdBy: uuid().references(() => profiles.id),
  },
  (t) => [uniqueIndex("brands_name_key").on(lower(t.name))],
);

export const items = pgTable(
  "items",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    // Colour or other variant ("Blue", "12 Shades"). Each colour is its own item with its own stock.
    variant: text(),
    // Leave blank to auto-generate (ITM-00001). Stored upper-case. See trigger items_before_write.
    sku: text().notNull().default(""),
    categoryId: uuid().references(() => categories.id),
    brandId: uuid().references(() => brands.id),
    unitId: uuid()
      .notNull()
      .references(() => units.id),
    packSize: text(),
    // Maximum retail price printed on the pack. Optional.
    mrpPaise: paise(),
    // The usual selling price; pre-fills the cart. Optional. Never above MRP.
    sellingPricePaise: paise(),
    // Changed ONLY by the stock_movements trigger (enforced by a guard trigger).
    currentStock: quantity().notNull().default("0"),
    // Weighted average cost per unit, recalculated on every stock-in by the trigger.
    avgCostPaise: paise().notNull().default(0),
    lowStockThreshold: quantity().notNull().default("0"),
    photoPath: text(),
    ...archivedAt(),
    ...timestamps(),
    createdBy: uuid()
      .notNull()
      .references(() => profiles.id),
  },
  (t) => [
    uniqueIndex("items_sku_key").on(t.sku),
    index("items_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")),
    index("items_sku_trgm_idx").using("gin", t.sku.op("gin_trgm_ops")),
    index("items_variant_trgm_idx").using("gin", t.variant.op("gin_trgm_ops")),
    index("items_pack_size_trgm_idx").using("gin", t.packSize.op("gin_trgm_ops")),
    index("items_category_idx").on(t.categoryId),
    index("items_brand_idx").on(t.brandId),
    check("items_current_stock_nonneg", sql`${t.currentStock} >= 0`),
    check("items_avg_cost_nonneg", sql`${t.avgCostPaise} >= 0`),
    check("items_selling_price_nonneg", sql`${t.sellingPricePaise} >= 0`),
    check("items_mrp_nonneg", sql`${t.mrpPaise} >= 0`),
    check(
      "items_selling_price_within_mrp",
      sql`${t.sellingPricePaise} IS NULL OR ${t.mrpPaise} IS NULL OR ${t.sellingPricePaise} <= ${t.mrpPaise}`,
    ),
    check("items_low_stock_threshold_nonneg", sql`${t.lowStockThreshold} >= 0`),
    check("items_name_not_blank", sql`btrim(${t.name}) <> ''`),
  ],
);
