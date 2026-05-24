import React, { useCallback, useEffect, useState, useMemo, type FormEvent } from 'react'
import {
  BarChart2, Trash2, Edit2, List, ShoppingCart, LayoutDashboard,
  Box, AlertCircle, ArrowUp, ArrowDown, Power, Download, TrendingUp,
  Package, IndianRupee, Search, RefreshCw, Users, ShieldCheck, ShieldOff, Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuthStore, useProductStore, type Product } from '../store/store'
import { uploadProductImage } from '../lib/storage'
import { formatCurrency, normalizeUnitType, toNumber, type UnitType } from '../lib/retail'
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
  id: string; invoice_no: string; customer_name: string; phone: string
  created_at: string; total: number; status: string; order_mode: string; user_id: string | null; items: unknown
}
type DashboardOrderItem = { order_id: string; product_name: string; quantity: number; line_total: number }
type TabKey = 'overview' | 'billing' | 'products' | 'categories' | 'users'
type ProfileUser = { id: string; email: string; name: string; mobile: string; role: string; created_at: string }

const normalizeStatus = (v: unknown) => String(v || '').trim().toLowerCase()
const normalizeMode = (v: unknown) => String(v || '').trim().toLowerCase()
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
  const header = ['Invoice No', 'Customer', 'Phone', 'Date', 'Total (Rs)', 'Status']
  const rows = orders.map(o => [
    o.invoice_no, o.customer_name, o.phone,
    new Date(o.created_at).toLocaleDateString('en-IN'),
    toNumber(o.total, 0).toFixed(2), o.status,
  ])
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['∩╗┐' + csv], { type: 'text/csv;charset=utf-8;' })
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

  // Search & date filter
  const [search, setSearch] = useState({ invoiceNo: '', phone: '', email: '', userId: '', dateFrom: '', dateTo: '' })
  const [searchResults, setSearchResults] = useState<DashboardOrder[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

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
    created_at: String(row.created_at || ''), total: toNumber(row.total, 0),
    status: String(row.status || 'pending'),
    order_mode: String(row.order_mode || 'online'),
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    items: row.items,
  })

  // ΓöÇΓöÇ Analytics ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const analytics = useMemo(() => {
    const nonCancelledOrders = orders.filter((order) => normalizeStatus(order.status) !== 'cancelled')
    const completedOrders = nonCancelledOrders.filter((order) => isCompletedStatus(order.status))
    const pendingOrders = nonCancelledOrders.filter((order) => normalizeStatus(order.status) === 'pending')

    const completedRevenue = completedOrders.reduce((sum, order) => sum + toNumber(order.total, 0), 0)
    const todayKey = new Date().toISOString().slice(0, 10)
    const monthKey = todayKey.slice(0, 7)

    const todaySales = completedOrders
      .filter((order) => order.created_at.startsWith(todayKey))
      .reduce((sum, order) => sum + toNumber(order.total, 0), 0)

    const monthlyRevenue = completedOrders
      .filter((order) => order.created_at.startsWith(monthKey))
      .reduce((sum, order) => sum + toNumber(order.total, 0), 0)

    const onlineCompleted = completedOrders.filter((order) => normalizeMode(order.order_mode) !== 'offline')
    const offlineCompleted = completedOrders.filter((order) => normalizeMode(order.order_mode) === 'offline')
    const onlineRevenue = onlineCompleted.reduce((sum, order) => sum + toNumber(order.total, 0), 0)
    const offlineRevenue = offlineCompleted.reduce((sum, order) => sum + toNumber(order.total, 0), 0)

    const completedOrderIds = new Set(completedOrders.map((order) => order.id))
    const completedItems = orderItems.length > 0
      ? orderItems.filter((item) => completedOrderIds.has(item.order_id))
      : completedOrders.flatMap((order) => parseOrderItems(order.items).map((row) => ({
          order_id: order.id,
          product_name: String(row.product_name || row.name || 'Product'),
          quantity: toNumber(row.quantity ?? row.qty, 0),
          line_total: toNumber(row.line_total ?? row.lineTotal, 0),
        })))

    const productMap = new Map<string, { name: string; qty: number; revenue: number }>()
    const categoryMap = new Map<string, { name: string; qty: number; revenue: number }>()
    const productCategoryLookup = new Map(
      products.map((product) => [String(product.name || '').trim().toLowerCase(), product.category || 'Uncategorized'])
    )

    let totalProductsSold = 0
    completedItems.forEach(({ product_name, quantity, line_total }) => {
      const qty = toNumber(quantity, 0)
      const lineRevenue = toNumber(line_total, 0)
      totalProductsSold += qty

      const productKey = String(product_name || 'Product').trim() || 'Product'
      const productCur = productMap.get(productKey) || { name: productKey, qty: 0, revenue: 0 }
      productCur.qty += qty
      productCur.revenue += lineRevenue
      productMap.set(productKey, productCur)

      const categoryName = productCategoryLookup.get(productKey.toLowerCase()) || 'Uncategorized'
      const catCur = categoryMap.get(categoryName) || { name: categoryName, qty: 0, revenue: 0 }
      catCur.qty += qty
      catCur.revenue += lineRevenue
      categoryMap.set(categoryName, catCur)
    })

    const topProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty)
    const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.qty - a.qty)
    const bestProduct = topProducts[0]?.name || 'No sales yet'
    const bestCategory = topCategories[0]?.name || 'No sales yet'

    const monthlyRevenueMap = new Map<string, number>()
    completedOrders.forEach((order) => {
      const key = order.created_at.slice(0, 7)
      monthlyRevenueMap.set(key, (monthlyRevenueMap.get(key) || 0) + toNumber(order.total, 0))
    })

    const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (5 - index))
      const key = date.toISOString().slice(0, 7)
      return {
        key,
        month: date.toLocaleDateString('en-IN', { month: 'short' }),
        revenue: monthlyRevenueMap.get(key) || 0,
      }
    })

    const statusDistribution = [
      { name: 'Pending', value: pendingOrders.length, color: '#f59e0b' },
      { name: 'Completed', value: completedOrders.length, color: '#10b981' },
    ]

    const channelDistribution = [
      { name: 'Online', value: onlineRevenue, color: '#3b82f6' },
      { name: 'Offline POS', value: offlineRevenue, color: '#f97316' },
    ]

    const weeklyRevenueMap = new Map<string, number>()
    completedOrders.forEach((order) => {
      const key = order.created_at.slice(0, 10)
      weeklyRevenueMap.set(key, (weeklyRevenueMap.get(key) || 0) + toNumber(order.total, 0))
    })

    const weeklySales = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const key = date.toISOString().slice(0, 10)
      return {
        day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        date: key,
        revenue: weeklyRevenueMap.get(key) || 0,
      }
    })

    return {
      totalCompletedRevenue: completedRevenue,
      todaySales,
      pendingOrders: pendingOrders.length,
      completedOrders: completedOrders.length,
      onlineRevenue,
      offlineRevenue,
      monthlyRevenue,
      totalProductsSold,
      bestCategory,
      bestProduct,
      monthlyTrend,
      channelDistribution,
      statusDistribution,
      topCategories: topCategories.slice(0, 6),
      weeklySales,
    }
  }, [orders, orderItems, products])

  // ΓöÇΓöÇ Load data ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) return
    setLoading(true)
    try {
      const [cRes, oRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
      ])
      const mappedOrders = (oRes.data || []).map(r => toDashboardOrder(r as Record<string, unknown>))
      setCats((cRes.data || []) as Category[])
      setOrders(mappedOrders)
      setSearchResults(mappedOrders.slice(0, 100))
      await fetchProducts(true)

      const orderIds = mappedOrders.map(o => o.id).filter(Boolean)
      if (orderIds.length > 0) {
        const { data: oi } = await supabase
          .from('order_items').select('order_id,product_name,quantity,line_total')
          .in('order_id', orderIds)
        setOrderItems((oi || []).map(r => ({
          order_id: String((r as Record<string,unknown>).order_id || ''),
          product_name: String((r as Record<string,unknown>).product_name || 'Product'),
          quantity: toNumber((r as Record<string,unknown>).quantity, 0),
          line_total: toNumber((r as Record<string,unknown>).line_total, 0),
        })))
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

  useEffect(() => {
    if (!isAdmin) return
    void loadData()
    if (!isSupabaseConfigured) return
    const ch = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void loadData())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [isAdmin, loadData])

  useEffect(() => {
    if (tab === 'users') void loadUsers()
  }, [tab, loadUsers])

  // ΓöÇΓöÇ Order search ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const runSearch = async (e?: FormEvent) => {
    e?.preventDefault()
    setSearchLoading(true)
    try {
      let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500)
      if (search.invoiceNo.trim()) q = q.ilike('invoice_no', `%${search.invoiceNo.trim()}%`)
      if (search.phone.trim())    q = q.ilike('phone', `%${search.phone.trim()}%`)
      if (search.dateFrom)        q = q.gte('created_at', `${search.dateFrom}T00:00:00`)
      if (search.dateTo)          q = q.lte('created_at', `${search.dateTo}T23:59:59`)

      if (search.userId.trim() || search.email.trim()) {
        const term = (search.userId || search.email).trim()
        const isUuid = /^[0-9a-f-]{36}$/i.test(term)
        const pRes = await supabase.from('profiles').select('id')
          .or(isUuid ? `id.eq.${term},customer_code.eq.${term}` : `email.ilike.%${term}%,mobile.ilike.%${term}%`)
          .limit(10)
        const ids = (pRes.data || []).map(p => (p as {id: string}).id)
        if (ids.length > 0) q = q.in('user_id', ids)
        else { setSearchResults([]); return }
      }

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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
              {[
                {
                  label: 'Total Completed Revenue',
                  helper: 'Money Earned',
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
                  label: 'Pending Orders',
                  helper: 'Awaiting confirmation',
                  value: analytics.pendingOrders,
                  icon: <Package size={18} />,
                  color: 'text-amber-700',
                  bg: 'bg-amber-50',
                },
                {
                  label: 'Completed Orders',
                  helper: 'Confirmed sales',
                  value: analytics.completedOrders,
                  icon: <Trophy size={18} />,
                  color: 'text-green-700',
                  bg: 'bg-green-50',
                },
                {
                  label: 'Online Orders Revenue',
                  helper: 'Completed online',
                  value: formatCurrency(analytics.onlineRevenue),
                  icon: <IndianRupee size={18} />,
                  color: 'text-cyan-700',
                  bg: 'bg-cyan-50',
                },
                {
                  label: 'Offline POS Revenue',
                  helper: 'Completed POS',
                  value: formatCurrency(analytics.offlineRevenue),
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
                  label: 'Total Products Sold',
                  helper: 'From completed orders',
                  value: Math.round(analytics.totalProductsSold),
                  icon: <Box size={18} />,
                  color: 'text-indigo-700',
                  bg: 'bg-indigo-50',
                },
                {
                  label: 'Best Selling Category',
                  helper: 'Top category now',
                  value: analytics.bestCategory,
                  icon: <List size={18} />,
                  color: 'text-sky-700',
                  bg: 'bg-sky-50',
                },
                {
                  label: 'Best Selling Product',
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
                <h3 className="text-base font-black text-[#2C392A] mb-4">Online vs Offline Sales</h3>
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
                <h3 className="text-base font-black text-[#2C392A] mb-4">Top Categories</h3>
                <div className="h-56 sm:h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.topCategories} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" />
                      <XAxis type="number" tick={{ fill: '#6B7661', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={108} tick={{ fill: '#6B7661', fontSize: 10.5 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => toNumber(value as number | string, 0)} />
                      <Bar dataKey="qty" fill="#7DAA8F" radius={[0, 7, 7, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
            </div>

            <div className="bg-white rounded-2xl border border-[#EAD7B7]/30 p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-black text-[#2C392A] mb-4">Order Management</h3>
              <form onSubmit={runSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  { key: 'invoiceNo', placeholder: 'Invoice No (INV-...)' },
                  { key: 'phone',     placeholder: 'Mobile Number' },
                  { key: 'email',     placeholder: 'Email / User ID' },
                  { key: 'userId',    placeholder: 'Customer Code (CUST-...)' },
                ].map(({ key, placeholder }) => (
                  <input key={key} className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold"
                    placeholder={placeholder}
                    value={(search as Record<string,string>)[key]}
                    onChange={e => setSearch(s => ({ ...s, [key]: e.target.value }))} />
                ))}
                <input type="date" className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold"
                  value={search.dateFrom} onChange={e => setSearch(s => ({ ...s, dateFrom: e.target.value }))} />
                <input type="date" className="px-3 py-2.5 bg-[#F7F6F2] rounded-xl text-[13px] font-semibold"
                  value={search.dateTo} onChange={e => setSearch(s => ({ ...s, dateTo: e.target.value }))} />
                <button type="submit" disabled={searchLoading}
                  className="sm:col-span-2 lg:col-span-2 flex items-center justify-center gap-2 py-2.5 bg-[#7DAA8F] text-white rounded-xl font-bold text-[13px] hover:bg-[#5e8c72] disabled:opacity-60">
                  <Search size={14} /> {searchLoading ? 'Searching...' : 'Search Orders'}
                </button>
              </form>

              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-[#5F6D59]">{searchResults.length} result(s)</p>
                {searchResults.length > 0 && (
                  <button onClick={() => exportCSV(searchResults)}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#7DAA8F] hover:underline">
                    <Download size={11} /> Export results
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#EAD7B7]/30">
                <table className="w-full min-w-[600px] text-left text-[13px]">
                  <thead className="bg-[#F7F6F2] text-[10px] uppercase tracking-wider text-[#5F6D59]">
                    <tr>
                      {['Invoice','Customer','Phone','Date','Total','Order Type','Status Badge','Change Status'].map(h => (
                        <th key={h} className="px-4 py-3 font-black">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAD7B7]/20">
                    {searchResults.slice(0, 50).map(o => (
                      <tr key={o.id} className="hover:bg-[#F7F6F2]/50">
                        <td className="px-4 py-3 font-bold text-[#7DAA8F] text-[12px]">{o.invoice_no}</td>
                        <td className="px-4 py-3 font-semibold text-[13px]">{o.customer_name}</td>
                        <td className="px-4 py-3 text-[13px]">{o.phone}</td>
                        <td className="px-4 py-3 text-[12px]">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 font-bold text-[13px]">{formatCurrency(toNumber(o.total, 0))}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            o.order_mode === 'offline' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>{o.order_mode === 'offline' ? '≡ƒÅ¬ Offline' : '≡ƒîÉ Online'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            normalizeStatus(o.status) === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>{normalizeStatus(o.status) === 'completed' ? 'Completed' : 'Pending'}</span>
                        </td>
                        <td className="px-4 py-3">
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
                    ))}
                    {searchResults.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-[#5F6D59]">No matching orders</td></tr>
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
                      placeholder="α««α«₧α»ìα«Üα«│α»ì α«¬α»èα«ƒα«┐" value={prodForm.nameTa} onChange={e => setProdForm(f => ({...f, nameTa: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#5F6D59] mb-1">Price (Γé╣) *</label>
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
                      <option value="">Select categoryΓÇª</option>
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
                    placeholder="Short product descriptionΓÇª" value={prodForm.description}
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
                  {imageUploading && <p className="text-[11px] text-[#7DAA8F] font-bold">Uploading imageΓÇª</p>}
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
                    {loading ? 'SavingΓÇª' : editingProd ? 'Update Product' : 'Add Product'}
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
                          <td className="px-3 py-3 font-bold text-[#2C392A]">Γé╣{p.price}</td>
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
                placeholder="Search by name or emailΓÇª"
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
                <div className="p-8 text-center text-[13px] font-bold text-[#5F6D59]">Loading usersΓÇª</div>
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
                            <td className="px-4 py-3 font-bold text-[#2C392A]">{u.name || 'ΓÇö'}</td>
                            <td className="px-4 py-3 text-[#5F6D59]">{u.email || 'ΓÇö'}</td>
                            <td className="px-4 py-3 text-[#5F6D59]">{u.mobile || 'ΓÇö'}</td>
                            <td className="px-4 py-3 text-[#9BAB9A] text-[11px]">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : 'ΓÇö'}
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
              ΓÜí Role changes take effect on the user's next login. Admins get Dashboard + POS Billing access.
            </p>
          </div>
        )}

      </main>
    </div>
  )
}
