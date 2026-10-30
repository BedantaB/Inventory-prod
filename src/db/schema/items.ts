import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { archivedAt, paise, quantity, shopRef, timestamps } from "./columns";
import { lower, profiles } from "./profiles";

/** Units such as pcs, box, kg. Each shop has its own list (copied from defaults on creation). */
export const units = pgTable(
  "units",
  {
    id: uuid().primaryKey().defaultRandom(),
    ...shopRef(),
    name: text().notNull(),
    label: text().notNull(),
    allowsDecimal: boolean().notNull().default(false),
    ...archivedAt(),
    ...timestamps(),
    // Null for the default units added when the shop is created.
    createdBy: uuid().references(() => profiles.id),
  },
  (t) => [
    uniqueIndex("units_name_key").on(t.shopId, lower(t.name)),
    unique("units_shop_id_key").on(t.shopId, t.id),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    ...shopRef(),
    name: text().notNull(),
    ...archivedAt(),
    ...timestamps(),
    createdBy: uuid().references(() => profiles.id),
  },
  (t) => [
    uniqueIndex("categories_name_key").on(t.shopId, lower(t.name)),
    unique("categories_shop_id_key").on(t.shopId, t.id),
  ],
);

/** Brands such as DOMS, Camlin, Classmate. Created from the item form or by import. */
export const brands = pgTable(
  "brands",
  {
    id: uuid().primaryKey().defaultRandom(),
    ...shopRef(),
    name: text().notNull(),
    ...archivedAt(),
    ...timestamps(),
    createdBy: uuid().references(() => profiles.id),
  },
  (t) => [
    uniqueIndex("brands_name_key").on(t.shopId, lower(t.name)),
    unique("brands_shop_id_key").on(t.shopId, t.id),
  ],
);

export const items = pgTable(
  "items",
  {
    id: uuid().primaryKey().defaultRandom(),
    ...shopRef(),
    name: text().notNull(),
    // Colour or other variant ("Blue", "12 Shades"). Each colour is its own item with its own stock.
    variant: text(),
    // Leave blank to auto-generate (ITM-00001). Stored upper-case. See trigger items_before_write.
    sku: text().notNull().default(""),
    // Category, brand and unit must belong to the same shop (composite foreign keys below).
    categoryId: uuid(),
    brandId: uuid(),
    unitId: uuid().notNull(),
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
    uniqueIndex("items_sku_key").on(t.shopId, t.sku),
    unique("items_shop_id_key").on(t.shopId, t.id),
    foreignKey({
      name: "items_category_fk",
      columns: [t.shopId, t.categoryId],
      foreignColumns: [categories.shopId, categories.id],
    }),
    foreignKey({
      name: "items_brand_fk",
      columns: [t.shopId, t.brandId],
      foreignColumns: [brands.shopId, brands.id],
    }),
    foreignKey({
      name: "items_unit_fk",
      columns: [t.shopId, t.unitId],
      foreignColumns: [units.shopId, units.id],
    }),
    index("items_shop_idx").on(t.shopId),
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
