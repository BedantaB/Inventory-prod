import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import * as data from "./data";

// Every query takes the shop of the logged-in user (from requireUser()).

export function listItems(shopId: string, params: data.ItemListParams) {
  return data.listItems(getDb(), shopId, params);
}

export async function getItem(shopId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return data.getItem(getDb(), shopId, id);
}

export function photoBelongsToShop(shopId: string, path: string) {
  return data.photoBelongsToShop(getDb(), shopId, path);
}

export function listCategories(shopId: string) {
  return data.listCategories(getDb(), shopId);
}

export function listBrands(shopId: string) {
  return data.listBrands(getDb(), shopId);
}

export function listUnits(shopId: string) {
  return data.listUnits(getDb(), shopId);
}
