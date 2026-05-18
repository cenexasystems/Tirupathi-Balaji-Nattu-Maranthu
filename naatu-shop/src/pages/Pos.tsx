import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Trash2, Plus, Minus, Receipt, Printer,
  RefreshCw, ChevronLeft, ShoppingBag, MessageCircle,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useProductStore, type Product } from '../store/store'
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

// ── Types ──────────────────────────────────────────────────────────────────
type PosItem = Product & {
  qty: number
  selectedUnit: string
  basePrice: number
  lineTotal: number
}

type InvoiceSnap = {
  id: string
  invoiceNo: string
  date: string
  items: PosItem[]
  subtotal: number
  shipping: number
  total: number
  customerName: string
  phone: string
  address: string
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

// Keyword-based image for product tile
const KW_IMG: Array<{ kw: string[]; url: string }> = [
  { kw: ['turmeric', 'manjal', 'haldi'], url: 'https://images.unsplash.com/photo-1615485291234-9d694218aeb5?auto=format&fit=crop&w=120&q=70' },
  { kw: ['neem', 'veppalai', 'vepp'], url: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=120&q=70' },
  { kw: ['honey', 'then'], url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=120&q=70' },
  { kw: ['camphor', 'karpooram'], url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=120&q=70' },
  { kw: ['tulsi', 'thulasi', 'basil'], url: 'https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?auto=format&fit=crop&w=120&q=70' },
  { kw: ['pepper', 'milagu'], url: 'https://images.unsplash.com/photo-1599909533731-f5f6c1fbd5ff?auto=format&fit=crop&w=120&q=70' },
  { kw: ['cardamom', 'elakkai', 'elaichi'], url: 'https://images.unsplash.com/photo-1514191893769-d44de1f4ac22?auto=format&fit=crop&w=120&q=70' },
  { kw: ['cinnamon', 'pattai'], url: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=120&q=70' },
  { kw: ['clove', 'lavangam', 'kirambu'], url: 'https://images.unsplash.com/photo-1600628421060-9a851ea69c5c?auto=format&fit=crop&w=120&q=70' },
  { kw: ['oil', 'ennai'], url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=120&q=70' },
  { kw: ['rice', 'pacharisi'], url: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=120&q=70' },
  { kw: ['dal', 'paruppu', 'lentil', 'ulundhu'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=120&q=70' },
  { kw: ['moringa', 'murungai', 'drumstick'], url: 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?auto=format&fit=crop&w=120&q=70' },
  { kw: ['ginger', 'sukku', 'inji'], url: 'https://images.unsplash.com/photo-1588543385566-60f2039da2e2?auto=format&fit=crop&w=120&q=70' },
  { kw: ['lotus', 'thamarai'], url: 'https://images.unsplash.com/photo-1559181567-c3190ca9d713?auto=format&fit=crop&w=120&q=70' },
  { kw: ['incense', 'agarbatti', 'agarbathi'], url: 'https://images.unsplash.com/photo-1603204077167-2fa0397f5264?auto=format&fit=crop&w=120&q=70' },
  { kw: ['ghee', 'nei'], url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=120&q=70' },
  { kw: ['coconut', 'thengai'], url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=120&q=70' },
  { kw: ['kungumam', 'kumkum', 'vermilion'], url: 'https://images.unsplash.com/photo-1568214379698-8aeb8c6c6ac8?auto=format&fit=crop&w=120&q=70' },
  { kw: ['vibhoothi', 'vibhuti', 'thiruneer', 'thiru neeru'], url: 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?auto=format&fit=crop&w=120&q=70' },
  { kw: ['sandalwood', 'sandhanam', 'sandal'], url: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?auto=format&fit=crop&w=120&q=70' },
  { kw: ['vilakku', 'deepam', 'lamp', 'diya', 'thiri'], url: 'https://images.unsplash.com/photo-1567335743949-70f2b6b6e36d?auto=format&fit=crop&w=120&q=70' },
  { kw: ['poo', 'varisai', 'arugu', 'flower'], url: 'https://images.unsplash.com/photo-1490750967868-88df5691cc6b?auto=format&fit=crop&w=120&q=70' },
  { kw: ['navagraha', 'padam', 'swami'], url: 'https://images.unsplash.com/photo-1567335743949-70f2b6b6e36d?auto=format&fit=crop&w=120&q=70' },
  { kw: ['amla', 'nellikkai', 'gooseberry'], url: 'https://images.unsplash.com/photo-1612871689552-be7ef6f50d0e?auto=format&fit=crop&w=120&q=70' },
  { kw: ['fenugreek', 'vendhayam', 'methi'], url: 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=120&q=70' },
  { kw: ['fennel', 'sombu'], url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=120&q=70' },
  { kw: ['sesame', 'ellu', 'til'], url: 'https://images.unsplash.com/photo-1595591996854-3b82ac8b6f65?auto=format&fit=crop&w=120&q=70' },
  { kw: ['rose', 'panneer', 'rosewater'], url: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=120&q=70' },
  { kw: ['sugar', 'kalkandu', 'candy'], url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=120&q=70' },
  { kw: ['brahmi', 'ashwagandha', 'shatavari', 'sathavari'], url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=120&q=70' },
  { kw: ['castor', 'vilakk'], url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=120&q=70' },
  { kw: ['cumin', 'seeragam', 'jeeragam', 'jeera'], url: 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=120&q=70' },
  { kw: ['triphala', 'trikatu'], url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=120&q=70' },
]
const CAT_FB: Record<string, string> = {
  'Pooja Items': 'https://images.unsplash.com/photo-1567335743949-70f2b6b6e36d?auto=format&fit=crop&w=120&q=70',
  'Herbal Powder': 'https://images.unsplash.com/photo-1615485291234-9d694218aeb5?auto=format&fit=crop&w=120&q=70',
  'Herbal Oil': 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=120&q=70',
  'Spices & Condiments': 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=120&q=70',
  'Grains & Pulses': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=120&q=70',
  'Honey & Liquids': 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=120&q=70',
  'Bundle Packages': 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=120&q=70',
}
function tileImage(p: Product) {
  const hay = p.name.toLowerCase()
  for (const { kw, url } of KW_IMG) if (kw.some(k => hay.includes(k))) return url
  return CAT_FB[p.category] || 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=120&q=70'
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

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [items, setItems] = useState<PosItem[]>([])
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState<InvoiceSnap | null>(null)
  const [cashReceived, setCashReceived] = useState<string>('')
  const [mobilePanelView, setMobilePanelView] = useState<'catalogue' | 'bill'>('catalogue')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetchProducts()
    if (!isSupabaseConfigured) return
    const ch = supabase.channel('pos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void fetchProducts())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [fetchProducts])

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
  const total = subtotal

  const itemQtyMap = useMemo(() => {
    const m: Record<string | number, number> = {}
    items.forEach(i => { m[i.id] = i.qty })
    return m
  }, [items])

  // ── Cart actions ──────────────────────────────────────────────────────
  const addItem = (product: Product) => {
    setError('')
    setMobilePanelView('catalogue')
    setItems(cur => {
      const ex = cur.find(i => i.id === product.id)
      if (!ex) return [...cur, makePosItem(product)]
      const inc = ex.unitType === 'unit' || ex.unitType === 'bundle' ? 1 : ex.baseQuantity
      return cur.map(i => i.id === product.id ? recalc(i, i.qty + inc) : i)
    })
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
    setError('')
    searchRef.current?.focus()
  }

  // ── Generate bill ─────────────────────────────────────────────────────
  const generateBill = async () => {
    if (!items.length) { setError('Add at least one product.'); return }
    setSaving(true); setError('')
    try {
      const created = await createOrderWithStock({
        customerName: customer.name.trim() || 'Walk-in Customer',
        phone: customer.phone.trim() || '0000000000',
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
        })),
        shipping: 0,
        status: 'completed',
      })
      setInvoice({
        id: created.orderId,
        invoiceNo: created.invoiceNo,
        date: created.createdAt,
        items: [...items],
        subtotal,
        shipping: 0,
        total,
        customerName: customer.name.trim() || 'Walk-in Customer',
        phone: customer.phone.trim() || '',
        address: customer.address.trim() || 'POS Counter',
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

  const change = cashReceived && Number(cashReceived) >= total
    ? Number(cashReceived) - total : null

  const sendPosWhatsApp = (inv: InvoiceSnap) => {
    const lines = inv.items
      .map(i => `• ${i.name} × ${formatQuantityDisplay(i.qty, i.selectedUnit, i.unitType)} = ${formatCurrency(i.lineTotal)}`)
      .join('\n')
    const text = encodeURIComponent(
      `🌿 *${BRAND_EN}*\n` +
      `📋 *Invoice:* ${inv.invoiceNo}\n` +
      (inv.customerName !== 'Walk-in Customer' ? `👤 *Customer:* ${inv.customerName}\n` : '') +
      (inv.phone ? `📞 ${inv.phone}\n` : '') +
      `\n${lines}\n\n` +
      `*Total: ${formatCurrency(inv.total)}*\n\n` +
      `நன்றி! | Thank you! 🙏`
    )
    window.open(`${BRAND_WHATSAPP_LINK}?text=${text}`, '_blank')
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
      <div className="bg-bgMain min-h-screen print:bg-white print:min-h-0">
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

          {/* Total summary */}
          <div className="bg-white rounded-2xl border border-sand/50 p-5 shadow-soft">
            <div className="flex justify-between items-center mb-4">
              <p className="text-lg font-bold text-textMain">Total Amount</p>
              <p className="text-3xl font-black text-sageDark">{formatCurrency(invoice.total)}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-textMuted uppercase tracking-wide mb-1.5">
                  Cash Received (₹)
                </label>
                <input
                  type="number"
                  autoFocus
                  placeholder="0"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  className="w-full text-2xl font-black px-4 py-3 border-2 border-sand focus:border-sageDark rounded-xl outline-none"
                />
              </div>

              {change !== null && (
                <div className={`rounded-xl p-4 ${change === 0 ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                  <p className="text-xs font-bold uppercase tracking-wide text-textMuted mb-1">
                    {change === 0 ? 'Exact Amount ✅' : 'Change to Return'}
                  </p>
                  {change > 0 && <p className="text-2xl font-black text-blue-700">{formatCurrency(change)}</p>}
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
          <div className="bg-white rounded-2xl border border-sand/50 p-4 shadow-soft">
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
    <div className="bg-[#F0F2EE] h-screen flex flex-col overflow-hidden print:hidden">

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
        <div className={`flex flex-col flex-1 overflow-hidden border-r border-[#D5DAD0] ${mobilePanelView === 'bill' ? 'hidden md:flex' : ''}`}>

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

                      {/* Category colour strip */}
                      <div className="h-1 w-full shrink-0" style={{ backgroundColor: CAT_COLOR[product.category] || '#7DAA8F' }} />

                      {/* Image */}
                      <div className="w-full aspect-square overflow-hidden bg-[#F7F6F2] shrink-0">
                        <img
                          src={tileImage(product)}
                          alt={product.name}
                          loading="lazy"
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
                          {formatCurrency(price)}
                          <span className="text-[9px] font-medium text-[#5F6D59] ml-0.5">
                            /{product.unitType === 'unit' ? 'pc' : product.unitType === 'bundle' ? 'bundle' : product.unitLabel}
                          </span>
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
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
              onChange={e => setCustomer(c => ({ ...c, phone: e.target.value.replace(/\D/g, '') }))}
              placeholder="Phone (optional)"
              maxLength={10}
              className="w-full px-3 py-1.5 bg-[#F0F2EE] rounded-lg text-[12px] outline-none border border-transparent focus:border-[#7DAA8F]"
            />
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
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
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
          <div className="border-t border-[#E8EDE4] px-3 py-3 shrink-0 space-y-2.5">
            {error && (
              <p className="text-[11px] text-red-500 font-bold bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="space-y-1 text-[12px]">
              <div className="flex justify-between text-[#5F6D59]">
                <span>Items</span>
                <span className="font-bold">{items.length}</span>
              </div>
              <div className="flex justify-between font-black text-[#2C392A] text-[16px] pt-1 border-t border-[#E8EDE4]">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <button
              onClick={generateBill}
              disabled={saving || items.length === 0}
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
