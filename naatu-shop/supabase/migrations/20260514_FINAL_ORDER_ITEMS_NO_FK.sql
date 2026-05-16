-- ═══════════════════════════════════════════════════════════════════
-- FINAL FIX: order_items — remove FK on product_id
--
-- Root cause: products.id is UUID. After COMPLETE_SETUP.sql ran
-- DELETE + re-INSERT on products, all products got new UUIDs.
-- Any cart item stored in localStorage before migration still has
-- the old UUID → FK check fails on INSERT.
--
-- Correct architecture: order_items.product_id has NO FK constraint.
-- Orders are immutable historical records. product_name stores the
-- durable display reference. product_id is kept as a loose UUID for
-- analytics only — it does NOT enforce referential integrity.
--
-- RUN THIS FILE in Supabase SQL Editor → New Query → Run All
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Drop existing order_items completely
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.order_items CASCADE;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Recreate — product_id is UUID but NO FK constraint
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.order_items (
  id                  BIGSERIAL       PRIMARY KEY,
  order_id            UUID            NOT NULL
                        REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id          UUID,           -- loose reference only, no FK enforcement
  product_name        TEXT            NOT NULL DEFAULT 'Product',
  product_tamil_name  TEXT,
  quantity            NUMERIC(12,3)   NOT NULL DEFAULT 0,
  unit                TEXT            NOT NULL DEFAULT 'piece',
  unit_type           TEXT            NOT NULL DEFAULT 'unit'
                        CHECK (unit_type IN ('unit','weight','volume','bundle')),
  base_quantity       NUMERIC(12,3)   NOT NULL DEFAULT 1,
  base_price          NUMERIC(10,2)   NOT NULL DEFAULT 0,
  line_total          NUMERIC(10,2)   NOT NULL DEFAULT 0,
  image_url           TEXT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- STEP 3: Indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX idx_order_items_order_id     ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id   ON public.order_items(product_id);
CREATE INDEX idx_order_items_product_name ON public.order_items(product_name);

-- ─────────────────────────────────────────────────────────────
-- STEP 4: Row Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_user_select ON public.order_items;
DROP POLICY IF EXISTS order_items_user_insert ON public.order_items;
DROP POLICY IF EXISTS order_items_admin_all   ON public.order_items;

CREATE POLICY order_items_user_select ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY order_items_user_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY order_items_admin_all ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- STEP 5: retail_decrement_stock — UUID, graceful no-op if product gone
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.retail_decrement_stock(BIGINT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.retail_decrement_stock(UUID,   NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.retail_decrement_stock(
  p_product_id UUID,
  p_quantity   NUMERIC,
  p_unit       TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit TEXT    := COALESCE(LOWER(TRIM(p_unit)), '');
  v_qty  NUMERIC := p_quantity;
BEGIN
  -- Convert to base gram/ml if larger unit was selected
  IF v_unit = 'kg' THEN v_qty := p_quantity * 1000; END IF;
  IF v_unit = 'l'  THEN v_qty := p_quantity * 1000; END IF;

  -- UPDATE affects 0 rows if product no longer exists — no error, just a no-op
  UPDATE public.products
  SET
    stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_qty, 0),
    stock          = GREATEST(FLOOR(COALESCE(stock_quantity, 0) - v_qty), 0)::INTEGER
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retail_decrement_stock(UUID, NUMERIC, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- STEP 6: create_order_with_stock — final production-safe version
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_order_with_stock(TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT);

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
  v_requester  UUID := auth.uid();
  v_invoice_no TEXT;
  v_order_id   UUID;
  v_subtotal   NUMERIC(10,2) := 0;
  v_total      NUMERIC(10,2);
  v_item       JSONB;
  v_product_id UUID;
BEGIN
  -- Auth guard
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Items guard
  IF p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  -- Generate unique invoice number
  v_invoice_no := public.get_next_invoice_no();

  -- Sum line totals for subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + COALESCE((v_item->>'line_total')::NUMERIC, 0);
  END LOOP;

  v_total := v_subtotal + COALESCE(p_shipping, 0);

  -- Insert master order record
  INSERT INTO public.orders (
    invoice_no, user_id, customer_name, phone, address,
    items, subtotal, shipping, total, status
  ) VALUES (
    v_invoice_no,
    v_requester,
    COALESCE(NULLIF(TRIM(p_customer_name), ''), 'Customer'),
    COALESCE(NULLIF(TRIM(p_phone),         ''), ''),
    COALESCE(NULLIF(TRIM(p_address),       ''), ''),
    p_items,
    v_subtotal,
    COALESCE(p_shipping, 0),
    v_total,
    COALESCE(NULLIF(TRIM(p_status), ''), 'pending')
  )
  RETURNING id INTO v_order_id;

  -- Insert normalized order_items rows
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP

    -- Safely parse product_id as UUID — NULL if missing, empty, or invalid format
    BEGIN
      v_product_id := NULLIF(TRIM(COALESCE(v_item->>'product_id', '')), '')::UUID;
    EXCEPTION WHEN others THEN
      v_product_id := NULL;
    END;

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
      v_product_id,                                                              -- UUID, no FK — always succeeds
      COALESCE(NULLIF(TRIM(v_item->>'name'),       ''), 'Product'),
      NULLIF(TRIM(COALESCE(v_item->>'tamil_name',  '')), ''),
      COALESCE((v_item->>'quantity')::NUMERIC,     0),
      COALESCE(NULLIF(TRIM(v_item->>'unit'),       ''), 'piece'),
      COALESCE(NULLIF(TRIM(v_item->>'unit_type'),  ''), 'unit'),
      COALESCE((v_item->>'base_quantity')::NUMERIC, 1),
      COALESCE((v_item->>'base_price')::NUMERIC,   0),
      COALESCE((v_item->>'line_total')::NUMERIC,   0),
      NULLIF(TRIM(COALESCE(v_item->>'image_url', '')), '')
    );

    -- Decrement stock if product UUID is valid (graceful no-op if product gone)
    IF v_product_id IS NOT NULL THEN
      PERFORM public.retail_decrement_stock(
        v_product_id,
        COALESCE((v_item->>'quantity')::NUMERIC, 0),
        NULLIF(TRIM(COALESCE(v_item->>'unit', '')), '')
      );
    END IF;

  END LOOP;

  RETURN QUERY SELECT v_order_id, v_invoice_no;
END;
$$;

GRANT  EXECUTE ON FUNCTION public.create_order_with_stock(TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT) TO authenticated;
REVOKE ALL     ON FUNCTION public.create_order_with_stock(TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT) FROM anon;

-- ─────────────────────────────────────────────────────────────
-- STEP 7: Realtime
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- VERIFICATION — confirm product_id has no FK constraint
-- ─────────────────────────────────────────────────────────────
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name   = 'order_items';
-- Expected: only PRIMARY KEY on id, and order_id FK to orders.
-- product_id should NOT appear — confirming no FK constraint.
