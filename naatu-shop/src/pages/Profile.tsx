import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/store'
import { useLangStore } from '../store/langStore'
import { Package, User, LogOut, ChevronDown, ChevronUp, ShoppingBag, Settings } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { getLocalOrdersForUser } from '../lib/ordersFallback'
import { formatCurrency, formatPricePerUnit, formatQuantityDisplay, normalizeStructuredOrderItem } from '../lib/retail'

interface ProfileOrderItem {
  product_id: string | null   // UUID — Supabase products.id is UUID
  quantity: number
  unit: string
  unit_type: 'unit' | 'weight' | 'volume' | 'bundle'
  base_quantity: number
  base_price: number
  line_total: number
  name: string
  tamil_name?: string | null
  image_url?: string | null
}

interface ProfileOrder {
  id: string
  invoice_no: string
  customer_name: string
  phone: string
  address: string
  subtotal: number
  shipping: number
  total: number
  status: string
  created_at: string
  items: ProfileOrderItem[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E', label: 'Pending' },
  processing: { bg: '#DBEAFE', text: '#1E40AF', label: 'Processing' },
  completed: { bg: '#D1FAE5', text: '#065F46', label: 'Completed' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B', label: 'Cancelled' },
}

export default function Profile() {
  const { user, logout } = useAuthStore()
  const { lang } = useLangStore()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<ProfileOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'orders' | 'info'>('orders')

  const parseOrderItems = (value: unknown): ProfileOrderItem[] => {
    if (!Array.isArray(value)) return []

    return value.map((item) => normalizeStructuredOrderItem(
      item && typeof item === 'object' ? (item as Record<string, unknown>) : {},
    ))
  }

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (user.role === 'admin') { setLoading(false); return }

    if (!isSupabaseConfigured) {
      if (!import.meta.env.DEV) {
        setOrders([])
        setLoading(false)
        return
      }

      const localOrders = getLocalOrdersForUser({ userId: user.id, phone: user.mobile })
      setOrders(localOrders.map((order) => ({
        ...order,
        subtotal: Number(order.subtotal),
        shipping: Number(order.shipping),
        total: Number(order.total),
        items: parseOrderItems(order.items),
      })))
      setLoading(false)
      return
    }

    const loadOrders = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (!authData.user) {
          navigate('/login')
          return
        }

        const phoneDigits = (user.mobile || '').replace(/\D/g, '')

        const baseQuery = supabase
          .from('orders')
          .select('id, invoice_no, customer_name, phone, address, items, subtotal, shipping, total, status, created_at')
          .order('created_at', { ascending: false })

        let ordersData: Array<Record<string, unknown>> | null = null
        let ordersError: unknown = null

        const linkedOrdersResult = await baseQuery.eq('user_id', authData.user.id)
        ordersData = linkedOrdersResult.data
        ordersError = linkedOrdersResult.error

        if ((!ordersData || ordersData.length === 0) && phoneDigits) {
          const phoneOrdersResult = await baseQuery.eq('phone', phoneDigits)
          ordersData = phoneOrdersResult.data
          ordersError = phoneOrdersResult.error
        }

        if (ordersError) {
          throw ordersError
        }

        if (!ordersData || ordersData.length === 0) {
          setOrders([])
          return
        }

        const mappedOrders: ProfileOrder[] = ordersData.map((order) => ({
          id: String(order.id || ''),
          invoice_no: String(order.invoice_no || ''),
          customer_name: String(order.customer_name || ''),
          phone: String(order.phone || ''),
          address: String(order.address || ''),
          subtotal: Number(order.subtotal),
          shipping: Number(order.shipping),
          total: Number(order.total),
          status: String(order.status || 'pending'),
          created_at: String(order.created_at || new Date().toISOString()),
          items: parseOrderItems(order.items),
        }))

        setOrders(mappedOrders)
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    void loadOrders()

    const channel = supabase
      .channel(`profile-orders-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void loadOrders()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, navigate])

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="bg-bgMain min-h-screen py-10">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-textMain mb-6 sm:mb-8">My Account</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-soft border border-sand/50">
              {/* Avatar */}
              <div className="flex flex-col items-center text-center mb-6 pb-6 border-b border-sand">
                <div className="w-20 h-20 bg-gradient-to-br from-sage to-sageDark rounded-full flex items-center justify-center mb-3">
                  <span className="text-white text-3xl font-bold">{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <h2 className="text-lg font-bold text-textMain">{user.name}</h2>
                <p className="text-sm text-textMuted">{user.email}</p>
                {user.mobile && <p className="text-sm text-textMuted">{user.mobile}</p>}
                <span className={`mt-2 px-3 py-0.5 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-sageDark/20 text-sageDark' : 'bg-blue-100 text-blue-700'}`}>
                  {user.role === 'admin' ? '⚡ Admin' : '🛒 Customer'}
                </span>
              </div>

              {/* Nav */}
              <div className="space-y-2">
                <button onClick={() => setActiveTab('orders')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === 'orders' ? 'bg-sageDark/10 text-sageDark' : 'text-textMuted hover:bg-bgMain'}`}>
                  <Package size={16} /> Order History
                </button>
                <button onClick={() => setActiveTab('info')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === 'info' ? 'bg-sageDark/10 text-sageDark' : 'text-textMuted hover:bg-bgMain'}`}>
                  <User size={16} /> Account Info
                </button>
                <button onClick={() => navigate('/dashboard')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-textMuted hover:bg-bgMain transition-colors">
                  <Settings size={16} /> Dashboard & Billing
                </button>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-500 hover:bg-red-50 transition-colors">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="md:col-span-2">
            {/* Account Info */}
            {activeTab === 'info' && (
              <div className="bg-white p-6 rounded-2xl shadow-soft border border-sand/50">
                <h2 className="text-xl font-bold text-textMain mb-6 flex items-center gap-2">
                  <User size={20} className="text-sageDark" /> Account Information
                </h2>
                <div className="space-y-4">
                  {[
                    { label: 'Full Name', value: user.name },
                    { label: 'Email', value: user.email || '—' },
                    { label: 'Mobile', value: user.mobile || '—' },
                    { label: 'Account Type', value: user.role === 'admin' ? 'Administrator' : 'Customer' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-4 p-4 bg-bgMain rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-textMuted uppercase tracking-wide">{item.label}</p>
                        <p className="font-bold text-textMain mt-1">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {isSupabaseConfigured && (
                  <p className="text-xs text-textMuted mt-6 bg-blue-50 px-4 py-3 rounded-xl">
                    ✉️ Your account is linked to your email. To update your profile, contact support.
                  </p>
                )}
              </div>
            )}

            {/* Orders */}
            {activeTab === 'orders' && (
              <div className="bg-white p-6 rounded-2xl shadow-soft border border-sand/50">
                <h2 className="text-xl font-bold text-textMain mb-6 flex items-center gap-2">
                  <Package size={20} className="text-sageDark" /> Order History
                  <span className="ml-auto text-sm font-normal text-textMuted">{orders.length} orders</span>
                </h2>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <span className="w-8 h-8 border-4 border-sand border-t-sageDark rounded-full animate-spin" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-16">
                    <ShoppingBag size={48} className="mx-auto text-textMuted opacity-30 mb-4" />
                    <p className="font-bold text-textMain mb-2">No orders yet</p>
                    <p className="text-sm text-textMuted mb-6">Start shopping to see your orders here</p>
                    <Link to="/products"
                      className="inline-block bg-sageDark hover:bg-sageDeep text-white font-bold px-6 py-3 rounded-xl transition-colors">
                      Browse Products
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((o) => {
                      const statusInfo = STATUS_COLORS[o.status] || STATUS_COLORS.pending
                      const isExpanded = expanded === o.id
                      return (
                        <div key={o.id} className="border border-sand rounded-xl overflow-hidden">
                          <div
                            onClick={() => setExpanded(isExpanded ? null : o.id)}
                            className="flex flex-wrap gap-4 items-center justify-between p-4 cursor-pointer hover:bg-bgMain transition-colors"
                          >
                            <div>
                              <p className="font-bold text-sm text-textMain">{o.invoice_no}</p>
                              <p className="text-xs text-textMuted mt-0.5">
                                {new Date(o.created_at).toLocaleDateString('en-GB')} · {o.items?.length || 0} items
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: statusInfo.bg, color: statusInfo.text }}>
                                {statusInfo.label}
                              </span>
                              <span className="font-bold text-textMain">₹{o.total}</span>
                              {isExpanded ? <ChevronUp size={16} className="text-textMuted" /> : <ChevronDown size={16} className="text-textMuted" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-sand bg-white p-4">
                              <div className="mb-4 pb-4 border-b border-sand/50 text-sm grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-textMuted font-bold uppercase mb-1">Customer</p>
                                  <p className="font-medium text-textMain">{o.customer_name}</p>
                                  <p className="text-textMuted">{o.phone}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-textMuted font-bold uppercase mb-1">Address</p>
                                  <p className="text-textMuted">{o.address}</p>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[520px] text-sm">
                                  <thead className="text-left text-textMuted border-b border-sand">
                                  <tr>
                                    <th className="pb-2 font-medium">Item</th>
                                    <th className="pb-2 font-medium text-center">Qty</th>
                                    <th className="pb-2 font-medium text-right">Price</th>
                                  </tr>
                                </thead>
                                  <tbody className="divide-y divide-sand/30">
                                  {(o.items || []).map((item, i: number) => {
                                      const pName = lang === 'ta' && item.tamil_name ? item.tamil_name : item.name
                                    return (
                                      <tr key={i}>
                                        <td className="py-2 font-medium text-textMain">{pName}</td>
                                          <td className="py-2 text-center text-textMuted">{formatQuantityDisplay(item.quantity, item.unit, item.unit_type)}</td>
                                          <td className="py-2 text-right font-bold text-textMain">{formatCurrency(item.line_total)}</td>
                                      </tr>
                                    )
                                  })}
                                  </tbody>
                                </table>
                              </div>

                              <div className="mt-3 space-y-1">
                                {(o.items || []).map((item, i: number) => (
                                  <p key={`meta-${i}`} className="text-[11px] text-textMuted">
                                    {(lang === 'ta' && item.tamil_name ? item.tamil_name : item.name)}: {formatPricePerUnit(item.base_price, item.base_quantity, item.unit, item.unit_type)}
                                  </p>
                                ))}
                              </div>

                              <div className="mt-4 pt-4 border-t border-sand text-sm space-y-1 text-right">
                                  <p className="text-textMuted">Subtotal: {formatCurrency(o.subtotal)}</p>
                                  <p className="text-textMuted">Shipping: {o.shipping === 0 ? 'FREE' : formatCurrency(o.shipping)}</p>
                                  <p className="font-bold text-textMain text-base">Total: {formatCurrency(o.total)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
