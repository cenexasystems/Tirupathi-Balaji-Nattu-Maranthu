import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type ProductVariant = {
  id: string
  productId: string
  variantName: string
  sku: string | null
  price: number
  stock: number
  isActive: boolean
  sortOrder: number
}

const VARIANT_COLS = 'id, product_id, variant_name, sku, price, stock, is_active, sort_order'

function mapVariant(r: Record<string, unknown>): ProductVariant {
  return {
    id:          String(r.id || ''),
    productId:   String(r.product_id || ''),
    variantName: String(r.variant_name || ''),
    sku:         r.sku ? String(r.sku) : null,
    price:       Number(r.price ?? 0),
    stock:       Number(r.stock ?? 0),
    isActive:    r.is_active !== false,
    sortOrder:   Number(r.sort_order ?? 0),
  }
}

export async function fetchAllVariants(): Promise<{ data: ProductVariant[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: null }

  const { data, error } = await supabase
    .from('product_variants')
    .select(VARIANT_COLS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return { data: [], error: error.message }
  return {
    data: (data || []).map(r => mapVariant(r as Record<string, unknown>)),
    error: null,
  }
}

export async function fetchVariantsByProduct(productId: string): Promise<ProductVariant[]> {
  if (!isSupabaseConfigured) return []

  const { data } = await supabase
    .from('product_variants')
    .select(VARIANT_COLS)
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return (data || []).map(r => mapVariant(r as Record<string, unknown>))
}
