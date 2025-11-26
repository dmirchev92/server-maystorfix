'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.maystorfix.com'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Невалиден линк за потвърждение')
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/verify-email?token=${token}`)
        const data = await response.json()

        if (data.success) {
          setStatus('success')
          setMessage('Имейлът ви е успешно потвърден!')
        } else {
          setStatus('error')
          setMessage(data.error?.message || 'Линкът е невалиден или изтекъл')
        }
      } catch (err) {
        console.error('Email verification error:', err)
        setStatus('error')
        setMessage('Възникна грешка при свързване със сървъра')
      }
    }

    verifyEmail()
  }, [token])

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col justify-center items-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-white text-lg">Потвърждаване на имейл...</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg blur-3xl"></div>
        </div>

        <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/50 animate-bounce">
              <span className="text-5xl">✓</span>
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Имейлът е потвърден!
          </h2>
          <p className="mt-4 text-slate-300 text-lg">
            {message}
          </p>
          <p className="mt-2 text-slate-400">
            Вече можете да използвате всички функции на MaystorFix.
          </p>
          
          <div className="mt-8 space-y-4">
            <Link
              href="/auth/login"
              className="block w-full py-3 px-6 border border-transparent rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-indigo-500/50"
            >
              Влезте в акаунта си
            </Link>
            <Link
              href="/"
              className="block text-slate-400 hover:text-white transition-colors"
            >
              Към началната страница
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-lg blur-3xl"></div>
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
            <span className="text-5xl">❌</span>
          </div>
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-white">
          Грешка при потвърждение
        </h2>
        <p className="mt-4 text-slate-300 text-lg">
          {message}
        </p>
        
        <div className="mt-8 bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <p className="text-sm text-slate-400 mb-4">
            Възможни причини:
          </p>
          <ul className="text-left text-sm text-slate-300 space-y-2">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              Линкът е изтекъл (валиден е 24 часа)
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              Линкът вече е използван
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              Линкът е непълен или повреден
            </li>
          </ul>
        </div>

        <div className="mt-8 space-y-4">
          <Link
            href="/auth/login"
            className="block w-full py-3 px-6 border border-transparent rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-indigo-500/50"
          >
            Влезте в акаунта си
          </Link>
          <p className="text-sm text-slate-400">
            Ако проблемът продължава, свържете се с нас на{' '}
            <a href="mailto:support@maystorfix.com" className="text-indigo-400 hover:text-indigo-300">
              support@maystorfix.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex flex-col justify-center items-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-white text-lg">Зареждане...</p>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
