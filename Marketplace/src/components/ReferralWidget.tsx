'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'

interface ReferralStats {
  referralCode: string
  referralLink: string
  totalReferrals: number
  totalClicks: number
  monthlyClicks: number
  earnedRewards: number
  nextRewardProgress: {
    current: number
    target: number
    rewardType: string
  }
}

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

export default function ReferralWidget() {
  const { user, isAuthenticated } = useAuth()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showReferredUsers, setShowReferredUsers] = useState(false)
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([])

  useEffect(() => {
    if (isAuthenticated && user && (user.role === 'service_provider' || user.role === 'tradesperson')) {
      fetchReferralStats()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  const fetchReferralStats = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getReferralDashboard()
      
      if (response.data?.success) {
        const data = response.data.data
        
        // Calculate next reward progress based on the best performing individual referral
        const totalClicks = data.referredUsers?.reduce((sum: number, user: any) => sum + user.validClicks, 0) || 0
        
        // Find the referral with the most valid clicks (closest to next reward)
        const bestReferral = data.referredUsers?.reduce((best: any, user: any) => {
          return (user.validClicks > (best?.validClicks || 0)) ? user : best
        }, null)
        
        const bestReferralClicks = bestReferral?.validClicks || 0
        let nextReward = { current: bestReferralClicks, target: 50, rewardType: '10% отстъпка' }
        
        if (bestReferralClicks >= 500) {
          nextReward = { current: bestReferralClicks, target: 500, rewardType: 'Постигнато максимално ниво!' }
        } else if (bestReferralClicks >= 100) {
          nextReward = { current: bestReferralClicks, target: 500, rewardType: 'Безплатен месец' }
        } else if (bestReferralClicks >= 50) {
          nextReward = { current: bestReferralClicks, target: 100, rewardType: '50% отстъпка' }
        }

        setStats({
          referralCode: data.referralCode,
          referralLink: data.referralLink,
          totalReferrals: data.referredUsers?.length || 0,
          totalClicks: totalClicks,
          monthlyClicks: data.referredUsers?.reduce((sum: number, user: any) => sum + user.monthlyClicks, 0) || 0,
          earnedRewards: data.totalRewards?.length || 0,
          nextRewardProgress: nextReward
        })
        
        // Store referred users for dropdown
        setReferredUsers(data.referredUsers || [])
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyReferralLink = async () => {
    if (!stats?.referralLink) return

    try {
      await navigator.clipboard.writeText(stats.referralLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-300 bg-green-500/20 border-green-400/30'
      case 'pending': return 'text-yellow-300 bg-yellow-500/20 border-yellow-400/30'
      default: return 'text-slate-300 bg-slate-500/20 border-slate-400/30'
    }
  }

  // Don't show widget for customers
  if (!isAuthenticated || !user || (user.role !== 'service_provider' && user.role !== 'tradesperson')) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-white/20 rounded"></div>
            <div className="h-3 bg-white/20 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🤝 Препоръчителна система</h3>
        <p className="text-slate-300 text-sm">Неуспешно зареждане на данните за препоръки.</p>
      </div>
    )
  }

  const progressPercentage = Math.min((stats.nextRewardProgress.current / stats.nextRewardProgress.target) * 100, 100)

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">🤝 Препоръчителна система</h3>
        <a
          href="/referrals"
          className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
        >
          Виж всички →
        </a>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-lg">
          <div className="text-2xl font-bold text-indigo-400">{stats.totalReferrals}</div>
          <div className="text-xs text-slate-300">Препоръки</div>
        </div>
        <div className="text-center p-3 bg-purple-500/20 border border-purple-400/30 rounded-lg">
          <div className="text-2xl font-bold text-purple-400">{stats.monthlyClicks}</div>
          <div className="text-xs text-slate-300">Този месец</div>
        </div>
        <div className="text-center p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
          <div className="text-2xl font-bold text-yellow-400">{stats.earnedRewards}</div>
          <div className="text-xs text-slate-300">Награди</div>
        </div>
      </div>


      {/* Referred Users Dropdown */}
      {referredUsers.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <button
            onClick={() => setShowReferredUsers(!showReferredUsers)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 rounded-lg transition-colors"
          >
            <div className="flex items-center space-x-2">
              <span className="text-white font-medium">👥 Препоръчани потребители</span>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full border border-indigo-400/30">
                {referredUsers.length}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                showReferredUsers ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showReferredUsers && (
            <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
              {referredUsers.map((user, index) => {
                // Calculate progress for this referral
                const validClicks = user.validClicks
                let nextTarget = 50
                let nextRewardLabel = '10% отстъпка'
                let progressColor = 'bg-green-500'
                
                if (validClicks >= 500) {
                  nextTarget = 500
                  nextRewardLabel = 'Максимално ниво!'
                  progressColor = 'bg-purple-500'
                } else if (validClicks >= 100) {
                  nextTarget = 500
                  nextRewardLabel = 'Безплатен месец'
                  progressColor = 'bg-purple-500'
                } else if (validClicks >= 50) {
                  nextTarget = 100
                  nextRewardLabel = '50% отстъпка'
                  progressColor = 'bg-yellow-500'
                }
                
                const progressPercentage = Math.min((validClicks / nextTarget) * 100, 100)
                
                return (
                  <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-indigo-500/20 border border-indigo-400/30 rounded-full flex items-center justify-center">
                          <span className="text-indigo-300 text-sm font-bold">
                            {user.referredUser.firstName?.charAt(0)}{user.referredUser.lastName?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white">
                            {user.referredUser.businessName || `${user.referredUser.firstName} ${user.referredUser.lastName}`}
                          </h4>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(user.status)}`}>
                            {user.status === 'active' ? 'Активен' : user.status === 'pending' ? 'Чакащ' : 'Неактивен'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="text-center p-2 bg-green-500/10 rounded">
                        <div className="font-bold text-green-400">{user.validClicks}</div>
                        <div className="text-slate-400">Валидни</div>
                      </div>
                      <div className="text-center p-2 bg-indigo-500/10 rounded">
                        <div className="font-bold text-indigo-400">{user.monthlyClicks}</div>
                        <div className="text-slate-400">Месечни</div>
                      </div>
                    </div>
                    
                    {/* Individual Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-300">Следваща награда</span>
                        <span className="text-xs text-slate-400">
                          {validClicks}/{nextTarget} кликове
                        </span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2 mb-1">
                        <div 
                          className={`${progressColor} h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-400">{nextRewardLabel}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
