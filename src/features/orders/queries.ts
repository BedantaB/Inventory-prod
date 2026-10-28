import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import * as data from "./data";

const isUuid = (id: string) => z.uuid().safeParse(id).success;

export async function getDraft(id: string, showCost: boolean) {
  return isUuid(id) ? data.getDraft(getDb(), id, showCost) : null;
}

export async function getOrder(id: string, showCost: boolean) {
  return isUuid(id) ? data.getOrder(getDb(), id, showCost) : null;
}

export function listDrafts() {
  return data.listDrafts(getDb());
}

export function listOrders(params: data.OrderListParams) {
  return data.listOrders(getDb(), params);
}
