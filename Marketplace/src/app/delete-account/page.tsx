'use client'

import { useState } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

interface DeletionResponse {
  success: boolean
  data?: {
    message: string
    requestId?: string
    status?: string
    estimatedProcessingTime?: string
    nextSteps?: string[]
    found?: boolean
    statusText?: string
    requestedAt?: string
    processedAt?: string
  }
  error?: {
    code: string
    message: string
  }
}

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DeletionResponse | null>(null)
  const [mode, setMode] = useState<'request' | 'check'>('request')

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/v1/gdpr/request-account-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, reason: reason || undefined }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Възникна грешка при изпращане на заявката. Моля, опитайте отново.',
        },
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch(`/api/v1/gdpr/deletion-request-status?email=${encodeURIComponent(email)}`)
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Възникна грешка при проверка на статуса. Моля, опитайте отново.',
        },
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Изтриване на акаунт
          </h1>
          <p className="text-gray-600 mb-8">
            Съгласно GDPR (Общ регламент за защита на данните), имате право да поискате изтриване на вашите лични данни.
          </p>

          {/* Mode Toggle */}
          <div className="flex space-x-4 mb-8">
            <button
              onClick={() => { setMode('request'); setResult(null); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'request'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Нова заявка
            </button>
            <button
              onClick={() => { setMode('check'); setResult(null); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'check'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Провери статус
            </button>
          </div>

          {mode === 'request' ? (
            <form onSubmit={handleSubmitRequest} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Имейл адрес *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Въведете имейла, с който сте регистрирани"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Причина за изтриване (по избор)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="Споделете причината, ако желаете..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-800 mb-2">⚠️ Важна информация</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Изтриването на акаунта е необратимо</li>
                  <li>• Всички ваши данни ще бъдат премахнати в рамките на 30 дни</li>
                  <li>• Няма да можете да възстановите акаунта си след изтриването</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Изпращане...' : 'Изпрати заявка за изтриване'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCheckStatus} className="space-y-6">
              <div>
                <label htmlFor="check-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Имейл адрес *
                </label>
                <input
                  type="email"
                  id="check-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Въведете имейла от заявката"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Проверка...' : 'Провери статус на заявката'}
              </button>
            </form>
          )}

          {/* Result Display */}
          {result && (
            <div className={`mt-8 p-6 rounded-lg ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {result.success ? (
                <div>
                  <h3 className={`font-medium mb-2 ${
                    mode === 'check' && result.data?.found === false ? 'text-yellow-800' : 'text-green-800'
                  }`}>
                    {mode === 'request' ? '✅ Заявката е получена' : 
                      result.data?.found ? '📋 Статус на заявката' : '❓ Не е намерена заявка'}
                  </h3>
                  <p className="text-gray-700 mb-4">{result.data?.message}</p>
                  
                  {result.data?.requestId && (
                    <p className="text-sm text-gray-600">
                      <strong>Номер на заявка:</strong> {result.data.requestId}
                    </p>
                  )}
                  
                  {result.data?.statusText && (
                    <p className="text-sm text-gray-600">
                      <strong>Статус:</strong> {result.data.statusText}
                    </p>
                  )}
                  
                  {result.data?.requestedAt && (
                    <p className="text-sm text-gray-600">
                      <strong>Дата на заявка:</strong> {new Date(result.data.requestedAt).toLocaleDateString('bg-BG')}
                    </p>
                  )}
                  
                  {result.data?.estimatedProcessingTime && (
                    <p className="text-sm text-gray-600">
                      <strong>Очаквано време за обработка:</strong> {result.data.estimatedProcessingTime}
                    </p>
                  )}

                  {result.data?.nextSteps && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-800 mb-2">Следващи стъпки:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {result.data.nextSteps.map((step, index) => (
                          <li key={index}>• {step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h3 className="font-medium text-red-800 mb-2">❌ Грешка</h3>
                  <p className="text-red-700">{result.error?.message}</p>
                </div>
              )}
            </div>
          )}

          {/* Contact Info */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2">Нужна ви е помощ?</h3>
            <p className="text-gray-600 text-sm">
              За въпроси относно изтриването на данни или GDPR, свържете се с нас на:{' '}
              <a href="mailto:admin@snapfix.bg" className="text-blue-600 hover:underline">
                admin@snapfix.bg
              </a>
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}
