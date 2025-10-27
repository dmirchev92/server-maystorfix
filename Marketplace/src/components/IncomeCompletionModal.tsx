'use client'

import { useState } from 'react'

interface IncomeCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (data: { completionNotes: string; income?: { amount: number; paymentMethod?: string; notes?: string } }) => void
  caseTitle: string
}

export default function IncomeCompletionModal({ isOpen, onClose, onComplete, caseTitle }: IncomeCompletionModalProps) {
  const [completionNotes, setCompletionNotes] = useState('')
  const [includeIncome, setIncludeIncome] = useState(false)
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [incomeNotes, setIncomeNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const data: any = {
        completionNotes
      }

      if (includeIncome && amount && parseFloat(amount) > 0) {
        data.income = {
          amount: parseFloat(amount),
          paymentMethod: paymentMethod || undefined,
          notes: incomeNotes || undefined
        }
      }

      await onComplete(data)
      
      // Reset form
      setCompletionNotes('')
      setIncludeIncome(false)
      setAmount('')
      setPaymentMethod('')
      setIncomeNotes('')
    } catch (error) {
      console.error('Error completing case:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-t-lg">
          <h2 className="text-2xl font-bold">🏁 Завършване на заявка</h2>
          <p className="text-green-50 mt-1">{caseTitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Completion Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Бележки за завършване
            </label>
            <textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Опишете какво е направено..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Income Tracking Toggle */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="includeIncome"
                checked={includeIncome}
                onChange={(e) => setIncludeIncome(e.target.checked)}
                className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="includeIncome" className="ml-3 flex-1">
                <span className="text-sm font-medium text-gray-900">💰 Добави приход от тази заявка</span>
                <p className="text-xs text-gray-600 mt-1">
                  Проследявайте приходите си за по-добро управление на бизнеса
                </p>
              </label>
            </div>
          </div>

          {/* Income Details (shown when checkbox is checked) */}
          {includeIncome && (
            <div className="space-y-4 pl-7 border-l-4 border-green-500">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сума <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required={includeIncome}
                    className="w-full px-4 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    BGN
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Метод на плащане
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Изберете метод</option>
                  <option value="cash">💵 Кеш</option>
                  <option value="card">💳 Картово плащане</option>
                  <option value="bank_transfer">🏦 Банков път</option>
                  <option value="online">🌐 Revolut</option>
                  <option value="other">📝 Друго</option>
                </select>
              </div>

              {/* Income Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Допълнителни бележки
                </label>
                <textarea
                  value={incomeNotes}
                  onChange={(e) => setIncomeNotes(e.target.value)}
                  placeholder="Напр. частично плащане, бонус и т.н..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>💡 Съвет:</strong> Добавянето на приход ви помага да проследявате месечните си приходи и да анализирате бизнеса си по-добре.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (includeIncome && (!amount || parseFloat(amount) <= 0))}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting ? '⏳ Завършване...' : '✅ Завърши заявката'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
