import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCartStore, useAuthStore } from '../store/store'
import { useLangStore } from '../store/langStore'
import { ArrowLeft, MessageCircle, CheckCircle, ShoppingBag } from 'lucide-react'
import { createOrderWithStock } from '../services/orderService'
import { BRAND_EN, BRAND_PHONE_DISPLAY, BRAND_WHATSAPP_LINK } from '../lib/brand'
import { PLACEHOLDER as PRODUCT_PLACEHOLDER } from '../lib/productImages'
import {
  buildStructuredOrderItem,
  formatCurrency,
  formatQuantityDisplay,
} from '../lib/retail'

const toProductId = (value: string | number): string | null => {
  const str = String(value ?? '').trim()
  return str || null
}

interface BookedOrderSnapshot {
  invoiceNo: string
  orderId: string
  name: string
  phone: string
  address: string
  itemCount: number
  total: number
}

export default function Checkout() {
  const { items, clear, total } = useCartStore()
  const { user } = useAuthStore()
  const { lang } = useLangStore()
  const navigate = useNavigate()

  const orderTotal = total()

  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [booked, setBooked] = useState<BookedOrderSnapshot | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (items.length === 0 && !booked) navigate('/cart')
    if (user) {
      setForm(f => ({
        ...f,
        name: f.name || user.name,
        phone: f.phone || user.mobile || ''
      }))
    }
  }, [items.length, user, navigate, booked])

  const buildWhatsAppMessage = (
    snapshot: BookedOrderSnapshot,
    cartItems: typeof items
  ) => {
    const itemLines = cartItems.map(i => {
      const pName = lang === 'ta' && i.nameTa ? i.nameTa : i.name
      return `  • ${pName} (${formatQuantityDisplay(i.qty, i.selectedUnit, i.unitType)}) — ${formatCurrency(i.lineTotal)}`
    }).join('\n')

    return encodeURIComponent(
      `🌿 *${BRAND_EN}*\n` +
      `📋 *Order ID:* ${snapshot.invoiceNo}\n\n` +
      `👤 *Name:* ${snapshot.name}\n` +
      `📞 *Phone:* ${snapshot.phone}\n` +
      `📍 *Address:* ${snapshot.address}\n\n` +
      `📦 *Items:*\n${itemLines}\n\n` +
      `💰 *Order Total: ${formatCurrency(snapshot.total)}*\n\n` +
      `_Delivery charges will be confirmed before dispatch._\n\n` +
      `நன்றி! Thank you for your order! 🙏`
    )
  }

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login?redirect=/checkout')
      return
    }
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Please fill in your name and phone number')
      return
    }
    if (form.phone.replace(/\D/g, '').length !== 10) {
      setError('Please enter a valid 10-digit WhatsApp number')
      return
    }

    setLoading(true)
    setError('')

    const itemsSnapshot = [...items]
    const structuredItems = itemsSnapshot.map((item) => buildStructuredOrderItem({
      productId: toProductId(item.id),
      name: item.name,
      tamilName: item.tamilName || item.nameTa || null,
      quantity: item.qty,
      unit: item.selectedUnit,
      unitType: item.unitType,
      baseQuantity: item.baseQuantity,
      basePrice: item.basePrice,
      imageUrl: item.imageUrl || item.image || null,
    }))

    try {
      const created = await createOrderWithStock({
        customerName: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || 'To be confirmed',
        items: structuredItems,
        shipping: 0,
        status: 'pending',
        orderMode: 'online',
      })

      const snapshot: BookedOrderSnapshot = {
        invoiceNo: created.invoiceNo,
        orderId: created.orderId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || 'To be confirmed',
        itemCount: itemsSnapshot.length,
        total: orderTotal,
      }

      const waText = buildWhatsAppMessage(snapshot, itemsSnapshot)
      clear()
      setBooked(snapshot)

      // Open WhatsApp immediately
      window.open(`${BRAND_WHATSAPP_LINK}?text=${waText}`, '_blank')
    } catch (err: unknown) {
      console.error('Order creation failed', err)
      const msg = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as Record<string, unknown>).message)
          : String(err || 'Failed to place order. Please try again.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Order Confirmed screen ──────────────────────────────────────
  if (booked) {
    const waText = encodeURIComponent(
      `🌿 *${BRAND_EN}*\n` +
      `📋 *Order ID:* ${booked.invoiceNo}\n\n` +
      `👤 *Name:* ${booked.name}\n` +
      `📞 *Phone:* ${booked.phone}\n` +
      `📍 *Address:* ${booked.address}\n\n` +
      `💰 *Order Total: ${formatCurrency(booked.total)}*\n\n` +
      `_Delivery charges will be confirmed before dispatch._\n\n` +
      `நன்றி! Thank you for your order! 🙏`
    )

    return (
      <div className="bg-bgMain min-h-screen py-16">
        <div className="max-w-lg mx-auto px-4">
          <div className="bg-white p-8 rounded-3xl shadow-soft border border-sand/50 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={44} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-bold font-headline text-textMain mb-2">Order Placed!</h1>
            <p className="text-textMuted text-sm mb-1">Your order has been saved successfully.</p>
            <p className="font-bold text-sageDark text-base mb-1">{booked.invoiceNo}</p>
            <p className="text-textMuted text-xs mb-6">{booked.itemCount} item(s) · {formatCurrency(booked.total)}</p>

            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle size={18} className="text-green-600" />
                <p className="font-bold text-green-800 text-sm">WhatsApp Opened</p>
              </div>
              <p className="text-green-700 text-xs leading-relaxed">
                A WhatsApp chat with our store ({BRAND_PHONE_DISPLAY}) should have opened automatically with your order details. If it didn't open, tap the button below.
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={`${BRAND_WHATSAPP_LINK}?text=${waText}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                <MessageCircle size={18} /> Open WhatsApp Chat
              </a>
              {user && (
                <Link to="/profile"
                  className="flex items-center justify-center gap-2 w-full bg-sageDark hover:bg-sageDeep text-white font-bold py-3.5 rounded-xl transition-colors">
                  <ShoppingBag size={18} /> View My Orders
                </Link>
              )}
              <Link to="/products"
                className="flex items-center justify-center gap-2 w-full border-2 border-sand hover:border-sageDark text-textMain font-bold py-3.5 rounded-xl transition-colors">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Checkout Form ───────────────────────────────────────────────
  return (
    <div className="bg-bgMain min-h-screen py-8 sm:py-10">
      <div className="max-w-4xl mx-auto px-4">
        <button onClick={() => navigate('/cart')} className="flex items-center gap-2 mb-6 text-sageDark font-bold">
          <ArrowLeft size={16} /> Back to Cart
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Form */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-soft border border-sand/50 h-fit">
            <h2 className="text-xl font-bold text-textMain mb-2">Your Details</h2>
            <p className="text-sm text-textMuted mb-5">We'll send your order summary to WhatsApp</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-textMain mb-1.5">Full Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Priya Krishnamurthy"
                  className="w-full px-4 py-2.5 sm:py-3 border-2 border-sand focus:border-sageDark rounded-xl outline-none transition-colors" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-textMain mb-1.5">WhatsApp Number *</label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 py-3 bg-[#F7F6F2] border-2 border-sand rounded-xl text-[13px] font-bold text-textMuted shrink-0">
                    🇮🇳 +91
                  </span>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                    maxLength={10} placeholder="10-digit mobile number"
                    className="flex-1 px-4 py-2.5 sm:py-3 border-2 border-sand focus:border-sageDark rounded-xl outline-none transition-colors" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-textMain mb-1.5">Delivery Address <span className="text-textMuted font-normal">(optional)</span></label>
                <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  rows={3} placeholder="House no., street, city, pincode — or confirm via WhatsApp"
                  className="w-full px-4 py-2.5 sm:py-3 border-2 border-sand focus:border-sageDark rounded-xl outline-none transition-colors resize-none" />
              </div>

              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle size={15} className="shrink-0" />
                  <strong>Order via WhatsApp</strong>
                </div>
                <p className="text-xs leading-relaxed">After placing your order, you'll be connected to WhatsApp ({BRAND_PHONE_DISPLAY}) to confirm delivery charges and details.</p>
              </div>

              {!user && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
                  <strong>Sign in required.</strong>{' '}
                  <Link to="/login?redirect=/checkout" className="font-bold underline">Sign in or create account →</Link>
                </div>
              )}

              <button onClick={handleCheckout} disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 sm:py-4 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                {loading ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving Order…</>
                ) : (
                  <><MessageCircle size={18} /> Place Order & Open WhatsApp</>
                )}
              </button>
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-soft border border-sand/50">
            <h2 className="text-xl font-bold text-textMain mb-5">Order Summary</h2>
            <div className="space-y-4 divide-y divide-sand/30">
              {items.map(item => {
                const pName = lang === 'ta' && item.nameTa ? item.nameTa : item.name
                return (
                  <div key={item.id} className="flex items-center gap-3 pt-4 first:pt-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-sand/20 shrink-0">
                      <img src={item.image} alt={item.name} loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).src = PRODUCT_PLACEHOLDER }}
                        className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow">
                      <p className="font-bold text-sm text-textMain">{pName}</p>
                      <p className="text-xs text-textMuted">{formatQuantityDisplay(item.qty, item.selectedUnit, item.unitType)}</p>
                    </div>
                    <p className="font-bold text-sm text-textMain">{formatCurrency(item.lineTotal)}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-sand space-y-2 text-sm">
              <div className="flex justify-between font-bold text-textMain text-base">
                <span>Order Total</span><span>{formatCurrency(orderTotal)}</span>
              </div>
              <p className="text-xs text-textMuted bg-bgMain px-3 py-2 rounded-lg mt-3">
                🚚 Delivery charges will be confirmed via WhatsApp before dispatch.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
