"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/features/auth/session";
import { parseForm, success, type ActionResult, type FieldErrors } from "@/lib/forms";
import { createStockEntry, StockEntryProblem } from "./data";
import { stockEntrySchema } from "./schemas";

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
