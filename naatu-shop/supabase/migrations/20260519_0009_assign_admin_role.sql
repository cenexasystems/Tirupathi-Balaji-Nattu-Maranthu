-- ═══════════════════════════════════════════════════════════════════
-- Migration 0009 — Admin role assignment
--
-- HOW TO ASSIGN ADMIN:
--   Replace 'your-email@gmail.com' below with the email that should
--   become admin, then run the whole script in Supabase SQL Editor.
--
-- You can run this as many times as needed (idempotent).
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- PART 1: Update profiles table for the target email
-- ─────────────────────────────────────────────────────────────────
UPDATE public.profiles
SET    role = 'admin'
WHERE  email = 'eshwarbalaji07@gmail.com';   -- ← CHANGE THIS EMAIL

-- ─────────────────────────────────────────────────────────────────
-- PART 2: Update handle_new_user trigger so future logins with
-- this email automatically get admin role (adds to the CASE list)
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
  -- ▼ ADD YOUR ADMIN EMAILS HERE (comma-separated strings)
  v_role   TEXT := CASE
    WHEN v_email IN (
      'admin@srisiddha.com',
      'eshwarbalaji07@gmail.com'
    ) THEN 'admin'
    ELSE 'customer'
  END;
BEGIN
  INSERT INTO public.profiles (id, email, name, mobile, role, created_at)
  VALUES (NEW.id, v_email, v_name, v_mobile, v_role, NOW())
  ON CONFLICT (id) DO UPDATE SET
    email  = CASE WHEN profiles.email  = '' OR profiles.email  IS NULL THEN EXCLUDED.email  ELSE profiles.email  END,
    name   = CASE WHEN profiles.name   = '' OR profiles.name   IS NULL THEN EXCLUDED.name   ELSE profiles.name   END,
    mobile = CASE WHEN profiles.mobile = '' OR profiles.mobile IS NULL THEN EXCLUDED.mobile ELSE profiles.mobile END;
    -- Note: role is NOT updated on conflict — so existing users keep their role.
    -- To change role, use the UPDATE statement in PART 1 above.
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
-- PART 3: Grant admin to all emails listed in VITE_ADMIN_EMAIL
-- (handled in app code via ADMIN_EMAILS_LOCAL — no extra SQL needed)
-- ─────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────
-- VERIFICATION — run after applying:
-- SELECT id, email, role FROM public.profiles WHERE role = 'admin';
-- ─────────────────────────────────────────────────────────────────
