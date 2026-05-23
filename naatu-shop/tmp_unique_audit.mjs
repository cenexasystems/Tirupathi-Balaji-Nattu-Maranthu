import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const { data, error } = await sb
  .from('products')
  .select('id,name,category,is_active,created_at')

if (error) {
  console.log('QUERY_ERROR', error.message)
  process.exit(0)
}

const active = data.filter((r) => r.is_active !== false)

const byName = new Map()
for (const r of active) {
  const key = String(r.name || '').trim().toLowerCase()
  if (!key) continue
  if (!byName.has(key)) byName.set(key, [])
  byName.get(key).push(r)
}

console.log('ACTIVE_ROWS', active.length)
console.log('UNIQUE_NAMES', byName.size)

const uniqueByCategory = new Map()
for (const [name, rows] of byName.entries()) {
  const latest = rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
  const cat = String(latest.category || '')
  uniqueByCategory.set(cat, (uniqueByCategory.get(cat) || 0) + 1)
}
console.log('UNIQUE_BY_CATEGORY', [...uniqueByCategory.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join(' | '))

const repeated = [...byName.entries()].filter(([, rows]) => rows.length > 1)
console.log('REPEATED_NAME_KEYS', repeated.length)
console.log('REPEATED_NAME_SAMPLES', repeated.slice(0, 30).map(([k, rows]) => `${k}:${rows.length}`).join(' | '))
