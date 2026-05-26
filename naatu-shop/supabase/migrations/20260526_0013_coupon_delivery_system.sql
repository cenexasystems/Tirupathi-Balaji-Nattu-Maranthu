-- ═══════════════════════════════════════════════════════════════════
-- Migration 0013: Coupon System + Delivery Charge + Order ID rename
--
-- Changes:
--   1. Add delivery_charge, discount_amount, coupon_code, coupon_percentage to orders
--   2. Create coupons table with full management schema
--   3. Update create_order_with_stock RPC to accept new params
--   4. RLS + realtime for coupons
--
-- Run in Supabase SQL Editor → New Query → Run All
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Add new columns to orders table
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_charge  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code      TEXT,
  ADD COLUMN IF NOT EXISTS coupon_percentage NUMERIC(5,2)  NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Create coupons table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupons (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT NOT NULL,
  percentage      NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  expiry_date     DATE,
  usage_limit     INTEGER,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  min_order_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_idx ON public.coupons (UPPER(code));

-- ─────────────────────────────────────────────────────────────
-- STEP 3: RLS for coupons
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupons_admin_all   ON public.coupons;
DROP POLICY IF EXISTS coupons_auth_read   ON public.coupons;

-- Admins can do anything
CREATE POLICY coupons_admin_all ON public.coupons
  FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Authenticated users can read active coupons (to validate at checkout)
CREATE POLICY coupons_auth_read ON public.coupons
  FOR SELECT TO authenticated
  USING (is_active = true);

-- ─────────────────────────────────────────────────────────────
-- STEP 4: Update create_order_with_stock RPC
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_order_with_stock(TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_customer_name     TEXT,
  p_phone             TEXT,
  p_address           TEXT,
  p_items             JSONB,
  p_shipping          NUMERIC  DEFAULT 0,
  p_status            TEXT     DEFAULT 'pending',
  p_order_mode        TEXT     DEFAULT 'online',
  p_delivery_charge   NUMERIC  DEFAULT 0,
  p_discount_amount   NUMERIC  DEFAULT 0,
  p_coupon_code       TEXT     DEFAULT NULL,
  p_coupon_percentage NUMERIC  DEFAULT 0
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
  v_product_id UUID;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) = 0
  THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  v_invoice_no := public.get_next_invoice_no();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + COALESCE((v_item->>'line_total')::NUMERIC, 0);
  END LOOP;

  -- total = subtotal - discount + delivery_charge + shipping
  v_total := v_subtotal
    - COALESCE(p_discount_amount, 0)
    + COALESCE(p_delivery_charge, 0)
    + COALESCE(p_shipping, 0);
  IF v_total < 0 THEN v_total := 0; END IF;

  INSERT INTO public.orders (
    invoice_no, user_id, customer_name, phone, address,
    items, subtotal, shipping, total, status, order_mode,
    delivery_charge, discount_amount, coupon_code, coupon_percentage
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
    COALESCE(NULLIF(TRIM(p_status), ''), 'pending'),
    COALESCE(NULLIF(TRIM(p_order_mode), ''), 'online'),
    COALESCE(p_delivery_charge, 0),
    COALESCE(p_discount_amount, 0),
    NULLIF(TRIM(COALESCE(p_coupon_code, '')), ''),
    COALESCE(p_coupon_percentage, 0)
  )
  RETURNING id INTO v_order_id;

  -- Increment coupon usage
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    UPDATE public.coupons
       SET usage_count = usage_count + 1
     WHERE UPPER(TRIM(code)) = UPPER(TRIM(p_coupon_code));
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      v_product_id := NULL;
    END;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_tamil_name,
      quantity, unit, unit_type, base_quantity, base_price, line_total, image_url
    ) VALUES (
      v_order_id,
      v_product_id,
      COALESCE(NULLIF(v_item->>'name', ''), 'Product'),
      NULLIF(v_item->>'tamil_name', ''),
      COALESCE((v_item->>'quantity')::NUMERIC, 0),
      COALESCE(NULLIF(v_item->>'unit', ''), 'piece'),
      COALESCE(NULLIF(v_item->>'unit_type', ''), 'unit'),
      COALESCE((v_item->>'base_quantity')::NUMERIC, 1),
      COALESCE((v_item->>'base_price')::NUMERIC, 0),
      COALESCE((v_item->>'line_total')::NUMERIC, 0),
      NULLIF(v_item->>'image_url', '')
    );

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

GRANT  EXECUTE ON FUNCTION public.create_order_with_stock(TEXT,TEXT,TEXT,JSONB,NUMERIC,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,NUMERIC) TO authenticated;
REVOKE ALL     ON FUNCTION public.create_order_with_stock(TEXT,TEXT,TEXT,JSONB,NUMERIC,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,NUMERIC) FROM anon;

-- ─────────────────────────────────────────────────────────────
-- STEP 5: Indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON public.orders(coupon_code) WHERE coupon_code IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 6: Realtime for coupons
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 7: Seed sample coupons (optional, can delete)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.coupons (code, percentage, is_active, min_order_value)
VALUES
  ('FEST10',   10, true, 200),
  ('TEMPLE15', 15, true, 500)
ON CONFLICT DO NOTHING;
