CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "variant" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "mrp_paise" bigint;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_key" ON "brands" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_variant_trgm_idx" ON "items" USING gin ("variant" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "items_pack_size_trgm_idx" ON "items" USING gin ("pack_size" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "items_brand_idx" ON "items" USING btree ("brand_id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_mrp_nonneg" CHECK ("items"."mrp_paise" >= 0);--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_selling_price_within_mrp" CHECK ("items"."selling_price_paise" IS NULL OR "items"."mrp_paise" IS NULL OR "items"."selling_price_paise" <= "items"."mrp_paise");