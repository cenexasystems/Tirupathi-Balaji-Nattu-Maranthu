import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Minus, PackageCheck, Plus, ShoppingCart, Sparkles, Star } from 'lucide-react'
import { useCartStore, useFavStore, type Product } from '../store/store'
import { useLangStore } from '../store/langStore'
import {
  calculateLineTotal,
  convertQuantityByUnitType,
  formatCompactQuantity,
  formatCurrency,
  formatPricePerUnit,
  getDefaultQuantityForProduct,
  getQuantityStepForProduct,
  normalizeSelectedQuantity,
} from '../lib/retail'
import { getProductImage, onImgError } from '../lib/productImages'

const HIGHLIGHTS = [
  { label: 'Traditionally Prepared', icon: Sparkles },
  { label: 'Premium Ingredients', icon: Star },
  { label: 'Carefully Packed', icon: PackageCheck },
  { label: 'Temple Essential', icon: Sparkles },
]

const getUnitOptions = (product: Product) => {
  if (product.unitType === 'weight') {
    return product.unitLabel === 'kg' ? ['kg', 'g'] : ['g', 'kg']
  }
  if (product.unitType === 'volume') {
    return product.unitLabel === 'l' ? ['l', 'ml'] : ['ml', 'l']
  }
  return [product.unitLabel]
}

const buildUsageNote = (product: Product) => {
  if (product.unitType === 'weight' || product.unitType === 'volume') {
    return 'Use as per traditional practice. Store in a cool, dry place away from moisture.'
  }
  return 'Use as per traditional practice. Store in a clean, dry place.'
}

export default function ProductDetailModal({
  product,
  open,
  onClose,
  onSelectProduct,
  relatedProducts,
}: {
  product: Product | null
  open: boolean
  onClose: () => void
  onSelectProduct?: (product: Product) => void
  relatedProducts: Product[]
}) {
  const { addItem } = useCartStore()
  const { toggle, isFav } = useFavStore()
  const { t } = useLangStore()
  const [displayUnit, setDisplayUnit] = useState<string>('')
  const [displayQty, setDisplayQty] = useState<number>(1)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!product) return
    setDisplayUnit(product.unitLabel)
    setDisplayQty(
      getDefaultQuantityForProduct({
        unitType: product.unitType,
        baseQuantity: product.baseQuantity,
        predefinedOptions: product.predefinedOptions,
      }),
    )
  }, [product])

  const basePrice = product
    ? (product.offerPrice && product.offerPrice < product.price ? product.offerPrice : product.price)
    : 0

  const hasDiscount = !!(product && product.offerPrice && product.offerPrice < product.price)
  const discount = product && hasDiscount
    ? Math.round(((product.price - product.offerPrice!) / product.price) * 100)
    : 0

  const unitOptions = useMemo(() => (product ? getUnitOptions(product) : []), [product])
  const stepBase = product
    ? getQuantityStepForProduct({
        unitType: product.unitType,
        baseQuantity: product.baseQuantity,
        allowDecimalQuantity: product.allowDecimalQuantity,
      })
    : 1
  const stepDisplay = product
    ? convertQuantityByUnitType(stepBase, product.unitLabel, displayUnit || product.unitLabel, product.unitType)
    : 1

  const normalizedQuantity = product
    ? normalizeSelectedQuantity(
        product.unitType === 'unit' || product.unitType === 'bundle'
          ? Math.max(1, Math.round(displayQty))
          : convertQuantityByUnitType(displayQty, displayUnit, product.unitLabel, product.unitType),
        product.unitType,
        product.allowDecimalQuantity,
        product.unitType === 'unit' || product.unitType === 'bundle' ? 1 : Math.max(product.baseQuantity, 0.001),
      )
    : 0

  const lineTotal = product
    ? calculateLineTotal(normalizedQuantity, product.unitType, product.baseQuantity, basePrice)
    : 0

  if (!open || !product) return null

  const tamilName = product.nameTa || product.tamilName
  const favorite = isFav(product.id)

  const handleAdd = () => {
    addItem(product, normalizedQuantity, product.unitLabel)
    setToast(true)
    window.setTimeout(() => setToast(false), 1800)
  }

  const handleUnitChange = (unit: string) => {
    if (!product || unit === displayUnit) return
    if (product.unitType === 'unit' || product.unitType === 'bundle') {
      setDisplayUnit(unit)
      return
    }
    const base = convertQuantityByUnitType(displayQty, displayUnit, product.unitLabel, product.unitType)
    setDisplayUnit(unit)
    setDisplayQty(convertQuantityByUnitType(base, product.unitLabel, unit, product.unitType))
  }

  const heroImage = getProductImage(product.name, product.category, product.imageUrl, 'detail')

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Close modal backdrop"
          onClick={onClose}
          className="absolute inset-0 bg-[#0d140f]/45 backdrop-blur-[6px]"
        />

        <div className="relative z-10 flex min-h-full items-end justify-center p-2 sm:p-4 md:items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 14 }}
            transition={{ type: 'spring', stiffness: 130, damping: 18, mass: 0.9 }}
            className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/40 bg-[#fefcf7] shadow-[0_30px_80px_rgba(22,35,20,0.35)] max-h-[calc(100vh-1rem)] md:max-h-[calc(100vh-2rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="relative flex min-h-0 flex-col bg-gradient-to-br from-[#f6efe4] via-[#f7f4ed] to-[#e9f0e6] p-4 sm:p-6 lg:p-7">
                <div className="absolute right-5 top-5 hidden sm:flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#5f6d59] shadow-sm">
                  Premium Focus
                </div>

                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7daa8f]">{t('cat.' + product.category)}</div>
                    <div className="mt-1 text-xs font-bold text-[#6b7c68]">{(product.rating || 4.7).toFixed(1)} rating</div>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5f6d59] sm:hidden">Compact view</div>
                </div>

                <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-[0_20px_40px_rgba(45,60,35,0.18)]">
                  <motion.div
                    className="relative h-full w-full"
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <img
                      src={heroImage}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      onError={onImgError}
                      className="h-full w-full object-contain bg-gradient-to-b from-white via-white to-[#f7f4ed] p-4 sm:p-6 transition-transform duration-500 ease-out hover:scale-[1.01]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/20" />
                    <div className="absolute bottom-4 left-4 rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5f6d59] shadow-sm backdrop-blur">
                      1 image view
                    </div>
                  </motion.div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-[#6b7c68]">
                  <div className="flex items-center gap-2">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    {(product.rating || 4.7).toFixed(1)} - Trusted Herbal Store
                  </div>
                  <div className="hidden sm:flex items-center gap-1">
                    <span>No carousel</span>
                  </div>
                </div>
              </section>

              <section className="relative flex min-h-0 flex-col bg-white p-5 sm:p-7 lg:p-8">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-sand/50 bg-white text-textMain transition-colors hover:bg-bgMain"
                  aria-label="Close"
                >
                  X
                </button>

                <div className="flex items-start justify-between gap-3 pr-10">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7daa8f]">Herbal Essentials</p>
                    <h2 className="mt-2 text-2xl font-black text-[#2c392a]">{product.name}</h2>
                    {tamilName && <p className="mt-1 text-lg font-bold text-[#5f6d59] ta-text">{tamilName}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {discount > 0 && (
                      <div className="rounded-full bg-[#2c392a] px-4 py-1.5 text-[11px] font-black text-white">{discount}% OFF</div>
                    )}
                    <button
                      type="button"
                      onClick={() => void toggle(product)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black transition-colors ${
                        favorite ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-[#ead7b7]/70 bg-[#f7f4ed] text-[#5f6d59]'
                      }`}
                      aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
                    >
                      <Heart size={12} className={favorite ? 'fill-rose-500 text-rose-500' : 'text-current'} />
                      {favorite ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  <p className="text-sm leading-relaxed text-[#5f6d59]">{product.description}</p>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-[#ead7b7]/50 bg-[#f7f4ed] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7daa8f]">Traditional Benefits</p>
                      <p className="mt-2 text-sm leading-relaxed text-[#4e5c49] whitespace-pre-line">{product.benefits || 'Traditional Siddha preparation for daily household use.'}</p>
                    </div>

                    <div className="rounded-2xl border border-[#ead7b7]/50 bg-[#f8faf6] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7daa8f]">Usage Instructions</p>
                      <p className="mt-2 text-sm leading-relaxed text-[#4e5c49]">{buildUsageNote(product)}</p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-[#ead7b7]/60 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-[#7daa8f]">Offer Price</p>
                        <div className="mt-1 flex items-end gap-2">
                          <span className="text-2xl font-black text-[#2c392a]">{formatCurrency(basePrice)}</span>
                          {hasDiscount && <span className="text-xs font-bold text-[#b0a89a] line-through">{formatCurrency(product.price)}</span>}
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-[#7daa8f]">{formatPricePerUnit(basePrice, product.baseQuantity, product.unitLabel, product.unitType)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-[#7daa8f]">Selected Total</p>
                        <p className="text-xl font-black text-[#2c392a]">{formatCurrency(lineTotal)}</p>
                        <p className="text-[10px] text-[#95a28f]">Inclusive of taxes</p>
                      </div>
                    </div>

                    {product.predefinedOptions.length > 0 && (product.unitType === 'weight' || product.unitType === 'volume') && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {product.predefinedOptions.map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              setDisplayUnit(product.unitLabel)
                              setDisplayQty(opt.quantity)
                            }}
                            className={`rounded-full border px-3 py-1 text-[11px] font-black transition-colors ${
                              Math.abs(displayQty - opt.quantity) < 0.0001 && displayUnit === product.unitLabel
                                ? 'border-[#2c392a] bg-[#2c392a] text-white'
                                : 'border-[#ead7b7]/70 bg-[#f7f4ed] text-[#5f6d59] hover:border-[#7daa8f]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 rounded-full border border-[#ead7b7]/60 bg-[#f7f4ed] px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setDisplayQty((value) => Math.max(stepDisplay, value - stepDisplay))}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#5f6d59] shadow-sm"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={Number.isFinite(displayQty) ? displayQty : ''}
                          min={product.unitType === 'unit' || product.unitType === 'bundle' ? 1 : 0.001}
                          step={stepDisplay}
                          onChange={(event) => {
                            const next = Number(event.target.value)
                            if (!Number.isFinite(next)) return
                            setDisplayQty(next)
                          }}
                          className="w-16 bg-transparent text-center text-sm font-black text-[#2c392a] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setDisplayQty((value) => value + stepDisplay)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#5f6d59] shadow-sm"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {unitOptions.map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => handleUnitChange(unit)}
                            className={`rounded-full px-3 py-2 text-[11px] font-black transition-colors ${
                              unit === displayUnit ? 'bg-[#2c392a] text-white' : 'bg-[#f7f4ed] text-[#5f6d59] hover:bg-[#e8efe5]'
                            }`}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>

                      <div className="text-xs font-bold text-[#7daa8f]">Selected: {formatCompactQuantity(displayQty, displayUnit || product.unitLabel)}</div>
                    </div>

                    <div className="mt-5 hidden lg:flex items-center gap-3">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={handleAdd}
                        type="button"
                        className="flex-1 rounded-2xl bg-[#2c392a] py-3 text-sm font-black text-white shadow-[0_16px_30px_rgba(44,57,42,0.28)] transition-all hover:-translate-y-0.5"
                      >
                        <span className="inline-flex items-center gap-2"><ShoppingCart size={16} /> Add to Cart</span>
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => void toggle(product)}
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                          favorite ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-[#ead7b7]/70 bg-white text-[#5f6d59]'
                        }`}
                        aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
                      >
                        <Heart size={16} className={favorite ? 'fill-rose-500 text-rose-500' : ''} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {HIGHLIGHTS.map((item) => {
                      const Icon = item.icon
                      return (
                        <div key={item.label} className="flex items-center gap-2 rounded-2xl border border-[#ead7b7]/60 bg-[#f7f4ed] px-3 py-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#7daa8f] shadow-sm">
                            <Icon size={14} />
                          </div>
                          <span className="text-[11px] font-bold text-[#5f6d59]">{item.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            </div>

            <div className="border-t border-[#ead7b7]/50 bg-[#fbfaf6] px-5 py-5 sm:px-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-[#7daa8f]">Related Products</h3>
                <p className="text-xs font-bold text-[#9aa893]">Similar category picks</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                {relatedProducts.length === 0 && <div className="text-sm text-[#7a8672]">No related items yet.</div>}
                {relatedProducts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectProduct?.(item)}
                    className="group min-w-[160px] rounded-2xl border border-[#ead7b7]/60 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-1"
                  >
                    <div className="h-24 w-full overflow-hidden rounded-xl bg-[#f0f2eb]">
                      <img
                        src={getProductImage(item.name, item.category, item.imageUrl, 'tile')}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        onError={onImgError}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <p className="mt-2 text-xs font-bold text-[#2c392a] line-clamp-2">{item.name}</p>
                    <p className="text-[11px] font-bold text-[#7daa8f]">{formatCurrency(item.offerPrice || item.price)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 z-10 border-t border-[#ead7b7]/50 bg-white/95 px-5 py-4 backdrop-blur lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-[#7daa8f]">Total</p>
                  <p className="text-xl font-black text-[#2c392a]">{formatCurrency(lineTotal)}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleAdd}
                  type="button"
                  className="flex-1 rounded-2xl bg-[#2c392a] py-3 text-sm font-black text-white shadow-[0_16px_30px_rgba(44,57,42,0.28)]"
                >
                  <span className="inline-flex items-center justify-center gap-2"><ShoppingCart size={16} /> Add to Cart</span>
                </motion.button>
              </div>
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-6 top-6 rounded-full bg-[#2c392a] px-4 py-2 text-[11px] font-black text-white shadow-lg"
                >
                  Added to cart
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
