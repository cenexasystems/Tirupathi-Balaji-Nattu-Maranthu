import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Heart, Minus, Plus, ShoppingCart, Star, X } from 'lucide-react'
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

const accordionClass = 'rounded-[22px] border border-[#ead7b7]/60 bg-white px-4 py-3 shadow-sm'

const getCompactPackOptions = (product: Product) => {
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
  const { addItem, removeItem, updateQuantity } = useCartStore()
  const { toggle, isFav } = useFavStore()
  const { t } = useLangStore()
  const [displayUnit, setDisplayUnit] = useState(() => product?.unitLabel ?? '')
  const [displayQty, setDisplayQty] = useState(() =>
    product
      ? getDefaultQuantityForProduct({
          unitType: product.unitType,
          baseQuantity: product.baseQuantity,
          predefinedOptions: product.predefinedOptions,
        })
      : 1,
  )
  const [mobileQty, setMobileQty] = useState(0)
  const [mobilePack, setMobilePack] = useState(() => product?.predefinedOptions[0] ?? null)
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
          : convertQuantityByUnitType(displayQty, displayUnit || product.unitLabel, product.unitLabel, product.unitType),
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
  const selectedUnit = displayUnit || product.unitLabel
  const selectedSummary = formatCompactQuantity(displayQty, selectedUnit)

  const handleAdd = () => {
    addItem(product, normalizedQuantity, selectedUnit)
    setToast(true)
    window.setTimeout(() => setToast(false), 1800)
  }

  const handleUnitChange = (unit: string) => {
    if (unit === displayUnit) return
    if (product.unitType === 'unit' || product.unitType === 'bundle') {
      setDisplayUnit(unit)
      return
    }
    const base = convertQuantityByUnitType(displayQty, displayUnit || product.unitLabel, product.unitLabel, product.unitType)
    setDisplayUnit(unit)
    setDisplayQty(convertQuantityByUnitType(base, product.unitLabel, unit, product.unitType))
  }

  const handleMobileAdd = () => {
    const pack = mobilePack
    const quantity = pack ? pack.quantity : 1
    addItem(product, quantity, pack?.unit ?? product.unitLabel)
    setMobileQty(1)
  }

  const handleMobileChangeQty = (nextQty: number) => {
    if (nextQty <= 0) {
      removeItem(product.id)
      setMobileQty(0)
      return
    }

    const pack = mobilePack
    const quantity = pack ? nextQty * pack.quantity : nextQty

    if (mobileQty <= 0) {
      addItem(product, quantity, pack?.unit ?? product.unitLabel)
    } else {
      updateQuantity(product.id, quantity)
    }

    setMobileQty(nextQty)
  }

  const handleMobilePackChange = (option: { quantity: number; unit: string; label: string }) => {
    if (option.label === mobilePack?.label) return
    const currentQty = mobileQty
    setMobilePack(option)
    if (currentQty > 0) {
      removeItem(product.id)
      addItem(product, currentQty * option.quantity, option.unit)
    }
  }

  const heroImage = getProductImage(product.name, product.category, product.imageUrl, 'detail')

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button
          type="button"
          aria-label="Close modal backdrop"
          onClick={onClose}
          className="absolute inset-0 bg-[#0d140f]/45 backdrop-blur-[6px]"
        />

        <div className="relative z-10 flex h-full min-h-0 items-end justify-center p-0 sm:p-3 md:hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 18 }}
            transition={{ type: 'spring', stiffness: 130, damping: 20, mass: 0.9 }}
            className="relative flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-[#fbfaf6] shadow-[0_-8px_40px_rgba(22,35,20,0.22)] sm:h-[min(92dvh,860px)] sm:rounded-[32px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 justify-center pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-[#d4cfc6]" />
            </div>

            <div className="flex-1 overflow-y-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
              <section className="px-4 pt-3 sm:px-6 sm:pt-5">
                <div className="relative overflow-hidden rounded-[30px] border border-white/70 bg-gradient-to-b from-[#f2ede2] via-white to-[#edf3ea] shadow-[0_18px_40px_rgba(45,60,35,0.12)]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#2c392a] shadow-sm backdrop-blur"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>

                  <div className="relative aspect-[4/3] min-h-[24svh] max-h-[36svh] sm:aspect-[16/11] sm:min-h-[22rem] sm:max-h-[24rem]">
                    <img
                      src={heroImage}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      onError={onImgError}
                      className="h-full w-full object-contain p-4 sm:p-6"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_56%)]" />
                  </div>
                </div>
              </section>

              <section className="px-4 pt-4 sm:px-6 sm:pt-5">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7daa8f]">{t('cat.' + product.category)}</p>
                  <h2 className="text-[1.55rem] leading-tight font-black text-[#2c392a] sm:text-4xl">{product.name}</h2>
                  {tamilName && <p className="text-base font-bold text-[#5f6d59] ta-text sm:text-lg">{tamilName}</p>}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#2c392a] shadow-sm ring-1 ring-[#ead7b7]/50">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {(product.rating || 4.7).toFixed(1)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#f7f4ed] px-3 py-1.5 text-[11px] font-black text-[#5f6d59] shadow-sm ring-1 ring-[#ead7b7]/45">
                      <span className="text-[#7daa8f]">{formatCurrency(basePrice)}</span>
                      {hasDiscount && <span className="text-[#b0a89a] line-through">{formatCurrency(product.price)}</span>}
                    </span>
                    {discount > 0 && <span className="rounded-full bg-[#2c392a] px-3 py-1.5 text-[11px] font-black text-white">{discount}% OFF</span>}
                  </div>
                </div>
              </section>

              <section className="px-4 pt-4 sm:px-6">
                <div className="rounded-[24px] bg-white/95 p-3.5 shadow-sm ring-1 ring-[#ead7b7]/55 sm:p-4">
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
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2c392a] py-3 text-sm font-black text-white shadow-[0_16px_30px_rgba(44,57,42,0.22)]"
                      >
                        <ShoppingCart size={16} /> Add
                      </motion.button>
                    ) : (
                      <motion.div
                        key="mobile-stepper"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-3"
                      >
                        {(product.predefinedOptions.length > 0 && (product.unitType === 'weight' || product.unitType === 'volume')) ? (
                          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                            {getCompactPackOptions(product).map((option) => (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => handleMobilePackChange(option)}
                                className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-black transition-colors ${
                                  mobilePack?.label === option.label
                                    ? 'border-[#2c392a] bg-[#2c392a] text-white'
                                    : 'border-[#ead7b7]/70 bg-[#f7f4ed] text-[#5f6d59]'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="inline-flex w-full items-center justify-between gap-2 rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-[#ead7b7]/55">
                          <button
                            type="button"
                            onClick={() => handleMobileChangeQty(mobileQty - 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f4ed] text-[#5f6d59]"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="min-w-[2rem] text-center text-[14px] font-black text-[#2c392a]">{mobileQty}</span>
                          <button
                            type="button"
                            onClick={() => handleMobileChangeQty(mobileQty + 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f4ed] text-[#5f6d59]"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>
            </div>
          </motion.div>
        </div>

        <div className="hidden lg:flex relative z-10 h-full min-h-0 items-end justify-center p-0 sm:p-3 md:items-center md:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 18 }}
            transition={{ type: 'spring', stiffness: 130, damping: 20, mass: 0.9 }}
            className="relative flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] bg-[#fbfaf6] shadow-[0_-8px_40px_rgba(22,35,20,0.22)] md:h-[min(90dvh,860px)] md:rounded-[32px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 justify-center pb-1 pt-3 md:hidden">
              <div className="h-1 w-10 rounded-full bg-[#d4cfc6]" />
            </div>
            <div className="flex-1 overflow-y-auto pb-[calc(6.75rem+env(safe-area-inset-bottom))]">
              <section className="px-4 pt-3 sm:px-6 sm:pt-6">
                <div className="relative overflow-hidden rounded-[34px] border border-white/70 bg-gradient-to-b from-[#f2ede2] via-white to-[#edf3ea] shadow-[0_24px_60px_rgba(45,60,35,0.14)]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#2c392a] shadow-sm backdrop-blur transition-transform hover:scale-[1.03]"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>

                  <div className="absolute left-3 top-3 z-10 rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#5f6d59] shadow-sm backdrop-blur">
                    Premium focus
                  </div>

                  <div className="relative aspect-[4/3] min-h-[28svh] max-h-[42svh] sm:aspect-[16/10] sm:min-h-[24rem] sm:max-h-[26rem]">
                    <img
                      src={heroImage}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      onError={onImgError}
                      className="h-full w-full object-contain p-4 sm:p-6"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_56%)]" />
                  </div>
                </div>
              </section>

              <section className="px-4 pt-4 sm:px-6 sm:pt-5">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7daa8f]">{t('cat.' + product.category)}</p>
                  <h2 className="text-[1.8rem] leading-tight font-black text-[#2c392a] sm:text-4xl">{product.name}</h2>
                  {tamilName && <p className="text-base font-bold text-[#5f6d59] ta-text sm:text-lg">{tamilName}</p>}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#2c392a] shadow-sm ring-1 ring-[#ead7b7]/50">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {(product.rating || 4.7).toFixed(1)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#f7f4ed] px-3 py-1.5 text-[11px] font-black text-[#5f6d59] shadow-sm ring-1 ring-[#ead7b7]/45">
                      <span className="text-[#7daa8f]">{formatCurrency(basePrice)}</span>
                      {hasDiscount && <span className="text-[#b0a89a] line-through">{formatCurrency(product.price)}</span>}
                    </span>
                    {discount > 0 && <span className="rounded-full bg-[#2c392a] px-3 py-1.5 text-[11px] font-black text-white">{discount}% OFF</span>}
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => void toggle(product)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black transition-colors ${
                        favorite ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-[#ead7b7]/70 bg-white text-[#5f6d59]'
                      }`}
                      aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
                    >
                      <Heart size={12} className={favorite ? 'fill-rose-500 text-rose-500' : 'text-current'} />
                      {favorite ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="px-4 pt-4 sm:px-6">
                <div className="rounded-[24px] bg-white/95 p-3.5 shadow-sm ring-1 ring-[#ead7b7]/55 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7daa8f]">Pack & quantity</p>
                      <p className="mt-1 text-[11px] font-bold text-[#95a28f]">{selectedSummary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-[#7daa8f]">Selected total</p>
                      <p className="text-lg font-black text-[#2c392a]">{formatCurrency(lineTotal)}</p>
                    </div>
                  </div>

                  {product.predefinedOptions.length > 0 && (product.unitType === 'weight' || product.unitType === 'volume') ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                      {product.predefinedOptions.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            setDisplayUnit(product.unitLabel)
                            setDisplayQty(option.quantity)
                          }}
                          className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-black transition-colors ${
                            Math.abs(displayQty - option.quantity) < 0.0001 && displayUnit === product.unitLabel
                              ? 'border-[#2c392a] bg-[#2c392a] text-white'
                              : 'border-[#ead7b7]/70 bg-[#f7f4ed] text-[#5f6d59]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(product.unitType === 'weight' || product.unitType === 'volume') && unitOptions.length > 1 && (
                        <div className="flex items-center gap-1 rounded-full bg-[#f7f4ed] p-1 ring-1 ring-[#ead7b7]/50">
                          {unitOptions.map((unit) => (
                            <button
                              key={unit}
                              type="button"
                              onClick={() => handleUnitChange(unit)}
                              className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-colors ${
                                unit === displayUnit ? 'bg-[#2c392a] text-white' : 'text-[#5f6d59]'
                              }`}
                            >
                              {unit}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-1 ring-1 ring-[#ead7b7]/50">
                        <button
                          type="button"
                          onClick={() => setDisplayQty((value) => Math.max(stepDisplay, value - stepDisplay))}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f7f4ed] text-[#5f6d59]"
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
                          className="w-14 bg-transparent text-center text-[12px] font-black text-[#2c392a] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setDisplayQty((value) => value + stepDisplay)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f7f4ed] text-[#5f6d59]"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-[11px] font-bold text-[#7daa8f]">
                    {formatPricePerUnit(basePrice, product.baseQuantity, product.unitLabel, product.unitType)}
                  </div>
                </div>
              </section>

              <section className="px-4 pt-4 sm:px-6">
                <div className="grid gap-2.5">
                  <details className={accordionClass}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[#2c392a]">
                      <span>Description</span>
                      <ChevronDown size={16} className="text-[#7daa8f] transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-[#5f6d59]">{product.description || 'Carefully selected herbal product made for daily use.'}</p>
                  </details>

                  <details className={accordionClass}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[#2c392a]">
                      <span>Benefits & care</span>
                      <ChevronDown size={16} className="text-[#7daa8f] transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#5f6d59]">
                      <p className="whitespace-pre-line">{product.benefits || 'Traditional Siddha preparation for daily household use.'}</p>
                      <p>{buildUsageNote(product)}</p>
                    </div>
                  </details>
                </div>
              </section>

              <section className="px-4 pt-4 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.24em] text-[#7daa8f]">Related products</h3>
                  <span className="text-[11px] font-bold text-[#9aa893]">Swipe for more</span>
                </div>
                <div className="mt-3 flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                  {relatedProducts.length === 0 && <div className="text-sm text-[#7a8672]">No related items yet.</div>}
                  {relatedProducts.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectProduct?.(item)}
                      className="group min-w-[124px] overflow-hidden rounded-[20px] bg-white text-left shadow-sm ring-1 ring-[#ead7b7]/55 transition-transform hover:-translate-y-0.5"
                    >
                      <div className="aspect-square bg-[#f2f0e8]">
                        <img
                          src={getProductImage(item.name, item.category, item.imageUrl, 'tile')}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          onError={onImgError}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="space-y-1.5 p-2.5">
                        <p className="line-clamp-2 text-[11px] font-bold leading-snug text-[#2c392a]">{item.name}</p>
                        <p className="text-[10px] font-black text-[#7daa8f]">{formatCurrency(item.offerPrice || item.price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 border-t border-[#ead7b7]/50 bg-white/95 px-4 py-3 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <div className="mx-auto flex max-w-5xl items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#7daa8f]">Total</p>
                  <p className="text-base font-black leading-tight text-[#2c392a]">{formatCurrency(lineTotal)}</p>
                  <p className="truncate text-[10px] font-bold text-[#95a28f]">{selectedSummary}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAdd}
                  type="button"
                  className="flex-1 rounded-2xl bg-[#2c392a] py-3.5 text-sm font-black text-white shadow-[0_16px_30px_rgba(44,57,42,0.28)] transition-transform hover:-translate-y-0.5"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <ShoppingCart size={16} /> Add to Cart
                  </span>
                </motion.button>
              </div>
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-4 top-4 rounded-full bg-[#2c392a] px-4 py-2 text-[11px] font-black text-white shadow-lg"
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