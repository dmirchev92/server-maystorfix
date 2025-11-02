'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { apiClient } from '@/lib/api'
import ReferralWidget from '@/components/ReferralWidget'

interface ReferredUser {
  referralId: string
  referredUser: {
    id: string
    firstName: string
    lastName: string
    businessName?: string
  }
  totalClicks: number
  validClicks: number
  monthlyClicks: number
  status: string
  profileUrl: string
}

interface ReferralReward {
  id: string
  referralId?: string
  rewardType: 'sms_30' | 'signup_bonus_15' | 'free_normal_month' | 'free_pro_month'
  rewardValue: number
  clicksRequired: number
  clicksAchieved: number
  earnedAt: string
  status: 'earned' | 'applied' | 'expired'
  isAggregate: boolean
  smsSent?: boolean
}

interface AggregateProgress {
  totalValidClicks: number
  referralsAt50Plus: number
  nextMilestone: 250 | 500 | null
  progressToNext: number
  earnedRewards: {
    sms30Count: number
    freeNormalMonth: boolean
    freeProMonth: boolean
  }
}

interface ReferralDashboard {
  referralCode: string
  referralLink: string
  referredUsers: ReferredUser[]
  totalRewards: ReferralReward[]
  aggregateProgress?: AggregateProgress
}

export default function ReferralDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null)
  const [aggregateProgress, setAggregateProgress] = useState<AggregateProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [claimingReward, setClaimingReward] = useState<string | null>(null)

  useEffect(() => {
    console.log('🔍 Referrals page - Auth state:', { 
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
    
    // Redirect if not authenticated after loading is complete
    if (!isAuthenticated || !user) {
      console.log('❌ Not authenticated after loading complete, redirecting to login')
      router.push('/auth/login')
      return
    }
    
    // Check if user is a service provider - referrals are only for SPs
    if (user.role !== 'service_provider' && user.role !== 'tradesperson') {
      console.log('❌ User is not a service provider, redirecting to dashboard. Role:', user.role)
      router.push('/dashboard')
      return
    }
    
    // User is authenticated and is a service provider, fetch dashboard
    console.log('✅ Service provider authenticated, fetching dashboard for role:', user.role)
    fetchDashboard()
  }, [isAuthenticated, isLoading, user, router])

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🤝 Fetching referral dashboard...')
      const response = await apiClient.getReferralDashboard()
      console.log('🤝 Referral dashboard response:', response)
      console.log('🤝 Referral dashboard data:', response.data)
      
      if (response.data?.success) {
        console.log('🤝 Setting dashboard data:', response.data.data)
        console.log('🤝 Referred users:', response.data.data?.referredUsers)
        console.log('🤝 Original referral link from backend:', response.data.data.referralLink)
        
        // Use the app URL from environment settings
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
        
        // Extract the referral code from the link and rebuild it with the correct URL
        const originalLink = response.data.data.referralLink || ''
        const refCodeMatch = originalLink.match(/[?&]ref=([^&]+)/)
        const refCode = refCodeMatch ? refCodeMatch[1] : response.data.data.referralCode
        const correctedLink = `${appUrl}/signup?ref=${refCode}`
        
        const dashboardData = {
          ...response.data.data,
          referralLink: correctedLink
        }
        
        console.log('🤝 Corrected referral link:', correctedLink)
        setDashboard(dashboardData)
        
        // Fetch aggregate progress
        fetchAggregateProgress()
      } else {
        console.error('🤝 Dashboard fetch failed:', response.data?.message)
        throw new Error(response.data?.message || 'Failed to fetch referral dashboard')
      }
    } catch (err: any) {
      console.error('❌ Error fetching referral dashboard:', err)
      
      if (err.response?.status === 401) {
        setError('Сесията ви е изтекла. Моля влезте отново.')
        router.push('/auth/login')
      } else {
        setError(err.response?.data?.message || 'Failed to load referral dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  const copyReferralLink = async () => {
    if (!dashboard?.referralLink) {
      console.log('❌ No referral link to copy')
      return
    }

    // The referral link is already fixed with the correct app URL in fetchDashboard
    const referralLink = dashboard.referralLink

    console.log('📋 Copying referral link:', referralLink)

    try {
      await navigator.clipboard.writeText(referralLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
      console.log('✅ Referral link copied successfully')
    } catch (err) {
      console.error('❌ Failed to copy link:', err)
      // Fallback: try to select and copy manually
      try {
        const textArea = document.createElement('textarea')
        textArea.value = referralLink
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
        console.log('✅ Referral link copied using fallback method')
      } catch (fallbackErr) {
        console.error('❌ Fallback copy method also failed:', fallbackErr)
        alert('Неуспешно копиране. Моля копирайте ръчно: ' + referralLink)
      }
    }
  }

  const fetchAggregateProgress = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/referrals/aggregate-progress`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAggregateProgress(result.data)
        }
      }
    } catch (err) {
      console.error('Error fetching aggregate progress:', err)
    }
  }

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case 'sms_30': return '30 SMS'
      case 'signup_bonus_15': return '15 SMS (Signup Bonus)'
      case 'free_normal_month': return 'Безплатен Normal месец'
      case 'free_pro_month': return 'Безплатен Pro месец'
      case 'discount_10': return '10% отстъпка'
      case 'discount_50': return '50% отстъпка'
      case 'free_month': return 'Безплатен месец'
      default: return type
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50'
      case 'pending': return 'text-yellow-600 bg-yellow-50'
      case 'inactive': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getRewardStatusColor = (status: string) => {
    switch (status) {
      case 'earned': return 'text-green-600 bg-green-50'
      case 'applied': return 'text-blue-600 bg-blue-50'
      case 'expired': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto"></div>
            <p className="mt-4 text-slate-300">Зареждане на препоръчителна система...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-6 text-center backdrop-blur-sm">
            <p className="text-red-300">❌ {error || 'Неуспешно зареждане на данните'}</p>
            <button 
              onClick={fetchDashboard}
              className="mt-4 bg-red-600/80 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">🤝 Препоръчителна система</h1>
              <p className="text-slate-300">Управлявайте вашите препоръки и следете наградите си</p>
            </div>
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="bg-indigo-600/80 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 disabled:opacity-50 flex items-center space-x-2 transition-colors"
            >
              <span>🔄</span>
              <span>{loading ? 'Зареждане...' : 'Обнови'}</span>
            </button>
          </div>
        </div>

        {/* Referral Link Section - Moved to Top */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">🔗 Вашата препоръчителна връзка</h2>
          <div className="bg-white/5 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <p className="text-sm text-slate-300 mb-1">Препоръчителен код:</p>
                <p className="font-mono text-lg font-bold text-indigo-400">{dashboard.referralCode}</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-300 mb-1">Пълна връзка:</p>
                <p className="text-sm text-slate-200 break-all">
                  {dashboard.referralLink}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={copyReferralLink}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                copiedLink 
                  ? 'bg-green-600 text-white' 
                  : 'bg-indigo-600/80 text-white hover:bg-indigo-600'
              }`}
            >
              {copiedLink ? '✓ Копирано!' : '📋 Копирай връзката'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Присъедини се към ServiceText Pro и получи достъп до най-добрите майстори в България! ${dashboard.referralLink}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              📱 Сподели в WhatsApp
            </a>
          </div>
        </div>

        {/* Referral Overview Widget */}
        <div className="mb-8">
          <ReferralWidget />
        </div>

        {/* Rewards and Tiers Section - Side by Side */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Earned Rewards */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">🎁 Награди</h2>
            
            {dashboard.totalRewards.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">🎯</div>
                <p className="text-slate-300 text-sm">Все още няма спечелени награди</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.totalRewards.map((reward) => {
                  // Find the referred user for signup bonuses
                  const referredUser = reward.referralId 
                    ? dashboard.referredUsers.find(u => u.referralId === reward.referralId)
                    : null;
                  
                  const isSignupBonus = reward.rewardType === 'signup_bonus_15';
                  
                  // Determine reason and reward text
                  let reasonText = '';
                  let rewardText = '';
                  
                  if (isSignupBonus && referredUser) {
                    reasonText = `Препоръка ${referredUser.referredUser.businessName || `${referredUser.referredUser.firstName} ${referredUser.referredUser.lastName}`}`;
                    rewardText = '15 SMS';
                  } else if (reward.rewardType === 'sms_30' && referredUser) {
                    reasonText = `50 кликове на профил ${referredUser.referredUser.businessName || `${referredUser.referredUser.firstName} ${referredUser.referredUser.lastName}`}`;
                    rewardText = '30 SMS';
                  } else if (reward.rewardType === 'free_normal_month') {
                    reasonText = '250 кликове общо';
                    rewardText = 'Безплатен Normal месец';
                  } else if (reward.rewardType === 'free_pro_month') {
                    reasonText = '500 кликове общо';
                    rewardText = 'Безплатен Pro месец';
                  } else {
                    reasonText = getRewardTypeLabel(reward.rewardType);
                    rewardText = '';
                  }
                  
                  return (
                    <div key={reward.id} className="border border-white/20 rounded-lg p-3 bg-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-white">{reasonText}</div>
                          {rewardText && (
                            <div className="text-sm text-green-400 mt-1">Награда: {rewardText}</div>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRewardStatusColor(reward.status)}`}>
                          {reward.status === 'earned' ? 'Спечелена' : reward.status === 'applied' ? 'Приложена' : 'Изтекла'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-300">
                        <p>Спечелена: {new Date(reward.earnedAt).toLocaleDateString('bg-BG')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aggregate Progress */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">🎯 Обща прогрес</h3>
            
            {aggregateProgress ? (
              <div className="space-y-4">
                {/* Progress Bar */}
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-indigo-400">{aggregateProgress.totalValidClicks}</span>
                    <span className="text-sm text-slate-300">|</span>
                    <span className="text-xl font-semibold text-blue-400">250</span>
                    <span className="text-sm text-slate-300">|</span>
                    <span className="text-xl font-semibold text-purple-400">500</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3 mb-2">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                      style={{ width: `${Math.min((aggregateProgress.totalValidClicks / 500) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-400 text-center">
                    {aggregateProgress.totalValidClicks} кликове от {aggregateProgress.referralsAt50Plus} препоръки (50+ всяка)
                  </p>
                </div>

                {/* Earned Rewards Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-sm text-slate-300">30 SMS награди:</span>
                    <span className="font-bold text-green-400">{aggregateProgress.earnedRewards.sms30Count}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-sm text-slate-300">Normal месец:</span>
                    <span className="font-bold">{aggregateProgress.earnedRewards.freeNormalMonth ? '✅' : '⏳'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-sm text-slate-300">Pro месец:</span>
                    <span className="font-bold">{aggregateProgress.earnedRewards.freeProMonth ? '✅' : '⏳'}</span>
                  </div>
                </div>

                {/* Next Milestone */}
                {aggregateProgress.nextMilestone && (
                  <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-400/30">
                    <p className="text-sm text-indigo-300">
                      🎯 Още <strong>{aggregateProgress.progressToNext}</strong> кликове за {aggregateProgress.nextMilestone === 250 ? 'Normal' : 'Pro'} месец
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400 mx-auto mb-2"></div>
                <p className="text-sm text-slate-400">Зареждане...</p>
              </div>
            )}
          </div>
        </div>

        {/* Reward Tiers Info */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6 mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">🏆 Нива на награди</h3>
          
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-indigo-300 mb-2">📊 Индивидуални награди (на препоръка):</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                <span className="text-slate-200">50 кликове</span>
                <span className="font-semibold text-green-400">30 SMS</span>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-semibold text-purple-300 mb-2">🎁 Агрегатни награди (общо):</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                <span className="text-slate-200">5 препоръки × 50 кликове (250)</span>
                <span className="font-semibold text-blue-400">Normal месец</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                <span className="text-slate-200">10 препоръки × 50 кликове (500)</span>
                <span className="font-semibold text-purple-400">Pro месец</span>
              </div>
            </div>
          </div>
          
          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-400/30">
            <h4 className="font-semibold text-yellow-300 mb-2">⚠️ Важни правила</h4>
            <ul className="text-xs text-yellow-200 space-y-1">
              <li>• Максимум 25 валидни кликове на месец</li>
              <li>• Само препоръки с 50+ кликове се броят за агрегатни награди</li>
              <li>• Самокликванията не се броят</li>
              <li>• Наградите изтичат след 6 месеца</li>
            </ul>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}
