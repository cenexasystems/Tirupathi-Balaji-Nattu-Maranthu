import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, ShoppingCart, Star, Plus, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCartStore, useFavStore, type Product } from '../store/store'
import { useLangStore } from '../store/langStore'
import { formatCurrency, calculateLineTotal, type QuantityOption } from '../lib/retail'

// Converts a raw base quantity into a clean display string
// e.g. formatBaseQty(100, 'g') → '100g' | formatBaseQty(1000, 'g') → '1kg'
function formatBaseQty(qty: number, unit: string): string {
  if (unit === 'g' && qty >= 1000) return `${qty / 1000}kg`
  if (unit === 'ml' && qty >= 1000) return `${qty / 1000}L`
  return `${qty}${unit}`
}

// ── Per-keyword image map — overrides generic DB images ──────────────
const KW_IMAGES: Array<{ kw: string[]; url: string }> = [
  { kw: ['turmeric', 'manjal', 'haldi'],
    url: 'https://images.unsplash.com/photo-1615485291234-9d694218aeb5?auto=format&fit=crop&w=400&q=80' },
  { kw: ['neem', 'veppalai', 'vepp'],
    url: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80' },
  { kw: ['tulsi', 'thulasi', 'basil'],
    url: 'https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?auto=format&fit=crop&w=400&q=80' },
  { kw: ['moringa', 'murungai', 'drumstick'],
    url: 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?auto=format&fit=crop&w=400&q=80' },
  { kw: ['honey', 'then'],
    url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=400&q=80' },
  { kw: ['ginger', 'sukku', 'inji'],
    url: 'https://images.unsplash.com/photo-1588543385566-60f2039da2e2?auto=format&fit=crop&w=400&q=80' },
  { kw: ['pepper', 'milagu'],
    url: 'https://images.unsplash.com/photo-1599909533731-f5f6c1fbd5ff?auto=format&fit=crop&w=400&q=80' },
  { kw: ['cardamom', 'elakkai', 'elaichi'],
    url: 'https://images.unsplash.com/photo-1514191893769-d44de1f4ac22?auto=format&fit=crop&w=400&q=80' },
  { kw: ['cinnamon', 'pattai'],
    url: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80' },
  { kw: ['clove', 'lavangam', 'kirambu'],
    url: 'https://images.unsplash.com/photo-1600628421060-9a851ea69c5c?auto=format&fit=crop&w=400&q=80' },
  { kw: ['amla', 'nellikkai', 'gooseberry'],
    url: 'https://images.unsplash.com/photo-1612871689552-be7ef6f50d0e?auto=format&fit=crop&w=400&q=80' },
  { kw: ['ashwagandha', 'shatavari', 'sathavari'],
    url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80' },
  { kw: ['fenugreek', 'vendhayam', 'methi'],
    url: 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=400&q=80' },
  { kw: ['cumin', 'seeragam', 'jeeragam', 'jeera'],
    url: 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=400&q=80' },
  { kw: ['fennel', 'sombu'],
    url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80' },
  { kw: ['sesame', 'ellu', 'til'],
    url: 'https://images.unsplash.com/photo-1595591996854-3b82ac8b6f65?auto=format&fit=crop&w=400&q=80' },
  { kw: ['camphor', 'karpooram'],
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80' },
  { kw: ['sandalwood', 'sandhanam', 'sandal'],
    url: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?auto=format&fit=crop&w=400&q=80' },
  { kw: ['incense', 'agarbatti', 'agarbathi'],
    url: 'https://images.unsplash.com/photo-1603204077167-2fa0397f5264?auto=format&fit=crop&w=400&q=80' },
  { kw: ['lotus', 'thamarai'],
    url: 'https://images.unsplash.com/photo-1559181567-c3190ca9d713?auto=format&fit=crop&w=400&q=80' },
  { kw: ['ghee', 'nei', 'clarified'],
    url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80' },
  { kw: ['rose', 'panneer', 'rosewater'],
    url: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=400&q=80' },
  { kw: ['coconut', 'thengai'],
    url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=400&q=80' },
  { kw: ['castor', 'vilakk'],
    url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80' },
  { kw: ['brahmi'],
    url: 'https://images.unsplash.com/photo-1587411768638-ec71f8e33b78?auto=format&fit=crop&w=400&q=80' },
  { kw: ['rice', 'pacharisi'],
    url: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=400&q=80' },
  { kw: ['ulundhu', 'urad', 'lentil', 'paruppu', 'dal'],
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80' },
  { kw: ['sugar', 'kalkandu', 'candy'],
    url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80' },
  { kw: ['oil', 'ennai'],
    url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80' },
  { kw: ['triphala', 'brahmi podi'],
    url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80' },
  { kw: ['kungumam', 'kumkum', 'vermilion'],
    url: 'https://images.unsplash.com/photo-1568214379698-8aeb8c6c6ac8?auto=format&fit=crop&w=400&q=80' },
  { kw: ['vibhoothi', 'vibhuti', 'thiruneer', 'thiru neeru'],
    url: 'https://images.unsplash.com/photo-1591189863430-ab87e120f312?auto=format&fit=crop&w=400&q=80' },
]

const CATEGORY_FALLBACK: Record<string, string> = {
  'Pooja Items':         'https://images.unsplash.com/photo-1567335743949-70f2b6b6e36d?auto=format&fit=crop&w=400&q=80',
  'Herbal Powder':       'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
  'Herbal Oil':          'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
  'Spices & Condiments': 'https://images.unsplash.com/photo-1532944138793-3a7bab2b5c1c?auto=format&fit=crop&w=400&q=80',
  'Grains & Pulses':     'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
  'Honey & Liquids':     'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=400&q=80',
  'Bundle Packages':     'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
}
const GLOBAL_FALLBACK = 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80'

function resolveImage(name: string, category: string): string {
  const hay = name.toLowerCase()
  for (const { kw, url } of KW_IMAGES) {
    if (kw.some(k => hay.includes(k))) return url
  }
  return CATEGORY_FALLBACK[category] || GLOBAL_FALLBACK
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem, add } = useCartStore()
  const { toggle, isFav } = useFavStore()
  const { lang } = useLangStore()
  const fav = isFav(product.id)

  const hasOptions =
    (product.unitType === 'weight' || product.unitType === 'volume') &&
    product.predefinedOptions.length > 0

  const [selectedOpt, setSelectedOpt] = useState<QuantityOption | null>(
    hasOptions ? product.predefinedOptions[0] : null
  )
  const [qty, setQty] = useState(1)

  const basePrice = product.offerPrice && product.offerPrice < product.price
    ? product.offerPrice
    : product.price
  const discount = product.offerPrice && product.offerPrice < product.price
    ? Math.round(((product.price - product.offerPrice) / product.price) * 100)
    : 0

  const displayPrice = hasOptions && selectedOpt
    ? calculateLineTotal(selectedOpt.quantity, product.unitType, product.baseQuantity, basePrice)
    : basePrice

  const displayOriginalPrice = hasOptions && selectedOpt && discount > 0
    ? calculateLineTotal(selectedOpt.quantity, product.unitType, product.baseQuantity, product.price)
    : null

  const displayName = lang === 'ta' && (product.nameTa || product.tamilName)
    ? (product.nameTa || product.tamilName)!
    : product.name

  const handleAddToCart = () => {
    if (hasOptions && selectedOpt) {
      addItem(product, selectedOpt.quantity, selectedOpt.unit)
    } else if (product.unitType === 'unit' || product.unitType === 'bundle') {
      addItem(product, qty, product.unitLabel)
    } else {
      add(product)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#EAD7B7]/50 bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Wishlist */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => void toggle(product)}
        className={`absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
          fav ? 'border-rose-200 bg-rose-50' : 'border-[#EAD7B7] bg-white/90'
        }`}
        type="button"
        aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
      >
        <Heart size={13} className={fav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
      </motion.button>

      {/* Discount badge */}
      {discount > 0 && (
        <div className="absolute left-2.5 top-2.5 z-10 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white">
          {discount}% OFF
        </div>
      )}

      {/* Image — keyword-matched first, then DB image, then category fallback */}
      <Link to={`/product/${product.id}`} className="block aspect-square w-full overflow-hidden bg-[#F7F6F2]">
        <img
          src={resolveImage(product.name, product.category)}
          alt={product.name}
          loading="lazy"
          onError={e => {
            const img = e.target as HTMLImageElement
            img.src = CATEGORY_FALLBACK[product.category] || GLOBAL_FALLBACK
          }}
          className="h-full w-full object-cover transition-transform duration-400 group-hover:scale-105"
        />
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-3.5">
        {/* Category */}
        <span className="truncate text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-[#7DAA8F]">
          {product.category}
        </span>

        {/* Name */}
        <Link to={`/product/${product.id}`}>
          <h3 className="line-clamp-2 min-h-[2.25rem] text-[12px] sm:text-[13px] font-bold leading-[1.35] text-[#2C392A] hover:text-[#7DAA8F] transition-colors">
            {displayName}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
          <span className="font-semibold text-slate-700">{(product.rating || 4.7).toFixed(1)}</span>
          <span className="text-slate-400">·</span>
          <span className="truncate text-[10px] tabular-nums">
            {product.unitType === 'weight'
              ? `${formatCurrency(basePrice)}/${formatBaseQty(product.baseQuantity, 'g')}`
              : product.unitType === 'volume'
              ? `${formatCurrency(basePrice)}/${formatBaseQty(product.baseQuantity, 'ml')}`
              : product.unitType === 'bundle'
              ? 'per bundle'
              : `${formatCurrency(basePrice)}/pc`}
          </span>
        </div>

        {/* Weight / Volume Option Pills */}
        {hasOptions && selectedOpt && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {product.predefinedOptions.map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedOpt(opt)}
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-colors border ${
                  selectedOpt.label === opt.label
                    ? 'bg-[#2C392A] text-white border-[#2C392A]'
                    : 'bg-[#F7F6F2] text-[#5F6D59] border-[#EAD7B7]/60 hover:border-[#7DAA8F]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Unit product qty stepper */}
        {(product.unitType === 'unit' || product.unitType === 'bundle') && (
          <div className="flex items-center gap-1 mt-0.5">
            <button
              type="button"
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-6 h-6 rounded-lg bg-[#F7F6F2] border border-[#EAD7B7]/60 flex items-center justify-center text-[#5F6D59] hover:bg-[#7DAA8F]/10 transition-colors"
            >
              <Minus size={10} />
            </button>
            <span className="min-w-[1.5rem] text-center text-[12px] font-bold text-[#2C392A]">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(q => q + 1)}
              className="w-6 h-6 rounded-lg bg-[#F7F6F2] border border-[#EAD7B7]/60 flex items-center justify-center text-[#5F6D59] hover:bg-[#7DAA8F]/10 transition-colors"
            >
              <Plus size={10} />
            </button>
          </div>
        )}

        {/* Price + Add button */}
        <div className="mt-auto flex items-center justify-between border-t border-[#EAD7B7]/40 pt-2.5 gap-2">
          <div className="flex flex-col min-w-0">
            {displayOriginalPrice && (
              <span className="text-[10px] text-slate-400 line-through leading-none">
                {formatCurrency(displayOriginalPrice)}
              </span>
            )}
            <span className="text-[14px] sm:text-[15px] font-black text-[#2C392A] leading-tight tabular-nums">
              {formatCurrency(displayPrice)}
            </span>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleAddToCart}
            type="button"
            className="shrink-0 flex items-center gap-1 rounded-xl bg-[#7DAA8F] hover:bg-[#5e8c72] text-white px-2.5 sm:px-3 py-2 text-[11px] font-bold transition-colors touch-target"
          >
            <ShoppingCart size={12} />
            <span className="hidden sm:inline">Add</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
