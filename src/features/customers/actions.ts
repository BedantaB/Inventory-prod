"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { failure, parseForm, success, type ActionResult } from "@/lib/forms";
import * as data from "./data";
import { customerSchema } from "./schemas";

const isUuid = (id: string) => z.uuid().safeParse(id).success;

function revalidateCustomers(id?: string) {
  revalidatePath("/customers");
  if (id) revalidatePath(`/customers/${id}`);
}

export async function createCustomerAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; businessName: string }>> {
  const actor = await requireUser();
  const parsed = parseForm(customerSchema, formData);
  if (!parsed.ok) return parsed.result;
  const customer = await data.createCustomer(getDb(), parsed.data, actor.id);
  revalidateCustomers();
  return success("customers.created", { name: customer.businessName }, customer);
}

export async function updateCustomerAction(
  customerId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  if (!isUuid(customerId)) return failure("errors.notFound");
  const db = getDb();
  const existing = await data.getCustomer(db, customerId);
  if (!existing) return failure("errors.notFound");
  if (existing.archivedAt) return failure("errors.archivedRecord");
  const parsed = parseForm(customerSchema, formData);
  if (!parsed.ok) return parsed.result;
  await data.updateCustomer(db, customerId, parsed.data);
  revalidateCustomers(customerId);
  return success("customers.updated");
}

export async function setCustomerArchivedAction(
  customerId: string,
  archived: boolean,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "archive")) return failure("errors.adminOnly");
  if (!isUuid(customerId)) return failure("errors.notFound");
  const customer = await data.setCustomerArchived(getDb(), customerId, archived);
  if (!customer) return failure("errors.notFound");
  revalidateCustomers(customerId);
  return success(archived ? "customers.archivedDone" : "customers.unarchivedDone", {
    name: customer.businessName,
  });
}
