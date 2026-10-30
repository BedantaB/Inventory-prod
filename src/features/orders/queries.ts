import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import * as data from "./data";

// Every query takes the shop of the logged-in user (from requireUser()).

const isUuid = (id: string) => z.uuid().safeParse(id).success;

export async function getDraft(shopId: string, id: string, showCost: boolean) {
  return isUuid(id) ? data.getDraft(getDb(), shopId, id, showCost) : null;
}

export async function getOrder(shopId: string, id: string, showCost: boolean) {
  return isUuid(id) ? data.getOrder(getDb(), shopId, id, showCost) : null;
}

export function listDrafts(shopId: string) {
  return data.listDrafts(getDb(), shopId);
}

export function listOrders(shopId: string, params: data.OrderListParams) {
  return data.listOrders(getDb(), shopId, params);
}
