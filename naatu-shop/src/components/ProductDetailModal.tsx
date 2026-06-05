import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Flower2, Heart, Leaf, Minus, Plus, ShieldCheck, ShoppingCart, Sparkles, Star, X } from 'lucide-react'
import { useCartStore, useFavStore, useVariantStore, type Product } from '../store/store'
import { useLangStore } from '../store/langStore'
import type { ProductVariant } from '../services/variantService'
import {
  calculateLineTotal,
  convertQuantityByUnitType,
  formatCompactQuantity,
  formatCurrency,
  formatPricePerUnit,
  getDefaultQuantityForProduct,
  getQuantityStepForProduct,
  normalizeSelectedQuantity,
  type QuantityOption,
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

function variantToProduct(base: Product, v: ProductVariant): Product {
  return {
    ...base,
    id: v.id,
    name: `${base.name}${v.sizeLabel || v.variantName !== base.name ? ` - ${v.variantName}` : ''}`,
    price: v.price,
    offerPrice: null,
    stock: v.stock,
    stockQuantity: v.stock,
    hasVariants: false,
  }
}

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
  const { getVariants, getDefaultVariant, fetchVariants } = useVariantStore()
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
  const [mobilePack, setMobilePack] = useState<QuantityOption | null>(null)
  const [toast, setToast] = useState(false)
  // Desktop variant selection
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [desktopVariantQty, setDesktopVariantQty] = useState(1)

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
    void fetchVariants()
  }, [fetchVariants])

  useEffect(() => {
    if (!open || !product) return
    const id = window.setTimeout(() => {
      setMobileQty(0)
      setMobilePack(getCompactPackOptions(product)[0] ?? null)
      if (product.hasVariants) {
        setSelectedVariant(getDefaultVariant(String(product.id)))
        setDesktopVariantQty(1)
      } else {
        setSelectedVariant(null)
        setDesktopVariantQty(1)
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, product, fetchVariants, getDefaultVariant])

  // Reference optional props to avoid ESLint unused-var errors without changing API
  void onSelectProduct
  void relatedProducts

  const basePrice = product
    ? (product.offerPrice && product.offerPrice < product.price ? product.offerPrice : product.price)
    : 0

  const hasDiscount = !!(product && product.offerPrice && product.offerPrice < product.price)
  const discount = product && hasDiscount
    ? Math.round(((product.price - product.offerPrice!) / product.price) * 100)
    : 0

  const unitOptions = useMemo(() => (product ? getUnitOptions(product) : []), [product])
  const compactPackOptions = useMemo(() => (product ? getCompactPackOptions(product) : []), [product])
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

  const mobileSelectedQuantity = mobilePack ? mobileQty * mobilePack.quantity : mobileQty
  const mobileSelectedUnit = mobilePack?.unit || product?.unitLabel || ''
  const mobileLineTotal = product && mobileQty > 0
    ? calculateLineTotal(
        product.unitType === 'unit' || product.unitType === 'bundle' ? Math.max(1, Math.round(mobileSelectedQuantity)) : mobileSelectedQuantity,
        product.unitType,
        product.baseQuantity,
        basePrice,
      )
    : basePrice
  const mobileSummary = mobileQty > 0
    ? formatCompactQuantity(mobileSelectedQuantity, mobileSelectedUnit)
    : formatCompactQuantity(getDefaultQuantityForProduct({
        unitType: product?.unitType ?? 'unit',
        baseQuantity: product?.baseQuantity ?? 1,
        predefinedOptions: product?.predefinedOptions ?? [],
      }), product?.unitLabel ?? '')

  if (!open || !product) return null

  const tamilName = product.nameTa || product.tamilName
  const favorite = isFav(product.id)
  const selectedUnit = displayUnit || product.unitLabel
  const selectedSummary = formatCompactQuantity(displayQty, selectedUnit)

  const handleAdd = () => {
    if (product.hasVariants && selectedVariant) {
      const synthetic = variantToProduct(product, selectedVariant)
      addItem(
        synthetic,
        desktopVariantQty,
        synthetic.unitLabel,
        selectedVariant.id,
        selectedVariant.variantName,
        String(product.id),
      )
    } else {
      addItem(product, normalizedQuantity, selectedUnit)
    }
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
    const pack = mobilePack ?? compactPackOptions[0] ?? null
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

    const pack = mobilePack ?? compactPackOptions[0] ?? null
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
  const galleryImages = [...new Set([
    heroImage,
    getProductImage(product.name, product.category, product.imageUrl, 'card'),
    getProductImage(product.name, product.category, product.imageUrl, 'tile'),
  ])]

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button
          type="button"
          aria-label="Close modal backdrop"
          onClick={onClose}
          className="absolute inset-0 bg-[#0d140f]/45 backdrop-blur-[6px]"
        />

        <div className="relative z-10 flex h-full min-h-0 items-end justify-center p-0 sm:p-3 lg:hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 18 }}
            transition={{ type: 'spring', stiffness: 130, damping: 20, mass: 0.9 }}
            className="relative flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-[#fbfaf6] shadow-[0_-10px_42px_rgba(22,35,20,0.16)] sm:h-[min(94dvh,900px)] sm:rounded-[32px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 justify-center pt-2.5">
              <div className="h-1 w-10 rounded-full bg-[#d4cfc6]" />
            </div>

            <div className="flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
              <section className="px-0 pt-2">
                <div className="relative overflow-hidden bg-[#efe9dd]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#2c392a] shadow-[0_6px_18px_rgba(45,60,35,0.12)] backdrop-blur"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>

                  <div className="absolute left-4 top-4 z-10 rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#5f6d59] shadow-sm backdrop-blur">
                    Premium focus
                  </div>

                  <div className="relative aspect-[4/3] min-h-[38svh] max-h-[44svh] sm:aspect-[16/10] sm:min-h-[26rem] sm:max-h-[30rem]">
                    <img
                      src={heroImage}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      onError={onImgError}
                      className="h-full w-full object-cover object-center"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbfaf6] to-transparent" />
                  </div>
                </div>
              </section>

              <section className="px-4 pt-3 sm:px-6 sm:pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7daa8f]">{t('cat.' + product.category)}</p>
                <h2 className="mt-1 text-[1.68rem] leading-[1.08] font-black text-[#2c392a] sm:text-[2.3rem]">{product.name}</h2>
                {tamilName && <p className="mt-1 text-[0.98rem] font-bold text-[#5f6d59] ta-text sm:text-[1.05rem]">{tamilName}</p>}
              </section>

              <section className="px-4 pt-3 sm:px-6">
                <div className="flex items-end justify-between gap-3 rounded-[24px] bg-white/85 px-4 py-3 shadow-sm ring-1 ring-[#ead7b7]/45 backdrop-blur">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f4ed] px-3 py-1.5 text-[11px] font-black text-[#2c392a] ring-1 ring-[#ead7b7]/40">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        {(product.rating || 4.7).toFixed(1)}
                      </span>
                      {discount > 0 && <span className="rounded-full bg-[#2c392a] px-3 py-1.5 text-[11px] font-black text-white">{discount}% OFF</span>}
                    </div>
                    <p className="mt-1.5 text-[11px] font-bold text-[#95a28f]">{mobileSummary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7daa8f]">Price</p>
                    <p className="text-[1.45rem] font-black leading-none text-[#2c392a]">{formatCurrency(basePrice)}</p>
                    {hasDiscount && <p className="mt-1 text-[10px] font-bold text-[#b0a89a] line-through">{formatCurrency(product.price)}</p>}
                  </div>
                </div>
              </section>

              <section className="px-4 pt-3 sm:px-6">
                <div className="rounded-[24px] bg-white/80 px-4 py-3 shadow-sm ring-1 ring-[#ead7b7]/45 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7daa8f]">Quantity</p>
                      <p className="mt-1 text-[11px] font-bold text-[#95a28f]">{mobileQty > 0 ? 'Tap +/- to adjust' : 'Tap Add to start'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggle(product)}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                        favorite ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-[#ead7b7]/60 bg-white text-[#5f6d59]'
                      }`}
                      aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
                    >
                      <Heart size={14} className={favorite ? 'fill-rose-500 text-rose-500' : 'text-current'} />
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {mobileQty > 0 && (
                      <motion.div
                        key="mobile-stepper"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.18 }}
                        className="mt-3 space-y-3"
                      >
                        {compactPackOptions.length > 0 && (product.unitType === 'weight' || product.unitType === 'volume') && (
                          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                            {compactPackOptions.map((option) => (
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
                        )}

                        <div className="inline-flex w-full items-center justify-between gap-2 rounded-full bg-white px-2 py-1.5 shadow-sm ring-1 ring-[#ead7b7]/55">
                          <button
                            type="button"
                            onClick={() => handleMobileChangeQty(mobileQty - 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f4ed] text-[#5f6d59] transition-colors hover:bg-[#ead7b7]/35"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="min-w-[2rem] text-center text-[14px] font-black text-[#2c392a]">{mobileQty}</span>
                          <button
                            type="button"
                            onClick={() => handleMobileChangeQty(mobileQty + 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f4ed] text-[#5f6d59] transition-colors hover:bg-[#ead7b7]/35"
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

            <div className="sticky inset-x-0 bottom-0 z-20 border-t border-[#ead7b7]/45 bg-white/92 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
              <div className="mx-auto flex max-w-xl items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#7daa8f]">{mobileQty > 0 ? 'Selected total' : 'Total price'}</p>
                  <p className="text-[1rem] font-black leading-tight text-[#2c392a]">{formatCurrency(mobileQty > 0 ? mobileLineTotal : basePrice)}</p>
                  <p className="truncate text-[10px] font-bold text-[#95a28f]">{mobileQty > 0 ? mobileSummary : 'Premium quick view'}</p>
                </div>

                {mobileQty === 0 ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleMobileAdd}
                    type="button"
                    className="ml-auto flex h-[46px] flex-1 items-center justify-center rounded-2xl bg-[#2c392a] px-4 text-[13px] font-black text-white shadow-[0_14px_28px_rgba(44,57,42,0.2)]"
                  >
                    <ShoppingCart size={15} />
                    <span className="ml-2">Add to Cart</span>
                  </motion.button>
                ) : (
                  <div className="ml-auto flex flex-1 items-center justify-end gap-2">
                    <div className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-1 shadow-sm ring-1 ring-[#ead7b7]/55">
                      <button
                        type="button"
                        onClick={() => handleMobileChangeQty(mobileQty - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7f4ed] text-[#5f6d59] transition-colors hover:bg-[#ead7b7]/35"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="min-w-[2rem] text-center text-[13px] font-black text-[#2c392a]">{mobileQty}</span>
                      <button
                        type="button"
                        onClick={() => handleMobileChangeQty(mobileQty + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7f4ed] text-[#5f6d59] transition-colors hover:bg-[#ead7b7]/35"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAdd}
                      type="button"
                      className="flex h-[46px] items-center justify-center rounded-2xl bg-[#2c392a] px-4 text-[13px] font-black text-white shadow-[0_14px_28px_rgba(44,57,42,0.2)]"
                    >
                      <ShoppingCart size={15} />
                      <span className="ml-2">Add to Cart</span>
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="hidden lg:flex relative z-10 h-full min-h-0 items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 18 }}
            transition={{ type: 'spring', stiffness: 130, damping: 20, mass: 0.9 }}
            className="relative flex h-[min(92dvh,920px)] w-full max-w-[1180px] overflow-hidden rounded-[34px] bg-[#fbfaf6] shadow-[0_26px_80px_rgba(22,35,20,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#2c392a] shadow-[0_6px_18px_rgba(45,60,35,0.12)] backdrop-blur transition-transform hover:scale-[1.03]"
              aria-label="Close product details"
            >
              <X size={16} />
            </button>

            <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
              <div className="flex h-full min-h-0 flex-col overflow-y-auto border-b border-[#ead7b7]/40 bg-[#f7f2ea] px-5 pb-6 pt-5 lg:border-b-0 lg:border-r lg:px-6 lg:pb-8 lg:pt-6 xl:px-8">
                <div className="flex items-center justify-between gap-3 pb-4">
                  <div className="rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#5f6d59] shadow-sm backdrop-blur">
                    Premium pooja item
                  </div>
                  <div className="rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#7daa8f] shadow-sm backdrop-blur">
                    Pooja items
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[34px] border border-white/70 bg-gradient-to-b from-[#f2ede2] via-white to-[#edf3ea] shadow-[0_24px_60px_rgba(45,60,35,0.12)]">
                  <div className="absolute left-4 top-4 z-10 rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#5f6d59] shadow-sm backdrop-blur">
                    Premium focus
                  </div>

                  <div className="relative flex min-h-[28rem] items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
                    <img
                      src={heroImage}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      onError={onImgError}
                      className="max-h-[28rem] w-full object-contain"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_56%)]" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-3">
                  {galleryImages.map((image, index) => (
                    <div
                      key={`${image}-${index}`}
                      className={`overflow-hidden rounded-[18px] border bg-white shadow-sm ${index === 0 ? 'border-[#2c392a]/50 ring-2 ring-[#2c392a]/10' : 'border-[#ead7b7]/45'}`}
                    >
                      <div className="aspect-square bg-[#f2f0e8] p-2">
                        <img
                          src={image}
                          alt={`${product.name} preview ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          onError={onImgError}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#fbfaf6] px-5 pb-[7.75rem] pt-5 lg:px-6 lg:pb-[7.5rem] lg:pt-6 xl:px-8">
                <section>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7daa8f]">{t('cat.' + product.category)}</p>
                  <h2 className="mt-1 text-[2rem] leading-[1.02] font-black text-[#2c392a] sm:text-[2.5rem]">{product.name}</h2>
                  {tamilName && <p className="mt-1.5 text-[1rem] font-bold text-[#5f6d59] ta-text sm:text-[1.08rem]">{tamilName}</p>}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f4ed] px-3 py-1.5 text-[11px] font-black text-[#2c392a] ring-1 ring-[#ead7b7]/40">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {(product.rating || 4.7).toFixed(1)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#5f6d59] shadow-sm ring-1 ring-[#ead7b7]/45">
                      Trusted by 1000+ devotees
                    </span>
                    {discount > 0 && <span className="rounded-full bg-[#2c392a] px-3 py-1.5 text-[11px] font-black text-white">{discount}% OFF</span>}
                  </div>
                </section>

                <section className="mt-5 rounded-[26px] bg-white/88 px-4 py-4 shadow-sm ring-1 ring-[#ead7b7]/45 backdrop-blur sm:px-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7daa8f]">Price</p>
                      <p className="mt-1 text-[2rem] font-black leading-none text-[#2c392a]">{formatCurrency(basePrice)}</p>
                      {hasDiscount && <p className="mt-1 text-[11px] font-bold text-[#b0a89a] line-through">{formatCurrency(product.price)}</p>}
                    </div>
                    <p className="max-w-[12rem] text-right text-[11px] font-bold text-[#95a28f]">Inclusive of taxes</p>
                  </div>
                </section>

                {/* Variant radio selector (desktop) OR pack size / qty stepper */}
                {product.hasVariants ? (
                  <section className="mt-5 rounded-[26px] bg-white/88 px-4 py-4 shadow-sm ring-1 ring-[#ead7b7]/45 backdrop-blur sm:px-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7daa8f]">Select Variant</p>
                      <button
                        type="button"
                        onClick={() => void toggle(product)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors ${
                          favorite ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-[#ead7b7]/70 bg-white text-[#5f6d59]'
                        }`}
                        aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
                      >
                        <Heart size={12} className={favorite ? 'fill-rose-500 text-rose-500' : 'text-current'} />
                        {favorite ? 'Saved' : 'Save'}
                      </button>
                    </div>

                    {/* Variant list — radio style */}
                    <div className="space-y-1.5">
                      {getVariants(String(product.id)).map((v) => {
                        const isSel = selectedVariant?.id === v.id
                        const oos = v.stock <= 0
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={oos}
                            onClick={() => { if (!oos) { setSelectedVariant(v); setDesktopVariantQty(1) } }}
                            className={[
                              'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all',
                              isSel
                                ? 'bg-[#2C392A]/6 ring-2 ring-[#2C392A]'
                                : oos
                                ? 'cursor-not-allowed opacity-40 ring-1 ring-gray-200'
                                : 'ring-1 ring-[#ead7b7]/70 hover:ring-[#7DAA8F]',
                            ].join(' ')}
                          >
                            <span className={[
                              'flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border-2',
                              isSel ? 'border-[#2C392A] bg-[#2C392A]' : 'border-gray-300',
                            ].join(' ')}>
                              {isSel && <Check size={9} className="text-white" strokeWidth={3.5} />}
                            </span>
                            <span className={`flex-1 text-[13px] font-semibold ${isSel ? 'text-[#2C392A]' : 'text-[#444]'}`}>
                              {v.variantName}
                              {v.sizeLabel && v.sizeLabel !== v.variantName && (
                                <span className="ml-1 text-[11px] font-normal text-[#5F6D59]">· {v.sizeLabel}</span>
                              )}
                            </span>
                            <span className={`text-[14px] font-black tabular-nums shrink-0 ${isSel ? 'text-[#2C392A]' : 'text-[#444]'}`}>
                              {formatCurrency(v.price)}
                            </span>
                            {oos && <span className="text-[10px] font-bold text-red-500">Out of stock</span>}
                          </button>
                        )
                      })}
                    </div>

                    {/* Qty stepper for selected variant */}
                    {selectedVariant && (
                      <div className="mt-3 flex items-center gap-2 pt-2 border-t border-[#ead7b7]/40">
                        <span className="text-[11px] font-bold text-[#5f6d59]">Quantity</span>
                        <div className="ml-auto inline-flex items-center gap-1 rounded-xl border border-[#D5DAD0] bg-[#F7F6F2] overflow-hidden">
                          <button type="button"
                            onClick={() => setDesktopVariantQty(q => Math.max(1, q - 1))}
                            disabled={desktopVariantQty <= 1}
                            className="flex h-8 w-8 items-center justify-center text-[#2c392a] hover:bg-[#E8EDE4] disabled:opacity-40 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-8 text-center text-[13px] font-black text-[#2c392a] tabular-nums">{desktopVariantQty}</span>
                          <button type="button"
                            onClick={() => setDesktopVariantQty(q => Math.min(q + 1, selectedVariant.stock))}
                            disabled={desktopVariantQty >= selectedVariant.stock}
                            className="flex h-8 w-8 items-center justify-center text-[#2c392a] hover:bg-[#E8EDE4] disabled:opacity-40 transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="mt-5 rounded-[26px] bg-white/88 px-4 py-4 shadow-sm ring-1 ring-[#ead7b7]/45 backdrop-blur sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7daa8f]">Pack size</p>
                        <p className="mt-1 text-[11px] font-bold text-[#95a28f]">{selectedSummary}</p>
                      </div>
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

                    {compactPackOptions.length > 0 && (product.unitType === 'weight' || product.unitType === 'volume') ? (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                        {compactPackOptions.map((option) => (
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
                  </section>
                )}

                <section className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { icon: Leaf, title: '100% Natural', subtitle: 'Pure & Handpicked' },
                    { icon: Sparkles, title: 'Fresh & Fragrant', subtitle: 'Daily Selection' },
                    { icon: Flower2, title: 'Pooja Ready', subtitle: 'Temple Quality' },
                    { icon: ShieldCheck, title: 'Safe Packaging', subtitle: 'Hygienically Packed' },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.title} className="rounded-[22px] border border-[#ead7b7]/45 bg-white/90 px-3 py-3 shadow-sm">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f7f4ed] text-[#5f6d59] ring-1 ring-[#ead7b7]/45">
                          <Icon size={16} />
                        </div>
                        <p className="mt-2 text-[12px] font-black text-[#2c392a]">{item.title}</p>
                        <p className="mt-0.5 text-[10px] font-bold text-[#95a28f]">{item.subtitle}</p>
                      </div>
                    )
                  })}
                </section>

                <section className="mt-5 grid gap-2.5">
                  <details className={accordionClass}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[#2c392a]">
                      <span>Product Details</span>
                      <ChevronDown size={16} className="text-[#7daa8f] transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-[#5f6d59]">{product.description || 'Carefully selected herbal product made for daily use.'}</p>
                  </details>

                  <details className={accordionClass}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[#2c392a]">
                      <span>Benefits</span>
                      <ChevronDown size={16} className="text-[#7daa8f] transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#5f6d59]">
                      <p className="whitespace-pre-line">{product.benefits || 'Traditional Siddha preparation for daily household use.'}</p>
                      <p>{buildUsageNote(product)}</p>
                    </div>
                  </details>

                  <details className={accordionClass}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[#2c392a]">
                      <span>How to Use</span>
                      <ChevronDown size={16} className="text-[#7daa8f] transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-[#5f6d59]">Use as per traditional practice. Store in a cool, dry place away from moisture.</p>
                  </details>
                </section>
              </div>

            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 border-t border-[#ead7b7]/50 bg-white/95 px-4 py-3 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <div className="mx-auto flex max-w-5xl items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#7daa8f]">Total</p>
                  {product.hasVariants && selectedVariant ? (
                    <>
                      <p className="text-base font-black leading-tight text-[#2c392a]">
                        {formatCurrency(selectedVariant.price * desktopVariantQty)}
                      </p>
                      <p className="truncate text-[10px] font-bold text-[#95a28f]">
                        {selectedVariant.variantName}{selectedVariant.sizeLabel ? ` · ${selectedVariant.sizeLabel}` : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-black leading-tight text-[#2c392a]">{formatCurrency(lineTotal)}</p>
                      <p className="truncate text-[10px] font-bold text-[#95a28f]">{selectedSummary}</p>
                    </>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAdd}
                  type="button"
                  disabled={product.hasVariants && !selectedVariant}
                  className="flex-1 rounded-2xl bg-[#2c392a] py-3.5 text-sm font-black text-white shadow-[0_16px_30px_rgba(44,57,42,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <ShoppingCart size={16} />
                    {product.hasVariants ? 'Add Variant to Cart' : 'Add to Cart'}
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