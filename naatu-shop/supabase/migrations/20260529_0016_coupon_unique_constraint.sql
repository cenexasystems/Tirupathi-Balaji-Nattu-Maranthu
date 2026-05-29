-- ═══════════════════════════════════════════════════════════════════
-- Migration 0016: Coupon Table — Definitive UNIQUE Constraint Fix
--
-- Root cause: Migration 0013 created a functional unique index on
-- UPPER(code). PostgreSQL's ON CONFLICT clause requires an exact
-- column-level UNIQUE CONSTRAINT, not an expression index.
-- This caused "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification" errors on every upsert attempt.
--
-- Safe to run even if migration 0015 was already applied.
-- Idempotent — all steps use IF EXISTS / IF NOT EXISTS guards.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- Step 1: Normalise all existing codes to UPPERCASE
-- Ensures the column value and constraint are always consistent.
-- ─────────────────────────────────────────────────────────────────
UPDATE public.coupons
  SET code = UPPER(TRIM(code))
  WHERE code IS NOT NULL
    AND code <> UPPER(TRIM(code));

-- ─────────────────────────────────────────────────────────────────
-- Step 2: Remove duplicate codes — keep the row with the lowest id
-- ─────────────────────────────────────────────────────────────────
DELETE FROM public.coupons
  WHERE id NOT IN (
    SELECT MIN(id)
    FROM public.coupons
    GROUP BY UPPER(TRIM(COALESCE(code, '')))
  );

-- ─────────────────────────────────────────────────────────────────
-- Step 3: Drop old functional index (migration 0013)
-- ─────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.coupons_code_upper_idx;

-- ─────────────────────────────────────────────────────────────────
-- Step 4: Drop constraint added by migration 0015 if it exists,
-- then recreate it cleanly. (Safe no-op if 0015 was never run.)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_code_unique;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_code_unique UNIQUE (code);

-- ─────────────────────────────────────────────────────────────────
-- Step 5: Verify result (will error if constraint is missing)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname    = 'coupons_code_unique'
       AND conrelid   = 'public.coupons'::regclass
       AND contype    = 'u'
  ) THEN
    RAISE EXCEPTION 'coupons_code_unique constraint was NOT created — check for errors above';
  END IF;
  RAISE NOTICE 'Migration 0016 complete: coupons.code UNIQUE constraint confirmed.';
END $$;
