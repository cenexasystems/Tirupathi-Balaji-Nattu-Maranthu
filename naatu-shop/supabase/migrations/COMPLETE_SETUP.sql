-- ═══════════════════════════════════════════════════════════════════
-- THIRUPATHI BALAJI HERBAL STORE — COMPLETE SUPABASE SETUP
-- Run this ONE FILE in Supabase SQL Editor → New Query → Run
-- ✅ Safe to re-run on any existing database (fully idempotent)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- PART 1: EXTENSIONS
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- PART 2: HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ─────────────────────────────────────────────────────────────
-- PART 3: SCHEMA PATCHES (idempotent column additions)
-- ─────────────────────────────────────────────────────────────

-- profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS customer_code TEXT,
  ADD COLUMN IF NOT EXISTS name          TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS mobile        TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS role          TEXT         DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ  DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_customer_code_unique ON public.profiles(customer_code);
CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq START WITH 1;

-- categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ      DEFAULT NOW();

-- health_tags
ALTER TABLE public.health_tags
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ      DEFAULT NOW();

-- products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id           BIGINT       REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_type             TEXT         DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS unit_label            TEXT         DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS base_quantity         NUMERIC(12,3) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stock_quantity        NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_unit            TEXT         DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS allow_decimal_quantity BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS predefined_options    JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_active             BOOLEAN      DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order            INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url             TEXT         DEFAULT '/assets/images/default-herb.jpg',
  ADD COLUMN IF NOT EXISTS description_ta        TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS benefits_ta           TEXT         DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ  DEFAULT NOW();

-- orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────
-- PART 4: ORDER_ITEMS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id                  BIGSERIAL PRIMARY KEY,
  order_id            UUID          NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id          BIGINT        REFERENCES public.products(id) ON DELETE SET NULL,
  product_name        TEXT          NOT NULL,
  product_tamil_name  TEXT,
  quantity            NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit                TEXT          NOT NULL DEFAULT 'piece',
  unit_type           TEXT          NOT NULL DEFAULT 'unit'
                        CHECK (unit_type IN ('unit','weight','volume','bundle')),
  base_quantity       NUMERIC(12,3) NOT NULL DEFAULT 1,
  base_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url           TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- PART 5: ENABLE ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- PART 6: RLS POLICIES
-- ─────────────────────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS profiles_self_select   ON public.profiles;
DROP POLICY IF EXISTS profiles_self_insert   ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update   ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all     ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_self_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_admin_all   ON public.profiles FOR ALL    TO authenticated USING (public.is_admin());

-- categories (public read)
DROP POLICY IF EXISTS categories_anon_read    ON public.categories;
DROP POLICY IF EXISTS categories_admin_manage ON public.categories;
CREATE POLICY categories_anon_read    ON public.categories FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY categories_admin_manage ON public.categories FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- health_tags (public read)
DROP POLICY IF EXISTS tags_anon_read    ON public.health_tags;
DROP POLICY IF EXISTS tags_admin_manage ON public.health_tags;
CREATE POLICY tags_anon_read    ON public.health_tags FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY tags_admin_manage ON public.health_tags FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- products (public read)
DROP POLICY IF EXISTS products_anon_read    ON public.products;
DROP POLICY IF EXISTS products_admin_manage ON public.products;
CREATE POLICY products_anon_read    ON public.products FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY products_admin_manage ON public.products FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- orders
DROP POLICY IF EXISTS orders_user_select ON public.orders;
DROP POLICY IF EXISTS orders_user_insert ON public.orders;
DROP POLICY IF EXISTS orders_anon_insert ON public.orders;
DROP POLICY IF EXISTS orders_admin_all   ON public.orders;
CREATE POLICY orders_user_select ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY orders_user_insert ON public.orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY orders_anon_insert ON public.orders FOR INSERT TO anon          WITH CHECK (user_id IS NULL);
CREATE POLICY orders_admin_all   ON public.orders FOR ALL    TO authenticated USING (public.is_admin());

-- order_items
DROP POLICY IF EXISTS order_items_user_select ON public.order_items;
DROP POLICY IF EXISTS order_items_user_insert ON public.order_items;
DROP POLICY IF EXISTS order_items_admin_all   ON public.order_items;
CREATE POLICY order_items_user_select ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR public.is_admin())
  ));
CREATE POLICY order_items_user_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR public.is_admin())
  ));
CREATE POLICY order_items_admin_all ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- PART 7: KEY DATABASE FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- retail_decrement_stock
CREATE OR REPLACE FUNCTION public.retail_decrement_stock(
  p_product_id BIGINT,
  p_quantity   NUMERIC,
  p_unit       TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit TEXT := COALESCE(LOWER(TRIM(p_unit)), '');
  v_qty  NUMERIC := p_quantity;
BEGIN
  IF v_unit = 'kg' THEN v_qty := p_quantity * 1000; END IF;
  IF v_unit = 'l'  THEN v_qty := p_quantity * 1000; END IF;
  UPDATE public.products
  SET
    stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_qty, 0),
    stock          = GREATEST(FLOOR(COALESCE(stock_quantity, 0) - v_qty), 0)::INTEGER
  WHERE id = p_product_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.retail_decrement_stock(BIGINT, NUMERIC, TEXT) TO authenticated;

-- get_next_invoice_no  (idempotent — never fails on missing row)
CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  cnt      INTEGER;
BEGIN
  INSERT INTO public.invoice_counter (id, counter, year)
  VALUES (1, 1, cur_year)
  ON CONFLICT (id) DO UPDATE
    SET counter = CASE
          WHEN invoice_counter.year = cur_year THEN invoice_counter.counter + 1
          ELSE 1
        END,
        year = cur_year
  RETURNING counter INTO cnt;
  RETURN 'INV-' || cur_year || '-' || LPAD(cnt::TEXT, 6, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_no() TO authenticated;

-- create_order_with_stock (atomic checkout RPC)
CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_customer_name TEXT,
  p_phone         TEXT,
  p_address       TEXT,
  p_items         JSONB,
  p_shipping      NUMERIC DEFAULT 0,
  p_status        TEXT    DEFAULT 'pending'
)
RETURNS TABLE(order_id UUID, invoice_no TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_requester  UUID   := auth.uid();
  v_invoice_no TEXT;
  v_order_id   UUID;
  v_subtotal   NUMERIC(10,2) := 0;
  v_total      NUMERIC(10,2);
  v_item       JSONB;
  v_product_id BIGINT;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  v_invoice_no := public.get_next_invoice_no();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + COALESCE((v_item->>'line_total')::NUMERIC, 0);
  END LOOP;

  v_total := v_subtotal + COALESCE(p_shipping, 0);

  INSERT INTO public.orders (
    invoice_no, user_id, customer_name, phone, address,
    items, subtotal, shipping, total, status
  ) VALUES (
    v_invoice_no, v_requester,
    COALESCE(NULLIF(TRIM(p_customer_name),''), 'Customer'),
    COALESCE(NULLIF(TRIM(p_phone),''), ''),
    COALESCE(NULLIF(TRIM(p_address),''), ''),
    p_items, v_subtotal, COALESCE(p_shipping,0), v_total,
    COALESCE(NULLIF(TRIM(p_status),''), 'pending')
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::BIGINT;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_tamil_name,
      quantity, unit, unit_type, base_quantity, base_price, line_total, image_url
    ) VALUES (
      v_order_id,
      v_product_id,
      COALESCE(NULLIF(v_item->>'name',''), 'Product'),
      NULLIF(v_item->>'tamil_name',''),
      COALESCE((v_item->>'quantity')::NUMERIC,   0),
      COALESCE(NULLIF(v_item->>'unit',''),       'piece'),
      COALESCE(NULLIF(v_item->>'unit_type',''),  'unit'),
      COALESCE((v_item->>'base_quantity')::NUMERIC, 1),
      COALESCE((v_item->>'base_price')::NUMERIC,  0),
      COALESCE((v_item->>'line_total')::NUMERIC,   0),
      NULLIF(v_item->>'image_url','')
    );

    IF v_product_id IS NOT NULL THEN
      PERFORM public.retail_decrement_stock(
        v_product_id,
        COALESCE((v_item->>'quantity')::NUMERIC, 0),
        NULLIF(v_item->>'unit','')
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_invoice_no;
END;
$$;
GRANT  EXECUTE ON FUNCTION public.create_order_with_stock(TEXT,TEXT,TEXT,JSONB,NUMERIC,TEXT) TO authenticated;
REVOKE ALL     ON FUNCTION public.create_order_with_stock(TEXT,TEXT,TEXT,JSONB,NUMERIC,TEXT) FROM anon;

-- handle_new_user trigger (auto-creates profile on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_code TEXT;
  v_seq  BIGINT;
BEGIN
  v_role := CASE
    WHEN NEW.email = 'admin@srisiddha.com'              THEN 'admin'
    WHEN COALESCE(NEW.raw_user_meta_data->>'role','') = 'admin' THEN 'admin'
    ELSE 'customer'
  END;
  SELECT nextval('public.customer_code_seq') INTO v_seq;
  v_code := 'CUST-' || LPAD(v_seq::TEXT, 5, '0');

  INSERT INTO public.profiles (id, customer_code, name, mobile, email, role)
  VALUES (
    NEW.id, v_code,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'),''),
             SPLIT_PART(COALESCE(NEW.email,''),'@',1),
             'Customer'),
    COALESCE(NEW.raw_user_meta_data->>'mobile',''),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        name       = COALESCE(NULLIF(public.profiles.name,''), EXCLUDED.name),
        updated_at = NOW();

  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data,'{}') || jsonb_build_object('role', v_role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- PART 8: INVOICE COUNTER SEED
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.invoice_counter (id, counter, year)
VALUES (1, 0, EXTRACT(YEAR FROM NOW())::INTEGER)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- PART 9: PRODUCT CATALOG  (65 traditional Tamil products)
-- ─────────────────────────────────────────────────────────────
DELETE FROM public.products;
DELETE FROM public.categories;
DELETE FROM public.health_tags;

-- Health Tags (insert without is_active/sort_order if columns now exist from Part 3)
INSERT INTO public.health_tags (name_en, name_ta, is_active, sort_order) VALUES
  ('Immunity',      'நோய் எதிர்ப்பு',   true, 1),
  ('Digestion',     'செரிமானம்',        true, 2),
  ('Hair Growth',   'முடி வளர்ச்சி',   true, 3),
  ('Skin Care',     'தோல் பராமரிப்பு', true, 4),
  ('Joint Pain',    'மூட்டு வலி',      true, 5),
  ('Cold & Cough',  'சளி & இருமல்',    true, 6),
  ('Diabetes',      'சர்க்கரை நோய்',   true, 7),
  ('Stress',        'மன அழுத்தம்',     true, 8),
  ('Fever',         'காய்ச்சல்',        true, 9),
  ('Ritual Purity', 'சுத்தமான பூஜை',  true, 10);

-- Categories
INSERT INTO public.categories (name_en, name_ta, is_active, sort_order) VALUES
  ('Pooja Items',         'பூஜை பொருட்கள்',  true, 1),
  ('Herbal Powder',       'மூலிகை பொடி',      true, 2),
  ('Herbal Oil',          'மூலிகை எண்ணெய்',   true, 3),
  ('Spices & Condiments', 'மசாலா வகைகள்',     true, 4),
  ('Grains & Pulses',     'தானியங்கள்',       true, 5),
  ('Honey & Liquids',     'தேன் & திரவங்கள்',  true, 6),
  ('Bundle Packages',     'தொகுப்பு வகைகள்',   true, 7);

-- Products
DO $$
DECLARE
  cat_pooja  BIGINT; cat_powder BIGINT; cat_oil   BIGINT;
  cat_spice  BIGINT; cat_grains BIGINT; cat_honey BIGINT; cat_bundle BIGINT;

  w_opts  JSONB := '[{"quantity":100,"unit":"g","label":"100g"},{"quantity":250,"unit":"g","label":"250g"},{"quantity":500,"unit":"g","label":"500g"},{"quantity":1000,"unit":"g","label":"1kg"}]';
  v_opts  JSONB := '[{"quantity":250,"unit":"ml","label":"250ml"},{"quantity":500,"unit":"ml","label":"500ml"},{"quantity":1000,"unit":"ml","label":"1L"}]';
  v_small JSONB := '[{"quantity":100,"unit":"ml","label":"100ml"},{"quantity":250,"unit":"ml","label":"250ml"},{"quantity":500,"unit":"ml","label":"500ml"}]';
  g_opts  JSONB := '[{"quantity":500,"unit":"g","label":"500g"},{"quantity":1000,"unit":"g","label":"1kg"},{"quantity":2000,"unit":"g","label":"2kg"},{"quantity":5000,"unit":"g","label":"5kg"}]';
  k_opts  JSONB := '[{"quantity":250,"unit":"g","label":"250g"},{"quantity":500,"unit":"g","label":"500g"},{"quantity":1000,"unit":"g","label":"1kg"}]';

  img_powder TEXT := 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=400&q=80';
  img_oil    TEXT := 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80';
  img_spice  TEXT := 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80';
  img_herb   TEXT := 'https://images.unsplash.com/photo-1512103522279-9e54d799db91?auto=format&fit=crop&w=400&q=80';
  img_leaf   TEXT := 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80';
  img_root   TEXT := 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80';
BEGIN
  SELECT id INTO cat_pooja  FROM public.categories WHERE name_en = 'Pooja Items'         LIMIT 1;
  SELECT id INTO cat_powder FROM public.categories WHERE name_en = 'Herbal Powder'       LIMIT 1;
  SELECT id INTO cat_oil    FROM public.categories WHERE name_en = 'Herbal Oil'          LIMIT 1;
  SELECT id INTO cat_spice  FROM public.categories WHERE name_en = 'Spices & Condiments' LIMIT 1;
  SELECT id INTO cat_grains FROM public.categories WHERE name_en = 'Grains & Pulses'     LIMIT 1;
  SELECT id INTO cat_honey  FROM public.categories WHERE name_en = 'Honey & Liquids'     LIMIT 1;
  SELECT id INTO cat_bundle FROM public.categories WHERE name_en = 'Bundle Packages'     LIMIT 1;

  -- ── POOJA ITEMS (unit) ── 15 products ────────────────────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Kungumam','குங்குமம்','குங்குமம்','Pooja Items',cat_pooja,'unit','packet',1, 20,200,200,true, 1,img_spice,img_spice,'[]'::jsonb,'Pure kumkum powder for daily worship and rituals.','Ritual Purity',false),
    ('Vibhoothi','விபூதி','விபூதி','Pooja Items',cat_pooja,'unit','packet',1, 15,300,300,true, 2,img_spice,img_spice,'[]'::jsonb,'Sacred ash blessed for puja and forehead marking.','Ritual Purity',false),
    ('Karpooram','கர்பூரம்','கர்பூரம்','Pooja Items',cat_pooja,'unit','box',1, 35,150,150,true, 3,img_herb,img_herb,'[]'::jsonb,'Pure camphor tablets for aarti and pooja.','Ritual Purity',false),
    ('Agarbatti','ஊதுபத்தி','ஊதுபத்தி','Pooja Items',cat_pooja,'unit','pack',1, 30,250,250,true, 4,img_herb,img_herb,'[]'::jsonb,'Fragrant incense sticks, 60 per pack.','Ritual Purity',false),
    ('Navagraha Bit','நவக்கிரக பிட்','நவக்கிரக பிட்','Pooja Items',cat_pooja,'unit','set',1, 55,100,100,true, 5,img_herb,img_herb,'[]'::jsonb,'Complete set of Navagraha colour bits for rituals.','Ritual Purity',false),
    ('Kuthu Vilakku','குத்துவிளக்கு','குத்துவிளக்கு','Pooja Items',cat_pooja,'unit','piece',1,160, 50, 50,true, 6,img_herb,img_herb,'[]'::jsonb,'Brass standing oil lamp for home puja.','Ritual Purity',false),
    ('Swami Padam','சுவாமி படம்','சுவாமி படம்','Pooja Items',cat_pooja,'unit','piece',1, 80,100,100,true, 7,img_herb,img_herb,'[]'::jsonb,'Framed deity photos for home shrine.','Ritual Purity',false),
    ('Sandhanam','சந்தனம்','சந்தனம்','Pooja Items',cat_pooja,'unit','packet',1, 60,150,150,true, 8,img_spice,img_spice,'[]'::jsonb,'Pure sandalwood paste for worship and cooling.','Skin Care',false),
    ('Thiru Neeru','திரு நீறு','திரு நீறு','Pooja Items',cat_pooja,'unit','packet',1, 15,400,400,true, 9,img_herb,img_herb,'[]'::jsonb,'Sacred white ash packet for worship.','Ritual Purity',false),
    ('Poo Varisai','பூ வரிசை','பூ வரிசை','Pooja Items',cat_pooja,'unit','piece',1, 30,200,200,true,10,img_leaf,img_leaf,'[]'::jsonb,'Traditional flower tray for puja offering.','Ritual Purity',false),
    ('Panchagavyam','பஞ்சகவ்யம்','பஞ்சகவ்யம்','Pooja Items',cat_pooja,'unit','set',1,130, 80, 80,true,11,img_herb,img_herb,'[]'::jsonb,'Complete Panchagavya set for ritual purification.','Ritual Purity',false),
    ('Arugu Pul','அருகம்புல்','அருகம்புல்','Pooja Items',cat_pooja,'unit','bunch',1, 15,300,300,true,12,img_leaf,img_leaf,'[]'::jsonb,'Fresh arugampul grass for Vinayaka puja.','Ritual Purity',false),
    ('Thamarai','தாமரை','தாமரை','Pooja Items',cat_pooja,'unit','piece',1, 40,100,100,true,13,img_leaf,img_leaf,'[]'::jsonb,'Sacred lotus flower for goddess worship.','Ritual Purity',false),
    ('Deepam Thiri','தீபம் திரி','தீபம் திரி','Pooja Items',cat_pooja,'unit','pack',1, 20,500,500,true,14,img_herb,img_herb,'[]'::jsonb,'Cotton wicks for oil lamp, 100 per pack.','Ritual Purity',false),
    ('Kolamavu','கோலமாவு','கோலமாவு','Pooja Items',cat_pooja,'unit','packet',1, 30,200,200,true,15,img_powder,img_powder,'[]'::jsonb,'White rice flour for drawing kolam patterns.','Ritual Purity',false);

  -- ── HERBAL POWDER (weight, 100g base) ── 15 products ─────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Manjal Podi','மஞ்சள் பொடி','மஞ்சள் பொடி','Herbal Powder',cat_powder,'weight','g',100,120,5000,5000,true,20,img_powder,img_powder,w_opts,'Pure organic turmeric powder with high curcumin content.','Skin Care,Immunity',true),
    ('Thulasi Podi','துளசி பொடி','துளசி பொடி','Herbal Powder',cat_powder,'weight','g',100, 80,3000,3000,true,21,img_leaf,img_leaf,w_opts,'Dried holy basil powder for immunity and respiratory health.','Immunity,Cold & Cough',true),
    ('Veppalai Podi','வேப்பிலை பொடி','வேப்பிலை பொடி','Herbal Powder',cat_powder,'weight','g',100, 65,3000,3000,true,22,img_leaf,img_leaf,w_opts,'Neem leaf powder — natural antibacterial and blood purifier.','Skin Care,Diabetes',true),
    ('Vendhayam Podi','வெந்தயம் பொடி','வெந்தயம் பொடி','Herbal Powder',cat_powder,'weight','g',100, 50,4000,4000,true,23,img_powder,img_powder,w_opts,'Fenugreek seed powder for sugar control and lactation.','Diabetes,Digestion',true),
    ('Omam Podi','ஓமம் பொடி','ஓமம் பொடி','Herbal Powder',cat_powder,'weight','g',100, 60,3000,3000,true,24,img_powder,img_powder,w_opts,'Ajwain (carom) powder for digestive and cold relief.','Digestion,Cold & Cough',true),
    ('Seeragam Podi','சீரகம் பொடி','சீரகம் பொடி','Herbal Powder',cat_powder,'weight','g',100, 80,4000,4000,true,25,img_spice,img_spice,w_opts,'Ground cumin powder for digestion and metabolism.','Digestion',true),
    ('Milagu Podi','மிளகு பொடி','மிளகு பொடி','Herbal Powder',cat_powder,'weight','g',100,130,3000,3000,true,26,img_spice,img_spice,w_opts,'Pure black pepper powder — antioxidant and respiratory aid.','Cold & Cough,Immunity',true),
    ('Ashwagandha Podi','அஸ்வகந்தா பொடி','அஸ்வகந்தா பொடி','Herbal Powder',cat_powder,'weight','g',100,160,2000,2000,true,27,img_root,img_root,w_opts,'Adaptogenic root powder for strength, stress and vitality.','Stress,Immunity',true),
    ('Amla Podi','நெல்லிக்காய் பொடி','நெல்லிக்காய் பொடி','Herbal Powder',cat_powder,'weight','g',100, 90,3000,3000,true,28,img_powder,img_powder,w_opts,'Indian gooseberry powder — rich in Vitamin C and antioxidants.','Immunity,Hair Growth',true),
    ('Triphala Podi','திரிபலா பொடி','திரிபலா பொடி','Herbal Powder',cat_powder,'weight','g',100,120,2000,2000,true,29,img_powder,img_powder,w_opts,'Classic three-fruit blend for detox and digestive wellness.','Digestion,Immunity',true),
    ('Brahmi Podi','பிரம்மி பொடி','பிரம்மி பொடி','Herbal Powder',cat_powder,'weight','g',100,110,2000,2000,true,30,img_leaf,img_leaf,w_opts,'Bacopa monnieri powder for memory, focus and stress relief.','Stress',true),
    ('Murungai Podi','முருங்கை பொடி','முருங்கை பொடி','Herbal Powder',cat_powder,'weight','g',100, 90,3000,3000,true,31,img_leaf,img_leaf,w_opts,'Moringa drumstick leaf powder — nutritional superfood.','Immunity,Diabetes',true),
    ('Sathavari Podi','சதாவரி பொடி','சதாவரி பொடி','Herbal Powder',cat_powder,'weight','g',100,150,1500,1500,true,32,img_root,img_root,w_opts,'Asparagus racemosus powder for hormonal balance and vitality.','Immunity',true),
    ('Kandankathiri Podi','கண்டங்கத்திரி பொடி','கண்டங்கத்திரி பொடி','Herbal Powder',cat_powder,'weight','g',100, 95,1500,1500,true,33,img_root,img_root,w_opts,'Turkey berry powder — blood sugar and cholesterol aid.','Diabetes',true),
    ('Nithyakalyani Podi','நித்யகல்யாணி பொடி','நித்யகல்யாணி பொடி','Herbal Powder',cat_powder,'weight','g',100, 70,2000,2000,true,34,img_leaf,img_leaf,w_opts,'Periwinkle herb powder — anti-diabetic benefits.','Diabetes',true);

  -- ── HERBAL OIL (volume, 250ml base) ── 10 products ───────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Veppa Ennai','வேப்ப எண்ணெய்','வேப்ப எண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250,120,2000,2000,true,40,img_oil,img_oil,v_opts,'Cold-pressed neem oil — natural insect repellent and skin healer.','Skin Care',true),
    ('Nalla Ennai','நல்லெண்ணெய்','நல்லெண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250,200,3000,3000,true,41,img_oil,img_oil,v_opts,'Traditional gingelly (sesame) oil for cooking and hair care.','Hair Growth',true),
    ('Vilakkennai','விளக்கெண்ணெய்','விளக்கெண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250, 80,2000,2000,true,42,img_oil,img_oil,v_opts,'Castor oil — laxative, hair growth and skin nourishment.','Hair Growth',true),
    ('Thengai Ennai','தேங்காய் எண்ணெய்','தேங்காய் எண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250,160,3000,3000,true,43,img_oil,img_oil,v_opts,'Pure coconut oil for cooking, moisturising and oil pulling.','Skin Care',true),
    ('Omam Ennai','ஓம எண்ணெய்','ஓம எண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250,170,1500,1500,true,44,img_oil,img_oil,v_opts,'Ajwain infused oil for joint pain and respiratory relief.','Joint Pain',true),
    ('Brahmi Ennai','பிரம்மி எண்ணெய்','பிரம்மி எண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250,290,1000,1000,true,45,img_oil,img_oil,v_opts,'Bacopa hair oil — strengthens roots and improves memory.','Hair Growth,Stress',true),
    ('Milagu Ennai','மிளகு எண்ணெய்','மிளகு எண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250,210,1000,1000,true,46,img_oil,img_oil,v_opts,'Black pepper essential oil for pain relief and digestion.','Joint Pain',true),
    ('Keelanelli Ennai','கீழாநெல்லி எண்ணெய்','கீழாநெல்லி எண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250,230,1000,1000,true,47,img_oil,img_oil,v_opts,'Phyllanthus niruri oil — liver health and jaundice remedy.','Immunity',true),
    ('Sandal Oil','சந்தன எண்ணெய்','சந்தன எண்ணெய்','Herbal Oil',cat_oil,'volume','ml',100,350, 500, 500,true,48,img_oil,img_oil,v_small,'Pure sandalwood essential oil for skin care and meditation.','Skin Care',true),
    ('Pungam Ennai','புங்கம் எண்ணெய்','புங்கம் எண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250,140,1500,1500,true,49,img_oil,img_oil,v_opts,'Pongamia oil — traditional remedy for skin diseases.','Skin Care',true);

  -- ── SPICES & CONDIMENTS (weight, 100g base) ── 10 products
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Kalkandu','கல்கண்டு','கல்கண்டு','Spices & Condiments',cat_spice,'weight','g',250, 80,5000,5000,true,50,img_spice,img_spice,k_opts,'Pure rock sugar candy for prasad and herbal preparations.','Digestion',true),
    ('Elakkai','ஏலக்காய்','ஏலக்காய்','Spices & Condiments',cat_spice,'weight','g',100,210,2000,2000,true,51,img_spice,img_spice,w_opts,'Green cardamom — premium flavour for sweets and digestive aid.','Digestion',true),
    ('Lavangam','லவங்கம்','லவங்கம்','Spices & Condiments',cat_spice,'weight','g',100,260,1500,1500,true,52,img_spice,img_spice,w_opts,'Cloves — aromatic spice with antiseptic and dental benefits.','Cold & Cough',true),
    ('Pattai','பட்டை','பட்டை','Spices & Condiments',cat_spice,'weight','g',100,130,2000,2000,true,53,img_spice,img_spice,w_opts,'Ceylon cinnamon sticks — blood sugar and anti-inflammatory aid.','Diabetes',true),
    ('Kothamalli','கொத்தமல்லி','கொத்தமல்லி','Spices & Condiments',cat_spice,'weight','g',100, 65,3000,3000,true,54,img_spice,img_spice,w_opts,'Coriander seeds — digestive, cooling and anti-inflammatory.','Digestion',true),
    ('Ellu','எள்ளு','எள்ளு','Spices & Condiments',cat_spice,'weight','g',250,120,3000,3000,true,55,img_spice,img_spice,k_opts,'Black sesame seeds — calcium-rich, used in til ladoo and puja.','Immunity',true),
    ('Jathikai','ஜாதிக்காய்','ஜாதிக்காய்','Spices & Condiments',cat_spice,'weight','g',100,190,1000,1000,true,56,img_spice,img_spice,w_opts,'Nutmeg powder — digestive, sleep aid and anti-nausea spice.','Digestion',true),
    ('Sombu','சோம்பு','சோம்பு','Spices & Condiments',cat_spice,'weight','g',100, 75,3000,3000,true,57,img_spice,img_spice,w_opts,'Fennel seeds — mouth freshener and digestive antispasmodic.','Digestion',true),
    ('Kalonji','கருஞ்சீரகம்','கருஞ்சீரகம்','Spices & Condiments',cat_spice,'weight','g',100, 95,2000,2000,true,58,img_spice,img_spice,w_opts,'Black seed (Nigella sativa) — immunity and anti-inflammatory.','Immunity',true),
    ('Vasambu','வசம்பு','வசம்பு','Spices & Condiments',cat_spice,'weight','g',100,110,1500,1500,true,59,img_root,img_root,w_opts,'Calamus root — traditional remedy for colic, fever and insects.','Fever',true);

  -- ── GRAINS & PULSES (weight, 500g base) ── 5 products ────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Pacharisi','பச்சரிசி','பச்சரிசி','Grains & Pulses',cat_grains,'weight','g',500, 85,20000,20000,true,60,img_herb,img_herb,g_opts,'Raw (unboiled) white rice for puja offerings and cooking.','Ritual Purity',true),
    ('Ulundhu','உளுந்து','உளுந்து','Grains & Pulses',cat_grains,'weight','g',500,100,10000,10000,true,61,img_herb,img_herb,g_opts,'Whole urad dal — traditional ingredient in idli, dosa and vadas.','Digestion',true),
    ('Kadalai Paruppu','கடலைப்பருப்பு','கடலைப்பருப்பு','Grains & Pulses',cat_grains,'weight','g',500, 85,10000,10000,true,62,img_herb,img_herb,g_opts,'Chana dal (split chickpeas) for dal, snacks and protein.','Immunity',true),
    ('Thovar Paruppu','துவரம்பருப்பு','துவரம்பருப்பு','Grains & Pulses',cat_grains,'weight','g',500, 95,10000,10000,true,63,img_herb,img_herb,g_opts,'Split pigeon peas (toor dal) — staple South Indian protein.','Digestion',true),
    ('Pasi Paruppu','பாசிப்பருப்பு','பாசிப்பருப்பு','Grains & Pulses',cat_grains,'weight','g',500, 90,10000,10000,true,64,img_herb,img_herb,g_opts,'Split moong dal — light, easy to digest and high in protein.','Digestion',true);

  -- ── HONEY & LIQUIDS (volume, 250ml base) ── 5 products ───
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Then','தேன்','தேன்','Honey & Liquids',cat_honey,'volume','ml',250,200,5000,5000,true,70,img_oil,img_oil,v_opts,'Pure raw forest honey — natural sweetener and immunity booster.','Immunity,Cold & Cough',true),
    ('Nei','நெய்','நெய்','Honey & Liquids',cat_honey,'volume','ml',250,280,3000,3000,true,71,img_oil,img_oil,v_opts,'Pure desi cow ghee — Ayurvedic superfood for digestion and brain.','Digestion,Immunity',true),
    ('Panneer','பன்னீர்','பன்னீர்','Honey & Liquids',cat_honey,'volume','ml',250, 85,3000,3000,true,72,img_oil,img_oil,v_small,'Rose water (paneer thanner) for puja sprinkling and skin care.','Skin Care',true),
    ('Sandal Water','சந்தன தண்ணீர்','சந்தன தண்ணீர்','Honey & Liquids',cat_honey,'volume','ml',250,120,2000,2000,true,73,img_oil,img_oil,v_small,'Sandalwood-infused water for cooling, puja and skin brightening.','Skin Care',true),
    ('Tulsi Extract','துளசி சாறு','துளசி சாறு','Honey & Liquids',cat_honey,'volume','ml',250,160,1500,1500,true,74,img_oil,img_oil,v_small,'Concentrated holy basil extract — immunity, fever and cold relief.','Immunity,Fever',true);

  -- ── BUNDLE PACKAGES (bundle) ── 5 products ──────────────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Poornahuthi Saamaan','பூர்ணாஹுதி சாமான்','பூர்ணாஹுதி சாமான்','Bundle Packages',cat_bundle,'bundle','bundle',1,550, 50, 50,true,80,img_herb,img_herb,'[]'::jsonb,'Complete homam/yaagam kit with all essential ritual items.','Ritual Purity',false),
    ('Daily Pooja Combo','தினசரி பூஜை தொகுப்பு','தினசரி பூஜை தொகுப்பு','Bundle Packages',cat_bundle,'bundle','bundle',1,270,100,100,true,81,img_herb,img_herb,'[]'::jsonb,'Daily puja essentials: kumkum, vibhoothi, agarbatti, camphor, deepam.','Ritual Purity',false),
    ('Herbal Wellness Pack','மூலிகை ஆரோக்கிய தொகுப்பு','மூலிகை ஆரோக்கிய தொகுப்பு','Bundle Packages',cat_bundle,'bundle','bundle',1,420, 60, 60,true,82,img_leaf,img_leaf,'[]'::jsonb,'Curated wellness kit: turmeric, tulsi, amla, triphala powders 100g each.','Immunity',false),
    ('Pazha Vagaigal Set','பழ வகைகள் தொகுப்பு','பழ வகைகள் தொகுப்பு','Bundle Packages',cat_bundle,'bundle','bundle',1,320, 40, 40,true,83,img_leaf,img_leaf,'[]'::jsonb,'Traditional fruit and prasad set for temple offerings.','Ritual Purity',false),
    ('Wedding Ritual Pack','திருமண சடங்கு தொகுப்பு','திருமண சடங்கு தொகுப்பு','Bundle Packages',cat_bundle,'bundle','bundle',1,850, 20, 20,true,84,img_herb,img_herb,'[]'::jsonb,'All-in-one wedding ritual package with 25+ sacred items.','Ritual Purity',false);

END;
$$;

-- ─────────────────────────────────────────────────────────────
-- PART 10: INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_is_active    ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_sort_order   ON public.products(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category_id  ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_no     ON public.orders(invoice_no);
CREATE INDEX IF NOT EXISTS idx_orders_user_id        ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone          ON public.orders(phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id  ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email        ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_mobile       ON public.profiles(mobile);

-- ─────────────────────────────────────────────────────────────
-- PART 11: ENABLE REALTIME (best-effort, may error if already added)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN others THEN NULL; END; $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
EXCEPTION WHEN others THEN NULL; END; $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN others THEN NULL; END; $$;

-- ─────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE unit_type = 'unit')   AS unit_count,
  COUNT(*) FILTER (WHERE unit_type = 'weight') AS weight_count,
  COUNT(*) FILTER (WHERE unit_type = 'volume') AS volume_count,
  COUNT(*) FILTER (WHERE unit_type = 'bundle') AS bundle_count,
  COUNT(*)                                      AS total
FROM public.products;
