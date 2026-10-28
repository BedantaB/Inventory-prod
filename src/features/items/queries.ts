import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import * as data from "./data";

export function listItems(params: data.ItemListParams) {
  return data.listItems(getDb(), params);
}

export async function getItem(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return data.getItem(getDb(), id);
}

export function listCategories() {
  return data.listCategories(getDb());
}

export function listUnits() {
  return data.listUnits(getDb());
}
