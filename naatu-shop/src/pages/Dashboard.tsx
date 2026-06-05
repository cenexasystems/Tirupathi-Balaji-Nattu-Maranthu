import React, { useCallback, useEffect, useState, useMemo, useRef, type FormEvent } from 'react'
import {
  BarChart2, Trash2, Edit2, List, ShoppingCart, LayoutDashboard,
  Box, AlertCircle, ArrowUp, ArrowDown, Power, Download, TrendingUp,
  Package, IndianRupee, Search, RefreshCw, Users, ShieldCheck, ShieldOff, Trophy,
  MessageCircle, Image,
} from 'lucide-react'
import ImageMappingTool from '../components/dashboard/ImageMappingTool'
import { Link, useLocation } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { debounce } from '../lib/debounce'
import { useAuthStore, useProductStore, type Product } from '../store/store'
import { useLangStore } from '../store/langStore'
import { uploadProductImage } from '../lib/storage'
import { formatCurrency, normalizeOrderMode, normalizeUnitType, toNumber, type UnitType } from '../lib/retail'
import { createVariant, updateVariant, deleteVariant, setDefaultVariant, type ProductVariant } from '../services/variantService'
import { useVariantStore } from '../store/store'
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
type TabKey = 'overview' | 'whatsapp' | 'pos_analytics' | 'billing' | 'products' | 'categories' | 'coupons' | 'users' | 'image_mapping'
type PosAnalyticsTab = 'revenue' | 'products' | 'categories' | 'coupons'
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
  hasVariants: false,
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
  const location = useLocation()
  const [tab, setTab] = useState<TabKey>(() => {
    if (location.pathname === '/whatsapp-center') return 'whatsapp'
    if (location.pathname === '/pos-analytics') return 'pos_analytics'
    return 'whatsapp'
  })
  const [posAnalyticsTab, setPosAnalyticsTab] = useState<PosAnalyticsTab>('revenue')
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

  // Variant management state
  const { getVariants, refetchVariants } = useVariantStore()
  const [variantForm, setVariantForm] = useState({ name: '', sizeLabel: '', price: '', stock: '50', weightValue: '', weightUnit: '', isDefault: false })
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [variantNotice, setVariantNotice] = useState('')
  const [variantLoading, setVariantLoading] = useState(false)

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
  const { lang } = useLangStore()
  // l(en, ta) — inline bilingual label helper; short Tamil strings prevent layout overflow
  const l = (en: string, ta: string) => lang === 'ta' ? ta : en

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

    const waCategoryMap = new Map<string, number>()
    waOrders.forEach(order => {
      parseOrderItems(order.items).forEach(item => {
        const n = String((item as Record<string,unknown>).name || (item as Record<string,unknown>).product_name || '').trim()
        if (n) {
          const mainName = n.includes(' - ') ? n.split(' - ')[0] : n
          const catName = prodCatLookup.get(mainName.toLowerCase()) || 'Uncategorized'
          waCategoryMap.set(catName, (waCategoryMap.get(catName) || 0) + 1)
        }
      })
    })
    const topWACategories = Array.from(waCategoryMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    return {
      totalCompletedRevenue: completedRevenue,
      todaySales,
      pendingOrders: pendingOrders.length,
      onlineRequests: waRequests,
      onlineRequestOrders: waOrders,
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
      topWACategories,
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
        has_variants: !!(prodForm as Record<string, unknown>).hasVariants,
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
      hasVariants: p.hasVariants ?? false,
    } as typeof prodForm)
    setVariantNotice('')
    setEditingVariantId(null)
    setVariantForm({ name: '', sizeLabel: '', price: '', stock: '50', weightValue: '', weightUnit: '', isDefault: false })
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

  const handleSaveVariant = async (e: import('react').FormEvent) => {
    e.preventDefault()
    if (!editingProd) return
    setVariantLoading(true)
    setVariantNotice('')
    const price = Number(variantForm.price)
    const stock = Number(variantForm.stock)
    if (!variantForm.name.trim()) { setVariantNotice('Variant name required'); setVariantLoading(false); return }
    if (!(price > 0)) { setVariantNotice('Enter valid price'); setVariantLoading(false); return }
    try {
      const payload = {
        productId:   String(editingProd.id),
        variantName: variantForm.name.trim(),
        sizeLabel:   variantForm.sizeLabel.trim() || null,
        price,
        stock,
        weightValue: variantForm.weightValue ? Number(variantForm.weightValue) : null,
        weightUnit:  variantForm.weightUnit.trim() || null,
        isDefault:   variantForm.isDefault,
        sortOrder:   getVariants(String(editingProd.id)).length,
      }
      if (editingVariantId) {
        const { error } = await updateVariant(editingVariantId, payload)
        if (error) throw new Error(error)
        setVariantNotice('Variant updated!')
      } else {
        const { error } = await createVariant(payload)
        if (error) throw new Error(error)
        setVariantNotice('Variant added!')
        // Ensure product has_variants = true
        if (!editingProd.hasVariants) {
          await supabase.from('products').update({ has_variants: true }).eq('id', editingProd.id)
        }
      }
      setVariantForm({ name: '', sizeLabel: '', price: '', stock: '50', weightValue: '', weightUnit: '', isDefault: false })
      setEditingVariantId(null)
      await refetchVariants()
    } catch (err) { setVariantNotice(toErr(err, 'Error saving variant')) }
    finally { setVariantLoading(false) }
  }

  const handleDeleteVariant = async (variantId: string) => {
    if (!window.confirm('Remove this variant?')) return
    const { error } = await deleteVariant(variantId)
    if (error) { setVariantNotice(error); return }
    setVariantNotice('Variant removed')
    await refetchVariants()
  }

  const handleSetDefault = async (variantId: string) => {
    if (!editingProd) return
    const { error } = await setDefaultVariant(variantId, String(editingProd.id))
    if (!error) { setVariantNotice('Default updated'); await refetchVariants() }
  }

  const startEditVariant = (v: ProductVariant) => {
    setEditingVariantId(v.id)
    setVariantForm({
      name: v.variantName,
      sizeLabel: v.sizeLabel || '',
      price: String(v.price),
      stock: String(v.stock),
      weightValue: v.weightValue ? String(v.weightValue) : '',
      weightUnit: v.weightUnit || '',
      isDefault: v.isDefault,
    })
    setVariantNotice('')
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
        <h2 className="text-2xl font-black mb-2">{l('Unauthorized', 'அனுமதி இல்லை')}</h2>
        <Link to="/" className="px-6 py-3 bg-sageDark text-white rounded-xl font-bold inline-block mt-4">{l('Go Home', 'முகப்பிற்கு')}</Link>
      </div>
    </div>
  )

  const navItems: Array<{ id: TabKey; icon: React.ReactNode; label: string }> = [
    { id: 'overview',      icon: <LayoutDashboard size={17} />,  label: l('Control Center', 'கட்டுப்பு') },
    { id: 'whatsapp',      icon: <MessageCircle size={17} />,    label: l('WhatsApp', 'வாட்ஸ் அப்') },
    { id: 'pos_analytics', icon: <BarChart2 size={17} />,        label: l('POS Analytics', 'POS பகுப்பு') },
    { id: 'billing',       icon: <ShoppingCart size={17} />,     label: l('Orders', 'ஆர்டர்கள்') },
    { id: 'products',      icon: <Box size={17} />,              label: l('Inventory', 'சரக்கு') },
    { id: 'categories',    icon: <List size={17} />,             label: l('Categories', 'வகைகள்') },
    { id: 'coupons',       icon: <Trophy size={17} />,           label: l('Coupons', 'கூப்பன்') },
    { id: 'users',         icon: <Users size={17} />,            label: l('Users', 'பயனர்') },
    { id: 'image_mapping', icon: <Image size={17} />,            label: l('Images', 'படங்கள்') },
  ]

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col lg:flex-row">
      {/* Sidebar — vertical on desktop, icon-strip on mobile */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-[#EAD7B7]/30 flex flex-col shrink-0">
        {/* Desktop brand header */}
        <div className="hidden lg:flex items-center gap-3 px-6 pt-6 pb-2">
          <div className="w-9 h-9 rounded-xl bg-[#7DAA8F] flex items-center justify-center shrink-0">
            <LayoutDashboard size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[14px] font-black text-[#2C392A] truncate">{l('Business ERP', 'ERP அமைப்பு')}</h1>
            <p className="text-[9px] text-[#5F6D59] font-bold uppercase tracking-widest truncate">{l('Naatu Marundhu', 'நாட்டு மருந்து')}</p>
          </div>
        </div>
        {/* Mobile mini-header */}
        <div className="flex lg:hidden items-center justify-between px-4 py-2.5 border-b border-[#EAD7B7]/20">
          <span className="text-[12px] font-black text-[#2C392A]">{l('ERP', 'ERP')}</span>
          <span className="text-[11px] font-bold text-[#5F6D59] truncate max-w-[130px]">{user?.name || 'Admin'}</span>
        </div>
        {/* Nav: icon-only strip on mobile, icon+label list on desktop */}
        <nav
          className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 px-2 py-2 lg:px-4 lg:py-3 lg:flex-grow"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              title={item.label}
              className={[
                'shrink-0 flex flex-col lg:flex-row items-center justify-center lg:justify-start',
                'gap-0.5 lg:gap-3',
                'w-[52px] h-[52px] lg:w-full lg:h-auto',
                'px-0 lg:px-4 py-1 lg:py-3',
                'rounded-xl font-bold text-[10px] lg:text-[13px] transition-all',
                tab === item.id ? 'bg-[#2C392A] text-white shadow-md' : 'text-[#5F6D59] hover:bg-[#F7F6F2]',
              ].join(' ')}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="hidden lg:block truncate text-left max-w-full">{item.label}</span>
            </button>
          ))}
        </nav>
        {/* Desktop footer */}
        <div className="hidden lg:block px-5 py-4 mt-auto border-t border-[#EAD7B7]/30">
          <p className="text-[11px] text-[#5F6D59]">{l('Logged in as', 'உள்நுழைந்தவர்')}</p>
          <p className="text-[13px] font-bold text-[#2C392A] truncate">{user?.name || 'Admin'}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-x-hidden">

        {/* ΓöÇΓöÇ ANALYTICS TAB ΓöÇΓöÇ */}

        {/* ── BUSINESS CONTROL CENTER ── */}
        {/* ── BUSINESS CONTROL CENTER ── */}
        {tab === 'overview' && (() => {
          const latestPOS = searchResults.slice(0, 10)
          return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black text-[#2C392A]">{l('Business Control Center', 'கட்டுப்பு நிலையம்')}</h2>
              <button onClick={() => void loadData()}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#EAD7B7]/40 rounded-xl text-[12px] font-bold text-[#5F6D59] hover:bg-[#F7F6F2]">
                <RefreshCw size={13} /> {l('Refresh', 'புதுப்பி')}
              </button>
            </div>

            {/* Revenue KPIs — 5 cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {[
                { label: l('Total Revenue', 'மொத்த வருவாய்'),    value: formatCurrency(analytics.totalCompletedRevenue), bg: 'bg-emerald-50', color: 'text-emerald-700', icon: <IndianRupee size={16} /> },
                { label: l("Today's Sales",  'இன்றைய விற்பனை'),  value: formatCurrency(analytics.todaySales),            bg: 'bg-blue-50',    color: 'text-blue-700',    icon: <TrendingUp size={16} /> },
                { label: l('Offline Revenue', 'ஆஃப்லைன் வருவாய்'), value: formatCurrency(analytics.posRevenue),           bg: 'bg-orange-50',  color: 'text-orange-700',  icon: <IndianRupee size={16} /> },
                { label: l('Online Revenue',  'ஆன்லைன் வருவாய்'),  value: formatCurrency(analytics.onlinePosRevenue),     bg: 'bg-cyan-50',    color: 'text-cyan-700',    icon: <IndianRupee size={16} /> },
                { label: l('Manual Revenue',  'கைமுறை வருவாய்'),   value: formatCurrency(analytics.manualRevenue),        bg: 'bg-violet-50',  color: 'text-violet-700',  icon: <ShoppingCart size={16} /> },
              ].map((card, i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <p className="text-[10px] uppercase font-black text-[#5F6D59] tracking-wider leading-tight">{card.label}</p>
                    <div className={`w-7 h-7 rounded-xl ${card.bg} flex items-center justify-center ${card.color} shrink-0`}>{card.icon}</div>
                  </div>
                  <p className="text-[20px] font-black text-[#2C392A] break-words leading-tight">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Latest POS Bills */}
            <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-black text-[#2C392A]">{l('Latest POS Bills', 'POS பில்கள்')}</h3>
                <button onClick={() => setTab('billing')} className="text-[12px] font-bold text-[#7DAA8F] hover:underline">{l('View All →', 'அனைத்தும் →')}</button>
              </div>
              {latestPOS.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[#EAD7B7]/30">
                  <table className="w-full min-w-[480px] text-[12px]">
                    <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                      <tr>
                        <th className="px-3 py-2.5 font-black text-left">{l('Invoice', 'பில்')}</th>
                        <th className="px-3 py-2.5 font-black text-left">{l('Customer', 'வாடிக்கையாளர்')}</th>
                        <th className="px-3 py-2.5 font-black text-left">{l('Total', 'மொத்தம்')}</th>
                        <th className="px-3 py-2.5 font-black text-left">{l('Date', 'தேதி')}</th>
                        <th className="px-3 py-2.5 font-black text-left">{l('Type', 'வகை')}</th>
                        <th className="px-3 py-2.5 font-black text-left">{l('Status', 'நிலை')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAD7B7]/20">
                      {latestPOS.map(o => {
                        const btLabel = normalizeOrderType(o.order_type) === 'manual_sale' ? 'MANUAL' : normalizeOrderMode(o.order_mode) === 'online' ? 'ONLINE' : 'OFFLINE'
                        const btClass = normalizeOrderType(o.order_type) === 'manual_sale' ? 'bg-purple-100 text-purple-700' : normalizeOrderMode(o.order_mode) === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        return (
                          <tr key={o.id} className="hover:bg-[#F7F6F2]/50">
                            <td className="px-3 py-2.5 font-bold text-[#7DAA8F] text-[11px]">{o.invoice_no || '—'}</td>
                            <td className="px-3 py-2.5 font-semibold text-[#2C392A] max-w-[100px] truncate">{o.customer_name}</td>
                            <td className="px-3 py-2.5 font-black text-[#2C392A]">{formatCurrency(toNumber(o.total, 0))}</td>
                            <td className="px-3 py-2.5 text-[#7A846F] whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                            <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${btClass}`}>{btLabel}</span></td>
                            <td className="px-3 py-2.5">
                              <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${normalizeStatus(o.status) === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {normalizeStatus(o.status)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[13px] text-[#5F6D59] text-center py-4">{l('No bills yet', 'பில்கள் இல்லை')}</p>
              )}
            </div>
          </div>
          )
        })()}

        {/* ── WHATSAPP CENTER ── */}
        {tab === 'whatsapp' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-[#2C392A]">{l('WhatsApp Center', 'வாட்ஸ் அப் மையம்')}</h2>
                {analytics.waPending > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[12px] font-black animate-pulse">
                    {analytics.waPending} {l('pending', 'நிலுவை')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Compact period filter */}
                <div className="flex gap-1">
                  {(['all', 'today', 'week', 'month'] as const).map(preset => (
                    <button key={preset} type="button" onClick={() => applyAnalyticsPreset(preset)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-colors ${analyticsDatePreset === preset ? 'bg-[#2C392A] text-white' : 'bg-[#F7F6F2] text-[#5F6D59] hover:bg-[#EAD7B7]/40'}`}>
                      {preset === 'all' ? l('All','எல்லாம்') : preset === 'today' ? l('Today','இன்று') : preset === 'week' ? l('Week','வாரம்') : l('Month','மாதம்')}
                    </button>
                  ))}
                </div>
                <button onClick={() => void loadData()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#EAD7B7]/40 rounded-lg text-[11px] font-bold text-[#5F6D59] hover:bg-[#F7F6F2]">
                  <RefreshCw size={12} /> {l('Refresh', 'புதுப்பி')}
                </button>
              </div>
            </div>

            {/* Status summary cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: l('Total Requests', 'மொத்த கோரிக்கை'), val: analytics.waRequests,  bg: 'bg-blue-50',   color: 'text-blue-700',   border: 'border-blue-100' },
                { label: l('Pending', 'நிலுவை'),                 val: analytics.waPending,   bg: 'bg-amber-50',  color: 'text-amber-700',  border: 'border-amber-100' },
                { label: l('Contacted', 'தொடர்பு'),               val: analytics.waContacted, bg: 'bg-orange-50', color: 'text-orange-700', border: 'border-orange-100' },
                { label: l('Completed', 'முடிந்தது'),              val: analytics.waCompleted, bg: 'bg-green-50',  color: 'text-green-700',  border: 'border-green-100' },
              ].map(({ label, val, bg, color, border }) => (
                <div key={label} className={`${bg} border ${border} rounded-xl p-3 text-center`}>
                  <p className={`text-[10px] uppercase font-black ${color} tracking-wider mb-1`}>{label}</p>
                  <p className="text-[28px] font-black text-[#2C392A] leading-none">{val}</p>
                </div>
              ))}
            </div>

            {/* ═══ CUSTOMER REQUEST MANAGEMENT — PRIMARY SECTION ═══ */}
            <div className="bg-white rounded-2xl border border-blue-200 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <MessageCircle size={17} className="text-blue-600" />
                  <h3 className="text-base font-black text-[#2C392A]">{l('Customer Requests', 'வாடிக்கையாளர் கோரிக்கைகள்')}</h3>
                  <span className="text-[10px] font-bold text-[#9BAB9A] bg-[#F7F6F2] px-2 py-0.5 rounded-full">{l('₹0 revenue — status updates only', '₹0 வருவாய் — நிலை மட்டும்')}</span>
                </div>
                <span className="text-[12px] text-[#5F6D59] font-bold">{analytics.onlineRequestOrders.length} {l('requests', 'கோரிக்கைகள்')}</span>
              </div>

              {analytics.onlineRequestOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] min-w-[820px]">
                    <thead className="bg-blue-50 border-b border-blue-100 sticky top-0 z-10">
                      <tr className="text-left text-[#5F6D59] font-black text-[10px] uppercase tracking-wider">
                        <th className="px-4 py-3">{l('Customer', 'வாடிக்கையாளர்')}</th>
                        <th className="px-4 py-3">{l('Phone', 'தொலைபேசி')}</th>
                        <th className="px-4 py-3">{l('Address', 'முகவரி')}</th>
                        <th className="px-4 py-3 text-center">{l('Products', 'பொருட்கள்')}</th>
                        <th className="px-4 py-3">{l('Est. Total', 'மதிப்பீடு')}</th>
                        <th className="px-4 py-3">{l('Date & Time', 'தேதி & நேரம்')}</th>
                        <th className="px-4 py-3">{l('Status', 'நிலை')}</th>
                        <th className="px-4 py-3 text-center">{l('Details', 'விவரம்')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {analytics.onlineRequestOrders.map(order => {
                        const its = parseOrderItems(order.items)
                        const isExpanded = waExpandedId === order.id

                        // WhatsApp message text
                        const waMsg = [
                          `🌿 *${l('Order Request', 'ஆர்டர் கோரிக்கை')} — Naatu Marundhu*`,
                          `👤 ${order.customer_name || '—'}`,
                          `📞 ${order.phone || '—'}`,
                          order.address ? `📍 ${order.address}` : '',
                          '',
                          `📦 *${l('Items', 'பொருட்கள்')}:*`,
                          ...its.map(raw => {
                            const it = raw as Record<string, unknown>
                            const nm = String(it.name || it.product_name || 'Product')
                            const qty = toNumber(it.quantity ?? it.qty, 0)
                            const lt = toNumber(it.line_total ?? it.lineTotal, 0)
                            return `• ${nm} × ${qty} — ${formatCurrency(lt)}`
                          }),
                          '',
                          `💰 *${l('Estimated Total', 'மதிப்பிட்டு')}: ${formatCurrency(toNumber(order.total, 0))}*`,
                        ].filter(Boolean).join('\n')

                        return (
                          <React.Fragment key={order.id}>
                            <tr className={`hover:bg-blue-50/40 align-middle ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                              <td className="px-4 py-3 font-bold text-[#2C392A] whitespace-nowrap">{order.customer_name || '—'}</td>
                              <td className="px-4 py-3 text-[#5F6D59] whitespace-nowrap">{order.phone || '—'}</td>
                              <td className="px-4 py-3 text-[#7A846F] max-w-[140px] truncate" title={order.address || '—'}>{order.address || '—'}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black">{its.length}</span>
                              </td>
                              <td className="px-4 py-3 font-black text-[#2C392A]">{formatCurrency(toNumber(order.total, 0))}</td>
                              <td className="px-4 py-3 text-[#7A846F] whitespace-nowrap text-[11px]">
                                <div>{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                <div className="text-[10px]">{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={normalizeStatus(order.status)}
                                  onChange={e => void updateOrderStatus(order.id, e.target.value)}
                                  className={`text-[11px] font-black px-2 py-1.5 rounded-lg border cursor-pointer outline-none ${
                                    isCompletedStatus(order.status) ? 'bg-green-100 text-green-700 border-green-200'
                                    : normalizeStatus(order.status) === 'contacted' ? 'bg-orange-100 text-orange-700 border-orange-200'
                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                                  }`}>
                                  <option value="pending">{l('Pending', 'நிலுவை')}</option>
                                  <option value="contacted">{l('Contacted', 'தொடர்பு')}</option>
                                  <option value="completed">{l('Completed', 'முடிந்தது')}</option>
                                </select>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setWaExpandedId(isExpanded ? null : order.id)}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors whitespace-nowrap ${
                                    isExpanded ? 'bg-[#2C392A] text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}>
                                  {isExpanded ? l('Close', 'மூடு') : l('View', 'பார்')}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded detail row */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={8} className="px-4 pb-5 pt-2 bg-blue-50/40">
                                  <div className="space-y-4">
                                    {/* Customer info bar */}
                                    <div className="flex flex-wrap gap-4 text-[12px] bg-white rounded-xl p-3 border border-blue-100">
                                      <div><span className="font-black text-[#5F6D59]">{l('Name', 'பெயர்')}: </span><span className="font-bold text-[#2C392A]">{order.customer_name || '—'}</span></div>
                                      <div><span className="font-black text-[#5F6D59]">{l('Phone', 'தொலைபேசி')}: </span><span className="font-bold text-[#2C392A]">{order.phone || '—'}</span></div>
                                      <div className="flex-1"><span className="font-black text-[#5F6D59]">{l('Address', 'முகவரி')}: </span><span className="text-[#2C392A]">{order.address || '—'}</span></div>
                                    </div>

                                    {/* Items table */}
                                    {its.length > 0 && (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-[12px] min-w-[540px] bg-white rounded-xl overflow-hidden border border-blue-100">
                                          <thead className="bg-[#F7F6F2]">
                                            <tr className="text-left text-[#5F6D59] font-black text-[10px] uppercase tracking-wider">
                                              <th className="px-4 py-2.5">{l('Product', 'பொருள்')}</th>
                                              <th className="px-4 py-2.5">{l('Variant', 'வகைப்படி')}</th>
                                              <th className="px-4 py-2.5">{l('Size / Weight', 'அளவு / எடை')}</th>
                                              <th className="px-4 py-2.5 text-center">{l('Qty', 'அளவு')}</th>
                                              <th className="px-4 py-2.5">{l('Unit Price', 'ஒரு விலை')}</th>
                                              <th className="px-4 py-2.5 text-right">{l('Line Total', 'வரி மொத்தம்')}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[#EAD7B7]/20">
                                            {its.map((raw, idx) => {
                                              const item = raw as Record<string, unknown>
                                              const fullName  = String(item.name || item.product_name || 'Product')
                                              const dashIdx   = fullName.indexOf(' - ')
                                              const prodName  = dashIdx > 0 ? fullName.slice(0, dashIdx) : fullName
                                              const variant   = dashIdx > 0 ? fullName.slice(dashIdx + 3) : '—'
                                              const qty       = toNumber(item.quantity ?? item.qty, 0)
                                              const baseQty   = toNumber(item.base_quantity ?? item.baseQuantity, 1)
                                              const basePrice = toNumber(item.base_price ?? item.basePrice ?? item.price, 0)
                                              const lineTotal = toNumber(item.line_total ?? item.lineTotal, 0)
                                              const unit      = String(item.unit || 'pc')
                                              const unitType  = String(item.unit_type || item.unitType || 'unit')
                                              const sizeLabel = unitType === 'weight'
                                                ? qty >= 1000 ? `${qty / 1000}kg` : `${qty}g`
                                                : unitType === 'volume'
                                                  ? qty >= 1000 ? `${qty / 1000}L` : `${qty}ml`
                                                  : `${qty} ${unit}`
                                              const priceLabel = unitType === 'weight' || unitType === 'volume'
                                                ? `${formatCurrency(basePrice)}/${baseQty}${unit}`
                                                : formatCurrency(basePrice)
                                              return (
                                                <tr key={idx} className="hover:bg-blue-50/20">
                                                  <td className="px-4 py-2.5 font-bold text-[#2C392A]">{prodName}</td>
                                                  <td className="px-4 py-2.5 text-[#5F6D59]">{variant}</td>
                                                  <td className="px-4 py-2.5 text-[#5F6D59]">{sizeLabel}</td>
                                                  <td className="px-4 py-2.5 text-center font-bold">{qty}</td>
                                                  <td className="px-4 py-2.5 text-[#5F6D59]">{priceLabel}</td>
                                                  <td className="px-4 py-2.5 font-black text-[#2C392A] text-right">{formatCurrency(lineTotal)}</td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                          <tfoot className="bg-[#F7F6F2] border-t border-[#EAD7B7]/30">
                                            <tr>
                                              <td colSpan={5} className="px-4 py-2.5 text-right font-black text-[#5F6D59] text-[11px] uppercase tracking-wider">{l('Grand Total', 'மொத்த தொகை')}</td>
                                              <td className="px-4 py-2.5 text-right font-black text-[18px] text-[#2C392A]">{formatCurrency(toNumber(order.total, 0))}</td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    )}

                                    {/* WhatsApp message */}
                                    <div className="bg-white rounded-xl border border-blue-100 p-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[11px] font-black text-[#5F6D59] uppercase tracking-wider">{l('WhatsApp Message', 'வாட்ஸ் அப் செய்தி')}</span>
                                        <button
                                          type="button"
                                          onClick={() => void navigator.clipboard.writeText(waMsg)}
                                          className="px-3 py-1 rounded-lg bg-[#25D366] text-white text-[11px] font-black hover:bg-[#1da851] transition-colors">
                                          {l('Copy Message', 'நகல் எடு')}
                                        </button>
                                      </div>
                                      <pre className="text-[12px] text-[#2C392A] bg-[#F7F6F2] rounded-xl p-3 whitespace-pre-wrap font-sans leading-relaxed select-all">{waMsg}</pre>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-12 text-center">
                  <MessageCircle size={40} className="mx-auto text-blue-200 mb-3" />
                  <p className="text-[14px] font-bold text-[#5F6D59]">{l('No WhatsApp requests in selected period', 'தேர்ந்த காலத்தில் WA கோரிக்கை இல்லை')}</p>
                </div>
              )}
            </div>

            {/* ── ANALYTICS — secondary, compact, bottom ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Top Requested Products */}
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-4 shadow-sm">
                <h3 className="text-[13px] font-black text-[#2C392A] mb-3">{l('Top Requested Products', 'அதிக தேவை')}</h3>
                {analytics.topWAProducts.length > 0 ? (
                  <div className="space-y-1.5">
                    {analytics.topWAProducts.slice(0, 6).map((item, i) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-[11px] font-bold text-[#2C392A] truncate flex-1">{item.name}</span>
                        <span className="text-[11px] font-black text-blue-600 shrink-0">{item.count}×</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#9BAB9A] text-center py-3">{l('No data', 'தரவு இல்லை')}</p>
                )}
              </div>

              {/* Top Requested Categories */}
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-4 shadow-sm">
                <h3 className="text-[13px] font-black text-[#2C392A] mb-3">{l('Top Categories', 'வகைகள்')}</h3>
                {analytics.topWACategories.length > 0 ? (
                  <div className="space-y-1.5">
                    {analytics.topWACategories.slice(0, 6).map((cat, i) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-[11px] font-bold text-[#2C392A] truncate flex-1">{cat.name}</span>
                        <span className="text-[11px] font-black text-emerald-600 shrink-0">{cat.count}×</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#9BAB9A] text-center py-3">{l('No data', 'தரவு இல்லை')}</p>
                )}
              </div>

              {/* Status Distribution — compact bar */}
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-4 shadow-sm">
                <h3 className="text-[13px] font-black text-[#2C392A] mb-3">{l('Status Distribution', 'நிலை விளக்கம்')}</h3>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.statusDistribution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" />
                      <XAxis dataKey="name" tick={{ fill: '#6B7661', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#6B7661', fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
                      <Tooltip formatter={(value) => toNumber(value as number | string, 0)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={20}>
                        {analytics.statusDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── POS ANALYTICS ── */}
        {tab === 'pos_analytics' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black text-[#2C392A]">{l('POS Analytics', 'POS பகுப்பாய்வு')}</h2>
              <button onClick={() => void loadData()}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#EAD7B7]/40 rounded-xl text-[12px] font-bold text-[#5F6D59] hover:bg-[#F7F6F2]">
                <RefreshCw size={13} /> {l('Refresh', 'புதுப்பி')}
              </button>
            </div>

            {/* Date filter */}
            <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-4 shadow-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#5F6D59] mr-1">Period:</span>
                {(['all', 'today', 'week', 'month', 'year', 'custom'] as const).map(preset => (
                  <button key={preset} type="button" onClick={() => applyAnalyticsPreset(preset)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-colors ${analyticsDatePreset === preset ? 'bg-[#2C392A] text-white' : 'bg-[#F7F6F2] text-[#5F6D59] hover:bg-[#EAD7B7]/40'}`}>
                    {preset === 'all' ? l('All Time','எல்லாம்') : preset === 'today' ? l('Today','இன்று') : preset === 'week' ? l('This Week','இந்த வாரம்') : preset === 'month' ? l('This Month','இந்த மாதம்') : preset === 'year' ? l('This Year','இந்த ஆண்டு') : l('Custom','தேர்வு')}
                  </button>
                ))}
                {analyticsDatePreset === 'custom' && (
                  <>
                    <input type="date" value={analyticsDateFrom} onChange={e => setAnalyticsDateFrom(e.target.value)} className="px-3 py-1.5 bg-[#F7F6F2] rounded-xl text-[12px] font-semibold" />
                    <span className="text-[#5F6D59] text-[12px] font-bold">→</span>
                    <input type="date" value={analyticsDateTo} onChange={e => setAnalyticsDateTo(e.target.value)} className="px-3 py-1.5 bg-[#F7F6F2] rounded-xl text-[12px] font-semibold" />
                  </>
                )}
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-[#EAD7B7]/40 pb-0">
              {([
                { id: 'revenue' as const,    label: l('Revenue', 'வருவாய்') },
                { id: 'products' as const,   label: l('Products', 'பொருட்கள்') },
                { id: 'categories' as const, label: l('Categories', 'வகைகள்') },
                { id: 'coupons' as const,    label: l('Coupons', 'கூப்பன்') },
              ]).map(({ id, label }) => (
                <button key={id} onClick={() => setPosAnalyticsTab(id)}
                  className={`px-4 py-2.5 text-[13px] font-black rounded-t-xl transition-colors ${posAnalyticsTab === id ? 'bg-white border border-b-white border-[#EAD7B7]/40 text-[#2C392A] -mb-px' : 'text-[#5F6D59] hover:text-[#2C392A]'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Revenue sub-tab */}
            {posAnalyticsTab === 'revenue' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  {[
                    { label: l('Total Revenue', 'மொத்த வருவாய்'),   helper: 'POS + manual combined', value: formatCurrency(analytics.totalCompletedRevenue), icon: <IndianRupee size={18} />, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                    { label: l("Today's Sales", 'இன்றைய விற்பனை'),   helper: 'Completed today',        value: formatCurrency(analytics.todaySales),            icon: <TrendingUp size={18} />,   color: 'text-blue-700',    bg: 'bg-blue-50' },
                    { label: l('Completed Bills', 'முடிந்த பில்கள்'), helper: 'POS + manual bills',     value: analytics.completedOrders,                       icon: <Trophy size={18} />,       color: 'text-green-700',   bg: 'bg-green-50' },
                    { label: l('Offline Bills', 'ஆஃப்லைன் பில்'),   helper: l('Walk-in POS sales', 'வருகை விற்பனை'),      value: formatCurrency(analytics.posRevenue),            icon: <IndianRupee size={18} />,  color: 'text-cyan-700',    bg: 'bg-cyan-50' },
                    { label: l('Online Bills', 'ஆன்லைன் பில்'),    helper: l('Online POS sales', 'ஆன்லைன் விற்பனை'),       value: formatCurrency(analytics.onlinePosRevenue),      icon: <IndianRupee size={18} />,  color: 'text-blue-700',    bg: 'bg-blue-50' },
                    { label: l('Manual Bills', 'கைமுறை பில்'),    helper: l('Manual item revenue', 'கைமுறை வருவாய்'),    value: formatCurrency(analytics.manualRevenue),         icon: <ShoppingCart size={18} />, color: 'text-orange-700',  bg: 'bg-orange-50' },
                    { label: l('Monthly Revenue', 'மாத வருவாய்'), helper: 'Current month',          value: formatCurrency(analytics.monthlyRevenue),        icon: <BarChart2 size={18} />,    color: 'text-violet-700',  bg: 'bg-violet-50' },
                    { label: l('Total Items Sold', 'விற்ற பொருட்கள்'),helper: l('From completed bills', 'முடிந்த பில்களில்'),   value: Math.round(analytics.totalProductsSold),         icon: <Box size={18} />,          color: 'text-indigo-700',  bg: 'bg-indigo-50' },
                    { label: l('Top Category', 'சிறந்த வகை'),    helper: 'Most sold category',     value: analytics.bestCategory,                          icon: <List size={18} />,         color: 'text-sky-700',     bg: 'bg-sky-50' },
                    { label: l('Top Product', 'சிறந்த பொருள்'),     helper: 'Most sold item',         value: analytics.bestProduct,                           icon: <Trophy size={18} />,       color: 'text-pink-700',    bg: 'bg-pink-50' },
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
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
                    <h3 className="text-base font-black text-[#2C392A] mb-4">{l('Monthly Revenue Trend', 'மாத வருவாய் வரைபடம்')}</h3>
                    <div className="h-56">
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
                    <h3 className="text-base font-black text-[#2C392A] mb-4">{l('Bill Type Distribution', 'பில் வகை விளக்கம்')}</h3>
                    <div className="h-56">
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
                  <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm xl:col-span-2">
                    <h3 className="text-base font-black text-[#2C392A] mb-4">{l('Weekly Revenue', 'வாரந்திர வருவாய்')}</h3>
                    <div className="h-56">
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
                </div>
              </div>
            )}

            {/* Products sub-tab */}
            {posAnalyticsTab === 'products' && (
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
                <h3 className="text-base font-black text-[#2C392A] mb-4">{l('Product Analytics', 'பொருள் பகுப்பாய்வு')}</h3>
                {analytics.topProducts.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-[#EAD7B7]/30">
                    <table className="w-full min-w-[580px] text-left text-[13px]">
                      <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                        <tr>
                          <th className="px-4 py-2.5 font-black">#</th>
                          <th className="px-4 py-2.5 font-black">{l('Product', 'பொருள்')}</th>
                          <th className="px-4 py-2.5 font-black">{l('Variant', 'வகைப்படி')}</th>
                          <th className="px-4 py-2.5 font-black">{l('Qty Sold', 'விற்ற அளவு')}</th>
                          <th className="px-4 py-2.5 font-black">{l('Revenue', 'வருவாய்')}</th>
                          <th className="px-4 py-2.5 font-black">{l('Bills', 'பில்கள்')}</th>
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
                  <p className="text-center text-[13px] text-[#5F6D59] py-6">{l('No product sales in selected period', 'தேர்ந்த காலத்தில் விற்பனை இல்லை')}</p>
                )}
              </div>
            )}

            {/* Categories sub-tab */}
            {posAnalyticsTab === 'categories' && (
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
                <h3 className="text-base font-black text-[#2C392A] mb-4">{l('Category Analytics', 'வகை பகுப்பாய்வு')}</h3>
                {analytics.topCategories.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-[#EAD7B7]/30">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                        <tr>
                          <th className="px-4 py-2.5 font-black">#</th>
                          <th className="px-4 py-2.5 font-black">{l('Category', 'வகை')}</th>
                          <th className="px-4 py-2.5 font-black">{l('Revenue', 'வருவாய்')}</th>
                          <th className="px-4 py-2.5 font-black">{l('Qty Sold', 'விற்ற அளவு')}</th>
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
                  <p className="text-center text-[13px] text-[#5F6D59] py-6">{l('No data in selected period', 'தேர்ந்த காலத்தில் தரவு இல்லை')}</p>
                )}
              </div>
            )}

            {/* Coupons sub-tab */}
            {posAnalyticsTab === 'coupons' && (
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
                <h3 className="text-base font-black text-[#2C392A] mb-4">{l('Coupon Analytics', 'கூப்பன் பகுப்பாய்வு')}</h3>
                <div className="space-y-3">
                  {analytics.topCoupons.length > 0 ? analytics.topCoupons.map((coupon) => (
                    <div key={coupon.code} className="flex items-center justify-between gap-3 p-3 bg-[#F7F6F2] rounded-xl">
                      <div>
                        <p className="font-black text-[#2C392A]">{coupon.code}</p>
                        <p className="text-[11px] text-[#5F6D59]">{l('Used', 'பயன்பட்டது')} {coupon.usage} {l('time(s)', 'முறை')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[#2C392A]">{formatCurrency(coupon.discounts)}</p>
                        <p className="text-[11px] text-[#5F6D59]">{l('Discounts given', 'வழங்கப்பட்ட தள்ளுபடி')}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center text-[13px] text-[#5F6D59] py-8">{l('No coupon usage yet', 'கூப்பன் பயன்பாடு இல்லை')}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ORDER MANAGEMENT ── */}
        {tab === 'billing' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black text-[#2C392A]">{l('Order Management', 'ஆர்டர் மேலாண்மை')} <span className="text-[11px] text-[#7A846F] font-semibold">({l('POS Bills only', 'POS பில்கள் மட்டும்')})</span></h2>
              <div className="flex gap-2">
                <Link to="/pos" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7DAA8F] text-white text-[13px] font-bold hover:bg-[#5e8c72]">
                  <ShoppingCart size={14} /> Open POS
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm">
              {/* Bill type filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                {([
                  { v: 'all',     l: l('All Bills', 'அனைத்து') },
                  { v: 'offline', l: l('Offline', 'ஆஃப்லைன்') },
                  { v: 'online',  l: l('Online', 'ஆன்லைன்') },
                  { v: 'manual',  l: l('Manual', 'கைமுறை') },
                ] as const).map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setBillTypeFilter(v)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-colors ${billTypeFilter === v ? 'bg-[#2C392A] text-white' : 'bg-[#F7F6F2] text-[#5F6D59] hover:bg-[#EAD7B7]/40'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <form onSubmit={runSearch} className="space-y-3 mb-4">
                <div className="flex flex-wrap gap-2 items-center">
                  {(['today', 'week', 'month', 'custom'] as const).map(preset => (
                    <button key={preset} type="button" onClick={() => applyDatePreset(preset)}
                      className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-colors ${datePreset === preset ? 'bg-[#2C392A] text-white' : 'bg-[#F7F6F2] text-[#5F6D59] hover:bg-[#EAD7B7]/40'}`}>
                      {preset === 'today' ? l('Today','இன்று') : preset === 'week' ? l('This Week','இந்த வாரம்') : preset === 'month' ? l('This Month','இந்த மாதம்') : l('Custom Range','தேர்வு')}
                    </button>
                  ))}
                  {(search.dateFrom || search.dateTo || datePreset) && (
                    <button type="button" onClick={() => { setDatePreset(''); setSearch(s => ({ ...s, dateFrom: '', dateTo: '' })) }}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-black text-red-500 hover:bg-red-50">{l('Clear Dates', 'தேதி அழி')}</button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold" placeholder={l('Invoice / Bill No', 'பில் எண்')}
                    value={search.invoiceNo} onChange={e => setSearch(s => ({ ...s, invoiceNo: e.target.value }))} />
                  <input className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold" placeholder={l('Customer Name', 'வாடிக்கையாளர் பெயர்')}
                    value={search.customerName} onChange={e => setSearch(s => ({ ...s, customerName: e.target.value }))} />
                  <input className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold" placeholder={l('Mobile Number', 'மொபைல் எண்')}
                    value={search.phone} onChange={e => setSearch(s => ({ ...s, phone: e.target.value }))} />
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
                      <Search size={14} /> {searchLoading ? l('Searching...','தேடுகிறது...') : l('Search Bills','தேடு')}
                    </button>
                  )}
                  {datePreset === 'custom' && (
                    <button type="submit" disabled={searchLoading}
                      className="sm:col-span-2 lg:col-span-4 flex items-center justify-center gap-2 py-2.5 bg-[#7DAA8F] text-white rounded-xl font-bold text-[13px] hover:bg-[#5e8c72] disabled:opacity-60">
                      <Search size={14} /> {searchLoading ? l('Searching...','தேடுகிறது...') : l('Search Bills','தேடு')}
                    </button>
                  )}
                </div>
              </form>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-[#5F6D59]">{filteredSearchResults.length} {l('result(s)', 'முடிவுகள்')}</p>
                {filteredSearchResults.length > 0 && (
                  <button onClick={() => exportCSV(filteredSearchResults)}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#7DAA8F] hover:underline">
                    <Download size={11} /> Export CSV
                  </button>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#EAD7B7]/30">
                <table className="w-full min-w-[800px] text-left text-[13px]">
                  <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                    <tr>
                      {['Invoice No', 'Customer Name', 'Phone', 'Bill Type', 'Coupon', 'Discount', 'Delivery', 'Total', 'Date', 'Status'].map(h => (
                        <th key={h} className="px-3 py-3 font-black">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAD7B7]/20">
                    {filteredSearchResults.slice(0, 50).map(o => {
                      const billTypeLabel = normalizeOrderType(o.order_type) === 'manual_sale' ? 'MANUAL' : normalizeOrderMode(o.order_mode) === 'online' ? 'ONLINE' : 'OFFLINE'
                      const billTypeClass = normalizeOrderType(o.order_type) === 'manual_sale' ? 'bg-purple-100 text-purple-700' : normalizeOrderMode(o.order_mode) === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      return (
                        <tr key={o.id} className="hover:bg-[#F7F6F2]/50">
                          <td className="px-3 py-3 font-bold text-[#7DAA8F] text-[12px] whitespace-nowrap">{o.invoice_no || '—'}</td>
                          <td className="px-3 py-3 font-semibold text-[12px] max-w-[110px] truncate">{o.customer_name}</td>
                          <td className="px-3 py-3 text-[12px] whitespace-nowrap">{o.phone}</td>
                          <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${billTypeClass}`}>{billTypeLabel}</span></td>
                          <td className="px-3 py-3 text-[12px]">
                            {o.coupon_code ? <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold text-[10px]">{o.coupon_code}</span> : <span className="text-[#9BAB9A]">—</span>}
                          </td>
                          <td className="px-3 py-3 text-[12px]">
                            {o.discount_amount > 0 ? <span className="text-green-700 font-bold">-{formatCurrency(o.discount_amount)}</span> : <span className="text-[#9BAB9A]">—</span>}
                          </td>
                          <td className="px-3 py-3 text-[12px]">
                            {o.delivery_charge > 0 ? <span className="font-bold">{formatCurrency(o.delivery_charge)}</span> : <span className="text-[#9BAB9A]">—</span>}
                          </td>
                          <td className="px-3 py-3 font-bold text-[13px] whitespace-nowrap">{formatCurrency(toNumber(o.total, 0))}</td>
                          <td className="px-3 py-3 text-[12px] whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                          <td className="px-3 py-3">
                            <select value={normalizeStatus(o.status)} onChange={e => void updateOrderStatus(o.id, e.target.value)}
                              className={`text-[11px] font-black px-2 py-1 rounded-lg border cursor-pointer outline-none ${normalizeStatus(o.status) === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                              <option value="pending">{l('Pending', 'நிலுவை')}</option>
                              <option value="completed">{l('Completed', 'முடிந்தது')}</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredSearchResults.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-[#5F6D59]">{l('No matching bills', 'பில்கள் இல்லை')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ΓöÇΓöÇ INVENTORY TAB ΓöÇΓöÇ */}
        {tab === 'products' && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Product Form */}
            <div className="xl:col-span-2">
              <form onSubmit={handleSaveProd} className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm space-y-4">
                <h3 className="text-base font-black text-[#2C392A]">{editingProd ? l('Edit Product', 'திருத்து') : l('Add Product', 'சேர்க்கவும்')}</h3>

                {productNotice && (
                  <div className={`p-3 rounded-xl text-[12px] font-bold text-center ${productNotice.includes('!') && !productNotice.toLowerCase().includes('error') && !productNotice.toLowerCase().includes('fail') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {productNotice}
                  </div>
                )}

                {/* Product Type */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-2">{l('Product Type', 'பொருள் வகை')} *</label>
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
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Product Name', 'பொருள் பெயர்')} *</label>
                    <input required className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="e.g. Manjal Podi" value={prodForm.name} onChange={e => setProdForm(f => ({...f, name: e.target.value}))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Tamil Name', 'தமிழ் பெயர்')}</label>
                    <input className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="எ.கா. மஞ்சள் பொடி" value={prodForm.nameTa} onChange={e => setProdForm(f => ({...f, nameTa: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Price (₹)', 'விலை (₹)')} *</label>
                    <input required type="number" min="0" step="0.01"
                      className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      value={prodForm.price} onChange={e => setProdForm(f => ({...f, price: Number(e.target.value)}))} />
                    <p className="text-[10px] text-[#5F6D59] mt-0.5">
                      {prodForm.unitType === 'weight' ? `Per ${prodForm.baseQuantity}g` : prodForm.unitType === 'volume' ? `Per ${prodForm.baseQuantity}ml` : 'Per piece/bundle'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Offer Price', 'சலுகை விலை')}</label>
                    <input type="number" min="0" step="0.01"
                      className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="Leave blank for no discount"
                      value={prodForm.offerPrice} onChange={e => setProdForm(f => ({...f, offerPrice: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Stock', 'இருப்பு')} *</label>
                    <input required type="number" min="0"
                      className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      value={prodForm.stockQuantity} onChange={e => setProdForm(f => ({...f, stockQuantity: Number(e.target.value)}))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Category', 'வகை')} *</label>
                    <select required className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      value={prodForm.category}
                      onChange={e => {
                        const sel = cats.find(c => c.name_en === e.target.value)
                        setProdForm(f => ({ ...f, category: e.target.value, categoryId: sel?.id || null }))
                      }}>
                      <option value="">{l('Select category…', 'வகை தேர்வு செய்யுங்கள்…')}</option>
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
                    <p className="text-[10px] text-[#5F6D59] mt-0.5">{l('These become the selectable size buttons on the product card.', 'இவை பொருள் அட்டையில் அளவு பொத்தான்களாக காட்டப்படும்.')}</p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Description', 'விளக்கம்')}</label>
                  <textarea rows={2} className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold resize-none"
                    placeholder="Short product description…" value={prodForm.description}
                    onChange={e => setProdForm(f => ({...f, description: e.target.value}))} />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Benefits / Health Tags', 'நன்மைகள்')}</label>
                  <input className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                    placeholder="Immunity, Digestion (comma-separated)"
                    value={prodForm.benefits}
                    onChange={e => setProdForm(f => ({...f, benefits: e.target.value}))} />
                </div>

                {/* Image */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59]">{l('Product Image', 'படம்')}</label>
                  <input className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                    placeholder="https://... (image URL)"
                    value={prodForm.image} onChange={e => setProdForm(f => ({...f, image: e.target.value}))} />
                  <input type="file" accept="image/*"
                    className="w-full px-3 py-2 bg-[#F7F6F2] rounded-xl text-[12px] text-[#5F6D59]"
                    onChange={e => void handleUploadImage(e.target.files?.[0])} />
                  {imageUploading && <p className="text-[11px] text-[#7DAA8F] font-bold">{l('Uploading image…', 'படம் பதிவேற்றுகிறது…')}</p>}
                  {prodForm.image && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F7F6F2] border border-[#EAD7B7]/40">
                      <img src={prodForm.image} alt="preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="isActive" checked={prodForm.isActive}
                    onChange={e => setProdForm(f => ({...f, isActive: e.target.checked}))} />
                  <label htmlFor="isActive" className="text-[13px] font-bold text-[#2C392A]">{l('Active (visible in store)', 'கடையில் காட்டு')}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="hasVariants"
                    checked={!!prodForm.hasVariants}
                    onChange={e => setProdForm(f => ({...f, hasVariants: e.target.checked} as typeof f))} />
                  <label htmlFor="hasVariants" className="text-[13px] font-bold text-[#2C392A]">
                    {l('Has Variants (brands/sizes)', 'வகைகள் உள்ளன')}
                  </label>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={loading}
                    className="flex-grow py-3 bg-[#7DAA8F] hover:bg-[#5e8c72] text-white font-black rounded-xl disabled:opacity-60">
                    {loading ? l('Saving…','சேமிக்கிறது…') : editingProd ? l('Update Product','புதுப்பி') : l('Add Product','சேர்க்கவும்')}
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
                  <h3 className="font-black text-[#2C392A]">{l('Products', 'பொருட்கள்')} ({products.length})</h3>
                  <p className="text-[11px] text-[#5F6D59]">{products.filter(p => p.isActive).length} {l('active', 'செயல்')}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                      <tr>
                        <th className="px-5 py-3 font-black">{l('Product', 'பொருள்')}</th>
                        <th className="px-3 py-3 font-black">{l('Type', 'வகை')}</th>
                        <th className="px-3 py-3 font-black">{l('Stock', 'இருப்பு')}</th>
                        <th className="px-3 py-3 font-black">{l('Price', 'விலை')}</th>
                        <th className="px-3 py-3 font-black text-right">{l('Actions', 'நடவடிக்கை')}</th>
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

            {/* Variant Management Panel — shown when editing a variant product */}
            {editingProd && (
              <div className="xl:col-span-5 bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-black text-[#2C392A]">
                    {l('Variants', 'வகைகள்')} — {editingProd.name}
                    {!editingProd.hasVariants && (
                      <span className="ml-2 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        {l('Enable "Has Variants" above to manage variants', '"வகைகள் உள்ளன" இயக்கவும்')}
                      </span>
                    )}
                  </h3>
                  {variantNotice && (
                    <span className={`text-[12px] font-bold px-3 py-1 rounded-xl ${variantNotice.toLowerCase().includes('error') || variantNotice.toLowerCase().includes('required') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {variantNotice}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Add / Edit variant form */}
                  <form onSubmit={handleSaveVariant} className="space-y-3 bg-[#F7F8F5] rounded-xl p-4 border border-[#EAD7B7]/30">
                    <h4 className="text-[12px] font-black uppercase tracking-wider text-[#5F6D59]">
                      {editingVariantId ? l('Edit Variant', 'வகை திருத்து') : l('Add Variant', 'வகை சேர்')}
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Variant Name *', 'வகை பெயர் *')}</label>
                        <input required
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#D5DAD0] text-[13px] font-bold outline-none focus:border-[#7DAA8F]"
                          placeholder={l('e.g. Cycle Brand / 25g', 'e.g. Cycle Brand / 25g')}
                          value={variantForm.name}
                          onChange={e => setVariantForm(f => ({...f, name: e.target.value}))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Size Label', 'அளவு பட்டை')}</label>
                        <input
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#D5DAD0] text-[13px] font-bold outline-none focus:border-[#7DAA8F]"
                          placeholder="25g / 250ml / 1 pack"
                          value={variantForm.sizeLabel}
                          onChange={e => setVariantForm(f => ({...f, sizeLabel: e.target.value}))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Price (₹) *', 'விலை *')}</label>
                        <input required type="number" min="0" step="0.01"
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#D5DAD0] text-[13px] font-bold outline-none focus:border-[#7DAA8F]"
                          placeholder="40"
                          value={variantForm.price}
                          onChange={e => setVariantForm(f => ({...f, price: e.target.value}))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Stock *', 'இருப்பு *')}</label>
                        <input required type="number" min="0"
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#D5DAD0] text-[13px] font-bold outline-none focus:border-[#7DAA8F]"
                          placeholder="50"
                          value={variantForm.stock}
                          onChange={e => setVariantForm(f => ({...f, stock: e.target.value}))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Weight/Vol Value', 'எடை மதிப்பு')}</label>
                        <input type="number" min="0" step="0.001"
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#D5DAD0] text-[13px] font-bold outline-none focus:border-[#7DAA8F]"
                          placeholder="250"
                          value={variantForm.weightValue}
                          onChange={e => setVariantForm(f => ({...f, weightValue: e.target.value}))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Unit', 'அலகு')}</label>
                        <select
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#D5DAD0] text-[13px] font-bold outline-none focus:border-[#7DAA8F]"
                          value={variantForm.weightUnit}
                          onChange={e => setVariantForm(f => ({...f, weightUnit: e.target.value}))}>
                          <option value="">—</option>
                          <option value="g">g (grams)</option>
                          <option value="kg">kg</option>
                          <option value="ml">ml</option>
                          <option value="L">L (litres)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="varIsDefault" checked={variantForm.isDefault}
                        onChange={e => setVariantForm(f => ({...f, isDefault: e.target.checked}))} />
                      <label htmlFor="varIsDefault" className="text-[12px] font-bold text-[#2C392A]">{l('Default variant (shown first)', 'முதல் வகை (முதலில் காட்டு)')}</label>
                    </div>

                    <div className="flex gap-2">
                      <button type="submit" disabled={variantLoading}
                        className="flex-grow py-2.5 bg-[#7DAA8F] hover:bg-[#5e8c72] text-white font-black text-[12px] rounded-xl disabled:opacity-60">
                        {variantLoading ? l('Saving…', 'சேமிக்கிறது…') : editingVariantId ? l('Update Variant', 'புதுப்பி') : l('Add Variant', 'சேர்')}
                      </button>
                      {editingVariantId && (
                        <button type="button"
                          onClick={() => { setEditingVariantId(null); setVariantForm({ name: '', sizeLabel: '', price: '', stock: '50', weightValue: '', weightUnit: '', isDefault: false }); setVariantNotice('') }}
                          className="px-4 py-2.5 bg-[#F7F6F2] text-[#5F6D59] font-bold text-[12px] rounded-xl">
                          {l('Cancel', 'ரத்து')}
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Current variants list */}
                  <div>
                    <h4 className="text-[12px] font-black uppercase tracking-wider text-[#5F6D59] mb-3">
                      {l('Current Variants', 'தற்போதைய வகைகள்')} ({getVariants(String(editingProd.id)).length})
                    </h4>
                    {getVariants(String(editingProd.id)).length === 0 ? (
                      <p className="text-[12px] text-[#9BAB9A] text-center py-6 bg-[#F7F8F5] rounded-xl">
                        {l('No variants yet — add one using the form.', 'வகைகள் இல்லை — படிவத்தில் சேர்க்கவும்.')}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {getVariants(String(editingProd.id)).map((v: ProductVariant) => (
                          <div key={v.id}
                            className={`flex items-center justify-between gap-2 p-3 rounded-xl border ${editingVariantId === v.id ? 'border-[#2C392A] bg-[#2C392A]/5' : 'bg-[#F7F8F5] border-transparent'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              {v.isDefault && (
                                <span className="w-4 h-4 rounded-full bg-[#2C392A] text-white text-[8px] font-black flex items-center justify-center shrink-0">★</span>
                              )}
                              <div className="min-w-0">
                                <p className="text-[12px] font-bold text-[#2C392A] truncate">{v.variantName}</p>
                                <p className="text-[10px] text-[#5F6D59]">
                                  {formatCurrency(v.price)}{v.sizeLabel ? ` · ${v.sizeLabel}` : ''} · {l('Stock', 'இருப்பு')}: {v.stock}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!v.isDefault && (
                                <button onClick={() => void handleSetDefault(v.id)}
                                  className="p-1.5 text-[#5F6D59] hover:text-[#2C392A] rounded-lg hover:bg-white text-[9px] font-black uppercase">
                                  {l('Default', 'முதல்')}
                                </button>
                              )}
                              <button onClick={() => startEditVariant(v)}
                                className="p-1.5 text-[#7DAA8F] hover:bg-[#7DAA8F]/10 rounded-lg">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => void handleDeleteVariant(v.id)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ΓöÇΓöÇ CATEGORIES TAB ΓöÇΓöÇ */}
        {tab === 'categories' && (
          <div className="max-w-lg space-y-6">
            <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-black text-[#2C392A] mb-4">{l('Product Categories', 'பொருள் வகைகள்')}</h3>
              <form onSubmit={onAddCat} className="flex gap-2 mb-5">
                <input className="flex-grow px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                  placeholder={l('Category name (English)', 'வகை பெயர் (English)')} value={newCat.name_en}
                  onChange={e => setNewCat(c => ({...c, name_en: e.target.value}))} />
                <input className="w-32 px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                  placeholder={l('Tamil', 'தமிழ்')} value={newCat.name_ta}
                  onChange={e => setNewCat(c => ({...c, name_ta: e.target.value}))} />
                <button type="submit" className="px-4 py-2.5 bg-[#7DAA8F] text-white font-black rounded-xl text-[13px]">{l('Add', 'சேர்')}</button>
              </form>
              <div className="space-y-2">
                {cats.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-[#F7F6F2] rounded-xl">
                    <div>
                      <p className="text-[13px] font-bold text-[#2C392A]">{c.name_en}</p>
                      <p className="text-[11px] text-[#5F6D59]">{c.name_ta}</p>
                      <span className={`text-[10px] font-black uppercase ${c.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                        {c.is_active ? 'Active' : l('Inactive', 'நிறுத்தம்')}
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
              <h2 className="text-xl font-black text-[#2C392A]">{l('Coupon Management', 'கூப்பன் மேலாண்மை')}</h2>
              <button onClick={() => void loadCoupons()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#EAD7B7]/60 rounded-xl text-[13px] font-bold text-[#5F6D59] hover:bg-[#F7F6F2] transition-colors">
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {/* Info banner */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[12px] font-bold text-blue-700">
              {l('Coupon discount applies to product subtotal only — not delivery charge.', 'கூப்பன் தள்ளுபடி பொருட்களுக்கு மட்டும்.')}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Create / Edit form */}
              <form onSubmit={saveCoupon} className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-[#2C392A]">
                    {editingCouponId !== null ? l('✎ Edit Coupon', '✎ திருத்து') : l('+ New Coupon', '+ புதிய கூப்பன்')}
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
                  <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Coupon Code', 'கூப்பன் குறியீடு')} *</label>
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
                    <p className="text-[10px] text-[#9BAB9A] mt-1">{l('Code cannot be changed when editing', 'திருத்தும்போது குறியீடு மாற்ற முடியாது')}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Discount %', 'தள்ளுபடி %')} *</label>
                    <input type="number" min="1" max="100" className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="10"
                      value={couponForm.percentage}
                      onChange={e => setCouponForm(f => ({ ...f, percentage: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Min Order (₹)', 'குறை ஆர்டர் (₹)')}</label>
                    <input type="number" min="0" className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="0 = no minimum"
                      value={couponForm.min_order_value}
                      onChange={e => setCouponForm(f => ({ ...f, min_order_value: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Expiry Date', 'காலாவதி தேதி')}</label>
                    <input type="date" className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      value={couponForm.expiry_date}
                      onChange={e => setCouponForm(f => ({ ...f, expiry_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">{l('Usage Limit', 'பயன்பாட்டு வரம்பு')}</label>
                    <input type="number" min="1" className="w-full px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-bold"
                      placeholder="Unlimited"
                      value={couponForm.usage_limit}
                      onChange={e => setCouponForm(f => ({ ...f, usage_limit: e.target.value }))} />
                  </div>
                </div>

                <button type="submit" className="w-full py-3 rounded-xl bg-[#2C392A] text-white font-black text-[13px] hover:bg-[#1e2817]">
                  {editingCouponId !== null ? l('Update Coupon', 'புதுப்பி') : l('Create Coupon', 'உருவாக்கு')}
                </button>
              </form>

              {/* Coupon list */}
              <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm">
                <h3 className="text-base font-black text-[#2C392A] mb-4">{l('All Coupons', 'அனைத்து கூப்பன்')} ({coupons.length})</h3>
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
                              {coupon.is_active ? l('Active', 'செயல்') : l('Off', 'நிறுத்து')}
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
                    <div className="text-center text-[13px] text-[#5F6D59] py-8">{l('No coupons yet. Create your first coupon!', 'கூப்பன் இல்லை. முதல் கூப்பன் உருவாக்கவும்!')}</div>
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
              <h2 className="text-xl font-black text-[#2C392A]">{l('User Management', 'பயனர் மேலாண்மை')}</h2>
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
                placeholder={l('Search by name or email…', 'பெயர் அல்லது மின்னஞ்சலால் தேடுக…')}
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
                <div className="p-8 text-center text-[13px] font-bold text-[#5F6D59]">{l('Loading users…', 'பயனர்கள் ஏற்றுகிறது…')}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-[#F7F6F2] border-b border-[#EAD7B7]/40">
                        <th className="text-left px-4 py-3 font-black text-[#2C392A]">{l('Name', 'பெயர்')}</th>
                        <th className="text-left px-4 py-3 font-black text-[#2C392A]">{l('Email', 'மின்னஞ்சல்')}</th>
                        <th className="text-left px-4 py-3 font-black text-[#2C392A]">{l('Mobile', 'மொபைல்')}</th>
                        <th className="text-left px-4 py-3 font-black text-[#2C392A]">{l('Joined', 'சேர்ந்த தேதி')}</th>
                        <th className="text-center px-4 py-3 font-black text-[#2C392A]">{l('Role', 'பங்கு')}</th>
                        <th className="text-center px-4 py-3 font-black text-[#2C392A]">{l('Action', 'நடவடிக்கை')}</th>
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
                                {u.role === 'admin' ? l('Admin', 'நிர்வாகி') : l('Customer', 'வாடிக்கையாளர்')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {u.id === user?.id ? (
                                <span className="text-[11px] text-[#9BAB9A] font-bold">{l('You', 'நீங்கள்')}</span>
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
                                  {u.role === 'admin' ? <><ShieldOff size={11} /> Remove Admin</> : <><ShieldCheck size={11} /> {l('Make Admin', 'நிர்வாகி ஆக்கு')}</>}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {allUsers.length === 0 && !usersLoading && (
                    <p className="p-8 text-center text-[13px] font-bold text-[#9BAB9A]">{l('No users found.', 'பயனர் இல்லை.')}</p>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#9BAB9A] font-bold">
              • {l('// already patched', 'பங்கு மாற்றம் அடுத்த முறை உள்நுழைந்தால் நடைமுறைக்கு வரும்.')}
            </p>
          </div>
        )}

        {/* ── IMAGE MAPPING TAB ── */}
        {tab === 'image_mapping' && (
          <div className="space-y-6">
            <ImageMappingTool />
          </div>
        )}

      </main>
    </div>
  )
}

