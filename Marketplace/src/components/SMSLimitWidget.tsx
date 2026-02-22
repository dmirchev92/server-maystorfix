'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface SMSPointsStatus {
  canSend: boolean
  pointsCost: number
  pointsBalance: number
  tier: string
  reason?: string
  totalSmsSent: number
  pointsSpentOnSMS: number
}

interface TopupOptions {
  canPurchase: boolean
  pricePerPoint: number | null
  currency: string
  tier: string
  suggestedPacks: Array<{ points: number; price: number; label: string }>
  message?: string
}

interface SMSLimitWidgetProps {
  compact?: boolean
  showPurchaseButton?: boolean
}

export default function SMSLimitWidget({ compact = false, showPurchaseButton = true }: SMSLimitWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [smsStatus, setSmsStatus] = useState<SMSPointsStatus | null>(null)
  const [topupOptions, setTopupOptions] = useState<TopupOptions | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [showTopup, setShowTopup] = useState(false)

  useEffect(() => {
    loadSMSStatus()
  }, [])

  const loadSMSStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/sms/limit-status`,
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
          setSmsStatus(result.data)
        }
      }
    } catch (error) {
      console.error('Error loading SMS status:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTopupOptions = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/points/topup-options`,
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
          setTopupOptions(result.data)
        }
      }
    } catch (error) {
      console.error('Error loading topup options:', error)
    }
  }

  const handlePurchasePoints = async (points: number) => {
    if (!confirm(`Искате ли да закупите ${points} точки?\n\nТочките ще бъдат добавени към вашия баланс.`)) {
      return
    }

    try {
      setPurchasing(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/points/purchase`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            points,
            payment_reference: `manual_${Date.now()}`
          })
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          alert(`✅ Успешно закупихте ${points} точки!\n\nНовият ви баланс: ${result.data.newBalance} точки`)
          loadSMSStatus()
        } else {
          alert('❌ Грешка при закупуване: ' + (result.error?.message || 'Неизвестна грешка'))
        }
      } else {
        const error = await response.json()
        alert('❌ Грешка при закупуване: ' + (error.error?.message || 'Неизвестна грешка'))
      }
    } catch (error: any) {
      console.error('Error purchasing points:', error)
      alert('❌ Грешка при закупуване: ' + (error?.message || 'Неизвестна грешка'))
    } finally {
      setPurchasing(false)
    }
  }

  const handleShowTopup = async () => {
    setShowTopup(!showTopup)
    if (!showTopup && !topupOptions) {
      await loadTopupOptions()
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-slate-400">Зареждане...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!smsStatus) {
    return null
  }

  // Compact version for dashboard
  if (compact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <span className="text-2xl mr-2">📱</span>
            SMS (точки)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Цена на SMS:</span>
            <span className="font-bold text-indigo-400">{smsStatus.pointsCost} точки</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Баланс:</span>
            <span className="font-bold text-white">{smsStatus.pointsBalance} точки</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-sm font-medium text-slate-200">Възможни SMS:</span>
            <span className="text-2xl font-bold text-green-400">
              {smsStatus.pointsCost > 0 ? Math.floor(smsStatus.pointsBalance / smsStatus.pointsCost) : '∞'}
            </span>
          </div>
          
          {!smsStatus.canSend && (
            <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-3 text-center">
              <p className="text-sm text-red-300">❌ Недостатъчно точки</p>
            </div>
          )}

          {showPurchaseButton && smsStatus.tier !== 'free' && (
            <Button
              onClick={handleShowTopup}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
            >
              💳 Купи точки
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Full version for settings page
  const possibleSMS = smsStatus.pointsCost > 0 ? Math.floor(smsStatus.pointsBalance / smsStatus.pointsCost) : 999

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <span className="text-2xl mr-2">📱</span>
            SMS & Точки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tier Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Вашият план:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              smsStatus.tier === 'pro' ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30' :
              smsStatus.tier === 'normal' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' :
              'bg-gray-500/20 text-gray-300 border border-gray-400/30'
            }`}>
              {smsStatus.tier === 'pro' ? '⭐ PRO' : smsStatus.tier === 'normal' ? '💼 NORMAL' : '🆓 FREE'}
            </span>
          </div>

          {/* Points Balance */}
          <div className="bg-indigo-500/10 border border-indigo-400/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-300">Баланс точки</p>
                <p className="text-xs text-indigo-400/70">
                  Използват се за SMS и казуси
                </p>
              </div>
              <span className="text-3xl font-bold text-indigo-400">{smsStatus.pointsBalance}</span>
            </div>
          </div>

          {/* SMS Cost Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Цена на SMS</p>
              <p className="text-xl font-bold text-amber-400">{smsStatus.pointsCost} точки</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Възможни SMS</p>
              <p className="text-xl font-bold text-green-400">{possibleSMS}</p>
            </div>
          </div>

          {/* Warning/Error Messages */}
          {!smsStatus.canSend && (
            <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
              <p className="text-sm font-medium text-red-300">❌ {smsStatus.reason}</p>
              {smsStatus.tier !== 'free' && (
                <p className="text-xs text-red-400/70 mt-1">
                  Закупете допълнителни точки, за да продължите да изпращате съобщения.
                </p>
              )}
            </div>
          )}

          {/* Purchase Button */}
          {showPurchaseButton && smsStatus.tier !== 'free' && (
            <div className="space-y-3">
              <Button
                onClick={handleShowTopup}
                disabled={purchasing}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-3"
              >
                {showTopup ? '▼ Скрий опции' : '💳 Купи допълнителни точки'}
              </Button>
            </div>
          )}

          {/* Topup Options */}
          {showTopup && topupOptions && (
            <div className="space-y-3 pt-2">
              {topupOptions.canPurchase ? (
                <>
                  <p className="text-xs text-slate-400 text-center">
                    Цена: {topupOptions.pricePerPoint} €/точка
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {topupOptions.suggestedPacks.map((pack) => (
                      <button
                        key={pack.points}
                        onClick={() => handlePurchasePoints(pack.points)}
                        disabled={purchasing}
                        className="bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg p-3 text-center transition-colors"
                      >
                        <p className="text-lg font-bold text-white">{pack.label}</p>
                        <p className="text-sm text-green-400">{pack.price} €</p>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-400 text-center">{topupOptions.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <span className="text-xl mr-2">💡</span>
            Как работи системата?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <p>• <strong>Точки:</strong> Използват се за SMS и достъп до казуси</p>
          <p>• <strong>SMS цена:</strong> {smsStatus.tier === 'pro' ? '1 точка' : '2 точки'} на SMS ({smsStatus.tier === 'pro' ? 'PRO' : 'Normal'} план)</p>
          <p>• <strong>Годишен абонамент:</strong> Включва {smsStatus.tier === 'pro' ? '500' : '350'} точки</p>
          <p>• <strong>Допълнителни точки:</strong> {smsStatus.tier === 'pro' ? '0.13' : '0.15'} €/точка</p>
          
          {/* SMS Encoding Explanation */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="font-medium text-white mb-2">📝 Защо кирилицата използва повече SMS?</p>
            <div className="space-y-2 text-xs text-slate-400">
              <p>SMS съобщенията използват различно кодиране в зависимост от символите:</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-green-500/10 border border-green-400/20 rounded p-2">
                  <p className="text-green-400 font-medium">Латиница (GSM-7)</p>
                  <p className="text-green-300">160 символа/SMS</p>
                  <p className="text-slate-200 text-[10px]">A-Z, 0-9, основни символи</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-400/20 rounded p-2">
                  <p className="text-amber-400 font-medium">Кирилица (Unicode)</p>
                  <p className="text-amber-300">70 символа/SMS</p>
                  <p className="text-slate-200 text-[10px]">А-Я, емотикони, специални</p>
                </div>
              </div>
              <p className="mt-2">💡 <strong className="text-slate-300">Съвет:</strong> Използвайте латиница за по-евтини SMS!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
