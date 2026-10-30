"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { MAX_PRICE_PAISE } from "@/features/items/schemas";
import { failure, parseForm, success, type ActionResult, type Message } from "@/lib/forms";
import { rupeesToPaise } from "@/lib/money";
import { parseQty } from "@/lib/qty";
import * as data from "./data";
import { parsePercent, type DiscountKind } from "./totals";

const isUuid = (id: unknown): id is string =>
  typeof id === "string" && z.uuid().safeParse(id).success;
const notFound = () => failure("orders.notFound");

/** "Start new order" (optionally for a customer). Opens the cart. */
export async function startOrderAction(customerId: string | null): Promise<void> {
  const actor = await requireUser();
  const { id } = await data.createDraft(
    getDb(),
    actor.shopId,
    actor.id,
    isUuid(customerId) ? customerId : null,
  );
  revalidatePath("/orders/new");
  redirect(`/orders/${id}`);
}

export async function setCustomerAction(
  orderId: string,
  customerId: string | null,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!isUuid(orderId) || (customerId !== null && !isUuid(customerId))) return notFound();
  const result = await data.setDraftCustomer(getDb(), actor.shopId, orderId, customerId);
  return result === "ok" ? success() : notFound();
}

export async function searchCustomersAction(query: string) {
  const actor = await requireUser();
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  return data.searchCustomers(getDb(), actor.shopId, q);
}

export async function addItemAction(
  orderId: string,
  itemId: string,
): Promise<ActionResult<{ line: data.DraftLine; merged: boolean }>> {
  const actor = await requireUser();
  if (!isUuid(orderId) || !isUuid(itemId)) return notFound();
  const result = await data.addDraftLine(
    getDb(),
    actor.shopId,
    orderId,
    itemId,
    actor.id,
    can(actor, "viewCost"),
  );
  if (result.status === "not-found") return notFound();
  if (result.status === "item-unavailable") return failure("orders.itemUnavailable");
  return success(undefined, undefined, { line: result.line, merged: result.merged });
}

/** Saves one cart line. Quantity and price arrive as typed; an empty price is allowed in a draft. */
export async function updateLineAction(
  orderId: string,
  lineId: string,
  quantity: string,
  unitPrice: string,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!isUuid(orderId) || !isUuid(lineId)) return notFound();
  const qtyMilli = parseQty(quantity, { allowDecimal: true });
  if (qtyMilli === null || qtyMilli <= 0) return failure("stock.invalidQuantity");
  let unitPricePaise: number | null = null;
  if (unitPrice.trim() !== "") {
    unitPricePaise = rupeesToPaise(unitPrice);
    if (unitPricePaise === null) return failure("items.invalidPrice");
    if (unitPricePaise > MAX_PRICE_PAISE) return failure("validation.tooLarge");
  }
  const result = await data.updateDraftLine(getDb(), actor.shopId, orderId, lineId, {
    qtyMilli,
    unitPricePaise,
  });
  if (result === "decimal-not-allowed") return failure("items.decimalNotAllowed");
  return result === "ok" ? success() : notFound();
}

export async function removeLineAction(orderId: string, lineId: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (!isUuid(orderId) || !isUuid(lineId)) return notFound();
  return (await data.removeDraftLine(getDb(), actor.shopId, orderId, lineId)) === "ok"
    ? success()
    : notFound();
}

export async function setDiscountAction(
  orderId: string,
  kind: DiscountKind,
  value: string,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!isUuid(orderId) || (kind !== "AMOUNT" && kind !== "PERCENT")) return notFound();
  const text = value.trim() === "" ? "0" : value;
  const parsed = kind === "AMOUNT" ? rupeesToPaise(text) : parsePercent(text);
  if (parsed === null || parsed > MAX_PRICE_PAISE) return failure("orders.invalidDiscount");
  return (await data.setDraftDiscount(getDb(), actor.shopId, orderId, kind, parsed)) === "ok"
    ? success()
    : notFound();
}

export async function discardOrderAction(orderId: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (!isUuid(orderId)) return notFound();
  if (!(await data.discardDraft(getDb(), actor.shopId, orderId))) return notFound();
  revalidatePath("/orders/new");
  return success("orders.discarded");
}

export type CheckoutActionResult =
  | { ok: true; id: string; orderNumber: string }
  | { ok: false; message: Message; shortages?: data.Shortage[]; lineIds?: string[] };

/** Complete the order. The server re-checks everything from the database. */
export async function checkoutAction(orderId: string): Promise<CheckoutActionResult> {
  const actor = await requireUser();
  if (!isUuid(orderId)) return { ok: false, message: { key: "orders.notFound" } };
  const result = await data.checkoutDraft(getDb(), actor.shopId, orderId, actor.id);

  switch (result.status) {
    case "completed":
    case "already-completed":
      revalidatePath("/orders");
      revalidatePath("/orders/new");
      revalidatePath("/items");
      revalidatePath("/");
      return { ok: true, id: result.id, orderNumber: result.orderNumber };
    case "not-found":
      return { ok: false, message: { key: "orders.notFound" } };
    case "short":
      return { ok: false, message: { key: "orders.shortTitle" }, shortages: result.shortages };
    case "problems": {
      const first = result.problems[0];
      const lineIds = result.problems.flatMap((p) => ("lineIds" in p ? p.lineIds : []));
      return { ok: false, message: { key: first.key }, lineIds };
    }
  }
}

export async function setOrderArchivedAction(
  orderId: string,
  archived: boolean,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "archive")) return failure("errors.adminOnly");
  if (!isUuid(orderId)) return notFound();
  const order = await data.setOrderArchived(getDb(), actor.shopId, orderId, archived);
  if (!order) return notFound();
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return success(archived ? "orders.archivedDone" : "orders.unarchivedDone", {
    number: order.orderNumber ?? "",
  });
}

const cancelOrderSchema = z.object({
  reason: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "orders.cancelReasonRequired" })
    .max(300, { error: "validation.tooLong" }),
});

/** Cancel a completed order (owner): the stock goes back; the order stays, marked Cancelled. */
export async function cancelOrderAction(
  orderId: string,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "cancelOrder")) return failure("errors.adminOnly");
  if (!isUuid(orderId)) return notFound();
  const parsed = parseForm(cancelOrderSchema, formData);
  if (!parsed.ok) return parsed.result;

  const result = await data.cancelOrder(
    getDb(),
    actor.shopId,
    orderId,
    parsed.data.reason,
    actor.id,
  );
  if (result.status === "not-found") return notFound();
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/items");
  revalidatePath("/");
  return success(
    result.status === "cancelled" ? "orders.cancelledDone" : "orders.alreadyCancelled",
    { number: result.orderNumber },
  );
}
