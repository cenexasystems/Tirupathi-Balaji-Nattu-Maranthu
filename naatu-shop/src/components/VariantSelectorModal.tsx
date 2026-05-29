import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, ShoppingCart, X } from 'lucide-react'
import { useCartStore, useVariantStore, type Product } from '../store/store'
import { formatCurrency } from '../lib/retail'
import { getProductImage, onImgError } from '../lib/productImages'
import type { ProductVariant } from '../services/variantService'

export default function VariantSelectorModal({
  product,
  open,
  onClose,
}: {
  product: Product | null
  open: boolean
  onClose: () => void
}) {
  const { addItem } = useCartStore()
  const { getVariants, fetchVariants } = useVariantStore()
  const [selected, setSelected] = useState<ProductVariant | null>(null)
  const [qty, setQty] = useState(1)
  const [toast, setToast] = useState(false)

  // Fetch variants on first open
  useEffect(() => {
    void fetchVariants()
  }, [fetchVariants])

  // Reset selection when product changes
  useEffect(() => {
    if (!open || !product) return
    const variants = getVariants(String(product.id))
    setSelected(variants[0] ?? null)
    setQty(1)
  }, [open, product, getVariants])

  // Keyboard / scroll lock
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handle)
    }
  }, [open, onClose])

  if (!open || !product) return null

  const variants = getVariants(String(product.id))
  const price = selected ? selected.price : product.price
  const lineTotal = price * qty

  const handleAdd = () => {
    if (!selected) return
    // Build a synthetic "product" representing this variant
    const variantProduct: Product = {
      ...product,
      id: selected.id,          // variant UUID as cart key
      name: `${product.name} - ${selected.variantName}`,
      price: selected.price,
      offerPrice: null,
      stock: selected.stock,
      stockQuantity: selected.stock,
      hasVariants: false,        // prevent re-opening variant modal from cart
    }
    addItem(variantProduct, qty, product.unitLabel)
    setToast(true)
    setTimeout(() => setToast(false), 1600)
  }

  const heroImage = getProductImage(product.name, product.category, product.imageUrl, 'detail')

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute inset-0 bg-[#0d140f]/50 backdrop-blur-[5px]"
        />

        {/* Mobile bottom sheet */}
        <div className="relative z-10 flex h-full items-end justify-center lg:hidden">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-[#fbfaf6] shadow-[0_-12px_40px_rgba(22,35,20,0.18)]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-[#d4cfc6]" />
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 border border-gray-100 shadow-sm"
            >
              <X size={15} />
            </button>

            {/* Product header */}
            <div className="flex gap-4 px-5 pt-3 pb-4 border-b border-[#ead7b7]/40">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#ede9df]">
                <img
                  src={heroImage}
                  alt={product.name}
                  onError={onImgError}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#7daa8f]">
                  {product.category}
                </p>
                <h2 className="mt-0.5 text-[1.1rem] font-black leading-tight text-[#2c392a]">
                  {product.name}
                </h2>
                {product.description && (
                  <p className="mt-1 text-[11px] text-[#5f6d59] line-clamp-2">{product.description}</p>
                )}
              </div>
            </div>

            {/* Variant chips */}
            <div className="px-5 pt-4 pb-2">
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-[#7daa8f]">
                Select Variant
              </p>
              <div className="grid grid-cols-2 gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelected(v)}
                    className={`flex flex-col items-start rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                      selected?.id === v.id
                        ? 'border-[#2c392a] bg-[#2c392a] text-white'
                        : 'border-[#ead7b7]/60 bg-white text-[#2c392a]'
                    }`}
                  >
                    <span className="text-[13px] font-black">{v.variantName}</span>
                    <span className={`text-[12px] font-bold ${selected?.id === v.id ? 'text-white/80' : 'text-[#5f6d59]'}`}>
                      {formatCurrency(v.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity + Add */}
            <div className="flex items-center gap-3 border-t border-[#ead7b7]/40 bg-white px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="inline-flex items-center gap-1 rounded-full bg-[#f7f4ed] px-1.5 py-1 ring-1 ring-[#ead7b7]/50">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#5f6d59] shadow-sm"
                >
                  <Minus size={13} />
                </button>
                <span className="min-w-[2rem] text-center text-[14px] font-black text-[#2c392a]">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#5f6d59] shadow-sm"
                >
                  <Plus size={13} />
                </button>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleAdd}
                disabled={!selected}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2c392a] py-3.5 text-[13px] font-black text-white shadow-[0_8px_24px_rgba(44,57,42,0.22)] disabled:opacity-40"
              >
                <ShoppingCart size={15} />
                Add · {formatCurrency(lineTotal)}
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Desktop center dialog */}
        <div className="hidden lg:flex relative z-10 h-full items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] bg-[#fbfaf6] shadow-[0_20px_60px_rgba(22,35,20,0.22)]"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 border border-gray-100 shadow-sm hover:scale-105 transition-transform"
            >
              <X size={15} />
            </button>

            {/* Product header */}
            <div className="flex gap-4 p-6 border-b border-[#ead7b7]/40 bg-[#f7f2ea]">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm">
                <img
                  src={heroImage}
                  alt={product.name}
                  onError={onImgError}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#7daa8f]">
                  {product.category}
                </p>
                <h2 className="mt-1 text-[1.25rem] font-black leading-tight text-[#2c392a]">
                  {product.name}
                </h2>
                {product.nameTa && (
                  <p className="mt-0.5 text-[12px] font-bold text-[#5f6d59] ta-text">{product.nameTa}</p>
                )}
                {product.description && (
                  <p className="mt-1.5 text-[11px] text-[#5f6d59] line-clamp-2">{product.description}</p>
                )}
              </div>
            </div>

            {/* Variant grid */}
            <div className="p-6">
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-[#7daa8f]">
                Select Variant
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelected(v)}
                    className={`flex flex-col items-start rounded-2xl border-2 px-4 py-3.5 text-left transition-all hover:scale-[1.01] ${
                      selected?.id === v.id
                        ? 'border-[#2c392a] bg-[#2c392a] text-white shadow-[0_8px_20px_rgba(44,57,42,0.18)]'
                        : 'border-[#ead7b7]/60 bg-white text-[#2c392a] hover:border-[#2c392a]/30'
                    }`}
                  >
                    <span className="text-[14px] font-black">{v.variantName}</span>
                    <span className={`mt-0.5 text-[13px] font-bold ${selected?.id === v.id ? 'text-white/80' : 'text-[#5f6d59]'}`}>
                      {formatCurrency(v.price)}
                    </span>
                    {v.stock < 10 && v.stock > 0 && (
                      <span className={`mt-1 text-[10px] font-black ${selected?.id === v.id ? 'text-amber-300' : 'text-amber-600'}`}>
                        Only {Math.floor(v.stock)} left
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 border-t border-[#ead7b7]/40 bg-white px-6 py-4">
              <div className="inline-flex items-center gap-1 rounded-full bg-[#f7f4ed] px-1.5 py-1 ring-1 ring-[#ead7b7]/50">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#5f6d59] shadow-sm"
                >
                  <Minus size={13} />
                </button>
                <span className="min-w-[2rem] text-center text-[14px] font-black text-[#2c392a]">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#5f6d59] shadow-sm"
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#7daa8f]">Total</p>
                <p className="text-[1rem] font-black text-[#2c392a]">{formatCurrency(lineTotal)}</p>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleAdd}
                disabled={!selected}
                className="ml-auto flex items-center justify-center gap-2 rounded-2xl bg-[#2c392a] px-5 py-3 text-[13px] font-black text-white shadow-[0_8px_24px_rgba(44,57,42,0.22)] hover:-translate-y-0.5 transition-transform disabled:opacity-40"
              >
                <ShoppingCart size={15} />
                Add to Cart
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[#2c392a] px-5 py-2.5 text-[12px] font-black text-white shadow-lg"
            >
              Added to cart!
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
