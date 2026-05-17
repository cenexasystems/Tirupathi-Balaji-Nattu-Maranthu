-- ═══════════════════════════════════════════════════════════════════
-- Migration 0007 — Store Reviews table + Profile auto-creation trigger
-- + is_admin() function fix
--
-- Run in Supabase SQL Editor → New Query → Run All
-- Safe to re-run (idempotent throughout).
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- PART 1: fix is_admin() to also check profiles.role
-- The old version only checked app_metadata (set by admin SDK),
-- which is never populated for regular OAuth/OTP sign-ins.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    FALSE
  )
  OR COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin',
    FALSE
  );
$$;

-- ─────────────────────────────────────────────────────────────────
-- PART 2: Profile auto-creation trigger
-- Fires on INSERT into auth.users (Google OAuth, magic-link, phone OTP).
-- Uses ON CONFLICT DO UPDATE so it is safe to re-run / re-trigger.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := COALESCE(NEW.email, '');
  v_name  TEXT := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    CASE WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) ELSE 'Customer' END
  );
  v_role  TEXT := CASE
    WHEN v_email IN ('admin@srisiddha.com', 'eshwarbalaji07@gmail.com') THEN 'admin'
    ELSE 'customer'
  END;
BEGIN
  INSERT INTO public.profiles (id, email, name, role, created_at)
  VALUES (NEW.id, v_email, v_name, v_role, NOW())
  ON CONFLICT (id) DO UPDATE SET
    -- Only overwrite empty fields — never clobber user-set data
    email = CASE WHEN profiles.email = '' OR profiles.email IS NULL
                 THEN EXCLUDED.email ELSE profiles.email END,
    name  = CASE WHEN profiles.name  = '' OR profiles.name  IS NULL
                 THEN EXCLUDED.name  ELSE profiles.name  END;
  RETURN NEW;
END;
$$;

-- Drop old trigger first (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Back-fill profiles for any existing auth users that don't have a row yet
INSERT INTO public.profiles (id, email, name, role, created_at)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    CASE WHEN u.email IS NOT NULL THEN split_part(u.email, '@', 1) ELSE 'Customer' END
  ),
  CASE
    WHEN u.email IN ('admin@srisiddha.com', 'eshwarbalaji07@gmail.com') THEN 'admin'
    ELSE 'customer'
  END,
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- PART 3: store_reviews table
-- General store-level testimonials submitted from the homepage.
-- Guest reviews are allowed (user_id nullable).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_reviews (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT         NOT NULL CHECK (char_length(name) >= 2),
  location    TEXT         NOT NULL DEFAULT 'Tamil Nadu',
  rating      SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT         NOT NULL CHECK (char_length(review_text) >= 10),
  is_approved BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_reviews_created    ON public.store_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_reviews_approved   ON public.store_reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_store_reviews_user_id    ON public.store_reviews(user_id);

-- ─────────────────────────────────────────────────────────────────
-- PART 4: RLS for store_reviews
-- Public read (approved only), public insert, admin manages all.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_public_read   ON public.store_reviews;
DROP POLICY IF EXISTS reviews_anon_insert   ON public.store_reviews;
DROP POLICY IF EXISTS reviews_auth_insert   ON public.store_reviews;
DROP POLICY IF EXISTS reviews_admin_all     ON public.store_reviews;

-- Anyone (logged in or not) can read approved reviews
CREATE POLICY reviews_public_read ON public.store_reviews
  FOR SELECT TO anon, authenticated
  USING (is_approved = true);

-- Unauthenticated guests can insert (user_id must be NULL)
CREATE POLICY reviews_anon_insert ON public.store_reviews
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- Authenticated users can insert (user_id must match their own id or be NULL)
CREATE POLICY reviews_auth_insert ON public.store_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Admin can do everything (read all including unapproved, approve, delete)
CREATE POLICY reviews_admin_all ON public.store_reviews
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────────
-- PART 5: Enable Realtime for store_reviews
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.store_reviews;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (run separately to confirm)
-- ─────────────────────────────────────────────────────────────────
-- SELECT * FROM public.store_reviews LIMIT 5;
-- SELECT id, email, name, role FROM public.profiles LIMIT 10;
-- SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'users';
