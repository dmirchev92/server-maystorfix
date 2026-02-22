'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Header } from '@/components/Header'

interface Bid {
  id: string
  case_id: string
  provider_id: string
  points_bid: number
  bid_status: string
  bid_order: number
  proposed_budget_range?: string
  bid_comment?: string
  created_at: string
  provider_name?: string
  provider_email?: string
  provider_phone?: string
  provider_rating?: number
  provider_completed_cases?: number
}

interface CaseDetails {
  id: string
  description: string
  budget: number
  service_type: string
  city: string
  status: string
  current_bidders: number
  max_bidders: number
}

export default function CaseBidsPage() {
  const router = useRouter()
  const params = useParams()
  const { isAuthenticated, user, isLoading } = useAuth()
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)

  const caseId = params.caseId as string

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
      return
    }
    
    if (isAuthenticated && user) {
      fetchData()
    }
  }, [isAuthenticated, isLoading, user, caseId, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch case details
      const casesResponse = await apiClient.getCasesWithFilters({ customerId: user?.id })
      const foundCase = casesResponse.data?.data?.cases?.find((c: any) => c.id === caseId)
      
      if (foundCase) {
        setCaseDetails(foundCase)
      }

      // Fetch bids with provider info
      const bidsResponse = await apiClient.getCaseBids(caseId, true)
      
      console.log('Bids response:', bidsResponse.data)
      
      if (bidsResponse.data?.success) {
        const bidsData = bidsResponse.data.data?.bids || bidsResponse.data.data
        // Ensure it's an array
        setBids(Array.isArray(bidsData) ? bidsData : [])
      }
    } catch (error) {
      console.error('Error fetching bids:', error)
      alert('Грешка при зареждане на офертите')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectWinner = async (bidId: string) => {
    if (!confirm('Сигурни ли сте, че искате да изберете този изпълнител? Това действие не може да бъде отменено.')) {
      return
    }

    try {
      setSelecting(bidId)
      
      const response = await apiClient.selectWinningBid(caseId, bidId)
      
      if (response.data?.success) {
        alert('✅ Изпълнителят беше избран успешно!')
        router.push('/dashboard/cases')
      }
    } catch (error: any) {
      console.error('Error selecting winner:', error)
      const errorMsg = error.response?.data?.error?.message || error.message || 'Възникна грешка'
      alert(`Грешка: ${errorMsg}`)
    } finally {
      setSelecting(null)
    }
  }

  if (loading) {
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-slate-300 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Назад
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">
            Оферти за заявка
          </h1>
          {caseDetails && (
            <p className="text-slate-300 text-lg">
              {caseDetails.description} • {caseDetails.budget} BGN
            </p>
          )}
        </div>

        {/* Bids List */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>👥</span>
              Получени оферти ({bids.length}/{caseDetails?.max_bidders || 3})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bids.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-slate-300 text-lg">Все още няма оферти</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bids.map((bid) => (
                  <Card key={bid.id} variant="outline" padding="lg" className="group">
                    <CardContent>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <Avatar 
                            name={bid.provider_name || bid.provider_email || 'Изпълнител'} 
                            size="lg" 
                          />
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-white mb-1">
                              {bid.provider_name || 'Изпълнител'}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-slate-300 mb-3">
                              <span className="flex items-center gap-1">
                                📧 {bid.provider_email}
                              </span>
                              {bid.provider_phone && (
                                <span className="flex items-center gap-1">
                                  📱 {bid.provider_phone}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm mb-3">
                              {bid.provider_rating !== undefined && (
                                <div className="flex items-center gap-1">
                                  <span className="text-yellow-400">⭐</span>
                                  <span className="text-slate-200 font-medium">
                                    {bid.provider_rating.toFixed(1)}
                                  </span>
                                </div>
                              )}
                              {bid.provider_completed_cases !== undefined && (
                                <div className="flex items-center gap-1">
                                  <span className="text-green-400">✅</span>
                                  <span className="text-slate-200">
                                    {bid.provider_completed_cases} завършени
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <span className="text-blue-400">#</span>
                                <span className="text-slate-200">
                                  Оферта #{bid.bid_order}
                                </span>
                              </div>
                            </div>
                            
                            {/* Proposed Budget Range */}
                            {bid.proposed_budget_range && (
                              <div className="bg-indigo-600/20 border border-indigo-400/30 rounded-lg p-3 mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">💰</span>
                                  <div>
                                    <p className="text-xs text-indigo-300 font-medium">Предложена цена</p>
                                    <p className="text-lg font-bold text-white">{bid.proposed_budget_range} €</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Bid Comment */}
                            {bid.bid_comment && (
                              <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
                                <p className="text-xs text-slate-400 font-medium mb-1">💬 Коментар</p>
                                <p className="text-sm text-slate-200">{bid.bid_comment}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => router.push(`/provider/${bid.provider_id}`)}
                            leftIcon={<span>👤</span>}
                          >
                            Виж профил
                          </Button>
                          <Button
                            variant="construction"
                            size="lg"
                            onClick={() => handleSelectWinner(bid.id)}
                            disabled={selecting !== null}
                            leftIcon={<span>✅</span>}
                          >
                            {selecting === bid.id ? 'Избиране...' : 'Избери'}
                          </Button>
                          <span className="text-xs text-slate-400">
                            {new Date(bid.created_at).toLocaleString('bg-BG')}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card variant="elevated" className="mt-6">
          <CardContent>
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Как работи избора на изпълнител?
                </h3>
                <ul className="text-slate-300 space-y-2 text-sm">
                  <li>• Избраният изпълнител ще получи пълната информация за заявката</li>
                  <li>• Неизбраните изпълнители ще получат обратно 80% от точките си</li>
                  <li>• След избор, можете да се свържете директно с изпълнителя</li>
                  <li>• Изборът не може да бъде отменен след потвърждение</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
