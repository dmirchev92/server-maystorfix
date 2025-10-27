'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

interface LoginData {
  email: string
  password: string
  rememberMe: boolean
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: '',
    rememberMe: false
  })

  useEffect(() => {
    // Check if user just registered
    if (searchParams.get('registered') === 'true') {
      // Show success message or auto-fill email if available
    }

    // Load saved credentials if any
    const savedEmail = localStorage.getItem('remember_email')
    const savedPassword = localStorage.getItem('remember_password')
    const rememberFlag = localStorage.getItem('remember_flag')
    
    if (rememberFlag === '1' && (savedEmail || savedPassword)) {
      setFormData(prev => ({
        ...prev,
        email: savedEmail || '',
        password: savedPassword || '',
        rememberMe: true
      }))
    }
  }, [searchParams])

  const handleInputChange = (field: keyof LoginData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email || !formData.password) {
      alert('Моля въведете имейл и парола')
      return
    }

    setLoading(true)
    try {
      console.log('🔐 Attempting login with AuthContext...')
      
      // Use AuthContext login method
      const result = await login(formData.email, formData.password)
      
      if (result.success) {
        console.log('✅ Login successful via AuthContext')
        
        // Remember credentials if requested
        if (formData.rememberMe) {
          localStorage.setItem('remember_email', formData.email)
          localStorage.setItem('remember_password', formData.password)
          localStorage.setItem('remember_flag', '1')
        } else {
          localStorage.setItem('remember_flag', '0')
        }
        
        // Show success message
        alert('Успешен вход!')

        // Wait a moment for auth state to update, then redirect
        setTimeout(() => {
          router.push('/')
        }, 500)
        
      } else {
        console.error('❌ Login failed via AuthContext')
        
        // Show detailed error message from backend
        const errorMessage = result.error || 'Login failed. Please check your credentials.';
        
        // Log debug info for development
        if (result.debugInfo) {
          console.log('🔍 Login Debug Info:', result.debugInfo);
        }
        
        alert(errorMessage)
      }
    } catch (error) {
      console.error('❌ Login error:', error)
      alert('Възникна грешка при входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Industrial background elements */}
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
            <span className="text-3xl">🔧</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Влезте в акаунта си
        </h2>
        <p className="mt-2 text-center text-sm text-slate-300">
          Или{' '}
          <Link href="/auth/register" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
            създайте нов акаунт
          </Link>
        </p>
        
        {searchParams.get('registered') === 'true' && (
          <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-400">✓</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-300">
                  Регистрацията е успешна! Моля влезте с вашите данни.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-20">
        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
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
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="ivan@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                Парола
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-600 rounded bg-slate-700"
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-slate-300">
                  Запомни ме
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                  Забравена парола?
                </a>
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
                    🔓
                  </span>
                </span>
                {loading ? 'Влизане...' : 'Влезте'}
              </button>
            </div>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-slate-800 text-slate-400">Нов потребител?</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Link
                  href="/auth/register?type=customer"
                  className="w-full inline-flex justify-center py-2 px-4 border border-white/20 rounded-lg shadow-sm bg-white/5 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm"
                >
                  <span>👤</span>
                  <span className="ml-2">Клиент</span>
                </Link>

                <Link
                  href="/auth/register?type=provider"
                  className="w-full inline-flex justify-center py-2 px-4 border border-white/20 rounded-lg shadow-sm bg-white/5 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm"
                >
                  <span>🔧</span>
                  <span className="ml-2">Доставчик</span>
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
