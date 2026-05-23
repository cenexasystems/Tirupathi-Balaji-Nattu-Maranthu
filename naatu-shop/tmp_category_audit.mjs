import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const catsRes = await sb.from('categories').select('id,name_en,name_ta,is_active,sort_order').order('sort_order').order('id')
if (catsRes.error) {
  console.log('CAT_QUERY_ERROR', catsRes.error.message)
  process.exit(0)
}

console.log('CATEGORY_ROWS', catsRes.data.length)
for (const c of catsRes.data) {
  console.log('CAT', c.id, '|', c.name_en, '| active=', c.is_active, '| sort=', c.sort_order)
}

const prodRes = await sb
  .from('products')
  .select('id,name,category,category_id,is_active,created_at')
  .order('id')

if (prodRes.error) {
  console.log('PROD_QUERY_ERROR', prodRes.error.message)
  process.exit(0)
}

const active = prodRes.data.filter((p) => p.is_active !== false)
const unmapped = active.filter((p) => p.category_id == null)
console.log('ACTIVE_PRODUCTS', active.length)
console.log('ACTIVE_UNMAPPED_CATEGORY_ID', unmapped.length)
console.log('UNMAPPED_SAMPLE', unmapped.slice(0, 20).map((p) => `${p.id}:${p.name}:${p.category}`).join(' | '))

const catMap = new Map(catsRes.data.map((c) => [c.id, c.name_en]))
const mismatched = active.filter((p) => p.category_id != null && catMap.get(p.category_id) && catMap.get(p.category_id) !== p.category)
console.log('ACTIVE_MISMATCHED_CATEGORY_TEXT', mismatched.length)
console.log('MISMATCHED_SAMPLE', mismatched.slice(0, 20).map((p) => `${p.id}:${p.name}:cat=${p.category}:cat_id_name=${catMap.get(p.category_id)}`).join(' | '))
