'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import NeighborhoodSelect from '@/components/NeighborhoodSelect'
import TierSelector from '@/components/TierSelector'
import SMSVerification from '@/components/SMSVerification'

interface RegistrationData {
  email: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
  phoneNumber: string
  userType: 'customer' | 'service_provider'
  // SP specific fields
  companyName?: string
  serviceCategory?: string
  city?: string
  neighborhood?: string
  subscription_tier_id?: 'free' | 'normal' | 'pro'
  acceptTerms: boolean
}

const serviceCategories = [
  'Електротехник',
  'Водопроводчик', 
  'Климатик',
  'Строител',
  'Мебелист',
  'Боядисване',
  'Почистване',
  'Градинарство',
  'Автосервиз',
  'Друго'
]

const cities = ['София', 'Пловдив', 'Варна', 'Бургас']

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [showTierSelection, setShowTierSelection] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [formData, setFormData] = useState<RegistrationData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    userType: 'customer',
    companyName: '',
    serviceCategory: '',
    city: '',
    neighborhood: '',
    subscription_tier_id: 'free',
    acceptTerms: false
  })

  // Check URL parameter for account type preselection
  useEffect(() => {
    const type = searchParams.get('type')
    if (type === 'provider' || type === 'service_provider') {
      setFormData(prev => ({ ...prev, userType: 'service_provider' }))
    } else if (type === 'customer') {
      setFormData(prev => ({ ...prev, userType: 'customer' }))
    }
  }, [searchParams])

  const handleInputChange = (field: keyof RegistrationData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validatePassword = (password: string): boolean => {
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    const hasMinLength = password.length >= 8
    
    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && hasMinLength
  }

  const getPasswordRequirements = (password: string) => {
    return [
      { label: 'Поне 8 символа', met: password.length >= 8 },
      { label: 'Главна буква (A-Z)', met: /[A-Z]/.test(password) },
      { label: 'Малка буква (a-z)', met: /[a-z]/.test(password) },
      { label: 'Цифра (0-9)', met: /\d/.test(password) },
      { label: 'Специален символ (@$!%*?&)', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
    ]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    console.log('🚀 handleSubmit called!')
    console.log('📋 Form data:', formData)

    // Validation
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName || !formData.phoneNumber) {
      alert('Моля попълнете всички задължителни полета')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      alert('Паролите не съвпадат')
      return
    }

    if (!validatePassword(formData.password)) {
      alert('Паролата трябва да съдържа поне 8 символа, главна буква, малка буква, цифра и специален символ')
      return
    }

    if (formData.userType === 'service_provider' && (!formData.companyName || !formData.serviceCategory)) {
      alert('Моля попълнете всички полета за доставчик на услуги')
      return
    }

    if (!formData.acceptTerms) {
      alert('Трябва да приемете условията за ползване')
      return
    }

    // Phone verification temporarily disabled - Mobica account needs activation
    // For service providers, show verification modal first
    // if (formData.userType === 'service_provider' && !phoneVerified) {
    //   setShowVerificationModal(true)
    //   return
    // }

    // Proceed with registration
    setLoading(true)
    try {
      // Format phone number to Bulgarian format if needed
      let phoneNumber = formData.phoneNumber
      if (!phoneNumber.startsWith('+359')) {
        // Remove leading 0 if present and add +359
        phoneNumber = phoneNumber.startsWith('0') 
          ? '+359' + phoneNumber.substring(1)
          : '+359' + phoneNumber
      }

      const registrationPayload = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: phoneNumber,
        role: formData.userType === 'service_provider' ? 'tradesperson' : 'customer',
        ...(formData.userType === 'service_provider' && {
          serviceCategory: formData.serviceCategory,
          companyName: formData.companyName,
          // Ensure city is sent; default to 'София' if a neighborhood is chosen but city not explicitly set
          city: formData.city || (formData.neighborhood ? 'София' : ''),
          neighborhood: formData.neighborhood,
          subscription_tier_id: formData.subscription_tier_id || 'free'
        }),
        gdprConsents: ['essential_service']
      }

      console.log('🔍 Registration payload:', registrationPayload)
      console.log('🔍 Form data neighborhood:', formData.neighborhood)
      console.log('🔍 User type:', formData.userType)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationPayload)
      })

      const result = await response.json()

      if (result.success) {
        // Store auth token
        if (result.data?.tokens?.accessToken) {
          localStorage.setItem('auth_token', result.data.tokens.accessToken)
          localStorage.setItem('user_data', JSON.stringify(result.data.user))
        }
        
        alert('Регистрацията е успешна!')
        router.push('/auth/login?registered=true')
      } else {
        console.error('Registration failed:', result)
        alert(result.error?.message || 'Грешка при регистрация')
      }
    } catch (error) {
      console.error('Registration error:', error)
      alert('Възникна грешка при регистрацията')
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
      
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4">
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
          Създайте акаунт
        </h2>
        <p className="mt-2 text-center text-sm text-slate-300">
          Или{' '}
          <Link href="/auth/login" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
            влезте в съществуващ акаунт
          </Link>
        </p>
      </div>

      <div className="mt-8 mx-auto w-full max-w-5xl relative z-20 px-4">
        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl py-8 px-4 sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* User Type Selection */}
            <div>
              <label className="text-base font-medium text-slate-200">
                Тип акаунт
              </label>
              <div className="mt-4 space-y-4">
                <div className="flex items-center">
                  <input
                    id="customer"
                    name="userType"
                    type="radio"
                    checked={formData.userType === 'customer'}
                    onChange={() => handleInputChange('userType', 'customer')}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-600 bg-slate-700"
                  />
                  <label htmlFor="customer" className="ml-3 block text-sm font-medium text-slate-300">
                    Клиент - търся услуги
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="service_provider"
                    name="userType"
                    type="radio"
                    checked={formData.userType === 'service_provider'}
                    onChange={() => handleInputChange('userType', 'service_provider')}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-600 bg-slate-700"
                  />
                  <label htmlFor="service_provider" className="ml-3 block text-sm font-medium text-slate-300">
                    Доставчик на услуги - предлагам услуги
                  </label>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-slate-200">
                    Име *
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Иван"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-slate-200">
                    Фамилия *
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Петров"
                  />
                </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-200">
                Имейл адрес *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="ivan@example.com"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-200">
                Телефон *
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                required
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="0889 123 456"
              />
            </div>

            {/* Service Provider specific fields */}
            {formData.userType === 'service_provider' && (
              <>
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-slate-200">
                    Име на компанията *
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Вашата компания ООД"
                  />
                </div>

                <div>
                  <label htmlFor="serviceCategory" className="block text-sm font-medium text-slate-200">
                    Категория услуги *
                  </label>
                  <select
                    id="serviceCategory"
                    name="serviceCategory"
                    required
                    value={formData.serviceCategory}
                    onChange={(e) => handleInputChange('serviceCategory', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Изберете категория</option>
                    {serviceCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City selection */}
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-slate-200">
                    Град
                  </label>
                  <select
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) => {
                      handleInputChange('city', e.target.value)
                      // Clear neighborhood when city changes
                      handleInputChange('neighborhood', '')
                    }}
                    className="mt-1 block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Изберете град</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Neighborhood field - only for Sofia */}
                {formData.city === 'София' && (
                  <div>
                    <label htmlFor="neighborhood" className="block text-sm font-medium text-slate-200">
                      Квартал в София
                    </label>
                    <NeighborhoodSelect
                      value={formData.neighborhood || ''}
                      onChange={(value) => handleInputChange('neighborhood', value)}
                      placeholder="Изберете квартал"
                      className="mt-1 block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                )}

                {/* Tier Selection Button */}
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Избран план</h3>
                      <p className="text-sm text-indigo-400 mt-1">
                        {formData.subscription_tier_id === 'free' && 'Безплатен - 0 лв'}
                        {formData.subscription_tier_id === 'normal' && 'Нормален - 250 лв/месец'}
                        {formData.subscription_tier_id === 'pro' && 'Професионален - 350 лв/месец'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTierSelection(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Промени
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                Парола *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="••••••••"
              />
              {/* Password strength indicator */}
              {formData.password && (
                <div className="mt-3 space-y-2">
                  {getPasswordRequirements(formData.password).map((req, index) => (
                    <div key={index} className="flex items-center text-xs">
                      {req.met ? (
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={req.met ? 'text-green-500 font-medium' : 'text-slate-400'}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200">
                Потвърдете паролата *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="••••••••"
              />
              {/* Password match indicator */}
              {formData.confirmPassword && (
                <div className="mt-2 flex items-center text-xs">
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-500 font-medium">Паролите съвпадат</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="text-red-500">Паролите не съвпадат</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center">
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => handleInputChange('acceptTerms', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-600 rounded bg-slate-700"
              />
              <label htmlFor="acceptTerms" className="ml-2 block text-sm text-slate-300">
                Съгласявам се с{' '}
                <a href="#" className="text-indigo-400 hover:text-indigo-300">
                  условията за ползване
                </a>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/50"
              >
                {loading ? 'Създаване...' : 'Създайте акаунт'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Tier Selection Modal */}
      {showTierSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-slate-800 rounded-2xl shadow-2xl border border-white/10 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Изберете вашия план</h2>
              <button
                onClick={() => setShowTierSelection(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <TierSelector
              selectedTier={formData.subscription_tier_id}
              onSelectTier={(tier) => {
                handleInputChange('subscription_tier_id', tier)
                setShowTierSelection(false)
              }}
            />
          </div>
        </div>
      )}

      {/* SMS Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowVerificationModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h3 className="text-xl font-bold text-white mb-4">Потвърждение на телефон</h3>
            <p className="text-slate-300 text-sm mb-6">
              За да завършите регистрацията, моля потвърдете телефонния си номер
            </p>
            
            <SMSVerification
              phoneNumber={formData.phoneNumber}
              onVerified={() => {
                setPhoneVerified(true)
                setShowVerificationModal(false)
                // Auto-submit after verification
                setTimeout(() => {
                  const form = document.querySelector('form') as HTMLFormElement
                  if (form) form.requestSubmit()
                }, 500)
              }}
              onPhoneChange={(phone: string) => handleInputChange('phoneNumber', phone)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
