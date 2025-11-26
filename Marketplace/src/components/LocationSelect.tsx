'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'

interface LocationOption {
  value: string
  label: string
  name?: string
  nameBg?: string
  latitude?: number
  longitude?: number
}

interface CitySelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  disabled?: boolean
  maxCities?: number
}

interface NeighborhoodSelectProps {
  city: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  disabled?: boolean
}

// City Select Component
export function CitySelect({
  value,
  onChange,
  placeholder = "Изберете град",
  required = false,
  className = "",
  disabled = false,
  maxCities = 30
}: CitySelectProps) {
  const [cities, setCities] = useState<LocationOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await apiClient.getCities()
        if (response.data?.success && response.data?.data?.cities) {
          setCities(response.data.data.cities.slice(0, maxCities))
        }
      } catch (error) {
        console.error('Error fetching cities:', error)
        // Fallback to basic cities
        setCities([
          { value: 'София', label: 'София' },
          { value: 'Пловдив', label: 'Пловдив' },
          { value: 'Варна', label: 'Варна' },
          { value: 'Бургас', label: 'Бургас' },
        ])
      } finally {
        setLoading(false)
      }
    }
    fetchCities()
  }, [maxCities])

  // Combine passed className with required color styles  
  const finalClassName = className 
    ? `${className} text-white` 
    : `mt-1 block w-full px-3 py-2 bg-slate-700 border border-white/10 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white`

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled || loading}
      className={finalClassName}
      style={{ color: '#ffffff', backgroundColor: '#334155' }}
    >
      <option value="" style={{ color: '#ffffff', backgroundColor: '#1e293b' }}>
        {loading ? 'Зареждане...' : placeholder}
      </option>
      {cities.map((city) => (
        <option key={city.value} value={city.value} style={{ color: '#ffffff', backgroundColor: '#1e293b' }}>
          {city.label}
        </option>
      ))}
    </select>
  )
}

// Neighborhood Select Component (Dynamic based on city)
export function DynamicNeighborhoodSelect({
  city,
  value,
  onChange,
  placeholder = "Изберете квартал",
  required = false,
  className = "",
  disabled = false
}: NeighborhoodSelectProps) {
  const [neighborhoods, setNeighborhoods] = useState<LocationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!city) {
      setNeighborhoods([])
      return
    }

    const fetchNeighborhoods = async () => {
      setLoading(true)
      try {
        const response = await apiClient.getNeighborhoods(city)
        if (response.data?.success && response.data?.data?.neighborhoods) {
          setNeighborhoods(response.data.data.neighborhoods)
        } else {
          setNeighborhoods([])
        }
      } catch (error) {
        console.error('Error fetching neighborhoods:', error)
        setNeighborhoods([])
      } finally {
        setLoading(false)
      }
    }
    fetchNeighborhoods()
  }, [city])

  const filteredNeighborhoods = neighborhoods.filter(n =>
    n.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const defaultClasses = "mt-1 block w-full px-3 py-2 bg-slate-700/50 border border-white/10 text-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"

  // If no neighborhoods available, don't render
  if (!city || (neighborhoods.length === 0 && !loading)) {
    return null
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : value}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={loading ? 'Зареждане...' : placeholder}
          required={required}
          disabled={disabled || loading}
          className={className || defaultClasses}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute inset-y-0 right-0 flex items-center pr-2"
          disabled={disabled || loading}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {isOpen && !loading && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-white/10 overflow-auto focus:outline-none sm:text-sm">
          {filteredNeighborhoods.length === 0 ? (
            <div className="px-4 py-2 text-slate-400">Няма намерени квартали</div>
          ) : (
            filteredNeighborhoods.map((neighborhood) => (
              <button
                key={neighborhood.value}
                type="button"
                onClick={() => {
                  onChange(neighborhood.value)
                  setIsOpen(false)
                  setSearchTerm('')
                }}
                className={`w-full text-left px-4 py-2 hover:bg-indigo-600 hover:text-white ${
                  value === neighborhood.value ? 'bg-indigo-600/50 text-white' : 'text-slate-300'
                }`}
              >
                {neighborhood.label}
              </button>
            ))
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

// Simple dropdown version
export function SimpleNeighborhoodSelect({
  city,
  value,
  onChange,
  placeholder = "Изберете квартал",
  required = false,
  className = "",
  disabled = false
}: NeighborhoodSelectProps) {
  const [neighborhoods, setNeighborhoods] = useState<LocationOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!city) {
      setNeighborhoods([])
      return
    }

    const fetchNeighborhoods = async () => {
      setLoading(true)
      try {
        const response = await apiClient.getNeighborhoods(city)
        if (response.data?.success && response.data?.data?.neighborhoods) {
          setNeighborhoods(response.data.data.neighborhoods)
        } else {
          setNeighborhoods([])
        }
      } catch (error) {
        console.error('Error fetching neighborhoods:', error)
        setNeighborhoods([])
      } finally {
        setLoading(false)
      }
    }
    fetchNeighborhoods()
  }, [city])

  // Combine passed className with required color styles
  const finalClassName = className 
    ? `${className} text-white` 
    : `mt-1 block w-full px-3 py-2 bg-slate-700 border border-white/10 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white`

  // If no neighborhoods available, don't render
  if (!city || (neighborhoods.length === 0 && !loading)) {
    return null
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled || loading}
      className={finalClassName}
      style={{ color: '#ffffff', backgroundColor: '#334155' }}
    >
      <option value="" style={{ color: '#ffffff', backgroundColor: '#1e293b' }}>
        {loading ? 'Зареждане...' : placeholder}
      </option>
      {neighborhoods.map((neighborhood) => (
        <option key={neighborhood.value} value={neighborhood.value} style={{ color: '#ffffff', backgroundColor: '#1e293b' }}>
          {neighborhood.label}
        </option>
      ))}
    </select>
  )
}

// Combined City + Neighborhood selector
interface LocationSelectorProps {
  city: string
  neighborhood: string
  onCityChange: (city: string) => void
  onNeighborhoodChange: (neighborhood: string) => void
  cityLabel?: string
  neighborhoodLabel?: string
  className?: string
  required?: boolean
}

export function LocationSelector({
  city,
  neighborhood,
  onCityChange,
  onNeighborhoodChange,
  cityLabel = "Град",
  neighborhoodLabel = "Квартал",
  className = "",
  required = false
}: LocationSelectorProps) {
  const [neighborhoods, setNeighborhoods] = useState<LocationOption[]>([])
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false)

  useEffect(() => {
    if (!city) {
      setNeighborhoods([])
      onNeighborhoodChange('')
      return
    }

    const fetchNeighborhoods = async () => {
      setLoadingNeighborhoods(true)
      try {
        const response = await apiClient.getNeighborhoods(city)
        if (response.data?.success && response.data?.data?.neighborhoods) {
          setNeighborhoods(response.data.data.neighborhoods)
        } else {
          setNeighborhoods([])
        }
      } catch (error) {
        console.error('Error fetching neighborhoods:', error)
        setNeighborhoods([])
      } finally {
        setLoadingNeighborhoods(false)
      }
    }
    fetchNeighborhoods()
  }, [city])

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-slate-200">{cityLabel}</label>
        <CitySelect
          value={city}
          onChange={(newCity) => {
            onCityChange(newCity)
            onNeighborhoodChange('') // Reset neighborhood when city changes
          }}
          required={required}
        />
      </div>

      {city && neighborhoods.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-200">
            {neighborhoodLabel}
            {loadingNeighborhoods && (
              <span className="ml-2 text-indigo-400 text-xs">Зареждане...</span>
            )}
          </label>
          <SimpleNeighborhoodSelect
            city={city}
            value={neighborhood}
            onChange={onNeighborhoodChange}
          />
        </div>
      )}
    </div>
  )
}

export default LocationSelector
