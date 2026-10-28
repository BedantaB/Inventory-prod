import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import * as data from "./data";

export function listCustomers(params: Parameters<typeof data.listCustomers>[1]) {
  return data.listCustomers(getDb(), params);
}

export async function getCustomer(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return data.getCustomer(getDb(), id);
}

export function listCustomerOrders(customerId: string, page?: number) {
  return data.listCustomerOrders(getDb(), customerId, page);
}
