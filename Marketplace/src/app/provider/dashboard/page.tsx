'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import ChatWidget from '@/components/ChatWidget'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { apiClient } from '@/lib/api'

interface DashboardStats {
  available: number
  accepted: number
  completedCases: number
  averageRating: number
  totalReviews: number
}

interface RecentCase {
  id: string
  title: string
  status: string
  customerName: string
  createdAt: string
  urgency: string
}

export default function ProviderDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentCases, setRecentCases] = useState<RecentCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Income state
  const [incomeStats, setIncomeStats] = useState<any>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([])

  useEffect(() => {
    console.log('🏠 Provider Dashboard - Auth state:', { 
      isAuthenticated, 
      isLoading, 
      user: user?.role, 
      userEmail: user?.email 
    })
    
    // Wait for authentication loading to complete
    if (isLoading) {
      console.log('⏳ Auth still loading, waiting...')
      return
    }
    
    // Redirect if not authenticated
    if (!isAuthenticated || !user) {
      console.log('❌ Not authenticated, redirecting to login')
      router.push('/auth/login')
      return
    }
    
    // Check if user is a service provider
    if (user.role !== 'service_provider' && user.role !== 'tradesperson') {
      console.log('❌ User is not a service provider, redirecting to home')
      router.push('/')
      return
    }
    
    // User is authenticated and is a service provider, load dashboard
    console.log('✅ Service provider authenticated, loading dashboard')
    loadDashboardData()
  }, [isAuthenticated, isLoading, user, router])

  const handleAcceptCase = async (caseId: string) => {
    try {
      const response = await apiClient.acceptCase(caseId, user!.id, `${user!.firstName} ${user!.lastName}`)
      alert('Заявката беше приета успешно!')
      loadDashboardData() // Reload data
    } catch (error: any) {
      console.error('Error accepting case:', error)
      
      // Check if trial expired
      if (error.response?.data?.error?.code === 'TRIAL_EXPIRED') {
        const errorData = error.response.data.error
        const details = errorData.details || {}
        const message = `${errorData.message}\n\n${details.reason || ''}`
        
        if (confirm(`${message}\n\nИскате ли да видите абонаментните планове?`)) {
          router.push('/upgrade-required')
        }
      } else {
        alert(error.response?.data?.error?.message || 'Грешка при приемане на заявката')
      }
    }
  }

  const handleCompleteCase = async (caseId: string) => {
    try {
      await apiClient.updateCaseStatusDirect(caseId, 'completed', 'Completed successfully')
      alert('Заявката беше завършена успешно!')
      loadDashboardData() // Reload data
    } catch (error) {
      console.error('Error completing case:', error)
      alert('Грешка при завършване на заявката')
    }
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load real dashboard stats from API
      const [statsResponse, casesResponse, providerResponse] = await Promise.all([
        apiClient.getCaseStats(user!.id),
        apiClient.getCasesWithFilters({ providerId: user!.id, limit: 5 }),
        apiClient.getProvider(user!.id)
      ])

      // Process stats
      const statsData = statsResponse.data?.data || {}
      const statusStats = statsData.statusStats || []
      const casesData = casesResponse.data?.data?.cases || []
      const providerData = providerResponse.data?.data || {}

      // Get stats directly from API response (same structure as /dashboard/cases)
      const available = Number(statsData.available) || 0
      const accepted = Number(statsData.accepted) || 0
      const completedCases = Number(statsData.completed) || 0

      const dashboardStats: DashboardStats = {
        available,
        accepted,
        completedCases,
        averageRating: providerData.rating || 0,
        totalReviews: providerData.totalReviews || providerData.total_reviews || 0
      }

      // Map recent cases to dashboard format
      const recentCasesList: RecentCase[] = casesData.map((c: any) => ({
        id: c.id,
        title: c.description || c.service_type || 'Без описание',
        status: c.status === 'wip' ? 'active' : c.status, // Keep original status
        customerName: c.customer_name || 'Неизвестен клиент',
        createdAt: c.created_at,
        urgency: c.priority || 'normal'
      }))

      setStats(dashboardStats)
      setRecentCases(recentCasesList)
      
    } catch (err: any) {
      console.error('Error loading dashboard data:', err)
      setError('Неуспешно зареждане на данните за таблото')
    } finally {
      setLoading(false)
    }
  }

  // Fetch income data
  useEffect(() => {
    if (isAuthenticated && user && !isLoading) {
      fetchAvailableYears()
    }
  }, [isAuthenticated, user?.id, isLoading])

  useEffect(() => {
    if (isAuthenticated && user && selectedYear && !isLoading) {
      fetchIncomeStats()
    }
  }, [isAuthenticated, user?.id, selectedYear, isLoading])

  const fetchAvailableYears = async () => {
    try {
      const response = await apiClient.getIncomeYears(user!.id)
      if (response.data?.success) {
        const years = response.data.data || []
        setAvailableYears(years)
        const currentYear = new Date().getFullYear()
        if (years.includes(currentYear)) {
          setSelectedYear(currentYear)
        } else if (years.length > 0) {
          setSelectedYear(years[years.length - 1])
        }
      }
    } catch (error) {
      console.error('Error fetching available years:', error)
    }
  }

  const fetchIncomeStats = async () => {
    try {
      const startDate = `${selectedYear}-01-01`
      const endDate = `${selectedYear}-12-31`
      const response = await apiClient.getIncomeStats(user!.id, startDate, endDate)
      if (response.data?.success) {
        setIncomeStats(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching income stats:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/30'
      case 'wip': return 'text-purple-400 bg-purple-500/20 border border-purple-500/30'
      case 'pending': return 'text-amber-400 bg-amber-500/20 border border-amber-500/30'
      case 'accepted': return 'text-blue-400 bg-blue-500/20 border border-blue-500/30'
      case 'completed': return 'text-green-400 bg-green-500/20 border border-green-500/30'
      case 'declined': return 'text-red-400 bg-red-500/20 border border-red-500/30'
      case 'cancelled': return 'text-slate-400 bg-slate-500/20 border border-slate-500/30'
      default: return 'text-slate-400 bg-slate-500/20 border border-slate-500/30'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Активна'
      case 'wip': return 'В процес'
      case 'pending': return 'Чакаща'
      case 'accepted': return 'Приета'
      case 'completed': return 'Завършена'
      case 'declined': return 'Отказана'
      case 'cancelled': return 'Отменена'
      default: return status
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'text-red-400'
      case 'normal': return 'text-slate-400'
      case 'low': return 'text-green-400'
      default: return 'text-slate-400'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Зареждане на табло...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">❌ {error}</p>
            <button 
              onClick={loadDashboardData}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Опитай отново
            </button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 relative overflow-x-hidden">
      {/* Industrial background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-br from-purple-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
      </div>

      <Header />
      
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Добре дошли, {user?.firstName}! 👋
            </h1>
            <p className="text-slate-300">
              Управлявайте вашите заявки и следете статистиките си
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/10 backdrop-blur-md rounded-xl shadow-xl border border-green-500/30 p-6 hover:from-green-600/30 hover:to-emerald-600/20 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-500/30 rounded-lg flex items-center justify-center">
                    <span className="text-green-300 text-xl">📋</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-200">Налични заявки</p>
                  <p className="text-2xl font-bold text-white">{stats.available}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/10 backdrop-blur-md rounded-xl shadow-xl border border-blue-500/30 p-6 hover:from-blue-600/30 hover:to-indigo-600/20 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center">
                    <span className="text-blue-300 text-xl">✅</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-200">Приети</p>
                  <p className="text-2xl font-bold text-white">{stats.accepted}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/10 backdrop-blur-md rounded-xl shadow-xl border border-purple-500/30 p-6 hover:from-purple-600/30 hover:to-pink-600/20 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-500/30 rounded-lg flex items-center justify-center">
                    <span className="text-purple-300 text-xl">🏁</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-purple-200">Завършени</p>
                  <p className="text-2xl font-bold text-white">{stats.completedCases}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/10 backdrop-blur-md rounded-xl shadow-xl border border-yellow-500/30 p-6 hover:from-yellow-600/30 hover:to-amber-600/20 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-yellow-500/30 rounded-lg flex items-center justify-center">
                    <span className="text-yellow-300 text-xl">⭐</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-yellow-200">Оценка</p>
                  <p className="text-2xl font-bold text-white">{Number(stats.averageRating || 0).toFixed(1)}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-pink-600/20 to-rose-600/10 backdrop-blur-md rounded-xl shadow-xl border border-pink-500/30 p-6 hover:from-pink-600/30 hover:to-rose-600/20 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-pink-500/30 rounded-lg flex items-center justify-center">
                    <span className="text-pink-300 text-xl">💬</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-pink-200">Отзиви</p>
                  <p className="text-2xl font-bold text-white">{stats.totalReviews}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <a
            href="/dashboard/cases"
            className="bg-gradient-to-br from-indigo-600/20 to-blue-600/10 backdrop-blur-md rounded-xl shadow-xl border border-indigo-500/30 p-6 hover:from-indigo-600/30 hover:to-blue-600/20 hover:border-indigo-400/50 transition-all group"
          >
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-indigo-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-3xl">📋</span>
              </div>
              <h3 className="text-white font-semibold">Заявки</h3>
              <p className="text-indigo-300 text-xs mt-1">Управление</p>
            </div>
          </a>
          
          <a
            href="/provider/my-bids"
            className="bg-gradient-to-br from-pink-600/20 to-rose-600/10 backdrop-blur-md rounded-xl shadow-xl border border-pink-500/30 p-6 hover:from-pink-600/30 hover:to-rose-600/20 hover:border-pink-400/50 transition-all group"
          >
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-pink-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-white font-semibold">Оферти</h3>
              <p className="text-pink-300 text-xs mt-1">Моите оферти</p>
            </div>
          </a>
          
          <a
            href="/settings/sms"
            className="bg-gradient-to-br from-cyan-600/20 to-teal-600/10 backdrop-blur-md rounded-xl shadow-xl border border-cyan-500/30 p-6 hover:from-cyan-600/30 hover:to-teal-600/20 hover:border-cyan-400/50 transition-all group"
          >
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-cyan-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-3xl">📱</span>
              </div>
              <h3 className="text-white font-semibold">SMS</h3>
              <p className="text-cyan-300 text-xs mt-1">Настройки</p>
            </div>
          </a>
          
          <a
            href="/settings?section=profile"
            className="bg-gradient-to-br from-purple-600/20 to-pink-600/10 backdrop-blur-md rounded-xl shadow-xl border border-purple-500/30 p-6 hover:from-purple-600/30 hover:to-pink-600/20 hover:border-purple-400/50 transition-all group"
          >
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-purple-400/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-3xl">⚙️</span>
              </div>
              <h3 className="text-white font-semibold">Профил</h3>
              <p className="text-purple-300 text-xs mt-1">Редактиране</p>
            </div>
          </a>
          
          <a
            href="/provider/vip"
            className="bg-gradient-to-br from-yellow-600/20 to-amber-600/10 backdrop-blur-md rounded-xl shadow-xl border-2 border-yellow-500/50 p-6 hover:from-yellow-600/30 hover:to-amber-600/20 hover:border-yellow-400/70 transition-all group"
          >
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-yellow-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-3xl">👑</span>
              </div>
              <h3 className="text-yellow-300 font-semibold">VIP</h3>
              <p className="text-yellow-400/70 text-xs mt-1">Видимост</p>
            </div>
          </a>
          
          <a
            href="/map"
            className="bg-gradient-to-br from-emerald-600/20 to-green-600/10 backdrop-blur-md rounded-xl shadow-xl border border-emerald-500/30 p-6 hover:from-emerald-600/30 hover:to-green-600/20 hover:border-emerald-400/50 transition-all group"
          >
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-emerald-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-3xl">🗺️</span>
              </div>
              <h3 className="text-white font-semibold">Карта</h3>
              <p className="text-emerald-300 text-xs mt-1">Заявки наблизо</p>
            </div>
          </a>
        </div>

        {/* Income Section */}
        {incomeStats && (
          <Card className="mb-8 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border-2 border-green-500/30 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <span className="text-2xl">💰</span>
                <span>Приходи</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Selected Month */}
                {incomeStats.monthlyIncome && incomeStats.monthlyIncome.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-4 rounded-lg border border-purple-400/30">
                    <div className="text-sm text-slate-300 mb-2">Избран месец</div>
                    <select
                      value={selectedMonth || incomeStats.monthlyIncome[0]?.month}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full mb-3 px-2 py-1 bg-slate-700 text-slate-200 rounded border border-purple-400/30 text-xs focus:outline-none focus:border-purple-400"
                    >
                      {incomeStats.monthlyIncome.map((m: any) => (
                        <option key={m.month} value={m.month}>
                          {new Date(m.month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const currentMonth = incomeStats.monthlyIncome.find((m: any) => m.month === (selectedMonth || incomeStats.monthlyIncome[0]?.month))
                      return (
                        <>
                          <div className="text-2xl font-bold text-purple-400">
                            {currentMonth?.total?.toFixed(2) || '0.00'} {incomeStats.summary?.currency || 'BGN'}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {currentMonth?.count || 0} заявки • Средно: {currentMonth?.average?.toFixed(2) || '0.00'} BGN
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}

                {/* Total Income */}
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-4 rounded-lg border border-green-400/30">
                  <div className="text-sm text-slate-300 mb-2">Общо приходи</div>
                  {availableYears.length > 0 && (
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full mb-3 px-2 py-1 bg-slate-700 text-slate-200 rounded border border-green-400/30 text-xs focus:outline-none focus:border-green-400"
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year} г.
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="text-2xl font-bold text-green-400">
                    {incomeStats.summary?.totalIncome?.toFixed(2) || '0.00'} {incomeStats.summary?.currency || 'BGN'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {incomeStats.summary?.incomeCount || 0} заявки • Средно: {incomeStats.summary?.averageIncome?.toFixed(2) || '0.00'} BGN
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              {incomeStats.paymentMethods && incomeStats.paymentMethods.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">По метод на плащане</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(() => {
                      const methodNames: { [key: string]: string } = {
                        'cash': '💵 Кеш',
                        'card': '💳 Карта',
                        'bank_transfer': '🏦 Банка',
                        'online': '🌐 Revolut',
                        'other': '📝 Друго'
                      }
                      const sortedMethods = [...incomeStats.paymentMethods].sort((a: any, b: any) => b.total - a.total)
                      return sortedMethods.map((pm: any) => (
                        <div
                          key={pm.method}
                          className="p-3 bg-slate-800/50 rounded-lg text-center border border-slate-700/50"
                        >
                          <div className="text-xs text-slate-400 mb-1">
                            {methodNames[pm.method] || pm.method}
                          </div>
                          <div className="text-sm font-bold text-slate-200">{pm.total?.toFixed(2)} BGN</div>
                          <div className="text-xs text-slate-500">{pm.count} заявки</div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}

              {/* Link to full income page */}
              <div className="mt-4 text-center">
                <a
                  href="/dashboard"
                  className="text-sm text-green-400 hover:text-green-300 transition-colors"
                >
                  Виж пълни детайли и изтегли отчет →
                </a>
              </div>
            </CardContent>
          </Card>
        )}

      </main>
      
      <Footer />
      <ChatWidget />
    </div>
  )
}