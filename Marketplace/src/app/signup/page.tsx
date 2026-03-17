'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import LocationAutocomplete from '@/components/LocationAutocomplete'
import { SERVICE_CATEGORIES } from '@/constants/serviceCategories'

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
    neighborhood: '',
    subscriptionTier: 'free' as 'free' | 'normal' | 'pro',
    agreeToTerms: false
  })
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [locationDetected, setLocationDetected] = useState(false)

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/referrals/validate/${code}`)
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

  // City name mapping (English -> Bulgarian)
  const cityNameMapping: Record<string, string> = {
    'Sofia': 'София',
    'Plovdiv': 'Пловдив',
    'Varna': 'Варна',
    'Burgas': 'Бургас',
    'Rousse': 'Русе',
    'Ruse': 'Русе',
    'Stara Zagora': 'Стара Загора',
    'Pleven': 'Плевен',
    'Dobrich': 'Добрич',
    'Sliven': 'Сливен',
    'Shumen': 'Шумен',
    'Pernik': 'Перник',
    'Haskovo': 'Хасково',
    'Yambol': 'Ямбол',
    'Pazardzhik': 'Пазарджик',
    'Blagoevgrad': 'Благоевград',
    'Veliko Tarnovo': 'Велико Търново',
    'Vratsa': 'Враца',
    'Gabrovo': 'Габрово',
  }

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      alert('Вашият браузър не поддържа геолокация')
      return
    }

    setDetectingLocation(true)
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        
        try {
          // Use Google reverse geocoding to get city and neighborhood directly
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'AIzaSyAXQf53JEFPgoxHoCXz3lMKQ5itjHcTd4A'
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}&language=bg`
          const geoResponse = await fetch(geocodeUrl)
          const geoData = await geoResponse.json()
          
          let detectedCity = ''
          let detectedNeighborhood = ''
          
          if (geoData.results?.[0]?.address_components) {
            for (const comp of geoData.results[0].address_components) {
              // City
              if (comp.types.includes('locality')) {
                detectedCity = cityNameMapping[comp.long_name] || comp.long_name
              }
              // Fallback for Sofia
              if (comp.types.includes('administrative_area_level_1') && !detectedCity) {
                const areaName = comp.long_name
                if (areaName === 'Sofia City Province' || areaName === 'Sofia-City' || areaName === 'София-град') {
                  detectedCity = 'София'
                }
              }
              // Neighborhood - check multiple types Google uses
              if (comp.types.includes('sublocality_level_1') || 
                  comp.types.includes('sublocality') || 
                  comp.types.includes('neighborhood')) {
                detectedNeighborhood = comp.long_name
              }
            }
          }
          
          // Use Google's data directly - more accurate than our database coordinates
          const finalCity = detectedCity || ''
          const finalNeighborhood = detectedNeighborhood || ''
          
          // Update form
          if (finalCity || finalNeighborhood) {
            setFormData(prev => ({
              ...prev,
              city: finalCity || prev.city,
              neighborhood: detectedNeighborhood || prev.neighborhood,
            }))
            setLocationDetected(true)
          } else {
            alert('Не успяхме да определим местоположението. Моля изберете ръчно.')
          }
        } catch (error) {
          console.error('Location detection error:', error)
          alert('Грешка при определяне на местоположението')
        } finally {
          setDetectingLocation(false)
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
        setDetectingLocation(false)
        if (error.code === error.PERMISSION_DENIED) {
          alert('Моля, разрешете достъп до местоположението в браузъра си')
        } else {
          alert('Не можахме да определим местоположението ви')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
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
        subscription_tier_id: formData.subscriptionTier,
        gdprConsents: ['essential_service']
      }
      
      console.log('📝 Sending registration data:', registrationData)
      console.log('🤝 Referral context:', { referralCode, referralValid, referrerName })
      
      const signupResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/auth/register`, {
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
      const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/marketplace/providers/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.data?.token}`,
        },
        body: JSON.stringify({
          userId: userId,
          profile: {
            businessName: formData.businessName,
            serviceCategory: formData.serviceCategory,
            city: formData.city,
            neighborhood: formData.neighborhood,
            phoneNumber: formData.phoneNumber,
            email: formData.email,
          }
        }),
      })

      if (!profileResponse.ok) {
        console.error('Profile creation failed:', await profileResponse.text())
        // Continue anyway - user can complete profile later
      } else {
        console.log('✅ Profile created successfully with category:', formData.serviceCategory)
      }

      // Create referral relationship if referral code exists
      if (referralCode && referralValid) {
        try {
          console.log('🤝 Creating referral relationship:', {
            referralCode,
            referredUserId: userId,
            referrerName
          })
          
          const referralResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/referrals/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              referralCode,
              referredUserId: userId,
              subscriptionTier: formData.subscriptionTier
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              🚀 Присъединете се към SnapFix
            </h1>
            <p className="text-slate-300">
              Създайте профил и започнете да получавате повече клиенти
            </p>
          </div>

          {/* Referral Banner */}
          {referralCode && (
            <div className={`mb-6 p-4 rounded-lg border backdrop-blur-md ${
              referralValid === null 
                ? 'bg-blue-500/20 border-blue-400/30' 
                : referralValid 
                  ? 'bg-green-500/20 border-green-400/30' 
                  : 'bg-red-500/20 border-red-400/30'
            }`}>
              <div className="flex items-center">
                <span className="text-2xl mr-3">
                  {referralValid === null ? '🔄' : referralValid ? '🎉' : '❌'}
                </span>
                <div>
                  <h3 className={`font-semibold ${
                    referralValid === null 
                      ? 'text-blue-300' 
                      : referralValid 
                        ? 'text-green-300' 
                        : 'text-red-300'
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
                      ? 'text-blue-200' 
                      : referralValid 
                        ? 'text-green-200' 
                        : 'text-red-200'
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
          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">👤 Лична информация</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Име *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Вашето име"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Фамилия *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Вашата фамилия"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">📞 Контактна информация</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Имейл адрес *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Телефонен номер *
                    </label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      required
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="+359..."
                    />
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">🏢 Бизнес информация</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Име на бизнеса
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Име на вашата фирма (по избор)"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Категория услуга *
                      </label>
                      <select
                        name="serviceCategory"
                        required
                        value={formData.serviceCategory}
                        onChange={handleInputChange}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent [&>option]:bg-slate-800 [&>option]:text-white"
                      >
                        <option value="">Изберете категория</option>
                        {SERVICE_CATEGORIES.map(category => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {/* Location Section */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      📍 Местоположение *
                    </label>
                    
                    {/* Google Places Autocomplete */}
                    <LocationAutocomplete
                      onLocationSelect={(location) => {
                        setFormData(prev => ({
                          ...prev,
                          city: location.city,
                          neighborhood: location.neighborhood
                        }))
                        setLocationDetected(true)
                      }}
                      placeholder="Въведете адрес, квартал или град..."
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    
                    <p className="text-slate-400 text-xs mt-2">
                      💡 Започнете да пишете и изберете от предложенията на Google Maps
                    </p>
                    
                    {/* Show detected location */}
                    {locationDetected && formData.city && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          <div className="text-sm">
                            <span className="text-green-300 font-medium">
                              {formData.city}
                            </span>
                            {formData.neighborhood && (
                              <span className="text-green-200">
                                {' • '}{formData.neighborhood}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Auto-detect GPS button */}
                    <button
                      type="button"
                      onClick={detectLocation}
                      disabled={detectingLocation}
                      className="w-full mt-3 py-2 px-3 text-sm rounded-lg border border-white/20 text-slate-300 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                    >
                      {detectingLocation ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Определяне...
                        </>
                      ) : (
                        <>🎯 Или използвай GPS местоположение</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Subscription Tier */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">💎 Изберете план</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* FREE Tier */}
                  <div 
                    onClick={() => setFormData(prev => ({ ...prev, subscriptionTier: 'free' }))}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                      formData.subscriptionTier === 'free' 
                        ? 'border-indigo-500 bg-indigo-500/20' 
                        : 'border-white/20 bg-white/5 hover:border-white/40'
                    }`}
                  >
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-white mb-1">FREE</h3>
                      <p className="text-2xl font-bold text-white mb-2">0 €</p>
                      <p className="text-xs text-slate-300 mb-3">пробен период</p>
                      <ul className="text-xs text-slate-300 space-y-1 text-left">
                        <li>✓ 2 категории</li>
                        <li>✓ До 5 снимки</li>
                        <li>✓ Основна видимост</li>
                      </ul>
                    </div>
                  </div>

                  {/* NORMAL Tier */}
                  <div 
                    onClick={() => setFormData(prev => ({ ...prev, subscriptionTier: 'normal' }))}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                      formData.subscriptionTier === 'normal' 
                        ? 'border-green-500 bg-green-500/20' 
                        : 'border-white/20 bg-white/5 hover:border-white/40'
                    }`}
                  >
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-white mb-1">NORMAL</h3>
                      <p className="text-xl font-bold text-white mb-1">1,400 €/година</p>
                      <p className="text-sm text-green-400 mb-1">или 130 €/месец</p>
                      <p className="text-xs text-slate-400 mb-3">10% отстъпка при първа покупка</p>
                      <ul className="text-xs text-slate-300 space-y-1 text-left">
                        <li>✓ 1,000 точки/година</li>
                        <li>✓ Заявки до 1,000 € бюджет</li>
                        <li>✓ SMS известия (2 точки/SMS)</li>
                        <li>✓ 20 снимки в галерията</li>
                      </ul>
                    </div>
                  </div>

                  {/* PRO Tier */}
                  <div 
                    onClick={() => setFormData(prev => ({ ...prev, subscriptionTier: 'pro' }))}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                      formData.subscriptionTier === 'pro' 
                        ? 'border-purple-500 bg-purple-500/20' 
                        : 'border-white/20 bg-white/5 hover:border-white/40'
                    }`}
                  >
                    <div className="text-center">
                      <div className="inline-block bg-purple-500 text-white text-xs px-2 py-1 rounded-full mb-2">
                        ⭐ Препоръчан
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">PRO</h3>
                      <p className="text-xl font-bold text-white mb-1">1,900 €/година</p>
                      <p className="text-sm text-purple-400 mb-1">или 230 €/месец</p>
                      <p className="text-xs text-slate-400 mb-3">15% отстъпка при първа покупка</p>
                      <ul className="text-xs text-slate-300 space-y-1 text-left">
                        <li>✓ 2,000 точки/година</li>
                        <li>✓ До 100 снимки</li>
                        <li>✓ Всички бюджети (до 10,000 €)</li>
                        <li>✓ PRO значка + VIP видимост</li>
                        <li>✓ Система за наддаване</li>
                        <li>✓ Приоритетна поддръжка</li>
                      </ul>
                    </div>
                  </div>
                </div>
                {referralCode && referralValid && (formData.subscriptionTier === 'normal' || formData.subscriptionTier === 'pro') && (
                  <div className="mt-4 p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
                    <p className="text-sm text-green-300 text-center">
                      🎉 Вие и {referrerName} ще получите бонус точки при регистрация!
                    </p>
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">🔒 Парола</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Парола *
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Минимум 8 символа"
                      minLength={8}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Потвърдете паролата *
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                  className="mt-1 mr-3 accent-indigo-500"
                />
                <label htmlFor="agreeToTerms" className="text-sm text-slate-300">
                  Съгласен съм с{' '}
                  <a href="/terms" className="text-indigo-400 hover:text-indigo-300 hover:underline">
                    условията за ползване
                  </a>{' '}
                  и{' '}
                  <a href="/privacy" className="text-indigo-400 hover:text-indigo-300 hover:underline">
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
                    ? 'bg-slate-600 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } transition-colors shadow-lg`}
              >
                {loading ? '⏳ Създаване на профил...' : '🚀 Създай профил'}
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-slate-300">
                Вече имате профил?{' '}
                <a href="/login" className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium">
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
