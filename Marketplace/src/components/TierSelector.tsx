'use client'

import { useState } from 'react'

interface TierSelectorProps {
  selectedTier?: 'free' | 'normal' | 'pro'
  onSelectTier: (tier: 'free' | 'normal' | 'pro') => void
  billingPeriod?: 'monthly' | 'yearly'
  onBillingPeriodChange?: (period: 'monthly' | 'yearly') => void
}

export default function TierSelector({ 
  selectedTier = 'free', 
  onSelectTier,
  billingPeriod: externalBillingPeriod,
  onBillingPeriodChange 
}: TierSelectorProps) {
  const [internalBillingPeriod, setInternalBillingPeriod] = useState<'monthly' | 'yearly'>('yearly')
  const billingPeriod = externalBillingPeriod || internalBillingPeriod
  
  const handleBillingPeriodChange = (period: 'monthly' | 'yearly') => {
    if (onBillingPeriodChange) {
      onBillingPeriodChange(period)
    } else {
      setInternalBillingPeriod(period)
    }
  }
  
  return (
    <div className="space-y-4">
      {/* Free Tier */}
      <div
        onClick={() => onSelectTier('free')}
        className={`
          relative p-4 rounded-lg border-2 cursor-pointer transition-all
          ${selectedTier === 'free'
            ? 'border-indigo-500 bg-indigo-500/10' 
            : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
          }
        `}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className={`
              w-5 h-5 rounded-full border-2 flex items-center justify-center
              ${selectedTier === 'free' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-500'}
            `}>
              {selectedTier === 'free' && (
                <div className="w-2 h-2 bg-white rounded-full"></div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white mb-1">🆓 FREE</h3>
            <p className="text-sm font-medium text-indigo-400 mb-2">0 €</p>
            <p className="text-xs text-slate-400 mb-2">пробен период</p>
            <ul className="space-y-1">
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> 2 категории
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> До 5 снимки
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> Основна видимост
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Normal Tier */}
      <div
        onClick={() => onSelectTier('normal')}
        className={`
          relative p-4 rounded-lg border-2 cursor-pointer transition-all
          ${selectedTier === 'normal'
            ? 'border-green-500 bg-green-500/10' 
            : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
          }
        `}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className={`
              w-5 h-5 rounded-full border-2 flex items-center justify-center
              ${selectedTier === 'normal' ? 'border-green-500 bg-green-500' : 'border-slate-500'}
            `}>
              {selectedTier === 'normal' && (
                <div className="w-2 h-2 bg-white rounded-full"></div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white mb-1">NORMAL</h3>
            <p className="text-sm font-medium text-green-400 mb-2">
              {billingPeriod === 'yearly' ? '1,400 €/година' : '130 €/месец'}
            </p>
            {billingPeriod === 'yearly' && (
              <p className="text-xs text-green-400 mb-2">или 130 €/месец</p>
            )}
            <p className="text-xs text-green-400 mb-3">10% отстъпка при първа покупка</p>
            
            {/* Billing Period Toggle - Only shown when selected */}
            {selectedTier === 'normal' && (
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBillingPeriodChange('yearly')
                  }}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
                    ${billingPeriod === 'yearly'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }
                  `}
                >
                  <div>Годишно: 1,400 €</div>
                  <div className="text-[10px] mt-0.5">🎁 10% отстъпка</div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBillingPeriodChange('monthly')
                  }}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
                    ${billingPeriod === 'monthly'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }
                  `}
                >
                  Месечно: 130 €
                </button>
              </div>
            )}
            
            <ul className="space-y-1">
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> {billingPeriod === 'yearly' ? '1,000' : '50'} точки/{billingPeriod === 'yearly' ? 'година' : 'месец'}
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> Заявки до 1,000 €
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> SMS известия (2 точки/SMS)
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> 20 снимки в галерията
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Pro Tier */}
      <div
        onClick={() => onSelectTier('pro')}
        className={`
          relative p-4 rounded-lg border-2 cursor-pointer transition-all
          ${selectedTier === 'pro'
            ? 'border-purple-500 bg-purple-500/10' 
            : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
          }
        `}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className={`
              w-5 h-5 rounded-full border-2 flex items-center justify-center
              ${selectedTier === 'pro' ? 'border-purple-500 bg-purple-500' : 'border-slate-500'}
            `}>
              {selectedTier === 'pro' && (
                <div className="w-2 h-2 bg-white rounded-full"></div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-white">👑 PRO</h3>
              <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full font-medium">
                Препоръчан
              </span>
            </div>
            <p className="text-sm font-medium text-purple-400 mb-2">
              {billingPeriod === 'yearly' ? '1,900 €/година' : '230 €/месец'}
            </p>
            {billingPeriod === 'yearly' && (
              <p className="text-xs text-purple-400 mb-2">или 230 €/месец</p>
            )}
            <p className="text-xs text-purple-400 mb-3">15% отстъпка при първа покупка</p>
            
            {/* Billing Period Toggle - Only shown when selected */}
            {selectedTier === 'pro' && (
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBillingPeriodChange('yearly')
                  }}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
                    ${billingPeriod === 'yearly'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }
                  `}
                >
                  <div>Годишно: 1,900 €</div>
                  <div className="text-[10px] mt-0.5">🎁 15% отстъпка</div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBillingPeriodChange('monthly')
                  }}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
                    ${billingPeriod === 'monthly'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }
                  `}
                >
                  Месечно: 230 €
                </button>
              </div>
            )}
            
            <ul className="space-y-1">
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> {billingPeriod === 'yearly' ? '2,000' : '100'} точки/{billingPeriod === 'yearly' ? 'година' : 'месец'}
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> Всички бюджети (до 10,000 €)
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> SMS: 1 точка/съобщение
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> До 100 снимки
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> PRO значка + VIP видимост
              </li>
              <li className="flex items-center text-xs text-slate-300">
                <span className="mr-2">✓</span> Приоритетна поддръжка
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Referral bonus message */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
        <span className="text-lg">🎉</span>
        <p className="text-xs text-green-300">
          Вие и Danail Mirchev ще получите бонус точки при регистрация!
        </p>
      </div>
    </div>
  )
}
