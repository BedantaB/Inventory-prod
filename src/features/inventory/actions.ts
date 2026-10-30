"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import {
  failure,
  fieldFailure,
  parseForm,
  success,
  type ActionResult,
  type FieldErrors,
} from "@/lib/forms";
import { formatQty } from "@/lib/qty";
import { correctStock, createStockEntry, StockEntryProblem } from "./data";
import { correctStockSchema, stockEntrySchema } from "./schemas";

/** Add Stock: saves the whole bill in one transaction. Staff and owner can both do this. */
export async function createStockEntryAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  const parsed = parseForm(stockEntrySchema, formData);
  if (!parsed.ok) return parsed.result;
  const { reference, note, lines } = parsed.data;

  try {
    const entry = await createStockEntry(
      getDb(),
      actor.shopId,
      {
        reference,
        note,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          qtyMilli: l.quantity,
          unitCostPaise: l.unitCost,
        })),
      },
      actor.id,
    );
    revalidatePath("/items");
    revalidatePath("/");
    return success("stock.saved", { count: lines.length }, { id: entry.id });
  } catch (error) {
    if (error instanceof StockEntryProblem) {
      const fieldErrors: FieldErrors = {};
      for (const p of error.problems) fieldErrors[`lines.${p.line}.${p.field}`] = { key: p.key };
      return { ok: false, message: { key: "validation.fixErrors" }, fieldErrors };
    }
    throw error;
  }
}

/** Correct stock (owner): set the item's stock to what was counted, with a reason. */
export async function correctStockAction(
  itemId: string,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "correctStock")) return failure("errors.adminOnly");
  if (!z.uuid().safeParse(itemId).success) return failure("errors.notFound");
  const parsed = parseForm(correctStockSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { counted, reason, note } = parsed.data;

  const result = await correctStock(
    getDb(),
    actor.shopId,
    { itemId, countedMilli: counted, reason, note },
    actor.id,
  );
  switch (result.status) {
    case "not-found":
      return failure("errors.notFound");
    case "archived":
      return failure("errors.archivedRecord");
    case "decimal-not-allowed":
      return fieldFailure("counted", "items.decimalNotAllowed");
    case "unchanged":
      return success("stock.correctionUnchanged");
    case "corrected":
      revalidatePath("/items");
      revalidatePath(`/items/${itemId}`);
      revalidatePath("/");
      return success("stock.corrected", { stock: formatQty(result.stockAfterMilli) });
  }
}
