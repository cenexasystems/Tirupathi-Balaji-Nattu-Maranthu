-- ═══════════════════════════════════════════════════════════════════
-- Migration 0008 — Profile mobile field + trigger fix
--
-- Problem: Migration 0007 replaced handle_new_user() but the new
-- version omitted the mobile/phone field. This migration corrects
-- that and back-fills mobile from existing user metadata.
--
-- Run in Supabase SQL Editor → New Query → Run All (idempotent).
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- PART 1: Ensure profiles.mobile column exists
-- (already added by COMPLETE_SETUP.sql, but guarded here)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mobile TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON public.profiles(mobile)
  WHERE mobile IS NOT NULL AND mobile <> '';

-- ─────────────────────────────────────────────────────────────────
-- PART 2: Replace handle_new_user() — now includes mobile
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  TEXT := COALESCE(NEW.email, '');
  v_name   TEXT := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    CASE WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) ELSE 'Customer' END
  );
  v_mobile TEXT := COALESCE(
    NEW.raw_user_meta_data->>'mobile',
    NEW.raw_user_meta_data->>'phone',
    ''
  );
  v_role   TEXT := CASE
    WHEN v_email IN ('admin@srisiddha.com', 'eshwarbalaji07@gmail.com') THEN 'admin'
    ELSE 'customer'
  END;
BEGIN
  INSERT INTO public.profiles (id, email, name, mobile, role, created_at)
  VALUES (NEW.id, v_email, v_name, v_mobile, v_role, NOW())
  ON CONFLICT (id) DO UPDATE SET
    email  = CASE WHEN profiles.email  = '' OR profiles.email  IS NULL THEN EXCLUDED.email  ELSE profiles.email  END,
    name   = CASE WHEN profiles.name   = '' OR profiles.name   IS NULL THEN EXCLUDED.name   ELSE profiles.name   END,
    mobile = CASE WHEN profiles.mobile = '' OR profiles.mobile IS NULL THEN EXCLUDED.mobile ELSE profiles.mobile END;
  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- PART 3: Back-fill mobile from raw_user_meta_data for existing users
-- Only updates rows where mobile is currently empty
-- ─────────────────────────────────────────────────────────────────
UPDATE public.profiles p
SET    mobile = COALESCE(
         u.raw_user_meta_data->>'mobile',
         u.raw_user_meta_data->>'phone',
         ''
       )
FROM   auth.users u
WHERE  p.id = u.id
  AND (p.mobile IS NULL OR p.mobile = '')
  AND (
    u.raw_user_meta_data->>'mobile' IS NOT NULL
    OR u.raw_user_meta_data->>'phone'  IS NOT NULL
  );

-- Back-fill name where it is empty
UPDATE public.profiles p
SET    name = COALESCE(
         u.raw_user_meta_data->>'full_name',
         u.raw_user_meta_data->>'name',
         CASE WHEN u.email IS NOT NULL THEN split_part(u.email, '@', 1) ELSE 'Customer' END
       )
FROM   auth.users u
WHERE  p.id = u.id
  AND (p.name IS NULL OR p.name = '');

-- ─────────────────────────────────────────────────────────────────
-- VERIFICATION
-- SELECT id, email, name, mobile, role FROM public.profiles LIMIT 10;
-- ─────────────────────────────────────────────────────────────────
