Migration deployment instructions

Overview
- Purpose: Add `order_type`, manual discount fields, `order_items.is_manual`, and extend `create_order_with_stock` RPC.
- File: `naatu-shop/supabase/migrations/20260526_0014_request_manual_sales.sql`

Pre-deploy checklist
1. Run on a staging copy of the production DB first.
2. Take a DB dump/backup before applying.
3. Ensure application clients (frontend) are deployed together or are backward-compatible.
4. Verify no long-running transactions are active.

How to apply (Supabase Console)
1. Open the Supabase project and go to SQL Editor.
2. Copy the contents of `20260526_0014_request_manual_sales.sql` and run it.
3. Confirm scripts complete without errors.

How to apply (psql)
1. Export the SQL file to the DB host and run:

```bash
psql "${DATABASE_URL}" -f 20260526_0014_request_manual_sales.sql
```

Rollback plan
- This migration changes table schemas and RPC signatures; rollbacks are non-trivial.
- Recommended: restore DB from the backup snapshot taken before applying.

Post-deploy verification
1. Run a checkout (online_request) flow and confirm `orders.order_type = 'online_request'`.
2. Run a POS bill with manual items; confirm `orders.order_type = 'pos_sale'` or `manual_sale`, `order_items.is_manual` set, and `orders.manual_discount_amount` persisted.
3. Confirm `create_order_with_stock` RPC still works for existing clients; if not, ensure clients are updated.
4. Validate `coupons.usage_count` increments when a coupon is used.

Notes & Risks
- The migration updates the RPC signature — don't run on production until frontend changes are deployed unless you have a compatibility layer.
- If you want, I can run the SQL in your Supabase project if you provide access (service role key or a CI pipeline token). Avoid sharing secrets in chat; instead add the SQL via the Supabase UI or provide temporary access.

Contact
- If you'd like, I can open a PR with this migration description and the checklist, or help run the migration once you provide the preferred deployment method.
