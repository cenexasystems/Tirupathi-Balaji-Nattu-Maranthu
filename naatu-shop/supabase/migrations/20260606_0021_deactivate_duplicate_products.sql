-- ═══════════════════════════════════════════════════════════════════
-- Migration 0021: Deactivate duplicate simple products
--
-- These products were superseded when the variant architecture was
-- introduced. The variant versions are the authoritative records.
--
-- AUDIT RESULTS (run before applying):
--
--   Agarbatti:
--     KEEP  eaea37d7  has_variants=true  Cycle Brand/Z Black/Bindhu/Miracle
--     REMOVE 55f8bc3a  has_variants=false ₹30 (old simple product)
--
--   Vibhoothi:
--     KEEP  e5280b86  has_variants=true  Sithanathan/Baskaran
--     REMOVE 9e651e6a  has_variants=false ₹15 (old simple product)
--
-- This migration only sets is_active=false; no rows are deleted.
-- Safe to re-run (idempotent).
-- ═══════════════════════════════════════════════════════════════════

-- Preview: show what will be deactivated
SELECT id, name, has_variants, price, is_active
FROM public.products
WHERE id IN (
  '55f8bc3a-dbe1-41cd-b79c-367edd948b1b',
  '9e651e6a-f842-4b59-8758-b54421b154cd'
);

-- Apply
UPDATE public.products
SET    is_active = false
WHERE  id IN (
  '55f8bc3a-dbe1-41cd-b79c-367edd948b1b',  -- Agarbatti (simple, ₹30)
  '9e651e6a-f842-4b59-8758-b54421b154cd'   -- Vibhoothi (simple, ₹15)
);

-- Verify
SELECT id, name, has_variants, price, is_active
FROM public.products
WHERE LOWER(name) IN ('agarbatti', 'vibhoothi')
ORDER BY name, is_active DESC;
