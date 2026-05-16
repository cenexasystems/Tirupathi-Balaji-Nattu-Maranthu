import './index.css'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import FloatingCart from './components/FloatingCart'
import Home from './pages/Home'
import Products from './pages/Products'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Register from './pages/Register'
import Favorites from './pages/Favorites'
import ProductDetails from './pages/ProductDetails'
import Checkout from './pages/Checkout'
import Profile from './pages/Profile'
import { useAuthStore, useProductStore } from './store/store'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { BRAND_EN } from './lib/brand'

// Heavy admin pages — split into separate chunks
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
  const initialize = useAuthStore((state) => state.initialize)
  const fetchProducts = useProductStore((state) => state.fetchProducts)
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    document.title = BRAND_EN
  }, [])

  useEffect(() => {
    void fetchProducts()

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
  }, [fetchProducts])

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
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

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
          <Route path="/pos" element={
            <ProtectedRoute><AdminRoute>
              <Suspense fallback={<LoadingSpinner />}><Pos /></Suspense>
            </AdminRoute></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
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
