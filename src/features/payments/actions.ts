"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { failure, fieldFailure, parseForm, success, type ActionResult } from "@/lib/forms";
import { formatINR } from "@/lib/money";
import { recordPayment, voidPayment } from "./data";
import { receivedAtFrom } from "./received-at";
import { paymentSchema, voidPaymentSchema } from "./schemas";

const isUuid = (id: string) => z.uuid().safeParse(id).success;

/** Record payment (staff and owner): money received from a customer. */
export async function recordPaymentAction(
  customerId: string,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!isUuid(customerId)) return failure("errors.notFound");
  const parsed = parseForm(paymentSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { amount, method, receivedOn, reference, note } = parsed.data;

  const receivedAt = receivedAtFrom(receivedOn, new Date());
  if (receivedAt === "future") return fieldFailure("receivedOn", "payments.futureDate");
  if (receivedAt === "invalid") return fieldFailure("receivedOn", "validation.invalidDate");

  const result = await recordPayment(
    getDb(),
    actor.shopId,
    customerId,
    { amountPaise: amount, method, receivedAt, reference, note },
    actor.id,
  );
  if (result.status === "not-found") return failure("errors.notFound");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/");
  return success("payments.recorded", { amount: formatINR(amount) });
}

/** Void a wrong payment (owner). It stays on record, marked void, and stops counting. */
export async function voidPaymentAction(
  customerId: string,
  paymentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "voidPayment")) return failure("errors.adminOnly");
  if (!isUuid(paymentId)) return failure("errors.notFound");
  const parsed = parseForm(voidPaymentSchema, formData);
  if (!parsed.ok) return parsed.result;

  const result = await voidPayment(getDb(), actor.shopId, paymentId, parsed.data.reason, actor.id);
  if (result.status === "not-found") return failure("errors.notFound");
  if (result.status === "already-voided") return failure("payments.alreadyVoided");
  revalidatePath("/customers");
  if (isUuid(customerId)) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/");
  return success("payments.voided", { amount: formatINR(result.amountPaise ?? 0) });
}
