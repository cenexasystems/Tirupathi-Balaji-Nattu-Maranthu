import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, ShoppingCart, Star, Plus, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCartStore, useFavStore, type Product } from '../store/store'
import { useLangStore } from '../store/langStore'
import { formatCurrency, calculateLineTotal, type QuantityOption } from '../lib/retail'
import { getProductImage, onImgError } from '../lib/productImages'

function formatBaseQty(qty: number, unit: string): string {
  if (unit === 'g' && qty >= 1000) return `${qty / 1000}kg`
  if (unit === 'ml' && qty >= 1000) return `${qty / 1000}L`
  return `${qty}${unit}`
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

      {/* Image — stable aspect-ratio container prevents layout shift */}
      <Link to={`/product/${product.id}`} className="block aspect-square w-full overflow-hidden bg-[#E8EDE4]">
        <img
          src={getProductImage(product.name, product.category, product.imageUrl, 'card')}
          alt={product.name}
          loading="lazy"
          decoding="async"
          onError={onImgError}
          className="h-full w-full object-cover transition-transform duration-400 group-hover:scale-105"
        />
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-3.5">
        {/* Category */}
        <span className="truncate text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-[#7DAA8F]">
          {product.category}
        </span>

        {/* Name — min-h accommodates 2 Tamil lines at 1.65 line-height */}
        <Link to={`/product/${product.id}`}>
          <h3 className="line-clamp-2 min-h-[2.75rem] text-[12px] sm:text-[13px] font-bold leading-[1.65] text-[#2C392A] hover:text-[#7DAA8F] transition-colors ta-text">
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
