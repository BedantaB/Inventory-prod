import "server-only";
import { z } from "zod";
import { getDb } from "@/db";
import * as data from "./data";

export function listShops() {
  return data.listShops(getDb());
}

export async function getShop(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return data.getShop(getDb(), id);
}

export function listShopOwners(shopId: string) {
  return data.listShopOwners(getDb(), shopId);
}
