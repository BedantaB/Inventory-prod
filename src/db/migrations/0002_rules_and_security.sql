-- Hand-written migration: business rules that live in the database, plus Row Level Security.
-- Custom error codes (SQLSTATE) used by the app to show friendly messages:
--   IV001  stock/avg-cost changed outside a stock movement
--   IV002  not enough stock
--   IV003  stock history (ledger) rows cannot be changed
--   IV004  completed orders cannot be changed

------------------------------------------------------------------------------------------
-- updated_at, maintained by the database
------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','units','categories','items','vendors','stock_entries','orders','order_lines'] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;--> statement-breakpoint

------------------------------------------------------------------------------------------
-- Items: SKU normalisation/auto-generation, and the stock guard
------------------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.item_sku_seq;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.items_before_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_candidate text;
BEGIN
  -- SKU: trimmed + upper-case; generate ITM-00001 style when blank.
  NEW.sku := upper(btrim(coalesce(NEW.sku, '')));
  IF NEW.sku = '' THEN
    LOOP
      v_candidate := 'ITM-' || lpad(nextval('public.item_sku_seq')::text, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.items WHERE sku = v_candidate);
    END LOOP;
    NEW.sku := v_candidate;
  END IF;

  -- current_stock and avg_cost_paise may only change inside apply_stock_movement().
  IF coalesce(current_setting('app.stock_write', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' AND (NEW.current_stock <> 0 OR NEW.avg_cost_paise <> 0) THEN
      RAISE EXCEPTION 'New items start with zero stock; use Add Stock to add quantity'
        USING ERRCODE = 'IV001';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.current_stock IS DISTINCT FROM OLD.current_stock
                          OR NEW.avg_cost_paise IS DISTINCT FROM OLD.avg_cost_paise) THEN
      RAISE EXCEPTION 'Stock can only change through a stock movement'
        USING ERRCODE = 'IV001';
    END IF;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint

CREATE TRIGGER items_before_write BEFORE INSERT OR UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.items_before_write();--> statement-breakpoint

------------------------------------------------------------------------------------------
-- Stock ledger: every movement updates the item in the same transaction
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

  v_new_stock := v_item.current_stock + NEW.quantity_change;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Not enough stock for "%": need %, only % available',
      v_item.name, abs(NEW.quantity_change), v_item.current_stock
      USING ERRCODE = 'IV002';
  END IF;

  v_new_avg := v_item.avg_cost_paise;
  IF NEW.type = 'IN' THEN
    -- Weighted average cost. With no stock on hand the new cost simply becomes the average.
    IF v_item.current_stock <= 0 THEN
      v_new_avg := NEW.unit_cost_paise;
    ELSE
      v_new_avg := round(
        (v_item.current_stock * v_item.avg_cost_paise + NEW.quantity_change * NEW.unit_cost_paise)
        / v_new_stock);
    END IF;
  ELSIF NEW.type = 'OUT' THEN
    -- Record the cost of what was sold; selling never changes the average.
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

CREATE TRIGGER apply_stock_movement BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.prevent_ledger_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Stock history cannot be changed or deleted' USING ERRCODE = 'IV003';
END $$;--> statement-breakpoint

CREATE TRIGGER stock_movements_immutable BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_change();--> statement-breakpoint

------------------------------------------------------------------------------------------
-- Completed orders are final (only archived_at may change)
------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_completed_orders() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'COMPLETED' THEN
      RAISE EXCEPTION 'Completed orders cannot be deleted' USING ERRCODE = 'IV004';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'COMPLETED' AND (
       NEW.status, NEW.order_number, NEW.vendor_id, NEW.discount_kind, NEW.discount_value,
       NEW.subtotal_paise, NEW.discount_paise, NEW.total_paise, NEW.completed_at,
       NEW.completed_by, NEW.created_at, NEW.created_by
     ) IS DISTINCT FROM (
       OLD.status, OLD.order_number, OLD.vendor_id, OLD.discount_kind, OLD.discount_value,
       OLD.subtotal_paise, OLD.discount_paise, OLD.total_paise, OLD.completed_at,
       OLD.completed_by, OLD.created_at, OLD.created_by
     ) THEN
    RAISE EXCEPTION 'Completed orders cannot be changed' USING ERRCODE = 'IV004';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint

CREATE TRIGGER protect_completed_orders BEFORE UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_completed_orders();--> statement-breakpoint

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

  IF EXISTS (SELECT 1 FROM public.orders WHERE id = ANY (v_order_ids) AND status = 'COMPLETED') THEN
    RAISE EXCEPTION 'Lines of a completed order cannot be changed' USING ERRCODE = 'IV004';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint

CREATE TRIGGER protect_completed_order_lines BEFORE INSERT OR UPDATE OR DELETE ON public.order_lines
  FOR EACH ROW EXECUTE FUNCTION public.protect_completed_order_lines();--> statement-breakpoint

------------------------------------------------------------------------------------------
-- Row Level Security
-- The app talks to Postgres only from the server (Drizzle, as the table owner), and checks
-- login, active status and role in every server action. RLS is the second wall: anyone
-- using the public Supabase key directly can only READ, and only if they are a logged-in,
-- active user. No write policies exist, so all writes must go through the server.
------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active
  );
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active AND role = 'ADMIN'
  );
$$;--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','units','categories','items','vendors','stock_entries',
                           'stock_movements','orders','order_lines','order_counters'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t);
    IF t <> 'order_counters' THEN
      EXECUTE format(
        'CREATE POLICY "Active users can read" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_active_user()))', t);
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

REVOKE ALL ON SEQUENCE public.item_sku_seq FROM anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.is_active_user(), public.is_admin() FROM anon;--> statement-breakpoint

------------------------------------------------------------------------------------------
-- Built-in units (admin can add/edit more later)
------------------------------------------------------------------------------------------
INSERT INTO public.units (name, label, allows_decimal) VALUES
  ('pcs',    'Pieces',   false),
  ('box',    'Box',      false),
  ('kg',     'Kilogram', true),
  ('litre',  'Litre',    true),
  ('dozen',  'Dozen',    false),
  ('bundle', 'Bundle',   false)
ON CONFLICT DO NOTHING;--> statement-breakpoint

------------------------------------------------------------------------------------------
-- Private bucket for item photos (Supabase Storage). Uploads go through the server.
------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('item-photos', 'item-photos', false, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
