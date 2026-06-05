-- ═══════════════════════════════════════════════════════════════════
-- Migration 0020: Set image_url for known products
--
-- Maps local static images (/assets/images/*.webp) to product rows
-- using case-insensitive ILIKE name matching.
-- Only updates rows where image_url is NULL or still a placeholder path.
-- Safe to re-run (idempotent).
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN

  -- ── Pooja Items ────────────────────────────────────────────────
  UPDATE public.products SET image_url = '/assets/images/Kungumam.webp'
    WHERE name ILIKE '%kungumam%' AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Kungumam: % rows', updated_count;

  UPDATE public.products SET image_url = '/assets/images/Thiru Neer.webp'
    WHERE (name ILIKE '%vibhoothi%' OR name ILIKE '%vibhuti%' OR name ILIKE '%thiru neer%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Karpooram.webp'
    WHERE name ILIKE '%karpooram%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Agarbatti.webp'
    WHERE name ILIKE '%agarbatti%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Sandhanam.webp'
    WHERE name ILIKE '%sandhanam%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Poo varisai.webp'
    WHERE name ILIKE '%poo varisai%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Panchagavyam.webp'
    WHERE name ILIKE '%panchagavyam%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Navagraha Bit.webp'
    WHERE name ILIKE '%navagraha%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/kutthu vilakku.webp'
    WHERE (name ILIKE '%kuthu vilakku%' OR name ILIKE '%kutthu vilakku%' OR name ILIKE '%vilakku%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/swami padam.webp'
    WHERE name ILIKE '%swami padam%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/thamarai.webp'
    WHERE name ILIKE '%thamarai%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Deepam Thiri.webp'
    WHERE name ILIKE '%deepam thiri%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/kolamaavu.webp'
    WHERE (name ILIKE '%kolamavu%' OR name ILIKE '%kolamaavu%' OR name ILIKE '%kolam%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  -- ── Herbal Powders ─────────────────────────────────────────────
  UPDATE public.products SET image_url = '/assets/images/Manjal Podi.webp'
    WHERE name ILIKE '%manjal podi%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Thulasi podi.webp'
    WHERE (name ILIKE '%thulasi podi%' OR name ILIKE '%tulsi podi%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Veppalai Podi.webp'
    WHERE name ILIKE '%veppalai podi%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Vendhayam Podi.webp'
    WHERE (name ILIKE '%vendhayam podi%' OR name ILIKE '%fenugreek podi%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Omam Podi.webp'
    WHERE name ILIKE '%omam podi%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Seeragam Podi.webp'
    WHERE name ILIKE '%seeragam podi%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Milagu Podi.webp'
    WHERE name ILIKE '%milagu podi%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Ashwagandha Podi.webp'
    WHERE (name ILIKE '%ashwagandha%' OR name ILIKE '%aswagandha%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Amala Podi.webp'
    WHERE (name ILIKE '%amla podi%' OR name ILIKE '%amala podi%' OR name ILIKE '%nellikai podi%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Triphala Podi.webp'
    WHERE (name ILIKE '%triphala%' OR name ILIKE '%thirikadugam%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Brahmi Podi.webp'
    WHERE name ILIKE '%brahmi podi%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Murungai Podi.webp'
    WHERE (name ILIKE '%murungai podi%' OR name ILIKE '%moringa podi%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Sathavari Podi.webp'
    WHERE (name ILIKE '%sathavari%' OR name ILIKE '%shatavari%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Kandankathari Podi.webp'
    WHERE name ILIKE '%kandankathiri%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Nithyakalyani Podi.webp'
    WHERE name ILIKE '%nithyakalyani%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  -- ── Herbal Oils ────────────────────────────────────────────────
  UPDATE public.products SET image_url = '/assets/images/Veppa Ennai.webp'
    WHERE (name ILIKE '%veppa ennai%' OR name ILIKE '%neem oil%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Nalla Ennai.webp'
    WHERE name ILIKE '%nalla ennai%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Vilakkennai.webp'
    WHERE (name ILIKE '%vilakkennai%' OR name ILIKE '%castor oil%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Thengai Ennai.webp'
    WHERE (name ILIKE '%thengai ennai%' OR name ILIKE '%coconut oil%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Omam ennai.webp'
    WHERE name ILIKE '%omam ennai%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Brahmi Ennai.webp'
    WHERE name ILIKE '%brahmi ennai%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Milagu Ennai.webp'
    WHERE name ILIKE '%milagu ennai%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Pungam Ennai.webp'
    WHERE name ILIKE '%pungam ennai%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  -- ── Spices & Condiments ───────────────────────────────────────
  UPDATE public.products SET image_url = '/assets/images/Kalkandu.webp'
    WHERE (name ILIKE '%kalkandu%' OR name ILIKE '%rock candy%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Elakkai.webp'
    WHERE (name ILIKE '%elakkai%' OR name ILIKE '%cardamom%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Pattai.webp'
    WHERE (name ILIKE '%pattai%' OR name ILIKE '%cinnamon%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Kothamalli.webp'
    WHERE name ILIKE '%kothamalli%'
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

  UPDATE public.products SET image_url = '/assets/images/Ellu.webp'
    WHERE (name ILIKE '%ellu%' OR name ILIKE '%sesame%')
      AND (image_url IS NULL OR image_url NOT LIKE '/assets/%');

END $$;

-- ─────────────────────────────────────────────────────────────────
-- IMAGE MAPPING REPORT
-- Run this SELECT after the migration to see mapping results
-- ─────────────────────────────────────────────────────────────────
SELECT
  name,
  category,
  CASE
    WHEN image_url LIKE '/assets/%' THEN '✓ mapped'
    WHEN image_url LIKE 'https://%storage%' THEN '✓ storage'
    ELSE '✗ unmapped'
  END AS image_status,
  image_url
FROM public.products
WHERE is_active = true
ORDER BY
  CASE
    WHEN image_url LIKE '/assets/%' THEN 1
    WHEN image_url LIKE 'https://%storage%' THEN 2
    ELSE 3
  END,
  category,
  name;
