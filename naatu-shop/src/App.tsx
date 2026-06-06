import './index.css'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import FloatingCart from './components/FloatingCart'
import ProductDetailModal from './components/ProductDetailModal'
import VariantSelectorModal from './components/VariantSelectorModal'
import Home from './pages/Home'
import Products from './pages/Products'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Register from './pages/Register'
import Favorites from './pages/Favorites'
import Gallery from './pages/Gallery'
import ProductDetails from './pages/ProductDetails'
import { useAuthStore, useProductModalStore, useProductStore, useVariantModalStore, useVariantStore } from './store/store'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { BRAND_EN } from './lib/brand'

// Protected / heavy pages — split into separate chunks so customers don't
// download checkout, profile, or admin code on the initial page load.
const Checkout  = lazy(() => import('./pages/Checkout'))
const Profile   = lazy(() => import('./pages/Profile'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Pos       = lazy(() => import('./pages/Pos'))

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bgMain">
      <span className="w-10 h-10 border-4 border-sand border-t-sageDark rounded-full animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)
  const location = useLocation()
  if (loading) return <LoadingSpinner />
  return user ? <>{children}</> : <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)
  if (loading) return <LoadingSpinner />
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)
  if (loading) return <LoadingSpinner />
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />
}

function AppShell() {
  const location = useLocation()
  const previousPathname = useRef(location.pathname)
  const initialize = useAuthStore((state) => state.initialize)
  const fetchProducts = useProductStore((state) => state.fetchProducts)
  const products = useProductStore((state) => state.products)
  const modalProduct = useProductModalStore((state) => state.product)
  const modalOpen = useProductModalStore((state) => state.open)
  const openProduct = useProductModalStore((state) => state.openProduct)
  const closeProduct = useProductModalStore((state) => state.closeProduct)
  const variantModalProduct = useVariantModalStore((state) => state.product)
  const variantModalOpen = useVariantModalStore((state) => state.open)
  const closeVariantModal = useVariantModalStore((state) => state.closeVariantModal)
  const fetchVariants = useVariantStore((state) => state.fetchVariants)
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  useEffect(() => {
    if (!isSupabaseConfigured) {
      void initialize()
      return
    }

    // Register listener BEFORE initialize() so we never miss the SIGNED_IN
    // event that Supabase fires after processing the Google OAuth URL fragment.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // SIGNED_IN  → fires after Google OAuth redirect lands back on the app
      // INITIAL_SESSION → fires on first load when a session already exists
      //                   (e.g., the user refreshes the page while logged in)
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        void initialize()
      }
    })

    // Also call initialize directly so a pre-existing localStorage session
    // is picked up even if onAuthStateChange somehow already fired.
    void initialize()

    return () => subscription.unsubscribe()
  }, [initialize])

  useEffect(() => {
    document.title = BRAND_EN
  }, [])

  useEffect(() => {
    if (previousPathname.current !== location.pathname) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      if (modalOpen) {
        closeProduct()
      }
      previousPathname.current = location.pathname
    }
  }, [closeProduct, location.pathname, modalOpen])

  useEffect(() => {
    if (!modalOpen) return

    const handlePopState = () => {
      closeProduct()
    }

    window.history.pushState({ productModalOpen: true }, '', window.location.href)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [closeProduct, modalOpen])

  useEffect(() => {
    void fetchProducts()
    void fetchVariants()

    if (!isSupabaseConfigured) {
      return
    }

    const channel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        void fetchProducts()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchProducts, fetchVariants])

  const relatedProducts = products.length > 0 && modalProduct
    ? products.filter((item) => item.isActive && item.category === modalProduct.category && item.id !== modalProduct.id).slice(0, 10)
    : []

  const handleCloseProduct = () => {
    if (modalOpen && window.history.state?.productModalOpen) {
      window.history.back()
      return
    }

    closeProduct()
  }

  return (
    <div className="flex flex-col min-h-screen print:block print:min-h-0">
      {!isAuthPage && <div className="print-hidden"><Navbar /></div>}
      <main className="flex-grow print:block">
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />

          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner />}><Checkout /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner />}><Profile /></Suspense>
            </ProtectedRoute>
          } />

          {/* Admin-only — lazily loaded to reduce main bundle size */}
          <Route path="/admin" element={
            <ProtectedRoute><AdminRoute>
              <Suspense fallback={<LoadingSpinner />}><Dashboard /></Suspense>
            </AdminRoute></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><AdminRoute>
              <Suspense fallback={<LoadingSpinner />}><Dashboard /></Suspense>
            </AdminRoute></ProtectedRoute>
          } />
          <Route path="/whatsapp-center" element={
            <ProtectedRoute><AdminRoute>
              <Suspense fallback={<LoadingSpinner />}><Dashboard /></Suspense>
            </AdminRoute></ProtectedRoute>
          } />
          <Route path="/pos-analytics" element={
            <ProtectedRoute><AdminRoute>
              <Suspense fallback={<LoadingSpinner />}><Dashboard /></Suspense>
            </AdminRoute></ProtectedRoute>
          } />
          <Route path="/pos" element={
            <ProtectedRoute><AdminRoute>
              <Suspense fallback={<LoadingSpinner />}><Pos /></Suspense>
            </AdminRoute></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ProductDetailModal
        key={`${modalProduct?.id ?? 'none'}-${modalOpen ? 'open' : 'closed'}`}
        product={modalProduct}
        open={modalOpen}
        onClose={handleCloseProduct}
        onSelectProduct={openProduct}
        relatedProducts={relatedProducts}
      />
      <VariantSelectorModal
        product={variantModalProduct}
        open={variantModalOpen}
        onClose={closeVariantModal}
      />
      <FloatingCart />
      {!isAuthPage && <div className="print-hidden"><Footer /></div>}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
