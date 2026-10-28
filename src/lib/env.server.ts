import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  STAFF_EMAIL_DOMAIN: z.string().min(3).default("staff.inventory.app"),
  // Printed at the top of orders.
  BUSINESS_NAME: z.string().default("Inventory"),
  BUSINESS_ADDRESS: z.string().default(""),
  BUSINESS_PHONE: z.string().default(""),
});

let cached: z.infer<typeof schema> | undefined;

/** Validated server environment. Throws a readable error listing missing variables. */
export function serverEnv() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Missing or invalid environment variables: ${names}. See .env.example.`);
    }
    cached = parsed.data;
  }
  return cached;
}
