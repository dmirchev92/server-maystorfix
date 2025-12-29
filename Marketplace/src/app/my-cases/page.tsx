'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Header } from '@/components/Header'
import { getCategoryLabel } from '@/constants/serviceCategories'

interface Case {
  id: string
  service_type: string
  description: string
  status: string
  category: string
  budget?: number
  city?: string
  neighborhood?: string
  phone: string
  preferred_date: string
  preferred_time: string
  provider_name?: string
  bidding_enabled?: boolean
  current_bidders?: number
  max_bidders?: number
  winning_bid_id?: string
  created_at: string
  // New fields for direct assignment negotiation
  negotiation_status?: string
  assigned_sp_id?: string
  customer_budget?: string
  sp_counter_budget?: string
  counter_message?: string
}

export default function MyCasesPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [counterOfferModal, setCounterOfferModal] = useState<{ isOpen: boolean; caseData: Case | null }>({ isOpen: false, caseData: null })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
      return
    }
    
    // Only customers can access this page
    if (!isLoading && isAuthenticated && user && (user.role === 'service_provider' || user.role === 'tradesperson')) {
      router.push('/dashboard')
      return
    }
  }, [isAuthenticated, isLoading, user, router])

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchCases()
    }
  }, [isAuthenticated, user])

  const fetchCases = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getCasesWithFilters({ customerId: user?.id })
      
      if (response.data?.success) {
        const fetchedCases = response.data.data?.cases || []
        setCases(fetchedCases)
      }
    } catch (error) {
      console.error('Error fetching cases:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle customer response to counter-offer
  const handleCounterOfferResponse = async (caseId: string, accept: boolean) => {
    setActionLoading(caseId)
    try {
      const response = await apiClient.customerRespondToCounterOffer(caseId, accept ? 'accept' : 'decline')
      
      if (response.data?.success) {
        alert(accept ? 'Офертата е приета! Специалистът ще се свърже с вас.' : 'Офертата е отказана.')
        setCounterOfferModal({ isOpen: false, caseData: null })
        fetchCases()
      }
    } catch (error: any) {
      console.error('Error responding to counter-offer:', error)
      alert(`Грешка: ${error.response?.data?.error?.message || error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Send case to marketplace after decline
  const handleSendToMarketplace = async (caseId: string) => {
    if (!confirm('Искате ли да изпратите заявката към други специалисти? До 3 специалисти ще могат да наддадат.')) return
    
    setActionLoading(caseId)
    try {
      const response = await apiClient.sendCaseToMarketplace(caseId)
      
      if (response.data?.success) {
        alert('Заявката е изпратена към marketplace! Специалистите ще могат да наддават.')
        fetchCases()
      }
    } catch (error: any) {
      console.error('Error sending to marketplace:', error)
      alert(`Грешка: ${error.response?.data?.error?.message || error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Cancel case
  const handleCancelCase = async (caseId: string) => {
    if (!confirm('Сигурни ли сте, че искате да отмените тази заявка?')) return
    
    setActionLoading(caseId)
    try {
      const response = await apiClient.cancelCase(caseId)
      
      if (response.data?.success) {
        alert('Заявката е отменена.')
        fetchCases()
      }
    } catch (error: any) {
      console.error('Error cancelling case:', error)
      alert(`Грешка: ${error.response?.data?.error?.message || error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Use centralized category labels
  const getCategoryDisplayName = (category: string) => {
    return getCategoryLabel(category) || category
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Моите заявки
          </h1>
          <p className="text-slate-300 text-lg">
            Преглед на вашите заявки и оферти от специалисти
          </p>
        </div>

        {/* Cases List */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📋</span>
              Вашите заявки ({cases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cases.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-slate-300 text-lg mb-4">Все още нямате заявки</p>
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
                  <Card key={case_.id} variant="outline" padding="lg" className="group">
                    <CardContent>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start gap-4">
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
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white mb-2">
                                {case_.description}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-slate-300 mb-3">
                                <Badge variant="outline">
                                  {getCategoryDisplayName(case_.category)}
                                </Badge>
                                <span className="flex items-center gap-1">
                                  📍 {case_.city}
                                </span>
                                <span className="flex items-center gap-1">
                                  📅 {new Date(case_.created_at).toLocaleDateString('bg-BG')}
                                </span>
                                {case_.budget && (
                                  <span className="flex items-center gap-1 font-semibold text-green-400">
                                    💰 {case_.budget} BGN
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <StatusBadge status={case_.status as any} />
                                
                                {/* Negotiation Status Badges */}
                                {case_.negotiation_status === 'pending_sp_review' && (
                                  <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-400/40">
                                    ⏳ Чака преглед от специалист
                                  </Badge>
                                )}
                                {case_.negotiation_status === 'counter_offered' && (
                                  <Badge variant="construction" className="bg-amber-500/20 text-amber-300 border-amber-400/40 animate-pulse">
                                    💰 Нова оферта!
                                  </Badge>
                                )}
                                {case_.negotiation_status === 'sp_declined' && (
                                  <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-400/40">
                                    ❌ Специалистът отказа
                                  </Badge>
                                )}
                                {case_.negotiation_status === 'customer_declined' && (
                                  <Badge variant="outline" className="bg-slate-500/20 text-slate-300 border-slate-400/40">
                                    Офертата отказана
                                  </Badge>
                                )}
                                
                                {case_.bidding_enabled && (
                                  <Badge variant="construction">
                                    👥 {case_.current_bidders || 0}/{case_.max_bidders || 3} оферти
                                  </Badge>
                                )}
                                {case_.provider_name && (
                                  <Badge variant="outline">
                                    ✅ Изпълнител: {case_.provider_name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {/* Counter-offer actions */}
                          {case_.negotiation_status === 'counter_offered' && (
                            <>
                              <div className="text-center mb-2 p-2 bg-amber-500/10 border border-amber-400/30 rounded-lg">
                                <p className="text-amber-300 text-sm font-medium">Оферта: {case_.sp_counter_budget} лв</p>
                                {case_.counter_message && (
                                  <p className="text-slate-400 text-xs mt-1">{case_.counter_message}</p>
                                )}
                              </div>
                              <Button
                                variant="construction"
                                size="sm"
                                onClick={() => handleCounterOfferResponse(case_.id, true)}
                                disabled={actionLoading === case_.id}
                                leftIcon={<span>✅</span>}
                              >
                                {actionLoading === case_.id ? 'Изпращане...' : 'Приеми'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCounterOfferResponse(case_.id, false)}
                                disabled={actionLoading === case_.id}
                                leftIcon={<span>❌</span>}
                              >
                                Откажи
                              </Button>
                            </>
                          )}

                          {/* SP Declined or Customer Declined - Show marketplace/cancel options */}
                          {(case_.negotiation_status === 'sp_declined' || case_.negotiation_status === 'customer_declined') && (
                            <>
                              <Button
                                variant="construction"
                                size="sm"
                                onClick={() => handleSendToMarketplace(case_.id)}
                                disabled={actionLoading === case_.id}
                                leftIcon={<span>📢</span>}
                              >
                                {actionLoading === case_.id ? 'Изпращане...' : 'Други специалисти'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelCase(case_.id)}
                                disabled={actionLoading === case_.id}
                                leftIcon={<span>🗑️</span>}
                                className="text-red-400 hover:text-red-300"
                              >
                                Отмени
                              </Button>
                            </>
                          )}

                          {/* Show View Bids button if case has bidders */}
                          {case_.bidding_enabled && (case_.current_bidders || 0) > 0 && !case_.winning_bid_id && (
                            <Button
                              variant="construction"
                              size="sm"
                              onClick={() => router.push(`/dashboard/cases/${case_.id}/bids`)}
                              leftIcon={<span>👥</span>}
                            >
                              Виж оферти ({case_.current_bidders})
                            </Button>
                          )}
                          
                          {/* View Details / Tracking Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/dashboard/cases/${case_.id}`)}
                            leftIcon={<span>👁️</span>}
                          >
                            Детайли
                          </Button>

                          {/* Cancel button for pending cases */}
                          {case_.status === 'pending' && !case_.negotiation_status?.includes('declined') && case_.negotiation_status !== 'counter_offered' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelCase(case_.id)}
                              disabled={actionLoading === case_.id}
                              leftIcon={<span>🗑️</span>}
                              className="text-red-400 hover:text-red-300 border-red-400/30"
                            >
                              Отмени
                            </Button>
                          )}

                          {case_.winning_bid_id && (
                            <Badge variant="construction" className="text-center">
                              ✅ Избран изпълнител
                            </Badge>
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

        {/* Info Card */}
        <Card variant="elevated" className="mt-6">
          <CardContent>
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Как работи системата за оферти?
                </h3>
                <ul className="text-slate-300 space-y-2 text-sm">
                  <li>• Когато създадете заявка с бюджет, специалистите могат да наддават</li>
                  <li>• Максимум 3 специалисти могат да наддадат за една заявка</li>
                  <li>• Вие избирате кой специалист да изпълни заявката</li>
                  <li>• След избор, можете да се свържете директно със специалиста</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
