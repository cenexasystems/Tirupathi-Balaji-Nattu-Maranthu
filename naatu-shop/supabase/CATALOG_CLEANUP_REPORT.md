# Catalog Cleanup + Migration Consistency Report

## 1) Runtime Data Sources (current app)
- Storefront/POS/Admin products: `public.products` via `src/store/store.ts`
- Checkout/POS order creation: RPC `public.create_order_with_stock`
- Dashboard analytics: `public.orders` + `public.order_items` (with JSON fallback from `orders.items`)
- Category/tag management: `public.categories` + `public.health_tags`

## 2) Consistent vs Inconsistent SQL Artifacts

### Consistent (release-safe)
- `supabase/migrations/20260426_0001_canonical_hardening.sql`
- `supabase/migrations/20260426_0002_order_items_atomic_order.sql`
- `supabase/migrations/20260427_0003_catalog_cleanup_release_prep.sql`

### Inconsistent / legacy (do not run for production cleanup)
- `seed_products.sql`
- `COMPLETE_SETUP.sql`
- `supabase_schema.sql`
- `generateProducts.js-output`
- `generateProducts.cjs`

Reason: legacy files are additive mock/demo seed paths and can inflate/duplicate catalog rows.

## 3) Live Catalog Evidence Used For Cleanup Rule
- Active rows before cleanup: 199
- Unique active names before cleanup: 79
- Duplicate pattern: 40 names repeated 4x
- Deterministic rule outcome:
  - keep newest active row per product name => 79
  - deactivate category `Ritual Ingredients` => 62 active rows

## 4) Manual SQL Validation Queries (post-migration)

```sql
-- Expected: 62
select count(*) as active_products
from public.products
where coalesce(is_active, true) = true;

-- Expected: 62 (no duplicate active names)
select count(distinct lower(btrim(name))) as unique_active_names
from public.products
where coalesce(is_active, true) = true
  and nullif(btrim(name), '') is not null;

-- Expected: 0
select count(*) as active_ritual_ingredients
from public.products
where coalesce(is_active, true) = true
  and lower(btrim(coalesce(category, ''))) = 'ritual ingredients';

-- Optional category breakdown sanity check
select category, count(*)
from public.products
where coalesce(is_active, true) = true
group by category
order by category;
```

## 5) Operational Note
- Product "delete" in admin has been converted to soft deactivate (`is_active = false`) to protect order history and analytics integrity.
