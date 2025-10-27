'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function SignupPage() {
  const searchParams = useSearchParams()
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referralValid, setReferralValid] = useState<boolean>(false)
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    businessName: '',
    serviceCategory: '',
    city: '',
    agreeToTerms: false
  })

  useEffect(() => {
    const refCode = searchParams.get('ref')
    if (refCode) {
      setReferralCode(refCode)
      validateReferralCode(refCode)
    }
  }, [searchParams])

  const validateReferralCode = async (code: string) => {
    try {
      console.log('🔍 Validating referral code:', code)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/referrals/validate/${code}`)
      const data = await response.json()
      console.log('🔍 Referral validation response:', data)
      
      setReferralValid(data.data?.valid || false)
      setReferrerName(data.data?.referrerName || null)
      
      if (data.data?.valid) {
        console.log('✅ Referral code is valid for:', data.data?.referrerName)
      } else {
        console.log('❌ Referral code is invalid')
      }
    } catch (err) {
      console.error('❌ Error validating referral code:', err)
      setReferralValid(false)
      setReferrerName(null)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      alert('Паролите не съвпадат!')
      return
    }

    if (!formData.agreeToTerms) {
      alert('Моля, приемете условията за ползване!')
      return
    }

    setLoading(true)

    try {
      // Create user account
      const registrationData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber.startsWith('+359') ? formData.phoneNumber : `+359${formData.phoneNumber.replace(/^0/, '')}`,
        role: 'tradesperson',
        gdprConsents: ['essential_service']
      }
      
      console.log('📝 Sending registration data:', registrationData)
      console.log('🤝 Referral context:', { referralCode, referralValid, referrerName })
      
      const signupResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      })

      if (!signupResponse.ok) {
        const errorData = await signupResponse.text()
        console.error('Registration error response:', errorData)
        throw new Error(`Failed to create account: ${errorData}`)
      }

      const userData = await signupResponse.json()
      const userId = userData.data?.user?.id

      if (!userId) {
        throw new Error('User ID not returned from registration')
      }

      // Create service provider profile
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/marketplace/providers/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.data?.token}`,
        },
        body: JSON.stringify({
          businessName: formData.businessName,
          serviceCategory: formData.serviceCategory,
          city: formData.city,
          phoneNumber: formData.phoneNumber,
          email: formData.email,
        }),
      })

      // Create referral relationship if referral code exists
      if (referralCode && referralValid) {
        try {
          console.log('🤝 Creating referral relationship:', {
            referralCode,
            referredUserId: userId,
            referrerName
          })
          
          const referralResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/referrals/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              referralCode,
              referredUserId: userId
            }),
          })
          
          const referralResult = await referralResponse.json()
          console.log('🤝 Referral creation response:', referralResult)
          console.log('🤝 Referral response status:', referralResponse.status)
          console.log('🤝 Referral response headers:', Object.fromEntries(referralResponse.headers.entries()))
          
          if (referralResponse.ok && referralResult.success) {
            console.log('✅ Referral relationship created successfully')
          } else {
            console.error('❌ Failed to create referral relationship:', {
              status: referralResponse.status,
              statusText: referralResponse.statusText,
              response: referralResult,
              requestData: { referralCode, referredUserId: userId }
            })
          }
        } catch (referralErr) {
          console.error('❌ Failed to create referral relationship:', referralErr)
          // Don't fail the entire signup if referral creation fails
        }
      } else {
        console.log('🤝 No referral code or invalid referral code:', { referralCode, referralValid })
      }

      alert('Регистрацията е успешна! Моля, влезте в профила си.')
      window.location.href = '/login'

    } catch (err) {
      console.error('Signup error:', err)
      alert('Грешка при регистрация. Моля, опитайте отново.')
    } finally {
      setLoading(false)
    }
  }

  const serviceCategories = [
    { value: 'electrician', label: 'Електротехник' },
    { value: 'plumber', label: 'Водопроводчик' },
    { value: 'hvac', label: 'Климатик' },
    { value: 'carpenter', label: 'Дърводелец' },
    { value: 'painter', label: 'Бояджия' },
    { value: 'locksmith', label: 'Ключар' },
    { value: 'cleaner', label: 'Почистване' },
    { value: 'gardener', label: 'Градинар' },
    { value: 'handyman', label: 'Майстор за всичко' },
    { value: 'appliance_repair', label: 'Ремонт на уреди' }
  ]

  const cities = [
    'София', 'Пловдив', 'Варна', 'Бургас', 'Русе', 'Стара Загора', 
    'Плевен', 'Добрич', 'Сливен', 'Шумен', 'Перник', 'Хасково',
    'Ямбол', 'Пазарджик', 'Благоевград', 'Велико Търново', 'Враца', 'Габрово'
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🚀 Присъединете се към ServiceText Pro
            </h1>
            <p className="text-gray-600">
              Създайте профил и започнете да получавате повече клиенти
            </p>
          </div>

          {/* Referral Banner */}
          {referralCode && (
            <div className={`mb-6 p-4 rounded-lg border ${
              referralValid === null 
                ? 'bg-blue-50 border-blue-200' 
                : referralValid 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center">
                <span className="text-2xl mr-3">
                  {referralValid === null ? '🔄' : referralValid ? '🎉' : '❌'}
                </span>
                <div>
                  <h3 className={`font-semibold ${
                    referralValid === null 
                      ? 'text-blue-800' 
                      : referralValid 
                        ? 'text-green-800' 
                        : 'text-red-800'
                  }`}>
                    {referralValid === null 
                      ? 'Проверяване на препоръчителния код...' 
                      : referralValid 
                        ? 'Валиден препоръчителен код!' 
                        : 'Невалиден препоръчителен код'
                    }
                  </h3>
                  <p className={`text-sm ${
                    referralValid === null 
                      ? 'text-blue-600' 
                      : referralValid 
                        ? 'text-green-600' 
                        : 'text-red-600'
                  }`}>
                    {referralValid === null 
                      ? `Код: ${referralCode}` 
                      : referralValid 
                        ? `Препоръчани сте от колега! ${referrerName}` 
                        : 'Този препоръчителен код не съществува'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Signup Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">👤 Лична информация</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Име *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Вашето име"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Фамилия *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Вашата фамилия"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">📞 Контактна информация</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Имейл адрес *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Телефонен номер *
                    </label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      required
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+359..."
                    />
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">🏢 Бизнес информация</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Име на бизнеса
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Име на вашата фирма (по избор)"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Категория услуга *
                      </label>
                      <select
                        name="serviceCategory"
                        required
                        value={formData.serviceCategory}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Изберете категория</option>
                        {serviceCategories.map(category => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Град *
                      </label>
                      <select
                        name="city"
                        required
                        value={formData.city}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Изберете град</option>
                        {cities.map(city => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">🔒 Парола</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Парола *
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Минимум 8 символа"
                      minLength={8}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Потвърдете паролата *
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Повторете паролата"
                    />
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="flex items-start">
                <input
                  type="checkbox"
                  name="agreeToTerms"
                  id="agreeToTerms"
                  required
                  checked={formData.agreeToTerms}
                  onChange={handleInputChange}
                  className="mt-1 mr-3"
                />
                <label htmlFor="agreeToTerms" className="text-sm text-gray-700">
                  Съгласен съм с{' '}
                  <a href="/terms" className="text-blue-600 hover:underline">
                    условията за ползване
                  </a>{' '}
                  и{' '}
                  <a href="/privacy" className="text-blue-600 hover:underline">
                    политиката за поверителност
                  </a>
                  *
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-medium text-white ${
                  loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } transition-colors`}
              >
                {loading ? '⏳ Създаване на профил...' : '🚀 Създай профил'}
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Вече имате профил?{' '}
                <a href="/login" className="text-blue-600 hover:underline font-medium">
                  Влезте тук
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}
