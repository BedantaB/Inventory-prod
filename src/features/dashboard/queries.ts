import "server-only";
import { connection } from "next/server";
import { getDb } from "@/db";
import * as data from "./data";

export async function getDashboard(shopId: string, showCost: boolean) {
  // "Today" depends on the clock, so this must run at request time (never prerendered).
  await connection();
  return data.getDashboard(getDb(), shopId, { now: new Date(), showCost });
}
