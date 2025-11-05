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
import { sofiaNeighborhoods } from '@/components/NeighborhoodSelect'

interface Case {
  id: string
  service_type: string
  description: string
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled' | 'wip' | 'closed'
  category: string
  priority: string
  budget?: number
  city?: string
  neighborhood?: string
  address?: string
  phone: string
  preferred_date: string
  preferred_time: string
  provider_id?: string
  provider_name?: string
  customer_id?: string
  assignment_type?: 'open' | 'specific'
  bidding_enabled?: boolean
  current_bidders?: number
  max_bidders?: number
  bidding_closed?: boolean
  created_at: string
  updated_at: string
  winning_bid_id?: string
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
    city: '',
    neighborhood: '',
    viewMode: 'available', // 'available', 'assigned', or 'declined'
    page: 1,
    limit: 10
  })
  const [completionModal, setCompletionModal] = useState<{ isOpen: boolean; caseId: string; caseTitle: string }>({ isOpen: false, caseId: '', caseTitle: '' })
  const [biddingCases, setBiddingCases] = useState<Set<string>>(new Set()) // Cases currently being bid on
  const [pointsBalance, setPointsBalance] = useState<number>(0)
  const [myBids, setMyBids] = useState<Map<string, any>>(new Map()) // Map of caseId -> bid data
  
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
      fetchPointsBalance()
      fetchMyBids()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, filters.status, filters.category, filters.city, filters.neighborhood, filters.viewMode, filters.page])

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
        city: filters.city,
        neighborhood: filters.neighborhood,
        page: filters.page,
        limit: filters.limit,
      }

      if (user?.role === 'tradesperson' || user?.role === 'service_provider') {
        if (filters.viewMode === 'assigned') {
          // Show only cases assigned to me
          filterParams.providerId = user.id
        } else if (filters.viewMode === 'declined') {
          // Show cases I've declined - use special endpoint
          const response = await apiClient.getDeclinedCases(user.id)
          console.log('🚫 Dashboard - Declined cases response:', response.data)
          if (response.data?.success) {
            const cases = response.data.data || []
            console.log('🚫 Dashboard - Declined cases found:', cases.length, cases)
            setCases(cases)
          } else {
            console.error('🚫 Dashboard - API response not successful:', response.data)
            setCases([])
          }
          return // Exit early for declined view
        } else {
          // For available cases, show all unassigned cases (not just created by me)
          // BUT exclude cases I've declined
          filterParams.onlyUnassigned = 'true' // Show cases without provider_id
          filterParams.excludeDeclinedBy = user.id // Exclude cases declined by me
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
        }, 500)
      }
    } catch (error) {
      console.error('Error completing case:', error)
      alert('Възникна грешка при завършването на заявката')
    }
  }

  const handleUndecline = async (caseId: string) => {
    try {
      console.log('✅ Dashboard - Un-declining case:', caseId)
      await apiClient.undeclineCase(caseId, user!.id)
      alert('Заявката беше възстановена!')
      
      // Refresh cases
      setTimeout(() => {
        fetchCases()
        fetchStats()
      }, 500)
    } catch (error: any) {
      console.error('❌ Error un-declining case:', error)
      const errorMsg = error.response?.data?.error?.message || error.message || 'Възникна грешка'
      alert(`Грешка: ${errorMsg}`)
    }
  }

  const handleStatusChange = async (caseId: string, newStatus: string) => {
    try {
      console.log('🔄 Dashboard - Updating case status:', caseId, 'to', newStatus)
      
      if (newStatus === 'accepted') {
        await apiClient.acceptCase(caseId, user!.id, `${user!.firstName} ${user!.lastName}`)
        alert('Заявката беше приета успешно!')
      } else if (newStatus === 'declined') {
        console.log('🚫 Declining case:', caseId, 'by provider:', user!.id)
        const response = await apiClient.declineCase(caseId, user!.id, 'Declined by provider')
        console.log('🚫 Decline response:', response)
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
      
    } catch (error: any) {
      console.error('❌ Error updating case status:', error)
      console.error('❌ Error details:', error.response?.data || error.message)
      
      // Check if trial expired
      if (error.response?.data?.error?.code === 'TRIAL_EXPIRED') {
        const errorData = error.response.data.error
        const details = errorData.details || {}
        const message = `${errorData.message}\n\n${details.reason || ''}`
        
        if (confirm(`${message}\n\nИскате ли да видите абонаментните планове?`)) {
          router.push('/upgrade-required')
        }
      } else {
        const errorMsg = error.response?.data?.error?.message || error.message || 'Възникна грешка при обновяването на статуса'
        alert(`Грешка: ${errorMsg}`)
      }
    }
  }

  const handlePlaceBid = async (caseId: string, caseBudget: number) => {
    try {
      setBiddingCases(prev => new Set(prev).add(caseId))
      
      // First check if can bid
      const canBidResponse = await apiClient.canBidOnCase(caseId)
      
      if (!canBidResponse.data?.data?.allowed) {
        const reason = canBidResponse.data?.data?.reason || 'Cannot place bid'
        const requiredPoints = canBidResponse.data?.data?.required_points
        
        if (requiredPoints) {
          alert(`${reason}\n\nНеобходими точки: ${requiredPoints}\nВашите точки: ${pointsBalance}`)
        } else {
          alert(reason)
        }
        setBiddingCases(prev => {
          const newSet = new Set(prev)
          newSet.delete(caseId)
          return newSet
        })
        return
      }
      
      const requiredPoints = canBidResponse.data.data.required_points
      
      // Confirm bid
      if (!confirm(`Искате ли да наддавате за тази заявка?\n\nБюджет: ${caseBudget} BGN\nНеобходими точки: ${requiredPoints}\nВашите точки: ${pointsBalance}\n\nТочките ще бъдат временно резервирани.`)) {
        setBiddingCases(prev => {
          const newSet = new Set(prev)
          newSet.delete(caseId)
          return newSet
        })
        return
      }
      
      // Place bid
      const bidResponse = await apiClient.placeBid(caseId)
      
      if (bidResponse.data?.success) {
        const bidData = bidResponse.data.data
        alert(`✅ ${bidResponse.data.message}\n\nВие сте наддавач #${bidData.bid_order}\nИзползвани точки: ${bidData.points_spent}`)
        
        // Refresh cases, points, and bids
        fetchCases()
        fetchPointsBalance()
        fetchMyBids()
      }
      
    } catch (error: any) {
      console.error('❌ Error placing bid:', error)
      const errorMsg = error.response?.data?.error?.message || error.message || 'Възникна грешка при наддаването'
      alert(`Грешка: ${errorMsg}`)
    } finally {
      setBiddingCases(prev => {
        const newSet = new Set(prev)
        newSet.delete(caseId)
        return newSet
      })
    }
  }

  const fetchPointsBalance = async () => {
    try {
      const response = await apiClient.getPointsBalance()
      if (response.data?.success) {
        setPointsBalance(response.data.data.current_balance)
      }
    } catch (error) {
      console.error('Error fetching points balance:', error)
    }
  }

  const fetchMyBids = async () => {
    try {
      const response = await apiClient.getMyBids()
      console.log('🎯 My Bids Response:', response)
      
      if (response.data?.success) {
        const bids = response.data.data?.bids || []
        console.log('🎯 Bids array:', bids)
        
        // Create a map of caseId -> bid
        const bidsMap = new Map()
        bids.forEach((bid: any) => {
          console.log('🎯 Adding bid to map:', bid.case_id, bid)
          bidsMap.set(bid.case_id, bid)
        })
        console.log('🎯 Final bidsMap size:', bidsMap.size)
        setMyBids(bidsMap)
      } else {
        console.error('🎯 Failed to fetch bids:', response.data?.error)
      }
    } catch (error) {
      console.error('Error fetching my bids:', error)
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
      'electrician': 'Електричество',
      'plumber': 'Водопровод',
      'hvac': 'Климатик',
      'carpenter': 'Дърводелство',
      'painter': 'Боядисване',
      'locksmith': 'Ключарство',
      'cleaner': 'Почистване',
      'gardener': 'Градинарство',
      'handyman': 'Многопрофилен',
      'appliance_repair': 'Ремонти',
      'general': 'Общи'
    }
    return categoryNames[category] || category
  }

  // Calculate estimated points cost based on budget (approximation)
  const estimatePointsCost = (budget: number): string => {
    // This is an approximation - actual cost depends on user's tier
    // Free tier costs more, Pro tier costs less
    if (budget <= 500) return '10-20'
    if (budget <= 1000) return '20-40'
    if (budget <= 1500) return '30-60'
    if (budget <= 2000) return '40-80'
    if (budget <= 3000) return '60-120'
    if (budget <= 4000) return '80-160'
    if (budget <= 5000) return '100-200'
    return '100+'
  }

  // Check if case is "new" (created within last 24 hours)
  const isNewCase = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    return hoursDiff < 24 // New if less than 24 hours old
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Управление на заявки
            </h1>
            <p className="text-slate-300 text-lg">
              {user.role === 'customer' ? 'Вашите заявки за услуги' : 'Заявки за вашите услуги'}
            </p>
          </div>
          {/* Points Balance Display */}
          <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/40 rounded-xl px-6 py-4">
            <div className="text-center">
              <p className="text-sm text-slate-300 mb-1">Налични точки</p>
              <p className="text-3xl font-bold text-white">{pointsBalance}</p>
              <p className="text-xs text-slate-400 mt-1">за наддаване</p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle - Prominent for Service Providers */}
        {(user?.role === 'tradesperson' || user?.role === 'service_provider') && (
          <div className="flex items-center justify-center space-x-4 mb-8">
            <button
              onClick={() => setFilters({...filters, viewMode: 'available', status: '', page: 1})}
              className={`px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 transform hover:scale-105 ${
                filters.viewMode === 'available'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/20'
              }`}
            >
              📋 Налични заявки
            </button>
            <button
              onClick={() => setFilters({...filters, viewMode: 'assigned', status: '', page: 1})}
              className={`px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 transform hover:scale-105 ${
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

            {/* Declined Cases */}
            <button
              onClick={() => setFilters({...filters, viewMode: 'declined', status: '', page: 1})}
              className="text-left"
            >
              <Card variant="elevated" hover padding="lg" className="group cursor-pointer h-full">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-300 mb-2">
                        Отказани
                      </p>
                      <p className="text-3xl font-bold text-white">
                        {stats.declined || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl transition-all duration-300 group-hover:scale-110 bg-gradient-to-br from-red-500/20 to-red-400/20 border border-red-400/30">
                      <span className="text-3xl">🚫</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              
              {/* Category Filter */}
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

              {/* City Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-3">
                  Град
                </label>
                <select
                  value={filters.city}
                  onChange={(e) => setFilters({...filters, city: e.target.value, neighborhood: '', page: 1})}
                  className="w-full px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200 bg-white/10 text-white hover:border-white/30 backdrop-blur-sm [&>option]:bg-slate-800 [&>option]:text-white"
                >
                  <option value="" className="bg-slate-800 text-white">Всички градове</option>
                  <option value="София" className="bg-slate-800 text-white">🏙️ София</option>
                  <option value="Пловдив" className="bg-slate-800 text-white">🏙️ Пловдив</option>
                  <option value="Варна" className="bg-slate-800 text-white">🏙️ Варна</option>
                  <option value="Бургас" className="bg-slate-800 text-white">🏙️ Бургас</option>
                </select>
              </div>

              {/* Neighborhood Filter - Only show when Sofia is selected */}
              {filters.city === 'София' && (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-3">
                    Квартал
                  </label>
                  <select
                    value={filters.neighborhood}
                    onChange={(e) => setFilters({...filters, neighborhood: e.target.value, page: 1})}
                    className="w-full px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200 bg-white/10 text-white hover:border-white/30 backdrop-blur-sm [&>option]:bg-slate-800 [&>option]:text-white"
                  >
                    <option value="" className="bg-slate-800 text-white">Всички квартали</option>
                    {sofiaNeighborhoods.map((neighborhood) => (
                      <option key={neighborhood} value={neighborhood} className="bg-slate-800 text-white">
                        {neighborhood}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
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
                            <div className="flex-shrink-0 flex flex-col items-center gap-2">
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
                              {/* Category Badge - below icon */}
                              <div className="min-w-[96px] max-w-[120px] px-2 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs font-semibold text-center leading-tight break-words">
                                {getCategoryDisplayName(case_.category)}
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
                                  📍 {case_.city}{case_.neighborhood ? `, ${case_.neighborhood}` : ''}
                                </span>
                                <span className="flex items-center gap-1">
                                  📅 {new Date(case_.created_at).toLocaleDateString('bg-BG')}
                                </span>
                                {case_.budget && (
                                  <span className="flex items-center gap-1 font-semibold text-green-400">
                                    💰 {case_.budget} BGN
                                  </span>
                                )}
                                {case_.bidding_enabled && (
                                  <span className="flex items-center gap-1 text-blue-400">
                                    👥 {case_.current_bidders || 0}/{case_.max_bidders || 3} оферти
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <StatusBadge status={case_.status as any} />
                                
                                {/* Assignment Badge */}
                                {case_.provider_id === user?.id && case_.assignment_type === 'specific' && (
                                  <Badge variant="construction" className="animate-pulse">
                                    ⭐ Клиентът иска теб
                                  </Badge>
                                )}
                                {case_.provider_id && case_.provider_id !== user?.id && (
                                  <Badge variant="outline">
                                    👤 Възложена на {case_.provider_name || 'друг изпълнител'}
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
                              {/* Show bid button for pending cases with bidding enabled */}
                              {case_.status === 'pending' && case_.bidding_enabled && !case_.bidding_closed && case_.budget && (
                                <div className="flex flex-col gap-1">
                                  {(() => {
                                    const hasBid = myBids.has(case_.id)
                                    console.log(`🎯 Case ${case_.id}: hasBid=${hasBid}, myBids.size=${myBids.size}`)
                                    return hasBid
                                  })() ? (
                                    // Show "View My Bid" if user has already bid
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        router.push('/provider/my-bids')
                                      }}
                                      leftIcon={<span>👁️</span>}
                                      className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                                    >
                                      Виж моята оферта
                                    </Button>
                                  ) : (
                                    // Show "Bid" button if user hasn't bid yet
                                    <>
                                      <Button
                                        variant="construction"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handlePlaceBid(case_.id, case_.budget!)
                                        }}
                                        disabled={biddingCases.has(case_.id) || (case_.current_bidders || 0) >= (case_.max_bidders || 3)}
                                        leftIcon={<span>💰</span>}
                                      >
                                        {biddingCases.has(case_.id) ? 'Наддаване...' : 
                                         (case_.current_bidders || 0) >= (case_.max_bidders || 3) ? 'Пълно' : 
                                         'Наддай'}
                                      </Button>
                                      <span className="text-xs text-slate-400 text-center">
                                        ~{estimatePointsCost(case_.budget)} точки
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                              
                              {/* Show accept button for pending cases (in all views including declined) */}
                              {case_.status === 'pending' && !case_.bidding_enabled && (
                                <>
                                  <Button
                                    variant="construction"
                                    size="sm"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      // If in declined view, first undecline then accept
                                      if (filters.viewMode === 'declined') {
                                        try {
                                          await apiClient.undeclineCase(case_.id, user!.id)
                                        } catch (error) {
                                          console.error('Error undeclining:', error)
                                        }
                                      }
                                      handleStatusChange(case_.id, 'accepted')
                                    }}
                                    leftIcon={<span>✅</span>}
                                  >
                                    Приеми
                                  </Button>
                                  {/* Only show decline button if NOT already in declined view */}
                                  {filters.viewMode !== 'declined' && (
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
                                  )}
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
                            <div className="flex flex-col gap-2">
                              {/* Show View Bids button for cases with bidding enabled */}
                              {case_.bidding_enabled && (case_.current_bidders || 0) > 0 && !case_.winning_bid_id && (
                                <Button
                                  variant="construction"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/dashboard/cases/${case_.id}/bids`)
                                  }}
                                  leftIcon={<span>👥</span>}
                                >
                                  Виж оферти ({case_.current_bidders})
                                </Button>
                              )}
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
    </div>
  )
}
