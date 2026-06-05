-- ═══════════════════════════════════════════════════════════════════
-- Migration 0022: Complete catalog price update
-- Safe to re-run. Updates both products.price (simple) and
-- product_variants.price (variant rows). p.id::text cast used
-- because products.id is UUID and product_variants.product_id is TEXT.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- POOJA ITEMS
-- ─────────────────────────────────────────────────────────────────

-- KUNGUMAM — all sizes ₹20
UPDATE public.product_variants pv SET price = 20
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) = 'kungumam' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=20 WHERE LOWER(name)='kungumam' AND is_active=true;

-- KARPOORAM
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) IN ('25g')  THEN 40
    WHEN LOWER(pv.size_label) IN ('50g')  THEN 70
    WHEN LOWER(pv.size_label) IN ('250g') THEN 350
    WHEN LOWER(pv.size_label) IN ('500g') THEN 650
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) IN ('karpooram','karpuram') AND p.is_active=true AND pv.is_active=true;

-- VIBHOOTHI — SITHANATHAN
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50g'  THEN 20
    WHEN LOWER(pv.size_label) = '125g' THEN 35
    WHEN LOWER(pv.size_label) = '250g' THEN 70
    WHEN LOWER(pv.size_label) = '500g' THEN 95
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) = 'vibhoothi'
  AND LOWER(pv.variant_name) LIKE '%sithanathan%'
  AND p.is_active=true AND pv.is_active=true;

-- VIBHOOTHI — BASKARAN
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '125g' THEN 40
    WHEN LOWER(pv.size_label) = '250g' THEN 60
    WHEN LOWER(pv.size_label) = '500g' THEN 100
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) = 'vibhoothi'
  AND LOWER(pv.variant_name) LIKE '%baskaran%'
  AND p.is_active=true AND pv.is_active=true;

-- AGARBATTI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.variant_name) LIKE '%cycle%'   THEN 55
    WHEN LOWER(pv.variant_name) LIKE '%z black%' THEN 60
    WHEN LOWER(pv.variant_name) LIKE '%bindhu%'  THEN 70
    WHEN LOWER(pv.variant_name) LIKE '%miracle%' THEN 100
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) = 'agarbatti' AND p.is_active=true AND pv.is_active=true;

-- NAVAGRAHA BIT
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.variant_name) LIKE '%poly%' THEN 220
    WHEN LOWER(pv.variant_name) LIKE '%cotton%' THEN 380
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) LIKE '%navagraha bit%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=220 WHERE LOWER(name) LIKE '%navagraha bit%' AND is_active=true;

-- SANDHANAM
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '100g' THEN 60
    WHEN LOWER(pv.size_label) = '250g' THEN 150
    WHEN LOWER(pv.size_label) = '500g' THEN 300
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) = 'sandhanam' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=60 WHERE LOWER(name)='sandhanam' AND is_active=true;

-- SPECIAL SANDHANAM
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '100g' THEN 80
    WHEN LOWER(pv.size_label) = '250g' THEN 200
    WHEN LOWER(pv.size_label) = '500g' THEN 400
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) LIKE '%special sandhanam%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=80 WHERE LOWER(name) LIKE '%special sandhanam%' AND is_active=true;

-- PANCHAGAVYAM / PANCHAKAVYAM
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.variant_name) LIKE '%liquid%' THEN 40
    WHEN LOWER(pv.variant_name) LIKE '%vilak%'  THEN 120
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) LIKE '%pancha%yam%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=40 WHERE LOWER(name) LIKE '%pancha%yam%' AND is_active=true;

-- DEEPAM THIRI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.variant_name) LIKE '%cotton%' THEN 30
    WHEN LOWER(pv.variant_name) LIKE '%thread%' THEN 10
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) LIKE '%deepam thiri%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=30 WHERE LOWER(name) LIKE '%deepam thiri%' AND is_active=true;

-- KOLAMAVU  ₹30
UPDATE public.products SET price=30 WHERE LOWER(name) IN ('kolamavu','kolamaavu') AND is_active=true;

-- ─────────────────────────────────────────────────────────────────
-- HERBAL POWDERS
-- ─────────────────────────────────────────────────────────────────

-- MANJAL PODI / MANJA PODI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50g'  THEN 15
    WHEN LOWER(pv.size_label) = '100g' THEN 30
    WHEN LOWER(pv.size_label) = '250g' THEN 75
    WHEN LOWER(pv.size_label) = '500g' THEN 150
    WHEN LOWER(pv.size_label) = '1kg'  THEN 300
    ELSE pv.price END
  FROM public.products p WHERE p.id::text = pv.product_id
  AND LOWER(p.name) LIKE '%manj%l podi%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=15 WHERE LOWER(name) LIKE '%manj%l podi%' AND is_active=true;

-- Single-size herbal powders (50g price)
UPDATE public.products SET price=40 WHERE LOWER(name) LIKE '%thulasi podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=40 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%thulasi podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=35 WHERE LOWER(name) LIKE '%veppalai podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=35 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%veppalai podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=35 WHERE LOWER(name) LIKE '%vendhayam podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=35 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%vendhayam podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=40 WHERE LOWER(name) LIKE '%omam podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=40 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%omam podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=70 WHERE LOWER(name) LIKE '%ashwagandha podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=70 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%ashwagandha podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=50 WHERE LOWER(name) LIKE '%sukku podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=50 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%sukku podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=70 WHERE LOWER(name) LIKE '%chitharathai podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=70 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%chitharathai podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=50 WHERE LOWER(name) LIKE '%athimathuram podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=50 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%athimathuram podi%' AND p.is_active=true AND pv.is_active=true;

-- Thripala / Tripala / Thiripala podi 50g ₹40 (packet) and Box ₹65
UPDATE public.products SET price=40 WHERE LOWER(name) LIKE '%thripala podi%' OR LOWER(name) LIKE '%tripala podi%' OR LOWER(name) LIKE '%thiripala podi%' AND is_active=true;
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.variant_name) LIKE '%box%'    THEN 65
    WHEN LOWER(pv.variant_name) LIKE '%packet%' THEN 35
    ELSE 40 END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND (LOWER(p.name) LIKE '%thripala%' OR LOWER(p.name) LIKE '%tripala%' OR LOWER(p.name) LIKE '%thiripala%')
  AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=35 WHERE LOWER(name) LIKE '%kaduk%ai podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=35 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%kaduk%ai podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=70 WHERE LOWER(name) LIKE '%kasay%m podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=70 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%kasay%m podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=70 WHERE LOWER(name) LIKE '%thipli kas%yam podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=70 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%thipli kas%yam podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=200 WHERE LOWER(name) LIKE '%sugar diabetes podi%' AND is_active=true;
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.variant_name) LIKE '%packet%' THEN 200
    WHEN LOWER(pv.variant_name) LIKE '%box%'    THEN 200
    ELSE 200 END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%sugar diabetes podi%' AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=40 WHERE LOWER(name) LIKE '%amala podi%' OR LOWER(name) LIKE '%amla podi%' AND is_active=true;
UPDATE public.product_variants pv SET price=40 FROM public.products p WHERE p.id::text=pv.product_id
  AND (LOWER(p.name) LIKE '%amala podi%' OR LOWER(p.name) LIKE '%amla podi%') AND p.is_active=true AND pv.is_active=true;

UPDATE public.products SET price=50 WHERE LOWER(name) LIKE '%vallarai podi%' AND is_active=true;

UPDATE public.products SET price=40 WHERE LOWER(name) LIKE '%murungai elai podi%' AND is_active=true;
UPDATE public.products SET price=95 WHERE LOWER(name) LIKE '%murungai seed%' OR LOWER(name) LIKE '%murungai vidhai%' AND is_active=true;
UPDATE public.products SET price=90 WHERE LOWER(name) LIKE '%murungai poo%' AND is_active=true;

UPDATE public.products SET price=60 WHERE LOWER(name) LIKE '%sathavari podi%' OR LOWER(name) LIKE '%shatavari podi%' AND is_active=true;
UPDATE public.products SET price=40 WHERE LOWER(name) LIKE '%kandankathiri podi%' AND is_active=true;
UPDATE public.products SET price=40 WHERE LOWER(name) LIKE '%nithyakalyani podi%' AND is_active=true;

-- ─────────────────────────────────────────────────────────────────
-- OILS
-- ─────────────────────────────────────────────────────────────────

-- VEPPA ENNAI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50ml'  THEN 33
    WHEN LOWER(pv.size_label) = '100ml' THEN 60
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%veppa ennai%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=33 WHERE LOWER(name) LIKE '%veppa ennai%' AND is_active=true;

-- NALLA ENNAI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '100ml' THEN 45
    WHEN LOWER(pv.size_label) = '250ml' THEN 75
    WHEN LOWER(pv.size_label) = '500ml' THEN 165
    WHEN LOWER(pv.size_label) = '1l'    THEN 330
    WHEN LOWER(pv.size_label) = '1 l'   THEN 330
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%nalla ennai%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=45 WHERE LOWER(name) LIKE '%nalla ennai%' AND is_active=true;

-- VILAKKENNAI / VILAKENNAI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50ml'  THEN 20
    WHEN LOWER(pv.size_label) = '100ml' THEN 40
    WHEN LOWER(pv.size_label) = '250ml' THEN 75
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%vilak%ennai%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=20 WHERE LOWER(name) LIKE '%vilak%ennai%' AND is_active=true;

-- THENGA ENNAI / THENGAI ENNAI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '250ml' THEN 75
    WHEN LOWER(pv.size_label) = '500ml' THEN 180
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%thenga%ennai%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=75 WHERE LOWER(name) LIKE '%thenga%ennai%' AND is_active=true;

-- SANTHANATHI OIL
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '100ml' THEN 100
    WHEN LOWER(pv.size_label) = '500ml' THEN 480
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%santhanathi%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=100 WHERE LOWER(name) LIKE '%santhanathi%' AND is_active=true;

-- THE MARTHANDAM
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50ml'  THEN 40
    WHEN LOWER(pv.size_label) = '100ml' THEN 65
    WHEN LOWER(pv.size_label) = '200ml' THEN 110
    WHEN LOWER(pv.size_label) = '500ml' THEN 215
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%marthandam%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=40 WHERE LOWER(name) LIKE '%marthandam%' AND is_active=true;

-- ─────────────────────────────────────────────────────────────────
-- SPICES & GROCERY
-- ─────────────────────────────────────────────────────────────────

-- KALKANDU  100g ₹20
UPDATE public.products SET price=20 WHERE LOWER(name)='kalkandu' AND is_active=true;
UPDATE public.product_variants pv SET price=20 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name)='kalkandu' AND p.is_active=true AND pv.is_active=true;

-- ELAKKAI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '10g'  THEN 50
    WHEN LOWER(pv.size_label) = '100g' THEN 450
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name)='elakkai' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=50 WHERE LOWER(name)='elakkai' AND is_active=true;

-- LAVANGAM
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50g'  THEN 100
    WHEN LOWER(pv.size_label) = '100g' THEN 200
    WHEN LOWER(pv.size_label) = '250g' THEN 500
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name)='lavangam' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=100 WHERE LOWER(name)='lavangam' AND is_active=true;

-- PATTAI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50g'  THEN 60
    WHEN LOWER(pv.size_label) = '100g' THEN 120
    WHEN LOWER(pv.size_label) = '250g' THEN 300
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name)='pattai' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=60 WHERE LOWER(name)='pattai' AND is_active=true;

-- ELLU
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50g'  THEN 20
    WHEN LOWER(pv.size_label) = '100g' THEN 40
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name)='ellu' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=20 WHERE LOWER(name)='ellu' AND is_active=true;

-- JATHIKAI / JATHIKKAI
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '10g'  THEN 50
    WHEN LOWER(pv.size_label) = '50g'  THEN 250
    WHEN LOWER(pv.size_label) = '100g' THEN 400
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%jathik%ai%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=50 WHERE LOWER(name) LIKE '%jathik%ai%' AND is_active=true;

-- KARUSEERAKAM
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50g'  THEN 30
    WHEN LOWER(pv.size_label) = '100g' THEN 60
    WHEN LOWER(pv.size_label) = '250g' THEN 150
    WHEN LOWER(pv.size_label) = '500g' THEN 300
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name)='karuseerakam' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=30 WHERE LOWER(name)='karuseerakam' AND is_active=true;

-- VASAMBU
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '50g'  THEN 40
    WHEN LOWER(pv.size_label) = '100g' THEN 80
    WHEN LOWER(pv.size_label) = '250g' THEN 200
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name)='vasambu' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=40 WHERE LOWER(name)='vasambu' AND is_active=true;

-- PACHA ARISI / PACHAARUSI  1kg ₹75
UPDATE public.products SET price=75 WHERE LOWER(name) IN ('pacha arisi','pachaarusi','pacharisi') AND is_active=true;
UPDATE public.product_variants pv SET price=75 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) IN ('pacha arisi','pachaarusi','pacharisi') AND p.is_active=true AND pv.is_active=true;

-- ULUNDHU WHITE
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '500g' THEN 90
    WHEN LOWER(pv.size_label) = '1kg'  THEN 180
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name)='ulundhu white' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=90 WHERE LOWER(name)='ulundhu white' AND is_active=true;

-- ULUNDHU BLACK
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '500g' THEN 80
    WHEN LOWER(pv.size_label) = '1kg'  THEN 160
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name)='ulundhu black' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=80 WHERE LOWER(name)='ulundhu black' AND is_active=true;

-- KADALAI PARUPPU  1kg ₹140
UPDATE public.products SET price=140 WHERE LOWER(name) LIKE '%kadalai paruppu%' AND is_active=true;
UPDATE public.product_variants pv SET price=140 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%kadalai paruppu%' AND p.is_active=true AND pv.is_active=true;

-- PASI PAYIRU  1kg ₹130
UPDATE public.products SET price=130 WHERE LOWER(name) LIKE '%pasi payiru%' AND is_active=true;
UPDATE public.product_variants pv SET price=130 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%pasi payiru%' AND p.is_active=true AND pv.is_active=true;

-- ─────────────────────────────────────────────────────────────────
-- OTHER PRODUCTS
-- ─────────────────────────────────────────────────────────────────

-- NEI DODLA
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '100g'  THEN 100
    WHEN LOWER(pv.size_label) = '200g'  THEN 190
    WHEN LOWER(pv.size_label) = '500ml' THEN 410
    WHEN LOWER(pv.size_label) = '1l'    THEN 800
    WHEN LOWER(pv.size_label) = '1 l'   THEN 800
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%nei dodla%' AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=100 WHERE LOWER(name) LIKE '%nei dodla%' AND is_active=true;

-- PANNER / PANNEER
UPDATE public.product_variants pv SET price = CASE
    WHEN LOWER(pv.size_label) = '200ml' THEN 20
    WHEN LOWER(pv.size_label) = '500ml' THEN 30
    WHEN LOWER(pv.size_label) = '1l'    THEN 40
    WHEN LOWER(pv.size_label) = '1 l'   THEN 40
    ELSE pv.price END
  FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) IN ('panneer','panner') AND p.is_active=true AND pv.is_active=true;
UPDATE public.products SET price=20 WHERE LOWER(name) IN ('panneer','panner') AND is_active=true;

-- SPECIAL PANNER / SPECIAL PANNEER
UPDATE public.products SET price=80 WHERE LOWER(name) LIKE '%special pann%' AND is_active=true;
UPDATE public.product_variants pv SET price=80 FROM public.products p WHERE p.id::text=pv.product_id
  AND LOWER(p.name) LIKE '%special pann%' AND p.is_active=true AND pv.is_active=true;

-- POORNAHUTHI SAAMAN  1kg ₹400
UPDATE public.products SET price=400 WHERE LOWER(name) LIKE '%poornahuthi%' AND is_active=true;

-- WEDDING RITUAL PACK  ₹2000
UPDATE public.products SET price=2000 WHERE LOWER(name) LIKE '%wedding%ritual%' AND is_active=true;

-- GANAPATHI NAVAGRAGAM OMAM SET  ₹1500
UPDATE public.products SET price=1500 WHERE LOWER(name) LIKE '%ganapathi%' AND is_active=true;

-- MUGURTHA IYER SET  ₹1200
UPDATE public.products SET price=1200 WHERE LOWER(name) LIKE '%mugurtha%iyer%' AND is_active=true;

-- ─────────────────────────────────────────────────────────────────
-- ESHA HERBALS
-- ─────────────────────────────────────────────────────────────────
UPDATE public.products SET price=150 WHERE LOWER(name) LIKE '%seeka powder%' OR LOWER(name) LIKE '%sheekai%' AND is_active=true;
UPDATE public.products SET price=70  WHERE LOWER(name) LIKE '%bathing powder%' AND is_active=true;
UPDATE public.products SET price=50  WHERE LOWER(name) LIKE '%face pack%' OR LOWER(name) LIKE '%facepack%' AND is_active=true;

-- ─────────────────────────────────────────────────────────────────
-- Verify updated prices
-- ─────────────────────────────────────────────────────────────────
SELECT p.name, p.price AS product_price,
       pv.variant_name, pv.size_label, pv.price AS variant_price
  FROM public.products p
  LEFT JOIN public.product_variants pv ON pv.product_id = p.id::text AND pv.is_active=true
 WHERE p.is_active = true
 ORDER BY p.name, pv.sort_order
 LIMIT 100;
