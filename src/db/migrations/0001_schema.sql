CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('IN', 'OUT', 'ADJUST');--> statement-breakpoint
CREATE TYPE "public"."discount_kind" AS ENUM('AMOUNT', 'PERCENT');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'STAFF' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" text DEFAULT '' NOT NULL,
	"category_id" uuid,
	"unit_id" uuid NOT NULL,
	"pack_size" text,
	"selling_price_paise" bigint,
	"current_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"avg_cost_paise" bigint DEFAULT 0 NOT NULL,
	"low_stock_threshold" numeric(12, 3) DEFAULT '0' NOT NULL,
	"photo_path" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "items_current_stock_nonneg" CHECK ("items"."current_stock" >= 0),
	CONSTRAINT "items_avg_cost_nonneg" CHECK ("items"."avg_cost_paise" >= 0),
	CONSTRAINT "items_selling_price_nonneg" CHECK ("items"."selling_price_paise" >= 0),
	CONSTRAINT "items_low_stock_threshold_nonneg" CHECK ("items"."low_stock_threshold" >= 0),
	CONSTRAINT "items_name_not_blank" CHECK (btrim("items"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"allows_decimal" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"contact_person" text,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"city" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "vendors_phone_format" CHECK ("vendors"."phone" ~ '^\+91[6-9][0-9]{9}$'),
	CONSTRAINT "vendors_business_name_not_blank" CHECK (btrim("vendors"."business_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "stock_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "movement_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity_change" numeric(12, 3) NOT NULL,
	"unit_cost_paise" bigint,
	"unit_price_paise" bigint,
	"stock_after" numeric(12, 3) DEFAULT '0' NOT NULL,
	"stock_entry_id" uuid,
	"order_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "stock_movements_shape" CHECK ((
        "stock_movements"."type" = 'IN' AND "stock_movements"."quantity_change" > 0 AND "stock_movements"."unit_cost_paise" >= 0
          AND "stock_movements"."stock_entry_id" IS NOT NULL AND "stock_movements"."order_id" IS NULL
      ) OR (
        "stock_movements"."type" = 'OUT' AND "stock_movements"."quantity_change" < 0 AND "stock_movements"."unit_price_paise" >= 0
          AND "stock_movements"."order_id" IS NOT NULL AND "stock_movements"."stock_entry_id" IS NULL
      ) OR (
        "stock_movements"."type" = 'ADJUST' AND "stock_movements"."quantity_change" <> 0
          AND "stock_movements"."order_id" IS NULL AND "stock_movements"."stock_entry_id" IS NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "order_counters" (
	"financial_year" text PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price_paise" bigint,
	"unit_cost_paise" bigint,
	"line_total_paise" bigint,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "order_lines_order_item_key" UNIQUE("order_id","item_id"),
	CONSTRAINT "order_lines_quantity_positive" CHECK ("order_lines"."quantity" > 0),
	CONSTRAINT "order_lines_unit_price_nonneg" CHECK ("order_lines"."unit_price_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "order_status" DEFAULT 'DRAFT' NOT NULL,
	"order_number" text,
	"vendor_id" uuid,
	"discount_kind" "discount_kind" DEFAULT 'AMOUNT' NOT NULL,
	"discount_value" bigint DEFAULT 0 NOT NULL,
	"subtotal_paise" bigint,
	"discount_paise" bigint,
	"total_paise" bigint,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "orders_order_number_key" UNIQUE("order_number"),
	CONSTRAINT "orders_discount_value_nonneg" CHECK ("orders"."discount_value" >= 0),
	CONSTRAINT "orders_discount_percent_max" CHECK ("orders"."discount_kind" <> 'PERCENT' OR "orders"."discount_value" <= 10000),
	CONSTRAINT "orders_completed_fields" CHECK ("orders"."status" = 'DRAFT' OR (
        "orders"."order_number" IS NOT NULL AND "orders"."vendor_id" IS NOT NULL
        AND "orders"."completed_at" IS NOT NULL AND "orders"."completed_by" IS NOT NULL
        AND "orders"."subtotal_paise" IS NOT NULL AND "orders"."discount_paise" IS NOT NULL
        AND "orders"."total_paise" IS NOT NULL
      )),
	CONSTRAINT "orders_totals_consistent" CHECK ("orders"."total_paise" IS NULL OR (
        "orders"."discount_paise" >= 0 AND "orders"."discount_paise" <= "orders"."subtotal_paise"
        AND "orders"."total_paise" = "orders"."subtotal_paise" - "orders"."discount_paise"
      ))
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_entry_id_stock_entries_id_fk" FOREIGN KEY ("stock_entry_id") REFERENCES "public"."stock_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_completed_by_profiles_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_key" ON "categories" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "items_sku_key" ON "items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "items_name_trgm_idx" ON "items" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "items_sku_trgm_idx" ON "items" USING gin ("sku" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_name_key" ON "units" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "vendors_business_name_trgm_idx" ON "vendors" USING gin ("business_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "vendors_contact_person_trgm_idx" ON "vendors" USING gin ("contact_person" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "vendors_phone_trgm_idx" ON "vendors" USING gin ("phone" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "vendors_city_trgm_idx" ON "vendors" USING gin ("city" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "stock_movements_item_created_idx" ON "stock_movements" USING btree ("item_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stock_movements_created_idx" ON "stock_movements" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stock_movements_stock_entry_idx" ON "stock_movements" USING btree ("stock_entry_id");--> statement-breakpoint
CREATE INDEX "stock_movements_order_idx" ON "stock_movements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_lines_item_idx" ON "order_lines" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "orders_status_completed_at_idx" ON "orders" USING btree ("status","completed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_vendor_idx" ON "orders" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "orders_order_number_trgm_idx" ON "orders" USING gin ("order_number" gin_trgm_ops);