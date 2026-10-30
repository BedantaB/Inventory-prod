-- Multi-shop (v2). Hand-ordered so it works on a database that already has data:
-- existing data becomes the first shop, "My Shop" (rename it in Shop settings).

-- 1. Shops table.
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- 2. New columns, empty for now.
ALTER TABLE "profiles" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_entries" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "order_counters" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shop_id" uuid;--> statement-breakpoint

-- 3. Existing data → the first shop. A brand-new database has no logins yet: then no shop is
--    created, and the built-in units (which now belong to a shop) are removed; every new shop
--    gets its own copy of the default units.
DO $$
DECLARE
  v_shop uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles) THEN
    INSERT INTO public.shops (name) VALUES ('My Shop') RETURNING id INTO v_shop;
    UPDATE public.profiles SET shop_id = v_shop;
    UPDATE public.units SET shop_id = v_shop;
    UPDATE public.categories SET shop_id = v_shop;
    UPDATE public.brands SET shop_id = v_shop;
    UPDATE public.items SET shop_id = v_shop;
    UPDATE public.vendors SET shop_id = v_shop;
    UPDATE public.stock_entries SET shop_id = v_shop;
    UPDATE public.order_counters SET shop_id = v_shop;
    -- Completed orders and stock history are normally protected from changes (triggers);
    -- this one-time move into the shop is the only exception.
    ALTER TABLE public.orders DISABLE TRIGGER protect_completed_orders;
    ALTER TABLE public.order_lines DISABLE TRIGGER protect_completed_order_lines;
    ALTER TABLE public.stock_movements DISABLE TRIGGER stock_movements_immutable;
    UPDATE public.orders SET shop_id = v_shop;
    UPDATE public.order_lines SET shop_id = v_shop;
    UPDATE public.stock_movements SET shop_id = v_shop;
    ALTER TABLE public.stock_movements ENABLE TRIGGER stock_movements_immutable;
    ALTER TABLE public.order_lines ENABLE TRIGGER protect_completed_order_lines;
    ALTER TABLE public.orders ENABLE TRIGGER protect_completed_orders;
  ELSE
    DELETE FROM public.units;
  END IF;
END $$;--> statement-breakpoint

-- 4. Now every row has a shop.
ALTER TABLE "brands" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "units" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_entries" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_counters" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_lines" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shop_id" SET NOT NULL;--> statement-breakpoint

-- 5. Remove the old single-shop keys and links.
ALTER TABLE "orders" DROP CONSTRAINT "orders_order_number_key";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_category_id_categories_id_fk";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_brand_id_brands_id_fk";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_unit_id_units_id_fk";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_item_id_items_id_fk";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_stock_entry_id_stock_entries_id_fk";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_order_id_orders_id_fk";--> statement-breakpoint
ALTER TABLE "order_lines" DROP CONSTRAINT "order_lines_order_id_orders_id_fk";--> statement-breakpoint
ALTER TABLE "order_lines" DROP CONSTRAINT "order_lines_item_id_items_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_vendor_id_vendors_id_fk";--> statement-breakpoint
ALTER TABLE "order_counters" DROP CONSTRAINT "order_counters_pkey";--> statement-breakpoint
DROP INDEX "brands_name_key";--> statement-breakpoint
DROP INDEX "categories_name_key";--> statement-breakpoint
DROP INDEX "items_sku_key";--> statement-breakpoint
DROP INDEX "units_name_key";--> statement-breakpoint

-- 6. (shop_id, id) keys, so other tables can point at "this row, in this shop".
ALTER TABLE "brands" ADD CONSTRAINT "brands_shop_id_key" UNIQUE("shop_id","id");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_shop_id_key" UNIQUE("shop_id","id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_shop_id_key" UNIQUE("shop_id","id");--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_shop_id_key" UNIQUE("shop_id","id");--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_shop_id_key" UNIQUE("shop_id","id");--> statement-breakpoint
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_shop_id_key" UNIQUE("shop_id","id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_key" UNIQUE("shop_id","id");--> statement-breakpoint

-- 7. Links: to the shop, and composite links that can't cross shops.
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_counters" ADD CONSTRAINT "order_counters_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_fk" FOREIGN KEY ("shop_id","category_id") REFERENCES "public"."categories"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_brand_fk" FOREIGN KEY ("shop_id","brand_id") REFERENCES "public"."brands"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_unit_fk" FOREIGN KEY ("shop_id","unit_id") REFERENCES "public"."units"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_fk" FOREIGN KEY ("shop_id","item_id") REFERENCES "public"."items"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_entry_fk" FOREIGN KEY ("shop_id","stock_entry_id") REFERENCES "public"."stock_entries"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "public"."orders"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "public"."orders"("shop_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_fk" FOREIGN KEY ("shop_id","item_id") REFERENCES "public"."items"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vendor_fk" FOREIGN KEY ("shop_id","vendor_id") REFERENCES "public"."vendors"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- 8. Uniqueness per shop, and indexes.
ALTER TABLE "order_counters" ADD CONSTRAINT "order_counters_pkey" PRIMARY KEY("shop_id","financial_year");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_key" UNIQUE("shop_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_key" ON "brands" USING btree ("shop_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_key" ON "categories" USING btree ("shop_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "items_sku_key" ON "items" USING btree ("shop_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "units_name_key" ON "units" USING btree ("shop_id",lower("name"));--> statement-breakpoint
CREATE INDEX "profiles_shop_idx" ON "profiles" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "items_shop_idx" ON "items" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "vendors_shop_idx" ON "vendors" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "stock_entries_shop_idx" ON "stock_entries" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "stock_movements_shop_created_idx" ON "stock_movements" USING btree ("shop_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_shop_status_completed_idx" ON "orders" USING btree ("shop_id","status","completed_at" DESC NULLS LAST);--> statement-breakpoint

-- 9. A login either belongs to a shop or is the platform admin.
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_shop_or_platform" CHECK ("profiles"."is_platform_admin" = ("profiles"."shop_id" IS NULL));
