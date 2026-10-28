"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { DB_ERROR, getPgErrorCode } from "@/db/errors";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { failure, fieldFailure, parseForm, success, type ActionResult } from "@/lib/forms";
import { formatQty, QTY_SCALE } from "@/lib/qty";
import { getMessages } from "@/i18n";
import { lastCosts } from "@/features/inventory/data";
import * as data from "./data";
import { checkImport, type ImportProblem } from "./import";
import { checkPhoto, deleteItemPhoto, photoFilesFrom, uploadItemPhoto } from "./photos";
import { categorySchema, itemSchema, unitSchema, type ItemInput } from "./schemas";

function fieldsFrom(input: ItemInput) {
  return {
    name: input.name,
    variant: input.variant,
    sku: input.sku,
    categoryId: input.categoryId,
    brandId: input.brandId,
    unitId: input.unitId,
    packSize: input.packSize,
    lowStockMilli: input.lowStockThreshold,
  };
}

const isUuid = (id: string) => z.uuid().safeParse(id).success;

function revalidateItems(id?: string) {
  revalidatePath("/items");
  if (id) revalidatePath(`/items/${id}`);
}

/** Checks the unit exists and the quantities fit it (no 2.5 for "pcs"). */
async function checkUnit(
  input: ItemInput,
  currentStockMilli = 0,
): Promise<ActionResult<never> | null> {
  const unit = await data.getUnit(getDb(), input.unitId);
  if (!unit || unit.archivedAt) return fieldFailure("unitId", "validation.invalidChoice");
  if (!unit.allowsDecimal) {
    if (currentStockMilli % QTY_SCALE !== 0) {
      return fieldFailure("unitId", "items.unitNeedsDecimals", {
        stock: formatQty(currentStockMilli),
      });
    }
    if (input.lowStockThreshold % QTY_SCALE !== 0) {
      return fieldFailure("lowStockThreshold", "items.decimalNotAllowed");
    }
  }
  return null;
}

/** Uploads a new photo if the form has one. */
async function handleNewPhoto(
  formData: FormData,
): Promise<{ ok: true; path: string | null } | { ok: false; result: ActionResult<never> }> {
  const files = photoFilesFrom(formData);
  if (!files) return { ok: true, path: null };
  const problem = checkPhoto(files);
  if (problem) return { ok: false, result: fieldFailure("photo", problem) };
  return { ok: true, path: await uploadItemPhoto(files) };
}

export async function createItemAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  const parsed = parseForm(itemSchema, formData);
  if (!parsed.ok) return parsed.result;
  const input = parsed.data;

  const unitProblem = await checkUnit(input);
  if (unitProblem) return unitProblem;

  const photo = await handleNewPhoto(formData);
  if (!photo.ok) return photo.result;

  try {
    const item = await data.createItem(
      getDb(),
      {
        ...fieldsFrom(input),
        // Anyone may set prices when creating; only the owner may change them later.
        mrpPaise: input.mrp,
        sellingPricePaise: input.sellingPrice,
        photoPath: photo.path,
      },
      actor.id,
    );
    revalidateItems();
    return success("items.created", { name: item.name }, { id: item.id });
  } catch (error) {
    await deleteItemPhoto(photo.path);
    if (getPgErrorCode(error) === DB_ERROR.uniqueViolation)
      return fieldFailure("sku", "items.skuTaken");
    if (getPgErrorCode(error) === DB_ERROR.foreignKeyViolation)
      return failure("validation.fixErrors");
    throw error;
  }
}

export async function updateItemAction(itemId: string, formData: FormData): Promise<ActionResult> {
  const actor = await requireUser();
  if (!isUuid(itemId)) return failure("errors.notFound");
  const db = getDb();
  const existing = await data.getItem(db, itemId);
  if (!existing) return failure("errors.notFound");
  if (existing.archivedAt) return failure("errors.archivedRecord");

  const parsed = parseForm(itemSchema, formData);
  if (!parsed.ok) return parsed.result;
  const input = parsed.data;

  const canEditPrice = can(actor, "editItemPrice");
  if (
    !canEditPrice &&
    formData.has("sellingPrice") &&
    input.sellingPrice !== existing.sellingPricePaise
  ) {
    return fieldFailure("sellingPrice", "items.priceOwnerOnly");
  }

  const unitProblem = await checkUnit(input, existing.stockMilli);
  if (unitProblem) return unitProblem;

  const photo = await handleNewPhoto(formData);
  if (!photo.ok) return photo.result;
  const photoPath = photo.path ?? (input.removePhoto ? null : undefined);

  try {
    await data.updateItem(db, itemId, {
      ...fieldsFrom(input),
      sellingPricePaise: canEditPrice ? input.sellingPrice : undefined,
      mrpPaise: canEditPrice ? input.mrp : undefined,
      photoPath,
    });
  } catch (error) {
    await deleteItemPhoto(photo.path);
    if (getPgErrorCode(error) === DB_ERROR.uniqueViolation)
      return fieldFailure("sku", "items.skuTaken");
    throw error;
  }

  if (photoPath !== undefined && existing.photoPath) await deleteItemPhoto(existing.photoPath);
  revalidateItems(itemId);
  return success("items.updated");
}

export async function setItemArchivedAction(
  itemId: string,
  archived: boolean,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "archive")) return failure("errors.adminOnly");
  if (!isUuid(itemId)) return failure("errors.notFound");
  const item = await data.setItemArchived(getDb(), itemId, archived);
  if (!item) return failure("errors.notFound");
  revalidateItems(itemId);
  return success(archived ? "items.archivedDone" : "items.unarchivedDone", { name: item.name });
}

export async function createCategoryAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; name: string }>> {
  const actor = await requireUser();
  const parsed = parseForm(categorySchema, formData);
  if (!parsed.ok) return parsed.result;
  const category = await data.findOrCreateCategory(getDb(), parsed.data.name, actor.id);
  return category.existed
    ? success("items.categoryExists", undefined, { id: category.id, name: category.name })
    : success(
        "items.categoryCreated",
        { name: category.name },
        { id: category.id, name: category.name },
      );
}

export async function createBrandAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; name: string }>> {
  const actor = await requireUser();
  const parsed = parseForm(categorySchema, formData);
  if (!parsed.ok) return parsed.result;
  const brand = await data.findOrCreateBrand(getDb(), parsed.data.name, actor.id);
  return brand.existed
    ? success("items.brandExists", undefined, { id: brand.id, name: brand.name })
    : success("items.brandCreated", { name: brand.name }, { id: brand.id, name: brand.name });
}

export async function createUnitAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "manageUnits")) return failure("errors.adminOnly");
  const parsed = parseForm(unitSchema, formData);
  if (!parsed.ok) return parsed.result;
  try {
    const unit = await data.createUnit(getDb(), parsed.data, actor.id);
    revalidatePath("/items/units");
    return success("units.created", { name: unit.name });
  } catch (error) {
    if (getPgErrorCode(error) === DB_ERROR.uniqueViolation)
      return fieldFailure("name", "units.nameTaken");
    throw error;
  }
}

export async function updateUnitAction(unitId: string, formData: FormData): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "manageUnits")) return failure("errors.adminOnly");
  if (!isUuid(unitId)) return failure("errors.notFound");
  const parsed = parseForm(unitSchema, formData);
  if (!parsed.ok) return parsed.result;
  try {
    const result = await data.updateUnit(getDb(), unitId, parsed.data);
    if (result === "not-found") return failure("errors.notFound");
    if (result === "decimal-locked") return fieldFailure("allowsDecimal", "units.decimalLocked");
  } catch (error) {
    if (getPgErrorCode(error) === DB_ERROR.uniqueViolation)
      return fieldFailure("name", "units.nameTaken");
    throw error;
  }
  revalidatePath("/items/units");
  revalidateItems();
  return success("units.updated");
}

// ---- Import from spreadsheet (owner only) ----

const MAX_IMPORT_BYTES = 1_000_000;

export type ImportPreview = {
  count: number;
  withStock: number;
  newBrands: number;
  newCategories: number;
  sample: {
    row: number;
    name: string;
    variant: string | null;
    packSize: string | null;
    mrpPaise: number | null;
  }[];
  problems: ImportProblem[];
  totalProblems: number;
};

async function readImport(formData: FormData) {
  const csv = formData.get("csv");
  if (typeof csv !== "string" || csv.length === 0) return { error: "import.empty" as const };
  if (csv.length > MAX_IMPORT_BYTES) return { error: "import.tooBig" as const };
  const db = getDb();
  const context = await data.importContext(db);
  return { db, csv, check: checkImport(csv, context) };
}

/** Step 1: check the file and show what would happen. Nothing is saved. */
export async function checkImportAction(formData: FormData): Promise<ActionResult<ImportPreview>> {
  const actor = await requireUser();
  if (!can(actor, "importItems")) return failure("errors.adminOnly");
  const read = await readImport(formData);
  if ("error" in read) return failure(read.error!);
  const { db, check } = read;

  const [brands, categories] = await Promise.all([data.listBrands(db), data.listCategories(db)]);
  const countNew = (names: (string | null)[], existing: { name: string }[]) => {
    const known = new Set(existing.map((e) => e.name.toLowerCase()));
    return new Set(
      names
        .filter((n): n is string => !!n && !known.has(n.toLowerCase()))
        .map((n) => n.toLowerCase()),
    ).size;
  };

  return success(undefined, undefined, {
    count: check.rows.length,
    withStock: check.rows.filter((r) => r.openingStockMilli > 0).length,
    newBrands: countNew(
      check.rows.map((r) => r.brand),
      brands,
    ),
    newCategories: countNew(
      check.rows.map((r) => r.category),
      categories,
    ),
    sample: check.rows.slice(0, 10).map(({ row, name, variant, packSize, mrpPaise }) => ({
      row,
      name,
      variant,
      packSize,
      mrpPaise,
    })),
    problems: check.problems.slice(0, 50),
    totalProblems: check.problems.length,
  });
}

/** Step 2: check again (the server never trusts the earlier answer) and add everything. */
export async function runImportAction(
  formData: FormData,
): Promise<ActionResult<{ count: number }>> {
  const actor = await requireUser();
  if (!can(actor, "importItems")) return failure("errors.adminOnly");
  const read = await readImport(formData);
  if ("error" in read) return failure(read.error!);
  const { db, check } = read;
  if (check.problems.length > 0 || check.rows.length === 0)
    return failure("import.changedSinceCheck");

  try {
    const result = await data.importItems(
      db,
      check.rows,
      actor.id,
      getMessages().import.openingStockNote,
    );
    revalidateItems();
    return success("import.done", { count: result.items }, { count: result.items });
  } catch (error) {
    if (getPgErrorCode(error) === DB_ERROR.uniqueViolation)
      return failure("import.changedSinceCheck");
    throw error;
  }
}

// ---- Item picker (Add Stock, New Order) ----

export type PickerItem = {
  id: string;
  label: string;
  sku: string;
  packSize: string | null;
  brandName: string | null;
  unitName: string;
  allowsDecimal: boolean;
  stockMilli: number;
  mrpPaise: number | null;
  sellingPricePaise: number | null;
  photoPath: string | null;
  /** Last stock-in cost. Owner only (null for staff). */
  lastCostPaise: number | null;
};

/** Search-as-you-type for the item picker: top 10 active items. */
export async function searchItemsAction(query: string): Promise<PickerItem[]> {
  const actor = await requireUser();
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const db = getDb();
  const { rows } = await data.listItems(db, { q, limit: 10 });
  const costs = can(actor, "viewCost")
    ? await lastCosts(
        db,
        rows.map((r) => r.id),
      )
    : new Map();
  return rows.map((r) => ({
    id: r.id,
    label: data.itemDisplayName(r),
    sku: r.sku,
    packSize: r.packSize,
    brandName: r.brandName,
    unitName: r.unitName,
    allowsDecimal: r.unitAllowsDecimal,
    stockMilli: r.stockMilli,
    mrpPaise: r.mrpPaise,
    sellingPricePaise: r.sellingPricePaise,
    photoPath: r.photoPath,
    lastCostPaise: costs.get(r.id) ?? null,
  }));
}
