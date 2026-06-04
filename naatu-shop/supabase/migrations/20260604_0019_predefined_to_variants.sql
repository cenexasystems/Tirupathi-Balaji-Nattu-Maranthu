-- ═══════════════════════════════════════════════════════════════════
-- Migration 0019: Convert predefined_options → product_variants
--
-- For every product that has a non-empty predefined_options JSONB array
-- AND does not yet have product_variants rows, create variant rows using
-- proportional pricing from the product's base price.
--
-- NOTE: Prices are calculated proportionally from base_price / base_quantity.
-- Update actual prices from the Admin → Products → Variant Management panel
-- once the official price list is available.
--
-- Reversible: see ROLLBACK at bottom
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r           RECORD;
  opt         JSONB;
  v_qty       NUMERIC;
  v_unit      TEXT;
  v_label     TEXT;
  v_price     NUMERIC;
  v_sort      INTEGER;
  v_is_first  BOOLEAN;
BEGIN
  FOR r IN
    SELECT
      id::TEXT                              AS prod_id,
      name,
      price                                 AS base_price,
      base_quantity,
      unit_type,
      unit_label,
      predefined_options
    FROM public.products
    WHERE
      -- has a real options array
      jsonb_typeof(predefined_options) = 'array'
      AND jsonb_array_length(predefined_options) > 0
      -- not already converted
      AND NOT EXISTS (
        SELECT 1 FROM public.product_variants pv
         WHERE pv.product_id = products.id::TEXT
           AND pv.is_active  = true
      )
      -- only weight / volume products (unit products handled separately)
      AND unit_type IN ('weight', 'volume')
  LOOP
    v_sort     := 1;
    v_is_first := true;

    FOR opt IN SELECT * FROM jsonb_array_elements(r.predefined_options) LOOP
      v_qty   := COALESCE((opt->>'quantity')::NUMERIC, 0);
      v_unit  := COALESCE(opt->>'unit',  r.unit_label);
      v_label := COALESCE(NULLIF(opt->>'label', ''), v_qty::TEXT || v_unit);

      -- Proportional price: if base is ₹120/100g then 250g = 250/100 × 120 = ₹300
      v_price := CASE
        WHEN r.base_quantity > 0
          THEN ROUND(v_qty / r.base_quantity * r.base_price)
        ELSE r.base_price
      END;

      INSERT INTO public.product_variants (
        product_id,
        variant_name,
        size_label,
        weight_value,
        weight_unit,
        price,
        stock,
        sort_order,
        is_default,
        is_active
      ) VALUES (
        r.prod_id,
        v_label,          -- e.g. "100g", "250ml"
        v_label,          -- same for size_label
        v_qty,
        v_unit,
        v_price,
        100,              -- default starting stock — update per actual inventory
        v_sort,
        v_is_first,       -- cheapest / smallest = default
        true
      );

      v_sort     := v_sort + 1;
      v_is_first := false;
    END LOOP;

    -- Mark product as variant-based
    UPDATE public.products
       SET has_variants = true
     WHERE id::TEXT = r.prod_id;

  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Handle unit-type Pooja products that need brand variants
-- (Karpooram, Vibhoothi, Agarbatti already handled in migration 0017)
-- Add any additional pooja items that should have variants here.
-- ─────────────────────────────────────────────────────────────────

-- Mark bundle products explicitly as single-variant (one option: the bundle itself)
-- Bundles don't need product_variants — they're sold as-is.

-- ─────────────────────────────────────────────────────────────────
-- Verify: show conversion results
-- ─────────────────────────────────────────────────────────────────
SELECT
  p.name,
  p.unit_type,
  p.has_variants,
  COUNT(pv.id)      AS variant_count,
  MIN(pv.price)     AS from_price,
  MAX(pv.price)     AS to_price
FROM public.products p
LEFT JOIN public.product_variants pv ON pv.product_id = p.id::TEXT AND pv.is_active = true
WHERE p.is_active = true
GROUP BY p.name, p.unit_type, p.has_variants
ORDER BY p.unit_type, p.name;

-- ─────────────────────────────────────────────────────────────────
-- ROLLBACK:
-- DELETE FROM public.product_variants
--   WHERE product_id IN (
--     SELECT id::TEXT FROM public.products WHERE unit_type IN ('weight','volume')
--   );
-- UPDATE public.products SET has_variants = false WHERE unit_type IN ('weight','volume');
-- ─────────────────────────────────────────────────────────────────
