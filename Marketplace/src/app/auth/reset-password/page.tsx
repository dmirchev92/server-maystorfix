'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.snapfix.bg'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Password validation
  const [validations, setValidations] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
    passwordsMatch: false,
  })

  useEffect(() => {
    setValidations({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[@$!%*?&]/.test(password),
      passwordsMatch: password === confirmPassword && password.length > 0,
    })
  }, [password, confirmPassword])

  const isValidPassword = Object.values(validations).every(v => v)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Невалиден или липсващ токен за възстановяване')
      return
    }

    if (!isValidPassword) {
      setError('Моля уверете се, че паролата отговаря на всички изисквания')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/auth/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token, 
          newPassword: password 
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.error?.message || 'Възникна грешка. Моля опитайте отново.')
      }
    } catch (err) {
      console.error('Password reset error:', err)
      setError('Възникна грешка при свързване със сървъра')
    } finally {
      setLoading(false)
    }
  }

  // No token provided
  if (!token) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-lg blur-3xl"></div>
        </div>

        <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
              <span className="text-4xl">❌</span>
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Невалиден линк
          </h2>
          <p className="mt-4 text-slate-300">
            Линкът за възстановяване на парола е невалиден или изтекъл.
          </p>
          <div className="mt-8">
            <Link
              href="/auth/forgot-password"
              className="inline-flex justify-center py-3 px-6 border border-transparent rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-indigo-500/50"
            >
              Заявете нов линк
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg blur-3xl"></div>
        </div>

        <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/50 animate-bounce">
              <span className="text-4xl">✓</span>
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Паролата е променена!
          </h2>
          <p className="mt-4 text-slate-300">
            Вашата парола беше успешно обновена. Вече можете да влезете с новата си парола.
          </p>
          <div className="mt-8">
            <Link
              href="/auth/login"
              className="inline-flex justify-center py-3 px-6 border border-transparent rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-indigo-500/50"
            >
              Влезте в акаунта си
            </Link>
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
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/50">
            <span className="text-3xl">🔐</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Нова парола
        </h2>
        <p className="mt-2 text-center text-sm text-slate-300">
          Въведете новата си парола
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
              <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                Нова парола
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200">
                Потвърдете паролата
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Password requirements */}
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-300 mb-3">Изисквания за парола:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`flex items-center ${validations.minLength ? 'text-green-400' : 'text-slate-400'}`}>
                  <span className="mr-2">{validations.minLength ? '✓' : '○'}</span>
                  Минимум 8 символа
                </div>
                <div className={`flex items-center ${validations.hasUppercase ? 'text-green-400' : 'text-slate-400'}`}>
                  <span className="mr-2">{validations.hasUppercase ? '✓' : '○'}</span>
                  Главна буква (A-Z)
                </div>
                <div className={`flex items-center ${validations.hasLowercase ? 'text-green-400' : 'text-slate-400'}`}>
                  <span className="mr-2">{validations.hasLowercase ? '✓' : '○'}</span>
                  Малка буква (a-z)
                </div>
                <div className={`flex items-center ${validations.hasNumber ? 'text-green-400' : 'text-slate-400'}`}>
                  <span className="mr-2">{validations.hasNumber ? '✓' : '○'}</span>
                  Цифра (0-9)
                </div>
                <div className={`flex items-center ${validations.hasSpecial ? 'text-green-400' : 'text-slate-400'}`}>
                  <span className="mr-2">{validations.hasSpecial ? '✓' : '○'}</span>
                  Специален символ
                </div>
                <div className={`flex items-center ${validations.passwordsMatch ? 'text-green-400' : 'text-slate-400'}`}>
                  <span className="mr-2">{validations.passwordsMatch ? '✓' : '○'}</span>
                  Паролите съвпадат
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !isValidPassword}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/50"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <span className="text-indigo-200 group-hover:text-indigo-100">
                    🔐
                  </span>
                </span>
                {loading ? 'Запазване...' : 'Запазете новата парола'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white">Зареждане...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
