-- ═══════════════════════════════════════════════════════════════════
-- Migration 0018: Variant Order Tracking
--
-- 1. Update create_order_with_stock RPC to:
--    a) Write variant_id + variant_name to order_items
--    b) Decrement product_variants.stock (not products.stock) for variant items
-- 2. Drop old function signature first to avoid conflicts
--
-- Reversible: see ROLLBACK at bottom
-- ═══════════════════════════════════════════════════════════════════

-- Drop old 15-param signature
DROP FUNCTION IF EXISTS public.create_order_with_stock(
  TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, TEXT, NUMERIC
);

-- ─────────────────────────────────────────────────────────────────
-- Updated function: same params, smarter order_items insert
-- ─────────────────────────────────────────────────────────────────
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
  v_requester              UUID   := auth.uid();
  v_invoice_no             TEXT;
  v_order_id               UUID;
  v_subtotal               NUMERIC(10,2) := 0;
  v_total                  NUMERIC(10,2);
  v_item                   JSONB;
  v_product_id             UUID;
  v_variant_id             UUID;
  v_has_manual_items       BOOLEAN := false;
  v_order_type             TEXT;
  v_manual_discount_type   TEXT    := COALESCE(NULLIF(TRIM(p_manual_discount_type), ''), 'flat');
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

  -- ── Pass 1: accumulate subtotal + detect manual items ────────
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

  -- total = subtotal − discounts + delivery
  v_total := v_subtotal
    - COALESCE(p_discount_amount, 0)
    - v_manual_discount_amount
    + COALESCE(p_delivery_charge, 0)
    + COALESCE(p_shipping, 0);
  IF v_total < 0 THEN v_total := 0; END IF;

  -- ── Insert order ──────────────────────────────────────────────
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

  -- Update coupon usage count
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    UPDATE public.coupons
       SET usage_count = usage_count + 1
     WHERE UPPER(TRIM(code)) = UPPER(TRIM(p_coupon_code));
  END IF;

  -- ── Pass 2: insert order_items + decrement stock ─────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP

    -- Safely parse product_id UUID
    BEGIN
      v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      v_product_id := NULL;
    END;

    -- Safely parse variant_id UUID
    BEGIN
      v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      v_variant_id := NULL;
    END;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      variant_name,
      product_tamil_name,
      quantity,
      unit,
      unit_type,
      base_quantity,
      base_price,
      line_total,
      image_url,
      is_manual,
      note
    ) VALUES (
      v_order_id,
      v_product_id,
      v_variant_id,
      COALESCE(NULLIF(v_item->>'name', ''), 'Product'),
      NULLIF(v_item->>'variant_name', ''),
      NULLIF(v_item->>'tamil_name', ''),
      COALESCE((v_item->>'quantity')::NUMERIC, 0),
      COALESCE(NULLIF(v_item->>'unit', ''), 'piece'),
      COALESCE(NULLIF(v_item->>'unit_type', ''), 'unit'),
      COALESCE((v_item->>'base_quantity')::NUMERIC, 1),
      COALESCE((v_item->>'base_price')::NUMERIC, 0),
      COALESCE((v_item->>'line_total')::NUMERIC, 0),
      NULLIF(v_item->>'image_url', ''),
      LOWER(COALESCE(v_item->>'source', '')) = 'manual'
        OR COALESCE((v_item->>'is_manual')::BOOLEAN, false),
      NULLIF(v_item->>'note', '')
    );

    -- ── Stock decrement ───────────────────────────────────────
    IF v_variant_id IS NOT NULL THEN
      -- Variant-level: decrement product_variants.stock
      UPDATE public.product_variants
         SET stock = GREATEST(0, stock - COALESCE((v_item->>'quantity')::NUMERIC, 0))
       WHERE id = v_variant_id
         AND is_active = true;
    ELSIF v_product_id IS NOT NULL THEN
      -- Product-level fallback (non-variant products)
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

-- ─────────────────────────────────────────────────────────────────
-- ROLLBACK:
-- Restore the previous version from migration 0014 if needed.
-- The function signature is identical so a rollback is simply
-- re-running migration 0014's CREATE OR REPLACE block.
-- ─────────────────────────────────────────────────────────────────
