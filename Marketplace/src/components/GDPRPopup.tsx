'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function GDPRPopup() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already seen the popup
    const hasSeenPopup = localStorage.getItem('gdpr_consent_shown')
    
    if (!hasSeenPopup) {
      // Show popup after 1 second delay
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('gdpr_consent_shown', 'true')
    localStorage.setItem('gdpr_consent_accepted', 'true')
    localStorage.setItem('gdpr_consent_date', new Date().toISOString())
    setIsVisible(false)
  }

  const handleDecline = () => {
    localStorage.setItem('gdpr_consent_shown', 'true')
    localStorage.setItem('gdpr_consent_accepted', 'false')
    localStorage.setItem('gdpr_consent_date', new Date().toISOString())
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-center p-4 gdpr-popup-overlay">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 gdpr-popup-content">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Защита на личните данни
        </h3>
        <p className="text-gray-600 text-sm mb-4">
          Използваме бисквитки и други технологии за подобряване на вашето изживяване. 
          Като продължите да използвате нашия сайт, вие се съгласявате с нашата{' '}
          <Link href="/privacy-policy" className="text-blue-600 hover:underline">
            политика за поверителност
          </Link>.
        </p>
        <div className="flex space-x-3">
          <button
            onClick={handleAccept}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Приемам
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
          >
            Отказвам
          </button>
        </div>
      </div>
    </div>
  )
}