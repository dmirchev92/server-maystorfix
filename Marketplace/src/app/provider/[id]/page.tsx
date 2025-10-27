'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import ReviewsSection from '@/components/ReviewsSection'
import { apiClient } from '@/lib/api'

interface ServiceProvider {
  id: string
  business_name: string
  service_category: string
  description: string
  experience_years: number
  hourly_rate: number
  city: string
  neighborhood: string
  address: string
  phone_number: string
  email: string
  website_url: string
  rating: number
  total_reviews: number
  first_name: string
  last_name: string
  is_verified: boolean
}

export default function ProviderDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const [provider, setProvider] = useState<ServiceProvider | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showContactForm, setShowContactForm] = useState(false)
  const [clickTracked, setClickTracked] = useState(false)
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [lastMouseUpdate, setLastMouseUpdate] = useState(0)

  // Update provider rating by calling the backend
  const updateProviderRating = async (providerId: string) => {
    try {
      console.log('🔄 Updating provider rating for:', providerId)
      // Call the backend to recalculate and update provider rating
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/reviews/provider/${providerId}/update-rating`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        console.log('✅ Provider rating updated successfully')
        // Refetch provider data to get updated rating
        const providerResponse = await apiClient.getProvider(providerId)
        const updatedData = providerResponse.data?.data || providerResponse.data?.provider
        if (updatedData) {
          setProvider(updatedData)
        }
      }
    } catch (err) {
      console.error('❌ Error updating provider rating:', err)
    }
  }

  // Fetch reviews for the provider
  const fetchReviews = async (providerId: string) => {
    try {
      setReviewsLoading(true)
      console.log('🌟 Fetching reviews for provider:', providerId)
      const response = await apiClient.getProviderReviews(providerId)
      
      if (response.data?.success && response.data?.data) {
        // Check if data is nested (like in ReviewsSection)
        const reviewsData = response.data.data.reviews || response.data.data
        setReviews(reviewsData)
      } else {
        setReviews([])
      }
    } catch (err) {
      console.error('❌ Error fetching reviews:', err)
      setReviews([])
    } finally {
      setReviewsLoading(false)
    }
  }

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        setLoading(true)
        setError(null)

        const providerId = params.id as string
        console.log('🔍 Fetching provider:', providerId)

        const response = await apiClient.getProvider(providerId)
        
        const data = response.data?.data || response.data?.provider
        if (data) {
          console.log('📦 Provider data loaded:', data)
          console.log('🖼️ Gallery data:', data.gallery)
          setProvider(data)
          // Fetch reviews after provider is loaded
          await fetchReviews(providerId)
          // Also update provider rating after fetching reviews
          await updateProviderRating(providerId)
        } else {
          setError('Service provider not found')
        }
        
      } catch (err) {
        console.error('❌ Error fetching provider:', err)
        setError('Failed to load service provider details')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchProvider()
    }
  }, [params.id])

  // Separate useEffect for click tracking to prevent duplicate calls
  useEffect(() => {
    if (!provider || !params.id) return

    const providerId = params.id as string
    
    // Use user-based tracking - 1 click per user per profile forever
    // Get current user ID to create unique tracking key
    const userData = localStorage.getItem('user_data')
    let currentUserId = null
    
    try {
      if (userData) {
        const user = JSON.parse(userData)
        currentUserId = user.id
      }
    } catch (e) {
      console.error('Error parsing user data:', e)
    }
    
    // Create unique key combining user ID and profile ID
    const userClickKey = currentUserId ? `user_${currentUserId}_clicked_profile_${providerId}` : `anonymous_clicked_profile_${providerId}`
    const hasUserClickedBefore = localStorage.getItem(userClickKey)
    const canTrackClick = !hasUserClickedBefore
    
    console.log(`[CLICK TRACKING] Provider: ${providerId}, User: ${currentUserId || 'anonymous'}, Can track: ${canTrackClick}, Click tracked state: ${clickTracked}`)
    
    if (canTrackClick && !clickTracked) {
      const trackClick = async () => {
        try {
          // Mark as tracked immediately to prevent duplicate calls
          setClickTracked(true)
          localStorage.setItem(userClickKey, 'true')
          
          const trackUrl = `${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/referrals/track/${providerId}`;
          console.log(`[FRONTEND] Tracking profile click: ${trackUrl}`);
          
          // Get or generate visitor ID
          let visitorId = localStorage.getItem('visitor_id');
          if (!visitorId) {
            visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('visitor_id', visitorId);
            console.log(`[FRONTEND] Generated new visitor ID: ${visitorId}`);
          } else {
            console.log(`[FRONTEND] Using existing visitor ID: ${visitorId}`);
          }
          
          // Check if user is authenticated and get their user ID
          const userData = localStorage.getItem('user_data')
          const customerUserId = userData ? JSON.parse(userData).id : null
          
          console.log(`[FRONTEND] Customer user ID: ${customerUserId || 'null (not authenticated)'}`)
          
          const trackResponse = await apiClient.trackReferralClick(providerId, {
            customerUserId,
            visitorId
          });
          
          console.log(`[FRONTEND] Track response:`, trackResponse.data);
          
        } catch (trackErr) {
          console.error('Error tracking profile click:', trackErr)
          // Reset tracking state on error so it can be retried
          setClickTracked(false)
          localStorage.removeItem(userClickKey)
        }
      }

      trackClick()
    }
  }, [provider, params.id, clickTracked])

  const getCategoryDisplayName = (category: string | undefined) => {
    if (!category) return 'Общи';
    
    const categoryNames: { [key: string]: string } = {
      'electrician': 'Електротехник',
      'plumber': 'Водопроводчик',
      'hvac': 'Климатик',
      'carpenter': 'Дърводелец',
      'painter': 'Бояджия',
      'locksmith': 'Ключар',
      'cleaner': 'Почистване',
      'gardener': 'Градинар',
      'handyman': 'Майстор за всичко',
      'appliance_repair': 'Ремонт на уреди'
    }
    return categoryNames[category] || category
  }

  // Reviews are now fetched from API instead of using mock data

  // Render stars with half-star support - PROPER HALF STARS
  const renderStarsDisplay = (rating: number) => {
    const stars = []
    
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating)) {
        // Full star - solid yellow star
        stars.push(<span key={i} className="text-yellow-500">★</span>)
      } else if (i === Math.floor(rating) + 1 && rating % 1 !== 0) {
        // Half star - half yellow, half gray
        stars.push(
          <span key={i} className="relative inline-block">
            <span className="text-gray-300">★</span>
            <span 
              className="absolute top-0 left-0 text-yellow-500 overflow-hidden"
              style={{ width: '50%' }}
            >
              ★
            </span>
          </span>
        )
      } else {
        // Empty star - gray star
        stars.push(<span key={i} className="text-gray-300">★</span>)
      }
    }
    return stars
  }

  // Simple stars for text display (backwards compatibility)
  const getStars = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push('⭐')
    }
    if (hasHalfStar) {
      stars.push('⭐')
    }
    while (stars.length < 5) {
      stars.push('☆')
    }
    return stars.join('')
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement contact form submission
    alert('Съобщението ще бъде изпратено скоро!')
    setShowContactForm(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto"></div>
            <p className="mt-4 text-slate-300">Зареждане...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !provider) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-6 text-center backdrop-blur-sm">
            <p className="text-red-300">❌ {error || 'Услугата не е намерена'}</p>
            <a 
              href="/search" 
              className="mt-4 inline-block bg-red-600/80 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
            >
              Върни се към търсенето
            </a>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 relative overflow-hidden">
      {/* Industrial background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-br from-purple-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
      </div>
      
      <Header />
      
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm text-slate-300">
            <li><a href="/" className="hover:text-indigo-400 transition-colors">Начало</a></li>
            <li>›</li>
            <li><a href="/search" className="hover:text-indigo-400 transition-colors">Търсене</a></li>
            <li>›</li>
            <li className="text-white font-medium">{provider.business_name}</li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 flex flex-col">
            {/* Provider Header */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-6 shadow-xl border border-white/20">
              <div className="flex items-start gap-6 mb-8">
                {/* Profile Picture */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                    {(provider as any).profileImageUrl ? (
                      <img 
                        src={(provider as any).profileImageUrl} 
                        alt={`${provider.first_name} ${provider.last_name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-2xl font-semibold">
                        {provider.first_name?.charAt(0)}{provider.last_name?.charAt(0)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Provider Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-white mb-1">
                        {(provider as any).businessName || provider.business_name || `${provider.first_name} ${provider.last_name}`}
                        {provider.is_verified && (
                          <span className="ml-2 text-green-400 text-lg">✓</span>
                        )}
                      </h1>
                      <p className="text-indigo-300 font-medium mb-2">
                        {getCategoryDisplayName((provider as any).serviceCategory || provider.service_category)}
                      </p>
                      <p className="text-slate-300 text-sm">
                        {(provider as any).experienceYears || provider.experience_years || 0} години опит | {provider.city}, {provider.neighborhood}
                      </p>
                    </div>

                    {/* Rating Stars - Right Side */}
                    <div className="flex flex-col items-end ml-4">
                      <div className="flex items-center mb-1">
                        <div className="flex space-x-1">
                          {renderStarsDisplay(provider.rating || 0)}
                        </div>
                      </div>
                      <span className="text-slate-300 text-sm">
                        {Number(provider.rating || 0).toFixed(1)} ({provider.total_reviews || 0} отзива)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* About Section */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">За мен</h2>
                <p className="text-slate-300 leading-relaxed">
                  {provider.description || `Професионални ${getCategoryDisplayName((provider as any).serviceCategory || provider.service_category).toLowerCase()} услуги от ${provider.first_name} ${provider.last_name}. Качество и надеждност с ${(provider as any).experienceYears || provider.experience_years || 0} години опит в сферата.`}
                </p>
              </div>
            </div>

            {/* Services Section */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 shadow-xl border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4">Предлагани услуги</h2>
              <div className="grid gap-3">
                <div className="flex items-center p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                  <span className="mr-3">🔧</span>
                  <span className="text-slate-200">Основни {getCategoryDisplayName((provider as any).serviceCategory || provider.service_category).toLowerCase()} услуги</span>
                </div>
                <div className="flex items-center p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                  <span className="mr-3">🚨</span>
                  <span className="text-slate-200">Спешни повиквания</span>
                </div>
                <div className="flex items-center p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                  <span className="mr-3">📋</span>
                  <span className="text-slate-200">Консултации и оценки</span>
                </div>
              </div>
            </div>

            {/* Gallery Section */}
            {/* Gallery Section */}
            {(provider as any).gallery && (provider as any).gallery.length > 0 ? (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 shadow-xl border border-white/20">
                <h2 className="text-xl font-semibold text-white mb-4">📸 Галерия от завършени проекти</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(provider as any).gallery.map((imageUrl: string, index: number) => (
                    <div key={index} className="aspect-square rounded-lg overflow-hidden border-2 border-white/20 hover:border-indigo-400 transition-all duration-300 group cursor-pointer">
                      <img
                        src={imageUrl}
                        alt={`Gallery image ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        onClick={() => window.open(imageUrl, '_blank')}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-slate-400 text-center mt-4 text-sm">
                  Кликнете на снимка за увеличен изглед
                </p>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 shadow-xl border border-white/20">
                <h2 className="text-xl font-semibold text-white mb-4">Галерия от завършени проекти</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Placeholder for future gallery images */}
                  <div className="aspect-square bg-white/5 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
                    <span className="text-slate-400 text-4xl">📷</span>
                  </div>
                  <div className="aspect-square bg-white/5 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
                    <span className="text-slate-400 text-4xl">📷</span>
                  </div>
                  <div className="aspect-square bg-white/5 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
                    <span className="text-slate-400 text-4xl">📷</span>
                  </div>
                </div>
                <p className="text-slate-400 text-center mt-4">
                  Галерията ще бъде попълнена с примери от завършени проекти
                </p>
              </div>
            )}

            {/* Certificates Section - Only show if certificates exist */}
            {(provider as any).certificates && (provider as any).certificates.length > 0 && (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 shadow-xl border border-white/20">
                <h2 className="text-xl font-semibold text-white mb-4">Сертификати и квалификации</h2>
                <div className="grid gap-4">
                  {(provider as any).certificates.map((cert: any, index: number) => (
                    <div key={cert.id || index} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1">{cert.title}</h3>
                          {cert.issuedBy && (
                            <p className="text-sm text-slate-300 mb-1">Издаден от: {cert.issuedBy}</p>
                          )}
                          {cert.issuedAt && (
                            <p className="text-sm text-slate-400">
                              Дата: {new Date(cert.issuedAt).toLocaleDateString('bg-BG')}
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          <span className="text-2xl">🏆</span>
                        </div>
                      </div>
                      {cert.fileUrl && (
                        <div className="mt-3">
                          <a 
                            href={cert.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
                          >
                            📄 Виж сертификата
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews Section removed - now integrated into bottom carousel */}

            {/* Spacer to align with advertisement section */}
            <div className="flex-1"></div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 flex flex-col">
          {/* Contact Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 sticky top-4 shadow-xl border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">Свържете се</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center">
                <span className="mr-3">📞</span>
                <a 
                  href={`tel:${(provider as any).profilePhone || provider.phone_number}`}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {(provider as any).profilePhone || provider.phone_number}
                </a>
              </div>
              <div className="flex items-center">
                <span className="mr-3">📧</span>
                <a 
                  href={`mailto:${provider.email}`}
                  className="text-indigo-400 hover:text-indigo-300 break-all transition-colors"
                >
                  {provider.email}
                </a>
              </div>
              {provider.website_url && (
                <div className="flex items-center">
                  <span className="mr-3">🌐</span>
                  <a 
                    href={provider.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 break-all transition-colors"
                  >
                    Уебсайт
                  </a>
                </div>
              )}
              {provider.address && (
                <div className="flex items-start">
                  <span className="mr-3 mt-1">📍</span>
                  <span className="text-slate-300">{provider.address}</span>
                </div>
              )}
            </div>

            {/* Only show contact button if user is not viewing their own profile */}
            {user?.id !== provider.id && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowContactForm(true)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-medium"
                >
                  ✉️ Изпрати съобщение
                </button>
              </div>
            )}
            
            {/* Show message when viewing own profile */}
            {user?.id === provider.id && (
              <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-4 text-center">
                <p className="text-blue-200 text-sm">
                  👤 Това е вашият профил
                </p>
              </div>
            )}
          </div>

          {/* Quick Info */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">Бърза информация</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Категория:</span>
                <span className="text-slate-200">{getCategoryDisplayName((provider as any).serviceCategory || provider.service_category)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Локация:</span>
                <span className="text-slate-200">{provider.city}, {provider.neighborhood}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Опит:</span>
                <span className="text-slate-200">{(provider as any).experienceYears || provider.experience_years || 0} години</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Телефон:</span>
                <span className="text-slate-200">{(provider as any).profilePhone || provider.phone_number || 'Няма телефон'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Рейтинг:</span>
                <span className="text-slate-200">{Number(provider.rating || 0).toFixed(1)}/5</span>
              </div>
            </div>
          </div>

          {/* Advertisement Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mt-6 flex-1 shadow-xl border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">🎯 Специална оферта</h3>
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-6 border-l-4 border-green-400">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-2">💰</span>
                <h4 className="font-bold text-green-300">20% отстъпка за нови клиенти!</h4>
              </div>
              <p className="text-slate-200 text-sm mb-4">
                Възползвайте се от специалната ни оферта за първо посещение. Валидна до края на месеца!
              </p>
              <div className="space-y-3 text-sm mb-4">
                <div className="flex items-center">
                  <span className="text-green-400 mr-2">✓</span>
                  <span className="text-slate-200">Безплатна консултация и оглед</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-400 mr-2">✓</span>
                  <span className="text-slate-200">Гаранция 2 години на всички услуги</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-400 mr-2">✓</span>
                  <span className="text-slate-200">24/7 спешни услуги</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-400 mr-2">✓</span>
                  <span className="text-slate-200">Професионални инструменти и материали</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-400 mr-2">✓</span>
                  <span className="text-slate-200">Почистване след работа включено</span>
                </div>
              </div>
              <div className="bg-yellow-500/20 rounded-lg p-3 mb-4 border border-yellow-400/30">
                <div className="flex items-center mb-2">
                  <span className="text-lg mr-2">🏆</span>
                  <span className="font-semibold text-yellow-300">Защо да изберете нас?</span>
                </div>
                <ul className="text-xs text-slate-200 space-y-1">
                  <li>• Над 8 години опит в сферата</li>
                  <li>• Сертифицирани специалисти</li>
                  <li>• Фиксирани цени без скрити такси</li>
                  <li>• Работим и в почивни дни</li>
                </ul>
              </div>
              <div className="bg-blue-500/20 rounded-lg p-3 mb-4 border border-blue-400/30">
                <div className="flex items-center mb-2">
                  <span className="text-lg mr-2">📞</span>
                  <span className="font-semibold text-blue-300">Как да се свържете с нас?</span>
                </div>
                <ul className="text-xs text-slate-200 space-y-1">
                  <li>• Позвънете на 0888665489</li>
                  <li>• Изпратете съобщение чрез формата</li>
                  <li>• Пишете ни на WhatsApp или Viber</li>
                  <li>• Работно време: 08:00 - 20:00 ч.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Contact Form Modal */}
        {showContactForm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-white/20 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Свържете се с {provider.business_name}</h3>
                <button
                  onClick={() => setShowContactForm(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Вашето име
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Въведете вашето име"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    required
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="+359..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Съобщение
                  </label>
                  <textarea
                    required
                    rows={4}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Опишете услугата, от която се нуждаете..."
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowContactForm(false)}
                    className="flex-1 border border-slate-600 text-slate-300 py-2 px-4 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Отказ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 px-4 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                  >
                    Изпрати
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center">
              <div className="flex items-center justify-between max-w-5xl mx-auto mb-4">
                {/* Left side - Rating with stars */}
                <div className="flex items-center space-x-3 bg-white/15 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 shadow-lg">
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold text-white leading-none">{Number(provider.rating || 0).toFixed(1)}</span>
                    <div className="flex space-x-1 text-lg mt-1">
                      {renderStarsDisplay(provider.rating || 0)}
                    </div>
                  </div>
                </div>

                {/* Center - Title */}
                <div className="bg-white/15 backdrop-blur-md rounded-2xl px-8 py-4 border border-white/20 shadow-lg">
                  <h2 className="text-3xl font-bold text-white tracking-wide">💬 Отзиви ⭐</h2>
                </div>

                {/* Right side - Review count */}
                <div className="flex items-center space-x-3 bg-white/15 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 shadow-lg">
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold text-white leading-none">{reviews.length || provider.total_reviews || 0}</span>
                    <span className="text-white/80 text-sm font-medium mt-1">отзива</span>
                  </div>
                </div>
              </div>
              <p className="text-white/90 text-lg font-medium">Какво казват нашите клиенти</p>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-4 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-6 right-16 w-16 h-16 bg-white/10 rounded-full blur-lg"></div>
          <div className="absolute top-8 right-24 w-12 h-12 bg-white/10 rounded-full blur-md"></div>
        </div>

        {/* Scrolling Reviews Section */}
        <style jsx>{`
          @keyframes scrollLeft {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
        <div className="bg-gradient-to-r from-purple-200 to-blue-200 border-t border-purple-300 py-4 overflow-hidden">
          {reviewsLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-purple-700">Зареждане на отзиви...</span>
            </div>
          ) : reviews.length > 0 ? (
            <div 
              className="relative overflow-hidden py-4"
              onMouseEnter={(e) => {
                // Pause animation when mouse enters the carousel area
                const scrollElement = e.currentTarget.querySelector('.scroll-element') as HTMLElement
                if (scrollElement) {
                  scrollElement.style.animationPlayState = 'paused'
                }
              }}
              onMouseMove={(e) => {
                const container = e.currentTarget
                const rect = container.getBoundingClientRect()
                const mouseX = e.clientX - rect.left
                const containerWidth = rect.width
                const scrollPercentage = mouseX / containerWidth
                
                // Find the scrolling element and control position manually while paused
                const scrollElement = container.querySelector('.scroll-element') as HTMLElement
                if (scrollElement) {
                  // Keep animation paused and control position manually based on mouse
                  scrollElement.style.animationPlayState = 'paused'
                  scrollElement.style.animation = 'none' // Completely disable animation
                  // Manual position control - move based on mouse position
                  const maxTranslate = -100 // Full range of movement
                  const translateX = scrollPercentage * maxTranslate
                  scrollElement.style.transform = `translateX(${translateX}%)`
                  scrollElement.style.transition = 'transform 0.1s ease-out'
                }
              }}
              onMouseLeave={(e) => {
                // Resume animation when mouse leaves the entire area
                const scrollElement = e.currentTarget.querySelector('.scroll-element') as HTMLElement
                if (scrollElement) {
                  // Clear manual transform and resume animation
                  scrollElement.style.transform = ''
                  scrollElement.style.transition = ''
                  scrollElement.style.animation = 'scrollLeft 20s linear infinite' // Restore animation
                  scrollElement.style.animationPlayState = 'running'
                }
              }}
            >
              <div 
                className="flex scroll-element"
                style={{
                  animation: 'scrollLeft 20s linear infinite',
                  width: 'max-content',
                  animationName: 'scrollLeft',
                  animationDuration: '20s',
                  animationTimingFunction: 'linear',
                  animationIterationCount: 'infinite',
                  gap: '24px' // Professional spacing between reviews
                }}
              >
                {/* Triple the reviews for true seamless infinite scroll */}
                {[...Array(10).fill(reviews).flat(), ...Array(10).fill(reviews).flat()].map((review, index) => (
                  <div key={`${review.id}-${index}`} className="flex-shrink-0 bg-white rounded-lg p-4 shadow-sm min-w-[300px] max-w-[300px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{review.customer_name || 'Анонимен клиент'}</span>
                      <div className="flex space-x-1">
                        {renderStarsDisplay(review.rating || 0)}
                      </div>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed">{review.comment || 'Няма коментар'}</p>
                    <p className="text-gray-500 text-xs mt-2">
                      {review.created_at ? new Date(review.created_at).toLocaleDateString('bg-BG') : 'Неизвестна дата'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center py-8">
              <div className="text-center">
                <span className="text-4xl mb-2 block">⭐</span>
                <p className="text-purple-700 font-medium">Все още няма отзиви</p>
                <p className="text-purple-600 text-sm">Бъдете първият, който ще остави отзив!</p>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  )
}


