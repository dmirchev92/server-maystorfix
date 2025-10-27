'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import ChatWidget from '@/components/ChatWidget'
import { apiClient } from '@/lib/api'

interface DashboardStats {
  totalCases: number
  activeCases: number
  completedCases: number
  totalRevenue: number
  monthlyRevenue: number
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
      await apiClient.acceptCase(caseId, user!.id, `${user!.firstName} ${user!.lastName}`)
      alert('Заявката беше приета успешно!')
      loadDashboardData() // Reload data
    } catch (error) {
      console.error('Error accepting case:', error)
      alert('Грешка при приемане на заявката')
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

      // Calculate totals from status stats
      const totalCases = statusStats.reduce((sum: number, stat: any) => sum + (stat.count || 0), 0)
      const activeCases = statusStats.find((s: any) => s.status === 'wip')?.count || 0
      const completedCases = statusStats.find((s: any) => s.status === 'completed')?.count || 0

      const dashboardStats: DashboardStats = {
        totalCases,
        activeCases,
        completedCases,
        totalRevenue: 0, // Not tracked yet
        monthlyRevenue: 0, // Not tracked yet
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 relative overflow-hidden">
      {/* Industrial background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-br from-purple-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
      </div>

      <Header />
      
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Добре дошли, {user?.firstName}! 👋
          </h1>
          <p className="text-slate-300">
            Управлявайте вашите заявки и следете статистиките си
          </p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6 hover:bg-white/15 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-lg">📋</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-300">Общо заявки</p>
                  <p className="text-2xl font-bold text-white">{stats.totalCases}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6 hover:bg-white/15 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-green-400 text-lg">⚡</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-300">Активни</p>
                  <p className="text-2xl font-bold text-white">{stats.activeCases}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6 hover:bg-white/15 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-purple-400 text-lg">✅</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-300">Завършени</p>
                  <p className="text-2xl font-bold text-white">{stats.completedCases}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6 hover:bg-white/15 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-yellow-400 text-lg">⭐</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-300">Оценка</p>
                  <p className="text-2xl font-bold text-white">{stats.averageRating.toFixed(1)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6 hover:bg-white/15 transition-all">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-orange-400 text-lg">💬</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-300">Отзиви</p>
                  <p className="text-2xl font-bold text-white">{stats.totalReviews}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Recent Cases */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Последни заявки</h2>
                <a
                  href="/dashboard?view=assigned"
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
                >
                  Виж всички →
                </a>
              </div>
              
              {recentCases.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-slate-300 mb-4">Няма активни заявки</p>
                  <p className="text-sm text-slate-400">Новите заявки ще се появят тук</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentCases.map((case_) => (
                    <div key={case_.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-indigo-500/50 hover:bg-slate-800/70 transition-all duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-white text-sm">{case_.title}</h3>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${getStatusColor(case_.status)}`}>
                            {getStatusLabel(case_.status)}
                          </span>
                          <span className={`text-xs font-medium ${getUrgencyColor(case_.urgency)}`}>
                            {case_.urgency === 'urgent' ? '🔥' : '📅'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span className="flex items-center">
                          <span className="mr-1">👤</span>
                          {case_.customerName}
                        </span>
                        <span>{new Date(case_.createdAt).toLocaleDateString('bg-BG')}</span>
                      </div>
                      
                      <div className="mt-3 flex space-x-2">
                        {case_.status === 'pending' && (
                          <button 
                            onClick={() => handleAcceptCase(case_.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                          >
                            ✅ Приеми
                          </button>
                        )}
                        {(case_.status === 'active' || case_.status === 'accepted' || case_.status === 'wip') && (
                          <button 
                            onClick={() => handleCompleteCase(case_.id)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                          >
                            🏁 Завърши
                          </button>
                        )}
                        <a
                          href={`/dashboard?view=assigned`}
                          className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 inline-block"
                        >
                          📋 Виж всички
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6 mb-6">
              <h2 className="text-xl font-semibold text-white mb-4">Бързи действия</h2>
              
              <div className="space-y-3">
                <a
                  href="/dashboard?view=assigned"
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 px-4 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 text-sm font-medium flex items-center justify-center space-x-2"
                >
                  <span>📋</span>
                  <span>Управление на заявки</span>
                </a>
                
                <a
                  href="/settings?section=profile"
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2 px-4 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 text-sm font-medium flex items-center justify-center space-x-2"
                >
                  <span>👤</span>
                  <span>Редактирай профил</span>
                </a>
                
                <a
                  href="/referrals"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 text-sm font-medium flex items-center justify-center space-x-2"
                >
                  <span>🤝</span>
                  <span>Препоръки</span>
                </a>
                
                <a
                  href="/provider/analytics"
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-white py-2 px-4 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 text-sm font-medium flex items-center justify-center space-x-2"
                >
                  <span>📊</span>
                  <span>Статистики</span>
                </a>
              </div>
            </div>

            {/* Profile Summary */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Профил</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-slate-400">Име:</span>
                  <span className="font-semibold text-white">{user?.firstName} {user?.lastName}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-slate-400">Имейл:</span>
                  <span className="font-semibold text-white text-xs">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-slate-400">Роля:</span>
                  <span className="font-semibold text-indigo-400">Доставчик на услуги</span>
                </div>
                {stats && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-slate-400">Оценка:</span>
                      <span className="font-semibold text-yellow-400">{stats.averageRating.toFixed(1)} ⭐</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-slate-400">Отзиви:</span>
                      <span className="font-semibold text-white">{stats.totalReviews}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
      <ChatWidget />
    </div>
  )
}