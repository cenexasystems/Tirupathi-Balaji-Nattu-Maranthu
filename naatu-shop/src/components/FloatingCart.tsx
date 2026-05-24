import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, ArrowRight, LogIn } from 'lucide-react'
import { useCartStore, useAuthStore } from '../store/store'
import { useLangStore } from '../store/langStore'
import { motion, AnimatePresence } from 'framer-motion'

export default function FloatingCart() {
  const { total, count } = useCartStore()
  const { user } = useAuthStore()
  const { t } = useLangStore()
  const location = useLocation()
  
  const isCartOrCheckout = location.pathname === '/cart' || location.pathname === '/checkout'
  const subtotal = total()
  const itemCount = count()

  return (
    <AnimatePresence>
      {itemCount > 0 && !isCartOrCheckout && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-3 left-3 right-3 z-50 pointer-events-none flex justify-center sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        >
          <div className="pointer-events-auto flex w-full max-w-[26rem] items-center gap-3 rounded-2xl border border-white/10 bg-[#232f3e]/95 px-4 py-3 text-white shadow-[0_20px_50px_rgba(35,47,62,0.4)] backdrop-blur-xl transition-all hover:scale-[1.01] active:scale-[0.99] sm:w-auto sm:max-w-none sm:gap-10 sm:rounded-full sm:px-8 sm:py-4 ring-4 ring-white/5">
            <Link 
              to="/cart"
              className="flex min-w-0 flex-1 items-center gap-3 border-r border-white/10 pr-3 hover:opacity-80 transition-opacity sm:gap-4 sm:pr-8"
            >
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 animate-pulse-slow sm:h-10 sm:w-10">
                  <ShoppingCart size={18} className="text-white sm:size-[22px]" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-black text-white shadow-lg transform scale-110 sm:h-5 sm:w-5 sm:text-[10px]">
                  {itemCount}
                </span>
              </div>
              <div>
                <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/50 leading-none sm:text-[10px] sm:tracking-[0.2em]">{t('cart.total')}</p>
                <p className="truncate text-base font-black tracking-tight leading-none sm:text-xl">₹{subtotal}</p>
              </div>
            </Link>
            
            <Link 
              to={user ? "/checkout" : "/login"}
              className="group flex items-center gap-2 font-black text-[10px] tracking-[0.15em] uppercase hover:text-green-400 transition-all sm:gap-3 sm:text-xs"
            >
              {!user && <LogIn size={14} className="opacity-70 group-hover:rotate-12 transition-transform sm:size-4" />}
              <span className="whitespace-nowrap">{user ? t('cart.checkout_small') : t('nav.login')}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-green-500">
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform sm:size-5" />
              </div>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
