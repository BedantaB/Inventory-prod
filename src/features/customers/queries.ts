import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import * as data from "./data";

// Every query takes the shop of the logged-in user (from requireUser()).

export function listCustomers(shopId: string, params: Parameters<typeof data.listCustomers>[2]) {
  return data.listCustomers(getDb(), shopId, params);
}

export async function getCustomer(shopId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return data.getCustomer(getDb(), shopId, id);
}

export function listCustomerOrders(shopId: string, customerId: string, page?: number) {
  return data.listCustomerOrders(getDb(), shopId, customerId, page);
}
