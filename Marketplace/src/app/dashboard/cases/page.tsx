'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Header } from '@/components/Header'
import IncomeCompletionModal from '@/components/IncomeCompletionModal'
import { Case, Bid, DashboardStats, FilterParams } from '@/types/marketplace'
import { StatsOverview } from './components/StatsOverview'
import { FilterBar } from './components/FilterBar'
import { BidsList } from './components/BidsList'
import { CaseList } from './components/CaseList'

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [filters, setFilters] = useState<FilterParams>({
    status: '',
    category: '',
    city: '',
    neighborhood: '',
    viewMode: 'available',
    page: 1,
    limit: 10
  })
  const [allBids, setAllBids] = useState<Bid[]>([])
  const [bidsFilter, setBidsFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all')
  const [completionModal, setCompletionModal] = useState<{ isOpen: boolean; caseId: string; caseTitle: string }>({ isOpen: false, caseId: '', caseTitle: '' })
  const [biddingCases, setBiddingCases] = useState<Set<string>>(new Set())
  const [pointsBalance, setPointsBalance] = useState<number>(0)
  const [myBids, setMyBids] = useState<Map<string, any>>(new Map())
  
  const fetchingRef = useRef(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
      return
    }
    
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
          filterParams.providerId = user.id
        } else if (filters.viewMode === 'declined') {
          const response = await apiClient.getDeclinedCases(user.id)
          if (response.data?.success) {
            setCases(response.data.data || [])
          } else {
            setCases([])
          }
          return
        } else {
          filterParams.onlyUnassigned = 'true'
          filterParams.excludeDeclinedBy = user.id
        }
      } else {
        filterParams.customerId = user?.id
      }
      
      const response = await apiClient.getCasesWithFilters(filterParams)
      if (response.data?.success) {
        setCases(response.data.data.cases || [])
      } else {
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

  const handleStatusChange = async (caseId: string, newStatus: string) => {
    try {
      if (newStatus === 'accepted') {
        await apiClient.acceptCase(caseId, user!.id, `${user!.firstName} ${user!.lastName}`)
        alert('Заявката беше приета успешно!')
      } else if (newStatus === 'declined') {
        await apiClient.declineCase(caseId, user!.id, 'Declined by provider')
        alert('Заявката беше отказана успешно!')
      } else if (newStatus === 'completed') {
        const caseToComplete = cases.find(c => c.id === caseId)
        if (caseToComplete) {
          setCompletionModal({
            isOpen: true,
            caseId: caseId,
            caseTitle: caseToComplete.description || caseToComplete.service_type
          })
          return
        }
      }
      
      setTimeout(() => {
        fetchCases()
        fetchStats()
      }, 500)
      
    } catch (error: any) {
      console.error('❌ Error updating case status:', error)
      
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
      
      const canBidResponse = await apiClient.canBidOnCase(caseId)
      
      if (!canBidResponse.data?.data?.allowed) {
        const reason = canBidResponse.data?.data?.reason || 'Cannot place bid'
        const requiredPoints = canBidResponse.data?.data?.required_points
        
        if (requiredPoints) {
          alert(`${reason}\n\nНеобходими точки: ${requiredPoints}\nВашите точки: ${pointsBalance}`)
        } else {
          alert(reason)
        }
        return
      }
      
      router.push(`/dashboard/cases/${caseId}/place-bid`)
      
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

  const handleUndecline = async (caseId: string) => {
    try {
      await apiClient.undeclineCase(caseId, user!.id)
      alert('Заявката беше възстановена!')
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
      if (response.data?.success) {
        const bids = response.data.data?.bids || []
        const bidsMap = new Map()
        bids.forEach((bid: any) => {
          bidsMap.set(bid.case_id, bid)
        })
        setMyBids(bidsMap)
      }
    } catch (error) {
      console.error('Error fetching my bids:', error)
    }
  }

  const fetchAllBids = async () => {
    try {
      const response = await apiClient.getMyBids()
      if (response.data?.success) {
        setAllBids(response.data.data?.bids || [])
      }
    } catch (error) {
      console.error('Error fetching all bids:', error)
    }
  }

  const handleFilterChange = (key: keyof FilterParams, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handleViewChange = (viewMode: 'available' | 'assigned' | 'declined' | 'bids', status: string = '') => {
    setFilters(prev => ({ ...prev, viewMode, status, page: 1 }))
    if (viewMode === 'bids') {
      fetchAllBids()
    }
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
          <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/40 rounded-xl px-6 py-4">
            <div className="text-center">
              <p className="text-sm text-slate-300 mb-1">Налични точки</p>
              <p className="text-3xl font-bold text-white">{pointsBalance}</p>
              <p className="text-xs text-slate-400 mt-1">за наддаване</p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle Buttons */}
        {(user.role === 'tradesperson' || user.role === 'service_provider') && (
          <div className="flex items-center justify-center space-x-4 mb-8">
            <button
              onClick={() => handleViewChange('available', '')}
              className={`px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 transform hover:scale-105 ${
                filters.viewMode === 'available'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/20'
              }`}
            >
              📋 Налични заявки
            </button>
            <button
              onClick={() => handleViewChange('assigned', '')}
              className={`px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 transform hover:scale-105 ${
                filters.viewMode === 'assigned'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/20'
              }`}
            >
              ✅ Моите заявки
            </button>
            <button
              onClick={() => handleViewChange('bids', '')}
              className={`px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 transform hover:scale-105 ${
                filters.viewMode === 'bids'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/20'
              }`}
            >
              💰 Моите кандидатури
            </button>
          </div>
        )}

        {/* Stats Overview */}
        <StatsOverview 
          stats={stats} 
          onViewChange={handleViewChange}
        />

        {/* Filters */}
        <FilterBar 
          filters={filters} 
          onFilterChange={handleFilterChange}
          userRole={user.role}
        />

        {/* Main Content Area */}
        {filters.viewMode === 'bids' ? (
          <BidsList 
            bids={allBids} 
            filter={bidsFilter} 
            onFilterChange={setBidsFilter}
          />
        ) : (
          <CaseList 
            cases={cases}
            loading={loading}
            user={user}
            viewMode={filters.viewMode}
            myBids={myBids}
            biddingCases={biddingCases}
            onStatusChange={handleStatusChange}
            onPlaceBid={handlePlaceBid}
            onUndecline={handleUndecline}
            onCreateCase={() => router.push('/create-case')}
          />
        )}
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
