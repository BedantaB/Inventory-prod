-- Multi-shop rules (v2): row level security per shop, SKUs per shop, default units for new shops.

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

-- The shop of the logged-in API caller, or null (not logged in, turned off, platform admin,
-- or the shop is turned off).
CREATE OR REPLACE FUNCTION public.current_shop_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.shop_id
    FROM public.profiles p
    JOIN public.shops s ON s.id = p.shop_id
   WHERE p.id = auth.uid() AND p.is_active AND s.is_active;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_active_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.current_shop_id() IS NOT NULL;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND role = 'ADMIN' AND shop_id = public.current_shop_id()
  );
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.current_shop_id() FROM anon;--> statement-breakpoint

-- Read access only inside your own shop.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['units','categories','brands','items','vendors','stock_entries',
                           'stock_movements','orders','order_lines'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Active users can read" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Users read their own shop" ON public.%I FOR SELECT TO authenticated USING (shop_id = (SELECT public.current_shop_id()))', t);
  END LOOP;
END $$;--> statement-breakpoint

DROP POLICY IF EXISTS "Active users can read" ON public.profiles;--> statement-breakpoint
CREATE POLICY "Users read their own shop" ON public.profiles
  FOR SELECT TO authenticated USING (shop_id = (SELECT public.current_shop_id()));--> statement-breakpoint

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON public.shops FROM anon;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.shops FROM authenticated;--> statement-breakpoint
CREATE POLICY "Users read their own shop" ON public.shops
  FOR SELECT TO authenticated USING (id = (SELECT public.current_shop_id()));--> statement-breakpoint

-- SKU auto-generation: unique within the shop.
CREATE OR REPLACE FUNCTION public.items_before_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_candidate text;
BEGIN
  NEW.sku := upper(btrim(coalesce(NEW.sku, '')));
  IF NEW.sku = '' THEN
    LOOP
      v_candidate := 'ITM-' || lpad(nextval('public.item_sku_seq')::text, 5, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.items WHERE shop_id = NEW.shop_id AND sku = v_candidate
      );
    END LOOP;
    NEW.sku := v_candidate;
  END IF;

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
    IF TG_OP = 'UPDATE' AND NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
      RAISE EXCEPTION 'An item cannot move to another shop' USING ERRCODE = 'IV005';
    END IF;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint

-- Every new shop starts with the usual units (owner can add more on the Units page).
CREATE OR REPLACE FUNCTION public.create_default_units(p_shop uuid) RETURNS void
LANGUAGE sql SET search_path = '' AS $$
  INSERT INTO public.units (shop_id, name, label, allows_decimal) VALUES
    (p_shop, 'pcs',    'Pieces',   false),
    (p_shop, 'box',    'Box',      false),
    (p_shop, 'kg',     'Kilogram', true),
    (p_shop, 'litre',  'Litre',    true),
    (p_shop, 'dozen',  'Dozen',    false),
    (p_shop, 'bundle', 'Bundle',   false),
    (p_shop, 'pkt',    'Packet',   false),
    (p_shop, 'set',    'Set',      false),
    (p_shop, 'jar',    'Jar',      false)
  ON CONFLICT DO NOTHING;
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.create_default_units(uuid) FROM anon, authenticated;
