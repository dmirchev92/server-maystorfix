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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.proposedBudgetRange) {
      alert('Моля, изберете предлагана цена')
      return
    }
    
    if (!confirm('Сигурни ли сте, че искате да наддавате за тази заявка?')) {
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
                💡 <strong>Участие:</strong> 5 точки (веднага)<br/>
                💰 <strong>При печалба:</strong> Пълната цена според вашата оферта<br/>
                ❌ <strong>При загуба:</strong> Само 5 точки
              </p>
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
