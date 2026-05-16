-- ═══════════════════════════════════════════════════════════════════
-- FIX: order_items column schema mismatch
-- Root cause: CREATE TABLE IF NOT EXISTS in COMPLETE_SETUP.sql skipped
-- recreation when an old order_items table existed with wrong column names.
-- This migration drops and recreates with the exact correct schema.
--
-- SAFE: orders.items (JSONB) preserves all order history.
--       order_items is a normalized analytics projection — safe to rebuild.
--
-- Run AFTER COMPLETE_SETUP.sql in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Step 1: Drop existing order_items (CASCADE removes stale views/triggers)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.order_items CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Step 2: Recreate with exact correct schema
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.order_items (
  id                  BIGSERIAL       PRIMARY KEY,
  order_id            UUID            NOT NULL  REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id          BIGINT          REFERENCES public.products(id) ON DELETE SET NULL,
  product_name        TEXT            NOT NULL  DEFAULT 'Product',
  product_tamil_name  TEXT,
  quantity            NUMERIC(12,3)   NOT NULL  DEFAULT 0,
  unit                TEXT            NOT NULL  DEFAULT 'piece',
  unit_type           TEXT            NOT NULL  DEFAULT 'unit'
                        CHECK (unit_type IN ('unit','weight','volume','bundle')),
  base_quantity       NUMERIC(12,3)   NOT NULL  DEFAULT 1,
  base_price          NUMERIC(10,2)   NOT NULL  DEFAULT 0,
  line_total          NUMERIC(10,2)   NOT NULL  DEFAULT 0,
  image_url           TEXT,
  created_at          TIMESTAMPTZ     NOT NULL  DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- Step 3: Performance indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX idx_order_items_order_id    ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id  ON public.order_items(product_id);
CREATE INDEX idx_order_items_product_name ON public.order_items(product_name);

-- ─────────────────────────────────────────────────────────────
-- Step 4: Row Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_user_select ON public.order_items;
DROP POLICY IF EXISTS order_items_user_insert ON public.order_items;
DROP POLICY IF EXISTS order_items_admin_all   ON public.order_items;

CREATE POLICY order_items_user_select ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR public.is_admin())
  ));

CREATE POLICY order_items_user_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR public.is_admin())
  ));

CREATE POLICY order_items_admin_all ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Step 5: Re-create the atomic order RPC (ensures it references new schema)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_customer_name TEXT,
  p_phone         TEXT,
  p_address       TEXT,
  p_items         JSONB,
  p_shipping      NUMERIC DEFAULT 0,
  p_status        TEXT    DEFAULT 'pending'
)
RETURNS TABLE(order_id UUID, invoice_no TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester  UUID   := auth.uid();
  v_invoice_no TEXT;
  v_order_id   UUID;
  v_subtotal   NUMERIC(10,2) := 0;
  v_total      NUMERIC(10,2);
  v_item       JSONB;
  v_product_id BIGINT;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  v_invoice_no := public.get_next_invoice_no();

  -- Calculate subtotal from item line totals
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + COALESCE((v_item->>'line_total')::NUMERIC, 0);
  END LOOP;

  v_total := v_subtotal + COALESCE(p_shipping, 0);

  -- Insert master order row
  INSERT INTO public.orders (
    invoice_no, user_id, customer_name, phone, address,
    items, subtotal, shipping, total, status
  ) VALUES (
    v_invoice_no,
    v_requester,
    COALESCE(NULLIF(TRIM(p_customer_name), ''), 'Customer'),
    COALESCE(NULLIF(TRIM(p_phone), ''), ''),
    COALESCE(NULLIF(TRIM(p_address), ''), ''),
    p_items,
    v_subtotal,
    COALESCE(p_shipping, 0),
    v_total,
    COALESCE(NULLIF(TRIM(p_status), ''), 'pending')
  ) RETURNING id INTO v_order_id;

  -- Insert normalized order_items rows (uses exact column names)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::BIGINT;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      product_tamil_name,
      quantity,
      unit,
      unit_type,
      base_quantity,
      base_price,
      line_total,
      image_url
    ) VALUES (
      v_order_id,
      v_product_id,
      COALESCE(NULLIF(v_item->>'name',       ''), 'Product'),
      NULLIF(v_item->>'tamil_name', ''),
      COALESCE((v_item->>'quantity')::NUMERIC,      0),
      COALESCE(NULLIF(v_item->>'unit',       ''), 'piece'),
      COALESCE(NULLIF(v_item->>'unit_type',  ''), 'unit'),
      COALESCE((v_item->>'base_quantity')::NUMERIC,  1),
      COALESCE((v_item->>'base_price')::NUMERIC,     0),
      COALESCE((v_item->>'line_total')::NUMERIC,     0),
      NULLIF(v_item->>'image_url', '')
    );

    -- Decrement stock if product_id is known
    IF v_product_id IS NOT NULL THEN
      PERFORM public.retail_decrement_stock(
        v_product_id,
        COALESCE((v_item->>'quantity')::NUMERIC, 0),
        NULLIF(v_item->>'unit', '')
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_invoice_no;
END;
$$;

GRANT  EXECUTE ON FUNCTION public.create_order_with_stock(TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT) TO authenticated;
REVOKE ALL     ON FUNCTION public.create_order_with_stock(TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT) FROM anon;

-- ─────────────────────────────────────────────────────────────
-- Step 6: Enable realtime
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_items'
ORDER BY ordinal_position;
