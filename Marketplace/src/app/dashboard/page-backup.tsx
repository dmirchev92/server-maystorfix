'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge, RatingBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Header } from '@/components/Header'
import IncomeCompletionModal from '@/components/IncomeCompletionModal'

interface Case {
  id: string
  service_type: string
  description: string
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled' | 'wip' | 'closed'
  category: string
  priority: string
  address: string
  phone: string
  preferred_date: string
  preferred_time: string
  provider_id?: string
  provider_name?: string
  customer_id?: string
  created_at: string
  updated_at: string
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    viewMode: 'available', // 'available' or 'assigned'
    page: 1,
    limit: 10
  })
  const [completionModal, setCompletionModal] = useState<{ isOpen: boolean; caseId: string; caseTitle: string }>({ isOpen: false, caseId: '', caseTitle: '' })
  const [incomeStats, setIncomeStats] = useState<any>(null)
  const [paymentDetailsModal, setPaymentDetailsModal] = useState<{ isOpen: boolean; method: string; transactions: any[] }>({ isOpen: false, method: '', transactions: [] })
  const [monthDetailsModal, setMonthDetailsModal] = useState<{ isOpen: boolean; month: string; transactions: any[] }>({ isOpen: false, month: '', transactions: [] })
  const [showDecemberWarning, setShowDecemberWarning] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [showAllMonths, setShowAllMonths] = useState(false)
  
  // Prevent duplicate requests
  const fetchingRef = useRef(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
      return
    }
    
    // Check if user is a service provider - dashboard is only for SPs
    if (!isLoading && isAuthenticated && user && user.role !== 'service_provider' && user.role !== 'tradesperson') {
      console.log('❌ User is not a service provider, redirecting to home. Role:', user.role)
      router.push('/')
      return
    }
  }, [isAuthenticated, isLoading, user, router])

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchCases()
      fetchStats()
      fetchIncomeStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, filters.status, filters.category, filters.viewMode, filters.page])

  const fetchCases = async () => {
    // Prevent duplicate requests
    if (fetchingRef.current) {
      console.log('⏭️ Skipping duplicate fetchCases request')
      return
    }
    
    try {
      fetchingRef.current = true
      setLoading(true)
      let filterParams: any = {
        status: filters.status,
        category: filters.category,
        page: filters.page,
        limit: filters.limit,
      }

      if (user?.role === 'tradesperson' || user?.role === 'service_provider') {
        if (filters.viewMode === 'assigned') {
          // Show only cases assigned to me
          filterParams.providerId = user.id
        } else {
          // For available cases, show all unassigned cases (not just created by me)
          filterParams.onlyUnassigned = 'true' // Show cases without provider_id
          // Remove the createdByUserId filter to show ALL unassigned cases
          // filterParams.createdByUserId = user.id // REMOVED - this was limiting to own cases
        }
      } else {
        // For customers, show their own cases
        filterParams.customerId = user?.id
      }
      
      console.log('🔍 Dashboard - User:', user)
      console.log('🔍 Dashboard - Filter params:', filterParams)
      
      const response = await apiClient.getCasesWithFilters(filterParams)
      console.log('🔍 Dashboard - API response:', response.data)
      if (response.data?.success) {
        const cases = response.data.data.cases || []
        console.log('🔍 Dashboard - Cases found:', cases.length, cases)
        
        // Debug: Show status values of all cases
        cases.forEach((caseItem: any, index: number) => {
          console.log(`🔍 Dashboard - Case ${index + 1}: ID=${caseItem.id}, Status="${caseItem.status}", Title="${caseItem.title || caseItem.description?.substring(0, 30)}"`)
        })
        
        setCases(cases)
      } else {
        console.error('🔍 Dashboard - API response not successful:', response.data)
        setCases([])
      }
    } catch (error) {
      console.error('Error fetching cases:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  const fetchStats = async () => {
    try {
      const response = await apiClient.getCaseStats(
        user?.role === 'tradesperson' || user?.role === 'service_provider' ? user.id : undefined
      )
      if (response.data?.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchIncomeStats = async () => {
    try {
      if (user?.role === 'tradesperson' || user?.role === 'service_provider') {
        const response = await apiClient.getIncomeStats(user.id)
        if (response.data?.success) {
          setIncomeStats(response.data.data)
          
          // Check if it's December and show warning
          const currentMonth = new Date().getMonth()
          if (currentMonth === 11) { // December is month 11 (0-indexed)
            setShowDecemberWarning(true)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching income stats:', error)
    }
  }

  const downloadIncomeReport = () => {
    if (!incomeStats) return

    // Create CSV content with BOM for proper UTF-8 encoding
    let csvContent = "data:text/csv;charset=utf-8,%EF%BB%BF"
    
    // Overall Summary
    csvContent += "=== ОБЩ ОТЧЕТ ЗА ПРИХОДИ ===\\n\\n"
    csvContent += `Общо приходи:,${incomeStats.summary?.totalIncome?.toFixed(2)} BGN\\n`
    csvContent += `Брой заявки:,${incomeStats.summary?.incomeCount}\\n`
    csvContent += `Средно на заявка:,${incomeStats.summary?.averageIncome?.toFixed(2)} BGN\\n\\n`
    
    // Monthly Breakdown with Details
    csvContent += "=== МЕСЕЧНА РАЗБИВКА ===\\n\\n"
    incomeStats.monthlyIncome?.forEach((month: any) => {
      const monthName = new Date(month.month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
      csvContent += `--- ${monthName} ---\\n`
      csvContent += `Общо приходи:,${month.total?.toFixed(2)} BGN\\n`
      csvContent += `Брой заявки:,${month.count}\\n`
      csvContent += `Средно на заявка:,${month.average?.toFixed(2)} BGN\\n\\n`
    })
    
    // Summary Table
    csvContent += "=== ОБОБЩЕНА ТАБЛИЦА ===\\n"
    csvContent += "Месец,Общо приходи (BGN),Брой заявки,Средно (BGN)\\n"
    incomeStats.monthlyIncome?.forEach((month: any) => {
      const monthName = new Date(month.month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
      csvContent += `${monthName},${month.total?.toFixed(2)},${month.count},${month.average?.toFixed(2)}\\n`
    })
    
    // Payment Methods
    csvContent += "\\n=== ПО МЕТОД НА ПЛАЩАНЕ ===\\n"
    csvContent += "Метод,Общо приходи (BGN),Брой заявки,Средно (BGN)\\n"
    incomeStats.paymentMethods?.forEach((pm: any) => {
      const avgPerMethod = pm.count > 0 ? (pm.total / pm.count).toFixed(2) : '0.00'
      csvContent += `${pm.method},${pm.total?.toFixed(2)},${pm.count},${avgPerMethod}\\n`
    })

    // Create download link
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `income_report_${new Date().getFullYear()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePaymentMethodClick = async (paymentMethod: string) => {
    try {
      const response = await apiClient.getIncomeTransactionsByMethod(user!.id, paymentMethod)
      if (response.data?.success) {
        setPaymentDetailsModal({
          isOpen: true,
          method: paymentMethod,
          transactions: response.data.data || []
        })
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      alert('Възникна грешка при зареждането на транзакциите')
    }
  }

  const handleMonthClick = async (month: string) => {
    try {
      const response = await apiClient.getIncomeTransactionsByMonth(user!.id, month)
      if (response.data?.success) {
        setMonthDetailsModal({
          isOpen: true,
          month: month,
          transactions: response.data.data || []
        })
      }
    } catch (error) {
      console.error('Error fetching month transactions:', error)
      alert('Възникна грешка при зареждането на транзакциите')
    }
  }

  const handleCompleteCase = async (data: { completionNotes: string; income?: any }) => {
    try {
      const response = await apiClient.completeCase(completionModal.caseId, data.completionNotes, data.income)
      
      if (response.data?.success) {
        alert('Заявката беше завършена успешно!')
        setCompletionModal({ isOpen: false, caseId: '', caseTitle: '' })
        
        // Refresh data
        setTimeout(() => {
          fetchCases()
          fetchStats()
          fetchIncomeStats()
        }, 500)
      }
    } catch (error) {
      console.error('Error completing case:', error)
      alert('Възникна грешка при завършването на заявката')
    }
  }

  const handleStatusChange = async (caseId: string, newStatus: string) => {
    try {
      console.log('🔄 Dashboard - Updating case status:', caseId, 'to', newStatus)
      
      if (newStatus === 'accepted') {
        await apiClient.acceptCase(caseId, user!.id, `${user!.firstName} ${user!.lastName}`)
        alert('Заявката беше приета успешно!')
      } else if (newStatus === 'declined') {
        await apiClient.assignCase(caseId, 'decline', 'Declined by provider')
        alert('Заявката беше отказана успешно!')
      } else if (newStatus === 'completed') {
        // Open the income completion modal instead of directly completing
        const caseToComplete = cases.find(c => c.id === caseId)
        if (caseToComplete) {
          setCompletionModal({
            isOpen: true,
            caseId: caseId,
            caseTitle: caseToComplete.description || caseToComplete.service_type
          })
          return // Don't refresh yet, wait for modal completion
        }
      }
      
      console.log('🔄 Dashboard - Refreshing cases after status change...')
      // Add small delay to ensure backend has updated
      setTimeout(() => {
        fetchCases()
        fetchStats()
      }, 500)
      
    } catch (error) {
      console.error('Error updating case status:', error)
      alert('Възникна грешка при обновяването на статуса')
    }
  }

  const toggleCaseExpansion = (caseId: string) => {
    setExpandedCases(prev => {
      const newSet = new Set(prev)
      if (newSet.has(caseId)) {
        newSet.delete(caseId)
      } else {
        newSet.add(caseId)
      }
      return newSet
    })
  }


  const getStatusBadge = (status: string) => {
    const badges = {
      open: 'bg-green-100 text-green-800',
      wip: 'bg-yellow-100 text-yellow-800', 
      closed: 'bg-gray-100 text-gray-800'
    }
    const labels = {
      open: 'Отворена',
      wip: 'В процес',
      closed: 'Затворена'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const getCategoryDisplayName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      'electrician': 'Електротехник',
      'plumber': 'Водопроводчик',
      'hvac': 'Климатик',
      'carpenter': 'Дърводелец',
      'painter': 'Бояджия',
      'locksmith': 'Ключар',
      'cleaner': 'Почистване',
      'gardener': 'Градинар',
      'handyman': 'Майстор за всичко',
      'appliance_repair': 'Ремонт на уреди',
      'general': 'Общи'
    }
    return categoryNames[category] || category
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white/30 mx-auto"></div>
          <p className="mt-4 text-slate-200">Зареждане...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Управление на заявки
          </h1>
          <p className="text-slate-300">
            {user.role === 'customer' ? 'Вашите заявки за услуги' : 'Заявки за вашите услуги'}
          </p>
        </div>

        {/* Income Statistics Card - Moved to Top */}
        {incomeStats && (
          <Card className="mb-6 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border-2 border-green-500/30 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <span className="text-2xl">💰</span>
                  <span>Приходи</span>
                </CardTitle>
                <button
                  onClick={downloadIncomeReport}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <span>📥</span>
                  <span>Изтегли отчет</span>
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {/* December Warning Banner */}
              {showDecemberWarning && (
                <div className="mb-6 bg-gradient-to-r from-orange-500/20 to-red-500/20 border-2 border-orange-400/50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <h4 className="text-orange-300 font-bold mb-1">Внимание: Край на годината</h4>
                      <p className="text-slate-300 text-sm mb-3">
                        Всички данни за приходите ще бъдат изтрити на 1 януари. Моля изтеглете вашия годишен отчет преди края на декември.
                      </p>
                      <button
                        onClick={downloadIncomeReport}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        📥 Изтегли годишен отчет сега
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Selected Month - FIRST */}
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

                {/* Total Income - SECOND */}
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-4 rounded-lg border border-green-400/30">
                  <div className="text-sm text-slate-300 mb-1">Общо приходи</div>
                  <div className="text-2xl font-bold text-green-400">
                    {incomeStats.summary?.totalIncome?.toFixed(2) || '0.00'} {incomeStats.summary?.currency || 'BGN'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {incomeStats.summary?.incomeCount || 0} заявки • Средно: {incomeStats.summary?.averageIncome?.toFixed(2) || '0.00'} BGN
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown */}
              {incomeStats.monthlyIncome && incomeStats.monthlyIncome.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-300">Месечна разбивка</h4>
                    {incomeStats.monthlyIncome.length > 1 && (
                      <select
                        value={showAllMonths ? 'all' : 'current'}
                        onChange={(e) => setShowAllMonths(e.target.value === 'all')}
                        className="px-3 py-1 bg-slate-700 text-slate-200 rounded border border-slate-600 text-xs focus:outline-none focus:border-green-500"
                      >
                        <option value="current">Текущ месец</option>
                        <option value="all">Всички месеци ({incomeStats.monthlyIncome.length})</option>
                      </select>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {(showAllMonths ? incomeStats.monthlyIncome.slice(0, 12) : incomeStats.monthlyIncome.slice(0, 1)).map((month: any) => (
                      <button
                        key={month.month}
                        onClick={() => handleMonthClick(month.month)}
                        className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700/50 hover:border-green-500/50 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-300 group-hover:text-green-300 transition-colors">
                            {new Date(month.month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                            {month.count} заявки
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-green-400 group-hover:text-green-300 transition-colors">
                            {month.total?.toFixed(2)} BGN
                          </span>
                          <span className="text-xs text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            👆
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              {incomeStats.paymentMethods && incomeStats.paymentMethods.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">По метод на плащане (кликнете за детайли)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(() => {
                      // Payment method display names
                      const methodNames: { [key: string]: string } = {
                        'cash': '💵 Кеш',
                        'card': '💳 Картово плащане',
                        'bank_transfer': '🏦 Банков път',
                        'online': '🌐 Revolut',
                        'other': '📝 Друго'
                      }
                      
                      // Sort by total amount (highest first)
                      const sortedMethods = [...incomeStats.paymentMethods].sort((a, b) => b.total - a.total)
                      
                      return sortedMethods.map((pm: any) => (
                        <button
                          key={pm.method}
                          onClick={() => handlePaymentMethodClick(pm.method)}
                          className="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-center border border-slate-700/50 hover:border-green-500/50 transition-all cursor-pointer group"
                        >
                          <div className="text-xs text-slate-400 group-hover:text-green-400 mb-1 transition-colors">
                            {methodNames[pm.method] || pm.method}
                          </div>
                          <div className="text-sm font-bold text-slate-200 group-hover:text-green-300 transition-colors">{pm.total?.toFixed(2)} BGN</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">{pm.count} заявки</div>
                          <div className="text-xs text-green-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                            👆 Виж детайли
                          </div>
                        </button>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* View Mode Toggle - Prominent for Service Providers */}
        {(user?.role === 'tradesperson' || user?.role === 'service_provider') && (
          <div className="flex items-center justify-center space-x-4 mb-8">
            <button
              onClick={() => setFilters({...filters, viewMode: 'available', status: '', page: 1})}
              className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
                filters.viewMode === 'available'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/20'
              }`}
            >
              📋 Налични заявки
            </button>
            <button
              onClick={() => setFilters({...filters, viewMode: 'assigned', status: '', page: 1})}
              className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
                filters.viewMode === 'assigned'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/20'
              }`}
            >
              ✅ Моите заявки
            </button>
          </div>
        )}

        {/* Stats Cards - Clickable */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {/* Available Cases */}
            <button
              onClick={() => setFilters({...filters, viewMode: 'available', status: '', page: 1})}
              className="text-left"
            >
              <Card variant="elevated" hover padding="lg" className="group cursor-pointer h-full">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-300 mb-2">
                        Налични заявки
                      </p>
                      <p className="text-3xl font-bold text-white">
                        {stats.available || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl transition-all duration-300 group-hover:scale-110 bg-gradient-to-br from-green-500/20 to-green-400/20 border border-green-400/30">
                      <span className="text-3xl">📋</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>

            {/* Accepted Cases */}
            <button
              onClick={() => setFilters({...filters, viewMode: 'assigned', status: 'accepted', page: 1})}
              className="text-left"
            >
              <Card variant="elevated" hover padding="lg" className="group cursor-pointer h-full">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-300 mb-2">
                        Приети
                      </p>
                      <p className="text-3xl font-bold text-white">
                        {stats.accepted || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl transition-all duration-300 group-hover:scale-110 bg-gradient-to-br from-blue-500/20 to-blue-400/20 border border-blue-400/30">
                      <span className="text-3xl">✅</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>

            {/* WIP Cases */}
            <button
              onClick={() => setFilters({...filters, viewMode: 'assigned', status: 'wip', page: 1})}
              className="text-left"
            >
              <Card variant="elevated" hover padding="lg" className="group cursor-pointer h-full">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-300 mb-2">
                        В процес
                      </p>
                      <p className="text-3xl font-bold text-white">
                        {stats.wip || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl transition-all duration-300 group-hover:scale-110 bg-gradient-to-br from-yellow-500/20 to-yellow-400/20 border border-yellow-400/30">
                      <span className="text-3xl">⚡</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>

            {/* Completed Cases */}
            <button
              onClick={() => setFilters({...filters, viewMode: 'assigned', status: 'completed', page: 1})}
              className="text-left"
            >
              <Card variant="elevated" hover padding="lg" className="group cursor-pointer h-full">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-300 mb-2">
                        Завършени
                      </p>
                      <p className="text-3xl font-bold text-white">
                        {stats.completed || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl transition-all duration-300 group-hover:scale-110 bg-gradient-to-br from-purple-500/20 to-purple-400/20 border border-purple-400/30">
                      <span className="text-3xl">🏁</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          </div>
        )}

        {/* Filters */}
        <Card variant="elevated" padding="lg" className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🔍</span>
              Допълнителни филтри
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status Filter - Only show when viewing assigned cases */}
              {(user?.role === 'tradesperson' || user?.role === 'service_provider') && filters.viewMode === 'assigned' && (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-3">
                    Статус
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
                    className="w-full px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200 bg-white/10 text-white hover:border-white/30 backdrop-blur-sm [&>option]:bg-slate-800 [&>option]:text-white"
                  >
                    <option value="" className="bg-slate-800 text-white">Всички статуси</option>
                    <option value="pending" className="bg-slate-800 text-white">🆕 Нови</option>
                    <option value="accepted" className="bg-slate-800 text-white">✅ Приети</option>
                    <option value="declined" className="bg-slate-800 text-white">❌ Отказани</option>
                    <option value="completed" className="bg-slate-800 text-white">🏁 Завършени</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-3">
                  Категория
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value, page: 1})}
                  className="w-full px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200 bg-white/10 text-white hover:border-white/30 backdrop-blur-sm [&>option]:bg-slate-800 [&>option]:text-white"
                >
                  <option value="" className="bg-slate-800 text-white">Всички категории</option>
                  <option value="electrician" className="bg-slate-800 text-white">⚡ Електротехник</option>
                  <option value="plumber" className="bg-slate-800 text-white">🔧 Водопроводчик</option>
                  <option value="hvac" className="bg-slate-800 text-white">❄️ Климатик</option>
                  <option value="carpenter" className="bg-slate-800 text-white">🪚 Дърводелец</option>
                  <option value="painter" className="bg-slate-800 text-white">🎨 Бояджия</option>
                  <option value="locksmith" className="bg-slate-800 text-white">🔐 Ключар</option>
                  <option value="cleaner" className="bg-slate-800 text-white">🧹 Почистване</option>
                  <option value="gardener" className="bg-slate-800 text-white">🌱 Градинар</option>
                  <option value="handyman" className="bg-slate-800 text-white">🔨 Майстор за всичко</option>
                  <option value="appliance_repair" className="bg-slate-800 text-white">🔧 Ремонт на уреди</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <Button
                  variant="construction"
                  size="lg"
                  className="w-full"
                  leftIcon={<span>➕</span>}
                  onClick={() => router.push('/create-case')}
                >
                  Нова заявка
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cases List */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📋</span>
              Заявки за услуги
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white/60 mx-auto mb-4"></div>
                <p className="text-slate-300 font-medium">Зареждане на заявки...</p>
              </div>
            ) : cases.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-slate-300 text-lg mb-4">Няма намерени заявки</p>
                <Button
                  variant="construction"
                  onClick={() => router.push('/create-case')}
                  leftIcon={<span>➕</span>}
                >
                  Създай първата си заявка
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {cases.map((case_) => (
                  <Card 
                    key={case_.id} 
                    variant="outline" 
                    hover 
                    padding="lg" 
                    className="group cursor-pointer"
                    onClick={() => toggleCaseExpansion(case_.id)}
                  >
                    <CardContent>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-gradient-to-br from-white/10 to-white/20 border border-white/20 rounded-xl flex items-center justify-center">
                                <span className="text-xl">
                                  {case_.category === 'electrician' ? '⚡' :
                                   case_.category === 'plumber' ? '🔧' :
                                   case_.category === 'hvac' ? '❄️' :
                                   case_.category === 'carpenter' ? '🪚' :
                                   case_.category === 'painter' ? '🎨' :
                                   case_.category === 'locksmith' ? '🔐' :
                                   case_.category === 'cleaner' ? '🧹' :
                                   case_.category === 'gardener' ? '🌱' :
                                   case_.category === 'handyman' ? '🔨' : '🔧'}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-semibold text-white group-hover:text-slate-200 transition-colors duration-200">
                                  {expandedCases.has(case_.id) ? case_.description : `${case_.description.substring(0, 80)}...`}
                                </h3>
                                <span className="text-slate-500 transition-colors">
                                  {expandedCases.has(case_.id) ? '▼' : '▶'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-300 mb-3">
                                <span className="flex items-center gap-1">
                                  📍 {case_.address}
                                </span>
                                <span className="flex items-center gap-1">
                                  📅 {new Date(case_.created_at).toLocaleDateString('bg-BG')}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <StatusBadge status={case_.status as any} />
                                <Badge variant="primary" className="text-white">
                                  {getCategoryDisplayName(case_.category)}
                                </Badge>
                                
                                {/* Assignment Status Badge */}
                                {case_.provider_id === user?.id ? (
                                  <Badge variant="success">
                                    ✅ Възложена на мен
                                  </Badge>
                                ) : case_.provider_id && case_.provider_id !== user?.id ? (
                                  <Badge variant="outline">
                                    👤 Възложена на {case_.provider_name || 'друг изпълнител'}
                                  </Badge>
                                ) : !case_.provider_id && filters.viewMode === 'available' ? (
                                  <Badge variant="construction">
                                    🟢 Отворена за поемане
                                  </Badge>
                                ) : case_.customer_id === user?.id ? (
                                  <Badge variant="info">
                                    📝 Моя заявка
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    🆕 Нова заявка
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Expanded Details */}
                              {expandedCases.has(case_.id) && (
                                <div className="mt-4 p-4 bg-white/5 rounded-lg border-l-4 border-blue-400/60 backdrop-blur-sm">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="font-semibold text-slate-200">Телефон:</span>
                                      <span className="ml-2 text-slate-300">{case_.phone}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-200">Приоритет:</span>
                                      <span className="ml-2 text-slate-300">{case_.priority}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-200">Предпочитана дата:</span>
                                      <span className="ml-2 text-slate-300">{case_.preferred_date}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-200">Предпочитано време:</span>
                                      <span className="ml-2 text-slate-300">{case_.preferred_time}</span>
                                    </div>
                                    <div className="md:col-span-2">
                                      <span className="font-semibold text-slate-200">Пълно описание:</span>
                                      <p className="mt-1 text-slate-300">{case_.description}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          {user?.role === 'tradesperson' || user?.role === 'service_provider' ? (
                            <div className="flex gap-2">
                              {case_.status === 'pending' && (
                                <>
                                  <Button
                                    variant="construction"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleStatusChange(case_.id, 'accepted')
                                    }}
                                    leftIcon={<span>✅</span>}
                                  >
                                    Приеми
                                  </Button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleStatusChange(case_.id, 'declined')
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 border-2 border-red-500 text-white hover:bg-red-700 hover:border-red-600 transition-all duration-200"
                                  >
                                    <span className="text-red-800 drop-shadow-lg" style={{textShadow: '0 0 4px rgba(255,255,255,1), 1px 1px 2px rgba(255,255,255,1), -1px -1px 2px rgba(255,255,255,1), 0px 1px 0px rgba(255,255,255,1), 0px -1px 0px rgba(255,255,255,1), 1px 0px 0px rgba(255,255,255,1), -1px 0px 0px rgba(255,255,255,1)'}}>❌</span>
                                    Откажи
                                  </button>
                                </>
                              )}
                              {case_.status === 'accepted' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStatusChange(case_.id, 'completed')
                                  }}
                                  leftIcon={<span>🏁</span>}
                                >
                                  Завърши
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="text-right">
                              <p className="text-sm text-slate-300 mb-1">Изпълнител:</p>
                              <div className="flex items-center gap-2">
                                {case_.provider_name ? (
                                  <>
                                    <Avatar name={case_.provider_name} size="sm" />
                                    <span className="text-sm font-medium text-white">
                                      {case_.provider_name}
                                    </span>
                                  </>
                                ) : (
                                  <Badge variant="outline">Изчаква</Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Income Completion Modal */}
      <IncomeCompletionModal
        isOpen={completionModal.isOpen}
        onClose={() => setCompletionModal({ isOpen: false, caseId: '', caseTitle: '' })}
        onComplete={handleCompleteCase}
        caseTitle={completionModal.caseTitle}
      />

      {/* Payment Details Modal */}
      {paymentDetailsModal.isOpen && (
        <PaymentDetailsModal
          method={paymentDetailsModal.method}
          transactions={paymentDetailsModal.transactions}
          onClose={() => setPaymentDetailsModal({ isOpen: false, method: '', transactions: [] })}
          onTransactionUpdated={() => {
            fetchIncomeStats()
            setPaymentDetailsModal({ isOpen: false, method: '', transactions: [] })
          }}
        />
      )}

      {/* Month Details Modal */}
      {monthDetailsModal.isOpen && (
        <MonthDetailsModal
          month={monthDetailsModal.month}
          transactions={monthDetailsModal.transactions}
          onClose={() => setMonthDetailsModal({ isOpen: false, month: '', transactions: [] })}
          onTransactionUpdated={() => {
            fetchIncomeStats()
            setMonthDetailsModal({ isOpen: false, month: '', transactions: [] })
          }}
        />
      )}
    </div>
  )
}

// Payment Details Modal Component
function PaymentDetailsModal({ method, transactions, onClose, onTransactionUpdated }: {
  method: string
  transactions: any[]
  onClose: () => void
  onTransactionUpdated: () => void
}) {
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [editForm, setEditForm] = useState({ amount: '', paymentMethod: '', notes: '' })

  const handleEditClick = (transaction: any) => {
    setEditingTransaction(transaction)
    setEditForm({
      amount: transaction.amount.toString(),
      paymentMethod: transaction.payment_method || '',
      notes: transaction.notes || ''
    })
  }

  const handleSaveEdit = async () => {
    try {
      await apiClient.updateIncomeTransaction(editingTransaction.id, {
        amount: parseFloat(editForm.amount),
        paymentMethod: editForm.paymentMethod,
        notes: editForm.notes
      })
      alert('Транзакцията беше обновена успешно!')
      setEditingTransaction(null)
      onTransactionUpdated()
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Възникна грешка при обновяването')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-lg sticky top-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">💳 Транзакции: {method}</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
          <p className="text-green-100 mt-1">{transactions.length} транзакции</p>
        </div>

        {/* Transactions List */}
        <div className="p-6 space-y-4">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-slate-700/50 border border-slate-600 rounded-lg p-4"
            >
              {editingTransaction?.id === transaction.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Сума (BGN)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Метод на плащане</label>
                      <select
                        value={editForm.paymentMethod}
                        onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                      >
                        <option value="cash">💵 Кеш</option>
                        <option value="card">💳 Картово плащане</option>
                        <option value="bank_transfer">🏦 Банков път</option>
                        <option value="online">🌐 Revolut</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Бележки</label>
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                        placeholder="Допълнителни бележки..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                    >
                      ✅ Запази
                    </button>
                    <button
                      onClick={() => setEditingTransaction(null)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                    >
                      ✕ Отказ
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-2xl font-bold text-green-400">
                        {transaction.amount.toFixed(2)} BGN
                      </span>
                      <span className="text-sm text-slate-400">
                        {new Date(transaction.recorded_at).toLocaleDateString('bg-BG', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {transaction.case_description && (
                      <p className="text-sm text-slate-300 mb-1">
                        📋 {transaction.case_description}
                      </p>
                    )}
                    {transaction.notes && (
                      <p className="text-xs text-slate-400">
                        💬 {transaction.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleEditClick(transaction)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm"
                  >
                    ✏️ Редактирай
                  </button>
                </div>
              )}
            </div>
          ))}

          {transactions.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p>Няма транзакции за този метод на плащане</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Month Details Modal Component (same as Payment Details but for months)
function MonthDetailsModal({ month, transactions, onClose, onTransactionUpdated }: {
  month: string
  transactions: any[]
  onClose: () => void
  onTransactionUpdated: () => void
}) {
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [editForm, setEditForm] = useState({ amount: '', paymentMethod: '', notes: '' })

  const handleEditClick = (transaction: any) => {
    setEditingTransaction(transaction)
    setEditForm({
      amount: transaction.amount.toString(),
      paymentMethod: transaction.payment_method || '',
      notes: transaction.notes || ''
    })
  }

  const handleSaveEdit = async () => {
    try {
      await apiClient.updateIncomeTransaction(editingTransaction.id, {
        amount: parseFloat(editForm.amount),
        paymentMethod: editForm.paymentMethod,
        notes: editForm.notes
      })
      alert('Транзакцията беше обновена успешно!')
      setEditingTransaction(null)
      onTransactionUpdated()
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Възникна грешка при обновяването')
    }
  }

  const monthName = new Date(month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-lg sticky top-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">📅 {monthName}</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
          <p className="text-purple-100 mt-1">{transactions.length} транзакции</p>
        </div>

        {/* Transactions List */}
        <div className="p-6 space-y-4">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-slate-700/50 border border-slate-600 rounded-lg p-4"
            >
              {editingTransaction?.id === transaction.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Сума (BGN)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Метод на плащане</label>
                      <select
                        value={editForm.paymentMethod}
                        onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                      >
                        <option value="cash">💵 Кеш</option>
                        <option value="card">💳 Картово плащане</option>
                        <option value="bank_transfer">🏦 Банков път</option>
                        <option value="online">🌐 Revolut</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Бележки</label>
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                        placeholder="Допълнителни бележки..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                    >
                      ✅ Запази
                    </button>
                    <button
                      onClick={() => setEditingTransaction(null)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                    >
                      ✕ Отказ
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-2xl font-bold text-green-400">
                        {transaction.amount.toFixed(2)} BGN
                      </span>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                        {transaction.payment_method || 'Неуточнен'}
                      </span>
                      <span className="text-sm text-slate-400">
                        {new Date(transaction.recorded_at).toLocaleDateString('bg-BG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {transaction.case_description && (
                      <p className="text-sm text-slate-300 mb-1">
                        📋 {transaction.case_description}
                      </p>
                    )}
                    {transaction.notes && (
                      <p className="text-xs text-slate-400">
                        💬 {transaction.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleEditClick(transaction)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm"
                  >
                    ✏️ Редактирай
                  </button>
                </div>
              )}
            </div>
          ))}

          {transactions.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p>Няма транзакции за този месец</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
