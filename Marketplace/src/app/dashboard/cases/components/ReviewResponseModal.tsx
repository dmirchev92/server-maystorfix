'use client'

import { useState } from 'react'
import { Case } from '@/types/marketplace'
import { BUDGET_RANGES } from '@/constants/budgetRanges'

interface ReviewResponseModalProps {
  isOpen: boolean
  caseData: Case | null
  onClose: () => void
  onRespond: (caseId: string, action: 'accept' | 'decline' | 'counter', counterBudget?: string, message?: string) => void
  pointsBalance: number
}

export function ReviewResponseModal({ isOpen, caseData, onClose, onRespond, pointsBalance }: ReviewResponseModalProps) {
  const [action, setAction] = useState<'accept' | 'decline' | 'counter' | null>(null)
  const [counterBudget, setCounterBudget] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !caseData) return null

  const customerBudget = (caseData as any).customer_budget || caseData.budget || 'Не е посочен'

  const handleSubmit = async () => {
    if (!action) return
    
    if (action === 'counter' && !counterBudget) {
      alert('Моля, изберете бюджет за офертата')
      return
    }

    setIsSubmitting(true)
    try {
      await onRespond(caseData.id, action, counterBudget || undefined, message || undefined)
    } finally {
      setIsSubmitting(false)
      setAction(null)
      setCounterBudget('')
      setMessage('')
    }
  }

  const handleClose = () => {
    setAction(null)
    setCounterBudget('')
    setMessage('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 rounded-t-xl flex justify-between items-center">
          <h3 className="text-lg font-semibold">Преглед на заявка</h3>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Case Details */}
        <div className="p-6 border-b border-slate-700">
          <h4 className="text-lg font-semibold text-white mb-2">
            {caseData.service_type || caseData.category || 'Заявка за услуга'}
          </h4>
          <p className="text-slate-300 mb-4">{caseData.description}</p>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Локация:</span>
              <p className="text-white">{caseData.city}{caseData.neighborhood && `, ${caseData.neighborhood}`}</p>
            </div>
            <div>
              <span className="text-slate-400">Предложен бюджет:</span>
              <p className="text-emerald-400 font-semibold">{customerBudget} лв</p>
            </div>
            {caseData.preferred_date && (
              <div>
                <span className="text-slate-400">Предпочитана дата:</span>
                <p className="text-white">{caseData.preferred_date}</p>
              </div>
            )}
            {caseData.phone && (
              <div>
                <span className="text-slate-400">Телефон:</span>
                <p className="text-white">{caseData.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Selection */}
        <div className="p-6">
          <h4 className="text-white font-semibold mb-4">Изберете действие:</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => setAction('accept')}
              className={`p-4 rounded-xl border-2 transition-all ${
                action === 'accept'
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                  : 'border-slate-600 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300'
              }`}
            >
              <div className="text-2xl mb-2">✅</div>
              <div className="font-semibold">Приеми</div>
              <div className="text-xs mt-1 text-slate-400">При бюджет {customerBudget}</div>
            </button>

            <button
              onClick={() => setAction('counter')}
              className={`p-4 rounded-xl border-2 transition-all ${
                action === 'counter'
                  ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                  : 'border-slate-600 hover:border-amber-500/50 text-slate-300 hover:text-amber-300'
              }`}
            >
              <div className="text-2xl mb-2">💰</div>
              <div className="font-semibold">Предложи цена</div>
              <div className="text-xs mt-1 text-slate-400">Различен бюджет</div>
            </button>

            <button
              onClick={() => setAction('decline')}
              className={`p-4 rounded-xl border-2 transition-all ${
                action === 'decline'
                  ? 'border-red-500 bg-red-500/20 text-red-300'
                  : 'border-slate-600 hover:border-red-500/50 text-slate-300 hover:text-red-300'
              }`}
            >
              <div className="text-2xl mb-2">❌</div>
              <div className="font-semibold">Откажи</div>
              <div className="text-xs mt-1 text-slate-400">Не ме интересува</div>
            </button>
          </div>

          {/* Counter Offer Options */}
          {action === 'counter' && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <label className="block text-amber-300 font-medium mb-2">
                Изберете бюджет за офертата:
              </label>
              <select
                value={counterBudget}
                onChange={(e) => setCounterBudget(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Изберете бюджет --</option>
                {BUDGET_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
              
              <label className="block text-amber-300 font-medium mt-4 mb-2">
                Съобщение (по желание):
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Обяснете защо предлагате тази цена..."
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          {/* Decline Reason */}
          {action === 'decline' && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <label className="block text-red-300 font-medium mb-2">
                Причина за отказ (по желание):
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Защо отказвате тази заявка..."
                rows={2}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}

          {/* Points Info */}
          {action === 'accept' && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-300 font-medium">При приемане ще бъдат удържани точки</p>
                  <p className="text-slate-400 text-sm">Базирано на бюджета: {customerBudget} лв</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-sm">Вашите точки:</p>
                  <p className="text-white font-bold text-xl">{pointsBalance}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          {action && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (action === 'counter' && !counterBudget)}
              className={`w-full py-3 rounded-xl font-semibold transition-all ${
                action === 'accept'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-400 hover:to-green-400'
                  : action === 'counter'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400'
                  : 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-400 hover:to-rose-400'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? 'Изпращане...' : (
                action === 'accept' ? 'Приеми заявката' :
                action === 'counter' ? 'Изпрати оферта' :
                'Откажи заявката'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
