-- ============================================================================
-- Migration 0014: Request / POS / Manual Sales Classification
--
-- Changes:
--   1. Add order_type + manual discount metadata to orders
--   2. Add manual-item metadata to order_items
--   3. Extend create_order_with_stock RPC to store request/POS/manual context
--   4. Keep existing checkout compatibility through unchanged RPC name
-- ============================================================================

-- Orders classification columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'pos_sale'
    CHECK (order_type IN ('online_request', 'pos_sale', 'manual_sale')),
  ADD COLUMN IF NOT EXISTS manual_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_discount_type TEXT NOT NULL DEFAULT 'flat'
    CHECK (manual_discount_type IN ('flat', 'percent')),
  ADD COLUMN IF NOT EXISTS manual_discount_value NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_manual_discount ON public.orders(manual_discount_amount);

-- Order items manual metadata
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE INDEX IF NOT EXISTS idx_order_items_is_manual ON public.order_items(is_manual) WHERE is_manual = true;

DROP FUNCTION IF EXISTS public.create_order_with_stock(TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_customer_name           TEXT,
  p_phone                   TEXT,
  p_address                 TEXT,
  p_items                   JSONB,
  p_shipping                NUMERIC DEFAULT 0,
  p_status                  TEXT    DEFAULT 'pending',
  p_order_mode              TEXT    DEFAULT 'online',
  p_order_type              TEXT    DEFAULT NULL,
  p_delivery_charge         NUMERIC DEFAULT 0,
  p_discount_amount         NUMERIC DEFAULT 0,
  p_manual_discount_amount  NUMERIC DEFAULT 0,
  p_manual_discount_type    TEXT    DEFAULT 'flat',
  p_manual_discount_value   NUMERIC DEFAULT 0,
  p_coupon_code             TEXT    DEFAULT NULL,
  p_coupon_percentage       NUMERIC DEFAULT 0
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
  v_has_manual_items BOOLEAN := false;
  v_order_type TEXT;
  v_manual_discount_type TEXT := COALESCE(NULLIF(TRIM(p_manual_discount_type), ''), 'flat');
  v_manual_discount_amount NUMERIC(10,2) := COALESCE(p_manual_discount_amount, 0);
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

    IF LOWER(COALESCE(v_item->>'source', '')) = 'manual'
       OR COALESCE((v_item->>'is_manual')::BOOLEAN, false)
       OR NULLIF(v_item->>'product_id', '') IS NULL THEN
      v_has_manual_items := true;
    END IF;
  END LOOP;

  v_order_type := COALESCE(
    NULLIF(TRIM(p_order_type), ''),
    CASE
      WHEN LOWER(COALESCE(p_status, 'pending')) = 'pending'
       AND LOWER(COALESCE(p_order_mode, 'online')) = 'online' THEN 'online_request'
      WHEN v_has_manual_items THEN 'manual_sale'
      ELSE 'pos_sale'
    END
  );

  -- total = subtotal - coupon discount - manual discount + delivery_charge + shipping
  v_total := v_subtotal
    - COALESCE(p_discount_amount, 0)
    - COALESCE(v_manual_discount_amount, 0)
    + COALESCE(p_delivery_charge, 0)
    + COALESCE(p_shipping, 0);
  IF v_total < 0 THEN v_total := 0; END IF;

  INSERT INTO public.orders (
    invoice_no, user_id, customer_name, phone, address,
    items, subtotal, shipping, total, status, order_mode, order_type,
    delivery_charge, discount_amount, manual_discount_amount, manual_discount_type,
    manual_discount_value, coupon_code, coupon_percentage
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
    v_order_type,
    COALESCE(p_delivery_charge, 0),
    COALESCE(p_discount_amount, 0),
    v_manual_discount_amount,
    v_manual_discount_type,
    COALESCE(p_manual_discount_value, 0),
    NULLIF(TRIM(COALESCE(p_coupon_code, '')), ''),
    COALESCE(p_coupon_percentage, 0)
  )
  RETURNING id INTO v_order_id;

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
      quantity, unit, unit_type, base_quantity, base_price, line_total, image_url,
      is_manual, note
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
      NULLIF(v_item->>'image_url', ''),
      LOWER(COALESCE(v_item->>'source', '')) = 'manual' OR COALESCE((v_item->>'is_manual')::BOOLEAN, false),
      NULLIF(v_item->>'note', '')
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

GRANT  EXECUTE ON FUNCTION public.create_order_with_stock(TEXT,TEXT,TEXT,JSONB,NUMERIC,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,NUMERIC,TEXT,NUMERIC) TO authenticated;
REVOKE ALL     ON FUNCTION public.create_order_with_stock(TEXT,TEXT,TEXT,JSONB,NUMERIC,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,NUMERIC,TEXT,NUMERIC) FROM anon;
*** End Patch