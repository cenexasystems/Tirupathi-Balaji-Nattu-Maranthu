import React, { useCallback, useEffect, useState, useMemo, useRef, type FormEvent } from 'react'
import {
  BarChart2, Trash2, Edit2, List, ShoppingCart, LayoutDashboard,
  Box, AlertCircle, ArrowUp, ArrowDown, Power, Download, TrendingUp,
  Package, IndianRupee, Search, RefreshCw, Users, ShieldCheck, ShieldOff, Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { debounce } from '../lib/debounce'
import { useAuthStore, useProductStore, type Product } from '../store/store'
import { uploadProductImage } from '../lib/storage'
import { formatCurrency, normalizeOrderMode, normalizeUnitType, toNumber, type UnitType } from '../lib/retail'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'

type Category = { id: string | number; name_en: string; name_ta: string; is_active?: boolean; sort_order?: number }
type DashboardOrder = {
  id: string; invoice_no: string; customer_name: string; phone: string; address: string
  created_at: string; total: number; status: string; order_mode: string; order_type: string; user_id: string | null; items: unknown
  coupon_code: string; discount_amount: number; delivery_charge: number
}
type DashboardOrderItem = { order_id: string; product_name: string; quantity: number; line_total: number; is_manual?: boolean | null }
type DashboardCoupon = {
  id: number
  code: string
  percentage: number
  is_active: boolean
  expiry_date: string | null
  usage_limit: number | null
  usage_count: number
  min_order_value: number
}
type TabKey = 'overview' | 'billing' | 'products' | 'categories' | 'coupons' | 'users'
type ProfileUser = { id: string; email: string; name: string; mobile: string; role: string; created_at: string }

const normalizeStatus = (v: unknown) => String(v || '').trim().toLowerCase()
const normalizeOrderType = (v: unknown) => String(v || '').trim().toLowerCase() || 'pos_sale'
const isCompletedStatus = (v: unknown) => {
  const status = normalizeStatus(v)
  return status === 'completed' || status === 'paid'
}
const parseOrderItems = (items: unknown): Record<string, unknown>[] => {
  if (Array.isArray(items)) return items.filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
  if (typeof items === 'string') { try { const p = JSON.parse(items); return Array.isArray(p) ? p : [] } catch { return [] } }
  return []
}

const emptyForm = {
  name: '', nameTa: '', category: '', categoryId: null as string | number | null,
  remedy: [] as string[], price: 0, offerPrice: '' as string | number,
  unitType: 'unit' as UnitType, unitLabel: 'piece', baseQuantity: 1,
  stockQuantity: 100, stockUnit: 'piece', allowDecimalQuantity: false,
  predefinedOptionsText: '', isActive: true, sortOrder: 0, stock: 100,
  description: '', descriptionTa: '', benefits: '', benefitsTa: '', image: '',
}

const exportCSV = (orders: DashboardOrder[]) => {
  const header = ['Order Ref', 'Customer', 'Phone', 'Date', 'Total (Rs)', 'Order Type', 'Status']
  const rows = orders.map(o => [
    o.order_type === 'online_request' ? o.id : o.invoice_no, o.customer_name, o.phone,
    new Date(o.created_at).toLocaleDateString('en-IN'),
    toNumber(o.total, 0).toFixed(2), o.order_type, o.status,
  ])
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const UNIT_TYPE_OPTIONS: { value: UnitType; label: string; hint: string }[] = [
  { value: 'unit',   label: 'Unit (piece)',    hint: 'e.g. Kungumam packet, Camphor box' },
  { value: 'weight', label: 'Weight (g / kg)', hint: 'e.g. Turmeric powder, Cardamom' },
  { value: 'volume', label: 'Volume (ml / L)', hint: 'e.g. Neem oil, Honey' },
  { value: 'bundle', label: 'Bundle / Set',    hint: 'e.g. Pooja kit, Herbal pack' },
]

const DEFAULT_OPTIONS_FOR_TYPE: Record<UnitType, string> = {
  unit:   '',
  weight: '100g, 250g, 500g, 1kg',
  volume: '250ml, 500ml, 1L',
  bundle: '',
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const { products, fetchProducts } = useProductStore()
  const [tab, setTab]       = useState<TabKey>('overview')
  const [loading, setLoading] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [productNotice, setProductNotice] = useState('')
  const [cats, setCats]     = useState<Category[]>([])
  const [orders, setOrders] = useState<DashboardOrder[]>([])
  const [orderItems, setOrderItems] = useState<DashboardOrderItem[]>([])
  const [editingProd, setEditingProd] = useState<Product | null>(null)
  const [prodForm, setProdForm] = useState(emptyForm)
  const [newCat, setNewCat] = useState({ name_en: '', name_ta: '' })
  const [coupons, setCoupons] = useState<DashboardCoupon[]>([])
  const [couponForm, setCouponForm] = useState({ code: '', percentage: 10, expiry_date: '', usage_limit: '', min_order_value: '' })
  const [couponSaveError, setCouponSaveError] = useState('')
  const [couponSaveSuccess, setCouponSaveSuccess] = useState('')
  const [editingCouponId, setEditingCouponId] = useState<number | null>(null)

  // WA detail expansion
  const [waExpandedId, setWaExpandedId] = useState<string | null>(null)

  // Search & date filter
  const [search, setSearch] = useState({ invoiceNo: '', phone: '', customerName: '', dateFrom: '', dateTo: '' })
  const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'custom' | ''>('')
  const [searchResults, setSearchResults] = useState<DashboardOrder[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Analytics global date filter
  const [analyticsDatePreset, setAnalyticsDatePreset] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all')
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState('')
  const [analyticsDateTo, setAnalyticsDateTo] = useState('')

  // Order Management bill type filter
  const [billTypeFilter, setBillTypeFilter] = useState<'all' | 'offline' | 'online' | 'manual'>('all')

  // Users tab
  const [allUsers, setAllUsers] = useState<ProfileUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null)

  const isAdmin = user?.role === 'admin'

  const toErr = (err: unknown, fb: string) =>
    err instanceof Error ? err.message
    : (err && typeof err === 'object' && 'message' in err) ? String((err as {message?:unknown}).message) || fb : fb

  const toDashboardOrder = (row: Record<string, unknown>): DashboardOrder => ({
    id: String(row.id || ''), invoice_no: String(row.invoice_no || ''),
    customer_name: String(row.customer_name || ''), phone: String(row.phone || ''),
    address: String(row.address || ''),
    created_at: String(row.created_at || ''), total: toNumber(row.total, 0),
    status: String(row.status || 'pending'),
    order_mode: normalizeOrderMode(row.order_mode),
    order_type: normalizeOrderType(row.order_type),
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    items: row.items,
    coupon_code: String(row.coupon_code || ''),
    discount_amount: toNumber(row.discount_amount, 0),
    delivery_charge: toNumber(row.delivery_charge, 0),
  })

  // Analytics (date-aware)
  const analytics = useMemo(() => {
    // Apply global date filter
    let dated = orders
    if (analyticsDateFrom) dated = dated.filter(o => o.created_at >= `${analyticsDateFrom}T00:00:00`)
    if (analyticsDateTo)   dated = dated.filter(o => o.created_at <= `${analyticsDateTo}T23:59:59`)

    // Classify
    const nonCancelled = dated.filter(o => normalizeStatus(o.status) !== 'cancelled')
    const completedOrders = nonCancelled.filter(o => isCompletedStatus(o.status))
    const pendingOrders   = nonCancelled.filter(o => normalizeStatus(o.status) === 'pending')

    // WhatsApp = online_request type (all statuses, no revenue)
    const waOrders = dated.filter(o => normalizeOrderType(o.order_type) === 'online_request')

    // Billable = completed and NOT online_request
    const billableCompleted = completedOrders.filter(o => normalizeOrderType(o.order_type) !== 'online_request')
    const offlinePOS  = billableCompleted.filter(o => normalizeOrderType(o.order_type) === 'pos_sale' && normalizeOrderMode(o.order_mode) !== 'online')
    const onlinePOS   = billableCompleted.filter(o => normalizeOrderType(o.order_type) === 'pos_sale' && normalizeOrderMode(o.order_mode) === 'online')
    const manualSales = billableCompleted.filter(o => normalizeOrderType(o.order_type) === 'manual_sale')

    // Revenue (WhatsApp never included)
    const completedRevenue   = billableCompleted.reduce((s, o) => s + toNumber(o.total, 0), 0)
    const posRevenue         = offlinePOS.reduce((s, o) => s + toNumber(o.total, 0), 0)
    const onlinePosRevenue   = onlinePOS.reduce((s, o) => s + toNumber(o.total, 0), 0)
    const manualRevenue      = manualSales.reduce((s, o) => s + toNumber(o.total, 0), 0)

    const todayKey  = new Date().toISOString().slice(0, 10)
    const monthKey  = todayKey.slice(0, 7)
    const todaySales   = billableCompleted.filter(o => o.created_at.startsWith(todayKey)).reduce((s, o) => s + toNumber(o.total, 0), 0)
    const monthlyRevenue = billableCompleted.filter(o => o.created_at.startsWith(monthKey)).reduce((s, o) => s + toNumber(o.total, 0), 0)

    // Item-level analytics
    const completedIds = new Set(billableCompleted.map(o => o.id))
    const completedItems = orderItems.length > 0
      ? orderItems.filter(item => completedIds.has(item.order_id))
      : completedOrders.flatMap(order => parseOrderItems(order.items).map(row => ({
          order_id: order.id,
          product_name: String((row as Record<string,unknown>).product_name || (row as Record<string,unknown>).name || 'Product'),
          quantity: toNumber((row as Record<string,unknown>).quantity ?? (row as Record<string,unknown>).qty, 0),
          line_total: toNumber((row as Record<string,unknown>).line_total ?? (row as Record<string,unknown>).lineTotal, 0),
          is_manual: (row as Record<string,unknown>).is_manual === true || (row as Record<string,unknown>).source === 'manual',
        })))

    const productMap    = new Map<string, { name: string; variant: string; qty: number; revenue: number; billCount: number }>()
    const productOrders = new Map<string, Set<string>>()
    const categoryMap   = new Map<string, { name: string; qty: number; revenue: number }>()
    const prodCatLookup = new Map(products.map(p => [String(p.name || '').trim().toLowerCase(), p.category || 'Uncategorized']))

    let totalProductsSold = 0
    let totalManualRevenue = 0

    completedItems.forEach(({ product_name, quantity, line_total, order_id, is_manual }) => {
      const qty = toNumber(quantity, 0)
      const rev = toNumber(line_total, 0)
      totalProductsSold += qty

      const rawKey  = String(product_name || 'Product').trim() || 'Product'
      const dashIdx = rawKey.indexOf(' - ')
      const mainName   = dashIdx > 0 ? rawKey.slice(0, dashIdx) : rawKey
      const variantName = dashIdx > 0 ? rawKey.slice(dashIdx + 3) : ''

      const pc = productMap.get(rawKey) || { name: mainName, variant: variantName, qty: 0, revenue: 0, billCount: 0 }
      pc.qty += qty; pc.revenue += rev; productMap.set(rawKey, pc)

      if (!productOrders.has(rawKey)) productOrders.set(rawKey, new Set())
      productOrders.get(rawKey)!.add(order_id)

      const catName = prodCatLookup.get(mainName.toLowerCase()) || 'Uncategorized'
      const cc = categoryMap.get(catName) || { name: catName, qty: 0, revenue: 0 }
      cc.qty += qty; cc.revenue += rev; categoryMap.set(catName, cc)

      if (is_manual) totalManualRevenue += rev
    })

    for (const [key, orderSet] of productOrders) {
      const p = productMap.get(key); if (p) { p.billCount = orderSet.size; productMap.set(key, p) }
    }

    const topProducts   = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty)
    const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue)
    const bestProduct   = topProducts[0]?.name || 'No sales yet'
    const bestCategory  = topCategories[0]?.name || 'No sales yet'

    // Trend charts
    const monthlyRevenueMap = new Map<string, number>()
    billableCompleted.forEach(o => {
      const k = o.created_at.slice(0, 7)
      monthlyRevenueMap.set(k, (monthlyRevenueMap.get(k) || 0) + toNumber(o.total, 0))
    })
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
      const k = d.toISOString().slice(0, 7)
      return { key: k, month: d.toLocaleDateString('en-IN', { month: 'short' }), revenue: monthlyRevenueMap.get(k) || 0 }
    })

    const weeklyRevenueMap = new Map<string, number>()
    billableCompleted.forEach(o => {
      const k = o.created_at.slice(0, 10)
      weeklyRevenueMap.set(k, (weeklyRevenueMap.get(k) || 0) + toNumber(o.total, 0))
    })
    const weeklySales = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      const k = d.toISOString().slice(0, 10)
      return { day: d.toLocaleDateString('en-IN', { weekday: 'short' }), date: k, revenue: weeklyRevenueMap.get(k) || 0 }
    })

    const statusDistribution = [
      { name: 'WA Requests', value: waOrders.length, color: '#3b82f6' },
      { name: 'POS Pending', value: pendingOrders.filter(o => normalizeOrderType(o.order_type) !== 'online_request').length, color: '#f59e0b' },
      { name: 'Completed',   value: billableCompleted.length, color: '#10b981' },
    ]
    const channelDistribution = [
      { name: 'Offline Bills', value: posRevenue, color: '#f97316' },
      { name: 'Online Bills',  value: onlinePosRevenue, color: '#3b82f6' },
      { name: 'Manual Sales',  value: manualRevenue || totalManualRevenue, color: '#8b5cf6' },
    ]

    const couponMap = new Map<string, { code: string; usage: number; discounts: number }>()
    billableCompleted.forEach(order => {
      const code = String((order as Record<string,unknown>).coupon_code || '').trim(); if (!code) return
      const u = couponMap.get(code) || { code, usage: 0, discounts: 0 }
      u.usage += 1; u.discounts += toNumber((order as Record<string,unknown>).discount_amount, 0)
      couponMap.set(code, u)
    })
    const topCoupons = Array.from(couponMap.values()).sort((a, b) => b.usage - a.usage)

    // WhatsApp analytics (zero revenue — status changes never affect revenue)
    const waRequests  = waOrders.length
    const waPending   = waOrders.filter(o => normalizeStatus(o.status) === 'pending').length
    const waContacted = waOrders.filter(o => normalizeStatus(o.status) === 'contacted').length
    const waCompleted = waOrders.filter(o => isCompletedStatus(o.status)).length

    const waProductMap = new Map<string, number>()
    waOrders.forEach(order => {
      parseOrderItems(order.items).forEach(item => {
        const n = String((item as Record<string,unknown>).name || (item as Record<string,unknown>).product_name || '').trim()
        if (n) waProductMap.set(n, (waProductMap.get(n) || 0) + 1)
      })
    })
    const topWAProducts = Array.from(waProductMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    return {
      totalCompletedRevenue: completedRevenue,
      todaySales,
      pendingOrders: pendingOrders.length,
      onlineRequests: waRequests,
      onlineRequestOrders: waOrders.slice(0, 15),
      completedOrders: billableCompleted.length,
      posRevenue,
      onlinePosRevenue,
      manualRevenue: manualRevenue || totalManualRevenue,
      monthlyRevenue,
      totalProductsSold,
      bestCategory,
      bestProduct,
      monthlyTrend,
      channelDistribution,
      statusDistribution,
      topCoupons,
      topCategories,
      weeklySales,
      topProducts,
      waRequests,
      waPending,
      waContacted,
      waCompleted,
      topWAProducts,
    }
  }, [orders, orderItems, products, analyticsDateFrom, analyticsDateTo])

  // Bill-type filtered results for Order Management table (client-side, instant)
  const filteredSearchResults = useMemo(() => {
    if (billTypeFilter === 'all') return searchResults
    return searchResults.filter(o => {
      const type = normalizeOrderType(o.order_type)
      const mode = normalizeOrderMode(o.order_mode)
      if (billTypeFilter === 'manual')  return type === 'manual_sale'
      if (billTypeFilter === 'offline') return type === 'pos_sale' && mode !== 'online'
      if (billTypeFilter === 'online')  return type === 'pos_sale' && mode === 'online'
      return true
    })
  }, [searchResults, billTypeFilter])

  // Load dashboard data
  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) return
    setLoading(true)
    try {
      const [cRes, oRes] = await Promise.all([
        supabase.from('categories').select('id, name_en, name_ta, is_active, sort_order').order('sort_order'),
        supabase.from('orders')
          .select('id, invoice_no, customer_name, phone, address, created_at, total, status, order_mode, order_type, user_id, items, coupon_code, discount_amount, delivery_charge')
          .order('created_at', { ascending: false })
          .limit(1000),
      ])
      const mappedOrders = (oRes.data || []).map(r => toDashboardOrder(r as Record<string, unknown>))
      setCats((cRes.data || []) as Category[])
      setOrders(mappedOrders)
      setSearchResults(mappedOrders.filter(o => normalizeOrderType(o.order_type) !== 'online_request').slice(0, 100))
      await fetchProducts(true)

      const orderIds = mappedOrders.map(o => o.id).filter(Boolean)
      if (orderIds.length > 0) {
        let oi: unknown[] | null = null
        let orderItemsError: unknown = null
        const orderItemsResult = await supabase
          .from('order_items').select('order_id,product_name,quantity,line_total,is_manual')
          .in('order_id', orderIds)
        oi = orderItemsResult.data
        orderItemsError = orderItemsResult.error

        if (orderItemsError) {
          const fallbackItemsResult = await supabase
            .from('order_items').select('order_id,product_name,quantity,line_total')
            .in('order_id', orderIds)
          oi = fallbackItemsResult.data
        }

        setOrderItems((oi || []).map(r => ({
          order_id: String((r as Record<string,unknown>).order_id || ''),
          product_name: String((r as Record<string,unknown>).product_name || 'Product'),
          quantity: toNumber((r as Record<string,unknown>).quantity, 0),
          line_total: toNumber((r as Record<string,unknown>).line_total, 0),
          is_manual: Boolean((r as Record<string,unknown>).is_manual),
        })))
      }

      try {
        const { data: couponRows } = await supabase
          .from('coupons')
          .select('id, code, percentage, is_active, expiry_date, usage_limit, usage_count, min_order_value')
          .order('created_at', { ascending: false })
        setCoupons((couponRows || []) as DashboardCoupon[])
      } catch {
        setCoupons([])
      }
    } catch (err) { console.error('Dashboard load error', err) }
    finally { setLoading(false) }
  }, [fetchProducts])

  const loadUsers = useCallback(async () => {
    if (!isSupabaseConfigured) return
    setUsersLoading(true); setUsersError('')
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, mobile, role, created_at')
      .order('created_at', { ascending: false })
    if (error) { setUsersError(error.message) }
    else { setAllUsers((data || []) as ProfileUser[]) }
    setUsersLoading(false)
  }, [])

  const loadCoupons = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase
      .from('coupons')
      .select('id, code, percentage, is_active, expiry_date, usage_limit, usage_count, min_order_value')
      .order('created_at', { ascending: false })
    setCoupons((data || []) as DashboardCoupon[])
  }, [])

  const toggleUserRole = async (u: ProfileUser) => {
    const newRole = u.role === 'admin' ? 'customer' : 'admin'
    setRoleUpdating(u.id)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
    if (!error) {
      setAllUsers(prev => prev.map(p => p.id === u.id ? { ...p, role: newRole } : p))
    }
    setRoleUpdating(null)
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    setSearchResults(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
  }

  const generateCouponCode = () => {
    const prefixes = ['SAVE', 'FEST', 'NAATU', 'HERBAL', 'SHOP', 'SPECIAL', 'FRESH']
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const suffix = Math.floor(Math.random() * 90 + 10)
    setCouponForm(f => ({ ...f, code: `${prefix}${suffix}` }))
    setCouponSaveError('')
    setCouponSaveSuccess('')
  }

  const saveCoupon = async (e: FormEvent) => {
    e.preventDefault()
    setCouponSaveError('')
    setCouponSaveSuccess('')
    if (!couponForm.code.trim()) { setCouponSaveError('Coupon code is required'); return }
    if (!(toNumber(couponForm.percentage, 0) > 0 && toNumber(couponForm.percentage, 0) <= 100)) {
      setCouponSaveError('Discount must be between 1% and 100%'); return
    }
    const code = couponForm.code.trim().toUpperCase()
    const payload = {
      code,
      percentage: toNumber(couponForm.percentage, 0),
      is_active: true,
      expiry_date: couponForm.expiry_date || null,
      usage_limit: couponForm.usage_limit ? toNumber(couponForm.usage_limit, 0) : null,
      min_order_value: toNumber(couponForm.min_order_value, 0),
    }
    let error: unknown = null
    if (editingCouponId !== null) {
      // Update existing — don't change code (it's the PK equivalent)
      const res = await supabase.from('coupons').update({ ...payload }).eq('id', editingCouponId)
      error = res.error
    } else {
      // Insert new coupon — UNIQUE constraint on code catches duplicates
      const res = await supabase.from('coupons').insert(payload)
      error = res.error
    }
    if (error) {
      const msg = (error as { message?: string }).message || 'Failed to save coupon'
      setCouponSaveError(msg.includes('unique') || msg.includes('duplicate') ? `Coupon code "${code}" already exists` : msg)
    } else {
      setCouponForm({ code: '', percentage: 10, expiry_date: '', usage_limit: '', min_order_value: '' })
      setEditingCouponId(null)
      setCouponSaveSuccess(editingCouponId !== null ? 'Coupon updated!' : 'Coupon created!')
      await loadCoupons()
    }
  }

  const startEditCoupon = (coupon: DashboardCoupon) => {
    setEditingCouponId(coupon.id)
    setCouponForm({
      code: coupon.code,
      percentage: coupon.percentage,
      expiry_date: coupon.expiry_date ? coupon.expiry_date.slice(0, 10) : '',
      usage_limit: coupon.usage_limit !== null ? String(coupon.usage_limit) : '',
      min_order_value: coupon.min_order_value ? String(coupon.min_order_value) : '',
    })
    setCouponSaveError('')
    setCouponSaveSuccess('')
  }

  const cancelEditCoupon = () => {
    setEditingCouponId(null)
    setCouponForm({ code: '', percentage: 10, expiry_date: '', usage_limit: '', min_order_value: '' })
    setCouponSaveError('')
    setCouponSaveSuccess('')
  }

  const deleteCoupon = async (coupon: DashboardCoupon) => {
    if (!window.confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return
    await supabase.from('coupons').delete().eq('id', coupon.id)
    await loadCoupons()
  }

  const toggleCoupon = async (coupon: DashboardCoupon) => {
    await supabase.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id)
    await loadCoupons()
  }

  // Keep a stable ref to the debounced loader so realtime events don't
  // trigger a full data reload more than once every 4 seconds.
  const debouncedLoadRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    debouncedLoadRef.current = debounce(() => void loadData(), 4000)
  }, [loadData])

  useEffect(() => {
    if (!isAdmin) return
    void loadData()
    if (!isSupabaseConfigured) return
    const handleChange = () => debouncedLoadRef.current?.()
    const ch = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, handleChange)
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [isAdmin, loadData])

  useEffect(() => {
    if (tab === 'users') void loadUsers()
    if (tab === 'coupons') void loadCoupons()
  }, [tab, loadUsers, loadCoupons])

  const applyAnalyticsPreset = (preset: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom') => {
    setAnalyticsDatePreset(preset)
    if (preset === 'all')    { setAnalyticsDateFrom(''); setAnalyticsDateTo(''); return }
    if (preset === 'custom') return
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    if (preset === 'today') {
      setAnalyticsDateFrom(todayStr); setAnalyticsDateTo(todayStr)
    } else if (preset === 'week') {
      const d = new Date(today); d.setDate(today.getDate() - 6)
      setAnalyticsDateFrom(d.toISOString().slice(0, 10)); setAnalyticsDateTo(todayStr)
    } else if (preset === 'month') {
      setAnalyticsDateFrom(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`)
      setAnalyticsDateTo(todayStr)
    } else if (preset === 'year') {
      setAnalyticsDateFrom(`${today.getFullYear()}-01-01`); setAnalyticsDateTo(todayStr)
    }
  }

  const applyDatePreset = (preset: 'today' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset)
    if (preset === 'custom') { setSearch(s => ({ ...s, dateFrom: '', dateTo: '' })); return }
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    if (preset === 'today') {
      setSearch(s => ({ ...s, dateFrom: todayStr, dateTo: todayStr }))
    } else if (preset === 'week') {
      const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6)
      setSearch(s => ({ ...s, dateFrom: weekAgo.toISOString().slice(0, 10), dateTo: todayStr }))
    } else if (preset === 'month') {
      setSearch(s => ({ ...s, dateFrom: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, dateTo: todayStr }))
    }
  }

  // Order search — POS bills only (online_request excluded)
  const runSearch = async (e?: FormEvent) => {
    e?.preventDefault()
    setSearchLoading(true)
    try {
      let q = supabase.from('orders')
        .select('id, invoice_no, customer_name, phone, address, created_at, total, status, order_mode, order_type, items, coupon_code, discount_amount, delivery_charge')
        .neq('order_type', 'online_request')
        .order('created_at', { ascending: false })
        .limit(500)
      if (search.invoiceNo.trim())    q = q.ilike('invoice_no', `%${search.invoiceNo.trim()}%`)
      if (search.phone.trim())        q = q.ilike('phone', `%${search.phone.trim()}%`)
      if (search.customerName.trim()) q = q.ilike('customer_name', `%${search.customerName.trim()}%`)
      if (search.dateFrom)        q = q.gte('created_at', `${search.dateFrom}T00:00:00`)
      if (search.dateTo)          q = q.lte('created_at', `${search.dateTo}T23:59:59`)
      if (billTypeFilter === 'manual')  q = q.eq('order_type', 'manual_sale')
      else if (billTypeFilter === 'offline') q = q.eq('order_type', 'pos_sale').eq('order_mode', 'offline')
      else if (billTypeFilter === 'online')  q = q.eq('order_type', 'pos_sale').eq('order_mode', 'online')

      const { data, error } = await q
      if (error) throw error
      setSearchResults((data || []).map(r => toDashboardOrder(r as Record<string,unknown>)))
    } catch (err) { console.error(err); setSearchResults([]) }
    finally { setSearchLoading(false) }
  }

  // ΓöÇΓöÇ Product CRUD ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const handleSaveProd = async (e: FormEvent) => {
    e.preventDefault()
    setProductNotice('')
    setLoading(true)
    try {
      const unitType = normalizeUnitType(prodForm.unitType)

      // Parse predefined options from text
      let predefined_options: unknown[] = []
      if (prodForm.predefinedOptionsText.trim() && (unitType === 'weight' || unitType === 'volume')) {
        const baseUnit = unitType === 'weight' ? 'g' : 'ml'
        predefined_options = prodForm.predefinedOptionsText.split(',').map(s => s.trim()).filter(Boolean).map(raw => {
          const m = raw.match(/^([0-9.]+)\s*(g|kg|ml|l)?$/i)
          if (!m) return null
          let qty = parseFloat(m[1])
          const unit = (m[2] || baseUnit).toLowerCase()
          if (unit === 'kg') qty *= 1000
          if (unit === 'l')  qty *= 1000
          const label = unit === 'kg' ? `${parseFloat(m[1])}kg` : unit === 'l' ? `${parseFloat(m[1])}L` : `${qty}${baseUnit}`
          return { quantity: qty, unit: baseUnit, label }
        }).filter(Boolean)
      }

      const payload = {
        name: prodForm.name.trim(), name_ta: prodForm.nameTa.trim(), tamil_name: prodForm.nameTa.trim(),
        category: prodForm.category.trim(), category_id: prodForm.categoryId || null,
        remedy: prodForm.remedy, price: toNumber(prodForm.price, 0),
        offer_price: prodForm.offerPrice === '' ? null : toNumber(prodForm.offerPrice, 0),
        unit_type: unitType, unit_label: prodForm.unitLabel,
        base_quantity: toNumber(prodForm.baseQuantity, 1),
        stock_quantity: toNumber(prodForm.stockQuantity, 0),
        stock: Math.floor(toNumber(prodForm.stockQuantity, 0)),
        allow_decimal_quantity: prodForm.allowDecimalQuantity,
        predefined_options: predefined_options.length > 0 ? predefined_options : [],
        is_active: prodForm.isActive, sort_order: toNumber(prodForm.sortOrder, 0),
        description: prodForm.description, benefits: prodForm.benefits,
        image_url: prodForm.image || '/assets/images/default-herb.jpg',
        image:     prodForm.image || '/assets/images/default-herb.jpg',
      }

      const { error } = editingProd
        ? await supabase.from('products').update(payload).eq('id', editingProd.id)
        : await supabase.from('products').insert(payload)
      if (error) throw error
      setProductNotice(editingProd ? 'Product updated!' : 'Product added!')
      setEditingProd(null); setProdForm(emptyForm)
      await loadData()
    } catch (err) { setProductNotice(toErr(err, 'Error saving product')) }
    finally { setLoading(false) }
  }

  const handleEdit = (p: Product) => {
    setEditingProd(p)
    const optText = (p.predefinedOptions || []).map(o => o.label).join(', ')
    setProdForm({
      name: p.name, nameTa: p.nameTa || p.tamilName || '', category: p.category,
      categoryId: p.categoryId ?? null, remedy: p.remedy || [],
      price: p.price, offerPrice: p.offerPrice || '', unitType: p.unitType,
      unitLabel: p.unitLabel, baseQuantity: p.baseQuantity,
      stockQuantity: p.stockQuantity || p.stock, stockUnit: p.stockUnit,
      allowDecimalQuantity: p.allowDecimalQuantity, predefinedOptionsText: optText,
      isActive: p.isActive, sortOrder: p.sortOrder, stock: p.stock,
      description: p.description, descriptionTa: p.descriptionTa || '',
      benefits: p.benefits || '', benefitsTa: p.benefitsTa || '',
      image: p.image || p.imageUrl || '',
    })
    setTab('products')
  }

  const handleToggleActive = async (p: Product) => {
    const { error } = await supabase.from('products').update({ is_active: !p.isActive }).eq('id', p.id)
    if (error) { setProductNotice(error.message); return }
    setProductNotice(`Product ${p.isActive ? 'deactivated' : 'activated'}`)
    await loadData()
  }

  const handleDeleteProd = async (id: string | number) => {
    if (!window.confirm('Permanently deactivate this product?')) return
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
    if (error) { setProductNotice(error.message); return }
    setProductNotice('Product deactivated'); await loadData()
  }

  const handleUploadImage = async (file?: File) => {
    if (!file) return
    setImageUploading(true)
    try { const url = await uploadProductImage(file); setProdForm(p => ({ ...p, image: url })); setProductNotice('Image uploaded!') }
    catch (err) { setProductNotice(toErr(err, 'Upload failed')) }
    finally { setImageUploading(false) }
  }

  const onAddCat = async (e: FormEvent) => {
    e.preventDefault(); if (!newCat.name_en) return
    const { error } = await supabase.from('categories').insert({ ...newCat, is_active: true })
    if (!error) { setNewCat({ name_en: '', name_ta: '' }); await loadData() }
  }

  const deleteCat = async (c: Category) => {
    if (!window.confirm(`Delete "${c.name_en}"?`)) return
    await supabase.from('categories').delete().eq('id', c.id); await loadData()
  }

  const toggleCat = async (c: Category) => {
    await supabase.from('categories').update({ is_active: !c.is_active }).eq('id', c.id); await loadData()
  }

  const moveCat = async (c: Category, dir: 'up' | 'down') => {
    const next = dir === 'up' ? Math.max(0, toNumber(c.sort_order, 0) - 1) : toNumber(c.sort_order, 0) + 1
    await supabase.from('categories').update({ sort_order: next }).eq('id', c.id); await loadData()
  }

  if (!isAdmin) return (
    <div className="min-h-screen bg-bgMain flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm">
        <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
        <h2 className="text-2xl font-black mb-2">Unauthorized</h2>
        <Link to="/" className="px-6 py-3 bg-sageDark text-white rounded-xl font-bold inline-block mt-4">Go Home</Link>
      </div>
    </div>
  )

  const navItems: Array<{ id: TabKey; icon: React.ReactNode; label: string }> = [
    { id: 'overview',    icon: <BarChart2 size={17} />,      label: 'Analytics' },
    { id: 'billing',     icon: <ShoppingCart size={17} />,   label: 'POS Terminal' },
    { id: 'products',    icon: <Box size={17} />,            label: 'Inventory' },
    { id: 'categories',  icon: <List size={17} />,           label: 'Categories' },
    { id: 'coupons',     icon: <Trophy size={17} />,         label: 'Coupons' },
    { id: 'users',       icon: <Users size={17} />,          label: 'Users' },
  ]

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-r border-[#EAD7B7]/30 p-5 lg:p-6 flex flex-col shrink-0">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7DAA8F] flex items-center justify-center">
            <LayoutDashboard size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-black text-[#2C392A]">Admin Panel</h1>
            <p className="text-[9px] text-[#5F6D59] font-bold uppercase tracking-widest">Thirupathi Balaji Store</p>
          </div>
        </div>
        <nav className="space-y-1 flex-grow">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[13px] transition-all ${
                tab === item.id ? 'bg-[#2C392A] text-white shadow-md' : 'text-[#5F6D59] hover:bg-[#F7F6F2]'
              }`}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-6 pt-4 border-t border-[#EAD7B7]/30">
          <p className="text-[11px] text-[#5F6D59]">Logged in as</p>
          <p className="text-[13px] font-bold text-[#2C392A] truncate">{user?.name || 'Admin'}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-x-hidden">

        {/* ΓöÇΓöÇ ANALYTICS TAB ΓöÇΓöÇ */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black text-[#2C392A]">Business Control Center</h2>
              <div className="flex gap-2">
                <button onClick={() => void loadData()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#EAD7B7]/40 rounded-xl text-[12px] font-bold text-[#5F6D59] hover:bg-[#F7F6F2]">
                  <RefreshCw size={13} /> Refresh
                </button>
                <button onClick={() => exportCSV(orders)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#2C392A] text-white rounded-xl text-[12px] font-bold hover:bg-[#1e2817]">
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>
            {/* ── Global Analytics Date Filter ── */}
            <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-4 shadow-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#5F6D59] mr-1">Period:</span>
                {(['all', 'today', 'week', 'month', 'year', 'custom'] as const).map(preset => (
                  <button key={preset} type="button" onClick={() => applyAnalyticsPreset(preset)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-colors ${
                      analyticsDatePreset === preset ? 'bg-[#2C392A] text-white' : 'bg-[#F7F6F2] text-[#5F6D59] hover:bg-[#EAD7B7]/40'
                    }`}>
                    {preset === 'all' ? 'All Time' : preset === 'today' ? 'Today' : preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : preset === 'year' ? 'This Year' : 'Custom'}
                  </button>
                ))}
                {analyticsDatePreset === 'custom' && (
                  <>
                    <input type="date" value={analyticsDateFrom} onChange={e => setAnalyticsDateFrom(e.target.value)}
                      className="px-3 py-1.5 bg-[#F7F6F2] rounded-xl text-[12px] font-semibold" />
                    <span className="text-[#5F6D59] text-[12px] font-bold">→</span>
                    <input type="date" value={analyticsDateTo} onChange={e => setAnalyticsDateTo(e.target.value)}
                      className="px-3 py-1.5 bg-[#F7F6F2] rounded-xl text-[12px] font-semibold" />
                  </>
                )}
                {analyticsDatePreset !== 'all' && analyticsDateFrom && (
                  <span className="text-[11px] text-emerald-700 font-black ml-1">
                    {new Date(analyticsDateFrom + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {analyticsDateTo && analyticsDateFrom !== analyticsDateTo && ` – ${new Date(analyticsDateTo + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                  </span>
                )}
              </div>
            </div>

            {/* ── WhatsApp Analytics (₹0 revenue impact always) ── */}
            <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Package size={18} className="text-blue-600" />
                <h3 className="text-base font-black text-[#2C392A]">WhatsApp Analytics</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-600">Revenue Impact: ₹0 Always</span>
              </div>
              <p className="text-[11px] text-[#7A846F] mb-4">
                Status changes (Pending → Contacted → Completed) never affect revenue, KPI cards, or financial analytics.
              </p>

              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total Requests', val: analytics.waRequests, bg: 'bg-blue-50',   color: 'text-blue-600' },
                  { label: 'Pending',        val: analytics.waPending,  bg: 'bg-amber-50',  color: 'text-amber-600' },
                  { label: 'Contacted',      val: analytics.waContacted,bg: 'bg-orange-50', color: 'text-orange-600' },
                  { label: 'Completed',      val: analytics.waCompleted,bg: 'bg-green-50',  color: 'text-green-600' },
                ].map(({ label, val, bg, color }) => (
                  <div key={label} className={`${bg} rounded-xl p-3`}>
                    <p className={`text-[10px] uppercase font-black ${color} tracking-wider mb-1`}>{label}</p>
                    <p className="text-[22px] font-black text-[#2C392A]">{val}</p>
                  </div>
                ))}
              </div>

              {/* Request detail table */}
              {analytics.onlineRequestOrders.length > 0 ? (
                <div>
                  <p className="text-[11px] font-black uppercase text-[#5F6D59] mb-2">Customer Requests</p>
                  <div className="overflow-x-auto rounded-xl border border-blue-100">
                    <table className="w-full text-[12px] min-w-[640px]">
                      <thead className="bg-blue-50">
                        <tr className="text-left text-[#5F6D59] font-bold">
                          <th className="px-3 py-2.5">Customer</th>
                          <th className="px-3 py-2.5">Phone</th>
                          <th className="px-3 py-2.5">Date & Time</th>
                          <th className="px-3 py-2.5">Items</th>
                          <th className="px-3 py-2.5">Est. Total</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-50">
                        {analytics.onlineRequestOrders.map(order => {
                          const its = parseOrderItems(order.items)
                          const isExpanded = waExpandedId === order.id
                          return (
                            <>
                              <tr key={order.id} className="hover:bg-[#F7F6F2] align-top">
                                <td className="px-3 py-2.5 font-bold text-[#2C392A]">{order.customer_name || '—'}</td>
                                <td className="px-3 py-2.5 text-[#5F6D59]">{order.phone || '—'}</td>
                                <td className="px-3 py-2.5 text-[#7A846F] whitespace-nowrap">
                                  {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                  {' '}
                                  <span className="text-[10px]">{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                </td>
                                <td className="px-3 py-2.5 text-[#5F6D59]">{its.length} item{its.length !== 1 ? 's' : ''}</td>
                                <td className="px-3 py-2.5 font-bold text-[#2C392A]">{formatCurrency(toNumber(order.total, 0))}</td>
                                <td className="px-3 py-2.5">
                                  <select value={normalizeStatus(order.status)}
                                    onChange={e => void updateOrderStatus(order.id, e.target.value)}
                                    className={`text-[11px] font-black px-2 py-1 rounded-lg border cursor-pointer outline-none ${
                                      isCompletedStatus(order.status) ? 'bg-green-100 text-green-700 border-green-200'
                                      : normalizeStatus(order.status) === 'contacted' ? 'bg-orange-100 text-orange-700 border-orange-200'
                                      : 'bg-amber-100 text-amber-700 border-amber-200'
                                    }`}>
                                    <option value="pending">Pending</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="completed">Completed</option>
                                  </select>
                                </td>
                                <td className="px-3 py-2.5">
                                  <button type="button"
                                    onClick={() => setWaExpandedId(isExpanded ? null : order.id)}
                                    className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-[11px] font-black hover:bg-blue-200 transition-colors whitespace-nowrap">
                                    {isExpanded ? 'Hide' : 'View Details'}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${order.id}-detail`}>
                                  <td colSpan={7} className="px-3 pb-3">
                                    <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                                      {/* Customer info */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
                                        <div><span className="font-black text-[#5F6D59]">Name: </span><span className="text-[#2C392A]">{order.customer_name || '—'}</span></div>
                                        <div><span className="font-black text-[#5F6D59]">Phone: </span><span className="text-[#2C392A]">{order.phone || '—'}</span></div>
                                        <div className="sm:col-span-2"><span className="font-black text-[#5F6D59]">Address: </span><span className="text-[#2C392A]">{order.address || '—'}</span></div>
                                        <div className="sm:col-span-2"><span className="font-black text-[#5F6D59]">Date/Time: </span><span className="text-[#2C392A]">{new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                                      </div>
                                      {/* Product table */}
                                      {its.length > 0 && (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-[12px] min-w-[480px] bg-white rounded-xl overflow-hidden">
                                            <thead className="bg-[#F7F6F2]">
                                              <tr className="text-left text-[#5F6D59] font-bold">
                                                <th className="px-3 py-2">Product</th>
                                                <th className="px-3 py-2">Variant</th>
                                                <th className="px-3 py-2">Size / Unit</th>
                                                <th className="px-3 py-2">Qty</th>
                                                <th className="px-3 py-2">Unit Price</th>
                                                <th className="px-3 py-2 text-right">Line Total</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#EAD7B7]/20">
                                              {its.map((raw, idx) => {
                                                const item = raw as Record<string, unknown>
                                                const fullName   = String(item.name || item.product_name || 'Product')
                                                const dashIdx    = fullName.indexOf(' - ')
                                                const prodName   = dashIdx > 0 ? fullName.slice(0, dashIdx) : fullName
                                                const variant    = dashIdx > 0 ? fullName.slice(dashIdx + 3) : '—'
                                                const qty        = toNumber(item.quantity ?? item.qty, 0)
                                                const baseQty    = toNumber(item.base_quantity ?? item.baseQuantity, 1)
                                                const basePrice  = toNumber(item.base_price ?? item.basePrice ?? item.price, 0)
                                                const lineTotal  = toNumber(item.line_total ?? item.lineTotal, 0)
                                                const unit       = String(item.unit || 'pc')
                                                const unitType   = String(item.unit_type || item.unitType || 'unit')
                                                const sizeLabel  = unitType === 'weight'
                                                  ? qty >= 1000 ? `${qty / 1000}kg` : `${qty}g`
                                                  : unitType === 'volume'
                                                    ? qty >= 1000 ? `${qty / 1000}L` : `${qty}ml`
                                                    : `${qty} ${unit}`
                                                const priceLabel = unitType === 'weight' || unitType === 'volume'
                                                  ? `${formatCurrency(basePrice)}/${baseQty}${unit}`
                                                  : formatCurrency(basePrice)
                                                return (
                                                  <tr key={idx} className="hover:bg-blue-50/30">
                                                    <td className="px-3 py-2 font-bold text-[#2C392A]">{prodName}</td>
                                                    <td className="px-3 py-2 text-[#5F6D59]">{variant}</td>
                                                    <td className="px-3 py-2 text-[#5F6D59]">{sizeLabel}</td>
                                                    <td className="px-3 py-2 font-bold">{qty}</td>
                                                    <td className="px-3 py-2 text-[#5F6D59]">{priceLabel}</td>
                                                    <td className="px-3 py-2 font-black text-[#2C392A] text-right">{formatCurrency(lineTotal)}</td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                      {/* Grand total */}
                                      <div className="flex justify-end items-center gap-3 pt-1 border-t border-blue-200">
                                        <span className="text-[12px] font-black text-[#5F6D59] uppercase tracking-wider">Estimated Grand Total</span>
                                        <span className="text-[18px] font-black text-[#2C392A]">{formatCurrency(toNumber(order.total, 0))}</span>
                                        <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">₹0 Revenue</span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#5F6D59] text-center py-4">No WhatsApp requests in selected period</p>
              )}

              {/* Top requested products */}
              {analytics.topWAProducts.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-black uppercase text-[#5F6D59] mb-2">Top Requested Products</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {analytics.topWAProducts.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-2 p-2.5 bg-[#F7F6F2] rounded-xl">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-[#2C392A] truncate">{item.name}</p>
                          <p className="text-[10px] text-blue-600 font-black">{item.count}×</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── POS Revenue Dashboard ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <IndianRupee size={18} className="text-emerald-600" />
                <h3 className="text-base font-black text-[#2C392A]">POS Revenue Dashboard</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
                {[
                  {
                    label: 'Total Revenue',
                    helper: 'POS + manual combined',
                    value: formatCurrency(analytics.totalCompletedRevenue),
                    icon: <IndianRupee size={18} />,
                    color: 'text-emerald-700',
                    bg: 'bg-emerald-50',
                  },
                  {
                    label: "Today's Sales",
                    helper: 'Completed today',
                    value: formatCurrency(analytics.todaySales),
                    icon: <TrendingUp size={18} />,
                    color: 'text-blue-700',
                    bg: 'bg-blue-50',
                  },
                  {
                    label: 'Completed Bills',
                    helper: 'POS + manual bills',
                    value: analytics.completedOrders,
                    icon: <Trophy size={18} />,
                    color: 'text-green-700',
                    bg: 'bg-green-50',
                  },
                  {
                    label: 'Offline Bills',
                    helper: 'Walk-in POS sales',
                    value: formatCurrency(analytics.posRevenue),
                    icon: <IndianRupee size={18} />,
                    color: 'text-cyan-700',
                    bg: 'bg-cyan-50',
                  },
                  {
                    label: 'Online Bills',
                    helper: 'Online POS sales',
                    value: formatCurrency(analytics.onlinePosRevenue),
                    icon: <IndianRupee size={18} />,
                    color: 'text-blue-700',
                    bg: 'bg-blue-50',
                  },
                  {
                    label: 'Manual Bills',
                    helper: 'Manual item revenue',
                    value: formatCurrency(analytics.manualRevenue),
                    icon: <ShoppingCart size={18} />,
                    color: 'text-orange-700',
                    bg: 'bg-orange-50',
                  },
                  {
                    label: 'Monthly Revenue',
                    helper: 'Current month',
                    value: formatCurrency(analytics.monthlyRevenue),
                    icon: <BarChart2 size={18} />,
                    color: 'text-violet-700',
                    bg: 'bg-violet-50',
                  },
                  {
                    label: 'Total Items Sold',
                    helper: 'From completed bills',
                    value: Math.round(analytics.totalProductsSold),
                    icon: <Box size={18} />,
                    color: 'text-indigo-700',
                    bg: 'bg-indigo-50',
                  },
                  {
                    label: 'Top Category',
                    helper: 'Most sold category',
                    value: analytics.bestCategory,
                    icon: <List size={18} />,
                    color: 'text-sky-700',
                    bg: 'bg-sky-50',
                  },
                  {
                    label: 'Top Product',
                    helper: 'Most sold item',
                    value: analytics.bestProduct,
                    icon: <Trophy size={18} />,
                    color: 'text-pink-700',
                    bg: 'bg-pink-50',
                  },
                ].map((card, index) => (
                  <div key={index} className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-[10px] uppercase font-black text-[#5F6D59] tracking-wider">{card.label}</p>
                      <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center ${card.color}`}>{card.icon}</div>
                    </div>
                    <p className="text-[11px] text-[#7A846F] font-semibold mb-2">{card.helper}</p>
                    <p className="text-[22px] leading-tight font-black text-[#2C392A] break-words">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
                <h3 className="text-base font-black text-[#2C392A] mb-4">Monthly Revenue Trend</h3>
                <div className="h-56 sm:h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" />
                      <XAxis dataKey="month" tick={{ fill: '#6B7661', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6B7661', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip formatter={(value) => formatCurrency(toNumber(value as number | string, 0))} />
                      <Line type="monotone" dataKey="revenue" stroke="#2C8A59" strokeWidth={2.2} dot={{ r: 2.5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
                <h3 className="text-base font-black text-[#2C392A] mb-4">POS vs Manual Sales</h3>
                <div className="h-56 sm:h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.channelDistribution} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={3}>
                        {analytics.channelDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(toNumber(value as number | string, 0))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px] font-bold">
                  {analytics.channelDistribution.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-[#2C392A]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span>{entry.name}: {formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
                <h3 className="text-base font-black text-[#2C392A] mb-4">Order Status Distribution</h3>
                <div className="h-56 sm:h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.statusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" />
                      <XAxis dataKey="name" tick={{ fill: '#6B7661', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#6B7661', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip formatter={(value) => toNumber(value as number | string, 0)} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={22}>
                        {analytics.statusDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
                <h3 className="text-base font-black text-[#2C392A] mb-4">Category Analytics</h3>
                {analytics.topCategories.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-[#EAD7B7]/30">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                        <tr>
                          <th className="px-4 py-2.5 font-black">#</th>
                          <th className="px-4 py-2.5 font-black">Category</th>
                          <th className="px-4 py-2.5 font-black">Revenue</th>
                          <th className="px-4 py-2.5 font-black">Qty Sold</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAD7B7]/20">
                        {analytics.topCategories.map((c, i) => (
                          <tr key={c.name} className="hover:bg-[#F7F6F2]/50">
                            <td className="px-4 py-2 text-[11px] text-[#9BAB9A] font-bold">{i + 1}</td>
                            <td className="px-4 py-2 font-bold text-[#2C392A]">{c.name}</td>
                            <td className="px-4 py-2 font-bold text-emerald-700">{formatCurrency(c.revenue)}</td>
                            <td className="px-4 py-2 text-[#5F6D59]">{Math.round(c.qty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-[13px] text-[#5F6D59] py-6">No data in selected period</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm xl:col-span-2">
                <h3 className="text-base font-black text-[#2C392A] mb-4">Weekly Sales Bars</h3>
                <div className="h-56 sm:h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.weeklySales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" />
                      <XAxis dataKey="day" tick={{ fill: '#6B7661', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6B7661', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip formatter={(value) => formatCurrency(toNumber(value as number | string, 0))} labelFormatter={(_value, payload) => String(payload?.[0]?.payload?.date || '')} />
                      <Bar dataKey="revenue" fill="#2C8A59" radius={[8, 8, 0, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Product Analytics table */}
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm xl:col-span-2">
                <h3 className="text-base font-black text-[#2C392A] mb-4">Product Analytics</h3>
                {analytics.topProducts.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-[#EAD7B7]/30">
                    <table className="w-full min-w-[580px] text-left text-[13px]">
                      <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                        <tr>
                          <th className="px-4 py-2.5 font-black">#</th>
                          <th className="px-4 py-2.5 font-black">Product</th>
                          <th className="px-4 py-2.5 font-black">Variant</th>
                          <th className="px-4 py-2.5 font-black">Qty Sold</th>
                          <th className="px-4 py-2.5 font-black">Revenue</th>
                          <th className="px-4 py-2.5 font-black">Bills</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAD7B7]/20">
                        {analytics.topProducts.slice(0, 20).map((p, i) => (
                          <tr key={`${p.name}-${p.variant || i}`} className="hover:bg-[#F7F6F2]/50">
                            <td className="px-4 py-2 text-[11px] text-[#9BAB9A] font-bold">{i + 1}</td>
                            <td className="px-4 py-2 font-bold text-[#2C392A]">{p.name}</td>
                            <td className="px-4 py-2 text-[#5F6D59]">{p.variant || '—'}</td>
                            <td className="px-4 py-2 font-bold">{Math.round(p.qty)}</td>
                            <td className="px-4 py-2 font-bold text-emerald-700">{formatCurrency(p.revenue)}</td>
                            <td className="px-4 py-2 text-[#5F6D59]">{p.billCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-[13px] text-[#5F6D59] py-6">No product sales in selected period</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm xl:col-span-2">
                <h3 className="text-base font-black text-[#2C392A] mb-4">Coupon Analytics</h3>
                <div className="space-y-3">
                  {analytics.topCoupons.length > 0 ? analytics.topCoupons.map((coupon) => (
                    <div key={coupon.code} className="flex items-center justify-between gap-3 p-3 bg-[#F7F6F2] rounded-xl">
                      <div>
                        <p className="font-black text-[#2C392A]">{coupon.code}</p>
                        <p className="text-[11px] text-[#5F6D59]">Used {coupon.usage} time(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[#2C392A]">{formatCurrency(coupon.discounts)}</p>
                        <p className="text-[11px] text-[#5F6D59]">Discounts given</p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center text-[13px] text-[#5F6D59] py-8">No coupon usage yet</div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-black text-[#2C392A] mb-3">Order Management <span className="text-[11px] text-[#7A846F] font-semibold">(POS Bills only)</span></h3>
              {/* Bill type filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                {([
                  { v: 'all',     l: 'All Bills' },
                  { v: 'offline', l: 'Offline' },
                  { v: 'online',  l: 'Online' },
                  { v: 'manual',  l: 'Manual' },
                ] as const).map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setBillTypeFilter(v)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-colors ${
                      billTypeFilter === v ? 'bg-[#2C392A] text-white' : 'bg-[#F7F6F2] text-[#5F6D59] hover:bg-[#EAD7B7]/40'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              <form onSubmit={runSearch} className="space-y-3 mb-4">
                {/* Date presets */}
                <div className="flex flex-wrap gap-2 items-center">
                  {(['today', 'week', 'month', 'custom'] as const).map(preset => (
                    <button key={preset} type="button" onClick={() => applyDatePreset(preset)}
                      className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-colors ${
                        datePreset === preset ? 'bg-[#2C392A] text-white' : 'bg-[#F7F6F2] text-[#5F6D59] hover:bg-[#EAD7B7]/40'
                      }`}>
                      {preset === 'today' ? 'Today' : preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : 'Custom Range'}
                    </button>
                  ))}
                  {(search.dateFrom || search.dateTo || datePreset) && (
                    <button type="button"
                      onClick={() => { setDatePreset(''); setSearch(s => ({ ...s, dateFrom: '', dateTo: '' })) }}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-black text-red-500 hover:bg-red-50">
                      Clear Dates
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold"
                    placeholder="Invoice / Bill No"
                    value={search.invoiceNo}
                    onChange={e => setSearch(s => ({ ...s, invoiceNo: e.target.value }))} />
                  <input className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold"
                    placeholder="Customer Name"
                    value={search.customerName}
                    onChange={e => setSearch(s => ({ ...s, customerName: e.target.value }))} />
                  <input className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold"
                    placeholder="Mobile Number"
                    value={search.phone}
                    onChange={e => setSearch(s => ({ ...s, phone: e.target.value }))} />
                  {datePreset === 'custom' ? (
                    <>
                      <input type="date" className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold"
                        value={search.dateFrom} onChange={e => setSearch(s => ({ ...s, dateFrom: e.target.value }))} />
                      <input type="date" className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold"
                        value={search.dateTo} onChange={e => setSearch(s => ({ ...s, dateTo: e.target.value }))} />
                    </>
                  ) : (
                    <button type="submit" disabled={searchLoading}
                      className="sm:col-span-2 flex items-center justify-center gap-2 py-2.5 bg-[#7DAA8F] text-white rounded-xl font-bold text-[13px] hover:bg-[#5e8c72] disabled:opacity-60">
                      <Search size={14} /> {searchLoading ? 'Searching...' : 'Search Bills'}
                    </button>
                  )}
                  {datePreset === 'custom' && (
                    <button type="submit" disabled={searchLoading}
                      className="sm:col-span-2 lg:col-span-4 flex items-center justify-center gap-2 py-2.5 bg-[#7DAA8F] text-white rounded-xl font-bold text-[13px] hover:bg-[#5e8c72] disabled:opacity-60">
                      <Search size={14} /> {searchLoading ? 'Searching...' : 'Search Bills'}
                    </button>
                  )}
                </div>
              </form>

              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-[#5F6D59]">{filteredSearchResults.length} result(s)</p>
                {filteredSearchResults.length > 0 && (
                  <button onClick={() => exportCSV(filteredSearchResults)}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#7DAA8F] hover:underline">
                    <Download size={11} /> Export results
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#EAD7B7]/30">
                <table className="w-full min-w-[960px] text-left text-[13px]">
                  <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                    <tr>
                      {['Invoice No','Customer','Phone','Bill Type','Products','Discount','Coupon','Delivery','Grand Total','Date','Status'].map(h => (
                        <th key={h} className="px-3 py-3 font-black">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAD7B7]/20">
                    {filteredSearchResults.slice(0, 50).map(o => {
                      const orderItemsList = parseOrderItems(o.items)
                      const itemSummary = orderItemsList.length === 0 ? '—'
                        : orderItemsList.length === 1
                          ? String((orderItemsList[0] as Record<string,unknown>).product_name || (orderItemsList[0] as Record<string,unknown>).name || 'Item')
                          : `${String((orderItemsList[0] as Record<string,unknown>).product_name || (orderItemsList[0] as Record<string,unknown>).name || 'Item')} +${orderItemsList.length - 1}`
                      const billTypeLabel = normalizeOrderType(o.order_type) === 'manual_sale' ? 'MANUAL'
                        : normalizeOrderMode(o.order_mode) === 'online' ? 'ONLINE' : 'OFFLINE'
                      const billTypeClass = normalizeOrderType(o.order_type) === 'manual_sale'
                        ? 'bg-purple-100 text-purple-700'
                        : normalizeOrderMode(o.order_mode) === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      return (
                        <tr key={o.id} className="hover:bg-[#F7F6F2]/50">
                          <td className="px-3 py-3 font-bold text-[#7DAA8F] text-[12px] whitespace-nowrap">{o.invoice_no || '—'}</td>
                          <td className="px-3 py-3 font-semibold text-[12px] max-w-[110px] truncate">{o.customer_name}</td>
                          <td className="px-3 py-3 text-[12px] whitespace-nowrap">{o.phone}</td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${billTypeClass}`}>{billTypeLabel}</span>
                          </td>
                          <td className="px-3 py-3 text-[12px] text-[#5F6D59] max-w-[120px] truncate" title={itemSummary}>{itemSummary}</td>
                          <td className="px-3 py-3 text-[12px]">
                            {o.discount_amount > 0 ? <span className="text-green-700 font-bold">-{formatCurrency(o.discount_amount)}</span> : <span className="text-[#9BAB9A]">—</span>}
                          </td>
                          <td className="px-3 py-3 text-[12px]">
                            {o.coupon_code ? <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold text-[10px]">{o.coupon_code}</span> : <span className="text-[#9BAB9A]">—</span>}
                          </td>
                          <td className="px-3 py-3 text-[12px]">
                            {o.delivery_charge > 0 ? <span className="font-bold">{formatCurrency(o.delivery_charge)}</span> : <span className="text-[#9BAB9A]">—</span>}
                          </td>
                          <td className="px-3 py-3 font-bold text-[13px] whitespace-nowrap">{formatCurrency(toNumber(o.total, 0))}</td>
                          <td className="px-3 py-3 text-[12px] whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                          <td className="px-3 py-3">
                            <select
                              value={normalizeStatus(o.status)}
                              onChange={e => void updateOrderStatus(o.id, e.target.value)}
                              className={`text-[11px] font-black px-2 py-1 rounded-lg border cursor-pointer outline-none ${
                                normalizeStatus(o.status) === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-100 text-amber-700 border-amber-200'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredSearchResults.length === 0 && (
                      <tr><td colSpan={11} className="px-4 py-8 text-center text-[#5F6D59]">No matching bills</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ΓöÇΓöÇ POS TAB ΓöÇΓöÇ */}
        {tab === 'billing' && (
          <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-6 shadow-sm">
            <h3 className="text-xl font-black text-[#2C392A] mb-2">POS Terminal</h3>
            <p className="text-sm text-[#5F6D59] mb-5">Open the live billing screen for walk-in customers.</p>
            <Link to="/pos" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#7DAA8F] text-white font-bold hover:bg-[#5e8c72]">
              <ShoppingCart size={16} /> Open POS
            </Link>
          </div>
        )}

        {/* ΓöÇΓöÇ INVENTORY TAB ΓöÇΓöÇ */}
        {tab === 'products' && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Product Form */}
            <div className="xl:col-span-2">
              <form onSubmit={handleSaveProd} className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm space-y-4">
                <h3 className="text-base font-black text-[#2C392A]">{editingProd ? 'Edit Product' : 'Add Product'}</h3>

                {productNotice && (
                  <div className={`p-3 rounded-xl text-[12px] font-bold text-center ${productNotice.includes('!') && !productNotice.toLowerCase().includes('error') && !productNotice.toLowerCase().includes('fail') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {productNotice}
                  </div>
                )}

                {/* Product Type */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-2">Product Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {UNIT_TYPE_OPTIONS.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => {
                          const defaults = DEFAULT_OPTIONS_FOR_TYPE[opt.value]
                          const unitLabel = opt.value === 'weight' ? 'g' : opt.value === 'volume' ? 'ml' : opt.value === 'bundle' ? 'bundle' : 'piece'
                          const baseQty = opt.value === 'weight' ? 100 : opt.value === 'volume' ? 250 : 1
                          setProdForm(f => ({ ...f, unitType: opt.value, unitLabel, baseQuantity: baseQty, predefinedOptionsText: defaults, allowDecimalQuantity: opt.value === 'weight' || opt.value === 'volume' }))
                        }}
                        className={`p-2.5 rounded-xl text-left border-2 transition-colors ${prodForm.unitType === opt.value ? 'border-[#2C392A] bg-[#2C392A]/5' : 'border-[#EAD7B7]/60 hover:border-[#7DAA8F]'}`}>
                        <p className="text-[12px] font-black text-[#2C392A]">{opt.label}</p>
                        <p className="text-[10px] text-[#5F6D59] leading-tight mt-0.5">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Product Name *</label>
                    <input required className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="e.g. Manjal Podi" value={prodForm.name} onChange={e => setProdForm(f => ({...f, name: e.target.value}))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Tamil Name</label>
                    <input className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="எ.கா. மஞ்சள் பொடி" value={prodForm.nameTa} onChange={e => setProdForm(f => ({...f, nameTa: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Price (₹) *</label>
                    <input required type="number" min="0" step="0.01"
                      className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      value={prodForm.price} onChange={e => setProdForm(f => ({...f, price: Number(e.target.value)}))} />
                    <p className="text-[10px] text-[#5F6D59] mt-0.5">
                      {prodForm.unitType === 'weight' ? `Per ${prodForm.baseQuantity}g` : prodForm.unitType === 'volume' ? `Per ${prodForm.baseQuantity}ml` : 'Per piece/bundle'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Offer Price</label>
                    <input type="number" min="0" step="0.01"
                      className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="Leave blank for no discount"
                      value={prodForm.offerPrice} onChange={e => setProdForm(f => ({...f, offerPrice: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Stock *</label>
                    <input required type="number" min="0"
                      className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      value={prodForm.stockQuantity} onChange={e => setProdForm(f => ({...f, stockQuantity: Number(e.target.value)}))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Category *</label>
                    <select required className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      value={prodForm.category}
                      onChange={e => {
                        const sel = cats.find(c => c.name_en === e.target.value)
                        setProdForm(f => ({ ...f, category: e.target.value, categoryId: sel?.id || null }))
                      }}>
                      <option value="">Select category…</option>
                      {cats.map(c => <option key={c.id} value={c.name_en}>{c.name_en}</option>)}
                    </select>
                  </div>
                </div>

                {/* Predefined Options (weight/volume only) */}
                {(prodForm.unitType === 'weight' || prodForm.unitType === 'volume') && (
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">
                      Size Options (comma-separated)
                    </label>
                    <input className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder={prodForm.unitType === 'weight' ? '100g, 250g, 500g, 1kg' : '250ml, 500ml, 1L'}
                      value={prodForm.predefinedOptionsText}
                      onChange={e => setProdForm(f => ({...f, predefinedOptionsText: e.target.value}))} />
                    <p className="text-[10px] text-[#5F6D59] mt-0.5">These become the selectable size buttons on the product card.</p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Description</label>
                  <textarea rows={2} className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold resize-none"
                    placeholder="Short product description…" value={prodForm.description}
                    onChange={e => setProdForm(f => ({...f, description: e.target.value}))} />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Benefits / Health Tags</label>
                  <input className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                    placeholder="Immunity, Digestion (comma-separated)"
                    value={prodForm.benefits}
                    onChange={e => setProdForm(f => ({...f, benefits: e.target.value}))} />
                </div>

                {/* Image */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59]">Product Image</label>
                  <input className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                    placeholder="https://... (image URL)"
                    value={prodForm.image} onChange={e => setProdForm(f => ({...f, image: e.target.value}))} />
                  <input type="file" accept="image/*"
                    className="w-full px-3 py-2 bg-[#F7F6F2] rounded-xl text-[12px] text-[#5F6D59]"
                    onChange={e => void handleUploadImage(e.target.files?.[0])} />
                  {imageUploading && <p className="text-[11px] text-[#7DAA8F] font-bold">Uploading image…</p>}
                  {prodForm.image && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F7F6F2] border border-[#EAD7B7]/40">
                      <img src={prodForm.image} alt="preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="isActive" checked={prodForm.isActive}
                    onChange={e => setProdForm(f => ({...f, isActive: e.target.checked}))} />
                  <label htmlFor="isActive" className="text-[13px] font-bold text-[#2C392A]">Active (visible in store)</label>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={loading}
                    className="flex-grow py-3 bg-[#7DAA8F] hover:bg-[#5e8c72] text-white font-black rounded-xl disabled:opacity-60">
                    {loading ? 'Saving…' : editingProd ? 'Update Product' : 'Add Product'}
                  </button>
                  <button type="button" onClick={() => { setEditingProd(null); setProdForm(emptyForm); setProductNotice('') }}
                    className="px-5 py-3 bg-[#F7F6F2] text-[#5F6D59] font-bold rounded-xl hover:bg-[#EAD7B7]/40">
                    Reset
                  </button>
                </div>
              </form>
            </div>

            {/* Product List */}
            <div className="xl:col-span-3">
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#EAD7B7]/30 flex items-center justify-between">
                  <h3 className="font-black text-[#2C392A]">Products ({products.length})</h3>
                  <p className="text-[11px] text-[#5F6D59]">{products.filter(p => p.isActive).length} active</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                      <tr>
                        <th className="px-5 py-3 font-black">Product</th>
                        <th className="px-3 py-3 font-black">Type</th>
                        <th className="px-3 py-3 font-black">Stock</th>
                        <th className="px-3 py-3 font-black">Price</th>
                        <th className="px-3 py-3 font-black text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-[13px] divide-y divide-[#EAD7B7]/20">
                      {products.map(p => (
                        <tr key={p.id} className={`hover:bg-[#F7F6F2]/40 ${!p.isActive ? 'opacity-50' : ''}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#F7F6F2] border border-[#EAD7B7]/40 shrink-0">
                                <img src={p.image || p.imageUrl || ''} alt={p.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[#2C392A] truncate max-w-[160px]">{p.name}</p>
                                <p className="text-[10px] text-[#5F6D59]">{p.category}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              p.unitType === 'weight' ? 'bg-blue-100 text-blue-700' :
                              p.unitType === 'volume' ? 'bg-purple-100 text-purple-700' :
                              p.unitType === 'bundle' ? 'bg-orange-100 text-orange-700' :
                              'bg-[#F7F6F2] text-[#5F6D59]'
                            }`}>{p.unitType}</span>
                          </td>
                          <td className="px-3 py-3 font-bold">
                            <span className={toNumber(p.stockQuantity ?? p.stock, 0) < 10 ? 'text-red-500' : 'text-[#2C392A]'}>
                              {toNumber(p.stockQuantity ?? p.stock, 0)}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-bold text-[#2C392A]">{formatCurrency(p.price)}</td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEdit(p)} className="p-1.5 text-[#7DAA8F] hover:bg-[#7DAA8F]/10 rounded-lg">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => void handleToggleActive(p)} className={`p-1.5 rounded-lg ${p.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                                <Power size={14} />
                              </button>
                              <button onClick={() => void handleDeleteProd(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ΓöÇΓöÇ CATEGORIES TAB ΓöÇΓöÇ */}
        {tab === 'categories' && (
          <div className="max-w-lg space-y-6">
            <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-black text-[#2C392A] mb-4">Product Categories</h3>
              <form onSubmit={onAddCat} className="flex gap-2 mb-5">
                <input className="flex-grow px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                  placeholder="Category name (English)" value={newCat.name_en}
                  onChange={e => setNewCat(c => ({...c, name_en: e.target.value}))} />
                <input className="w-32 px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                  placeholder="Tamil" value={newCat.name_ta}
                  onChange={e => setNewCat(c => ({...c, name_ta: e.target.value}))} />
                <button type="submit" className="px-4 py-2.5 bg-[#7DAA8F] text-white font-black rounded-xl text-[13px]">Add</button>
              </form>
              <div className="space-y-2">
                {cats.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-[#F7F6F2] rounded-xl">
                    <div>
                      <p className="text-[13px] font-bold text-[#2C392A]">{c.name_en}</p>
                      <p className="text-[11px] text-[#5F6D59]">{c.name_ta}</p>
                      <span className={`text-[10px] font-black uppercase ${c.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => void moveCat(c, 'up')} className="p-1.5 text-[#5F6D59] hover:bg-white rounded-lg"><ArrowUp size={12} /></button>
                      <button onClick={() => void moveCat(c, 'down')} className="p-1.5 text-[#5F6D59] hover:bg-white rounded-lg"><ArrowDown size={12} /></button>
                      <button onClick={() => void toggleCat(c)} className="p-1.5 text-amber-500 hover:bg-white rounded-lg"><Power size={12} /></button>
                      <button onClick={() => void deleteCat(c)} className="p-1.5 text-red-400 hover:bg-white rounded-lg"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── COUPONS TAB ── */}
        {tab === 'coupons' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black text-[#2C392A]">Coupon Management</h2>
              <button onClick={() => void loadCoupons()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#EAD7B7]/60 rounded-xl text-[13px] font-bold text-[#5F6D59] hover:bg-[#F7F6F2] transition-colors">
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {/* Info banner */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[12px] font-bold text-blue-700">
              Coupon discount applies to product subtotal only — not delivery charge.
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Create / Edit form */}
              <form onSubmit={saveCoupon} className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-[#2C392A]">
                    {editingCouponId !== null ? '✎ Edit Coupon' : '+ New Coupon'}
                  </h3>
                  {editingCouponId !== null && (
                    <button type="button" onClick={cancelEditCoupon}
                      className="text-[12px] font-bold text-red-500 hover:underline">
                      Cancel
                    </button>
                  )}
                </div>

                {couponSaveError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[12px] font-bold text-red-700">{couponSaveError}</div>
                )}
                {couponSaveSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[12px] font-bold text-emerald-700">{couponSaveSuccess}</div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Coupon Code *</label>
                  <div className="flex gap-2">
                    <input className="flex-1 px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold uppercase tracking-widest"
                      placeholder="WELCOME10"
                      value={couponForm.code}
                      disabled={editingCouponId !== null}
                      onChange={e => { setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() })); setCouponSaveError(''); setCouponSaveSuccess('') }} />
                    {editingCouponId === null && (
                      <button type="button" onClick={generateCouponCode}
                        className="px-3 py-2.5 bg-[#7DAA8F] text-white font-black rounded-xl text-[12px] hover:bg-[#5e8c72] whitespace-nowrap">
                        Generate
                      </button>
                    )}
                  </div>
                  {editingCouponId !== null && (
                    <p className="text-[10px] text-[#9BAB9A] mt-1">Code cannot be changed when editing</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Discount % *</label>
                    <input type="number" min="1" max="100" className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="10"
                      value={couponForm.percentage}
                      onChange={e => setCouponForm(f => ({ ...f, percentage: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Min Order (₹)</label>
                    <input type="number" min="0" className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="0 = no minimum"
                      value={couponForm.min_order_value}
                      onChange={e => setCouponForm(f => ({ ...f, min_order_value: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Expiry Date</label>
                    <input type="date" className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      value={couponForm.expiry_date}
                      onChange={e => setCouponForm(f => ({ ...f, expiry_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Usage Limit</label>
                    <input type="number" min="1" className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="Unlimited"
                      value={couponForm.usage_limit}
                      onChange={e => setCouponForm(f => ({ ...f, usage_limit: e.target.value }))} />
                  </div>
                </div>

                <button type="submit" className="w-full py-3 rounded-xl bg-[#2C392A] text-white font-black text-[13px] hover:bg-[#1e2817]">
                  {editingCouponId !== null ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </form>

              {/* Coupon list */}
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm">
                <h3 className="text-base font-black text-[#2C392A] mb-4">All Coupons ({coupons.length})</h3>
                <div className="space-y-3 max-h-[36rem] overflow-y-auto pr-1">
                  {coupons.map((coupon) => {
                    const isExpired = coupon.expiry_date ? new Date(coupon.expiry_date) < new Date() : false
                    const isExhausted = coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit
                    return (
                      <div key={coupon.id} className={`p-3 rounded-xl border ${editingCouponId === coupon.id ? 'border-[#2C392A] bg-[#2C392A]/5' : 'bg-[#F7F6F2] border-transparent'}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-black text-[#2C392A] tracking-wider">{coupon.code}</p>
                            <p className="text-[11px] text-[#5F6D59] mt-0.5">
                              <span className="font-bold text-emerald-700">{coupon.percentage}% off</span>
                              {coupon.min_order_value > 0 && ` · min ₹${coupon.min_order_value}`}
                            </p>
                            <p className="text-[10px] text-[#9BAB9A] mt-0.5">
                              Used {coupon.usage_count}{coupon.usage_limit ? `/${coupon.usage_limit}` : ''} times
                              {coupon.expiry_date && ` · expires ${new Date(coupon.expiry_date).toLocaleDateString('en-IN')}`}
                            </p>
                            {(isExpired || isExhausted) && (
                              <p className="text-[10px] font-black text-red-500 mt-0.5">
                                {isExpired ? 'Expired' : 'Limit reached'}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => void toggleCoupon(coupon)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${coupon.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {coupon.is_active ? 'Active' : 'Off'}
                            </button>
                            <button onClick={() => startEditCoupon(coupon)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-blue-50 text-blue-700 hover:bg-blue-100">
                              Edit
                            </button>
                            <button onClick={() => void deleteCoupon(coupon)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-red-50 text-red-600 hover:bg-red-100">
                              Del
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {coupons.length === 0 && (
                    <div className="text-center text-[13px] text-[#5F6D59] py-8">No coupons yet. Create your first coupon!</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ΓöÇΓöÇ USERS TAB ΓöÇΓöÇ */}
        {tab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black text-[#2C392A]">User Management</h2>
              <button onClick={() => void loadUsers()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#EAD7B7]/60 rounded-xl text-[13px] font-bold text-[#5F6D59] hover:bg-[#F7F6F2] transition-colors">
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BAB9A]" />
              <input
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#EAD7B7]/60 rounded-xl text-[13px] font-bold text-[#2C392A] placeholder-[#9BAB9A] focus:outline-none focus:ring-2 focus:ring-[#7DAA8F]/40"
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>

            {usersError && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700 font-bold">
                <AlertCircle size={15} /> {usersError}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 shadow-sm overflow-hidden">
              {usersLoading ? (
                <div className="p-8 text-center text-[13px] font-bold text-[#5F6D59]">Loading users…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-[#F7F6F2] border-b border-[#EAD7B7]/40">
                        <th className="text-left px-4 py-3 font-black text-[#2C392A]">Name</th>
                        <th className="text-left px-4 py-3 font-black text-[#2C392A]">Email</th>
                        <th className="text-left px-4 py-3 font-black text-[#2C392A]">Mobile</th>
                        <th className="text-left px-4 py-3 font-black text-[#2C392A]">Joined</th>
                        <th className="text-center px-4 py-3 font-black text-[#2C392A]">Role</th>
                        <th className="text-center px-4 py-3 font-black text-[#2C392A]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAD7B7]/30">
                      {allUsers
                        .filter(u => {
                          if (!userSearch.trim()) return true
                          const q = userSearch.toLowerCase()
                          return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
                        })
                        .map(u => (
                          <tr key={u.id} className="hover:bg-[#F7F6F2]/60 transition-colors">
                            <td className="px-4 py-3 font-bold text-[#2C392A]">{u.name || '—'}</td>
                            <td className="px-4 py-3 text-[#5F6D59]">{u.email || '—'}</td>
                            <td className="px-4 py-3 text-[#5F6D59]">{u.mobile || '—'}</td>
                            <td className="px-4 py-3 text-[#9BAB9A] text-[11px]">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                                u.role === 'admin'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-[#F7F6F2] text-[#5F6D59]'
                              }`}>
                                {u.role === 'admin' ? <ShieldCheck size={10} /> : <ShieldOff size={10} />}
                                {u.role === 'admin' ? 'Admin' : 'Customer'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {u.id === user?.id ? (
                                <span className="text-[11px] text-[#9BAB9A] font-bold">You</span>
                              ) : (
                                <button
                                  onClick={() => void toggleUserRole(u)}
                                  disabled={roleUpdating === u.id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-colors disabled:opacity-50 ${
                                    u.role === 'admin'
                                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                  }`}
                                >
                                  {u.role === 'admin' ? <><ShieldOff size={11} /> Remove Admin</> : <><ShieldCheck size={11} /> Make Admin</>}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {allUsers.length === 0 && !usersLoading && (
                    <p className="p-8 text-center text-[13px] font-bold text-[#9BAB9A]">No users found.</p>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#9BAB9A] font-bold">
              • Role changes take effect on the user's next login. Admins get Dashboard + POS Billing access.
            </p>
          </div>
        )}

      </main>
    </div>
  )
}

