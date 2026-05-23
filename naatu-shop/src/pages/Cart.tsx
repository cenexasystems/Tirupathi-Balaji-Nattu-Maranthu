import { motion } from 'framer-motion'
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft } from 'lucide-react'
import { useCartStore } from '../store/store'
import { useLangStore } from '../store/langStore'
import { Link } from 'react-router-dom'
import { BRAND_EN, BRAND_TA, BRAND_SUBTITLE, BRAND_WHATSAPP, BRAND_WHATSAPP_LINK } from '../lib/brand'
import { formatCurrency, formatPricePerUnit, formatQuantityDisplay, getQuantityStepForProduct } from '../lib/retail'
import { PLACEHOLDER as PRODUCT_PLACEHOLDER } from '../lib/productImages'

export default function Cart() {
  const { items, remove, updateQty, total, count, clear } = useCartStore()
  const { t, lang } = useLangStore()
  const sub = total()
  const shipping = sub === 0 ? 0 : 50
  const grand = sub + shipping

  const getStep = (item: (typeof items)[number]) => getQuantityStepForProduct({
    unitType: item.unitType,
    baseQuantity: item.baseQuantity,
    allowDecimalQuantity: item.allowDecimalQuantity,
  })

  return (
    <div className="bg-bgMain min-h-screen">
      <div className="bg-gradient-to-r from-[#eaf2e5] to-bgMain border-b border-sand/50 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-3 sm:gap-4">
          <ShoppingBag className="text-sageDark shrink-0" size={24} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline text-textMain">{t('cart.title')}</h1>
            <p className="text-textMuted text-xs sm:text-sm">{count()} {t('cart.items_in_cart')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 flex flex-col lg:flex-row gap-6 sm:gap-8">
        {/* Cart items */}
        <div className="w-full lg:w-[62%]">
          {items.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 sm:p-16 text-center border border-sand/50 shadow-soft">
              <p className="text-6xl mb-4">🛒</p>
              <h3 className="text-xl font-bold text-textMain mb-2 font-headline">{t('cart.empty')}</h3>
              <p className="text-textMuted text-sm mb-6">{t('cart.empty_sub')}</p>
              <Link to="/products" className="inline-flex items-center gap-2 bg-sageDark hover:bg-sageDeep text-white font-bold px-6 py-3 rounded-xl transition-colors">
                {t('cart.browse')}
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-sand/50 shadow-soft overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-sand/40">
                <h2 className="font-bold text-textMain font-headline">{t('cart.order_items')} ({items.length})</h2>
                <button onClick={clear} className="text-sm text-red-400 hover:text-red-600 font-medium">{t('cart.clear_all')}</button>
              </div>
              <div className="divide-y divide-sand/30">
                {items.map(item => (
                  <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-gray-50 border border-sand/40">
                      <img src={item.image} alt={item.name}
                        onError={(e) => { (e.target as HTMLImageElement).src = PRODUCT_PLACEHOLDER }}
                        className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow flex flex-col items-start gap-0.5 sm:gap-1">
                      <h3 className="font-bold text-sm sm:text-base text-textMain">
                        {lang === 'ta' && item.nameTa ? item.nameTa : item.name}
                      </h3>
                      <p className="text-xs text-sageDark font-bold">{t('cat.' + item.category)}</p>
                      <p className="text-[11px] text-gray-400">{formatPricePerUnit(item.basePrice, item.baseQuantity, item.unitLabel, item.unitType)}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-0 border-2 border-sand rounded-lg overflow-hidden bg-white">
                        <button onClick={() => updateQty(item.id, item.qty - getStep(item))} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-textMuted hover:bg-bgMain hover:text-textMain transition-colors touch-target"><Minus size={14} /></button>
                        <span className="min-w-12 sm:min-w-14 px-1 sm:px-2 text-center font-bold text-sm text-textMain">{formatQuantityDisplay(item.qty, item.selectedUnit, item.unitType)}</span>
                        <button onClick={() => updateQty(item.id, item.qty + getStep(item))} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-textMuted hover:bg-bgMain hover:text-textMain transition-colors touch-target"><Plus size={14} /></button>
                      </div>
                      <span className="text-lg font-bold text-textMain font-headline w-24 text-right whitespace-nowrap">{formatCurrency(item.lineTotal)}</span>
                      <button onClick={() => remove(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          <Link to="/products" className="inline-flex items-center gap-2 text-sageDark font-bold text-sm mt-5 hover:gap-3 transition-all group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> {t('cart.continue')}
          </Link>
        </div>

        {/* Invoice + actions */}
        <div className="w-full lg:w-[38%]">
          <div className="bg-white rounded-2xl border border-sand/50 shadow-soft p-6 sticky top-24 sm:top-[110px]">
            <h2 className="font-bold text-xl font-headline text-textMain mb-5 pb-4 border-b border-sand/40">{t('cart.bill_summary')}</h2>

            {/* Invoice printable area */}
            <div id="invoice-area" className="print-receipt bg-bgMain rounded-xl p-4 mb-5 text-sm">
              <div className="text-center mb-3 pb-3 border-b border-dashed border-sand">
                <p className="font-extrabold text-base font-headline text-textMain">{BRAND_EN}</p>
                <p className="text-[11px] font-semibold text-textMuted">{BRAND_TA}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-sageDark font-bold">{BRAND_SUBTITLE}</p>
                <p className="text-xs text-textMuted mt-1">Contact: WhatsApp {BRAND_WHATSAPP}</p>
                <p className="text-[10px] text-textMuted mt-1">{BRAND_WHATSAPP_LINK}</p>
              </div>
              {items.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-3">{t('cart.empty')}</p>
              ) : (
                <>
                  {items.map(i => {
                    const dbName = lang === 'ta' && i.nameTa ? i.nameTa : i.name;
                    return (
                      <div key={i.id} className="flex justify-between mb-1.5 gap-2">
                        <span className="text-textMain truncate text-xs">{dbName} ({formatQuantityDisplay(i.qty, i.selectedUnit, i.unitType)})</span>
                        <span className="font-bold text-textMain text-xs shrink-0">{formatCurrency(i.lineTotal)}</span>
                      </div>
                    )
                  })}
                  <div className="border-t border-dashed border-sand pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-textMuted"><span>{t('cart.subtotal')}</span><span>{formatCurrency(sub)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-textMuted">{t('cart.shipping')}</span>
                      <span className={shipping === 0 && sub > 0 ? 'text-sageDark font-bold' : 'text-textMuted'}>
                        {sub === 0 ? '–' : shipping === 0 ? t('cart.free') : formatCurrency(shipping)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-textMain text-base border-t pt-2">
                      <span>{t('cart.grand_total')}</span><span>{formatCurrency(grand)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Link to="/checkout"
                className={`flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition-colors text-sm ${
                  items.length ? 'bg-sageDark hover:bg-sageDeep text-white cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
                }`}>
                Proceed to Checkout
              </Link>
            </div>

            {sub > 0 && (
              <p className="text-xs text-center text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-3 font-medium">
                {t('cart.add_more')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
