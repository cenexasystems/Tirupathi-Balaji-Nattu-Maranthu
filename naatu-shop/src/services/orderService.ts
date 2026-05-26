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
  orderType?: 'online_request' | 'pos_sale' | 'manual_sale'
  deliveryCharge?: number
  discountAmount?: number
  manualDiscountAmount?: number
  manualDiscountType?: 'flat' | 'percent'
  manualDiscountValue?: number
  couponCode?: string
  couponPercentage?: number
}

type CreatedOrder = {
  orderId: string
  invoiceNo: string
  createdAt: string
}

export const createOrderWithStock = async (input: CreateOrderInput): Promise<CreatedOrder> => {
  const customerName   = input.customerName.trim() || 'Customer'
  const phone          = input.phone.trim()
  const address        = input.address.trim()
  const shipping       = Number(input.shipping || 0)
  const status         = input.status || 'pending'
  const orderMode      = input.orderMode || 'online'
  const orderType      = input.orderType || (status === 'pending' && orderMode === 'online' ? 'online_request' : 'pos_sale')
  const deliveryCharge = Number(input.deliveryCharge || 0)
  const discountAmount = Number(input.discountAmount || 0)
  const manualDiscountAmount = Number(input.manualDiscountAmount || 0)
  const manualDiscountType = input.manualDiscountType || 'flat'
  const manualDiscountValue = Number(input.manualDiscountValue || 0)
  const couponCode     = input.couponCode?.trim() || null
  const couponPercentage = Number(input.couponPercentage || 0)
  const effectiveDiscount = discountAmount + manualDiscountAmount

  if (!isSupabaseConfigured) {
    if (!import.meta.env.DEV) {
      throw new Error('Supabase is required to create orders in production')
    }

    const subtotal = input.items.reduce((sum, item) => sum + Number(item.line_total || 0), 0)
    const total = Math.max(0, subtotal - effectiveDiscount + deliveryCharge + shipping)

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
      orderType,
    })

    return {
      orderId: local.id,
      invoiceNo: local.invoice_no,
      createdAt: local.created_at,
    }
  }

  // Try new RPC signature (11 params with delivery/coupon support)
  let data: unknown = null
  let error: unknown = null

  const newRpcResult = await supabase.rpc('create_order_with_stock', {
    p_customer_name:     customerName,
    p_phone:             phone,
    p_address:           address,
    p_items:             input.items,
    p_shipping:          shipping,
    p_status:            status,
    p_order_mode:        orderMode,
    p_order_type:        orderType,
    p_delivery_charge:   deliveryCharge,
    p_discount_amount:   discountAmount,
    p_manual_discount_amount: manualDiscountAmount,
    p_manual_discount_type: manualDiscountType,
    p_manual_discount_value: manualDiscountValue,
    p_coupon_code:       couponCode,
    p_coupon_percentage: couponPercentage,
  })
  data  = newRpcResult.data
  error = newRpcResult.error

  // Fallback to 7-param signature (migration 0012) if new params not recognised
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: string }).message)
    if (msg.includes('p_delivery_charge') || msg.includes('p_discount_amount') || msg.includes('p_coupon') || msg.includes('argument')) {
      const fallbackResult = await supabase.rpc('create_order_with_stock', {
        p_customer_name: customerName,
        p_phone:         phone,
        p_address:       address,
        p_items:         input.items,
        p_shipping:      shipping,
        p_status:        status,
        p_order_mode:    orderMode,
        p_order_type:    orderType,
      })
      data  = fallbackResult.data
      error = fallbackResult.error
    }
  }

  // Fallback to old 6-param signature (pre-migration 0012)
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: string }).message)
    if (msg.includes('p_order_mode') || msg.includes('argument')) {
      const legacyResult = await supabase.rpc('create_order_with_stock', {
        p_customer_name: customerName,
        p_phone:         phone,
        p_address:       address,
        p_items:         input.items,
        p_shipping:      shipping,
        p_status:        status,
      })
      data  = legacyResult.data
      error = legacyResult.error

      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data
        if (row?.order_id) {
          await supabase.from('orders').update({ order_mode: orderMode }).eq('id', row.order_id)
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
    orderId:   String((row as Record<string, unknown>).order_id),
    invoiceNo: String((row as Record<string, unknown>).invoice_no),
    createdAt: new Date().toISOString(),
  }
}
