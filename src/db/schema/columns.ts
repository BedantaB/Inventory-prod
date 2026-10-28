import { bigint, numeric, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Column builders must not be shared between tables, so each helper returns fresh builders.

export const timestamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const createdBy = () => ({
  createdBy: uuid()
    .notNull()
    .references(() => profiles.id),
});

export const archivedAt = () => ({
  archivedAt: timestamp({ withTimezone: true }),
});

/** Money: whole paise. ₹1 = 100. Safe in JS numbers up to ~₹90 trillion. */
export const paise = () => bigint({ mode: "number" });

/**
 * Quantity with up to 3 decimals (e.g. 2.5 kg). Drizzle returns these as strings;
 * convert with the helpers in src/lib/qty.ts — never with parseFloat.
 */
export const quantity = () => numeric({ precision: 12, scale: 3 });
