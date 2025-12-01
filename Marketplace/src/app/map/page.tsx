'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { GoogleMap, Marker, InfoWindow, useLoadScript, StandaloneSearchBox } from '@react-google-maps/api'
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Search, MapPin, Navigation, Filter, List as ListIcon, Map as MapIcon, Briefcase, Clock, DollarSign, Tag } from 'lucide-react'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''
const libraries: ("places")[] = ["places"]

// Increase limit since we now have clustering
const PROVIDER_LIMIT = 200

const RADIUS_OPTIONS = [
  { value: 1, label: '1 км' },
  { value: 2, label: '2 км' },
  { value: 3, label: '3 км' },
  { value: 4, label: '4 км' },
  { value: 5, label: '5 км' },
  { value: 6, label: '6 км' },
  { value: 7, label: '7 км' },
  { value: 8, label: '8 км' },
  { value: 9, label: '9 км' },
  { value: 10, label: '10 км' },
]

export default function MapPage() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  })
  
  const { user, isAuthenticated } = useAuth()
  const isProvider = user?.role === 'tradesperson'
  
  // All tiers can now view cases on map
  const canViewCasesOnMap = true

  // State
  const [center, setCenter] = useState({ lat: 42.6977, lng: 23.3219 }) // Sofia default
  const [selectedProvider, setSelectedProvider] = useState<any>(null)
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
  const [providers, setProviders] = useState<any[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [bidding, setBidding] = useState(false)
  
  // Filters
  const [radius, setRadius] = useState(10)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map') // For mobile toggle

  // Free Inspection filters (for customers)
  const [showOnlyFreeInspection, setShowOnlyFreeInspection] = useState(false)
  const [freeInspectionAlertsEnabled, setFreeInspectionAlertsEnabled] = useState(false)
  const [freeInspectionRadius, setFreeInspectionRadius] = useState(3)
  const [freeInspectionPrefsLoaded, setFreeInspectionPrefsLoaded] = useState(false)

  // Load free inspection preferences for customers
  useEffect(() => {
    const loadFreeInspectionPrefs = async () => {
      if (isProvider || !isAuthenticated) return
      
      try {
        const response = await apiClient.getFreeInspectionPreferences()
        if (response.data?.success && response.data?.data) {
          setFreeInspectionAlertsEnabled(response.data.data.enabled || false)
          setFreeInspectionRadius(response.data.data.radiusKm || 3)
          setShowOnlyFreeInspection(response.data.data.showOnlyFreeInspection || false)
        }
      } catch (error) {
        console.error('Error loading free inspection preferences:', error)
      } finally {
        setFreeInspectionPrefsLoaded(true)
      }
    }
    
    loadFreeInspectionPrefs()
  }, [isProvider, isAuthenticated])

  // Save free inspection preferences
  const saveFreeInspectionPrefs = async (updates: any) => {
    try {
      await apiClient.updateFreeInspectionPreferences({
        ...updates,
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
      })
    } catch (error) {
      console.error('Error saving free inspection preferences:', error)
    }
  }

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await apiClient.getServiceCategories()
        if (res.data?.success) {
          setCategories(res.data.data)
        }
      } catch (err) {
        console.error('Failed to load categories', err)
      }
    }
    loadCategories()
  }, [])

  // Fetch providers (for customers) - using free inspection API for filtering
  const fetchProviders = async () => {
    try {
      const lat = userLocation?.lat || center.lat
      const lng = userLocation?.lng || center.lng

      // Use the free inspection API which supports filtering
      const response = await apiClient.getProvidersForMap({
        latitude: lat,
        longitude: lng,
        radiusKm: radius,
        category: selectedCategory || undefined,
        freeInspectionOnly: showOnlyFreeInspection,
      })
      
      if (response.data?.success && response.data?.data?.providers) {
        const validProviders = response.data.data.providers.filter((p: any) => p.latitude && p.longitude)
        console.log('📍 Map - Loaded providers:', validProviders.length, 'freeInspectionOnly:', showOnlyFreeInspection)
        setProviders(validProviders)
      }
    } catch (error) {
      console.error('Error fetching providers:', error)
    }
  }

  // Fetch cases (for providers)
  const fetchCases = async () => {
    try {
      const params: any = {
        latitude: userLocation?.lat || center.lat,
        longitude: userLocation?.lng || center.lng,
        radius: radius,
      }

      if (selectedCategory) {
        params.category = selectedCategory
      }

      const response = await apiClient.getCasesForMap(params)
      
      if (response.data?.success) {
        console.log('📍 Map - Loaded cases:', response.data.data.cases?.length)
        setCases(response.data.data.cases || [])
      }
    } catch (error) {
      console.error('Error fetching cases:', error)
    }
  }

  // Initial fetch and polling - different based on user role and tier
  // Only PRO providers can view cases on map
  useEffect(() => {
    if (isProvider && canViewCasesOnMap) {
      fetchCases()
      const intervalId = setInterval(fetchCases, 15000)
      return () => clearInterval(intervalId)
    } else if (!isProvider) {
      fetchProviders()
      const intervalId = setInterval(fetchProviders, 15000)
      return () => clearInterval(intervalId)
    }
    // Free/Normal providers: no case fetching, map is for location sharing only
  }, [userLocation, radius, selectedCategory, isProvider, canViewCasesOnMap, showOnlyFreeInspection])

  // Update markers when providers/cases change
  useEffect(() => {
    if (!mapInstance) return

    // Clear existing clusterer completely
    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
      clustererRef.current.setMap(null)
      clustererRef.current = null
    }

    // Clear old markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // Only show cases for PRO providers
    const items = (isProvider && canViewCasesOnMap) ? cases : (!isProvider ? providers : [])
    if (items.length === 0) return

    // Create new markers
    const markers = items.map((item: any) => {
      // Skip items with null/undefined coordinates (provider tracking disabled)
      if (item.latitude == null || item.longitude == null) return null
      
      const lat = Number(item.latitude)
      const lng = Number(item.longitude)
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null

      // For providers: use purple for free inspection, red for regular
      const markerColor = !isProvider && item.freeInspectionActive ? '#7C3AED' : '#E53E3E'
      
      const marker = new google.maps.Marker({
        position: { lat, lng },
        title: isProvider ? item.description?.substring(0, 50) : item.businessName,
        icon: !isProvider ? {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
          scale: 10,
        } : undefined,
      })

      // Add click listener
      marker.addListener('click', () => {
        if (isProvider) {
          setSelectedCase(item)
          setSelectedProvider(null)
        } else {
          setSelectedProvider(item)
          setSelectedCase(null)
        }
      })

      return marker
    }).filter(Boolean) as google.maps.Marker[]

    markersRef.current = markers

    // Create clusterer with custom renderer - always red
    const clusterColor = '#E53E3E'
    clustererRef.current = new MarkerClusterer({
      map: mapInstance,
      markers: markers,
      algorithm: new SuperClusterAlgorithm({ radius: 80, maxZoom: 15 }),
      renderer: {
        render: ({ count, position }) => {
          const size = count < 10 ? 40 : count < 50 ? 50 : 60
          const fontSize = count < 10 ? 14 : count < 50 ? 16 : 18
          
          return new google.maps.Marker({
            position,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 3}" fill="${clusterColor}" stroke="white" stroke-width="3"/>
                  <text x="${size/2}" y="${size/2 + fontSize/3}" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="Arial">${count}</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(size, size),
              anchor: new google.maps.Point(size/2, size/2),
            },
            zIndex: 1000 + count,
          })
        },
      },
    })

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers()
        clustererRef.current.setMap(null)
      }
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
    }
  }, [providers, cases, mapInstance, isProvider])

  // Locate Me
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Геолокацията не се поддържа от вашия браузър.')
      return
    }
    
    if (!window.isSecureContext) {
      alert('Геолокацията изисква HTTPS.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setUserLocation(location)
        setCenter(location)
        if (mapInstance) {
          mapInstance.panTo(location)
          mapInstance.setZoom(14)
        }
      },
      (error) => {
        console.error('Error getting location:', error)
        alert('Неуспешно намиране на местоположението. Моля, въведете адреса ръчно.')
      },
      { enableHighAccuracy: true }
    )
  }

  // Manual Address Search
  const onPlacesChanged = () => {
    if (searchBox) {
      const places = searchBox.getPlaces()
      if (places && places.length > 0) {
        const place = places[0]
        if (place.geometry && place.geometry.location) {
          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          }
          setUserLocation(location)
          setCenter(location)
          if (mapInstance) {
            mapInstance.panTo(location)
            mapInstance.setZoom(14)
          }
        }
      }
    }
  }

  const onLoadSearchBox = (ref: google.maps.places.SearchBox) => {
    setSearchBox(ref)
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId)
    return category ? category.name : categoryId
  }

  // Handle bid on case
  const handleBid = async (caseItem: any) => {
    if (!isAuthenticated) {
      alert('Моля, влезте в профила си, за да направите оферта.')
      return
    }
    
    setBidding(true)
    try {
      // Navigate to the case details page with bid modal
      window.location.href = `/provider/cases?bid=${caseItem.id}`
    } catch (error) {
      console.error('Error navigating to bid:', error)
      alert('Възникна грешка. Моля, опитайте отново.')
    } finally {
      setBidding(false)
    }
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700'
      case 'normal': return 'bg-blue-100 text-blue-700'
      case 'low': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Спешно'
      case 'normal': return 'Нормално'
      case 'low': return 'Нисък'
      default: return priority
    }
  }

  if (loadError) return <div className="p-4 text-red-500">Error loading map</div>
  if (!isLoaded) return <div className="p-4 text-white bg-slate-900 min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <Header />
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Sidebar (Desktop) / Bottom Panel (Mobile) */}
        <div className={`
          md:w-[400px] md:h-full md:border-r border-slate-700 bg-white z-20 flex flex-col
          ${viewMode === 'list' ? 'h-full absolute inset-0 md:static' : 'hidden md:flex'}
        `}>
          {/* Search & Filters Header */}
          <div className="p-4 border-b border-slate-200 shadow-sm bg-white z-10">
            <h2 className="text-lg font-bold text-slate-900 mb-3">
              {isProvider ? '🔍 Намери Заявки' : 'Намери Майстор'}
            </h2>
            
            {/* Address Search */}
            <div className="mb-3 relative">
              <StandaloneSearchBox
                onLoad={onLoadSearchBox}
                onPlacesChanged={onPlacesChanged}
              >
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Въведете адрес..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </StandaloneSearchBox>
            </div>

            {/* Locate Me Button */}
            <button
              onClick={handleLocateMe}
              className="w-full mb-4 py-2 px-4 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Използвай моята локация
            </button>

            {/* Filters Row */}
            <div className="flex space-x-2">
              {/* Radius Select */}
              <div className="w-1/3">
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {RADIUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Category Select */}
              <div className="w-2/3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Всички категории</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Free Inspection Filter (customers only) */}
            {!isProvider && (
              <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="text-sm font-semibold text-purple-800 mb-2 flex items-center">
                  🔧 Безплатен оглед
                </h3>
                
                {/* Show only free inspection checkbox */}
                <label className="flex items-center cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={showOnlyFreeInspection}
                    onChange={(e) => {
                      setShowOnlyFreeInspection(e.target.checked)
                      saveFreeInspectionPrefs({ showOnlyFreeInspection: e.target.checked })
                    }}
                    className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">
                    Покажи само с безплатен оглед
                  </span>
                </label>

                {/* Alerts toggle (for authenticated customers) */}
                {isAuthenticated && (
                  <label className="flex items-center cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={freeInspectionAlertsEnabled}
                      onChange={(e) => {
                        setFreeInspectionAlertsEnabled(e.target.checked)
                        saveFreeInspectionPrefs({ 
                          enabled: e.target.checked,
                          latitude: userLocation?.lat,
                          longitude: userLocation?.lng,
                        })
                      }}
                      className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">
                      Получавай известия за безплатен оглед
                    </span>
                  </label>
                )}

                {/* Legend */}
                <div className="mt-2 pt-2 border-t border-purple-200 text-xs text-slate-600">
                  <div className="flex items-center mb-1">
                    <span className="w-3 h-3 rounded-full bg-purple-600 mr-2"></span>
                    Предлага безплатен оглед
                  </div>
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                    Стандартен майстор
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* List - Shows providers for customers, cases for providers */}
          <div className="flex-1 overflow-y-auto bg-slate-50">
            <div className="p-2 space-y-2">
              {isProvider ? (
                // PROVIDER VIEW: Show Cases
                cases.length === 0 ? (
                  <div className="text-center p-8 text-slate-500 text-sm">
                    Няма намерени заявки в този район.
                  </div>
                ) : (
                  cases.map(caseItem => (
                    <div 
                      key={caseItem.id}
                      onClick={() => {
                        setSelectedCase(caseItem)
                        setSelectedProvider(null)
                        if (viewMode === 'list') setViewMode('map')
                        if (mapInstance && caseItem.latitude && caseItem.longitude) {
                          mapInstance.panTo({ lat: caseItem.latitude, lng: caseItem.longitude })
                          mapInstance.setZoom(16)
                        }
                      }}
                      className={`p-3 bg-white rounded-lg border cursor-pointer hover:border-emerald-500 transition-all ${selectedCase?.id === caseItem.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(caseItem.priority)}`}>
                              {getPriorityLabel(caseItem.priority)}
                            </span>
                            <span className="text-xs text-slate-500">{caseItem.distanceKm} км</span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm">{getCategoryName(caseItem.serviceType || caseItem.category)}</h3>
                          <p className="text-xs text-slate-600 line-clamp-2">{caseItem.description}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">
                          📍 {caseItem.neighborhood || caseItem.city}
                        </span>
                        <span className="font-medium text-emerald-600">
                          💰 {caseItem.budget} лв
                        </span>
                      </div>
                      {caseItem.biddingEnabled && !caseItem.biddingClosed && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">
                              Оферти: {caseItem.currentBidders || 0}/{caseItem.maxBidders || 5}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleBid(caseItem)
                              }}
                              className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 font-medium"
                            >
                              Наддай
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )
              ) : (
                // CUSTOMER VIEW: Show Providers
                providers.length === 0 ? (
                  <div className="text-center p-8 text-slate-500 text-sm">
                    Няма намерени майстори в този район.
                  </div>
                ) : (
                  providers.map(provider => (
                    <div 
                      key={provider.id}
                      onClick={() => {
                        setSelectedProvider(provider)
                        setSelectedCase(null)
                        if (viewMode === 'list') setViewMode('map')
                        if (mapInstance && provider.latitude && provider.longitude) {
                          mapInstance.panTo({ lat: provider.latitude, lng: provider.longitude })
                          mapInstance.setZoom(16)
                        }
                      }}
                      className={`p-3 bg-white rounded-lg border cursor-pointer hover:border-indigo-500 transition-all ${selectedProvider?.id === provider.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-sm">{provider.businessName || provider.name}</h3>
                            {provider.freeInspectionActive && (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                                🔧 Безплатен оглед
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{getCategoryName(provider.serviceCategory)}</p>
                        </div>
                        <div className="flex items-center bg-yellow-50 px-1.5 py-0.5 rounded">
                          <span className="text-yellow-500 text-xs mr-1">⭐</span>
                          <span className="text-xs font-bold text-slate-700">{provider.rating || '0'}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                        <span>{provider.distanceKm ? `${Number(provider.distanceKm).toFixed(1)} км` : '---'}</span>
                        <span className={provider.freeInspectionActive ? 'text-purple-600' : 'text-slate-400'}>
                          {provider.freeInspectionActive ? '● Безплатен оглед' : ''}
                        </span>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
          
          {/* Mobile Close List Button */}
          <div className="md:hidden p-3 border-t bg-white">
             <button 
               onClick={() => setViewMode('map')}
               className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
             >
               Обратно към картата
             </button>
          </div>
        </div>

        {/* Map Area */}
        <div className={`flex-1 relative ${viewMode === 'list' ? 'hidden md:block' : 'block'}`}>
          <GoogleMap
            zoom={13}
            center={center}
            mapContainerClassName="w-full h-full"
            mapContainerStyle={{ width: '100%', height: '100%' }}
            onLoad={setMapInstance}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
            }}
          >
            {/* User Location Marker */}
            {userLocation && (
              <Marker 
                position={userLocation}
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                }}
                zIndex={1000}
                title="Вашата локация"
              />
            )}

            {/* Provider markers are now handled by the MarkerClusterer in useEffect */}

            {/* Info Window for selected provider (Customer view) */}
            {selectedProvider && !isProvider && (
              <InfoWindow
                position={{ lat: Number(selectedProvider.latitude), lng: Number(selectedProvider.longitude) }}
                onCloseClick={() => setSelectedProvider(null)}
              >
                <div className="p-2 min-w-[240px] max-w-[300px]">
                  <div className="flex gap-3 mb-3">
                    <div className="flex-shrink-0">
                      {selectedProvider.profileImageUrl ? (
                        <img 
                          src={selectedProvider.profileImageUrl} 
                          alt={selectedProvider.businessName}
                          className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl border-2 border-slate-100 shadow-sm">
                          {selectedProvider.businessName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-slate-900 leading-tight mb-1 truncate">{selectedProvider.businessName}</h3>
                      <p className="text-slate-600 text-sm mb-1 truncate">{getCategoryName(selectedProvider.serviceCategory)}</p>
                      <div className="flex items-center">
                        <span className="text-yellow-500 mr-1 text-sm">⭐</span>
                        <span className="font-medium text-slate-700 text-sm">{selectedProvider.rating || 0}</span>
                        <span className="text-slate-400 text-xs ml-1">({selectedProvider.totalReviews || 0})</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <a 
                      href={`/provider/${selectedProvider.id}`}
                      className="flex-1 bg-indigo-600 text-white text-center py-2 px-3 rounded-lg text-sm hover:bg-indigo-700 transition-colors no-underline font-medium shadow-sm"
                    >
                      Виж профил
                    </a>
                    <a 
                      href={`/chat?providerId=${selectedProvider.id}`}
                      className="flex-1 bg-emerald-500 text-white text-center py-2 px-3 rounded-lg text-sm hover:bg-emerald-600 transition-colors no-underline font-medium shadow-sm flex items-center justify-center"
                    >
                      Чат
                    </a>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Info Window for selected case (Provider view) */}
            {selectedCase && isProvider && (
              <InfoWindow
                position={{ lat: Number(selectedCase.latitude), lng: Number(selectedCase.longitude) }}
                onCloseClick={() => setSelectedCase(null)}
              >
                <div className="p-3 min-w-[280px] max-w-[350px]">
                  {/* Header with priority */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${getPriorityColor(selectedCase.priority)}`}>
                      {getPriorityLabel(selectedCase.priority)}
                    </span>
                    <span className="text-xs text-slate-500">{selectedCase.distanceKm} км</span>
                  </div>

                  {/* Category & Service Type */}
                  <h3 className="font-bold text-lg text-slate-900 mb-1">
                    {getCategoryName(selectedCase.serviceType || selectedCase.category)}
                  </h3>

                  {/* Description */}
                  <p className="text-slate-600 text-sm mb-3 line-clamp-3">{selectedCase.description}</p>

                  {/* Details */}
                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex items-center text-slate-600">
                      <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                      {selectedCase.neighborhood || selectedCase.city}
                    </div>
                    <div className="flex items-center text-slate-600">
                      <Clock className="w-4 h-4 mr-2 text-slate-400" />
                      {selectedCase.preferredDate} • {selectedCase.preferredTime === 'morning' ? 'Сутрин' : selectedCase.preferredTime === 'afternoon' ? 'Следобед' : selectedCase.preferredTime === 'evening' ? 'Вечер' : 'Гъвкаво'}
                    </div>
                    <div className="flex items-center text-emerald-600 font-medium">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Бюджет: {selectedCase.budget} лв
                    </div>
                    {selectedCase.squareMeters && (
                      <div className="flex items-center text-slate-600">
                        <Tag className="w-4 h-4 mr-2 text-slate-400" />
                        {selectedCase.squareMeters} кв.м
                      </div>
                    )}
                  </div>

                  {/* Bidding info */}
                  {selectedCase.biddingEnabled && (
                    <div className="bg-slate-50 p-2 rounded mb-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Текущи оферти:</span>
                        <span className="font-medium">{selectedCase.currentBidders || 0} / {selectedCase.maxBidders || 5}</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex space-x-2">
                    {selectedCase.biddingEnabled && !selectedCase.biddingClosed ? (
                      <button
                        onClick={() => handleBid(selectedCase)}
                        disabled={bidding}
                        className="flex-1 bg-emerald-500 text-white text-center py-2 px-3 rounded-lg text-sm hover:bg-emerald-600 transition-colors font-medium shadow-sm disabled:opacity-50"
                      >
                        {bidding ? 'Зареждане...' : '💰 Направи оферта'}
                      </button>
                    ) : (
                      <span className="flex-1 bg-slate-200 text-slate-500 text-center py-2 px-3 rounded-lg text-sm font-medium">
                        Офертирането е затворено
                      </span>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* Mobile Floating Controls */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4 md:hidden z-10">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center px-6 py-3 ${isProvider ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900'} rounded-full shadow-lg font-medium`}
            >
              <ListIcon className="w-5 h-5 mr-2" />
              {isProvider ? `Заявки (${cases.length})` : `Списък (${providers.length})`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
