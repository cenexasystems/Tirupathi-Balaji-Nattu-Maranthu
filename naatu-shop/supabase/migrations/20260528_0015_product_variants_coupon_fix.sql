-- ═══════════════════════════════════════════════════════════════════
-- Migration 0015: Product Variants Architecture + Coupon Fix
--
-- Changes:
--   1. Add has_variants column to products
--   2. Create product_variants table (brand / size / mixed variants)
--   3. Fix coupons table — add proper UNIQUE constraint on code
--   4. Seed example variant products (Agarbatti, Vibhoothi)
--   5. Realtime subscription for product_variants
--
-- Run in Supabase SQL Editor → New Query → Run All
-- Safe to run on a fresh DB or one with existing products/coupons.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- STEP 1: Add has_variants flag to products
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────
-- STEP 2: Create product_variants table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_variants (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   TEXT        NOT NULL,             -- references products.id (TEXT for UUID compat)
  variant_name TEXT        NOT NULL,             -- e.g. "Cycle Brand", "250ml", "1kg"
  sku          TEXT,                             -- optional stock keeping unit
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock        NUMERIC(12,3) NOT NULL DEFAULT 0,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast per-product variant lookups
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON public.product_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_active
  ON public.product_variants(product_id)
  WHERE is_active = true;

-- Updated_at auto-refresh trigger
DO $$ BEGIN
  CREATE TRIGGER set_product_variants_updated_at
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 3: RLS for product_variants
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pv_public_read   ON public.product_variants;
DROP POLICY IF EXISTS pv_admin_all     ON public.product_variants;

-- Public can read active variants (needed for storefront + POS)
CREATE POLICY pv_public_read ON public.product_variants
  FOR SELECT USING (is_active = true);

-- Admins have full CRUD
CREATE POLICY pv_admin_all ON public.product_variants
  FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────────
-- STEP 4: Fix coupon UNIQUE constraint
-- ─────────────────────────────────────────────────────────────────

-- 4a: Normalize all existing codes to UPPER CASE
UPDATE public.coupons
  SET code = UPPER(TRIM(code))
  WHERE code IS NOT NULL
    AND code != UPPER(TRIM(code));

-- 4b: Remove duplicate codes — keep the row with the smallest id
DELETE FROM public.coupons
  WHERE id NOT IN (
    SELECT MIN(id) FROM public.coupons GROUP BY UPPER(TRIM(COALESCE(code, '')))
  );

-- 4c: Drop the old functional index (replaced by proper column constraint)
DROP INDEX IF EXISTS public.coupons_code_upper_idx;

-- 4d: Add a proper UNIQUE constraint so ON CONFLICT (code) works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'coupons_code_unique'
       AND conrelid = 'public.coupons'::regclass
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_code_unique UNIQUE (code);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 5: Seed variant-based sample products
-- (only inserted if the named product doesn't already exist)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_agarbatti_id  TEXT;
  v_vibhoothi_id  TEXT;
BEGIN

  -- ── Agarbatti ───────────────────────────────────────────────────
  SELECT id::TEXT INTO v_agarbatti_id
    FROM public.products
   WHERE name = 'Agarbatti' AND has_variants = true
   LIMIT 1;

  IF v_agarbatti_id IS NULL THEN
    INSERT INTO public.products (
      name, name_ta, category,
      price, unit_type, unit_label, base_quantity,
      stock_quantity, stock_unit, is_active, sort_order,
      description, has_variants
    )
    VALUES (
      'Agarbatti', 'அகர்பத்தி', 'Pooja Items',
      55, 'unit', 'pack', 1,
      200, 'pack', true, 2,
      'Premium incense sticks. Choose from trusted brands.',
      true
    )
    RETURNING id::TEXT INTO v_agarbatti_id;

    INSERT INTO public.product_variants
      (product_id, variant_name, price, stock, sort_order)
    VALUES
      (v_agarbatti_id, 'Cycle Brand', 55,  50, 1),
      (v_agarbatti_id, 'Z Black',     60,  50, 2),
      (v_agarbatti_id, 'Bindhu',      70,  50, 3),
      (v_agarbatti_id, 'Miracle',    100,  50, 4);
  END IF;

  -- ── Vibhoothi ───────────────────────────────────────────────────
  SELECT id::TEXT INTO v_vibhoothi_id
    FROM public.products
   WHERE name = 'Vibhoothi' AND has_variants = true
   LIMIT 1;

  IF v_vibhoothi_id IS NULL THEN
    INSERT INTO public.products (
      name, name_ta, category,
      price, unit_type, unit_label, base_quantity,
      stock_quantity, stock_unit, is_active, sort_order,
      description, has_variants
    )
    VALUES (
      'Vibhoothi', 'திருநீறு', 'Pooja Items',
      30, 'unit', 'pack', 1,
      200, 'pack', true, 3,
      'Sacred ash (vibhoothi) from trusted sources.',
      true
    )
    RETURNING id::TEXT INTO v_vibhoothi_id;

    INSERT INTO public.product_variants
      (product_id, variant_name, price, stock, sort_order)
    VALUES
      (v_vibhoothi_id, 'Sithanathan', 30, 100, 1),
      (v_vibhoothi_id, 'Baskaran',    35, 100, 2);
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 6: Realtime for product_variants
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
EXCEPTION WHEN others THEN NULL;
END $$;
