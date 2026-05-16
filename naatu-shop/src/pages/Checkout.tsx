import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCartStore, useAuthStore } from '../store/store'
import { useLangStore } from '../store/langStore'
import { ArrowLeft, MessageCircle, Printer, CheckCircle, ShoppingBag } from 'lucide-react'
import { createOrderWithStock } from '../services/orderService'
import { BRAND_EN, BRAND_WHATSAPP_LINK } from '../lib/brand'
import { Invoice } from '../components/Invoice'
import {
  buildStructuredOrderItem,
  formatCurrency,
  formatQuantityDisplay,
} from '../lib/retail'

interface BookedOrderSnapshot {
  invoiceNo: string
  orderId: string
  items: ReturnType<typeof useCartStore.getState>['items']
  subtotal: number
  shipping: number
  total: number
  name: string
  phone: string
  address: string
}

// Returns the product UUID string as-is (Supabase products.id is UUID, not BIGINT)
const toProductId = (value: string | number): string | null => {
  const str = String(value ?? '').trim()
  return str || null
}

export default function Checkout() {
  const { items, clear, total } = useCartStore()
  const { user } = useAuthStore()
  const { lang } = useLangStore()
  const navigate = useNavigate()

  const sub = total()
  const shipping = sub === 0 ? 0 : sub >= 500 ? 0 : 50
  const grand = sub + shipping

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

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login?redirect=/checkout')
      return
    }
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Please fill in all required fields')
      return
    }
    if (form.phone.replace(/\D/g, '').length !== 10) {
      setError('Please enter a valid 10-digit WhatsApp number')
      return
    }

    setLoading(true)
    setError('')

    const structuredItems = items.map((item) => buildStructuredOrderItem({
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
        address: form.address.trim(),
        items: structuredItems,
        shipping,
        status: 'pending',
      })

      const itemsSnapshot = [...items]
      const bookedSnapshot: BookedOrderSnapshot = {
        invoiceNo: created.invoiceNo,
        orderId: created.orderId,
        items: itemsSnapshot,
        subtotal: sub,
        shipping,
        total: grand,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      }

      clear()
      setBooked(bookedSnapshot)
    } catch (err: unknown) {
      // Normalize error messages from different sources (Error, Supabase error objects, strings)
      console.error('Order creation failed', err)
      const msg = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as any).message)
          : String(err || 'Failed to place order. Please try again.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const sendToWhatsApp = () => {
    if (!booked) return
    const text = encodeURIComponent(
      `🌿 *${BRAND_EN}* — New Booking\n\n` +
      `*Invoice:* ${booked.invoiceNo}\n` +
      `*Name:* ${booked.name}\n` +
      `*Phone:* ${booked.phone}\n` +
      `*Address:* ${booked.address}\n\n` +
      booked.items.map(i => {
        const pName = lang === 'ta' && i.nameTa ? i.nameTa : i.name
        return `• ${pName} (${formatQuantityDisplay(i.qty, i.selectedUnit, i.unitType)}) = ${formatCurrency(i.lineTotal)}`
      }).join('\n') +
      `\n\n*Subtotal:* ${formatCurrency(booked.subtotal)}\n*Shipping:* ${booked.shipping === 0 ? 'FREE' : formatCurrency(booked.shipping)}\n*Grand Total: ${formatCurrency(booked.total)}*\n\nThank you! | இங்கு வாங்கியதற்கு நன்றி!`
    )
    window.open(`${BRAND_WHATSAPP_LINK}?text=${text}`, '_blank')
  }

  // ── Order Confirmed screen ─────────────────────────────────
  if (booked) {
    const invoiceItems = booked.items.map(item => ({
      id: item.id,
      name: item.name,
      nameTa: item.nameTa,
      tamil_name: item.nameTa || undefined,
      qty: item.qty,
      quantity: item.qty,
      unit: item.selectedUnit,
      unit_type: item.unitType,
      base_quantity: item.baseQuantity,
      base_price: item.basePrice,
      line_total: item.lineTotal,
      price: item.price,
      offerPrice: item.offerPrice,
    }))

    return (
      <div className="bg-bgMain min-h-screen py-16 print:bg-white print:py-0">
        <div className="max-w-2xl mx-auto px-4">

          {/* Success banner — hidden on print */}
          <div className="print:hidden bg-white p-8 rounded-3xl shadow-soft border border-sand/50 text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={36} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-bold font-headline text-textMain mb-1">Booking Confirmed!</h1>
            <p className="text-textMuted text-sm mb-1">Your order has been placed successfully.</p>
            <p className="font-bold text-sageDark">{booked.invoiceNo}</p>
          </div>

          {/* A4-formatted Invoice — this is what prints */}
          <div className="mb-6 rounded-2xl overflow-hidden shadow-soft border border-sand/50 print:shadow-none print:border-none print:rounded-none">
            <Invoice
              invoiceNo={booked.invoiceNo}
              date={new Date().toISOString()}
              customerName={booked.name}
              phone={booked.phone}
              address={booked.address}
              items={invoiceItems}
              subtotal={booked.subtotal}
              shipping={booked.shipping}
              total={booked.total}
              status="Pending"
            />
          </div>

          {/* Actions — hidden on print */}
          <div className="print:hidden grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={sendToWhatsApp}
              className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl transition-colors">
              <MessageCircle size={18} /> WhatsApp
            </button>
            <button onClick={() => window.print()}
              className="flex items-center justify-center gap-2 border-2 border-sand hover:border-sageDark text-textMain font-bold py-3.5 rounded-xl transition-colors">
              <Printer size={18} /> Print / Save PDF
            </button>
            {user ? (
              <Link to="/profile"
                className="flex items-center justify-center gap-2 bg-sageDark hover:bg-sageDeep text-white font-bold py-3.5 rounded-xl transition-colors">
                <ShoppingBag size={18} /> View Orders
              </Link>
            ) : (
              <Link to="/"
                className="flex items-center justify-center gap-2 bg-sageDark hover:bg-sageDeep text-white font-bold py-3.5 rounded-xl transition-colors">
                Continue Shopping
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Checkout Form ──────────────────────────────────────────
  return (
    <div className="bg-bgMain min-h-screen py-8 sm:py-10">
      <div className="max-w-4xl mx-auto px-4">
        <button onClick={() => navigate('/cart')} className="flex items-center gap-2 mb-6 text-sageDark font-bold">
          <ArrowLeft size={16} /> Back to Cart
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Form */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-soft border border-sand/50 h-fit">
            <h2 className="text-xl font-bold text-textMain mb-5">Delivery Details</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-textMain mb-1.5">Full Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 sm:py-3 border-2 border-sand focus:border-sageDark rounded-xl outline-none transition-colors" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-textMain mb-1.5">WhatsApp Number *</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                  maxLength={10} placeholder="10-digit mobile number"
                  className="w-full px-4 py-2.5 sm:py-3 border-2 border-sand focus:border-sageDark rounded-xl outline-none transition-colors" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-textMain mb-1.5">Delivery Address *</label>
                <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  rows={4} placeholder="House no., street, city, pincode"
                  className="w-full px-4 py-2.5 sm:py-3 border-2 border-sand focus:border-sageDark rounded-xl outline-none transition-colors resize-none" required />
              </div>

              {/* Delivery charge notice — PDF requirement */}
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
                🚚 <strong>Delivery charges</strong> will be collected during dispatch based on product weight and delivery location.
              </div>

              {!user && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
                  <strong>Sign in required to place an order.</strong>{' '}
                  <Link to="/login?redirect=/checkout" className="font-bold underline">Sign in or create account →</Link>
                </div>
              )}

              <button onClick={handleCheckout} disabled={loading}
                className="w-full bg-sageDark hover:bg-sageDeep text-white font-bold py-3.5 sm:py-4 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                {loading ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Placing Order...</>
                ) : (
                  <><ShoppingBag size={18} /> Confirm Booking — {formatCurrency(grand)}</>
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
                        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=80' }}
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
              <div className="flex justify-between text-textMuted">
                <span>Subtotal</span><span>{formatCurrency(sub)}</span>
              </div>
              <div className="flex justify-between text-textMuted">
                <span>Shipping</span>
                <span className={shipping === 0 && sub > 0 ? 'text-green-600 font-bold' : ''}>
                  {sub === 0 ? '–' : shipping === 0 ? 'FREE 🎉' : formatCurrency(shipping)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-textMain text-base border-t border-sand pt-3 mt-3">
                <span>Grand Total</span><span>{formatCurrency(grand)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
