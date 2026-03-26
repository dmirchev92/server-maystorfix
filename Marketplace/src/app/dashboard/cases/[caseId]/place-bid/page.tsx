'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { Header } from '@/components/Header'
import { BUDGET_RANGES } from '@/constants/budgetRanges'

export default function PlaceBidPage() {
  const router = useRouter()
  const params = useParams()
  const caseId = params.caseId as string
  const { user, isAuthenticated } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [caseData, setCaseData] = useState<any>(null)
  const [canBid, setCanBid] = useState<any>(null)
  const [formData, setFormData] = useState({
    proposedBudgetRange: '',
    bidComment: ''
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }
    
    fetchCaseAndBidEligibility()
  }, [isAuthenticated, caseId])

  const fetchCaseAndBidEligibility = async () => {
    try {
      setLoading(true)
      
      // Fetch case details
      const caseResponse = await apiClient.getCaseById(caseId)
      if (caseResponse.data?.success) {
        setCaseData(caseResponse.data.data)
      }
      
      // Check if can bid
      const bidCheckResponse = await apiClient.canBidOnCase(caseId)
      if (bidCheckResponse.data?.success) {
        setCanBid(bidCheckResponse.data.data)
      }
      
    } catch (error: any) {
      console.error('Error fetching data:', error)
      alert('Грешка при зареждане на данните')
      router.push('/dashboard/cases')
    } finally {
      setLoading(false)
    }
  }

  // Calculate point cost based on proposed budget and user tier
  const calculatePointCost = (budgetRange: string): number => {
    const userTier = (user as any)?.subscription_tier_id || 'free'
    
    // Parse budget from range string (e.g., "126-250" -> 188, "5000+" -> 5500)
    const parseBudget = (range: string): number => {
      if (range.includes('+')) {
        return parseInt(range.replace('+', '')) + 500
      }
      const parts = range.split('-').map(p => parseInt(p))
      return parts.length === 2 ? Math.round((parts[0] + parts[1]) / 2) : parts[0] || 500
    }
    
    const midpoint = parseBudget(budgetRange)
    
    // Point costs aligned with database subscription_tiers.limits
    // Free tier: 0 points for all budgets
    if (userTier === 'free') return 0
    
    // Normal tier: limited to 500€ max budget
    if (userTier === 'normal') {
      if (midpoint <= 250) return 10
      if (midpoint <= 500) return 20
      if (midpoint <= 750) return 40
      if (midpoint <= 1000) return 60
      if (midpoint <= 2000) return 100
      return 0 // Above tier limit
    }
    
    // Pro tier: full access
    if (midpoint <= 250) return 10
    if (midpoint <= 500) return 15
    if (midpoint <= 750) return 30
    if (midpoint <= 1000) return 50
    if (midpoint <= 2000) return 80
    if (midpoint <= 3000) return 110
    if (midpoint <= 4000) return 160
    if (midpoint <= 5000) return 215
    if (midpoint <= 6000) return 280
    if (midpoint <= 7000) return 350
    if (midpoint <= 8000) return 430
    if (midpoint <= 9000) return 520
    if (midpoint <= 10000) return 640
    return 700
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.proposedBudgetRange) {
      alert('Моля, изберете предлагана цена')
      return
    }
    
    // Calculate point cost for the proposed budget
    const pointCost = calculatePointCost(formData.proposedBudgetRange)
    
    // Show confirmation with point cost
    const confirmMessage = `Сигурни ли сте, че искате да наддавате за тази заявка?\n\n💰 Предлагана цена: ${formData.proposedBudgetRange} €\n⭐ Ако спечелите, ще платите: ${pointCost} точки\n\nПродължавате ли?`
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    try {
      setSubmitting(true)
      
      const response = await apiClient.placeBid(
        caseId,
        formData.proposedBudgetRange,
        formData.bidComment || undefined
      )
      
      if (response.data?.success) {
        const bidData = response.data.data
        alert(`✅ ${response.data.message}\n\nВие сте наддавач #${bidData.bid_order}\nИзползвани точки: ${bidData.points_spent}`)
        router.push('/dashboard/cases')
      }
      
    } catch (error: any) {
      console.error('Error placing bid:', error)
      const errorMsg = error.response?.data?.error?.message || error.message || 'Възникна грешка'
      alert(`Грешка: ${errorMsg}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Зареждане...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!canBid?.allowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-xl p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-4">❌ Не можете да наддавате</h1>
            <p className="text-slate-200 mb-6">{canBid?.reason || 'Няма достъп до тази заявка'}</p>
            <button
              onClick={() => router.push('/dashboard/cases')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg"
            >
              Назад към заявките
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push('/dashboard/cases')}
            className="text-white hover:text-indigo-300 mb-6 flex items-center gap-2"
          >
            ← Назад към заявките
          </button>

          {/* Case Info Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">📋 Информация за заявката</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-200">
              <div>
                <p className="text-sm text-slate-400">Тип услуга</p>
                <p className="font-semibold">{caseData?.service_type}</p>
              </div>
              
              <div>
                <p className="text-sm text-slate-400">Бюджет на клиента</p>
                <p className="font-semibold">{caseData?.budget}</p>
              </div>
              
              <div>
                <p className="text-sm text-slate-400">Град</p>
                <p className="font-semibold">{caseData?.city}</p>
              </div>
              
              <div>
                <p className="text-sm text-slate-400">Квартал</p>
                <p className="font-semibold">{caseData?.neighborhood || 'Не е посочен'}</p>
              </div>
              
              <div className="md:col-span-2">
                <p className="text-sm text-slate-400">Описание</p>
                <p className="font-semibold">{caseData?.description}</p>
              </div>
              
              {caseData?.square_meters && (
                <div>
                  <p className="text-sm text-slate-400">Квадратни метри</p>
                  <p className="font-semibold">{caseData.square_meters} кв.м</p>
                </div>
              )}
            </div>
          </div>

          {/* Bid Form Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20">
            <h1 className="text-3xl font-bold text-white mb-2">💰 Направете вашата оферта</h1>
            <p className="text-slate-300 mb-6">
              Изберете цена и добавете коментар за вашата оферта
            </p>

            {/* Points Info */}
            <div className="bg-indigo-600/20 border border-indigo-400/30 rounded-lg p-4 mb-6">
              <p className="text-indigo-200 text-sm">
                💡 <strong>Участие:</strong> Безплатно (0 точки)<br/>
                💰 <strong>При печалба:</strong> Плащате според вашата оферта и абонамент<br/>
                ❌ <strong>При загуба:</strong> Не плащате нищо (0 точки)
              </p>
              {formData.proposedBudgetRange && (
                <div className="mt-3 pt-3 border-t border-indigo-400/30">
                  <p className="text-indigo-100 font-semibold">
                    ⭐ Ако спечелите с оферта {formData.proposedBudgetRange} €: <span className="text-yellow-300">{calculatePointCost(formData.proposedBudgetRange)} точки</span>
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Budget Range Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Предлагана цена <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.proposedBudgetRange}
                  onChange={(e) => setFormData({ ...formData, proposedBudgetRange: e.target.value })}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Изберете ценови диапазон...</option>
                  {BUDGET_RANGES.map((range) => (
                    <option key={range.value} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">
                  💡 Изберете реалистична цена за услугата
                </p>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Коментар (по избор)
                </label>
                <textarea
                  value={formData.bidComment}
                  onChange={(e) => setFormData({ ...formData, bidComment: e.target.value })}
                  placeholder="Обяснете вашия подход, опит, гаранции и т.н..."
                  rows={5}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
                />
                <p className="text-xs text-slate-400 mt-2">
                  💬 Добрият коментар увеличава шансовете ви да спечелите
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/cases')}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  disabled={submitting}
                >
                  Отказ
                </button>
                
                <button
                  type="submit"
                  disabled={submitting || !formData.proposedBudgetRange}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Изпращане...
                    </span>
                  ) : (
                    '✅ Направи оферта'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
