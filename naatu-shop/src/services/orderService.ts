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

  const { data, error } = await supabase.rpc('create_order_with_stock', {
    p_customer_name: customerName,
    p_phone: phone,
    p_address: address,
    p_items: input.items,
    p_shipping: shipping,
    p_status: status,
  })

  if (error) {
    throw error
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.order_id || !row?.invoice_no) {
    throw new Error('Order RPC returned an invalid payload')
  }

  return {
    orderId: String(row.order_id),
    invoiceNo: String(row.invoice_no),
    createdAt: new Date().toISOString(),
  }
}
