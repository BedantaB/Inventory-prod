import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { archivedAt, createdBy, timestamps } from "./columns";

/**
 * The businesses you SELL to. The UI calls them "Customers";
 * the code and database call them vendors (see CLAUDE.md).
 */
export const vendors = pgTable(
  "vendors",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessName: text().notNull(),
    contactPerson: text(),
    // Stored as +91XXXXXXXXXX.
    phone: text().notNull(),
    email: text(),
    address: text(),
    city: text(),
    notes: text(),
    ...archivedAt(),
    ...timestamps(),
    ...createdBy(),
  },
  (t) => [
    index("vendors_business_name_trgm_idx").using("gin", t.businessName.op("gin_trgm_ops")),
    index("vendors_contact_person_trgm_idx").using("gin", t.contactPerson.op("gin_trgm_ops")),
    index("vendors_phone_trgm_idx").using("gin", t.phone.op("gin_trgm_ops")),
    index("vendors_city_trgm_idx").using("gin", t.city.op("gin_trgm_ops")),
    check("vendors_phone_format", sql`${t.phone} ~ '^\\+91[6-9][0-9]{9}$'`),
    check("vendors_business_name_not_blank", sql`btrim(${t.businessName}) <> ''`),
  ],
);
