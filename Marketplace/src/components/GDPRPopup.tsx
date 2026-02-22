'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function GDPRPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Check if user has already accepted
    const hasAccepted = localStorage.getItem('gdpr_consent_accepted')
    
    if (!hasAccepted) {
      // Show popup after 1 second delay
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAcceptAll = () => {
    localStorage.setItem('gdpr_consent_accepted', 'true')
    localStorage.setItem('gdpr_consent_essential', 'true')
    localStorage.setItem('gdpr_consent_analytics', 'true')
    localStorage.setItem('gdpr_consent_marketing', 'false')
    localStorage.setItem('gdpr_consent_date', new Date().toISOString())
    localStorage.setItem('gdpr_consent_version', '1.0')
    setIsVisible(false)
  }

  const handleAcceptEssential = () => {
    localStorage.setItem('gdpr_consent_accepted', 'true')
    localStorage.setItem('gdpr_consent_essential', 'true')
    localStorage.setItem('gdpr_consent_analytics', 'false')
    localStorage.setItem('gdpr_consent_marketing', 'false')
    localStorage.setItem('gdpr_consent_date', new Date().toISOString())
    localStorage.setItem('gdpr_consent_version', '1.0')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            🔒 Защита на личните данни
          </h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            SnapFix използва бисквитки и обработва лични данни за предоставяне на услугите. 
            Вашите данни са защитени съгласно <strong>GDPR</strong> и българското законодателство.
          </p>

          {/* Quick Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm">
            <p className="font-medium text-gray-800 mb-2">Какво обработваме:</p>
            <ul className="text-gray-600 space-y-1">
              <li>• Данни за регистрация (име, имейл, телефон)</li>
              <li>• Комуникация между клиенти и майстори</li>
              <li>• Местоположение (само при съгласие)</li>
            </ul>
          </div>

          {/* Expandable Details */}
          {showDetails && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4 text-sm">
              <p className="font-medium text-gray-800 mb-2">Вашите права по GDPR:</p>
              <ul className="text-gray-600 space-y-1">
                <li>✓ Достъп до данните си</li>
                <li>✓ Коригиране на неточни данни</li>
                <li>✓ Изтриване ("право да бъдеш забравен")</li>
                <li>✓ Преносимост на данните</li>
                <li>✓ Оттегляне на съгласие по всяко време</li>
              </ul>
              <p className="mt-3 text-gray-500">
                Контакт: <a href="mailto:admin@snapfix.bg" className="text-blue-600">admin@snapfix.bg</a>
              </p>
              <p className="mt-1 text-gray-500">
                Надзорен орган: <a href="https://cpdp.bg/" className="text-blue-600" target="_blank" rel="noopener">КЗЛД (cpdp.bg)</a>
              </p>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-wrap gap-3 text-sm mb-6">
            <Link href="/privacy-policy" className="text-blue-600 hover:underline">
              Политика за поверителност
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/terms" className="text-blue-600 hover:underline">
              Общи условия
            </Link>
            <span className="text-gray-300">|</span>
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-600 hover:underline"
            >
              {showDetails ? 'Скрий детайли' : 'Повече информация'}
            </button>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAcceptAll}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
            >
              Приемам всички
            </button>
            <button
              onClick={handleAcceptEssential}
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Само необходимите
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-gray-400 mt-4 text-center">
            Можете да промените настройките си по всяко време от профила си.
          </p>
        </div>
      </div>
    </div>
  )
}