'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function ClaimSMSReward() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [claiming, setClaiming] = useState(true)
  const [result, setResult] = useState<{ success: boolean; message: string; smsAdded?: number } | null>(null)

  useEffect(() => {
    if (token) {
      claimReward()
    }
  }, [token])

  const claimReward = async () => {
    try {
      setClaiming(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/referrals/claim-sms/${token}`
      )
      
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Error claiming reward:', error)
      setResult({ success: false, message: 'Грешка при получаване на наградата' })
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-8">
            {claiming ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-400 mx-auto mb-4"></div>
                <h1 className="text-2xl font-bold text-white mb-2">Получаване на награда...</h1>
                <p className="text-slate-300">Моля изчакайте</p>
              </div>
            ) : result?.success ? (
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h1 className="text-3xl font-bold text-white mb-4">Поздравления!</h1>
                <p className="text-xl text-green-400 mb-6">{result.message}</p>
                <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-6 mb-6">
                  <p className="text-4xl font-bold text-green-400 mb-2">+{result.smsAdded} SMS</p>
                  <p className="text-sm text-slate-300">добавени към вашия акаунт</p>
                </div>
                <button
                  onClick={() => router.push('/referrals')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Към препоръчителната система
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4">❌</div>
                <h1 className="text-3xl font-bold text-white mb-4">Грешка</h1>
                <p className="text-xl text-red-400 mb-6">{result?.message || 'Невалиден или изтекъл линк'}</p>
                <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-6 mb-6">
                  <p className="text-sm text-slate-300">
                    Възможни причини:
                  </p>
                  <ul className="text-sm text-slate-400 mt-2 space-y-1">
                    <li>• Линкът вече е използван</li>
                    <li>• Линкът е изтекъл (валиден 7 дни)</li>
                    <li>• Невалиден токен</li>
                  </ul>
                </div>
                <button
                  onClick={() => router.push('/referrals')}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Към препоръчителната система
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}
