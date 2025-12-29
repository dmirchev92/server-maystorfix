'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.snapfix.bg'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Моля въведете имейл адрес')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/auth/password-reset-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (data.success) {
        setSubmitted(true)
      } else {
        // Always show success for security (don't reveal if email exists)
        setSubmitted(true)
      }
    } catch (err) {
      console.error('Password reset request error:', err)
      // Still show success for security
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        {/* Background elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-lg blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
        </div>

        <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/50">
              <span className="text-4xl">✉️</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Проверете имейла си
          </h2>
          <p className="mt-4 text-center text-slate-300 max-w-sm mx-auto">
            Ако съществува акаунт с имейл <span className="text-indigo-400 font-medium">{email}</span>, 
            ще получите линк за възстановяване на паролата.
          </p>
          
          <div className="mt-8 bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <span className="text-2xl">📧</span>
                <div>
                  <p className="text-sm text-slate-300">
                    Линкът е валиден <span className="text-white font-medium">1 час</span>
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-2xl">📥</span>
                <div>
                  <p className="text-sm text-slate-300">
                    Проверете и папката <span className="text-white font-medium">Спам</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col space-y-3">
            <Link
              href="/auth/login"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-indigo-500/50"
            >
              Обратно към вход
            </Link>
            <button
              onClick={() => setSubmitted(false)}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Опитайте с друг имейл
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-auto">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-slate-500/5 to-indigo-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Назад
          </button>
        </div>
        
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/50">
            <span className="text-3xl">🔑</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Забравена парола
        </h2>
        <p className="mt-2 text-center text-sm text-slate-300">
          Въведете имейла си и ще ви изпратим линк за възстановяване
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-20">
        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-200">
                Имейл адрес
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="ivan@example.com"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/50"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <span className="text-indigo-200 group-hover:text-indigo-100">
                    📧
                  </span>
                </span>
                {loading ? 'Изпращане...' : 'Изпратете линк'}
              </button>
            </div>

            <div className="text-center">
              <Link href="/auth/login" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                Обратно към вход
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
