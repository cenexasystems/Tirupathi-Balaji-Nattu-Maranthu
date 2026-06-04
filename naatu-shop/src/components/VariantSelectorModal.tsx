import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, X, Check, ShoppingCart } from 'lucide-react'
import { useCartStore, useVariantStore, type Product } from '../store/store'
import { formatCurrency } from '../lib/retail'
import { getProductImage, onImgError } from '../lib/productImages'
import { useLangStore } from '../store/langStore'
import type { ProductVariant } from '../services/variantService'

// Helper: build a synthetic Product from a base product + selected variant
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
  const { getVariants, getDefaultVariant, fetchVariants } = useVariantStore()
  const { lang } = useLangStore()
  const l = (en: string, ta: string) => lang === 'ta' ? ta : en

  const [selected, setSelected]     = useState<ProductVariant | null>(null)
  const [qty, setQty]               = useState(1)
  const [added, setAdded]           = useState(false)

  useEffect(() => { void fetchVariants() }, [fetchVariants])

  useEffect(() => {
    if (!open || !product) return
    const def = getDefaultVariant(String(product.id))
    setSelected(def)
    setQty(1)
    setAdded(false)
  }, [open, product, getDefaultVariant])

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

  const handleAdd = useCallback(() => {
    if (!product || !selected) return
    const synthetic = variantToProduct(product, selected)
    // Pass variant identity so it flows through to order_items
    addItem(
      synthetic,
      qty,
      synthetic.unitLabel,
      selected.id,                // variantId  (product_variants.id)
      selected.variantName,       // variantName (snapshot)
      String(product.id),         // parentProductId (products.id — before synthetic override)
    )
    setAdded(true)
    setTimeout(() => {
      setAdded(false)
      onClose()
    }, 700)
  }, [product, selected, qty, addItem, onClose])

  if (!product) return null

  const variants = getVariants(String(product.id))
  const hasStock = selected ? selected.stock > 0 : false

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="vsm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            key="vsm-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl"
            style={{ maxHeight: '90svh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-start gap-3 px-4 pt-2 pb-4 border-b border-gray-100">
              {/* Product image */}
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F0F2EE] shrink-0">
                <img
                  src={getProductImage(product.name, product.category, product.imageUrl, 'tile')}
                  alt={product.name}
                  onError={onImgError}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-black text-[#2C392A] leading-tight">{product.name}</h3>
                {selected && (
                  <p className="text-[13px] font-black text-[#2C392A] mt-1">
                    {formatCurrency(selected.price)}
                    {selected.sizeLabel && (
                      <span className="text-[11px] font-semibold text-[#5F6D59] ml-1.5">
                        / {selected.sizeLabel}
                      </span>
                    )}
                  </p>
                )}
                {!hasStock && selected && (
                  <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                    {l('Out of stock', 'இருப்பு இல்லை')}
                  </span>
                )}
              </div>

              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 shrink-0">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Scrollable variant list */}
            <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: '45svh' }}>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#5F6D59] mb-3">
                {l('Select Variant', 'வகை தேர்வு')}
              </p>

              <div className="space-y-2">
                {variants.map(v => {
                  const isSelected = selected?.id === v.id
                  const outOfStock = v.stock <= 0

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { if (!outOfStock) { setSelected(v); setQty(1) } }}
                      disabled={outOfStock}
                      className={[
                        'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl',
                        'border-2 text-left transition-all',
                        isSelected
                          ? 'border-[#2C392A] bg-[#2C392A]/5'
                          : outOfStock
                            ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                            : 'border-gray-100 hover:border-[#7DAA8F] bg-white',
                      ].join(' ')}
                    >
                      {/* Radio indicator */}
                      <span className={[
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                        isSelected ? 'border-[#2C392A] bg-[#2C392A]' : 'border-gray-300',
                      ].join(' ')}>
                        {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                      </span>

                      {/* Variant name + size */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-bold leading-tight ${isSelected ? 'text-[#2C392A]' : 'text-[#444]'}`}>
                          {v.variantName}
                        </p>
                        {v.sizeLabel && v.sizeLabel !== v.variantName && (
                          <p className="text-[11px] text-[#5F6D59]">{v.sizeLabel}</p>
                        )}
                        {outOfStock && (
                          <p className="text-[10px] text-red-500 font-bold">{l('Out of stock', 'இருப்பு இல்லை')}</p>
                        )}
                      </div>

                      {/* Price */}
                      <span className={`text-[14px] font-black shrink-0 ${isSelected ? 'text-[#2C392A]' : 'text-[#333]'}`}>
                        {formatCurrency(v.price)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer: quantity + add to cart */}
            <div className="px-4 py-4 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-3">
                {/* Quantity stepper */}
                <div className="flex items-center gap-0 bg-[#F0F2EE] rounded-xl overflow-hidden border border-[#D5DAD0]">
                  <button
                    type="button"
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center text-[#2C392A] hover:bg-[#E8EDE4] transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center text-[14px] font-black text-[#2C392A]">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(q => q + 1)}
                    disabled={selected ? qty >= selected.stock : true}
                    className="w-10 h-10 flex items-center justify-center text-[#2C392A] hover:bg-[#E8EDE4] transition-colors disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Add to cart button */}
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!selected || !hasStock || added}
                  className={[
                    'flex-1 h-10 rounded-xl font-black text-[13px] transition-all flex items-center justify-center gap-2',
                    added
                      ? 'bg-green-500 text-white'
                      : !hasStock
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-[#2C392A] hover:bg-[#1e2817] text-white',
                  ].join(' ')}
                >
                  {added ? (
                    <><Check size={15} /> {l('Added!', 'சேர்க்கப்பட்டது!')}</>
                  ) : !hasStock ? (
                    l('Out of Stock', 'இருப்பு இல்லை')
                  ) : (
                    <><ShoppingCart size={14} /> {l('Add to Cart', 'கூடையில் சேர்')} · {selected ? formatCurrency(selected.price * qty) : '—'}</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
