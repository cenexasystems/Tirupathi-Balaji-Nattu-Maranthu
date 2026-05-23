import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.log('MISSING_ENV')
  process.exit(0)
}

const sb = createClient(url, key)

const { data, error } = await sb
  .from('products')
  .select('id,name,category,is_active,created_at,sort_order,unit_type,category_id')
  .order('created_at')

if (error) {
  console.log('QUERY_ERROR', error.message)
  process.exit(0)
}

const rows = data || []
const active = rows.filter((r) => r.is_active !== false)

console.log('TOTAL_ROWS', rows.length)
console.log('ACTIVE_ROWS', active.length)

const groups = new Map()
for (const r of rows) {
  const d = String(r.created_at || '').slice(0, 10)
  if (!groups.has(d)) groups.set(d, [])
  groups.get(d).push(r)
}

for (const d of [...groups.keys()].sort()) {
  const cohort = groups.get(d)
  const cats = [...new Set(cohort.map((x) => String(x.category || '')).filter(Boolean))].sort()
  console.log('COHORT', d, 'COUNT', cohort.length, 'CATS', cats.length)
  console.log('COHORT_SAMPLE', d, cohort.slice(0, 12).map((x) => x.name).join(' | '))
}

const nameCounts = new Map()
for (const r of rows) {
  const k = String(r.name || '').trim().toLowerCase()
  if (!k) continue
  nameCounts.set(k, (nameCounts.get(k) || 0) + 1)
}

const dupNames = [...nameCounts.entries()]
  .filter(([, c]) => c > 1)
  .sort((a, b) => b[1] - a[1])

console.log('DUPLICATE_NAME_KEYS', dupNames.length)
console.log('DUPLICATE_NAME_TOP', dupNames.slice(0, 30).map(([n, c]) => `${n}:${c}`).join(' | '))

const byCat = new Map()
for (const r of active) {
  const k = String(r.category || '').trim()
  byCat.set(k, (byCat.get(k) || 0) + 1)
}

console.log('ACTIVE_BY_CATEGORY', [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k}:${c}`).join(' | '))
