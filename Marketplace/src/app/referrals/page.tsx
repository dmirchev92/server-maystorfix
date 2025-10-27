'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { apiClient } from '@/lib/api'
import ReferralWidget from '@/components/ReferralWidget'

interface ReferredUser {
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
  rewardType: 'discount_10' | 'discount_50' | 'free_month'
  rewardValue: number
  clicksRequired: number
  clicksAchieved: number
  earnedAt: string
  status: 'earned' | 'applied' | 'expired'
}

interface ReferralDashboard {
  referralCode: string
  referralLink: string
  referredUsers: ReferredUser[]
  totalRewards: ReferralReward[]
}

export default function ReferralDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

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
        
        // Fix the referral link to use local development URL
        const dashboardData = {
          ...response.data.data,
          referralLink: response.data.data.referralLink?.replace(
            'https://marketplace.servicetextpro.com',
            'http://192.168.0.129:3002'
          )
        }
        
        console.log('🤝 Fixed dashboard data with local URL:', dashboardData)
        setDashboard(dashboardData)
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

    // Fix the referral link to use local development URL
    const localReferralLink = dashboard.referralLink.replace(
      'https://marketplace.servicetextpro.com',
      'http://192.168.0.129:3002'
    )

    console.log('📋 Copying referral link:', localReferralLink)

    try {
      await navigator.clipboard.writeText(localReferralLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
      console.log('✅ Referral link copied successfully')
    } catch (err) {
      console.error('❌ Failed to copy link:', err)
      // Fallback: try to select and copy manually
      try {
        const textArea = document.createElement('textarea')
        textArea.value = localReferralLink
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
        console.log('✅ Referral link copied using fallback method')
      } catch (fallbackErr) {
        console.error('❌ Fallback copy method also failed:', fallbackErr)
        alert('Неуспешно копиране. Моля копирайте ръчно: ' + localReferralLink)
      }
    }
  }

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
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
                {dashboard.totalRewards.map((reward) => (
                  <div key={reward.id} className="border border-white/20 rounded-lg p-3 bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">
                        {getRewardTypeLabel(reward.rewardType)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRewardStatusColor(reward.status)}`}>
                        {reward.status === 'earned' ? 'Спечелена' : reward.status === 'applied' ? 'Приложена' : 'Изтекла'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300">
                      <p>{reward.clicksAchieved} от {reward.clicksRequired} кликове</p>
                      <p>Спечелена: {new Date(reward.earnedAt).toLocaleDateString('bg-BG')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reward Tiers Info */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">🏆 Нива на награди</h3>
            <div className="space-y-3 text-sm mb-4">
              <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                <span className="text-slate-200">50 кликове</span>
                <span className="font-semibold text-green-400">10% отстъпка</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                <span className="text-slate-200">100 кликове</span>
                <span className="font-semibold text-indigo-400">50% отстъпка</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                <span className="text-slate-200">500 кликове</span>
                <span className="font-semibold text-purple-400">Безплатен месец</span>
              </div>
            </div>
            
            <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-400/30">
              <h4 className="font-semibold text-yellow-300 mb-2">⚠️ Важни правила</h4>
              <ul className="text-xs text-yellow-200 space-y-1">
                <li>• Максимум 25 валидни кликове на месец</li>
                <li>• Препоръчаният трябва да остане активен</li>
                <li>• Самокликванията не се броят</li>
                <li>• Наградите изтичат след 6 месеца</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}
