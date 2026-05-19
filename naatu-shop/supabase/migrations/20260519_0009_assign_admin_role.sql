-- ═══════════════════════════════════════════════════════════════════
-- Migration 0009 — Admin role assignment (multi-email, idempotent)
--
-- HOW TO GRANT ADMIN TO ONE OR MORE EMAILS:
--   Edit the list in PART 1 and PART 2 below, then run in
--   Supabase SQL Editor → New Query → Run All.
--
-- After running, the user must log out and log back in for the
-- role change to take effect in the app.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- PART 1: Grant admin to all emails in the list (add as many as
-- you need — just add more rows to the IN(...) list)
-- ─────────────────────────────────────────────────────────────────
UPDATE public.profiles
SET    role = 'admin'
WHERE  email IN (
  'eshwarbalaji07@gmail.com'
  -- Add more emails below (one per line, comma-separated):
  -- ,'another@gmail.com'
  -- ,'staff@yourstore.com'
);

-- ─────────────────────────────────────────────────────────────────
-- PART 2: Demote anyone who should no longer be admin
-- (comment this out if you don't want to demote anyone)
-- ─────────────────────────────────────────────────────────────────
-- UPDATE public.profiles
-- SET    role = 'customer'
-- WHERE  email = 'someone@gmail.com';

-- ─────────────────────────────────────────────────────────────────
-- PART 3: Update handle_new_user trigger — new sign-ups with these
-- emails automatically get admin role from the very first login
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
  -- ▼ ADD ADMIN EMAILS HERE (one per line inside the parentheses)
  v_role   TEXT := CASE
    WHEN v_email IN (
      'admin@srisiddha.com',
      'eshwarbalaji07@gmail.com'
      -- ,'another@gmail.com'
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
-- VERIFICATION
-- SELECT id, email, name, role FROM public.profiles WHERE role = 'admin';
-- ─────────────────────────────────────────────────────────────────
