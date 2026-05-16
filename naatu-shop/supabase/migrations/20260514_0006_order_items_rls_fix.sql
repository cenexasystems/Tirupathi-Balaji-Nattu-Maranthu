-- Migration 0006: Fix order_items RLS + orders insert policy for authenticated users
-- The create_order_with_stock RPC is SECURITY DEFINER (bypasses RLS) so order creation
-- is already safe. This migration adds the missing INSERT policy so authenticated users
-- can also directly insert order_items if ever needed, and adds a phone/email search
-- index on orders for admin lookup performance.
-- Safe to re-run (DROP IF EXISTS guards).

-- ─────────────────────────────────────────────────────────────
-- 1. order_items: add INSERT policy for authenticated users
--    (allows the DEFINER RPC to insert without bypassing RLS warnings)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS order_items_user_insert ON public.order_items;
CREATE POLICY order_items_user_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = auth.uid() OR public.is_admin())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. orders: ensure anon INSERT policy exists for guest checkout
--    (already in 0001 but idempotent here)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS orders_anon_insert ON public.orders;
CREATE POLICY orders_anon_insert ON public.orders
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- ─────────────────────────────────────────────────────────────
-- 3. orders: ensure authenticated users can INSERT their own orders
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS orders_user_insert ON public.orders;
CREATE POLICY orders_user_insert ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 4. Orders admin search — add phone/email index for fast lookup
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_phone_lookup
  ON public.orders (phone);

CREATE INDEX IF NOT EXISTS idx_orders_customer_name
  ON public.orders USING gin(to_tsvector('simple', customer_name));

-- ─────────────────────────────────────────────────────────────
-- 5. Profiles: add email index for admin search by email/mobile
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON public.profiles (email);

CREATE INDEX IF NOT EXISTS idx_profiles_mobile
  ON public.profiles (mobile);

-- ─────────────────────────────────────────────────────────────
-- 6. Enable realtime on key tables
-- ─────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
