import { createLocalOrder } from '../lib/ordersFallback'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { StructuredOrderItem } from '../lib/retail'

type CreateOrderInput = {
  customerName: string
  phone: string
  address: string
  items: StructuredOrderItem[]
  shipping: number
  status?: string
  orderMode?: 'online' | 'offline'
}

type CreatedOrder = {
  orderId: string
  invoiceNo: string
  createdAt: string
}

export const createOrderWithStock = async (input: CreateOrderInput): Promise<CreatedOrder> => {
  const customerName = input.customerName.trim() || 'Customer'
  const phone = input.phone.trim()
  const address = input.address.trim()
  const shipping = Number(input.shipping || 0)
  const status = input.status || 'pending'
  const orderMode = input.orderMode || 'online'

  if (!isSupabaseConfigured) {
    if (!import.meta.env.DEV) {
      throw new Error('Supabase is required to create orders in production')
    }

    const subtotal = input.items.reduce((sum, item) => sum + Number(item.line_total || 0), 0)
    const total = subtotal + shipping

    const local = createLocalOrder({
      userId: null,
      customerName,
      phone,
      address,
      items: input.items.map((item) => ({
        id: item.product_id,
        product_id: item.product_id,
        name: item.name,
        nameTa: item.tamil_name,
        tamil_name: item.tamil_name,
        price: item.base_price,
        offerPrice: null,
        qty: item.quantity,
        quantity: item.quantity,
        unit: item.unit,
        unit_type: item.unit_type,
        base_quantity: item.base_quantity,
        base_price: item.base_price,
        line_total: item.line_total,
        image: item.image_url,
        image_url: item.image_url,
      })),
      subtotal,
      shipping,
      total,
    })

    return {
      orderId: local.id,
      invoiceNo: local.invoice_no,
      createdAt: local.created_at,
    }
  }

  // Try new RPC signature (with p_order_mode) — fall back to old signature gracefully
  let data: unknown = null
  let error: unknown = null

  const newRpcResult = await supabase.rpc('create_order_with_stock', {
    p_customer_name: customerName,
    p_phone: phone,
    p_address: address,
    p_items: input.items,
    p_shipping: shipping,
    p_status: status,
    p_order_mode: orderMode,
  })
  data = newRpcResult.data
  error = newRpcResult.error

  // If new signature failed (migration not run yet), try old signature
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: string }).message)
    if (msg.includes('p_order_mode') || msg.includes('argument')) {
      const fallbackResult = await supabase.rpc('create_order_with_stock', {
        p_customer_name: customerName,
        p_phone: phone,
        p_address: address,
        p_items: input.items,
        p_shipping: shipping,
        p_status: status,
      })
      data = fallbackResult.data
      error = fallbackResult.error

      // Best-effort: set order_mode on the created order via direct update
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data
        if (row?.order_id) {
          await supabase
            .from('orders')
            .update({ order_mode: orderMode })
            .eq('id', row.order_id)
        }
      }
    }
  }

  if (error) {
    throw error
  }

  const row = Array.isArray(data) ? (data as unknown[])[0] : data
  if (!row || typeof row !== 'object' || !('order_id' in row) || !('invoice_no' in row)) {
    throw new Error('Order RPC returned an invalid payload')
  }

  return {
    orderId: String((row as Record<string, unknown>).order_id),
    invoiceNo: String((row as Record<string, unknown>).invoice_no),
    createdAt: new Date().toISOString(),
  }
}
