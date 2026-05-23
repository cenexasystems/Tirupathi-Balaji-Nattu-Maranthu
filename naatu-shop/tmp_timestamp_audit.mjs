import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const { data, error } = await sb
  .from('products')
  .select('id,name,created_at,is_active')
  .order('created_at')

if (error) {
  console.log('QUERY_ERROR', error.message)
  process.exit(0)
}

const rows = (data || []).filter((r) => r.is_active !== false)

const buckets = new Map()
for (const r of rows) {
  const k = String(r.created_at || '').slice(0, 16)
  buckets.set(k, (buckets.get(k) || 0) + 1)
}

console.log('ACTIVE_ROWS', rows.length)
console.log('TIME_BUCKETS', buckets.size)
console.log('TOP_BUCKETS', [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, c]) => `${k}:${c}`).join(' | '))

const secondBuckets = new Map()
for (const r of rows) {
  const k = String(r.created_at || '').slice(0, 19)
  secondBuckets.set(k, (secondBuckets.get(k) || 0) + 1)
}
console.log('TOP_SECOND_BUCKETS', [...secondBuckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, c]) => `${k}:${c}`).join(' | '))
