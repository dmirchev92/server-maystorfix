'use client'

import { useState } from 'react'

interface TierFeature {
  name: string
  free: string | boolean
  normal: string | boolean
  pro: string | boolean
}

const features: TierFeature[] = [
  { name: 'Профил в платформата', free: true, normal: true, pro: true },
  { name: 'Видимост в търсенето', free: 'Стандартна', normal: 'Подобрена', pro: 'Премиум' },
  { name: 'Отзиви от клиенти', free: true, normal: true, pro: true },
  { name: 'Чат съобщения', free: true, normal: true, pro: true },
  { name: 'Макс. категории услуги', free: '2', normal: '5', pro: 'Неограничено' },
  { name: 'Макс. снимки в галерия', free: '5', normal: '20', pro: '100' },
  { name: 'Видео галерия', free: false, normal: true, pro: true },
  { name: 'Макс. сертификати', free: '2', normal: '10', pro: 'Неограничено' },
  { name: 'Месечни отговори на казуси', free: '10', normal: '50', pro: 'Неограничено' },
  { name: 'Значка "Потвърден"', free: false, normal: true, pro: true },
  { name: 'Значка "Премиум"', free: false, normal: true, pro: true },
  { name: 'Основна аналитика', free: false, normal: true, pro: true },
  { name: 'Разширена аналитика', free: false, normal: false, pro: true },
  { name: 'Приоритетни известия', free: false, normal: true, pro: true },
  { name: 'Социални мрежи', free: false, normal: true, pro: true },
  { name: 'Работно време', free: false, normal: true, pro: true },
  { name: 'Препоръчан профил', free: false, normal: false, pro: true },
  { name: 'Система за наддаване', free: false, normal: false, pro: true },
  { name: 'Приоритетна поддръжка', free: false, normal: false, pro: true },
  { name: 'Персонализиран брандинг', free: false, normal: false, pro: true },
  { name: 'API достъп', free: false, normal: false, pro: true }
]

interface TierComparisonTableProps {
  onSelectTier?: (tierId: 'free' | 'normal' | 'pro') => void
  selectedTier?: 'free' | 'normal' | 'pro'
  showActions?: boolean
}

export default function TierComparisonTable({ 
  onSelectTier, 
  selectedTier,
  showActions = true 
}: TierComparisonTableProps) {
  const [hoveredTier, setHoveredTier] = useState<string | null>(null)

  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <span className="text-green-600 text-xl">✓</span>
      ) : (
        <span className="text-gray-300 text-xl">—</span>
      )
    }
    return <span className="text-sm text-gray-700">{value}</span>
  }

  const getTierClasses = (tier: string) => {
    const isSelected = selectedTier === tier
    const isHovered = hoveredTier === tier
    const isRecommended = tier === 'normal'

    let classes = 'relative border-2 rounded-lg transition-all duration-200 '
    
    if (isSelected) {
      classes += 'border-blue-500 bg-blue-50 shadow-lg scale-105 '
    } else if (isHovered) {
      classes += 'border-blue-300 shadow-md scale-102 '
    } else if (isRecommended) {
      classes += 'border-green-400 '
    } else {
      classes += 'border-gray-200 '
    }

    return classes
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Mobile View - Cards */}
      <div className="md:hidden space-y-4">
        {['free', 'normal', 'pro'].map((tier) => (
          <div
            key={tier}
            className={getTierClasses(tier)}
            onMouseEnter={() => setHoveredTier(tier)}
            onMouseLeave={() => setHoveredTier(null)}
          >
            {tier === 'normal' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Препоръчан
              </div>
            )}
            
            <div className="p-6">
              <h3 className="text-2xl font-bold mb-2">
                {tier === 'free' && 'Безплатен'}
                {tier === 'normal' && 'Нормален'}
                {tier === 'pro' && 'Професионален'}
              </h3>
              
              <div className="mb-4">
                {tier === 'free' && (
                  <p className="text-3xl font-bold text-green-600">0 лв<span className="text-sm text-gray-500">/месец</span></p>
                )}
                {tier === 'normal' && (
                  <p className="text-3xl font-bold text-blue-600">250 лв<span className="text-sm text-gray-500">/месец</span></p>
                )}
                {tier === 'pro' && (
                  <p className="text-3xl font-bold text-purple-600">350 лв<span className="text-sm text-gray-500">/месец</span></p>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {features.map((feature, idx) => {
                  const value = feature[tier as keyof typeof feature]
                  if (value === false) return null
                  
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      {renderValue(value)}
                      <span className="text-sm text-gray-600">{feature.name}</span>
                    </div>
                  )
                })}
              </div>

              {showActions && onSelectTier && (
                <button
                  onClick={() => onSelectTier(tier as 'free' | 'normal' | 'pro')}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                    selectedTier === tier
                      ? 'bg-blue-600 text-white'
                      : tier === 'normal'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {selectedTier === tier ? 'Избран' : 'Избери'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-4 text-left bg-gray-50 border-b-2 border-gray-200">
                <span className="text-lg font-semibold text-gray-700">Функции</span>
              </th>
              
              {/* Free Tier Header */}
              <th 
                className={`p-4 text-center ${getTierClasses('free')}`}
                onMouseEnter={() => setHoveredTier('free')}
                onMouseLeave={() => setHoveredTier(null)}
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-800">Безплатен</h3>
                  <p className="text-2xl font-bold text-green-600">
                    0 лв<span className="text-sm text-gray-500">/месец</span>
                  </p>
                  {showActions && onSelectTier && (
                    <button
                      onClick={() => onSelectTier('free')}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                        selectedTier === 'free'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      }`}
                    >
                      {selectedTier === 'free' ? 'Избран' : 'Избери'}
                    </button>
                  )}
                </div>
              </th>

              {/* Normal Tier Header */}
              <th 
                className={`p-4 text-center ${getTierClasses('normal')}`}
                onMouseEnter={() => setHoveredTier('normal')}
                onMouseLeave={() => setHoveredTier(null)}
              >
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold z-10">
                  Препоръчан
                </div>
                <div className="space-y-2 mt-2">
                  <h3 className="text-xl font-bold text-gray-800">Нормален</h3>
                  <p className="text-2xl font-bold text-blue-600">
                    250 лв<span className="text-sm text-gray-500">/месец</span>
                  </p>
                  {showActions && onSelectTier && (
                    <button
                      onClick={() => onSelectTier('normal')}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                        selectedTier === 'normal'
                          ? 'bg-blue-600 text-white'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {selectedTier === 'normal' ? 'Избран' : 'Избери'}
                    </button>
                  )}
                </div>
              </th>

              {/* Pro Tier Header */}
              <th 
                className={`p-4 text-center ${getTierClasses('pro')}`}
                onMouseEnter={() => setHoveredTier('pro')}
                onMouseLeave={() => setHoveredTier(null)}
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-800">Професионален</h3>
                  <p className="text-2xl font-bold text-purple-600">
                    350 лв<span className="text-sm text-gray-500">/месец</span>
                  </p>
                  {showActions && onSelectTier && (
                    <button
                      onClick={() => onSelectTier('pro')}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                        selectedTier === 'pro'
                          ? 'bg-blue-600 text-white'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {selectedTier === 'pro' ? 'Избран' : 'Избери'}
                    </button>
                  )}
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {features.map((feature, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-4 text-left font-medium text-gray-700">
                  {feature.name}
                </td>
                <td className="p-4 text-center">{renderValue(feature.free)}</td>
                <td className="p-4 text-center">{renderValue(feature.normal)}</td>
                <td className="p-4 text-center">{renderValue(feature.pro)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Additional Info */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Важна информация</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Всички цени са в BGN (български лева)</li>
          <li>• Можете да надградите или понижите нивото по всяко време</li>
          <li>• Безплатният план е перфектен за начинаещи</li>
          <li>• Професионалният план включва система за наддаване за топ позиции</li>
          <li>• Няма скрити такси или допълнителни разходи</li>
        </ul>
      </div>
    </div>
  )
}
