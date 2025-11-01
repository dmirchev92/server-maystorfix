'use client'

interface TierSelectorProps {
  selectedTier?: 'free' | 'normal' | 'pro'
  onSelectTier: (tier: 'free' | 'normal' | 'pro') => void
}

const tiers = [
  {
    id: 'free' as const,
    name: 'Безплатен',
    price: '0 лв',
    features: ['2 категории', '5 снимки', '10 казуса/месец']
  },
  {
    id: 'normal' as const,
    name: 'Нормален',
    price: '250 лв/месец',
    features: ['5 категории', '20 снимки', '50 казуса/месец', 'Аналитика'],
    recommended: true
  },
  {
    id: 'pro' as const,
    name: 'Професионален',
    price: '350 лв/месец',
    features: ['Неограничено', '100 снимки', 'Наддаване', 'Приоритет']
  }
]

export default function TierSelector({ selectedTier = 'free', onSelectTier }: TierSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-200">
        Изберете план *
      </label>
      
      {tiers.map((tier) => {
        const isSelected = selectedTier === tier.id
        
        return (
          <div
            key={tier.id}
            onClick={() => onSelectTier(tier.id)}
            className={`
              relative p-4 rounded-lg border-2 cursor-pointer transition-all
              ${isSelected 
                ? 'border-indigo-500 bg-indigo-500/10' 
                : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }
            `}
          >
            <div className="flex items-start gap-3">
              {/* Radio Button */}
              <div className="flex-shrink-0 mt-1">
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-500'}
                `}>
                  {isSelected && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-white">
                    {tier.name}
                  </h3>
                  {tier.recommended && (
                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-medium">
                      Препоръчан
                    </span>
                  )}
                </div>
                
                <p className="text-sm font-medium text-indigo-400 mb-2">
                  {tier.price}
                </p>

                <ul className="space-y-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-xs text-slate-300">
                      <svg className="w-3.5 h-3.5 mr-1.5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )
      })}

      <p className="text-xs text-slate-400 mt-2">
        💡 Можете да промените плана си по всяко време
      </p>
    </div>
  )
}
