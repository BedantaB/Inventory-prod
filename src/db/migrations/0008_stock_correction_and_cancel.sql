CREATE TYPE "public"."adjust_reason" AS ENUM('COUNT', 'DAMAGED', 'LOST', 'OTHER');--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'RETURN';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'CANCELLED';--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_shape";--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "reason" "adjust_reason";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_profiles_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- v1 had no way to record ADJUST rows; if any exist anyway, give them a reason so the new rule holds.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.stock_movements WHERE type = 'ADJUST') THEN
    ALTER TABLE public.stock_movements DISABLE TRIGGER stock_movements_immutable;
    UPDATE public.stock_movements
       SET reason = 'OTHER', note = coalesce(nullif(btrim(note), ''), 'Correction')
     WHERE type = 'ADJUST';
    ALTER TABLE public.stock_movements ENABLE TRIGGER stock_movements_immutable;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reason" CHECK (("stock_movements"."type"::text = 'ADJUST') = ("stock_movements"."reason" IS NOT NULL)
        AND ("stock_movements"."reason"::text <> 'OTHER' OR nullif(btrim("stock_movements"."note"), '') IS NOT NULL));--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shape" CHECK ((
        "stock_movements"."type"::text = 'IN' AND "stock_movements"."quantity_change" > 0 AND "stock_movements"."unit_cost_paise" >= 0
          AND "stock_movements"."stock_entry_id" IS NOT NULL AND "stock_movements"."order_id" IS NULL
      ) OR (
        "stock_movements"."type"::text = 'OUT' AND "stock_movements"."quantity_change" < 0 AND "stock_movements"."unit_price_paise" >= 0
          AND "stock_movements"."order_id" IS NOT NULL AND "stock_movements"."stock_entry_id" IS NULL
      ) OR (
        "stock_movements"."type"::text = 'ADJUST' AND "stock_movements"."quantity_change" <> 0
          AND "stock_movements"."order_id" IS NULL AND "stock_movements"."stock_entry_id" IS NULL
      ) OR (
        "stock_movements"."type"::text = 'RETURN' AND "stock_movements"."quantity_change" > 0 AND "stock_movements"."unit_cost_paise" >= 0
          AND "stock_movements"."order_id" IS NOT NULL AND "stock_movements"."stock_entry_id" IS NULL
      ));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_fields" CHECK (("orders"."status"::text = 'CANCELLED') = (
        "orders"."cancelled_at" IS NOT NULL AND "orders"."cancelled_by" IS NOT NULL
        AND nullif(btrim("orders"."cancel_reason"), '') IS NOT NULL
      ));--> statement-breakpoint

-- Hand-written below. New error code:
--   IV006  stock can only come back (RETURN) from a cancelled order
-- Enum values are compared as text: values added above can't be used in this same transaction.

------------------------------------------------------------------------------------------
-- Stock ledger: RETURN puts stock back at the cost it was sold at (weighted average, like a
-- stock-in). ADJUST records the average cost and never changes it.
------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_stock_movement() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_item      record;
  v_new_stock numeric(12,3);
  v_new_avg   bigint;
BEGIN
  SELECT id, name, current_stock, avg_cost_paise
    INTO v_item
    FROM public.items
   WHERE id = NEW.item_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % does not exist', NEW.item_id USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.type::text = 'RETURN' AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id = NEW.order_id AND status::text = 'CANCELLED'
  ) THEN
    RAISE EXCEPTION 'Stock can only come back from a cancelled order' USING ERRCODE = 'IV006';
  END IF;

  v_new_stock := v_item.current_stock + NEW.quantity_change;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Not enough stock for "%": need %, only % available',
      v_item.name, abs(NEW.quantity_change), v_item.current_stock
      USING ERRCODE = 'IV002';
  END IF;

  v_new_avg := v_item.avg_cost_paise;
  IF NEW.type::text IN ('IN', 'RETURN') THEN
    -- Weighted average cost. With no stock on hand the new cost simply becomes the average.
    IF v_item.current_stock <= 0 THEN
      v_new_avg := NEW.unit_cost_paise;
    ELSE
      v_new_avg := round(
        (v_item.current_stock * v_item.avg_cost_paise + NEW.quantity_change * NEW.unit_cost_paise)
        / v_new_stock);
    END IF;
  ELSE
    -- OUT and ADJUST: record the cost of what left (or turned up); the average stays.
    NEW.unit_cost_paise := v_item.avg_cost_paise;
  END IF;

  PERFORM set_config('app.stock_write', 'on', true);
  UPDATE public.items
     SET current_stock = v_new_stock, avg_cost_paise = v_new_avg
   WHERE id = NEW.item_id;
  PERFORM set_config('app.stock_write', 'off', true);

  NEW.stock_after := v_new_stock;
  RETURN NEW;
END $$;--> statement-breakpoint

------------------------------------------------------------------------------------------
-- Completed orders are final, except: archived_at may change, and the owner may cancel one
-- (COMPLETED → CANCELLED, with who, when and why). Cancelled orders are final too.
------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_completed_orders() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status::text <> 'DRAFT' THEN
      RAISE EXCEPTION 'Completed orders cannot be deleted' USING ERRCODE = 'IV004';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status::text = 'DRAFT' THEN
    RETURN NEW;
  END IF;

  IF (
       NEW.order_number, NEW.vendor_id, NEW.discount_kind, NEW.discount_value,
       NEW.subtotal_paise, NEW.discount_paise, NEW.total_paise, NEW.completed_at,
       NEW.completed_by, NEW.created_at, NEW.created_by, NEW.shop_id
     ) IS DISTINCT FROM (
       OLD.order_number, OLD.vendor_id, OLD.discount_kind, OLD.discount_value,
       OLD.subtotal_paise, OLD.discount_paise, OLD.total_paise, OLD.completed_at,
       OLD.completed_by, OLD.created_at, OLD.created_by, OLD.shop_id
     ) THEN
    RAISE EXCEPTION 'Completed orders cannot be changed' USING ERRCODE = 'IV004';
  END IF;

  IF OLD.status::text = 'COMPLETED' AND NEW.status::text = 'CANCELLED' THEN
    RETURN NEW; -- cancelling (orders_cancelled_fields makes sure who, when and why are set)
  END IF;

  IF (NEW.status, NEW.cancelled_at, NEW.cancelled_by, NEW.cancel_reason)
     IS DISTINCT FROM (OLD.status, OLD.cancelled_at, OLD.cancelled_by, OLD.cancel_reason) THEN
    RAISE EXCEPTION 'Completed orders cannot be changed' USING ERRCODE = 'IV004';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.protect_completed_order_lines() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_order_ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_order_ids := ARRAY[NEW.order_id];
  ELSIF TG_OP = 'UPDATE' THEN
    v_order_ids := ARRAY[OLD.order_id, NEW.order_id];
  ELSE
    v_order_ids := ARRAY[OLD.order_id];
  END IF;

  IF EXISTS (SELECT 1 FROM public.orders WHERE id = ANY (v_order_ids) AND status::text <> 'DRAFT') THEN
    RAISE EXCEPTION 'Lines of a completed order cannot be changed' USING ERRCODE = 'IV004';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
