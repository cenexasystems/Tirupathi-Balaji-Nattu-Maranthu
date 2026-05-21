-- Migration 0011: Supabase-managed admin roles
-- Run in Supabase SQL Editor.
--
-- After this migration, to make any user an admin:
--   1. Go to Supabase → Table Editor → profiles
--   2. Find the user row, change `role` to 'admin' and Save
--   3. The trigger below automatically syncs auth.users so RLS policies
--      pick up the new role on the user's next login.
--
-- To revoke admin: set `role` back to 'customer' — same trigger fires.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Trigger: sync auth.users.raw_app_meta_data when profiles.role changes
--    This keeps the is_admin() JWT check consistent with the profiles table.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_role_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    UPDATE auth.users
    SET raw_app_meta_data =
          COALESCE(raw_app_meta_data, '{}'::jsonb) ||
          jsonb_build_object('role', NEW.role)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_role_to_auth ON public.profiles;
CREATE TRIGGER trg_sync_role_to_auth
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_to_auth();

-- ─────────────────────────────────────────────────────────────────────
-- 2. Update is_admin() to check profiles table directly as well.
--    Dual check: JWT app_metadata (fast, cached) OR profiles.role (authoritative).
--    This means even before the user re-logs-in, RLS kicks in immediately.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin';
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Assign admin role to any existing users with known admin emails.
--    Edit the email list here any time you add a new admin at setup.
--    After this one-time seed, use the Table Editor for all future changes.
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.profiles
SET role = 'admin'
WHERE email IN (
  'admin@srisiddha.com',
  'eshwarbalaji07@gmail.com',
  'myteamcreations09@gmail.com'
)
AND role != 'admin';

-- Sync app_metadata for those rows immediately (trigger only fires on future updates)
UPDATE auth.users
SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role', 'admin')
WHERE email IN (
  'admin@srisiddha.com',
  'eshwarbalaji07@gmail.com',
  'myteamcreations09@gmail.com'
);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Verify — shows all current admins
-- ─────────────────────────────────────────────────────────────────────
SELECT p.email, p.name, p.role,
       au.raw_app_meta_data ->> 'role' AS jwt_role
FROM   public.profiles p
JOIN   auth.users au ON au.id = p.id
WHERE  p.role = 'admin'
ORDER  BY p.email;
