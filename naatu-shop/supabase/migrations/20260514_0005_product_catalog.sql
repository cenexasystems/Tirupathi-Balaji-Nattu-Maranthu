-- Migration 0005: Replace product catalog with 65 traditional Tamil products
-- Run in Supabase SQL editor AFTER migrations 0001-0004.
-- Safe to re-run (products are cleared first).

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Clear existing catalog data
-- (order_items.product_id will become NULL via ON DELETE SET NULL)
-- ─────────────────────────────────────────────────────────────
DELETE FROM public.products;
DELETE FROM public.categories;
DELETE FROM public.health_tags;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: New categories (7 — matches all 4 unit types)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.categories (name_en, name_ta, is_active, sort_order) VALUES
  ('Pooja Items',        'பூஜை பொருட்கள்',     true, 1),
  ('Herbal Powder',      'மூலிகை பொடி',         true, 2),
  ('Herbal Oil',         'மூலிகை எண்ணெய்',       true, 3),
  ('Spices & Condiments','மசாலா வகைகள்',         true, 4),
  ('Grains & Pulses',    'தானியங்கள்',           true, 5),
  ('Honey & Liquids',    'தேன் & திரவங்கள்',      true, 6),
  ('Bundle Packages',    'தொகுப்பு வகைகள்',       true, 7);

-- ─────────────────────────────────────────────────────────────
-- STEP 3: Health tags
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.health_tags (name_en, name_ta, is_active, sort_order) VALUES
  ('Immunity',       'நோய் எதிர்ப்பு',   true, 1),
  ('Digestion',      'செரிமானம்',        true, 2),
  ('Hair Growth',    'முடி வளர்ச்சி',   true, 3),
  ('Skin Care',      'தோல் பராமரிப்பு', true, 4),
  ('Joint Pain',     'மூட்டு வலி',      true, 5),
  ('Cold & Cough',   'சளி & இருமல்',    true, 6),
  ('Diabetes',       'சர்க்கரை நோய்',   true, 7),
  ('Stress',         'மன அழுத்தம்',     true, 8),
  ('Fever',          'காய்ச்சல்',        true, 9),
  ('Ritual Purity',  'சுத்தமான பூஜை',  true, 10);

-- ─────────────────────────────────────────────────────────────
-- STEP 4: Insert all 65 products via DO block
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  cat_pooja  BIGINT; cat_powder BIGINT; cat_oil   BIGINT;
  cat_spice  BIGINT; cat_grains BIGINT; cat_honey BIGINT;
  cat_bundle BIGINT;

  -- Standard predefined option sets
  w_opts  JSONB := '[{"quantity":100,"unit":"g","label":"100g"},{"quantity":250,"unit":"g","label":"250g"},{"quantity":500,"unit":"g","label":"500g"},{"quantity":1000,"unit":"g","label":"1kg"}]';
  v_opts  JSONB := '[{"quantity":250,"unit":"ml","label":"250ml"},{"quantity":500,"unit":"ml","label":"500ml"},{"quantity":1000,"unit":"ml","label":"1L"}]';
  v_small JSONB := '[{"quantity":100,"unit":"ml","label":"100ml"},{"quantity":250,"unit":"ml","label":"250ml"},{"quantity":500,"unit":"ml","label":"500ml"}]';
  g_opts  JSONB := '[{"quantity":500,"unit":"g","label":"500g"},{"quantity":1000,"unit":"g","label":"1kg"},{"quantity":2000,"unit":"g","label":"2kg"},{"quantity":5000,"unit":"g","label":"5kg"}]';

  -- Shared image URLs per category type
  img_powder TEXT := 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=400&q=80';
  img_oil    TEXT := 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80';
  img_spice  TEXT := 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80';
  img_herb   TEXT := 'https://images.unsplash.com/photo-1512103522279-9e54d799db91?auto=format&fit=crop&w=400&q=80';
  img_leaf   TEXT := 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80';
  img_root   TEXT := 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80';
  img_tab    TEXT := 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80';

BEGIN
  SELECT id INTO cat_pooja  FROM public.categories WHERE name_en = 'Pooja Items'         LIMIT 1;
  SELECT id INTO cat_powder FROM public.categories WHERE name_en = 'Herbal Powder'       LIMIT 1;
  SELECT id INTO cat_oil    FROM public.categories WHERE name_en = 'Herbal Oil'          LIMIT 1;
  SELECT id INTO cat_spice  FROM public.categories WHERE name_en = 'Spices & Condiments' LIMIT 1;
  SELECT id INTO cat_grains FROM public.categories WHERE name_en = 'Grains & Pulses'     LIMIT 1;
  SELECT id INTO cat_honey  FROM public.categories WHERE name_en = 'Honey & Liquids'     LIMIT 1;
  SELECT id INTO cat_bundle FROM public.categories WHERE name_en = 'Bundle Packages'     LIMIT 1;

  -- ── POOJA ITEMS (unit / piece-based) ── 15 products ──────────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Kungumam',     'குங்குமம்',     'குங்குமம்',     'Pooja Items', cat_pooja,  'unit','packet',1, 20,  200,200, true,  1, img_spice, img_spice, '[]', 'Pure kumkum powder for daily worship and rituals.',        'Ritual Purity', false),
    ('Vibhoothi',    'விபூதி',        'விபூதி',        'Pooja Items', cat_pooja,  'unit','packet',1, 15,  300,300, true,  2, img_spice, img_spice, '[]', 'Sacred ash blessed for puja and forehead marking.',       'Ritual Purity', false),
    ('Karpooram',    'கர்பூரம்',      'கர்பூரம்',      'Pooja Items', cat_pooja,  'unit','box',   1, 35,  150,150, true,  3, img_herb,  img_herb,  '[]', 'Pure camphor tablets for aarti and pooja.',               'Ritual Purity', false),
    ('Agarbatti',    'ஊதுபத்தி',      'ஊதுபத்தி',      'Pooja Items', cat_pooja,  'unit','pack',  1, 30,  250,250, true,  4, img_herb,  img_herb,  '[]', 'Fragrant incense sticks, 60 per pack.',                  'Ritual Purity', false),
    ('Navagraha Bit','நவக்கிரக பிட்', 'நவக்கிரக பிட்', 'Pooja Items', cat_pooja,  'unit','set',   1, 55,  100,100, true,  5, img_herb,  img_herb,  '[]', 'Complete set of Navagraha colour bits for rituals.',      'Ritual Purity', false),
    ('Kuthu Vilakku','குத்துவிளக்கு', 'குத்துவிளக்கு', 'Pooja Items', cat_pooja,  'unit','piece', 1,160,   50, 50, true,  6, img_herb,  img_herb,  '[]', 'Brass standing oil lamp for home puja.',                 'Ritual Purity', false),
    ('Swami Padam',  'சுவாமி படம்',   'சுவாமி படம்',   'Pooja Items', cat_pooja,  'unit','piece', 1, 80,  100,100, true,  7, img_herb,  img_herb,  '[]', 'Framed deity photos for home shrine.',                   'Ritual Purity', false),
    ('Sandhanam',    'சந்தனம்',       'சந்தனம்',       'Pooja Items', cat_pooja,  'unit','packet',1, 60,  150,150, true,  8, img_spice, img_spice, '[]', 'Pure sandalwood paste for worship and cooling.',         'Skin Care',     false),
    ('Thiru Neeru',  'திரு நீறு',     'திரு நீறு',     'Pooja Items', cat_pooja,  'unit','packet',1, 15,  400,400, true,  9, img_herb,  img_herb,  '[]', 'Sacred white ash packet for worship.',                   'Ritual Purity', false),
    ('Poo Varisai',  'பூ வரிசை',      'பூ வரிசை',      'Pooja Items', cat_pooja,  'unit','piece', 1, 30,  200,200, true, 10, img_leaf,  img_leaf,  '[]', 'Traditional flower tray for puja offering.',             'Ritual Purity', false),
    ('Panchagavyam', 'பஞ்சகவ்யம்',    'பஞ்சகவ்யம்',    'Pooja Items', cat_pooja,  'unit','set',   1,130,   80, 80, true, 11, img_herb,  img_herb,  '[]', 'Complete Panchagavya set for ritual purification.',       'Ritual Purity', false),
    ('Arugu Pul',    'அருகம்புல்',    'அருகம்புல்',    'Pooja Items', cat_pooja,  'unit','bunch', 1, 15,  300,300, true, 12, img_leaf,  img_leaf,  '[]', 'Fresh arugampul grass for Vinayaka puja.',               'Ritual Purity', false),
    ('Thamarai',     'தாமரை',         'தாமரை',         'Pooja Items', cat_pooja,  'unit','piece', 1, 40,  100,100, true, 13, img_leaf,  img_leaf,  '[]', 'Sacred lotus flower for goddess worship.',               'Ritual Purity', false),
    ('Deepam Thiri', 'தீபம் திரி',    'தீபம் திரி',    'Pooja Items', cat_pooja,  'unit','pack',  1, 20,  500,500, true, 14, img_herb,  img_herb,  '[]', 'Cotton wicks for oil lamp, 100 per pack.',               'Ritual Purity', false),
    ('Kolamavu',     'கோலமாவு',       'கோலமாவு',       'Pooja Items', cat_pooja,  'unit','packet',1, 30,  200,200, true, 15, img_powder,img_powder,'[]', 'White rice flour for drawing kolam patterns.',           'Ritual Purity', false);

  -- ── HERBAL POWDER (weight, 100g base) ── 15 products ─────────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Manjal Podi',       'மஞ்சள் பொடி',         'மஞ்சள் பொடி',         'Herbal Powder', cat_powder, 'weight','g',100, 120, 5000,5000, true, 20, img_powder,img_powder, w_opts, 'Pure organic turmeric powder with high curcumin content.',          'Skin Care,Immunity',         true),
    ('Thulasi Podi',      'துளசி பொடி',           'துளசி பொடி',           'Herbal Powder', cat_powder, 'weight','g',100,  80, 3000,3000, true, 21, img_leaf,  img_leaf,   w_opts, 'Dried holy basil powder for immunity and respiratory health.',       'Immunity,Cold & Cough',      true),
    ('Veppalai Podi',     'வேப்பிலை பொடி',        'வேப்பிலை பொடி',        'Herbal Powder', cat_powder, 'weight','g',100,  65, 3000,3000, true, 22, img_leaf,  img_leaf,   w_opts, 'Neem leaf powder — natural antibacterial and blood purifier.',      'Skin Care,Diabetes',         true),
    ('Vendhayam Podi',    'வெந்தயம் பொடி',        'வெந்தயம் பொடி',        'Herbal Powder', cat_powder, 'weight','g',100,  50, 4000,4000, true, 23, img_powder,img_powder, w_opts, 'Fenugreek seed powder for sugar control and lactation.',            'Diabetes,Digestion',         true),
    ('Omam Podi',         'ஓமம் பொடி',            'ஓமம் பொடி',            'Herbal Powder', cat_powder, 'weight','g',100,  60, 3000,3000, true, 24, img_powder,img_powder, w_opts, 'Ajwain (carom) powder for digestive and cold relief.',              'Digestion,Cold & Cough',     true),
    ('Seeragam Podi',     'சீரகம் பொடி',          'சீரகம் பொடி',          'Herbal Powder', cat_powder, 'weight','g',100,  80, 4000,4000, true, 25, img_spice, img_spice,  w_opts, 'Ground cumin powder for digestion and metabolism.',                 'Digestion',                  true),
    ('Milagu Podi',       'மிளகு பொடி',           'மிளகு பொடி',           'Herbal Powder', cat_powder, 'weight','g',100, 130, 3000,3000, true, 26, img_spice, img_spice,  w_opts, 'Pure black pepper powder — antioxidant and respiratory aid.',       'Cold & Cough,Immunity',      true),
    ('Ashwagandha Podi',  'அஸ்வகந்தா பொடி',       'அஸ்வகந்தா பொடி',       'Herbal Powder', cat_powder, 'weight','g',100, 160, 2000,2000, true, 27, img_root,  img_root,   w_opts, 'Adaptogenic root powder for strength, stress and vitality.',        'Stress,Immunity',            true),
    ('Amla Podi',         'நெல்லிக்காய் பொடி',    'நெல்லிக்காய் பொடி',    'Herbal Powder', cat_powder, 'weight','g',100,  90, 3000,3000, true, 28, img_powder,img_powder, w_opts, 'Indian gooseberry powder — rich in Vitamin C and antioxidants.',   'Immunity,Hair Growth',       true),
    ('Triphala Podi',     'திரிபலா பொடி',         'திரிபலா பொடி',         'Herbal Powder', cat_powder, 'weight','g',100, 120, 2000,2000, true, 29, img_powder,img_powder, w_opts, 'Classic three-fruit blend for detox and digestive wellness.',       'Digestion,Immunity',         true),
    ('Brahmi Podi',       'பிரம்மி பொடி',         'பிரம்மி பொடி',         'Herbal Powder', cat_powder, 'weight','g',100, 110, 2000,2000, true, 30, img_leaf,  img_leaf,   w_opts, 'Bacopa monnieri powder for memory, focus and stress relief.',       'Stress',                     true),
    ('Murungai Podi',     'முருங்கை பொடி',        'முருங்கை பொடி',        'Herbal Powder', cat_powder, 'weight','g',100,  90, 3000,3000, true, 31, img_leaf,  img_leaf,   w_opts, 'Moringa drumstick leaf powder — nutritional superfood.',           'Immunity,Diabetes',          true),
    ('Sathavari Podi',    'சதாவரி பொடி',          'சதாவரி பொடி',          'Herbal Powder', cat_powder, 'weight','g',100, 150, 1500,1500, true, 32, img_root,  img_root,   w_opts, 'Asparagus racemosus powder for hormonal balance and vitality.',     'Immunity',                   true),
    ('Kandankathiri Podi','கண்டங்கத்திரி பொடி',   'கண்டங்கத்திரி பொடி',   'Herbal Powder', cat_powder, 'weight','g',100,  95, 1500,1500, true, 33, img_root,  img_root,   w_opts, 'Turkey berry powder — powerful blood sugar and cholesterol aid.',  'Diabetes',                   true),
    ('Nithyakalyani Podi','நித்யகல்யாணி பொடி',   'நித்யகல்யாணி பொடி',   'Herbal Powder', cat_powder, 'weight','g',100,  70, 2000,2000, true, 34, img_leaf,  img_leaf,   w_opts, 'Periwinkle herb powder for anti-diabetic and anti-cancer benefits.','Diabetes',                   true);

  -- ── HERBAL OIL (volume, 250ml base) ── 10 products ───────────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Veppa Ennai',       'வேப்ப எண்ணெய்',  'வேப்ப எண்ணெய்',  'Herbal Oil', cat_oil, 'volume','ml',250, 120, 2000,2000, true, 40, img_oil, img_oil, v_opts,  'Cold-pressed neem oil — natural insect repellent and skin healer.', 'Skin Care',         true),
    ('Nalla Ennai',       'நல்லெண்ணெய்',    'நல்லெண்ணெய்',    'Herbal Oil', cat_oil, 'volume','ml',250, 200, 3000,3000, true, 41, img_oil, img_oil, v_opts,  'Traditional gingelly (sesame) oil for cooking and hair care.',     'Hair Growth',       true),
    ('Vilakkennai',       'விளக்கெண்ணெய்',  'விளக்கெண்ணெய்',  'Herbal Oil', cat_oil, 'volume','ml',250,  80, 2000,2000, true, 42, img_oil, img_oil, v_opts,  'Castor oil — laxative, hair growth and skin nourishment.',         'Hair Growth',       true),
    ('Thengai Ennai',     'தேங்காய் எண்ணெய்','தேங்காய் எண்ணெய்','Herbal Oil',cat_oil, 'volume','ml',250, 160, 3000,3000, true, 43, img_oil, img_oil, v_opts,  'Pure coconut oil for cooking, moisturising and oil pulling.',      'Skin Care',         true),
    ('Omam Ennai',        'ஓம எண்ணெய்',     'ஓம எண்ணெய்',     'Herbal Oil', cat_oil, 'volume','ml',250, 170, 1500,1500, true, 44, img_oil, img_oil, v_opts,  'Ajwain infused oil for joint pain and respiratory relief.',        'Joint Pain',        true),
    ('Brahmi Ennai',      'பிரம்மி எண்ணெய்','பிரம்மி எண்ணெய்','Herbal Oil', cat_oil, 'volume','ml',250, 290, 1000,1000, true, 45, img_oil, img_oil, v_opts,  'Bacopa hair oil — strengthens roots and improves memory.',         'Hair Growth,Stress',true),
    ('Milagu Ennai',      'மிளகு எண்ணெய்',  'மிளகு எண்ணெய்',  'Herbal Oil', cat_oil, 'volume','ml',250, 210, 1000,1000, true, 46, img_oil, img_oil, v_opts,  'Black pepper essential oil for pain relief and digestion.',        'Joint Pain',        true),
    ('Keelanelli Ennai',  'கீழாநெல்லி எண்ணெய்','கீழாநெல்லி எண்ணெய்','Herbal Oil',cat_oil,'volume','ml',250,230,1000,1000,true,47, img_oil, img_oil, v_opts,  'Phyllanthus niruri oil — liver health and jaundice remedy.',       'Immunity',          true),
    ('Sandal Oil',        'சந்தன எண்ணெய்',  'சந்தன எண்ணெய்',  'Herbal Oil', cat_oil, 'volume','ml',100, 350, 500, 500, true, 48, img_oil, img_oil, v_small, 'Pure sandalwood essential oil for skin care and meditation.',      'Skin Care',         true),
    ('Pungam Ennai',      'புங்கம் எண்ணெய்','புங்கம் எண்ணெய்','Herbal Oil', cat_oil, 'volume','ml',250, 140, 1500,1500, true, 49, img_oil, img_oil, v_opts,  'Pongamia oil — traditional remedy for skin diseases and wounds.',  'Skin Care',         true);

  -- ── SPICES & CONDIMENTS (weight, 100g base) ── 10 products ───
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Kalkandu',       'கல்கண்டு',       'கல்கண்டு',       'Spices & Condiments', cat_spice, 'weight','g',250,  80, 5000,5000, true, 50, img_spice,img_spice, '[{"quantity":250,"unit":"g","label":"250g"},{"quantity":500,"unit":"g","label":"500g"},{"quantity":1000,"unit":"g","label":"1kg"}]', 'Pure rock sugar candy for prasad and herbal preparations.',     'Digestion',       true),
    ('Elakkai',        'ஏலக்காய்',       'ஏலக்காய்',       'Spices & Condiments', cat_spice, 'weight','g',100, 210, 2000,2000, true, 51, img_spice,img_spice, w_opts, 'Green cardamom — premium flavour for sweets and digestive aid.',    'Digestion',       true),
    ('Lavangam',       'லவங்கம்',        'லவங்கம்',        'Spices & Condiments', cat_spice, 'weight','g',100, 260, 1500,1500, true, 52, img_spice,img_spice, w_opts, 'Cloves — aromatic spice with antiseptic and dental benefits.',       'Cold & Cough',    true),
    ('Pattai',         'பட்டை',          'பட்டை',          'Spices & Condiments', cat_spice, 'weight','g',100, 130, 2000,2000, true, 53, img_spice,img_spice, w_opts, 'Ceylon cinnamon sticks — blood sugar and anti-inflammatory aid.',   'Diabetes',        true),
    ('Kothamalli',     'கொத்தமல்லி',     'கொத்தமல்லி',     'Spices & Condiments', cat_spice, 'weight','g',100,  65, 3000,3000, true, 54, img_spice,img_spice, w_opts, 'Coriander seeds — digestive, cooling and anti-inflammatory.',       'Digestion',       true),
    ('Ellu',           'எள்ளு',          'எள்ளு',          'Spices & Condiments', cat_spice, 'weight','g',250, 120, 3000,3000, true, 55, img_spice,img_spice, '[{"quantity":250,"unit":"g","label":"250g"},{"quantity":500,"unit":"g","label":"500g"},{"quantity":1000,"unit":"g","label":"1kg"}]', 'Black sesame seeds — calcium-rich, used in til ladoo and puja.','Immunity',        true),
    ('Jathikai',       'ஜாதிக்காய்',     'ஜாதிக்காய்',     'Spices & Condiments', cat_spice, 'weight','g',100, 190, 1000,1000, true, 56, img_spice,img_spice, w_opts, 'Nutmeg powder — digestive, sleep aid and anti-nausea spice.',       'Digestion',       true),
    ('Sombu',          'சோம்பு',         'சோம்பு',         'Spices & Condiments', cat_spice, 'weight','g',100,  75, 3000,3000, true, 57, img_spice,img_spice, w_opts, 'Fennel seeds — mouth freshener and digestive antispasmodic.',       'Digestion',       true),
    ('Kalonji',        'கருஞ்சீரகம்',    'கருஞ்சீரகம்',    'Spices & Condiments', cat_spice, 'weight','g',100,  95, 2000,2000, true, 58, img_spice,img_spice, w_opts, 'Black seed (Nigella sativa) — immunity and anti-inflammatory.',     'Immunity',        true),
    ('Vasambu',        'வசம்பு',         'வசம்பு',         'Spices & Condiments', cat_spice, 'weight','g',100, 110, 1500,1500, true, 59, img_root, img_root,  w_opts, 'Calamus root — traditional remedy for colic, fever and insects.',   'Fever',           true);

  -- ── GRAINS & PULSES (weight, 500g base) ── 5 products ────────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Pacharisi',       'பச்சரிசி',      'பச்சரிசி',      'Grains & Pulses', cat_grains, 'weight','g',500,  85, 20000,20000, true, 60, img_herb, img_herb, g_opts, 'Raw (unboiled) white rice for puja offerings and rituals.',          'Ritual Purity', true),
    ('Ulundhu',         'உளுந்து',       'உளுந்து',       'Grains & Pulses', cat_grains, 'weight','g',500, 100, 10000,10000, true, 61, img_herb, img_herb, g_opts, 'Whole urad dal — traditional ingredient in idli, dosa and vadas.',  'Digestion',     true),
    ('Kadalai Paruppu', 'கடலைப்பருப்பு','கடலைப்பருப்பு','Grains & Pulses', cat_grains, 'weight','g',500,  85, 10000,10000, true, 62, img_herb, img_herb, g_opts, 'Chana dal (split chickpeas) for dal, snacks and protein.',           'Immunity',      true),
    ('Thovar Paruppu',  'துவரம்பருப்பு', 'துவரம்பருப்பு', 'Grains & Pulses', cat_grains, 'weight','g',500,  95, 10000,10000, true, 63, img_herb, img_herb, g_opts, 'Split pigeon peas (toor dal) — staple South Indian protein.',        'Digestion',     true),
    ('Pasi Paruppu',    'பாசிப்பருப்பு', 'பாசிப்பருப்பு', 'Grains & Pulses', cat_grains, 'weight','g',500,  90, 10000,10000, true, 64, img_herb, img_herb, g_opts, 'Split moong dal — light, easy to digest and high in protein.',       'Digestion',     true);

  -- ── HONEY & LIQUIDS (volume, 250ml base) ── 5 products ────────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Then',            'தேன்',          'தேன்',          'Honey & Liquids', cat_honey, 'volume','ml',250, 200, 5000,5000, true, 70, img_oil, img_oil, v_opts,  'Pure raw forest honey — natural sweetener and immunity booster.',   'Immunity,Cold & Cough', true),
    ('Nei',             'நெய்',          'நெய்',          'Honey & Liquids', cat_honey, 'volume','ml',250, 280, 3000,3000, true, 71, img_oil, img_oil, v_opts,  'Pure desi cow ghee — Ayurvedic superfood for digestion and brain.',  'Digestion,Immunity',    true),
    ('Panneer',         'பன்னீர்',       'பன்னீர்',       'Honey & Liquids', cat_honey, 'volume','ml',250,  85, 3000,3000, true, 72, img_oil, img_oil, v_small, 'Rose water (paneer thanner) for puja sprinkling and skin care.',     'Skin Care',             true),
    ('Sandal Water',    'சந்தன தண்ணீர்', 'சந்தன தண்ணீர்', 'Honey & Liquids', cat_honey, 'volume','ml',250, 120, 2000,2000, true, 73, img_oil, img_oil, v_small, 'Sandalwood-infused water for cooling, puja and skin brightening.',  'Skin Care',             true),
    ('Tulsi Extract',   'துளசி சாறு',    'துளசி சாறு',    'Honey & Liquids', cat_honey, 'volume','ml',250, 160, 1500,1500, true, 74, img_oil, img_oil, v_small, 'Concentrated holy basil extract — immunity, fever and cold relief.','Immunity,Fever',        true);

  -- ── BUNDLE PACKAGES (bundle) ── 5 products ───────────────────
  INSERT INTO public.products
    (name, name_ta, tamil_name, category, category_id, unit_type, unit_label, base_quantity,
     price, stock_quantity, stock, is_active, sort_order, image_url, image,
     predefined_options, description, benefits, allow_decimal_quantity)
  VALUES
    ('Poornahuthi Saamaan',  'பூர்ணாஹுதி சாமான்',    'பூர்ணாஹுதி சாமான்',    'Bundle Packages', cat_bundle, 'bundle','bundle',1, 550,  50, 50, true, 80, img_herb, img_herb, '[]', 'Complete homam/yaagam kit with all essential ritual items.',              'Ritual Purity', false),
    ('Daily Pooja Combo',    'தினசரி பூஜை தொகுப்பு',  'தினசரி பூஜை தொகுப்பு',  'Bundle Packages', cat_bundle, 'bundle','bundle',1, 270, 100,100, true, 81, img_herb, img_herb, '[]', 'Daily puja essentials: kumkum, vibhoothi, agarbatti, camphor, deepam.', 'Ritual Purity', false),
    ('Herbal Wellness Pack', 'மூலிகை ஆரோக்கிய தொகுப்பு','மூலிகை ஆரோக்கிய தொகுப்பு','Bundle Packages',cat_bundle,'bundle','bundle',1,420,  60, 60, true, 82, img_leaf, img_leaf, '[]', 'Curated wellness kit: turmeric, tulsi, amla, triphala powders 100g each.','Immunity',      false),
    ('Pazha Vagaigal Set',   'பழ வகைகள் தொகுப்பு',    'பழ வகைகள் தொகுப்பு',    'Bundle Packages', cat_bundle, 'bundle','bundle',1, 320,  40, 40, true, 83, img_leaf, img_leaf, '[]', 'Traditional fruit and prasad set for temple offerings.',                 'Ritual Purity', false),
    ('Wedding Ritual Pack',  'திருமண சடங்கு தொகுப்பு', 'திருமண சடங்கு தொகுப்பு', 'Bundle Packages', cat_bundle, 'bundle','bundle',1, 850,  20, 20, true, 84, img_herb, img_herb, '[]', 'All-in-one wedding ritual package with 25+ sacred items.',               'Ritual Purity', false);

END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 5: Verify counts
-- ─────────────────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE unit_type = 'unit')   AS unit_products,
  COUNT(*) FILTER (WHERE unit_type = 'weight') AS weight_products,
  COUNT(*) FILTER (WHERE unit_type = 'volume') AS volume_products,
  COUNT(*) FILTER (WHERE unit_type = 'bundle') AS bundle_products,
  COUNT(*) AS total_products
FROM public.products;
