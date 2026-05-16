-- Canonical migration 0003: release-prep catalog cleanup
-- Objective: keep only the curated 62 active products for current release.
-- Rule: keep latest active row per normalized product name, then deactivate
-- any remaining active product mapped to category "Ritual Ingredients".

BEGIN;

-- Normalize product names to make dedupe deterministic.
UPDATE public.products
SET name = BTRIM(name),
    updated_at = NOW()
WHERE name IS NOT NULL
  AND name <> BTRIM(name);

-- Keep newest active row per name; deactivate older active duplicates.
WITH ranked_active AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(name))
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.products
  WHERE COALESCE(is_active, true) = true
    AND NULLIF(BTRIM(name), '') IS NOT NULL
)
UPDATE public.products p
SET is_active = false,
    updated_at = NOW()
FROM ranked_active r
WHERE p.id = r.id
  AND r.rn > 1
  AND COALESCE(p.is_active, true) = true;

-- Deactivate Ritual Ingredients from active storefront/POS catalog.
UPDATE public.products p
SET is_active = false,
    updated_at = NOW()
WHERE COALESCE(p.is_active, true) = true
  AND (
    LOWER(BTRIM(COALESCE(p.category, ''))) = 'ritual ingredients'
    OR EXISTS (
      SELECT 1
      FROM public.categories c
      WHERE c.id = p.category_id
        AND LOWER(BTRIM(COALESCE(c.name_en, ''))) = 'ritual ingredients'
    )
  );

-- Keep category text in sync for active rows where category_id is linked.
UPDATE public.products p
SET category = c.name_en,
    updated_at = NOW()
FROM public.categories c
WHERE p.category_id = c.id
  AND COALESCE(p.is_active, true) = true
  AND COALESCE(p.category, '') <> COALESCE(c.name_en, '');

-- Mark Ritual Ingredients category inactive to avoid accidental reuse in UI.
UPDATE public.categories
SET is_active = false,
    updated_at = NOW()
WHERE LOWER(BTRIM(COALESCE(name_en, ''))) = 'ritual ingredients';

-- Guardrail: do not allow duplicate active product names going forward.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_active_name_unique
  ON public.products ((LOWER(BTRIM(name))))
  WHERE COALESCE(is_active, true) = true
    AND NULLIF(BTRIM(name), '') IS NOT NULL;

COMMIT;
