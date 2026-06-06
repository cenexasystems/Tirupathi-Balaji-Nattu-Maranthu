-- 20260606_catalog_cleanup.sql
-- Deactivate legacy standalone products that were superseded by variant-driven versions.
-- Keep: has_variants = true (the correct variant-driven rows)
-- Remove: has_variants = false legacy duplicates

UPDATE products
SET is_active = false
WHERE id IN (
  '55f8bc3a-dbe1-41cd-b79c-367edd948b1b',  -- Agarbatti ₹30 (legacy, no variants)
  '9e651e6a-f842-4b59-8758-b54421b154cd'   -- Vibhoothi ₹15 (legacy, no variants)
);
