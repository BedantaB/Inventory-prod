CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'UPI', 'BANK', 'CHEQUE');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"order_id" uuid,
	"amount_paise" bigint NOT NULL,
	"method" "payment_method" NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" text,
	"note" text,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_paise" > 0),
	CONSTRAINT "payments_voided_fields" CHECK (("payments"."voided_at" IS NULL) = ("payments"."voided_by" IS NULL)
        AND ("payments"."voided_at" IS NULL) = (nullif(btrim("payments"."void_reason"), '') IS NULL))
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_profiles_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_fk" FOREIGN KEY ("shop_id","vendor_id") REFERENCES "public"."vendors"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "public"."orders"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_shop_vendor_idx" ON "payments" USING btree ("shop_id","vendor_id");--> statement-breakpoint
CREATE INDEX "payments_shop_received_idx" ON "payments" USING btree ("shop_id","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint

-- Hand-written below. New error codes:
--   IV007  payments cannot be changed or deleted (only voided, once)
--   IV008  a payment made with an order must be for that order's customer, on a completed order

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.protect_payments() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'A new payment cannot already be voided' USING ERRCODE = 'IV007';
    END IF;
    IF NEW.order_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.orders
       WHERE id = NEW.order_id AND vendor_id = NEW.vendor_id AND status::text = 'COMPLETED'
    ) THEN
      RAISE EXCEPTION 'A payment with an order must be for that order''s customer'
        USING ERRCODE = 'IV008';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payments cannot be deleted; void them instead' USING ERRCODE = 'IV007';
  END IF;

  -- UPDATE: only voiding (once). Everything else stays as it was recorded.
  IF OLD.voided_at IS NOT NULL OR NEW.voided_at IS NULL OR (
       NEW.shop_id, NEW.vendor_id, NEW.order_id, NEW.amount_paise, NEW.method, NEW.received_at,
       NEW.reference, NEW.note, NEW.created_at, NEW.created_by
     ) IS DISTINCT FROM (
       OLD.shop_id, OLD.vendor_id, OLD.order_id, OLD.amount_paise, OLD.method, OLD.received_at,
       OLD.reference, OLD.note, OLD.created_at, OLD.created_by
     ) THEN
    RAISE EXCEPTION 'Payments cannot be changed; void it and record it again'
      USING ERRCODE = 'IV007';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint

CREATE TRIGGER protect_payments BEFORE INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.protect_payments();--> statement-breakpoint

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON public.payments FROM anon;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payments FROM authenticated;--> statement-breakpoint
CREATE POLICY "Users read their own shop" ON public.payments
  FOR SELECT TO authenticated USING (shop_id = (SELECT public.current_shop_id()));
