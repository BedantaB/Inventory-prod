import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import * as data from "./data";

export async function getStockEntry(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return data.getStockEntry(getDb(), id);
}

export function listItemMovements(itemId: string, page?: number) {
  return data.listItemMovements(getDb(), itemId, page);
}
