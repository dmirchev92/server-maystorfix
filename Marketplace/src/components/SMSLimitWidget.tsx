'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface SMSLimitStatus {
  canSend: boolean
  monthlyLimit: number
  monthlyUsed: number
  monthlyRemaining: number
  addonRemaining: number
  totalRemaining: number
  tier: string
  periodStart: string
  periodEnd: string
  reason?: string
}

interface SMSPackage {
  id: string
  packageType: string
  smsCount: number
  price: number
  currency: string
  purchasedAt: string
  smsUsed: number
  smsRemaining: number
  status: string
}

interface SMSLimitWidgetProps {
  compact?: boolean
  showPurchaseButton?: boolean
}

export default function SMSLimitWidget({ compact = false, showPurchaseButton = true }: SMSLimitWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [limitStatus, setLimitStatus] = useState<SMSLimitStatus | null>(null)
  const [packages, setPackages] = useState<SMSPackage[]>([])
  const [purchasing, setPurchasing] = useState(false)
  const [showPackages, setShowPackages] = useState(false)

  useEffect(() => {
    loadSMSLimitStatus()
  }, [])

  const loadSMSLimitStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/sms/limit-status`,
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
          setLimitStatus(result.data)
          // Also load packages to get total addon SMS purchased
          await loadSMSPackages()
        }
      }
    } catch (error) {
      console.error('Error loading SMS limit status:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSMSPackages = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/sms/packages`,
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
          setPackages(result.data.packages || [])
        }
      }
    } catch (error) {
      console.error('Error loading SMS packages:', error)
    }
  }

  const handlePurchasePackage = async () => {
    if (!confirm('Искате ли да закупите 15 SMS за 40 BGN?\n\nСъобщенията няма да изтекат и ще се използват преди месечния ви лимит.')) {
      return
    }

    try {
      setPurchasing(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/sms/purchase-package`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            payment_method: 'manual', // TODO: Integrate with Stripe/PayPal
            payment_reference: `manual_${Date.now()}`
          })
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          alert('✅ Успешно закупихте 15 SMS!\n\nНовите SMS са добавени към вашия баланс.')
          loadSMSLimitStatus() // Refresh status
        } else {
          alert('❌ Грешка при закупуване: ' + (result.error?.message || 'Неизвестна грешка'))
        }
      } else {
        const error = await response.json()
        alert('❌ Грешка при закупуване: ' + (error.error?.message || 'Неизвестна грешка'))
      }
    } catch (error: any) {
      console.error('Error purchasing SMS package:', error)
      alert('❌ Грешка при закупуване: ' + (error?.message || 'Неизвестна грешка'))
    } finally {
      setPurchasing(false)
    }
  }

  const handleViewPackages = async () => {
    setShowPackages(!showPackages)
    if (!showPackages && packages.length === 0) {
      await loadSMSPackages()
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

  if (!limitStatus) {
    return null
  }

  // Compact version for dashboard
  if (compact) {
    // Calculate addon SMS from packages (same logic as full version)
    const totalAddonSMS = packages
      .filter(p => p.status === 'active' || p.status === 'depleted')
      .reduce((sum, p) => sum + p.smsCount, 0)
    const usedAddonSMS = packages
      .filter(p => p.status === 'active' || p.status === 'depleted')
      .reduce((sum, p) => sum + p.smsUsed, 0)
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <span className="text-2xl mr-2">📱</span>
            SMS Баланс
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Месечни SMS:</span>
            <span className="font-bold text-white">{limitStatus.monthlyUsed}/{limitStatus.monthlyLimit} използвани</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Закупени SMS:</span>
            <span className={`font-bold ${totalAddonSMS > 0 ? 'text-green-400' : 'text-slate-500'}`}>
              {totalAddonSMS > 0 ? `${usedAddonSMS}/${totalAddonSMS} използвани` : '0'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-sm font-medium text-slate-200">Общо налични:</span>
            <span className="text-2xl font-bold text-indigo-400">{limitStatus.totalRemaining}</span>
          </div>
          
          {!limitStatus.canSend && (
            <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-3 text-center">
              <p className="text-sm text-red-300">❌ Лимитът е изчерпан</p>
            </div>
          )}

          {showPurchaseButton && limitStatus.tier !== 'free' && (
            <Button
              onClick={handlePurchasePackage}
              disabled={purchasing}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
            >
              {purchasing ? 'Обработка...' : '💳 Купи 15 SMS (40 BGN)'}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Full version for settings page
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <span className="text-2xl mr-2">📱</span>
            SMS Лимит & Баланс
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tier Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Вашият план:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              limitStatus.tier === 'pro' ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30' :
              limitStatus.tier === 'normal' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' :
              'bg-gray-500/20 text-gray-300 border border-gray-400/30'
            }`}>
              {limitStatus.tier === 'pro' ? '⭐ PRO' : limitStatus.tier === 'normal' ? '💼 NORMAL' : '🆓 FREE'}
            </span>
          </div>

          {/* Monthly Limit Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Месечен лимит:</span>
              <span className="text-sm font-medium text-white">
                {limitStatus.monthlyUsed} / {limitStatus.monthlyLimit} използвани
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  limitStatus.monthlyRemaining === 0 ? 'bg-red-500' :
                  limitStatus.monthlyRemaining <= 3 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${(limitStatus.monthlyUsed / limitStatus.monthlyLimit) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Остават {limitStatus.monthlyRemaining} SMS до {new Date(limitStatus.periodEnd).toLocaleDateString('bg-BG')}
            </p>
          </div>

          {/* Addon SMS */}
          {(limitStatus.addonRemaining > 0 || packages.length > 0) && (() => {
            // Calculate total addon SMS from active packages
            const totalAddonSMS = packages
              .filter(p => p.status === 'active' || p.status === 'depleted')
              .reduce((sum, p) => sum + p.smsCount, 0)
            const usedAddonSMS = packages
              .filter(p => p.status === 'active' || p.status === 'depleted')
              .reduce((sum, p) => sum + p.smsUsed, 0)
            
            return totalAddonSMS > 0 ? (
              <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-300 font-medium">Закупени SMS:</span>
                  <span className="text-sm font-medium text-green-200">
                    {usedAddonSMS} / {totalAddonSMS} използвани
                  </span>
                </div>
                <div className="w-full bg-green-900/30 rounded-full h-2.5 mb-2">
                  <div
                    className="h-2.5 rounded-full bg-green-500 transition-all"
                    style={{ width: `${totalAddonSMS > 0 ? (usedAddonSMS / totalAddonSMS) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-green-400/70">Използват се преди месечния лимит</p>
              </div>
            ) : null
          })()}

          {/* Total Available */}
          <div className="bg-indigo-500/10 border border-indigo-400/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-300">Общо налични SMS</p>
                <p className="text-xs text-indigo-400/70">
                  {limitStatus.monthlyRemaining} месечни + {limitStatus.addonRemaining} закупени
                </p>
              </div>
              <span className="text-3xl font-bold text-indigo-400">{limitStatus.totalRemaining}</span>
            </div>
          </div>

          {/* Warning/Error Messages */}
          {!limitStatus.canSend && (
            <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
              <p className="text-sm font-medium text-red-300">❌ {limitStatus.reason}</p>
              {limitStatus.tier !== 'free' && (
                <p className="text-xs text-red-400/70 mt-1">
                  Закупете допълнителни SMS, за да продължите да изпращате съобщения.
                </p>
              )}
            </div>
          )}

          {/* Purchase Button */}
          {showPurchaseButton && limitStatus.tier !== 'free' && (
            <div className="space-y-3">
              <Button
                onClick={handlePurchasePackage}
                disabled={purchasing}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-3"
              >
                {purchasing ? '⏳ Обработка...' : '💳 Купи 15 SMS за 40 BGN'}
              </Button>
              <p className="text-xs text-slate-400 text-center">
                💡 Закупените SMS никога не изтичат и се използват преди месечния лимит
              </p>
            </div>
          )}

          {/* View Packages History */}
          {limitStatus.tier !== 'free' && (
            <button
              onClick={handleViewPackages}
              className="w-full text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {showPackages ? '▼ Скрий история' : '▶ Виж история на покупките'}
            </button>
          )}
        </CardContent>
      </Card>

      {/* Packages History */}
      {showPackages && packages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <span className="text-xl mr-2">📦</span>
              История на покупките
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">
                      {pkg.smsCount} SMS
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      pkg.status === 'active' ? 'bg-green-500/20 text-green-300' :
                      pkg.status === 'depleted' ? 'bg-gray-500/20 text-gray-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {pkg.status === 'active' ? '✅ Активен' :
                       pkg.status === 'depleted' ? '📭 Изчерпан' :
                       '❌ Изтекъл'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Използвани: {pkg.smsUsed}/{pkg.smsCount}</span>
                    <span>Остават: {pkg.smsRemaining}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span>{new Date(pkg.purchasedAt).toLocaleDateString('bg-BG')}</span>
                    <span className="font-medium text-green-400">{pkg.price} {pkg.currency}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <span className="text-xl mr-2">💡</span>
            Как работи системата?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <p>• <strong>Месечен лимит:</strong> {limitStatus.monthlyLimit} SMS се нулират на 1-во число всеки месец</p>
          <p>• <strong>Закупени SMS:</strong> Нямат срок на валидност - остават докато не ги използвате</p>
          <p>• <strong>Приоритет:</strong> Първо се използват закупените SMS, след това месечните</p>
          <p>• <strong>Цена:</strong> 15 SMS за 40 BGN (може да купувате многократно)</p>
          {limitStatus.tier === 'normal' && (
            <p className="text-indigo-400">• <strong>Upgrade:</strong> PRO планът включва 25 месечни SMS вместо 15</p>
          )}
          
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
