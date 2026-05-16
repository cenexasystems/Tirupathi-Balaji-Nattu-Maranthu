-- ═══════════════════════════════════════════════════════════════════
-- FIX: Admin role assignment
-- Root cause: handle_new_user trigger only grants 'admin' to
-- admin@srisiddha.com. If the store owner signed up with a different
-- email, their profile has role='customer' and dashboard redirects to home.
--
-- HOW TO USE:
--   1. Replace 'YOUR_ADMIN_EMAIL@example.com' below with your actual email
--   2. Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── IMPORTANT: Replace the email below with your actual login email ──
DO $$
DECLARE
  v_email TEXT := 'YOUR_ADMIN_EMAIL@example.com';  -- ← CHANGE THIS
  v_uid   UUID;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'No user found with email: %', v_email;
    RETURN;
  END IF;

  -- Update profile role
  UPDATE public.profiles
  SET role = 'admin', updated_at = NOW()
  WHERE id = v_uid;

  -- Update JWT app_metadata so role appears in token immediately
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}') ||
    jsonb_build_object('role', 'admin')
  WHERE id = v_uid;

  RAISE NOTICE 'Admin role granted to: %', v_email;
END;
$$;

-- ── Also update the trigger to include the real admin email ──
-- (so future signups/re-signups also get admin role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_code TEXT;
  v_seq  BIGINT;
BEGIN
  -- Grant admin role to known admin emails (add yours here)
  v_role := CASE
    WHEN NEW.email IN (
      'admin@srisiddha.com',
      'eshwarbalaji07@gmail.com'   -- store owner email
    ) THEN 'admin'
    WHEN COALESCE(NEW.raw_user_meta_data->>'role', '') = 'admin' THEN 'admin'
    ELSE 'customer'
  END;

  SELECT nextval('public.customer_code_seq') INTO v_seq;
  v_code := 'CUST-' || LPAD(v_seq::TEXT, 5, '0');

  INSERT INTO public.profiles (id, customer_code, name, mobile, email, role)
  VALUES (
    NEW.id,
    v_code,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      SPLIT_PART(COALESCE(NEW.email, ''), '@', 1),
      'Customer'
    ),
    COALESCE(NEW.raw_user_meta_data->>'mobile', ''),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email      = EXCLUDED.email,
      name       = COALESCE(NULLIF(public.profiles.name, ''), EXCLUDED.name),
      updated_at = NOW();

  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}') || jsonb_build_object('role', v_role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Verification
SELECT id, email, role FROM public.profiles ORDER BY created_at LIMIT 20;
