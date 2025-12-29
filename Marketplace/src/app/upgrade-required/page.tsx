'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api'

export default function UpgradeRequiredPage() {
  const router = useRouter()
  const [trialInfo, setTrialInfo] = useState<any>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null)

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user_data')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        setTrialInfo({
          casesUsed: user.trial_cases_used || 0,
          daysElapsed: user.trial_started_at 
            ? Math.floor((Date.now() - new Date(user.trial_started_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0
        })
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    }
  }, [])

  const handleUpgrade = async (tier: 'normal' | 'pro') => {
    try {
      setUpgrading(true)
      setUpgradingTier(tier)
      
      console.log('🚀 Upgrading to tier:', tier)
      
      const response = await apiClient.upgradeSubscription(tier)
      
      console.log('✅ Upgrade response:', response)
      
      if (response.data?.success) {
        // Update local user data
        const userData = localStorage.getItem('user_data')
        if (userData) {
          const user = JSON.parse(userData)
          user.subscription_tier_id = tier
          user.trial_expired = false
          localStorage.setItem('user_data', JSON.stringify(user))
        }
        
        alert(`🎉 Успешно надстроихте до ${tier === 'normal' ? 'Нормален' : 'Професионален'} план!\n\nНашият екип ще се свърже с вас за финализиране на плащането.`)
        
        // Redirect to dashboard
        router.push('/dashboard')
      } else {
        alert('❌ Грешка при надстройване: ' + (response.data?.error?.message || 'Неизвестна грешка'))
      }
    } catch (error: any) {
      console.error('❌ Upgrade error:', error)
      alert('❌ Грешка при надстройване: ' + (error.response?.data?.error?.message || error.message || 'Неизвестна грешка'))
    } finally {
      setUpgrading(false)
      setUpgradingTier(null)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white text-center mb-4">
          Безплатният период изтече
        </h1>

        {/* Description */}
        <p className="text-slate-300 text-center mb-6">
          Вашият безплатен пробен период приключи. За да продължите да използвате платформата, моля надстройте абонамента си.
        </p>

        {/* Trial Info */}
        {trialInfo && (
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Вашата активност:</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">Приети заявки</p>
                <p className="text-2xl font-bold text-white">{trialInfo.casesUsed} / 5</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Изминали дни</p>
                <p className="text-2xl font-bold text-white">{trialInfo.daysElapsed} / 14</p>
              </div>
            </div>
          </div>
        )}

        {/* Tier Options */}
        <div className="space-y-3 mb-6">
          <button 
            onClick={() => handleUpgrade('normal')}
            disabled={upgrading}
            className="block w-full text-left"
          >
            <div className={`bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg p-4 transition-all cursor-pointer ${upgrading && upgradingTier === 'normal' ? 'opacity-50 cursor-wait' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {upgrading && upgradingTier === 'normal' ? '⏳ Надстройване...' : 'Нормален План'}
                  </h3>
                  <p className="text-sm text-green-100">350 точки/година • До 1500 лв бюджет • 20 снимки</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">349 лв</p>
                  <p className="text-xs text-green-100">на година (с ДДС)</p>
                </div>
              </div>
            </div>
          </button>

          <button 
            onClick={() => handleUpgrade('pro')}
            disabled={upgrading}
            className="block w-full text-left"
          >
            <div className={`bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg p-4 transition-all cursor-pointer ${upgrading && upgradingTier === 'pro' ? 'opacity-50 cursor-wait' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {upgrading && upgradingTier === 'pro' ? '⏳ Надстройване...' : 'Професионален План'}
                  </h3>
                  <p className="text-sm text-purple-100">500 точки/година • Всички бюджети • Наддаване</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">489 лв</p>
                  <p className="text-xs text-purple-100">на година (с ДДС)</p>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/subscriptions/tiers" className="flex-1">
            <button className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
              Виж всички планове
            </button>
          </Link>
          <button
            onClick={handleLogout}
            className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors"
          >
            Изход
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-slate-400 text-center mt-6">
          Имате въпроси? <Link href="/contact" className="text-indigo-400 hover:text-indigo-300">Свържете се с нас</Link>
        </p>
      </div>
    </div>
  )
}
