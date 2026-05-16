-- Migration 0004: seed invoice_counter and make get_next_invoice_no idempotent
-- Run in Supabase SQL editor. Safe to re-run (idempotent).

-- Ensure the required seed row exists
INSERT INTO public.invoice_counter (id, counter, year)
VALUES (1, 0, EXTRACT(YEAR FROM NOW())::INTEGER)
ON CONFLICT (id) DO NOTHING;

-- Replace with an upsert-based version that never fails on missing row
CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  cnt INTEGER;
BEGIN
  INSERT INTO public.invoice_counter (id, counter, year)
  VALUES (1, 1, cur_year)
  ON CONFLICT (id) DO UPDATE
    SET counter = CASE
          WHEN invoice_counter.year = cur_year THEN invoice_counter.counter + 1
          ELSE 1
        END,
        year = cur_year
  RETURNING counter INTO cnt;

  RETURN 'INV-' || cur_year || '-' || LPAD(cnt::TEXT, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_invoice_no() TO authenticated;
