import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import * as data from "./data";

// Every query takes the shop of the logged-in user (from requireUser()).

export async function getStockEntry(shopId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return data.getStockEntry(getDb(), shopId, id);
}

export function listItemMovements(shopId: string, itemId: string, page?: number) {
  return data.listItemMovements(getDb(), shopId, itemId, page);
}
