'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UpgradeRequiredPage() {
  const router = useRouter()
  const [trialInfo, setTrialInfo] = useState<any>(null)

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
          <Link href="/subscriptions/upgrade?tier=normal" className="block">
            <div className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg p-4 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Нормален План</h3>
                  <p className="text-sm text-green-100">5 категории • 20 снимки • 50 приемания/месец</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">250 лв</p>
                  <p className="text-xs text-green-100">на месец</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/subscriptions/upgrade?tier=pro" className="block">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg p-4 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Професионален План</h3>
                  <p className="text-sm text-purple-100">Неограничено • Наддаване • Приоритет</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">350 лв</p>
                  <p className="text-xs text-purple-100">на месец</p>
                </div>
              </div>
            </div>
          </Link>
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
