import "server-only";
import { getDb } from "@/db";
import * as data from "./data";

// Every query takes the shop of the logged-in user (from requireUser()).

export function customerBalance(shopId: string, customerId: string) {
  return data.customerBalance(getDb(), shopId, customerId);
}

export function listCustomerPayments(shopId: string, customerId: string, page?: number) {
  return data.listCustomerPayments(getDb(), shopId, customerId, page);
}
