'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Header } from '@/components/Header'

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
}

export default function MyCasesPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                              <div className="flex items-center gap-3">
                                <StatusBadge status={case_.status as any} />
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
