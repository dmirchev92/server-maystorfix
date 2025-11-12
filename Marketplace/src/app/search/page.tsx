'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import UnifiedCaseModal from '@/components/UnifiedCaseModal'
import { Footer } from '@/components/Footer'
import { apiClient } from '@/lib/api'
import { sofiaNeighborhoods } from '@/components/NeighborhoodSelect'

interface ServiceProvider {
  id: string
  business_name: string
  service_category: string
  service_categories?: string[]
  description: string
  experience_years: number
  hourly_rate: number
  city: string
  neighborhood: string
  phone_number: string
  email: string
  rating: number
  total_reviews: number
  completed_projects?: number
  first_name: string
  last_name: string
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const [providers, setProviders] = useState<ServiceProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [caseModalOpen, setCaseModalOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null)
  const [realTimeUpdates, setRealTimeUpdates] = useState(0) // Counter to track updates
  const [socketService, setSocketService] = useState<any>(null)
  const [isSocketConnected, setIsSocketConnected] = useState(false)

  // Get search parameters
  const category = searchParams.get('category')
  const city = searchParams.get('city')
  const neighborhood = searchParams.get('neighborhood')

  // Local filter state
  const [filters, setFilters] = useState({
    category: category || '',
    city: city || '',
    neighborhood: neighborhood || ''
  })

  // Update local filters when URL params change
  useEffect(() => {
    setFilters({
      category: category || '',
      city: city || '',
      neighborhood: neighborhood || ''
    })
  }, [category, city, neighborhood])

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true)
        setError(null)

        const filters: any = {}
        if (category) filters.category = category
        if (city) filters.city = city
        if (neighborhood) filters.neighborhood = neighborhood

        console.log('🔍 Searching with filters:', filters)

        const response = await apiClient.searchProviders(filters)
        
        console.log('🔍 Full API response:', response)
        console.log('🔍 Response data:', response.data)
        const providersData = response.data?.data
        console.log('🔍 Providers array:', providersData)

        if (Array.isArray(providersData)) {
          console.log('✅ Setting providers:', providersData.length, 'items')
          setProviders(providersData as any)
        } else {
          console.log('❌ No providers found in response, setting empty array')
          setProviders([])
        }
        
      } catch (err) {
        console.error('❌ Error fetching providers:', err)
        setError('Failed to load service providers. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchProviders()
  }, [category, city, neighborhood])

  // Initialize socket service (client-side only)
  useEffect(() => {
    const initSocket = async () => {
      try {
        const { marketplaceSocket } = await import('@/lib/socket')
        setSocketService(marketplaceSocket)
        
        // Monitor connection status
        const checkConnection = () => {
          setIsSocketConnected(marketplaceSocket?.getConnectionStatus() || false)
        }
        
        checkConnection()
        const interval = setInterval(checkConnection, 1000)
        
        return () => clearInterval(interval)
      } catch (error) {
        console.error('Failed to load socket service:', error)
      }
    }
    
    initSocket()
  }, [])

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!socketService) {
      console.log('⚠️ Socket service not available yet')
      return
    }
    
    console.log('🔌 Setting up real-time provider updates...')
    
    // Listen for provider profile updates
    socketService.onProviderProfileUpdated((data: any) => {
      console.log('📡 Provider profile updated:', data.providerId, data.provider)
      
      setProviders(currentProviders => {
        const updatedProviders = [...currentProviders]
        const existingIndex = updatedProviders.findIndex(p => p.id === data.providerId)
        
        if (existingIndex >= 0) {
          // Update existing provider
          const updatedProvider = {
            ...updatedProviders[existingIndex],
            business_name: data.provider.business_name,
            service_category: data.provider.service_category,
            description: data.provider.description,
            experience_years: data.provider.experience_years,
            hourly_rate: data.provider.hourly_rate,
            city: data.provider.city,
            neighborhood: data.provider.neighborhood,
            phone_number: data.provider.phone_number,
            email: data.provider.email,
            first_name: data.provider.first_name,
            last_name: data.provider.last_name,
            rating: data.provider.rating || 0,
            total_reviews: data.provider.total_reviews || 0,
            completed_projects: data.provider.completed_projects || 0
          }
          
          updatedProviders[existingIndex] = updatedProvider
          console.log('✅ Updated existing provider in list:', data.providerId)
        } else {
          // Check if this new provider matches current search filters
          const matchesFilters = (
            (!category || data.provider.service_category === category) &&
            (!city || data.provider.city === city) &&
            (!neighborhood || data.provider.neighborhood === neighborhood)
          )
          
          if (matchesFilters) {
            // Add new provider to the list
            const newProvider = {
              id: data.provider.id,
              business_name: data.provider.business_name,
              service_category: data.provider.service_category,
              description: data.provider.description,
              experience_years: data.provider.experience_years,
              hourly_rate: data.provider.hourly_rate,
              city: data.provider.city,
              neighborhood: data.provider.neighborhood,
              phone_number: data.provider.phone_number,
              email: data.provider.email,
              first_name: data.provider.first_name,
              last_name: data.provider.last_name,
              rating: data.provider.rating || 0,
              total_reviews: data.provider.total_reviews || 0,
              completed_projects: data.provider.completed_projects || 0
            }
            
            updatedProviders.unshift(newProvider) // Add to beginning of list
            console.log('✅ Added new provider to list:', data.providerId)
          }
        }
        
        return updatedProviders
      })
      
      // Increment update counter to show visual feedback
      setRealTimeUpdates(prev => prev + 1)
    })

    // Join relevant rooms for targeted updates
    if (city) {
      socketService.joinLocationRoom(city, neighborhood || undefined)
    }
    if (category) {
      socketService.joinCategoryRoom(category)
    }

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up real-time listeners...')
      socketService.offProviderProfileUpdated()
      
      if (city) {
        socketService.leaveLocationRoom(city, neighborhood || undefined)
      }
      if (category) {
        socketService.leaveCategoryRoom(category)
      }
    }
  }, [socketService, category, city, neighborhood]) // Re-setup listeners when socket or search filters change

  const getCategoryDisplayName = (category: string) => {
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

  const handleStartChat = async (provider: ServiceProvider) => {
    try {
      // Get provider name
      const businessName = provider.business_name || (provider as any).businessName
      const firstName = provider.first_name || (provider as any).firstName
      const lastName = provider.last_name || (provider as any).lastName
      const providerName = businessName || `${firstName || ''} ${lastName || ''}`.trim() || 'Специалист'
      
      console.log('🔗 Creating/getting conversation for provider:', provider.id)
      
      // Create or get conversation with this provider (tagged as 'searchchat')
      const response = await apiClient.createOrGetConversation({
        providerId: provider.id,
        customerId: user?.id,
        customerName: user?.firstName + ' ' + user?.lastName || 'Customer',
        customerEmail: user?.email || '',
        customerPhone: user?.phoneNumber || '',
        chatSource: 'searchchat'
      })
      
      console.log('🔗 Conversation response:', response.data)
      
      if (response.data?.success) {
        // Conversation created/retrieved, now open chat widget
        console.log('🔗 Opening chat widget for provider:', provider.id)
        
        // Dispatch event to open chat widget with this provider
        const event = new CustomEvent('openChatWidget', {
          detail: { 
            providerId: provider.id,
            source: 'search'
          }
        })
        window.dispatchEvent(event)
      } else {
        console.error('Failed to create conversation:', response.data)
        alert('Не можа да се отвори чат. Моля, опитайте отново.')
      }
      
    } catch (error) {
      console.error('Error opening chat:', error)
      alert('Възникна грешка. Моля, опитайте отново.')
    }
  }

  const handleCreateCase = (provider: ServiceProvider) => {
    console.log('Selected provider for case creation:', provider)
    console.log('Provider category:', (provider as any).serviceCategory || (provider as any).service_category)
    setSelectedProvider(provider)
    setCaseModalOpen(true)
  }

  const handleCaseSubmit = async (formData: any) => {
    try {
      // Prepare case data based on assignment type
      const caseData = {
        ...formData,
        customerId: user?.id, // Add customer ID
        // Only include provider info if assignment type is 'specific'
        providerId: formData.assignmentType === 'specific' ? selectedProvider?.id : null,
        providerName: formData.assignmentType === 'specific' 
          ? (selectedProvider as any)?.businessName || 
            (selectedProvider as any)?.business_name || 
            `${selectedProvider?.first_name || ''} ${selectedProvider?.last_name || ''}`.trim() || 
            'Специалист'
          : null,
        isOpenCase: formData.assignmentType === 'open'
      }

      console.log('Creating case with data:', caseData)
      
      // Submit the case using the API client
      const response = await apiClient.createCase(caseData)
      
      if (response.data?.success) {
        // Close modal and show success message
        setCaseModalOpen(false)
        setSelectedProvider(null)
        
        const successMessage = formData.assignmentType === 'specific'
          ? `Заявката е изпратена директно към ${
              (selectedProvider as any)?.businessName || 
              (selectedProvider as any)?.business_name || 
              selectedProvider?.first_name || 
              'специалиста'
            }! Ще получите потвърждение скоро.`
          : 'Заявката е създадена и е достъпна за всички специалисти! Ще получите потвърждение скоро.'
        
        alert(successMessage)
      } else {
        throw new Error(response.data?.message || 'Failed to create case')
      }
    } catch (error) {
      console.error('Error creating case:', error)
      alert('Възникна грешка при създаването на заявката. Моля, опитайте отново.')
    }
  }

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
    
    // Update URL with new filters
    const params = new URLSearchParams()
    if (newFilters.category) params.append('category', newFilters.category)
    if (newFilters.city) params.append('city', newFilters.city)
    if (newFilters.neighborhood) params.append('neighborhood', newFilters.neighborhood)
    
    router.push(`/search?${params.toString()}`)
  }

  const serviceTypes = [
    { value: 'electrician', label: 'Електротехник' },
    { value: 'plumber', label: 'Водопроводчик' },
    { value: 'hvac', label: 'Климатик' },
    { value: 'carpenter', label: 'Дърводелец' },
    { value: 'painter', label: 'Бояджия' },
    { value: 'locksmith', label: 'Ключар' },
    { value: 'cleaner', label: 'Почистване' },
    { value: 'gardener', label: 'Градинар' },
    { value: 'handyman', label: 'Майстор за всичко' },
    { value: 'appliance_repair', label: 'Ремонт на уреди' },
  ]

  const cities = [
    { value: 'София', label: 'София' },
    { value: 'Пловдив', label: 'Пловдив' },
    { value: 'Варна', label: 'Варна' },
    { value: 'Бургас', label: 'Бургас' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 relative overflow-hidden">
      {/* Industrial background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-br from-purple-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
      </div>
      
      <Header />
      
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="mb-8 bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">🔍</span>
              </div>
              <h1 className="text-3xl font-bold text-white">
                Намерени Услуги
              </h1>
            </div>
            
            {/* Real-time status indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-slate-300">
                {isSocketConnected ? 'Актуални данни' : 'Без връзка'}
              </span>
              {realTimeUpdates > 0 && (
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-1 rounded-full border border-indigo-400/30">
                  {realTimeUpdates} обновления
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 text-sm">
            {category && (
              <span className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-400/30">
                📋 {getCategoryDisplayName(category)}
              </span>
            )}
            {city && (
              <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full border border-green-400/30">
                🏙️ {city}
              </span>
            )}
            {neighborhood && (
              <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full border border-purple-400/30">
                📍 {neighborhood}
              </span>
            )}
          </div>
        </div>

        {/* Search Filters */}
        <div className="mb-8 bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4">Филтри за търсене</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Service Type Filter */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Тип услуга
              </label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange({ ...filters, category: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Всички услуги</option>
                {serviceTypes.map((service) => (
                  <option key={service.value} value={service.value}>
                    {service.label}
                  </option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Град
              </label>
              <select
                value={filters.city}
                onChange={(e) => handleFilterChange({ ...filters, city: e.target.value, neighborhood: '' })}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Изберете град</option>
                {cities.map((city) => (
                  <option key={city.value} value={city.value}>
                    {city.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Neighborhood Filter (only for Sofia) */}
            {filters.city === 'София' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Квартал
                </label>
                <select
                  value={filters.neighborhood}
                  onChange={(e) => handleFilterChange({ ...filters, neighborhood: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Всички квартали</option>
                  {sofiaNeighborhoods.map((neighborhood) => (
                    <option key={neighborhood} value={neighborhood}>
                      {neighborhood}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto"></div>
            <p className="mt-4 text-slate-300">Зареждане на услуги...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-6 text-center backdrop-blur-sm">
            <p className="text-red-300">❌ {error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 bg-red-600/80 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
            >
              Опитай отново
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && !error && (
          <>
            <div className="mb-6 bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400">📊</span>
                <p className="text-white font-semibold">
                  Намерени {providers.length} {providers.length === 1 ? 'услуга' : 'услуги'}
                </p>
              </div>
            </div>

            {providers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Няма намерени услуги
                </h3>
                <p className="text-slate-300 mb-6">
                  Опитайте с различни критерии за търсене
                </p>
                <a 
                  href="/" 
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                >
                  Върни се към началото
                </a>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {providers.map((provider) => (
                  <div key={provider.id} className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border border-white/20">
                    <div className="p-6">
                      {/* Provider Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {/* Profile Picture */}
                            {(provider as any).profileImageUrl ? (
                              <img
                                src={(provider as any).profileImageUrl}
                                alt={(provider as any).businessName}
                                className="w-12 h-12 rounded-full object-cover border-2 border-white/30"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white/30 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-bold">
                                  {(provider as any).firstName?.charAt(0)}{(provider as any).lastName?.charAt(0)}
                                </span>
                              </div>
                            )}
                            <div>
                              <h3 className="text-lg font-bold text-white">
                                {(provider as any).businessName}
                              </h3>
                              <p className="text-sm text-slate-300 font-medium">
                                {(provider as any).firstName} {(provider as any).lastName}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {((provider as any).serviceCategories && (provider as any).serviceCategories.length > 0) ? (
                            (provider as any).serviceCategories.map((cat: string, idx: number) => (
                              <span key={idx} className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-400/30">
                                {getCategoryDisplayName(cat)}
                              </span>
                            ))
                          ) : (
                            <span className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-400/30">
                              {getCategoryDisplayName((provider as any).serviceCategory || (provider as any).service_category)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rating */}
                      <div className="flex items-center mb-4 p-2 bg-white/10 rounded-lg">
                        <span className="text-lg mr-2">{getStars(provider.rating || 0)}</span>
                        <span className="text-sm text-slate-200 font-semibold">
                          {Number(provider.rating || 0).toFixed(1)} ({(provider as any).totalReviews || provider.total_reviews || 0} отзива)
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-slate-200 text-sm mb-4 line-clamp-3 bg-white/5 p-3 rounded-lg italic">
                        {(provider as any).description || 'Професионални услуги с качество и гаранция.'}
                      </p>

                      {/* Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-slate-300">
                          <span className="mr-2">📍</span>
                          <span>{(provider as any).city}, {(provider as any).neighborhood}</span>
                        </div>
                        <div className="flex items-center text-sm text-slate-300">
                          <span className="mr-2">⭐</span>
                          <span>{(provider as any).experienceYears} години опит</span>
                        </div>
                        {((provider as any).completedProjects || 0) > 0 && (
                          <div className="flex items-center text-sm text-green-300 font-semibold">
                            <span className="mr-2">✅</span>
                            <span>{(provider as any).completedProjects} завършени проекта</span>
                          </div>
                        )}
                        <div className="flex items-center text-sm text-slate-300">
                          <span className="mr-2">📞</span>
                          <span>{(provider as any).phoneNumber}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <a
                          href={`/provider/${provider.id}`}
                          className="flex-1 bg-white/20 text-white text-center py-2 px-4 rounded-md hover:bg-white/30 transition-colors text-sm font-medium border border-white/30"
                        >
                          Виж повече
                        </a>
                        {/* Hide Заявка and Чат buttons if viewing own profile */}
                        {user?.id !== provider.id && (
                          <>
                            <button
                              onClick={() => handleCreateCase(provider)}
                              className="bg-purple-600/80 text-white py-2 px-4 rounded-md hover:bg-purple-600 transition-colors text-sm font-medium"
                            >
                              Заявка
                            </button>
                            <button
                              onClick={() => handleStartChat(provider)}
                              className="bg-indigo-600/80 text-white py-2 px-4 rounded-md hover:bg-indigo-600 transition-colors text-sm font-medium"
                            >
                              Чат
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Back to Home */}
        <div className="text-center mt-12">
          <a 
            href="/" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-slate-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-medium"
          >
            <span>🏠</span>
            Върни се към началото
          </a>
        </div>
      </main>
      
      <Footer />


      {/* Case Creation Modal */}
      {selectedProvider && (
        <UnifiedCaseModal
          isOpen={caseModalOpen}
          onClose={() => {
            setCaseModalOpen(false)
            setSelectedProvider(null)
          }}
          onSubmit={handleCaseSubmit}
          providerName={
            (selectedProvider as any).businessName || 
            (selectedProvider as any).business_name || 
            `${selectedProvider.first_name || ''} ${selectedProvider.last_name || ''}`.trim() || 
            'Специалист'
          }
          providerId={selectedProvider.id}
          providerCategory={
            (selectedProvider as any).serviceCategory || 
            (selectedProvider as any).service_category
          }
          customerPhone={user?.phoneNumber || ''}
          mode="direct"
        />
      )}
    </div>
  )
}
