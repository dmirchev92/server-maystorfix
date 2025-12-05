'use client'

import { useEffect, useRef, useState } from 'react'

interface LocationAutocompleteProps {
  onLocationSelect: (location: {
    city: string
    neighborhood: string
    formattedAddress: string
    lat?: number
    lng?: number
  }) => void
  placeholder?: string
  className?: string
  initialValue?: string
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

declare global {
  interface Window {
    google: any
    initGooglePlaces: () => void
  }
}

export default function LocationAutocomplete({
  onLocationSelect,
  placeholder = 'Въведете адрес или квартал...',
  className = '',
  initialValue = ''
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [inputValue, setInputValue] = useState(initialValue)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google?.maps?.places) {
      initAutocomplete()
      return
    }

    // Load Google Maps script
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'AIzaSyAXQf53JEFPgoxHoCXz3lMKQ5itjHcTd4A'
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=bg`
    script.async = true
    script.defer = true
    script.onload = () => {
      initAutocomplete()
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [])

  const initAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places) return

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'bg' },
      types: ['geocode', 'establishment'],
      fields: ['address_components', 'formatted_address', 'geometry', 'name']
    })

    autocompleteRef.current.addListener('place_changed', handlePlaceSelect)
    setIsLoaded(true)
  }

  const handlePlaceSelect = async () => {
    const place = autocompleteRef.current?.getPlace()
    if (!place?.geometry?.location) return

    const lat = place.geometry.location.lat()
    const lng = place.geometry.location.lng()
    
    setInputValue(place.formatted_address || '')

    // Use REVERSE geocoding to get accurate neighborhood (forward geocoding returns broad districts)
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'AIzaSyAXQf53JEFPgoxHoCXz3lMKQ5itjHcTd4A'
      const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=bg`
      const response = await fetch(reverseGeocodeUrl)
      const data = await response.json()

      let city = ''
      let neighborhood = ''
      let sublocality = ''

      if (data.results?.[0]?.address_components) {
        for (const component of data.results[0].address_components) {
          const types = component.types

          // City (locality)
          if (types.includes('locality')) {
            const cityName = component.long_name
            city = cityNameMapping[cityName] || cityName
          }

          // Neighborhood type is most specific - prioritize it
          if (types.includes('neighborhood')) {
            neighborhood = component.long_name
          }
          
          // Sublocality is broader (district like Vitosha) - use only as fallback
          if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
            sublocality = component.long_name
          }

          // Fallback for Sofia
          if (types.includes('administrative_area_level_1') && !city) {
            const areaName = component.long_name
            if (areaName === 'Sofia City Province' || areaName === 'Sofia-City' || areaName === 'София-град') {
              city = 'София'
            }
          }
        }
        
        // Use neighborhood if found, otherwise fall back to sublocality
        if (!neighborhood && sublocality) {
          neighborhood = sublocality
        }
      }
      
      console.log('📍 Location detected:', { city, neighborhood, sublocality, lat, lng })

      onLocationSelect({
        city,
        neighborhood,
        formattedAddress: place.formatted_address || '',
        lat,
        lng
      })
    } catch (error) {
      console.error('Reverse geocoding error:', error)
      // Fallback to place data
      onLocationSelect({
        city: '',
        neighborhood: '',
        formattedAddress: place.formatted_address || '',
        lat,
        lng
      })
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {!isLoaded && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  )
}
