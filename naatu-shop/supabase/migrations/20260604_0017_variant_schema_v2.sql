-- ═══════════════════════════════════════════════════════════════════
-- Migration 0017: Variant Architecture V2
--
-- 1. Extend product_variants with size/default/image fields
-- 2. Add variant tracking to order_items
-- 3. Seed real catalog products from official price list
--
-- Reversible: see ROLLBACK section at bottom
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- STEP 1: Extend product_variants table
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS size_label     TEXT,        -- display label: "25g", "250ml", "1 pack"
  ADD COLUMN IF NOT EXISTS weight_value   NUMERIC(10,3),  -- numeric weight/volume for filtering
  ADD COLUMN IF NOT EXISTS weight_unit    TEXT,        -- "g", "ml", "kg", "L"
  ADD COLUMN IF NOT EXISTS is_default     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_url      TEXT;        -- variant-specific image (optional)

-- Ensure exactly one default per product (AFTER trigger avoids same-command tuple conflict)
CREATE OR REPLACE FUNCTION public.ensure_one_default_variant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.product_variants
      SET is_default = false
     WHERE product_id = NEW.product_id
       AND id != NEW.id
       AND is_default = true;  -- only touch rows that are still true
  END IF;
  RETURN NULL;  -- AFTER triggers ignore return value
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_one_default_variant ON public.product_variants;
CREATE TRIGGER trg_one_default_variant
  AFTER INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.ensure_one_default_variant();

-- ─────────────────────────────────────────────────────────────────
-- STEP 2: Add variant tracking to order_items
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id   TEXT,          -- product_variants.id
  ADD COLUMN IF NOT EXISTS variant_name TEXT;          -- snapshot at order time

-- ─────────────────────────────────────────────────────────────────
-- STEP 3: Set first variant as default for existing variant products
-- ─────────────────────────────────────────────────────────────────
UPDATE public.product_variants pv
   SET is_default = true
  FROM (
    SELECT DISTINCT ON (product_id) id
      FROM public.product_variants
     WHERE is_active = true
     ORDER BY product_id, sort_order, created_at
  ) first_v
 WHERE pv.id = first_v.id
   AND pv.is_default = false;

-- ─────────────────────────────────────────────────────────────────
-- STEP 4: Seed official catalog variant products
-- Each product block is idempotent (skips if variants already exist)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_prod_id  TEXT;
  v_cat_id   BIGINT;
BEGIN

  -- ── Agarbatti (brand variants) ───────────────────────────────
  SELECT id::TEXT INTO v_prod_id
    FROM public.products WHERE name = 'Agarbatti' LIMIT 1;

  -- Clear old variants and re-seed with is_default + size_label
  IF v_prod_id IS NOT NULL THEN
    -- Update existing rows if they exist
    UPDATE public.product_variants
       SET size_label = '1 pack', is_default = (variant_name = 'Cycle Brand')
     WHERE product_id = v_prod_id;

    -- Insert any missing variants
    INSERT INTO public.product_variants (product_id, variant_name, size_label, price, stock, sort_order, is_default)
    SELECT v_prod_id, v.variant_name, v.size_label, v.price, v.stock, v.sort_order, v.is_def
    FROM (VALUES
      ('Cycle Brand', '1 pack',  55,  50, 1, true),
      ('Z Black',     '1 pack',  60,  50, 2, false),
      ('Bindhu',      '1 pack',  70,  50, 3, false),
      ('Miracle',     '1 pack', 100,  50, 4, false)
    ) AS v(variant_name, size_label, price, stock, sort_order, is_def)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_variants
       WHERE product_id = v_prod_id AND variant_name = v.variant_name
    );
  END IF;

  -- ── Karpooram (size variants) ────────────────────────────────
  SELECT id::TEXT INTO v_prod_id
    FROM public.products WHERE name = 'Karpooram' LIMIT 1;

  IF v_prod_id IS NOT NULL THEN
    -- Mark as variant product
    UPDATE public.products SET has_variants = true, price = 40 WHERE id::TEXT = v_prod_id;

    -- Remove any old predefined_options based entries and seed size variants
    DELETE FROM public.product_variants WHERE product_id = v_prod_id;
    INSERT INTO public.product_variants
      (product_id, variant_name, size_label, weight_value, weight_unit, price, stock, sort_order, is_default)
    VALUES
      (v_prod_id, '25g',  '25g',  25,   'g', 40,  150, 1, true),
      (v_prod_id, '50g',  '50g',  50,   'g', 70,  150, 2, false),
      (v_prod_id, '250g', '250g', 250,  'g', 350, 100, 3, false),
      (v_prod_id, '500g', '500g', 500,  'g', 650,  80, 4, false);
  END IF;

  -- ── Vibhoothi (brand + size combination) ─────────────────────
  -- Create "Vibhoothi Sithanathan" as a specific product if it doesn't exist
  SELECT id::TEXT INTO v_prod_id
    FROM public.products WHERE name = 'Vibhoothi Sithanathan' LIMIT 1;

  IF v_prod_id IS NULL THEN
    SELECT id INTO v_cat_id FROM public.categories WHERE name_en = 'Pooja Items' LIMIT 1;
    INSERT INTO public.products (
      name, name_ta, category, category_id,
      price, unit_type, unit_label, base_quantity,
      stock_quantity, stock, is_active, sort_order, has_variants,
      description
    ) VALUES (
      'Vibhoothi Sithanathan', 'விபூதி சித்தனாதன்', 'Pooja Items', v_cat_id,
      20, 'unit', 'pack', 1,
      500, 500, true, 2, true,
      'Sithanathan brand sacred ash (vibhoothi) in multiple sizes.'
    )
    RETURNING id::TEXT INTO v_prod_id;

    INSERT INTO public.product_variants
      (product_id, variant_name, size_label, weight_value, weight_unit, price, stock, sort_order, is_default)
    VALUES
      (v_prod_id, '50g',  '50g',  50,  'g', 20,  200, 1, true),
      (v_prod_id, '125g', '125g', 125, 'g', 35,  150, 2, false),
      (v_prod_id, '250g', '250g', 250, 'g', 70,  100, 3, false),
      (v_prod_id, '500g', '500g', 500, 'g', 95,   80, 4, false);
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 5: Realtime for new columns (already subscribed, no change needed)
-- ─────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────
SELECT
  p.name AS product,
  COUNT(pv.id) AS variant_count,
  MIN(pv.price) AS from_price,
  MAX(pv.price) AS to_price
FROM public.products p
JOIN public.product_variants pv ON pv.product_id = p.id::TEXT
WHERE pv.is_active = true
GROUP BY p.name
ORDER BY p.name;

-- ─────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually if needed)
-- ─────────────────────────────────────────────────────────────────
-- ALTER TABLE public.product_variants
--   DROP COLUMN IF EXISTS size_label,
--   DROP COLUMN IF EXISTS weight_value,
--   DROP COLUMN IF EXISTS weight_unit,
--   DROP COLUMN IF EXISTS is_default,
--   DROP COLUMN IF EXISTS image_url;
-- ALTER TABLE public.order_items
--   DROP COLUMN IF EXISTS variant_id,
--   DROP COLUMN IF EXISTS variant_name;
-- DROP TRIGGER IF EXISTS trg_one_default_variant ON public.product_variants;
-- DROP FUNCTION IF EXISTS public.ensure_one_default_variant();
