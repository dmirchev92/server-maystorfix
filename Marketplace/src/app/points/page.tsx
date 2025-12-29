'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { apiClient } from '@/lib/api'

interface PointsPackage {
  points: number
  basePrice: number
  discount: number
  discountPercent: number
  finalPrice: number
  savings: number
  label: string
  pricePerPoint: number
}

interface PackagesResponse {
  canPurchase: boolean
  pricePerPoint: number | null
  currency: string
  tier: string
  packages: PointsPackage[]
  message?: string
}

interface PointsBalance {
  current_balance: number
  monthly_allowance: number
  total_earned: number
  total_spent: number
  tier: string
}

export default function PointsPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  const [packages, setPackages] = useState<PackagesResponse | null>(null)
  const [balance, setBalance] = useState<PointsBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<number | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    
    if (!isAuthenticated || !user) {
      router.push('/auth/login')
      return
    }
    
    if (user.role !== 'service_provider' && user.role !== 'tradesperson') {
      router.push('/')
      return
    }
    
    loadData()
  }, [isAuthenticated, isLoading, user, router])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Fetch packages and balance in parallel
      const [packagesRes, balanceRes] = await Promise.all([
        apiClient.getPointsPackages(),
        apiClient.getPointsBalance()
      ])
      
      if (packagesRes.data?.success) {
        setPackages(packagesRes.data.data)
      }
      
      if (balanceRes.data?.success) {
        setBalance(balanceRes.data.data)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (points: number) => {
    try {
      setPurchasing(points)
      setSuccessMessage(null)
      
      const response = await apiClient.purchasePoints(points)
      
      if (response.data?.success) {
        setSuccessMessage(`Успешно добавени ${response.data.data.pointsAdded} точки! Нов баланс: ${response.data.data.newBalance} точки`)
        // Reload balance
        const balanceRes = await apiClient.getPointsBalance()
        if (balanceRes.data?.success) {
          setBalance(balanceRes.data.data)
        }
      }
    } catch (error: any) {
      console.error('Failed to purchase:', error)
      alert(error.response?.data?.error?.message || 'Грешка при покупката')
    } finally {
      setPurchasing(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">💰 Закупуване на точки</h1>
          <p className="text-slate-300 max-w-2xl mx-auto">
            Изберете пакет с точки. По-големите пакети имат по-голяма отстъпка!
          </p>
        </div>

        {/* Current Balance */}
        {balance && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-8 text-center">
            <p className="text-blue-100 text-sm mb-1">Текущ баланс</p>
            <p className="text-5xl font-bold text-white mb-2">{balance.current_balance}</p>
            <p className="text-blue-100">точки</p>
            <div className="mt-4 flex justify-center gap-8 text-sm">
              <div>
                <p className="text-blue-200">Годишна квота</p>
                <p className="text-white font-semibold">{balance.monthly_allowance}</p>
              </div>
              <div>
                <p className="text-blue-200">Общо спечелени</p>
                <p className="text-white font-semibold">{balance.total_earned}</p>
              </div>
              <div>
                <p className="text-blue-200">Общо изхарчени</p>
                <p className="text-white font-semibold">{balance.total_spent}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-8 text-center">
            <p className="text-green-400 font-semibold">✅ {successMessage}</p>
          </div>
        )}

        {/* Packages */}
        {packages?.canPurchase ? (
          <>
            <div className="mb-6 text-center">
              <p className="text-slate-400">
                Базова цена за вашия план ({packages.tier.toUpperCase()}): <span className="text-white font-semibold">{packages.pricePerPoint} лв/точка</span>
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {packages.packages.map((pkg) => (
                <div 
                  key={pkg.points}
                  className={`relative bg-slate-800/50 backdrop-blur-md border rounded-2xl p-6 transition-all hover:scale-105 ${
                    pkg.discountPercent >= 20 
                      ? 'border-yellow-500/50 ring-2 ring-yellow-500/20' 
                      : pkg.discountPercent >= 10 
                        ? 'border-green-500/30' 
                        : 'border-white/10'
                  }`}
                >
                  {/* Discount Badge */}
                  {pkg.discountPercent > 0 && (
                    <div className={`absolute -top-3 -right-3 px-3 py-1 rounded-full text-sm font-bold ${
                      pkg.discountPercent >= 20 
                        ? 'bg-yellow-500 text-yellow-900' 
                        : 'bg-green-500 text-green-900'
                    }`}>
                      -{pkg.discountPercent}%
                    </div>
                  )}

                  {/* Points */}
                  <div className="text-center mb-4">
                    <p className="text-4xl font-bold text-white">{pkg.points}</p>
                    <p className="text-slate-400">точки</p>
                  </div>

                  {/* Pricing */}
                  <div className="text-center mb-4">
                    {pkg.discountPercent > 0 ? (
                      <>
                        <p className="text-slate-500 line-through text-sm">{pkg.basePrice.toFixed(2)} лв</p>
                        <p className="text-2xl font-bold text-green-400">{pkg.finalPrice.toFixed(2)} лв</p>
                        <p className="text-green-400 text-sm">Спестявате {pkg.savings.toFixed(2)} лв</p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-white">{pkg.finalPrice.toFixed(2)} лв</p>
                    )}
                  </div>

                  {/* Price per point */}
                  <p className="text-center text-slate-400 text-sm mb-4">
                    {pkg.pricePerPoint.toFixed(2)} лв/точка
                  </p>

                  {/* Buy Button */}
                  <button
                    onClick={() => handlePurchase(pkg.points)}
                    disabled={purchasing !== null}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                      purchasing === pkg.points
                        ? 'bg-slate-600 text-slate-400 cursor-wait'
                        : pkg.discountPercent >= 20
                          ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-900'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {purchasing === pkg.points ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
                        Обработка...
                      </span>
                    ) : (
                      'Купи сега'
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Info */}
            <div className="mt-12 bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">ℹ️ Информация</h3>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li>• Точките се добавят веднага към вашия баланс</li>
                <li>• По-големите пакети имат по-голяма отстъпка (до 30%)</li>
                <li>• Точките нямат срок на валидност</li>
                <li>• За въпроси се свържете с нас на support@snapfix.bg</li>
              </ul>
              <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-amber-400 text-sm">
                  ⚠️ <strong>Тестов режим:</strong> В момента плащанията са деактивирани. 
                  Бутонът "Купи сега" ще добави точките директно за тестови цели.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg">
              {packages?.message || 'Не можете да закупувате точки с текущия план. Моля, надградете до NORMAL или PRO.'}
            </p>
            <button
              onClick={() => router.push('/pricing')}
              className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Виж плановете
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
