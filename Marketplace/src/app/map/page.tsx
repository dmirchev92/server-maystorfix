'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { GoogleMap, Marker, InfoWindow, useLoadScript, StandaloneSearchBox } from '@react-google-maps/api'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { apiClient } from '@/lib/api'
import { Search, MapPin, Navigation, Filter, List as ListIcon, Map as MapIcon } from 'lucide-react'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''
const libraries: ("places")[] = ["places"]

const RADIUS_OPTIONS = [
  { value: 2, label: '2 км' },
  { value: 5, label: '5 км' },
  { value: 10, label: '10 км' },
  { value: 20, label: '20 км' },
  { value: 50, label: '50 км' },
]

export default function MapPage() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  })

  // State
  const [center, setCenter] = useState({ lat: 42.6977, lng: 23.3219 }) // Sofia default
  const [selectedProvider, setSelectedProvider] = useState<any>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
  const [providers, setProviders] = useState<any[]>([])
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  
  // Filters
  const [radius, setRadius] = useState(10)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map') // For mobile toggle

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

  // Fetch providers
  const fetchProviders = async () => {
    try {
      const params: any = { 
        limit: 20, // Nearest 20
        t: Date.now() 
      }

      if (userLocation) {
        params.lat = userLocation.lat
        params.lng = userLocation.lng
        params.radius = radius
      }

      if (selectedCategory) {
        params.category = selectedCategory
      }

      const response = await apiClient.searchProviders(params)
      
      if (response.data?.success) {
        // Filter providers that have valid coordinates
        const validProviders = response.data.data.filter((p: any) => p.latitude && p.longitude)
        console.log('📍 Map - Loaded providers:', validProviders.length)
        setProviders(validProviders)
      }
    } catch (error) {
      console.error('Error fetching providers:', error)
    }
  }

  // Initial fetch and polling
  useEffect(() => {
    fetchProviders()
    const intervalId = setInterval(fetchProviders, 15000)
    return () => clearInterval(intervalId)
  }, [userLocation, radius, selectedCategory]) // Refetch when filters change

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
            <h2 className="text-lg font-bold text-slate-900 mb-3">Намери Майстор</h2>
            
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
          </div>

          {/* Providers List */}
          <div className="flex-1 overflow-y-auto bg-slate-50">
            <div className="p-2 space-y-2">
              {providers.length === 0 ? (
                <div className="text-center p-8 text-slate-500 text-sm">
                  Няма намерени майстори в този район.
                </div>
              ) : (
                providers.map(provider => (
                  <div 
                    key={provider.id}
                    onClick={() => {
                      setSelectedProvider(provider)
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
                        <h3 className="font-bold text-slate-900 text-sm">{provider.businessName}</h3>
                        <p className="text-xs text-slate-500">{provider.serviceCategory}</p>
                      </div>
                      <div className="flex items-center bg-yellow-50 px-1.5 py-0.5 rounded">
                        <span className="text-yellow-500 text-xs mr-1">⭐</span>
                        <span className="text-xs font-bold text-slate-700">{provider.rating || '0'}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                      <span>{provider.distance ? `${provider.distance.toFixed(1)} км` : '---'}</span>
                      <span className={provider.isActive ? 'text-green-600' : 'text-slate-400'}>
                        {provider.isActive ? '● Активен' : '○ Офлайн'}
                      </span>
                    </div>
                  </div>
                ))
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
              mapId: "DEMO_MAP_ID",
              disableDefaultUI: false,
              zoomControl: true,
              styles: [
                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
              ]
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

            {/* Provider Markers */}
            {providers.map((provider: any) => (
              <Marker
                key={provider.id}
                position={{ lat: Number(provider.latitude), lng: Number(provider.longitude) }}
                onClick={() => setSelectedProvider(provider)}
                title={provider.businessName}
              />
            ))}

            {/* Info Window */}
            {selectedProvider && (
              <InfoWindow
                position={{ lat: Number(selectedProvider.latitude), lng: Number(selectedProvider.longitude) }}
                onCloseClick={() => setSelectedProvider(null)}
              >
                <div className="p-2 min-w-[200px]">
                  <h3 className="font-bold text-lg text-slate-900">{selectedProvider.businessName}</h3>
                  <p className="text-slate-600">{selectedProvider.serviceCategory}</p>
                  <div className="flex items-center mt-1 mb-2">
                    <span className="text-yellow-500 mr-1">⭐</span>
                    <span className="font-medium text-slate-700">{selectedProvider.rating || 0}</span>
                    <span className="text-slate-500 text-xs ml-1">({selectedProvider.totalReviews || 0})</span>
                  </div>
                  <div className="flex space-x-2 mt-2">
                    <a 
                      href={`/create-case?providerId=${selectedProvider.id}&providerName=${encodeURIComponent(selectedProvider.businessName)}`}
                      className="flex-1 bg-indigo-600 text-white text-center py-1.5 px-3 rounded text-sm hover:bg-indigo-700 transition-colors no-underline block"
                    >
                      Заяви
                    </a>
                    <a 
                      href={`/chat?providerId=${selectedProvider.id}`}
                      className="flex-1 bg-green-600 text-white text-center py-1.5 px-3 rounded text-sm hover:bg-green-700 transition-colors no-underline block"
                    >
                      Чат
                    </a>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* Mobile Floating Controls */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4 md:hidden z-10">
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center px-6 py-3 bg-white text-slate-900 rounded-full shadow-lg font-medium"
            >
              <ListIcon className="w-5 h-5 mr-2" />
              Списък ({providers.length})
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
