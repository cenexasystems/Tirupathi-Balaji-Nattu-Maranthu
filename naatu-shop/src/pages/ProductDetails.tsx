import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCartStore, useProductStore, type Product } from '../store/store'
import { useLangStore } from '../store/langStore'
import { ShoppingCart } from 'lucide-react'
import { formatPricePerUnit } from '../lib/retail'

export default function ProductDetails() {
  const { id } = useParams()
  const add = useCartStore((state) => state.add)
  const fetchProducts = useProductStore((state) => state.fetchProducts)
  const { t, lang } = useLangStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!id) {
        setError('Product not found')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        let localProduct = useProductStore.getState().products.find((item) => String(item.id) === id)

        if (!localProduct) {
          await fetchProducts()
          localProduct = useProductStore.getState().products.find((item) => String(item.id) === id)
        }

        if (localProduct && localProduct.isActive) {
          setProduct(localProduct)
          return
        }

        throw new Error('Product not available')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id, fetchProducts])

  if (loading) return <div className="p-10 font-bold text-center">Loading...</div>
  if (error || !product) return <div className="p-10 text-red-500 font-bold text-center">{error || 'Product not found'}</div>

  const displayName = lang === 'ta' && product.nameTa ? product.nameTa : product.name
  const displayDesc = lang === 'ta' && product.descriptionTa ? product.descriptionTa : product.description
  const displayBen = lang === 'ta' && product.benefitsTa ? product.benefitsTa : product.benefits

  return (
    <div className="bg-bgMain min-h-screen py-8 sm:py-10">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
        <div className="rounded-3xl overflow-hidden border border-sand/50 bg-white shadow-soft" style={{ aspectRatio: '1' }}>
          <img src={product.image} alt={product.name} loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&q=80' }}
            className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" />
        </div>
        
        <div className="flex flex-col">
          <div className="mb-6 pb-6 border-b border-sand/50">
            <span className="text-xs font-bold text-sageDark uppercase tracking-wider mb-2 block">{t('cat.' + product.category)}</span>
            <h1 className="text-2xl sm:text-4xl font-bold font-headline text-textMain mb-2">{displayName}</h1>
            
            {product.remedy && product.remedy.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {product.remedy.map(r => (
                  <span key={r} className="bg-sand/40 text-textMuted px-3 py-1 rounded-full text-xs font-bold">
                    {t('remedy.' + r)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="font-bold text-textMain mb-2">Description</h3>
            <p className="text-textMuted leading-relaxed">{displayDesc}</p>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-textMain mb-2">Benefits</h3>
            <p className="text-textMuted leading-relaxed whitespace-pre-line">{displayBen}</p>
          </div>

          <div className="mt-auto bg-white p-6 rounded-2xl border border-sand/50 shadow-soft">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-sm font-bold text-textMuted mb-1">Price</p>
                <div className="flex items-center gap-3">
                  {product.offerPrice ? (
                    <>
                      <span className="text-3xl font-bold font-headline text-green-600">₹{product.offerPrice}</span>
                      <span className="text-lg text-gray-400 line-through font-medium">₹{product.price}</span>
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">
                        {Math.round(((product.price - product.offerPrice) / product.price) * 100)}% OFF
                      </span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold font-headline text-textMain">₹{product.price}</span>
                  )}
                </div>
                <p className="text-xs text-sageDark font-bold mt-2">{formatPricePerUnit(product.offerPrice || product.price, product.baseQuantity, product.unitLabel, product.unitType)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-textMuted mb-1">Availability</p>
                <p className="font-bold text-sageDark">Always available</p>
              </div>
            </div>

            <button
              onClick={() => add(product)}
              className="w-full flex items-center justify-center gap-2 font-bold py-3.5 sm:py-4 rounded-xl transition-colors bg-sageDark hover:bg-sageDeep text-white"
            >
              <ShoppingCart size={18} /> Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
