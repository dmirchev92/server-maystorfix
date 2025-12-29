'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

interface PointsBalance {
  current_balance: number
  total_earned: number
  total_spent: number
  last_reset?: string
  monthly_allowance: number
}

export function PointsBalance() {
  const [pointsBalance, setPointsBalance] = useState<PointsBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPointsBalance()
  }, [])

  const fetchPointsBalance = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getPointsBalance()
      
      if (response.data?.success) {
        setPointsBalance(response.data.data)
      } else {
        setError('Failed to load points balance')
      }
    } catch (err: any) {
      console.error('Error fetching points balance:', err)
      setError(err.response?.data?.error?.message || 'Failed to load points')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-white/20 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-white/20 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !pointsBalance) {
    return null
  }

  const percentageUsed = pointsBalance.monthly_allowance > 0
    ? ((pointsBalance.monthly_allowance - pointsBalance.current_balance) / pointsBalance.monthly_allowance) * 100
    : 0

  return (
    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <span>Налични Точки</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Balance */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{pointsBalance.current_balance}</span>
            <span className="text-xl text-blue-100">/ {pointsBalance.monthly_allowance}</span>
          </div>
          <p className="text-sm text-blue-100 mt-1">годишна квота точки</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="w-full bg-blue-400/30 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-white h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, 100 - percentageUsed)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-blue-100">
            <span>Използвани: {pointsBalance.total_spent}</span>
            <span>{Math.round(100 - percentageUsed)}% налични</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-blue-400/30">
          <div>
            <p className="text-xs text-blue-100">Общо получени</p>
            <p className="text-lg font-semibold">{pointsBalance.total_earned}</p>
          </div>
          <div>
            <p className="text-xs text-blue-100">Общо изразходвани</p>
            <p className="text-lg font-semibold">{pointsBalance.total_spent}</p>
          </div>
        </div>

        {/* Info */}
        <div className="pt-3 border-t border-blue-400/30">
          <p className="text-xs text-blue-100">
            ℹ️ Точките се използват за достъп до заявки и SMS. Годишен абонамент.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
