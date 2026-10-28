"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { DB_ERROR, getPgErrorCode } from "@/db/errors";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { failure, fieldFailure, parseForm, success, type ActionResult } from "@/lib/forms";
import { formatQty, QTY_SCALE } from "@/lib/qty";
import * as data from "./data";
import { checkPhoto, deleteItemPhoto, photoFilesFrom, uploadItemPhoto } from "./photos";
import { categorySchema, itemSchema, unitSchema, type ItemInput } from "./schemas";

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
        name: input.name,
        sku: input.sku,
        categoryId: input.categoryId,
        unitId: input.unitId,
        packSize: input.packSize,
        // Anyone may set the price when creating; only the owner may change it later.
        sellingPricePaise: input.sellingPrice,
        lowStockMilli: input.lowStockThreshold,
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
    if (getPgErrorCode(error) === DB_ERROR.foreignKeyViolation) {
      return fieldFailure("categoryId", "validation.invalidChoice");
    }
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
      name: input.name,
      sku: input.sku,
      categoryId: input.categoryId,
      unitId: input.unitId,
      packSize: input.packSize,
      lowStockMilli: input.lowStockThreshold,
      sellingPricePaise: canEditPrice ? input.sellingPrice : undefined,
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
