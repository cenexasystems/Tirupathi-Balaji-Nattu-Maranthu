import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Trash2, Plus, Minus, Receipt, Printer,
  RefreshCw, ChevronLeft, ShoppingBag, MessageCircle,
  Wifi, WifiOff, Layers, X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useProductStore, useVariantStore, type Product } from '../store/store'
import { Invoice } from '../components/Invoice'
import { BRAND_EN, BRAND_TA, BRAND_WHATSAPP_LINK } from '../lib/brand'
import { createOrderWithStock } from '../services/orderService'
import {
  buildStructuredOrderItem,
  calculateLineTotal,
  formatCurrency,
  formatPricePerUnit,
  formatQuantityDisplay,
  getDefaultQuantityForProduct,
  normalizeSelectedQuantity,
} from '../lib/retail'
import { getProductImage, onImgError } from '../lib/productImages'
import { normalizeIndianPhone, toWhatsAppUrl } from '../lib/phone'
import type { ProductVariant } from '../services/variantService'

// ── Types ──────────────────────────────────────────────────────────────────
type PosItem = Product & {
  qty: number
  selectedUnit: string
  basePrice: number
  lineTotal: number
  source?: 'catalogue' | 'manual'
  note?: string | null
}

type InvoiceSnap = {
  id: string
  invoiceNo: string
  orderType: 'online_request' | 'pos_sale' | 'manual_sale'
  date: string
  items: PosItem[]
  subtotal: number
  shipping: number
  couponCode?: string
  couponDiscount: number
  manualDiscountAmount: number
  manualDiscountType: 'flat' | 'percent'
  manualDiscountValue: number
  total: number
  customerName: string
  phone: string
  address: string
  amountReceived: number
  balanceReturned: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
const toProductId = (v: string | number): string | null => {
  const s = String(v ?? '').trim(); return s || null
}

const defaultQty = (p: Product) =>
  normalizeSelectedQuantity(
    getDefaultQuantityForProduct({ unitType: p.unitType, baseQuantity: p.baseQuantity, predefinedOptions: p.predefinedOptions }),
    p.unitType, p.allowDecimalQuantity,
    p.unitType === 'unit' || p.unitType === 'bundle' ? 1 : Math.max(p.baseQuantity, 0.001),
  )

const makePosItem = (p: Product, qty?: number): PosItem => {
  const basePrice = p.offerPrice || p.price
  const q = normalizeSelectedQuantity(
    qty ?? defaultQty(p), p.unitType, p.allowDecimalQuantity,
    p.unitType === 'unit' || p.unitType === 'bundle' ? 1 : Math.max(p.baseQuantity, 0.001),
  )
  return { ...p, qty: q, selectedUnit: p.unitLabel, basePrice, lineTotal: calculateLineTotal(q, p.unitType, p.baseQuantity, basePrice) }
}

const recalc = (item: PosItem, nextQty: number): PosItem => {
  const q = Math.max(
    item.unitType === 'unit' || item.unitType === 'bundle' ? 1 : 0.001,
    normalizeSelectedQuantity(nextQty, item.unitType, item.allowDecimalQuantity,
      item.unitType === 'unit' || item.unitType === 'bundle' ? 1 : Math.max(item.baseQuantity, 0.001)),
  )
  return { ...item, qty: q, lineTotal: calculateLineTotal(q, item.unitType, item.baseQuantity, item.basePrice) }
}


// ── Category colours ───────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  'Pooja Items': '#7C3AED', 'Herbal Powder': '#D97706', 'Herbal Oil': '#0D9488',
  'Spices & Condiments': '#DC2626', 'Grains & Pulses': '#92400E',
  'Honey & Liquids': '#B45309', 'Bundle Packages': '#1D4ED8',
}

// ══════════════════════════════════════════════════════════════════════════
export default function Pos() {
  const { products, fetchProducts, error: productError } = useProductStore()
  const { getVariants, fetchVariants } = useVariantStore()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [items, setItems] = useState<PosItem[]>([])
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [shipping, setShipping] = useState<string>('0')
  const [couponInput, setCouponInput] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; percentage: number; discount: number } | null>(null)
  const [manualDiscountType, setManualDiscountType] = useState<'flat' | 'percent'>('flat')
  const [manualDiscountValue, setManualDiscountValue] = useState('')
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState<InvoiceSnap | null>(null)
  const [cashReceived, setCashReceived] = useState<string>('')
  const [mobilePanelView, setMobilePanelView] = useState<'catalogue' | 'bill'>('catalogue')
  const [orderMode, setOrderMode] = useState<'online' | 'offline'>('offline')
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetchProducts()
    void fetchVariants()
    if (!isSupabaseConfigured) return
    const ch = supabase.channel('pos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void fetchProducts())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [fetchProducts, fetchVariants])

  // ── Derived data ──────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.filter(p => p.isActive).map(p => p.category))).filter(Boolean)
    return ['All', ...cats]
  }, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let src = products.filter(p => p.isActive)
    if (activeCategory !== 'All') src = src.filter(p => p.category === activeCategory)
    if (q) src = src.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.nameTa || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
    return src.slice(0, 120)
  }, [products, search, activeCategory])

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const couponDiscount = appliedCoupon?.discount || 0
  const manualDiscountNumeric = Math.max(0, Number(manualDiscountValue) || 0)
  const manualDiscountAmount = manualDiscountType === 'percent'
    ? Math.max(0, Math.round((subtotal * manualDiscountNumeric / 100) * 100) / 100)
    : manualDiscountNumeric
  const total = Math.max(0, subtotal - couponDiscount - manualDiscountAmount + (Number(shipping || 0) || 0))

  const itemQtyMap = useMemo(() => {
    const m: Record<string | number, number> = {}
    items.forEach(i => { m[i.id] = i.qty })
    return m
  }, [items])

  // ── Cart actions ──────────────────────────────────────────────────────
  const addItem = (product: Product) => {
    // For variant products, open variant picker instead of adding directly
    if (product.hasVariants) {
      const variants = getVariants(String(product.id))
      if (variants.length > 0) {
        setVariantPickerProduct(product)
        setSelectedVariant(variants[0])
        return
      }
    }
    setError('')
    setMobilePanelView('catalogue')
    setItems(cur => {
      const ex = cur.find(i => i.id === product.id)
      if (!ex) return [...cur, makePosItem(product)]
      const inc = ex.unitType === 'unit' || ex.unitType === 'bundle' ? 1 : ex.baseQuantity
      return cur.map(i => i.id === product.id ? recalc(i, i.qty + inc) : i)
    })
  }

  const addVariantToItems = () => {
    if (!variantPickerProduct || !selectedVariant) return
    setError('')
    const variantProduct: Product = {
      ...variantPickerProduct,
      id: selectedVariant.id,
      name: `${variantPickerProduct.name} - ${selectedVariant.variantName}`,
      price: selectedVariant.price,
      offerPrice: null,
      stock: selectedVariant.stock,
      stockQuantity: selectedVariant.stock,
      hasVariants: false,
    }
    setItems(cur => {
      const ex = cur.find(i => i.id === variantProduct.id)
      if (!ex) return [...cur, makePosItem(variantProduct)]
      return cur.map(i => i.id === variantProduct.id ? recalc(i, i.qty + 1) : i)
    })
    setVariantPickerProduct(null)
    setSelectedVariant(null)
    setMobilePanelView('catalogue')
  }

  // Manual product addition (minimal, non-destructive)
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const addManualItem = () => {
    setError('')
    const name = manualName.trim()
    const price = Number(manualPrice || 0)
    if (!name) { setError('Enter product name'); return }
    if (!(price > 0)) { setError('Enter valid price'); return }
    const prod: Product = {
      id: `manual-${Date.now()}`,
      name,
      category: 'Manual',
      remedy: [],
      price,
      offerPrice: null,
      unitType: 'unit',
      unitLabel: 'pc',
      baseQuantity: 1,
      stockQuantity: 999,
      stockUnit: 'pc',
      allowDecimalQuantity: false,
      predefinedOptions: [],
      isActive: true,
      sortOrder: 0,
      unit: '1pc',
      rating: 5,
      stock: 999,
      description: '',
      benefits: '',
      image: '/assets/images/default-herb.jpg',
      imageUrl: undefined,
      source: 'manual',
    }
    setManualName('')
    setManualPrice('')
    setItems(cur => [...cur, { ...makePosItem(prod), source: 'manual' }])
    setMobilePanelView('catalogue')
  }

  const removeItem = (id: string | number) => setItems(cur => cur.filter(i => i.id !== id))

  const bumpQty = (id: string | number, delta: number) => {
    setItems(cur => {
      const ex = cur.find(i => i.id === id)
      if (!ex) return cur
      const next = ex.qty + delta
      if (next <= 0) return cur.filter(i => i.id !== id)
      return cur.map(i => i.id === id ? recalc(i, next) : i)
    })
  }

  const setQty = (id: string | number, val: number) => {
    if (val <= 0) { removeItem(id); return }
    setItems(cur => cur.map(i => i.id === id ? recalc(i, val) : i))
  }

  const clearAll = () => {
    setItems([])
    setCustomer({ name: '', phone: '', address: '' })
    setInvoice(null)
    setCashReceived('')
    setCouponInput('')
    setAppliedCoupon(null)
    setCouponError('')
    setManualDiscountValue('')
    setManualDiscountType('flat')
    setError('')
    searchRef.current?.focus()
  }

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) { setCouponError('Enter a coupon code'); return }

    setCouponLoading(true)
    setCouponError('')
    setAppliedCoupon(null)

    try {
      if (!isSupabaseConfigured) {
        setCouponError('Coupon validation requires a live connection')
        return
      }

      const { data, error: dbErr } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .ilike('code', code)
        .single()

      if (dbErr || !data) {
        setCouponError('Invalid or expired coupon code')
        return
      }

      if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
        setCouponError('This coupon has expired')
        return
      }

      if (data.usage_limit && data.usage_count >= data.usage_limit) {
        setCouponError('Coupon usage limit has been reached')
        return
      }

      if (data.min_order_value && subtotal < Number(data.min_order_value)) {
        setCouponError(`Minimum order of ${formatCurrency(Number(data.min_order_value))} required`)
        return
      }

      const discount = Math.round((subtotal * Number(data.percentage) / 100) * 100) / 100
      setAppliedCoupon({ code: String(data.code), percentage: Number(data.percentage), discount })
    } catch {
      setCouponError('Failed to validate coupon. Try again.')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

  const getOrderType = (): 'pos_sale' | 'manual_sale' => (items.length > 0 && items.every((item) => item.source === 'manual') ? 'manual_sale' : 'pos_sale')

  // ── Generate bill ─────────────────────────────────────────────────────
  const generateBill = async () => {
    if (!items.length) { setError('Add at least one product.'); return }
    // Validate required phone
    const normalizedPhone = normalizeIndianPhone(customer.phone || '')
    if (!normalizedPhone) { setError('Please enter a valid Indian mobile number (e.g. 9876543210 or +91 9876543210)'); return }
    // Validate payment amount
    if (!cashReceived.trim()) { setError('Enter the amount received from customer'); return }
    if (cashReceivedNum < total) { setError(`Insufficient payment. Customer still owes ${formatCurrency(total - cashReceivedNum)}`); return }
    // Validate online mode availability
    if (orderMode === 'online' && !isSupabaseConfigured) { setError('Cannot place online orders while offline'); return }
    setSaving(true); setError('')
    try {
      const created = await createOrderWithStock({
        customerName: customer.name.trim() || 'Walk-in Customer',
        phone: normalizedPhone,
        address: customer.address.trim() || 'POS Counter',
        items: items.map(item => buildStructuredOrderItem({
          productId: toProductId(item.id),
          name: item.name,
          tamilName: item.tamilName || item.nameTa || null,
          quantity: item.qty,
          unit: item.selectedUnit,
          unitType: item.unitType,
          baseQuantity: item.baseQuantity,
          basePrice: item.basePrice,
          imageUrl: item.imageUrl || item.image || null,
          source: item.source || 'catalogue',
          note: item.note || null,
        })),
        shipping: Number(shipping || 0),
        status: 'completed',
        orderMode,
        orderType: getOrderType(),
        deliveryCharge: Number(shipping || 0),
        discountAmount: couponDiscount,
        manualDiscountAmount,
        manualDiscountType,
        manualDiscountValue: manualDiscountNumeric,
        couponCode: appliedCoupon?.code,
        couponPercentage: appliedCoupon?.percentage,
      })
      setInvoice({
        id: created.orderId,
        invoiceNo: created.invoiceNo,
        orderType: getOrderType(),
        date: created.createdAt,
        items: [...items],
        subtotal,
        shipping: Number(shipping || 0),
        couponCode: appliedCoupon?.code,
        couponDiscount,
        manualDiscountAmount,
        manualDiscountType,
        manualDiscountValue: manualDiscountNumeric,
        total,
        customerName: customer.name.trim() || 'Walk-in Customer',
        phone: normalizedPhone,
        address: customer.address.trim() || 'POS Counter',
        amountReceived: cashReceivedNum,
        balanceReturned: balanceToReturn,
      })
      setItems([])
      setCustomer({ name: '', phone: '', address: '' })
      void fetchProducts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate bill')
    } finally {
      setSaving(false)
    }
  }

  const cashReceivedNum = Number(cashReceived) || 0
  const balanceToReturn = cashReceivedNum > 0 && cashReceivedNum >= total ? cashReceivedNum - total : 0
  const isInsufficientPayment = cashReceived !== '' && cashReceivedNum > 0 && cashReceivedNum < total
  const change = cashReceived && Number(cashReceived) >= total
    ? Number(cashReceived) - total : null

  const sendPosWhatsApp = (inv: InvoiceSnap) => {
    const lines = inv.items
      .map((i, idx) => `  ${idx + 1}. ${i.name} × ${formatQuantityDisplay(i.qty, i.selectedUnit, i.unitType)}  →  ${formatCurrency(i.lineTotal)}`)
      .join('\n')
    const waLink = toWhatsAppUrl(inv.phone || customer.phone || '')
    const sep = '━━━━━━━━━━━━━━━━━━━━'
    const text = encodeURIComponent(
      `🌿 *${BRAND_EN}*\n` +
      `${sep}\n` +
      `📋 *Receipt:* ${inv.invoiceNo}\n` +
      (inv.customerName !== 'Walk-in Customer' ? `👤 *Customer:* ${inv.customerName}\n` : '') +
      (inv.phone ? `📞 ${inv.phone}\n` : '') +
      `${sep}\n` +
      `🛒 *Items:*\n\n` +
      `${lines}\n\n` +
      `${sep}\n` +
      `💰 *Total: ${formatCurrency(inv.total)}*\n` +
      `${sep}\n\n` +
      `நன்றி! | Thank you! 🙏`
    )
    window.open(`${waLink}?text=${text}`, '_blank')
  }

  // ══ INVOICE SCREEN ════════════════════════════════════════════════════
  if (invoice) {
    const invoiceItems = invoice.items.map(item => ({
      id: item.id,
      name: item.name,
      nameTa: item.nameTa,
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
      <div className="mobile-page-shell print:bg-white print:min-h-0">
        {/* Screen UI */}
        <div className="max-w-2xl mx-auto px-4 py-6 print:hidden space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-textMain">Bill Generated</h1>
              <p className="text-sm text-textMuted">{invoice.invoiceNo}</p>
            </div>
            <button onClick={clearAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sageDark text-white font-bold text-sm">
              <Plus size={15} /> New Sale
            </button>
          </div>

          {/* Payment receipt */}
          <div className="surface-panel p-5">
            <p className="text-xs font-black uppercase tracking-widest text-textMuted mb-3">Payment Receipt</p>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center pb-2.5 border-b border-sand">
                <p className="text-sm font-bold text-textMuted">Grand Total</p>
                <p className="text-2xl font-black text-textMain">{formatCurrency(invoice.total)}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold text-textMuted">Amount Received</p>
                <p className="text-xl font-black text-textMain">{formatCurrency(invoice.amountReceived)}</p>
              </div>
              {invoice.balanceReturned > 0 ? (
                <div className="flex justify-between items-center rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
                  <p className="text-sm font-black text-blue-700">Balance Returned</p>
                  <p className="text-2xl font-black text-blue-700">{formatCurrency(invoice.balanceReturned)}</p>
                </div>
              ) : (
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-center">
                  <p className="text-sm font-black text-green-700">✅ Exact Amount Received</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => sendPosWhatsApp(invoice)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-colors">
              <MessageCircle size={16} /> WhatsApp
            </button>
            <button onClick={() => window.print()}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-sand hover:border-sageDark text-textMain font-bold text-sm transition-colors">
              <Printer size={16} /> Print
            </button>
            <button onClick={clearAll}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-sageDark hover:bg-sageDeep text-white font-bold text-sm transition-colors">
              <RefreshCw size={16} /> New Sale
            </button>
          </div>

          {/* Items summary */}
          <div className="surface-panel p-4">
            <p className="text-xs font-bold text-textMuted uppercase tracking-wide mb-3">Items Sold</p>
            <div className="space-y-1.5">
              {invoice.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-textMain">{item.name} × {formatQuantityDisplay(item.qty, item.selectedUnit, item.unitType)}</span>
                  <span className="font-bold">{formatCurrency(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Print view — full A4 invoice */}
        <div className="hidden print:block">
          <Invoice
            invoiceNo={invoice.invoiceNo}
            date={invoice.date}
            customerName={invoice.customerName}
            phone={invoice.phone}
            address={invoice.address}
            items={invoiceItems}
            subtotal={invoice.subtotal}
            shipping={invoice.shipping}
            total={invoice.total}
            status="Completed"
          />
        </div>
      </div>
    )
  }

  // ══ MAIN POS SCREEN ══════════════════════════════════════════════════
  return (
    <div className="mobile-page-shell h-screen flex flex-col overflow-hidden print:hidden">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="bg-[#2C392A] text-white px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <p className="font-black text-[13px] leading-tight">{BRAND_EN}</p>
            <p className="text-[10px] text-white/60">{BRAND_TA} · POS Terminal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Online / Offline sale mode toggle */}
          <div className="flex items-center gap-0 bg-white/10 rounded-lg overflow-hidden border border-white/20">
            <button
              onClick={() => setOrderMode('offline')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-black transition-colors ${orderMode === 'offline' ? 'bg-white text-[#2C392A]' : 'text-white/70 hover:text-white'}`}
            >
              <WifiOff size={10} /> OFFLINE
            </button>
            <button
              onClick={() => setOrderMode('online')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-black transition-colors ${orderMode === 'online' ? 'bg-white text-[#2C392A]' : 'text-white/70 hover:text-white'}`}
            >
              <Wifi size={10} /> ONLINE
            </button>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isSupabaseConfigured ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
            {isSupabaseConfigured ? '● Live' : '● Local'}
          </span>
          <button onClick={() => void fetchProducts()} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Mobile tab toggle ─────────────────────────────────────────── */}
      <div className="md:hidden bg-white border-b border-[#D5DAD0] flex shrink-0">
        <button
          onClick={() => setMobilePanelView('catalogue')}
          className={`flex-1 py-2.5 text-[12px] font-black transition-colors ${mobilePanelView === 'catalogue' ? 'text-[#2C392A] border-b-2 border-[#2C392A]' : 'text-[#5F6D59]'}`}
        >
          Products
        </button>
        <button
          onClick={() => setMobilePanelView('bill')}
          className={`flex-1 py-2.5 text-[12px] font-black transition-colors flex items-center justify-center gap-1.5 ${mobilePanelView === 'bill' ? 'text-[#2C392A] border-b-2 border-[#2C392A]' : 'text-[#5F6D59]'}`}
        >
          Bill
          {items.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#2C392A] text-white text-[9px] font-black flex items-center justify-center">
              {items.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Body: product grid + bill ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden gap-0">

        {/* ════ LEFT: Product catalogue ════════════════════════════════ */}
        <div className={`relative flex flex-col flex-1 overflow-hidden border-r border-[#D5DAD0] ${mobilePanelView === 'bill' ? 'hidden md:flex' : ''}`}>

          {/* Search */}
          <div className="bg-white px-3 py-2.5 border-b border-[#D5DAD0] shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2 bg-[#F0F2EE] rounded-lg text-[13px] outline-none border border-transparent focus:border-[#7DAA8F]"
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="bg-white px-2 py-1.5 border-b border-[#D5DAD0] shrink-0 overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? 'text-white shadow-sm'
                      : 'bg-[#F0F2EE] text-[#5F6D59] hover:bg-[#E8EDE4]'
                  }`}
                  style={activeCategory === cat ? { backgroundColor: CAT_COLOR[cat] || '#2C392A' } : {}}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

            {/* Manual add small form */}
            <div className="bg-white px-3 py-2.5 border-b border-[#D5DAD0] shrink-0">
              <div className="flex items-center gap-2">
                <input
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="Manual item name"
                  className="flex-1 px-3 py-1.5 bg-[#F0F2EE] rounded-lg text-[12px] outline-none border border-transparent focus:border-[#7DAA8F]"
                />
                <input
                  value={manualPrice}
                  onChange={e => setManualPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Price"
                  className="w-24 px-3 py-1.5 bg-[#F0F2EE] rounded-lg text-[12px] outline-none border border-transparent focus:border-[#7DAA8F] text-right"
                />
                <button onClick={addManualItem} className="px-3 py-1.5 bg-[#2C392A] text-white rounded-lg font-black text-[12px]">Add</button>
              </div>
            </div>

          {/* Product grid */}
          {(productError && products.length === 0) && (
            <div className="m-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">{productError}</div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-textMuted text-sm">
                {products.length === 0 ? 'No products loaded.' : 'No products match your search.'}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-5 gap-2">
                {filtered.map(product => {
                  const qty = itemQtyMap[product.id]
                  const price = product.offerPrice || product.price
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addItem(product)}
                      className={`relative group flex flex-col text-left rounded-xl border-2 transition-all active:scale-95 overflow-hidden
                        ${qty ? 'border-[#7DAA8F] bg-white shadow-md' : 'border-transparent bg-white hover:border-[#7DAA8F]/50 hover:shadow-sm'}`}
                    >
                      {/* Quantity badge */}
                      {qty && (
                        <span className="absolute top-1 right-1 z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-[#2C392A] text-white text-[9px] font-black flex items-center justify-center">
                          {product.unitType === 'unit' || product.unitType === 'bundle' ? qty : '✓'}
                        </span>
                      )}

                      {/* Variants badge */}
                      {product.hasVariants && (
                        <span className="absolute top-1 left-1 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[8px] font-black">
                          <Layers size={8} /> Variants
                        </span>
                      )}

                      {/* Category colour strip */}
                      <div className="h-1 w-full shrink-0" style={{ backgroundColor: CAT_COLOR[product.category] || '#7DAA8F' }} />

                      {/* Image */}
                      <div className="w-full aspect-square overflow-hidden bg-[#E8EDE4] shrink-0">
                        <img
                          src={getProductImage(product.name, product.category, product.imageUrl, 'tile')}
                          alt={product.name}
                          loading="lazy"
                          decoding="async"
                          onError={onImgError}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      {/* Info */}
                      <div className="p-1.5 flex-1 flex flex-col justify-between">
                        <p className="text-[10px] sm:text-[11px] font-bold text-[#2C392A] line-clamp-2 leading-snug">
                          {product.name}
                        </p>
                        {(product.nameTa || product.tamilName) && (
                          <p className="text-[10px] text-[#7DAA8F] line-clamp-1 mt-0.5 leading-relaxed ta-text">
                            {product.nameTa || product.tamilName}
                          </p>
                        )}
                        <p className="text-[11px] font-black text-[#2C392A] mt-1">
                          {product.hasVariants ? (
                            <span className="text-purple-700">Select ▸</span>
                          ) : (
                            <>
                              {formatCurrency(price)}
                              <span className="text-[9px] font-medium text-[#5F6D59] ml-0.5">
                                /{product.unitType === 'unit' ? 'pc' : product.unitType === 'bundle' ? 'bundle' : product.unitLabel}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Variant Picker Overlay (inline, within catalogue panel) ── */}
          {variantPickerProduct && (
            <div className="absolute inset-0 z-20 flex items-end bg-black/30 backdrop-blur-sm">
              <div className="w-full bg-white rounded-t-2xl shadow-2xl border-t border-[#D5DAD0] p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#E8EDE4]">
                      <img
                        src={getProductImage(variantPickerProduct.name, variantPickerProduct.category, variantPickerProduct.imageUrl, 'tile')}
                        alt={variantPickerProduct.name}
                        onError={onImgError}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-[#2C392A]">{variantPickerProduct.name}</p>
                      <p className="text-[11px] text-[#5F6D59]">Select a variant</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setVariantPickerProduct(null); setSelectedVariant(null) }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F2EE]"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Variant chips */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {getVariants(String(variantPickerProduct.id)).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`flex flex-col items-start rounded-xl border-2 px-3 py-2 text-left transition-all ${
                        selectedVariant?.id === v.id
                          ? 'border-[#2C392A] bg-[#2C392A] text-white'
                          : 'border-[#D5DAD0] bg-[#F0F2EE] text-[#2C392A]'
                      }`}
                    >
                      <span className="text-[12px] font-black">{v.variantName}</span>
                      <span className={`text-[11px] font-bold ${selectedVariant?.id === v.id ? 'text-white/80' : 'text-[#5F6D59]'}`}>
                        {formatCurrency(v.price)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Add button */}
                <button
                  type="button"
                  onClick={addVariantToItems}
                  disabled={!selectedVariant}
                  className="w-full py-3 bg-[#2C392A] text-white rounded-xl font-black text-[13px] disabled:opacity-40"
                >
                  Add to Bill — {selectedVariant ? formatCurrency(selectedVariant.price) : '—'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ════ RIGHT: Bill panel ══════════════════════════════════════ */}
        <div className={`flex flex-col shrink-0 bg-white
          ${mobilePanelView === 'catalogue' ? 'hidden md:flex' : 'flex w-full'}
          md:w-[320px] xl:w-[360px]`}>

          {/* Customer fields */}
          <div className="px-3 py-2.5 border-b border-[#E8EDE4] shrink-0 space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5F6D59]">Customer</p>
            <input
              value={customer.name}
              onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
              placeholder="Name (optional)"
              className="w-full px-3 py-1.5 bg-[#F0F2EE] rounded-lg text-[12px] outline-none border border-transparent focus:border-[#7DAA8F]"
            />
            <input
              value={customer.phone}
              onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}
              placeholder="9876543210 or +91 9876543210"
              className={`w-full px-3 py-1.5 bg-[#F0F2EE] rounded-lg text-[12px] outline-none border transition-colors ${
                customer.phone && !normalizeIndianPhone(customer.phone)
                  ? 'border-red-400 bg-red-50/30'
                  : customer.phone && normalizeIndianPhone(customer.phone)
                    ? 'border-green-400 bg-green-50/30'
                    : 'border-transparent focus:border-[#7DAA8F]'
              }`}
            />
            {customer.phone && !normalizeIndianPhone(customer.phone) && (
              <p className="text-[9px] text-red-500 font-bold mt-0.5">Invalid number — try 9876543210 or +91 9876543210</p>
            )}
          </div>

          {/* Bill header */}
          <div className="px-3 py-2 border-b border-[#E8EDE4] flex items-center justify-between shrink-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#5F6D59] flex items-center gap-1.5">
              <ShoppingBag size={12} /> Bill Items
            </p>
            {items.length > 0 && (
              <button onClick={() => setItems([])} className="text-[10px] font-bold text-red-400 hover:text-red-600 flex items-center gap-1">
                <Trash2 size={10} /> Clear
              </button>
            )}
          </div>

          {/* Items list */}
          <div className="flex-1 min-h-[60px] overflow-y-auto px-2 py-2 space-y-1">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 text-[#5F6D59]">
                <ShoppingBag size={32} className="opacity-20 mb-2" />
                <p className="text-[12px] font-bold">No items yet</p>
                <p className="text-[11px] opacity-60 mt-0.5">Click products to add</p>
              </div>
            ) : (
              items.map(item => {
                const step = item.unitType === 'unit' || item.unitType === 'bundle' ? 1 : item.baseQuantity
                return (
                  <div key={item.id}
                    className="bg-[#F7F8F5] rounded-xl px-2.5 py-2 border border-[#E8EDE4]">
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[#2C392A] leading-tight truncate">{item.name}</p>
                        <p className="text-[9px] text-[#5F6D59] mt-0.5">
                          {formatPricePerUnit(item.basePrice, item.baseQuantity, item.unitLabel, item.unitType)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <p className="text-[12px] font-black text-[#2C392A]">{formatCurrency(item.lineTotal)}</p>
                        <button onClick={() => removeItem(item.id)}
                          className="text-red-400 hover:text-red-600 ml-1">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Qty controls */}
                    {item.predefinedOptions.length > 0 && (item.unitType === 'weight' || item.unitType === 'volume') ? (
                      <div className="flex flex-wrap gap-1">
                        {item.predefinedOptions.map(opt => (
                          <button key={opt.quantity} type="button"
                            onClick={() => setQty(item.id, opt.quantity)}
                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold border transition-colors ${
                              Math.abs(item.qty - opt.quantity) < 0.001
                                ? 'bg-[#2C392A] text-white border-[#2C392A]'
                                : 'bg-white text-[#5F6D59] border-[#D5DAD0] hover:border-[#7DAA8F]'
                            }`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => bumpQty(item.id, -step)}
                          className="w-6 h-6 rounded-lg bg-[#E8EDE4] hover:bg-red-100 flex items-center justify-center text-[#2C392A] transition-colors">
                          <Minus size={10} />
                        </button>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={e => setQty(item.id, Number(e.target.value))}
                          className="w-14 text-center text-[12px] font-bold bg-white border border-[#D5DAD0] rounded-lg py-0.5 outline-none focus:border-[#7DAA8F]"
                        />
                        <button onClick={() => bumpQty(item.id, step)}
                          className="w-6 h-6 rounded-lg bg-[#7DAA8F] hover:bg-[#5e8c72] flex items-center justify-center text-white transition-colors">
                          <Plus size={10} />
                        </button>
                        <span className="text-[10px] text-[#5F6D59] font-bold">{item.selectedUnit}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Totals + Generate bill */}
          <div className="border-t border-[#E8EDE4] px-3 py-3 shrink-0 space-y-2 overflow-y-auto max-h-[56vh] md:max-h-none md:overflow-visible">
            {error && (
              <p className="text-[11px] text-red-500 font-bold bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="space-y-2 rounded-xl border border-[#E8EDE4] bg-[#F7F8F5] p-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#5F6D59] mb-1">Coupon</label>
                <div className="flex gap-2 min-w-0">
                  <input
                    value={couponInput}
                    onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                    placeholder="WELCOME10"
                    className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-[#D5DAD0] bg-white text-[12px] font-bold uppercase outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void applyCoupon()}
                    disabled={couponLoading || !couponInput.trim()}
                    className="shrink-0 px-3 py-2 rounded-lg bg-[#2C392A] text-white font-black text-[11px] disabled:opacity-50"
                  >
                    {couponLoading ? '...' : 'Apply'}
                  </button>
                </div>
                {couponError && <p className="mt-1 text-[10px] font-bold text-red-500">{couponError}</p>}
                {appliedCoupon && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-green-800 truncate">{appliedCoupon.code} · {appliedCoupon.percentage}% off</p>
                      <p className="text-[10px] text-green-700">{formatCurrency(appliedCoupon.discount)} off</p>
                    </div>
                    <button type="button" onClick={removeCoupon} className="shrink-0 text-[10px] font-black text-green-700 hover:text-red-500 uppercase">Clear</button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#5F6D59] mb-1">Manual Discount</label>
                <div className="flex gap-2 min-w-0">
                  <select
                    value={manualDiscountType}
                    onChange={e => setManualDiscountType(e.target.value === 'percent' ? 'percent' : 'flat')}
                    className="shrink-0 w-20 px-2 py-2 rounded-lg border border-[#D5DAD0] bg-white text-[11px] font-bold"
                  >
                    <option value="flat">Flat ₹</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    value={manualDiscountValue}
                    onChange={e => setManualDiscountValue(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={manualDiscountType === 'percent' ? '10' : '50'}
                    className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-[#D5DAD0] bg-white text-[12px] font-bold outline-none text-right"
                  />
                </div>
                {manualDiscountAmount > 0 && (
                  <p className="mt-1 text-[10px] text-green-700 font-bold">Discount: {formatCurrency(manualDiscountAmount)}</p>
                )}
              </div>
            </div>

            {/* Bill breakdown */}
            <div className="rounded-xl border border-[#E8EDE4] bg-[#F7F8F5] p-3 space-y-1.5 text-[12px]">
              <div className="flex justify-between text-[#5F6D59]">
                <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
                <span className="font-bold">{formatCurrency(subtotal)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-green-700">
                  <span>{appliedCoupon.code} -{appliedCoupon.percentage}%</span>
                  <span className="font-bold">-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              {manualDiscountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount ({manualDiscountType === 'percent' ? `${manualDiscountValue}%` : 'Flat'})</span>
                  <span className="font-bold">-{formatCurrency(manualDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#5F6D59] items-center">
                <span>Delivery</span>
                <input
                  type="number"
                  value={shipping}
                  onChange={e => setShipping(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-20 text-right px-2 py-0.5 rounded-lg border border-[#D5DAD0] bg-white text-[12px] outline-none focus:border-[#7DAA8F]"
                />
              </div>
              <div className="flex justify-between font-black text-[#2C392A] text-[14px] pt-1.5 border-t border-[#D5DAD0]">
                <span>Grand Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment section */}
            <div className={`rounded-xl border-2 p-3 space-y-2 transition-colors ${
              isInsufficientPayment ? 'border-red-300 bg-red-50/30' :
              cashReceivedNum >= total && cashReceivedNum > 0 ? 'border-green-300 bg-green-50/30' :
              'border-[#2C392A]/20 bg-[#F7F8F5]'
            }`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F6D59]">Cash Payment</p>
              <div>
                <label className="block text-[10px] font-bold text-[#5F6D59] mb-1">Amount Received (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={cashReceived}
                  onChange={e => { setCashReceived(e.target.value.replace(/[^0-9.]/g, '')); setError('') }}
                  placeholder="0.00"
                  className={`w-full text-[20px] font-black px-3 py-2 border-2 rounded-xl outline-none transition-colors ${
                    isInsufficientPayment
                      ? 'border-red-400 bg-white text-red-700 focus:border-red-500'
                      : cashReceivedNum >= total && cashReceivedNum > 0
                        ? 'border-green-400 bg-white text-green-800 focus:border-green-500'
                        : 'border-[#D5DAD0] bg-white text-[#2C392A] focus:border-[#2C392A]'
                  }`}
                />
              </div>

              {cashReceivedNum > 0 && (
                isInsufficientPayment ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-[11px] font-black text-red-600">⚠ Insufficient Payment</p>
                    <p className="text-[10px] text-red-500 mt-0.5">
                      Still need: {formatCurrency(total - cashReceivedNum)}
                    </p>
                  </div>
                ) : balanceToReturn === 0 ? (
                  <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                    <p className="text-[11px] font-black text-green-700 text-center">✅ Exact Amount</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] font-black text-blue-700">Balance to Return</p>
                      <p className="text-[18px] font-black text-blue-700">{formatCurrency(balanceToReturn)}</p>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[#5F6D59]">
              <span className={`px-2 py-0.5 rounded-full ${orderMode === 'offline' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                {orderMode === 'offline' ? 'OFFLINE' : 'ONLINE'}
              </span>
            </div>
            <button
              onClick={generateBill}
              disabled={saving || items.length === 0 || isInsufficientPayment || !cashReceived.trim()}
              className="w-full py-3.5 rounded-xl font-black text-[13px] transition-all
                bg-[#2C392A] text-white hover:bg-[#1e2817]
                disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 shadow-md"
            >
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                : <><Receipt size={16} /> Generate Bill</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
