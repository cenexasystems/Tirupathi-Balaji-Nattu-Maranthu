import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, ShoppingCart, Star, Plus, Minus } from 'lucide-react'
import { useCartStore, useFavStore, useProductModalStore, type Product } from '../store/store'
import { useLangStore } from '../store/langStore'
import { formatCurrency, calculateLineTotal, type QuantityOption } from '../lib/retail'
import { getProductImage, onImgError } from '../lib/productImages'

function formatBaseQty(qty: number, unit: string): string {
  if (unit === 'g' && qty >= 1000) return `${qty / 1000}kg`
  if (unit === 'ml' && qty >= 1000) return `${qty / 1000}L`
  return `${qty}${unit}`
}

export default function ProductCard({
  product,
}: {
  product: Product
}) {
  const { addItem, add } = useCartStore()
  const { toggle, isFav } = useFavStore()
  const openProduct = useProductModalStore((state) => state.openProduct)
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

  const handleOpen = () => {
    openProduct(product)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex h-full flex-col overflow-hidden surface-panel-compact transition-shadow hover:shadow-[0_14px_32px_rgba(44,57,42,0.12)]"
    >
      {/* Wishlist */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => void toggle(product)}
        className={`touch-target absolute right-1.5 top-1.5 z-10 flex items-center justify-center rounded-full border transition-colors ${
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
        <button
        type="button"
        onClick={handleOpen}
          className="block aspect-[1/1.02] w-full overflow-hidden bg-[#E8EDE4] text-left sm:aspect-square"
      >
        <img
          src={getProductImage(product.name, product.category, product.imageUrl, 'card')}
          alt={product.name}
          loading="lazy"
          decoding="async"
          sizes="(max-width: 640px) 50vw, 280px"
          onError={onImgError}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      </button>

      {/* Content */}
        <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3.5">
        {/* Category */}
        <span className="truncate text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-[#7DAA8F]">
          {product.category}
        </span>

        {/* Name — min-h accommodates 2 Tamil lines at 1.65 line-height */}
        <button type="button" onClick={handleOpen} className="text-left">
            <h3 className="line-clamp-2 min-h-[2.55rem] text-[11.5px] sm:text-[13px] font-bold leading-[1.6] text-[#2C392A] hover:text-[#7DAA8F] transition-colors ta-text">
            {displayName}
          </h3>
        </button>

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
          <div className="flex gap-1 overflow-x-auto hide-scrollbar mt-0.5 pb-0.5">
            {product.predefinedOptions.map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedOpt(opt)}
                className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold transition-colors border ${
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
              className="touch-target w-6 h-6 rounded-lg bg-[#F7F6F2] border border-[#EAD7B7]/60 flex items-center justify-center text-[#5F6D59] hover:bg-[#7DAA8F]/10 transition-colors"
            >
              <Minus size={10} />
            </button>
            <span className="min-w-[1.5rem] text-center text-[12px] font-bold text-[#2C392A]">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(q => q + 1)}
              className="touch-target w-6 h-6 rounded-lg bg-[#F7F6F2] border border-[#EAD7B7]/60 flex items-center justify-center text-[#5F6D59] hover:bg-[#7DAA8F]/10 transition-colors"
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
              <span className="text-[13px] sm:text-[15px] font-black text-[#2C392A] leading-tight tabular-nums">
              {formatCurrency(displayPrice)}
            </span>
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
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
