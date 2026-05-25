import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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

function getCompactPackOptions(product: Product): QuantityOption[] {
  if (product.predefinedOptions.length > 0) return product.predefinedOptions
  if (product.unitType === 'weight') {
    return [
      { quantity: 100, unit: 'g', label: '100g' },
      { quantity: 250, unit: 'g', label: '250g' },
      { quantity: 500, unit: 'g', label: '500g' },
    ]
  }
  if (product.unitType === 'volume') {
    return [
      { quantity: 500, unit: 'ml', label: '500ml' },
      { quantity: 1000, unit: 'ml', label: '1L' },
    ]
  }
  return []
}

export default function ProductCard({
  product,
}: {
  product: Product
}) {
  const { addItem, add, removeItem, updateQuantity } = useCartStore()
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
  const [mobileQty, setMobileQty] = useState(0)

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

  const handleMobileAdd = () => {
    if (hasOptions && selectedOpt) {
      addItem(product, selectedOpt.quantity, selectedOpt.unit)
    } else {
      addItem(product, 1, product.unitLabel)
    }
    setMobileQty(1)
  }

  const handleMobileChangeQty = (nextQty: number) => {
    if (nextQty <= 0) {
      removeItem(product.id)
      setMobileQty(0)
      return
    }

    const cartQty = hasOptions && selectedOpt ? nextQty * selectedOpt.quantity : nextQty

    if (mobileQty <= 0) {
      addItem(product, cartQty, hasOptions && selectedOpt ? selectedOpt.unit : product.unitLabel)
    } else {
      updateQuantity(product.id, cartQty)
    }

    setMobileQty(nextQty)
  }

  const handleMobilePackChange = (option: QuantityOption) => {
    if (!hasOptions || option.label === selectedOpt?.label) return
    const currentQty = mobileQty
    setSelectedOpt(option)
    if (currentQty > 0) {
      removeItem(product.id)
      addItem(product, currentQty * option.quantity, option.unit)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex h-full flex-col overflow-hidden surface-panel-compact transition-shadow hover:shadow-[0_14px_32px_rgba(44,57,42,0.12)]"
    >
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => void toggle(product)}
        className={`hidden lg:flex touch-target absolute right-1.5 top-1.5 z-10 items-center justify-center rounded-full border transition-colors ${
          fav ? 'border-rose-200 bg-rose-50' : 'border-[#EAD7B7] bg-white/90'
        }`}
        type="button"
        aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
      >
        <Heart size={13} className={fav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
      </motion.button>

      {discount > 0 && (
        <div className="hidden lg:block absolute left-2.5 top-2.5 z-10 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white">
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

      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3.5">
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

        <div className="lg:hidden flex flex-1 flex-col gap-1.5 pt-0.5">
          <button type="button" onClick={handleOpen} className="text-left">
            <h3 className="line-clamp-2 min-h-[2.5rem] text-[12px] font-bold leading-[1.45] text-[#2C392A] transition-colors ta-text">
              {displayName}
            </h3>
          </button>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              {displayOriginalPrice && (
                <span className="block text-[10px] text-slate-400 line-through leading-none">
                  {formatCurrency(displayOriginalPrice)}
                </span>
              )}
              <span className="block text-[13px] font-black text-[#2C392A] leading-tight tabular-nums">
                {formatCurrency(displayPrice)}
              </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mobileQty === 0 ? (
              <motion.button
                key="mobile-add"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleMobileAdd}
                type="button"
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2C392A] px-4 py-2.5 text-[12px] font-black text-white shadow-[0_10px_20px_rgba(44,57,42,0.16)]"
              >
                <ShoppingCart size={13} />
                Add
              </motion.button>
            ) : (
              <motion.div
                key="mobile-stepper"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
                className="mt-auto space-y-2"
              >
                {hasOptions && selectedOpt && (
                  <div className="flex gap-1 overflow-x-auto hide-scrollbar pb-0.5">
                    {getCompactPackOptions(product).map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => handleMobilePackChange(opt)}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black transition-colors ${
                          selectedOpt.label === opt.label
                            ? 'border-[#2C392A] bg-[#2C392A] text-white'
                            : 'border-[#EAD7B7]/60 bg-[#F7F6F2] text-[#5F6D59]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="inline-flex items-center justify-between gap-2 rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-[#EAD7B7]/55">
                  <button
                    type="button"
                    onClick={() => handleMobileChangeQty(mobileQty - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F6F2] text-[#5F6D59]"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="min-w-[1.6rem] text-center text-[12px] font-black text-[#2C392A]">{mobileQty}</span>
                  <button
                    type="button"
                    onClick={() => handleMobileChangeQty(mobileQty + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F6F2] text-[#5F6D59]"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden lg:flex flex-1 flex-col gap-1.5">
          <span className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[#7DAA8F]">
            {product.category}
          </span>

          <button type="button" onClick={handleOpen} className="text-left">
            <h3 className="line-clamp-2 min-h-[2.55rem] text-[11.5px] sm:text-[13px] font-bold leading-[1.6] text-[#2C392A] hover:text-[#7DAA8F] transition-colors ta-text">
              {displayName}
            </h3>
          </button>

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
      </div>
    </motion.div>
  )
}
