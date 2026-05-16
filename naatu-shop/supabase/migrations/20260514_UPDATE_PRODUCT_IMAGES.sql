-- ═══════════════════════════════════════════════════════════════════
-- UPDATE PRODUCT IMAGES — Run in Supabase SQL Editor after COMPLETE_SETUP.sql
-- Assigns visually relevant Unsplash images to each of the 65 products.
-- ═══════════════════════════════════════════════════════════════════

-- ── POOJA ITEMS ───────────────────────────────────────────────────

-- Kungumam (kumkum red powder)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1568214379698-8aeb8c6c6ac8?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1568214379698-8aeb8c6c6ac8?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Kungumam';

-- Vibhoothi (sacred white ash)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Vibhoothi';

-- Karpooram (camphor white crystals)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Karpooram';

-- Agarbatti (incense sticks with smoke)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1603204077167-2fa0397f5264?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1603204077167-2fa0397f5264?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Agarbatti';

-- Navagraha Bit (colorful powder bits)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Navagraha Bit';

-- Kuthu Vilakku (oil lamp / diya)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1567335743949-70f2b6b6e36d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1567335743949-70f2b6b6e36d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Kuthu Vilakku';

-- Swami Padam (deity / temple)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1518002054494-3a6f94352e68?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1518002054494-3a6f94352e68?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Swami Padam';

-- Sandhanam (sandalwood paste / sticks)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Sandhanam';

-- Thiru Neeru (sacred ash packet)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Thiru Neeru';

-- Poo Varisai (flower tray / marigolds)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1490750967868-88df5691cc3e?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1490750967868-88df5691cc3e?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Poo Varisai';

-- Panchagavyam (ritual mixture)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1512103522279-9e54d799db91?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1512103522279-9e54d799db91?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Panchagavyam';

-- Arugu Pul (dhruva grass / green grass)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Arugu Pul';

-- Thamarai (lotus flower)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1559181567-c3190ca9d713?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1559181567-c3190ca9d713?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Thamarai';

-- Deepam Thiri (cotton wicks / lamp wicks)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1550159930-40066082a4fc?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1550159930-40066082a4fc?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Deepam Thiri';

-- Kolamavu (white kolam powder / rice flour)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Kolamavu';

-- ── HERBAL POWDER ─────────────────────────────────────────────────

-- Manjal Podi (turmeric — bright yellow powder)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1615485291234-9d694218aeb5?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1615485291234-9d694218aeb5?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Manjal Podi';

-- Thulasi Podi (holy basil — green leaves)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Thulasi Podi';

-- Veppalai Podi (neem leaves — dark green)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Veppalai Podi';

-- Vendhayam Podi (fenugreek seeds — golden brown)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Vendhayam Podi';

-- Omam Podi (ajwain / carom seeds — white)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Omam Podi';

-- Seeragam Podi (cumin powder — warm brown)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Seeragam Podi';

-- Milagu Podi (black pepper powder — dark)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1599909533731-f5f6c1fbd5ff?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1599909533731-f5f6c1fbd5ff?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Milagu Podi';

-- Ashwagandha Podi (root powder — beige)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Ashwagandha Podi';

-- Amla Podi (gooseberry — greenish fruit)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1612871689552-be7ef6f50d0e?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1612871689552-be7ef6f50d0e?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Amla Podi';

-- Triphala Podi (three fruits — dark powder)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1512103522279-9e54d799db91?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1512103522279-9e54d799db91?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Triphala Podi';

-- Brahmi Podi (bacopa — small green leaves)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Brahmi Podi';

-- Murungai Podi (moringa green leaf powder)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Murungai Podi';

-- Sathavari Podi (asparagus root — whitish root)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Sathavari Podi';

-- Kandankathiri Podi (turkey berry — small berries)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Kandankathiri Podi';

-- Nithyakalyani Podi (periwinkle — purple/pink flower)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1490750967868-88df5691cc3e?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1490750967868-88df5691cc3e?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Nithyakalyani Podi';

-- ── HERBAL OIL ────────────────────────────────────────────────────

-- Veppa Ennai (neem oil — dark green)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Veppa Ennai';

-- Nalla Ennai (gingelly oil — golden amber)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Nalla Ennai';

-- Vilakkennai (castor oil — pale yellow)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Vilakkennai';

-- Thengai Ennai (coconut oil — white solid)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Thengai Ennai';

-- Omam Ennai (ajwain oil)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Omam Ennai';

-- Brahmi Ennai (hair oil — bottle with herbs)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1556760544-74068565f05c?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1556760544-74068565f05c?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Brahmi Ennai';

-- Milagu Ennai (pepper oil — dark spice oil)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Milagu Ennai';

-- Keelanelli Ennai (phyllanthus herb oil)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Keelanelli Ennai';

-- Sandal Oil (sandalwood essential oil — small dark bottle)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Sandal Oil';

-- Pungam Ennai (pongamia oil)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Pungam Ennai';

-- ── SPICES & CONDIMENTS ───────────────────────────────────────────

-- Kalkandu (rock sugar / crystalline white candy)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Kalkandu';

-- Elakkai (cardamom — green pods)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Elakkai';

-- Lavangam (cloves — dark brown buds)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1600628421060-9a851ea69c5c?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1600628421060-9a851ea69c5c?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Lavangam';

-- Pattai (cinnamon sticks — brown bark rolls)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Pattai';

-- Kothamalli (coriander seeds — round small seeds)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Kothamalli';

-- Ellu (sesame seeds — tiny white/black seeds)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Ellu';

-- Jathikai (nutmeg — brown hard nut)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1600628421060-9a851ea69c5c?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1600628421060-9a851ea69c5c?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Jathikai';

-- Sombu (fennel seeds — pale green seeds)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Sombu';

-- Kalonji (black seeds — nigella)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1599909533731-f5f6c1fbd5ff?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1599909533731-f5f6c1fbd5ff?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Kalonji';

-- Vasambu (calamus root — tan/brown dried root)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Vasambu';

-- ── GRAINS & PULSES ───────────────────────────────────────────────

-- Pacharisi (raw white rice)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Pacharisi';

-- Ulundhu (urad dal — black whole lentils)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Ulundhu';

-- Kadalai Paruppu (chana dal — yellow split peas)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1580910365198-47e5ce5a9c81?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1580910365198-47e5ce5a9c81?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Kadalai Paruppu';

-- Thovar Paruppu (toor dal — golden split dal)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Thovar Paruppu';

-- Pasi Paruppu (moong dal — green split lentils)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1546069901-5ec6a79120b0?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1546069901-5ec6a79120b0?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Pasi Paruppu';

-- ── HONEY & LIQUIDS ───────────────────────────────────────────────

-- Then (forest honey — amber golden)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Then';

-- Nei (desi ghee — golden clarified butter)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Nei';

-- Panneer (rose water — pink/clear glass bottle)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Panneer';

-- Sandal Water (clear water with sandalwood)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Sandal Water';

-- Tulsi Extract (concentrated green herbal liquid)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Tulsi Extract';

-- ── BUNDLE PACKAGES ───────────────────────────────────────────────

-- Poornahuthi Saamaan (complete ritual kit)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1512103522279-9e54d799db91?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1512103522279-9e54d799db91?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Poornahuthi Saamaan';

-- Daily Pooja Combo (daily worship items)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Daily Pooja Combo';

-- Herbal Wellness Pack (collection of herbal powders)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Herbal Wellness Pack';

-- Pazha Vagaigal Set (fruits offering — colourful fruits)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Pazha Vagaigal Set';

-- Wedding Ritual Pack (elaborate ritual spread)
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1567335743949-70f2b6b6e36d?auto=format&fit=crop&w=400&q=80',
  image = 'https://images.unsplash.com/photo-1567335743949-70f2b6b6e36d?auto=format&fit=crop&w=400&q=80'
WHERE name = 'Wedding Ritual Pack';

-- ── VERIFICATION ──────────────────────────────────────────────────
SELECT name, category, unit_type,
  CASE WHEN image_url LIKE 'https://images.unsplash.com/%' THEN 'OK' ELSE 'MISSING' END AS image_status
FROM public.products
ORDER BY sort_order;
