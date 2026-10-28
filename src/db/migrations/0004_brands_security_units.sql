-- Brands: same protection as every other table (see 0002_rules_and_security.sql).
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON public.brands FROM anon;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.brands FROM authenticated;--> statement-breakpoint
CREATE POLICY "Active users can read" ON public.brands
  FOR SELECT TO authenticated USING ((SELECT public.is_active_user()));--> statement-breakpoint

-- Units common in stationery wholesale.
INSERT INTO public.units (name, label, allows_decimal) VALUES
  ('pkt', 'Packet', false),
  ('set', 'Set',    false),
  ('jar', 'Jar',    false)
ON CONFLICT DO NOTHING;
